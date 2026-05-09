import { AST, ASTNode } from "./AST";
import { DiagnosticReporter } from "./DiagnosticReporter";
import { SymbolEntry, SymbolTable, VariableType } from "./SymbolTable";

export class SemanticAnalyzer {
  private symbolTable = new SymbolTable();

  constructor(
    private ast: AST,
    private diagnostics: DiagnosticReporter,
    private verbose = true
  ) {}

  // main semantic analysis method
  public analyze(): SymbolTable {
    this.log("Starting Semantic Analysis");

    const root = this.ast.getRoot();

    if (root !== null) {
      for (const program of root.children) {
        this.analyzeProgram(program);
      }
    }

    this.checkWarnings();

    this.log("Semantic Analysis finished");

    return this.symbolTable;
  }

  // Program ::= Block
  private analyzeProgram(programNode: ASTNode): void {
    this.log(`Analyzing ${programNode.label()}`);

    for (const child of programNode.children) {
      if (child.kind === "Block") {
        this.analyzeBlock(child);
      }
    }
  }

  // Block creates a new scope
  private analyzeBlock(blockNode: ASTNode): void {
    const scopeId = this.symbolTable.enterScope();

    this.log(`Entering scope ${scopeId}`);

    for (const child of blockNode.children) {
      this.analyzeStatement(child);
    }

    this.log(`Leaving scope ${scopeId}`);

    this.symbolTable.leaveScope();
  }

  // statement dispatcher
  private analyzeStatement(node: ASTNode): void {
    switch (node.kind) {
      case "VarDecl":
        this.analyzeVarDecl(node);
        break;

      case "Assign":
        this.analyzeAssignment(node);
        break;

      case "Print":
        this.analyzePrint(node);
        break;

      case "While":
        this.analyzeWhile(node);
        break;

      case "If":
        this.analyzeIf(node);
        break;

      case "Block":
        this.analyzeBlock(node);
        break;

      default:
        break;
    }
  }

  // VarDecl
  private analyzeVarDecl(node: ASTNode): void {
    const parts = (node.value ?? "").split(" ");
    const type = this.toVariableType(parts[0]);
    const name = parts[1] ?? "unknown";
    const token = node.token;
    const scopeId = this.symbolTable.currentScopeId() ?? 0;

    const symbol: SymbolEntry = {
      name,
      type,
      scope: scopeId,
      line: token?.line ?? 1,
      startColumn: token?.startColumn ?? 1,
      endColumn: token?.endColumn ?? 1,
      programNumber: token?.programNumber ?? 1,
      initialized: false,
      used: false
    };

    const declared = this.symbolTable.declare(symbol);

    if (!declared) {
      this.diagnostics.error(
        "Semantic Analysis",
        `Variable '${name}' has already been declared in this scope.`,
        token?.line ?? 1,
        token?.startColumn ?? 1,
        token?.endColumn ?? 1,
        token?.programNumber ?? 1,
        name,
        "unique identifier in the current scope",
        "Use a different identifier name, or remove the duplicate declaration."
      );
    }
  }

  // AssignmentStatement
  private analyzeAssignment(node: ASTNode): void {
    const name = node.value ?? "unknown";
    const token = node.token;
    const symbol = this.symbolTable.lookup(name);

    if (symbol === undefined) {
      this.diagnostics.error(
        "Semantic Analysis",
        `Variable '${name}' was assigned before it was declared.`,
        token?.line ?? 1,
        token?.startColumn ?? 1,
        token?.endColumn ?? 1,
        token?.programNumber ?? 1,
        name,
        "declared variable",
        "Declare the variable before assigning a value to it."
      );

      this.analyzeExpr(node.children[0]);
      return;
    }

    const exprType = this.analyzeExpr(node.children[0]);

    if (exprType !== "unknown" && symbol.type !== exprType) {
      this.diagnostics.error(
        "Semantic Analysis",
        `Type mismatch in assignment to '${name}'.`,
        token?.line ?? 1,
        token?.startColumn ?? 1,
        token?.endColumn ?? 1,
        token?.programNumber ?? 1,
        exprType,
        symbol.type,
        `Assign a value of type ${symbol.type} to '${name}'.`
      );
    }

    symbol.initialized = true;
  }

  // PrintStatement
  private analyzePrint(node: ASTNode): void {
    this.analyzeExpr(node.children[0]);
  }

  // WhileStatement
  private analyzeWhile(node: ASTNode): void {
    const conditionNode = node.children[0]?.children[0];
    const blockNode = node.children[1];

    const conditionType = this.analyzeExpr(conditionNode);

    if (conditionType !== "unknown" && conditionType !== "boolean") {
      this.diagnostics.error(
        "Semantic Analysis",
        "While statement condition must evaluate to boolean.",
        node.token?.line ?? 1,
        node.token?.startColumn ?? 1,
        node.token?.endColumn ?? 1,
        node.token?.programNumber ?? 1,
        conditionType,
        "boolean",
        "Use true, false, or a boolean comparison as the while condition."
      );
    }

    if (blockNode !== undefined) {
      this.analyzeBlock(blockNode);
    }
  }

