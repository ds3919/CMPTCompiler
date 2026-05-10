import { AST, ASTNode } from "./AST";

export class CodeGenerationError extends Error {
  constructor(
    public readonly programLabel: string,
    message: string,
    public readonly suggestion?: string
  ) {
    super(message);
    this.name = "CodeGenerationError";
  }
}

type VariableType = "int" | "string" | "boolean";

type StaticEntry = {
  name: string;
  type: VariableType;
  tempName: string;
  address: number | null;
  isTemp: boolean;
};

type HeapEntry = {
  value: string;
  address: number;
};

export class CodeGenerator {
  private output: string[] = [];

  private code: string[] = [];
  private staticTable: StaticEntry[] = [];
  private heapTable: HeapEntry[] = [];

  private codePointer = 0;
  private heapPointer = 255;
  private tempCounter = 0;
  private currentProgramLabel = "Program ?";

  constructor(
    private ast: AST,
    private verbose = true
  ) {}

  // main code generation method
  public generate(): string[] {
    this.log("Starting Code Generation");

    const root = this.ast.getRoot();

    if (root !== null) {
      for (const program of root.children) {
        this.generateProgram(program);
      }
    }

    this.log("Code Generation finished");

    return this.output;
  }

  // Program ::= Block
  private generateProgram(programNode: ASTNode): void {
    this.resetProgramMemory();
    this.currentProgramLabel = programNode.label();

    this.log(`Generating code for ${programNode.label()}`);

    for (const child of programNode.children) {
      if (child.kind === "Block") {
        this.generateBlock(child);
      }
    }

    this.emit("00"); // break/end program

    this.backpatchStaticTable();
    this.checkMemoryCollision();
    this.padProgram();

    this.output.push(`${programNode.label()}:`);
    this.output.push(...this.formatCode());
    this.output.push("");
  }

  // Block
  private generateBlock(blockNode: ASTNode): void {
    for (const child of blockNode.children) {
      this.generateStatement(child);
    }
  }

  // statement dispatcher
  private generateStatement(node: ASTNode): void {
    switch (node.kind) {
      case "VarDecl":
        this.generateVarDecl(node);
        break;

      case "Assign":
        this.generateAssignment(node);
        break;

      case "Print":
        this.generatePrint(node);
        break;

      case "Block":
        this.generateBlock(node);
        break;

      case "If":
        this.generateIfStatement(node);
        break;

      case "While":
        this.generateWhileStatement(node);
        break;

      default:
        this.fail(
          `Unknown AST node '${node.label()}'.`,
          "Check that the AST builder is producing nodes that code generation supports."
        );
    }
  }

  // VarDecl
  private generateVarDecl(node: ASTNode): void {
    const parts = (node.value ?? "").split(" ");
    const variableType = this.toVariableType(parts[0]);
    const variableName = parts[1];

    if (variableName === undefined) {
      this.fail(
        `Invalid variable declaration '${node.label()}'.`,
        "Check that variable declarations are built as type/name pairs, for example int a."
      );
    }

    this.addStaticEntry(variableName, variableType);
  }

  // AssignmentStatement
  private generateAssignment(node: ASTNode): void {
    const variableName = node.value;

    if (variableName === null) {
      this.fail(
        "Assignment node is missing a variable name.",
        "Check the AST builder output for assignment statements."
      );
    }

    const expression = node.children[0];
    const staticEntry = this.getStaticEntry(variableName);

    if (staticEntry === undefined) {
      this.fail(
        `Could not find static entry for '${variableName}'.`,
        "Check that semantic analysis declared this variable before code generation."
      );
    }

    if (expression === undefined) {
      this.fail(
        `Assignment to '${variableName}' is missing an expression.`,
        "Check the AST builder output for assignment statements."
      );
    }

    // c = (a != b)
    if (expression.kind === "Compare") {
      this.generateCompareAssignment(expression, staticEntry);
      return;
    }

    this.generateExprToAccumulator(expression);
    this.storeAccumulatorInStatic(staticEntry);
  }

