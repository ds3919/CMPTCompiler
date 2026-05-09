import { AST } from "./AST";
import { Token, TokenType } from "./Token";

export class ASTBuilder {
  private currentIndex = 0;
  private ast = new AST();

  constructor(
    private tokens: Token[],
    private verbose = true
  ) {}

  // main AST builder method
  public build(): AST {
    this.log("Starting AST Builder");

    this.ast.addBranch("Root");

    while (!this.isAtEnd()) {
      this.buildProgram();
    }

    this.ast.endChildren();

    this.log("AST Builder finished");
    return this.ast;
  }

  // Program ::= Block $
  private buildProgram(): void {
    const programNumber = this.currentToken()?.programNumber ?? 1;

    this.log(`Building AST for Program ${programNumber}`);
    this.ast.addBranch("Program", String(programNumber), this.currentToken() ?? null);

    this.buildBlock();

    if (this.currentToken()?.type === TokenType.EOP) {
      this.advance();
    }

    this.ast.endChildren();
  }

  // Block ::= { StatementList }
  private buildBlock(): void {
    this.ast.addBranch("Block", null, this.currentToken() ?? null);

    this.matchAndSkip(TokenType.L_BRACE);

    while (
      !this.isAtEnd() &&
      this.currentToken()?.type !== TokenType.R_BRACE &&
      this.currentToken()?.type !== TokenType.EOP
    ) {
      this.buildStatement();
    }

    this.matchAndSkip(TokenType.R_BRACE);

    this.ast.endChildren();
  }

  // Statement ::= PrintStatement | AssignmentStatement | VarDecl | WhileStatement | IfStatement | Block
  private buildStatement(): void {
    const token = this.currentToken();

    if (token === undefined) {
      return;
    }

    switch (token.type) {
      case TokenType.PRINT:
        this.buildPrintStatement();
        break;

      case TokenType.ID:
        this.buildAssignmentStatement();
        break;

      case TokenType.TYPE_INT:
      case TokenType.TYPE_STRING:
      case TokenType.TYPE_BOOLEAN:
        this.buildVarDecl();
        break;

      case TokenType.WHILE:
        this.buildWhileStatement();
        break;

      case TokenType.IF:
        this.buildIfStatement();
        break;

      case TokenType.L_BRACE:
        this.buildBlock();
        break;

      default:
        this.advance();
        break;
    }
  }

  // PrintStatement ::= print ( Expr )
  private buildPrintStatement(): void {
    this.ast.addBranch("Print", null, this.currentToken() ?? null);

    this.matchAndSkip(TokenType.PRINT);
    this.matchAndSkip(TokenType.L_PAREN);

    this.buildExpr();

    this.matchAndSkip(TokenType.R_PAREN);

    this.ast.endChildren();
  }

  // AssignmentStatement ::= Id = Expr
  private buildAssignmentStatement(): void {
    const idToken = this.currentToken();

    this.ast.addBranch(
      "Assign",
      idToken?.value ?? "unknown",
      idToken ?? null
    );

    this.matchAndSkip(TokenType.ID);
    this.matchAndSkip(TokenType.ASSIGN);

    this.buildExpr();

    this.ast.endChildren();
  }

  // VarDecl ::= type Id
  private buildVarDecl(): void {
    const typeToken = this.currentToken();

    this.advance();

    const idToken = this.currentToken();

    this.ast.addLeaf(
      "VarDecl",
      `${typeToken?.value ?? "unknown"} ${idToken?.value ?? "unknown"}`,
      idToken ?? typeToken ?? null
    );

    this.matchAndSkip(TokenType.ID);
  }

  // WhileStatement ::= while BooleanExpr Block
  private buildWhileStatement(): void {
    this.ast.addBranch("While", null, this.currentToken() ?? null);

    this.matchAndSkip(TokenType.WHILE);

    this.ast.addBranch("Condition");
    this.buildBooleanExpr();
    this.ast.endChildren();

    this.buildBlock();

    this.ast.endChildren();
  }

