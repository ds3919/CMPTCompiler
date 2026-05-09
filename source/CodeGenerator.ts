import { AST, ASTNode } from "./AST";

export class CodeGenerator {
  private output: string[] = [];

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
    this.emit(`; ${programNode.label()}`);

    for (const child of programNode.children) {
      if (child.kind === "Block") {
        this.generateBlock(child);
      }
    }

    this.emit("; End Program");
    this.emit("");
  }

  // Block
  private generateBlock(blockNode: ASTNode): void {
    this.emit("; Enter Block");

    for (const child of blockNode.children) {
      this.generateStatement(child);
    }

    this.emit("; Leave Block");
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

      case "While":
        this.generateWhile(node);
        break;

      case "If":
        this.generateIf(node);
        break;

      case "Block":
        this.generateBlock(node);
        break;

      default:
        this.emit(`; Skipped unknown node ${node.label()}`);
        break;
    }
  }

  // VarDecl
  private generateVarDecl(node: ASTNode): void {
    this.emit(`DECLARE ${node.value ?? "unknown"}`);
  }

  // AssignmentStatement
  private generateAssignment(node: ASTNode): void {
    const variableName = node.value ?? "unknown";
    const expression = node.children[0];

    this.generateExpr(expression);
    this.emit(`STORE ${variableName}`);
  }

  // PrintStatement
  private generatePrint(node: ASTNode): void {
    const expression = node.children[0];

    this.generateExpr(expression);
    this.emit("PRINT");
  }

  // WhileStatement
  private generateWhile(node: ASTNode): void {
    this.emit("; While Start");

    const conditionNode = node.children[0]?.children[0];
    const blockNode = node.children[1];

    this.generateExpr(conditionNode);
    this.emit("BRANCH_IF_FALSE ; exit while");

    if (blockNode !== undefined) {
      this.generateBlock(blockNode);
    }

    this.emit("BRANCH ; back to while condition");
    this.emit("; While End");
  }

  // IfStatement
  private generateIf(node: ASTNode): void {
    this.emit("; If Start");

    const conditionNode = node.children[0]?.children[0];
    const blockNode = node.children[1];

    this.generateExpr(conditionNode);
    this.emit("BRANCH_IF_FALSE ; skip if block");

    if (blockNode !== undefined) {
      this.generateBlock(blockNode);
    }

    this.emit("; If End");
  }

  // expression dispatcher
  private generateExpr(node: ASTNode | undefined): void {
    if (node === undefined) {
      this.emit("LOAD_UNKNOWN");
      return;
    }

    switch (node.kind) {
      case "Digit":
        this.emit(`LOAD_CONST ${node.value ?? "unknown"}`);
        break;

      case "String":
        this.emit(`LOAD_STRING "${node.value ?? ""}"`);
        break;

      case "BoolVal":
        this.emit(`LOAD_BOOL ${node.value ?? "unknown"}`);
        break;

      case "Id":
        this.emit(`LOAD_VAR ${node.value ?? "unknown"}`);
        break;

      case "Add":
        this.generateAdd(node);
        break;

      case "Compare":
        this.generateCompare(node);
        break;

      default:
        this.emit(`LOAD_UNKNOWN ; ${node.label()}`);
        break;
    }
  }

  // IntExpr with +
  private generateAdd(node: ASTNode): void {
    const leftExpr = node.children[0];
    const rightExpr = node.children[1];

    this.generateExpr(leftExpr);
    this.generateExpr(rightExpr);

    this.emit("ADD");
  }

  // BooleanExpr comparison
  private generateCompare(node: ASTNode): void {
    const expressionChildren = node.children.filter(child => child.kind !== "BoolOp");
    const operatorNode = node.children.find(child => child.kind === "BoolOp");

    const leftExpr = expressionChildren[0];
    const rightExpr = expressionChildren[1];

    this.generateExpr(leftExpr);
    this.generateExpr(rightExpr);

    this.emit(`COMPARE ${operatorNode?.value ?? "unknown"}`);
  }

  // output helpers
  private emit(instruction: string): void {
    this.output.push(instruction);

    if (this.verbose) {
      console.log(`CODE GENERATION: ${instruction}`);
    }
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`CODE GENERATION: ${message}`);
    }
  }
}