  // IfStatement
  private analyzeIf(node: ASTNode): void {
    const conditionNode = node.children[0]?.children[0];
    const blockNode = node.children[1];

    const conditionType = this.analyzeExpr(conditionNode);

    if (conditionType !== "unknown" && conditionType !== "boolean") {
      this.diagnostics.error(
        "Semantic Analysis",
        "If statement condition must evaluate to boolean.",
        node.token?.line ?? 1,
        node.token?.startColumn ?? 1,
        node.token?.endColumn ?? 1,
        node.token?.programNumber ?? 1,
        conditionType,
        "boolean",
        "Use true, false, or a boolean comparison as the if condition."
      );
    }

    if (blockNode !== undefined) {
      this.analyzeBlock(blockNode);
    }
  }

  // expression type checking
  private analyzeExpr(node: ASTNode | undefined): VariableType {
    if (node === undefined) {
      return "unknown";
    }

    switch (node.kind) {
      case "Digit":
        return "int";

      case "String":
        return "string";

      case "BoolVal":
        return "boolean";

      case "Id":
        return this.analyzeId(node);

      case "Add":
        return this.analyzeAdd(node);

      case "Compare":
        return this.analyzeCompare(node);

      default:
        return "unknown";
    }
  }

  // Id expression
  private analyzeId(node: ASTNode): VariableType {
    const name = node.value ?? "unknown";
    const token = node.token;
    const symbol = this.symbolTable.lookup(name);

    if (symbol === undefined) {
      this.diagnostics.error(
        "Semantic Analysis",
        `Variable '${name}' was used before it was declared.`,
        token?.line ?? 1,
        token?.startColumn ?? 1,
        token?.endColumn ?? 1,
        token?.programNumber ?? 1,
        name,
        "declared variable",
        "Declare the variable before using it."
      );

      return "unknown";
    }

    if (!symbol.initialized) {
      this.diagnostics.warning(
        "Semantic Analysis",
        `Variable '${name}' was used before it was initialized.`,
        token?.line ?? 1,
        token?.startColumn ?? 1,
        token?.endColumn ?? 1,
        token?.programNumber ?? 1,
        name,
        "initialized variable",
        "Assign a value to the variable before using it."
      );
    }

    symbol.used = true;

    return symbol.type;
  }

  // IntExpr with +
  private analyzeAdd(node: ASTNode): VariableType {
    for (const child of node.children) {
      const childType = this.analyzeExpr(child);

      if (childType !== "unknown" && childType !== "int") {
        this.diagnostics.error(
          "Semantic Analysis",
          "Integer addition can only use int expressions.",
          child.token?.line ?? 1,
          child.token?.startColumn ?? 1,
          child.token?.endColumn ?? 1,
          child.token?.programNumber ?? 1,
          childType,
          "int",
          "Use only integer values on both sides of '+'."
        );
      }
    }

    return "int";
  }

  // BooleanExpr comparison
  private analyzeCompare(node: ASTNode): VariableType {
    const expressionChildren = node.children.filter(child => child.kind !== "BoolOp");

    const leftType = this.analyzeExpr(expressionChildren[0]);
    const rightType = this.analyzeExpr(expressionChildren[1]);

    if (
      leftType !== "unknown" &&
      rightType !== "unknown" &&
      leftType !== rightType
    ) {
      this.diagnostics.error(
        "Semantic Analysis",
        "Boolean comparison has mismatched expression types.",
        node.token?.line ?? 1,
        node.token?.startColumn ?? 1,
        node.token?.endColumn ?? 1,
        node.token?.programNumber ?? 1,
        `${leftType} compared with ${rightType}`,
        "matching expression types",
        "Compare values of the same type."
      );
    }

    return "boolean";
  }

  // final semantic warnings
  private checkWarnings(): void {
    for (const symbol of this.symbolTable.getSymbols()) {
      if (!symbol.initialized) {
        this.diagnostics.warning(
          "Semantic Analysis",
          `Variable '${symbol.name}' was declared but never initialized.`,
          symbol.line,
          symbol.startColumn,
          symbol.endColumn,
          symbol.programNumber,
          symbol.name,
          "initialized variable",
          "Assign a value to this variable before the program ends."
        );
      }

      if (!symbol.used && symbol.initialized) {
        this.diagnostics.warning(
          "Semantic Analysis",
          `Variable '${symbol.name}' was initialized but never used.`,
          symbol.line,
          symbol.startColumn,
          symbol.endColumn,
          symbol.programNumber,
          symbol.name,
          "used variable",
          "Use the variable after assigning it, or remove it."
        );
      }

      if (!symbol.used && !symbol.initialized) {
        this.diagnostics.warning(
          "Semantic Analysis",
          `Variable '${symbol.name}' was declared but never used.`,
          symbol.line,
          symbol.startColumn,
          symbol.endColumn,
          symbol.programNumber,
          symbol.name,
          "used variable",
          "Use the variable somewhere in the program, or remove it."
        );
      }
    }
  }

  private toVariableType(value: string | undefined): VariableType {
    if (value === "int" || value === "string" || value === "boolean") {
      return value;
    }

    return "unknown";
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`SEMANTIC ANALYSIS: ${message}`);
    }
  }
}