  // IfStatement ::= if BooleanExpr Block
  private buildIfStatement(): void {
    this.ast.addBranch("If", null, this.currentToken() ?? null);

    this.matchAndSkip(TokenType.IF);

    this.ast.addBranch("Condition");
    this.buildBooleanExpr();
    this.ast.endChildren();

    this.buildBlock();

    this.ast.endChildren();
  }

  // Expr ::= IntExpr | StringExpr | BooleanExpr | Id
  private buildExpr(): void {
    const token = this.currentToken();

    if (token === undefined) {
      return;
    }

    switch (token.type) {
      case TokenType.DIGIT:
        this.buildIntExpr();
        break;

      case TokenType.QUOTE:
        this.buildStringExpr();
        break;

      case TokenType.BOOL_TRUE:
      case TokenType.BOOL_FALSE:
      case TokenType.L_PAREN:
        this.buildBooleanExpr();
        break;

      case TokenType.ID:
        this.buildId();
        break;

      default:
        this.advance();
        break;
    }
  }

  // IntExpr ::= digit intop Expr | digit
  private buildIntExpr(): void {
    const digitToken = this.currentToken();

    this.matchAndSkip(TokenType.DIGIT);

    if (this.currentToken()?.type === TokenType.PLUS) {
      this.ast.addBranch("Add", null, digitToken ?? null);
      this.ast.addLeaf("Digit", digitToken?.value ?? "unknown", digitToken ?? null);

      this.matchAndSkip(TokenType.PLUS);
      this.buildExpr();

      this.ast.endChildren();
      return;
    }

    this.ast.addLeaf("Digit", digitToken?.value ?? "unknown", digitToken ?? null);
  }

  // StringExpr ::= " CharList "
  private buildStringExpr(): void {
    const startToken = this.currentToken();
    let stringValue = "";

    this.matchAndSkip(TokenType.QUOTE);

    while (
      this.currentToken()?.type === TokenType.CHAR ||
      this.currentToken()?.type === TokenType.SPACE
    ) {
      stringValue += this.currentToken()?.value ?? "";
      this.advance();
    }

    this.matchAndSkip(TokenType.QUOTE);

    this.ast.addLeaf("String", stringValue, startToken ?? null);
  }

  // BooleanExpr ::= ( Expr boolop Expr ) | boolval
  private buildBooleanExpr(): void {
    const token = this.currentToken();

    if (token?.type === TokenType.BOOL_TRUE || token?.type === TokenType.BOOL_FALSE) {
      this.ast.addLeaf("BoolVal", token.value, token);
      this.advance();
      return;
    }

    if (token?.type === TokenType.L_PAREN) {
      this.matchAndSkip(TokenType.L_PAREN);

      this.ast.addBranch("Compare", null, token);

      this.buildExpr();

      const operatorToken = this.currentToken();

      if (
        operatorToken?.type === TokenType.EQUALITY ||
        operatorToken?.type === TokenType.INEQUALITY
      ) {
        this.ast.addLeaf("BoolOp", operatorToken.value, operatorToken);
        this.advance();
      }

      this.buildExpr();
      this.matchAndSkip(TokenType.R_PAREN);

      this.ast.endChildren();
      return;
    }

    this.advance();
  }

  // Id ::= char
  private buildId(): void {
    const token = this.currentToken();

    this.ast.addLeaf("Id", token?.value ?? "unknown", token ?? null);
    this.matchAndSkip(TokenType.ID);
  }

  // token skipping
  private matchAndSkip(expectedType: TokenType): void {
    const token = this.currentToken();

    if (token?.type === expectedType) {
      this.advance();
    }
  }

  // tools
  private currentToken(): Token | undefined {
    return this.tokens[this.currentIndex];
  }

  private advance(): void {
    this.currentIndex++;
  }

  private isAtEnd(): boolean {
    return this.currentIndex >= this.tokens.length;
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`AST BUILDER: ${message}`);
    }
  }
}