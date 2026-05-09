import { AST, ASTNode } from "./AST";

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

      case "While":
      case "If":
        throw new Error(`CODE GENERATION: ${node.kind} code generation not added yet.`);

      default:
        throw new Error(`CODE GENERATION: Unknown AST node '${node.label()}'.`);
    }
  }

  // VarDecl
  private generateVarDecl(node: ASTNode): void {
    const parts = (node.value ?? "").split(" ");
    const variableType = this.toVariableType(parts[0]);
    const variableName = parts[1];

    if (variableName === undefined) {
      throw new Error(`CODE GENERATION: Invalid variable declaration '${node.label()}'.`);
    }

    this.addStaticEntry(variableName, variableType);
  }

  // AssignmentStatement
  private generateAssignment(node: ASTNode): void {
    const variableName = node.value;

    if (variableName === null) {
      throw new Error("CODE GENERATION: Assignment node is missing a variable name.");
    }

    const expression = node.children[0];
    const staticEntry = this.getStaticEntry(variableName);

    if (staticEntry === undefined) {
      throw new Error(`CODE GENERATION: Could not find static entry for '${variableName}'.`);
    }

    if (expression === undefined) {
      throw new Error(`CODE GENERATION: Assignment to '${variableName}' is missing an expression.`);
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
      throw new Error("CODE GENERATION: Print statement is missing an expression.");
    }

    // print(a)
    if (expression.kind === "Id") {
      const variableName = expression.value;

      if (variableName === null) {
        throw new Error("CODE GENERATION: Id expression is missing a variable name.");
      }

      const staticEntry = this.getStaticEntry(variableName);

      if (staticEntry === undefined) {
        throw new Error(`CODE GENERATION: Could not find static entry for '${variableName}'.`);
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

      this.emit("A0"); // load Y register with heap pointer
      this.emit(this.toHexByte(String(heapAddress)));

      this.emit("A2"); // load X register with print mode
      this.emit("02"); // 02 = string print
      this.emit("FF");
      return;
    }

    // print(5), print(true), print(false), print(a + b), print(a == b)
    this.generateExprToAccumulator(expression);

    const printTemp = this.addTempEntry("int");
    this.storeAccumulatorInStatic(printTemp);

    this.emit("AC"); // load Y register from temp
    this.emit(printTemp.tempName);
    this.emit("XX");

    this.emit("A2"); // load X register with print mode
    this.emit("01"); // print int/boolean as 1/0
    this.emit("FF");
  }

  // expression code generation
  private generateExprToAccumulator(node: ASTNode): void {
    switch (node.kind) {
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
          throw new Error("CODE GENERATION: Id expression is missing a variable name.");
        }

        const staticEntry = this.getStaticEntry(variableName);

        if (staticEntry === undefined) {
          throw new Error(`CODE GENERATION: Could not find static entry for '${variableName}'.`);
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
        throw new Error(`CODE GENERATION: Expression '${node.label()}' not added yet.`);
    }
  }

  // IntExpr with +
  private generateAdd(node: ASTNode): void {
    const leftExpr = node.children[0];
    const rightExpr = node.children[1];

    if (leftExpr === undefined || rightExpr === undefined) {
      throw new Error("CODE GENERATION: Addition expression is missing a side.");
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
      throw new Error("CODE GENERATION: Boolean comparison is missing an expression.");
    }

    if (operatorNode?.value !== "==" && operatorNode?.value !== "!=") {
      throw new Error("CODE GENERATION: Boolean comparison is missing a valid operator.");
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

  // X register helpers
  private loadXWithExpr(node: ASTNode): void {
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

    if (node.kind === "Id") {
      const variableName = node.value;

      if (variableName === null) {
        throw new Error("CODE GENERATION: Id expression is missing a variable name.");
      }

      const staticEntry = this.getStaticEntry(variableName);

      if (staticEntry === undefined) {
        throw new Error(`CODE GENERATION: Could not find static entry for '${variableName}'.`);
      }

      this.emit("AE"); // load X register from memory
      this.emit(staticEntry.tempName);
      this.emit("XX");
      return;
    }

    throw new Error(`CODE GENERATION: Cannot load X with '${node.label()}'.`);
  }

  // CPX-style compare helper
  private compareXToExpr(node: ASTNode): void {
    if (node.kind === "Id") {
      const variableName = node.value;

      if (variableName === null) {
        throw new Error("CODE GENERATION: Id expression is missing a variable name.");
      }

      const staticEntry = this.getStaticEntry(variableName);

      if (staticEntry === undefined) {
        throw new Error(`CODE GENERATION: Could not find static entry for '${variableName}'.`);
      }

      this.emit("EC"); // compare memory to X register
      this.emit(staticEntry.tempName);
      this.emit("XX");
      return;
    }

    if (node.kind === "Digit" || node.kind === "BoolVal") {
      const tempEntry = this.addTempEntry("int");
      const value = node.kind === "BoolVal"
        ? node.value === "true" ? "1" : "0"
        : node.value ?? "0";

      this.emit("A9"); // load accumulator with constant
      this.emit(this.toHexByte(value));
      this.storeAccumulatorInStatic(tempEntry);

      this.emit("EC"); // compare temp memory to X register
      this.emit(tempEntry.tempName);
      this.emit("XX");
      return;
    }

    throw new Error(`CODE GENERATION: Cannot compare X to '${node.label()}'.`);
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

    this.writeHeapByte("00"); // null terminator

    for (let i = value.length - 1; i >= 0; i--) {
      this.writeHeapByte(this.charToHex(value[i]));
    }

    const startAddress = this.heapPointer + 1;

    this.heapTable.push({
      value,
      address: startAddress
    });

    this.log(`Stored string "${value}" at ${this.toHexByte(String(startAddress))}`);

    return startAddress;
  }

  private writeHeapByte(byte: string): void {
    if (this.heapPointer < 0) {
      throw new Error("CODE GENERATION: Heap ran out of memory.");
    }

    this.code[this.heapPointer] = byte.toUpperCase();
    this.heapPointer--;
  }

  // replaces T0 XX, T1 XX, etc. with final static addresses
  private backpatchStaticTable(): void {
    for (const entry of this.staticTable) {
      const address = this.codePointer;

      if (address > this.heapPointer) {
        throw new Error("CODE GENERATION: Static memory collided with heap memory.");
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
      throw new Error("CODE GENERATION: Code/static memory collided with heap memory.");
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
      throw new Error("CODE GENERATION: Code memory collided with heap memory.");
    }

    this.code[this.codePointer] = byte.toUpperCase();
    this.codePointer++;

    if (this.verbose) {
      console.log(`CODE GENERATION: ${byte.toUpperCase()}`);
    }
  }

  // formats output for tsiram like input
private formatCode(): string[] {
  const oneLineOutput = this.code
    .map(byte => `0x${byte}`)
    .join(", ");

  return [oneLineOutput];
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
      throw new Error(`CODE GENERATION: '${value}' cannot fit in one byte.`);
    }

    return numberValue.toString(16).toUpperCase().padStart(2, "0");
  }

  private toVariableType(value: string | undefined): VariableType {
    if (value === "int" || value === "string" || value === "boolean") {
      return value;
    }

    throw new Error(`CODE GENERATION: Invalid variable type '${value}'.`);
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`CODE GENERATION: ${message}`);
    }
  }
}