  // PrintStatement
  private generatePrint(node: ASTNode): void {
    const expression = node.children[0];

    if (expression === undefined) {
      this.fail(
        "Print statement is missing an expression.",
        "Check that parser and AST builder only pass valid print expressions into code generation."
      );
    }

    // print(a)
    if (expression.kind === "Id") {
      const variableName = expression.value;

      if (variableName === null) {
        this.fail(
          "Id expression is missing a variable name.",
          "Check the AST builder output for identifier expressions."
        );
      }

      const staticEntry = this.getStaticEntry(variableName);

      if (staticEntry === undefined) {
        this.fail(
          `Could not find static entry for '${variableName}'.`,
          "Check that semantic analysis declared this variable before code generation."
        );
      }

      this.emit("AC"); // load Y register from memory
      this.emit(staticEntry.tempName);
      this.emit("XX");

      this.emit("A2"); // load X register with print mode
      this.emit(staticEntry.type === "string" ? "02" : "01");
      this.emit("FF"); // system call
      return;
    }

    // print("hello")
    if (expression.kind === "String") {
      const heapAddress = this.addStringToHeap(expression.value ?? "");
      const stringTemp = this.addTempEntry("string");

      this.emit("A9"); // load accumulator with heap pointer
      this.emit(this.toHexByte(String(heapAddress)));

      this.storeAccumulatorInStatic(stringTemp);

      this.emit("AC"); // load Y register from temp pointer
      this.emit(stringTemp.tempName);
      this.emit("XX");

      this.emit("A2"); // load X register with print mode
      this.emit("02"); // 02 = string print
      this.emit("FF"); // system call
      return;
    }

    // print(5), print(true), print(false), print(a + b), print(a == b)
    this.generateExprToAccumulator(expression);

    const printTemp = this.addTempEntry(this.getTempTypeForExpr(expression));
    this.storeAccumulatorInStatic(printTemp);

    this.emit("AC"); // load Y register from temp
    this.emit(printTemp.tempName);
    this.emit("XX");

    this.emit("A2"); // load X register with print mode
    this.emit(printTemp.type === "string" ? "02" : "01");
    this.emit("FF");
  }

  // IfStatement
  private generateIfStatement(node: ASTNode): void {
    const condition = this.getConditionNode(node);
    const block = this.getBlockNode(node);

    if (condition === undefined || block === undefined) {
      this.fail(
        "If statement is missing a condition or block.",
        "Check the AST builder output for if statements."
      );
    }

    const falseJumpIndex = this.generateBranchIfConditionFalse(condition);

    this.generateBlock(block);

    this.patchForwardBranch(falseJumpIndex);
  }

  // WhileStatement
  private generateWhileStatement(node: ASTNode): void {
    const condition = this.getConditionNode(node);
    const block = this.getBlockNode(node);

    if (condition === undefined || block === undefined) {
      this.fail(
        "While statement is missing a condition or block.",
        "Check the AST builder output for while statements."
      );
    }

    const loopStartAddress = this.codePointer;
    const falseJumpIndex = this.generateBranchIfConditionFalse(condition);

    this.generateBlock(block);
    this.generateAlwaysBranchBack(loopStartAddress);

    this.patchForwardBranch(falseJumpIndex);
  }

  // expression code generation
  private generateExprToAccumulator(node: ASTNode): void {
    switch (node.kind) {
      case "Condition":
        if (node.children[0] === undefined) {
          this.fail(
            "Condition is missing an expression.",
            "Check the AST builder output for condition nodes."
          );
        }

        this.generateExprToAccumulator(node.children[0]);
        return;

      case "Digit":
        this.emit("A9"); // load accumulator with constant
        this.emit(this.toHexByte(node.value ?? "0"));
        return;

      case "BoolVal":
        this.emit("A9"); // load accumulator with boolean value
        this.emit(node.value === "true" ? "01" : "00");
        return;

      case "String": {
        const heapAddress = this.addStringToHeap(node.value ?? "");

        this.emit("A9"); // load accumulator with heap pointer
        this.emit(this.toHexByte(String(heapAddress)));
        return;
      }

      case "Id": {
        const variableName = node.value;

        if (variableName === null) {
          this.fail(
            "Id expression is missing a variable name.",
            "Check the AST builder output for identifier expressions."
          );
        }

        const staticEntry = this.getStaticEntry(variableName);

        if (staticEntry === undefined) {
          this.fail(
            `Could not find static entry for '${variableName}'.`,
            "Check that semantic analysis declared this variable before code generation."
          );
        }

        this.emit("AD"); // load accumulator from memory
        this.emit(staticEntry.tempName);
        this.emit("XX");
        return;
      }

      case "Add":
        this.generateAdd(node);
        return;

      case "Compare": {
        const compareTemp = this.addTempEntry("boolean");
        this.generateCompareAssignment(node, compareTemp);

        this.emit("AD"); // load comparison result into accumulator
        this.emit(compareTemp.tempName);
        this.emit("XX");
        return;
      }

      default:
        this.fail(
          `Expression '${node.label()}' not added yet.`,
          "Add code generation support for this AST expression kind."
        );
    }
  }

  // IntExpr with +
  private generateAdd(node: ASTNode): void {
    const leftExpr = node.children[0];
    const rightExpr = node.children[1];

    if (leftExpr === undefined || rightExpr === undefined) {
      this.fail(
        "Addition expression is missing a side.",
        "Check the AST builder output for addition expressions."
      );
    }

    const leftTemp = this.addTempEntry("int");

    this.generateExprToAccumulator(leftExpr);
    this.storeAccumulatorInStatic(leftTemp);

    this.generateExprToAccumulator(rightExpr);

    this.emit("6D"); // add with carry from memory
    this.emit(leftTemp.tempName);
    this.emit("XX");
  }

  // BooleanExpr comparison assignment
  private generateCompareAssignment(compareNode: ASTNode, targetEntry: StaticEntry): void {
    const expressionChildren = compareNode.children.filter(child => child.kind !== "BoolOp");
    const operatorNode = compareNode.children.find(child => child.kind === "BoolOp");

    const leftExpr = expressionChildren[0];
    const rightExpr = expressionChildren[1];

    if (leftExpr === undefined || rightExpr === undefined) {
      this.fail(
        "Boolean comparison is missing an expression.",
        "Check the AST builder output for comparison expressions."
      );
    }

    if (operatorNode?.value !== "==" && operatorNode?.value !== "!=") {
      this.fail(
        "Boolean comparison is missing a valid operator.",
        "Expected either == or != in the comparison node."
      );
    }

    if (operatorNode.value === "==") {
      this.generateEqualityComparison(leftExpr, rightExpr, targetEntry);
      return;
    }

    this.generateInequalityComparison(leftExpr, rightExpr, targetEntry);
  }

  // stores 1 if left == right, otherwise 0
  private generateEqualityComparison(
    leftExpr: ASTNode,
    rightExpr: ASTNode,
    targetEntry: StaticEntry
  ): void {
    this.emit("A9"); // default result false
    this.emit("00");
    this.storeAccumulatorInStatic(targetEntry);

    this.loadXWithExpr(leftExpr);
    this.compareXToExpr(rightExpr);

    this.emit("D0"); // if not equal, skip true assignment
    this.emit("05");

    this.emit("A9"); // result true
    this.emit("01");
    this.storeAccumulatorInStatic(targetEntry);
  }

  // stores 1 if left != right, otherwise 0
  private generateInequalityComparison(
    leftExpr: ASTNode,
    rightExpr: ASTNode,
    targetEntry: StaticEntry
  ): void {
    this.emit("A9"); // default result true
    this.emit("01");
    this.storeAccumulatorInStatic(targetEntry);

    this.loadXWithExpr(leftExpr);
    this.compareXToExpr(rightExpr);

    this.emit("D0"); // if not equal, skip false assignment
    this.emit("05");

    this.emit("A9"); // result false
    this.emit("00");
    this.storeAccumulatorInStatic(targetEntry);
  }

  // condition branch helper
  private generateBranchIfConditionFalse(condition: ASTNode): number {
    const conditionTemp = this.addTempEntry("boolean");

    this.generateExprToAccumulator(condition);
    this.storeAccumulatorInStatic(conditionTemp);

    this.emit("A2"); // load X register with true
    this.emit("01");

    this.emit("EC"); // compare condition temp to X
    this.emit(conditionTemp.tempName);
    this.emit("XX");

    this.emit("D0"); // if condition is false, branch over block
    const jumpIndex = this.codePointer;
    this.emit("J0");

    return jumpIndex;
  }

  // creates an unconditional backward branch using BNE
  private generateAlwaysBranchBack(targetAddress: number): void {
    const alwaysTemp = this.addTempEntry("boolean");

    this.emit("A9"); // store true in memory
    this.emit("01");
    this.storeAccumulatorInStatic(alwaysTemp);

    this.emit("A2"); // load X with false
    this.emit("00");

    this.emit("EC"); // compare true to false, forcing Z = 0
    this.emit(alwaysTemp.tempName);
    this.emit("XX");

    this.emit("D0"); // always branch because Z = 0

    const nextAddressAfterBranch = this.codePointer + 1;
    const offset = (targetAddress - nextAddressAfterBranch + 256) % 256;

    this.emit(this.toHexByte(String(offset)));
  }

  private patchForwardBranch(jumpIndex: number): void {
    const nextAddressAfterBranch = jumpIndex + 1;
    const distance = this.codePointer - nextAddressAfterBranch;

    if (distance < 0 || distance > 255) {
      this.fail(
        "Branch distance cannot fit in one byte.",
        "Reduce the amount of generated code inside this branch or split the program into smaller blocks."
      );
    }

    this.code[jumpIndex] = this.toHexByte(String(distance));
  }

  // X register helpers
  private loadXWithExpr(node: ASTNode): void {
    if (node.kind === "Condition") {
      if (node.children[0] === undefined) {
        this.fail(
          "Condition is missing an expression.",
          "Check the AST builder output for condition nodes."
        );
      }

      this.loadXWithExpr(node.children[0]);
      return;
    }

    if (node.kind === "Digit") {
      this.emit("A2"); // load X register with constant
      this.emit(this.toHexByte(node.value ?? "0"));
      return;
    }

    if (node.kind === "BoolVal") {
      this.emit("A2");
      this.emit(node.value === "true" ? "01" : "00");
      return;
    }

    if (node.kind === "String") {
      const heapAddress = this.addStringToHeap(node.value ?? "");

      this.emit("A2");
      this.emit(this.toHexByte(String(heapAddress)));
      return;
    }

    if (node.kind === "Id") {
      const variableName = node.value;

      if (variableName === null) {
        this.fail(
          "Id expression is missing a variable name.",
          "Check the AST builder output for identifier expressions."
        );
      }

      const staticEntry = this.getStaticEntry(variableName);

      if (staticEntry === undefined) {
        this.fail(
          `Could not find static entry for '${variableName}'.`,
          "Check that semantic analysis declared this variable before code generation."
        );
      }

      this.emit("AE"); // load X register from memory
      this.emit(staticEntry.tempName);
      this.emit("XX");
      return;
    }

    const tempEntry = this.addTempEntry(this.getTempTypeForExpr(node));

    this.generateExprToAccumulator(node);
    this.storeAccumulatorInStatic(tempEntry);

    this.emit("AE"); // load X register from temp
    this.emit(tempEntry.tempName);
    this.emit("XX");
  }

  // CPX-style compare helper
  private compareXToExpr(node: ASTNode): void {
    if (node.kind === "Condition") {
      if (node.children[0] === undefined) {
        this.fail(
          "Condition is missing an expression.",
          "Check the AST builder output for condition nodes."
        );
      }

      this.compareXToExpr(node.children[0]);
      return;
    }

    if (node.kind === "Id") {
      const variableName = node.value;

      if (variableName === null) {
        this.fail(
          "Id expression is missing a variable name.",
          "Check the AST builder output for identifier expressions."
        );
      }

      const staticEntry = this.getStaticEntry(variableName);

      if (staticEntry === undefined) {
        this.fail(
          `Could not find static entry for '${variableName}'.`,
          "Check that semantic analysis declared this variable before code generation."
        );
      }

      this.emit("EC"); // compare memory to X register
      this.emit(staticEntry.tempName);
      this.emit("XX");
      return;
    }

    const tempEntry = this.addTempEntry(this.getTempTypeForExpr(node));

    this.generateExprToAccumulator(node);
    this.storeAccumulatorInStatic(tempEntry);

    this.emit("EC"); // compare temp memory to X register
    this.emit(tempEntry.tempName);
    this.emit("XX");
  }

  // static table handling
  private addStaticEntry(variableName: string, variableType: VariableType): StaticEntry {
    const existingEntry = this.getStaticEntry(variableName);

    if (existingEntry !== undefined) {
      return existingEntry;
    }

    const entry: StaticEntry = {
      name: variableName,
      type: variableType,
      tempName: `T${this.tempCounter}`,
      address: null,
      isTemp: false
    };

    this.tempCounter++;
    this.staticTable.push(entry);

    return entry;
  }

  private addTempEntry(variableType: VariableType): StaticEntry {
    const entry: StaticEntry = {
      name: `temp${this.tempCounter}`,
      type: variableType,
      tempName: `T${this.tempCounter}`,
      address: null,
      isTemp: true
    };

    this.tempCounter++;
    this.staticTable.push(entry);

    return entry;
  }

  private getStaticEntry(variableName: string): StaticEntry | undefined {
    return this.staticTable.find(entry => !entry.isTemp && entry.name === variableName);
  }

  private storeAccumulatorInStatic(staticEntry: StaticEntry): void {
    this.emit("8D"); // store accumulator in memory
    this.emit(staticEntry.tempName);
    this.emit("XX");
  }

  // heap handling
  private addStringToHeap(value: string): number {
    const existingEntry = this.heapTable.find(entry => entry.value === value);

    if (existingEntry !== undefined) {
      return existingEntry.address;
    }

    const startAddress = this.heapPointer - value.length;
    const endAddress = this.heapPointer;

    if (startAddress <= this.codePointer) {
      this.fail(
        "Program is too large for 256 bytes. Generated code, static memory, and heap strings overlap.",
        "Shorten string literals, reduce the number of statements, or split the source into smaller programs."
      );
    }

    // memory is zero-based, so the array index is the actual address
    for (let i = 0; i < value.length; i++) {
      const address = startAddress + i;
      this.code[address] = this.charToHex(value[i]);
    }

    this.code[endAddress] = "00"; // null terminator
    this.heapPointer = startAddress - 1;

    this.heapTable.push({
      value,
      address: startAddress
    });

    this.log(`Stored string "${value}" at ${this.toHexByte(String(startAddress))}`);

    return startAddress;
  }

  // replaces T0 XX, T1 XX, etc. with final static addresses
  private backpatchStaticTable(): void {
    for (const entry of this.staticTable) {
      const address = this.codePointer;

      if (address > this.heapPointer) {
        this.fail(
          "Program is too large for 256 bytes. Generated code, static memory, and heap strings overlap.",
          "Reduce the number of variables, temporary values, statements, or string literals."
        );
      }

      entry.address = address;
      this.codePointer++;
      this.code[address] = "00";

      for (let i = 0; i < this.code.length; i++) {
        if (this.code[i] === entry.tempName && this.code[i + 1] === "XX") {
          this.code[i] = this.toHexByte(String(address));
          this.code[i + 1] = "00";
        }
      }
    }
  }

  // makes sure code/static memory did not run into heap memory
  private checkMemoryCollision(): void {
    if (this.codePointer - 1 >= this.heapPointer + 1) {
      this.fail(
        "Program is too large for 256 bytes. Generated code, static memory, and heap strings overlap.",
        "Reduce the program size or split the source into smaller programs."
      );
    }
  }

  // fills unused memory with 00
  private padProgram(): void {
    for (let i = 0; i < 256; i++) {
      if (this.code[i] === undefined) {
        this.code[i] = "00";
      }
    }
  }

  // output helpers
  private emit(byte: string): void {
    if (this.codePointer > this.heapPointer) {
      this.fail(
        "Program is too large for 256 bytes. Generated code, static memory, and heap strings overlap.",
        "Reduce generated code size before adding more statements or nested blocks."
      );
    }

    this.code[this.codePointer] = byte.toUpperCase();
    this.codePointer++;

    if (this.verbose) {
      console.log(`CODE GENERATION: ${byte.toUpperCase()}`);
    }
  }

  // formats output as raw hex bytes
  private formatCode(): string[] {
    const oneLineOutput = this.code.join(" ");

    return [oneLineOutput];
  }

  // ast helpers
  private getConditionNode(node: ASTNode): ASTNode | undefined {
    const conditionNode = node.children.find(child => child.kind === "Condition");

    if (conditionNode !== undefined) {
      return conditionNode.children[0];
    }

    return node.children.find(child => child.kind !== "Block");
  }

  private getBlockNode(node: ASTNode): ASTNode | undefined {
    return node.children.find(child => child.kind === "Block");
  }

  private getTempTypeForExpr(node: ASTNode): VariableType {
    switch (node.kind) {
      case "Condition":
        if (node.children[0] === undefined) {
          return "boolean";
        }

        return this.getTempTypeForExpr(node.children[0]);

      case "String":
        return "string";

      case "BoolVal":
      case "Compare":
        return "boolean";

      default:
        return "int";
    }
  }

  private fail(message: string, suggestion?: string): never {
    throw new CodeGenerationError(
      this.currentProgramLabel,
      message,
      suggestion
    );
  }

  private resetProgramMemory(): void {
    this.code = [];
    this.staticTable = [];
    this.heapTable = [];

    this.codePointer = 0;
    this.heapPointer = 255;
    this.tempCounter = 0;
  }

  private charToHex(char: string): string {
    return char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0");
  }

  private toHexByte(value: string): string {
    const numberValue = Number(value);

    if (Number.isNaN(numberValue) || numberValue < 0 || numberValue > 255) {
      this.fail(
        `'${value}' cannot fit in one byte.`,
        "6502 memory values must fit between 0 and 255."
      );
    }

    return numberValue.toString(16).toUpperCase().padStart(2, "0");
  }

  private toVariableType(value: string | undefined): VariableType {
    if (value === "int" || value === "string" || value === "boolean") {
      return value;
    }

    this.fail(
      `Invalid variable type '${value}'.`,
      "Expected one of: int, string, or boolean."
    );
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`CODE GENERATION: ${message}`);
    }
  }
}