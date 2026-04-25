import { DiagnosticReporter } from "./DiagnosticReporter";
import { Token, TokenType } from "./Token";
import { Tree } from "./Tree";

export class Parser {
  private currentIndex = 0;
  private cst = new Tree();

  constructor(
    private tokens: Token[],
    private diagnostics: DiagnosticReporter,
    private verbose = true
  ) {}

  // main parser method
  public parse(): Tree {
    this.log("Starting Parser");

    this.cst.addBranch("Root");

    while (!this.isAtEnd()) {
      this.parseProgram();
    }

    this.cst.endChildren();

    this.log("Parser finished");
    return this.cst;
  }

  // Program ::= Block $
  private parseProgram(): void {
    const programNumber = this.currentToken()?.programNumber ?? 1;

    this.log(`Parsing Program ${programNumber}`);
    this.cst.addBranch(`Program ${programNumber}`);

    this.parseBlock();
    this.match(TokenType.EOP, "Expected '$' at the end of the program.");

    this.cst.endChildren();
  }

  // Block ::= { StatementList }
  private parseBlock(): void {
    this.cst.addBranch("Block");

    this.match(TokenType.L_BRACE, "Expected '{' to start a block.");
    this.parseStatementList();
    this.match(TokenType.R_BRACE, "Expected '}' to close the block.");

    this.cst.endChildren();
  }

  // StatementList ::= Statement StatementList | ε
  private parseStatementList(): void {
    this.cst.addBranch("StatementList");

    while (!this.isAtEnd() && !this.isStatementListBoundary(this.currentToken()?.type)) {
      if (this.isStatementStartAtCurrent()) {
        this.parseStatement();
        continue;
      }

      const token = this.currentToken();

      if (token !== undefined) {
        this.reportTokenError(
          token,
          "Unexpected token inside block.",
          "print, assignment, variable declaration, while, if, block, or closing brace",
          `${token.type} [${token.value}]`,
          "This token does not start a valid statement."
        );

        this.advance();
      }
    }

    this.cst.addLeaf("ε");
    this.cst.endChildren();
  }

  // Statement ::= PrintStatement | AssignmentStatement | VarDecl | WhileStatement | IfStatement | Block
  private parseStatement(): void {
    this.cst.addBranch("Statement");

    const token = this.currentToken();

    if (token === undefined) {
      this.reportCurrentError(
        "Unexpected end of input while parsing statement.",
        "statement",
        "end of input",
        "Conclude the statement with a valid token before the program ends."
      );

      this.cst.endChildren();
      return;
    }

    switch (token.type) {
      case TokenType.PRINT:
        this.parsePrintStatement();
        break;

      case TokenType.ID:
        this.parseAssignmentStatement();
        break;

      case TokenType.TYPE_INT:
      case TokenType.TYPE_STRING:
      case TokenType.TYPE_BOOLEAN:
        this.parseVarDecl();
        break;

      case TokenType.WHILE:
        this.parseWhileStatement();
        break;

      case TokenType.IF:
        this.parseIfStatement();
        break;

      case TokenType.L_BRACE:
        this.parseBlock();
        break;

      default:
        this.reportTokenError(
          token,
          "Invalid statement.",
          "print, identifier, type, while, if, or block",
          `${token.type} [${token.value}]`,
          "Start the statement with a valid grammar token."
        );

        this.advance();
        break;
    }

    this.cst.endChildren();
  }

  // PrintStatement ::= print ( Expr )
  private parsePrintStatement(): void {
    this.cst.addBranch("PrintStatement");

    this.match(TokenType.PRINT, "Expected 'print'.");

    const firstToken = this.currentToken();

    // catches print with a misplaced standalone expression before the parentheses (i.e. if token stream = PRINT, ID, L_PAREN, R_PAREN, it will see that the ID might belong inside the print parens and suggest print(id), ultimately preventing cascading errors)
    if (
      firstToken !== undefined &&
      this.isExpressionStart(firstToken.type) &&
      this.peekToken(1)?.type === TokenType.L_PAREN &&
      this.peekToken(2)?.type === TokenType.R_PAREN
    ) {
      this.reportTokenError(
        firstToken,
        "Expected '(' after print.",
        "L_PAREN [(]",
        `${firstToken.type} [${firstToken.value}]`,
        `If you meant to print '${firstToken.value}', write print(${firstToken.value}).`
      );

      this.consumeMisplacedExpression();
      this.match(TokenType.L_PAREN, "Expected '(' after print.");
      this.match(TokenType.R_PAREN, "Expected ')' after print expression.");

      this.cst.endChildren();
      return;
    }

    this.match(TokenType.L_PAREN, "Expected '(' after print.");

    const token = this.currentToken();

    // catches empty print() with a standalone expression following (i.e. if token stream = PRINT, L_PAREN, R_PAREN, ID, it will see that the ID might be misplaced and suggest it to be place in between the parens, ultimately preventing cascading errors)
    if (
      token?.type === TokenType.R_PAREN &&
      this.isExpressionStart(this.peekToken(1)?.type) &&
      !this.startsValidStatementAt(1)
    ) {
      const misplaced = this.peekToken(1);

      this.reportTokenError(
        token,
        "Expected an expression before ')'.",
        "integer, string, boolean, or identifier before ')'",
        `${token.type} [${token.value}] followed by ${misplaced?.type} [${misplaced?.value}]`,
        `The ')' appears too early. If you meant to print '${misplaced?.value}', write print(${misplaced?.value}).`
      );

      this.match(TokenType.R_PAREN, "Expected ')' after print expression.");
      this.consumeMisplacedExpression();

      this.cst.endChildren();
      return;
    }

    // catches empty print(), and print() followed by a valdid statement (i.e. if the token stream = PRINT, L_PAREN, R_PAREN, ID, ASSIGN, DIGIT, it will throw an error at print without consuming the follwing ID as opposed to determining it to be a misplaced expression)
    if (token?.type === TokenType.R_PAREN) {
      this.reportTokenError(
        token,
        "Expected an expression before ')'.",
        "integer, string, boolean, or identifier",
        `${token.type} [${token.value}]`,
        "The grammar requires print to contain an expression before ')', for example print(a), print(1), or print(\"hello\")."
      );

      this.match(TokenType.R_PAREN, "Expected ')' after print expression.");

      this.cst.endChildren();
      return;
    }

    this.parseExpr();
    this.match(TokenType.R_PAREN, "Expected ')' after print expression.");

    this.cst.endChildren();
  }

  // AssignmentStatement ::= Id = Expr
  private parseAssignmentStatement(): void {
    this.cst.addBranch("AssignmentStatement");

    this.parseId();

    const assignToken = this.currentToken();

    // an Id statement must be followed by =
    if (assignToken?.type !== TokenType.ASSIGN) {
      this.reportCurrentError(
        "Incomplete assignment statement.",
        "ASSIGN [=]",
        assignToken === undefined ? "end of input" : `${assignToken.type} [${assignToken.value}]`,
        "An identifier used at the start of a statement must be trailed by a '=': id = expression."
      );

      if (
        assignToken !== undefined &&
        !this.isBoundaryToken(assignToken.type) &&
        !this.isStatementStartAtCurrent()
      ) {
        this.advance();
      }

      this.cst.endChildren();
      return;
    }

    this.match(TokenType.ASSIGN, "Expected '=' in assignment statement.");

    const exprToken = this.currentToken();

    // assignment needs an expression after =
    if (
      exprToken === undefined ||
      this.isBoundaryToken(exprToken.type) ||
      this.isStatementStartAtCurrent()
    ) {
      this.reportCurrentError(
        "Assignment statement is missing an expression.",
        "integer, string, boolean, or identifier",
        exprToken === undefined ? "end of input" : `${exprToken.type} [${exprToken.value}]`,
        "Add a value after '=', id = expression"
      );

      this.cst.endChildren();
      return;
    }

    this.parseExpr();

    // catches assignments like a = a==b
    if (this.isBooleanOperator(this.currentToken()?.type)) {
      this.reportUnwrappedBooleanComparison();
    }

    this.cst.endChildren();
  }

  // VarDecl ::= type Id
  private parseVarDecl(): void {
    this.cst.addBranch("VarDecl");

    this.parseType();

    const idToken = this.currentToken();

    // declaration needs an identifier after the type
    if (idToken?.type !== TokenType.ID) {
      this.reportCurrentError(
        "Variable declaration is missing an identifier.",
        "identifier",
        idToken === undefined ? "end of input" : `${idToken.type} [${idToken.value}]`,
        "A variable type in a declaration must be followed by an identifier: int a."
      );

      if (
        idToken !== undefined &&
        !this.isBoundaryToken(idToken.type) &&
        !this.isStatementStartAtCurrent()
      ) {
        this.advance();
      }

      this.cst.endChildren();
      return;
    }

    this.parseId();

    const nextToken = this.currentToken();

    // catches invalid declarations like int a =
    if (nextToken?.type === TokenType.ASSIGN) {
      this.reportTokenError(
        nextToken,
        "Variable declaration cannot include an assignment.",
        "end of declaration or next statement",
        `${nextToken.type} [${nextToken.value}]`,
        "Declare first, then assign separately. Use: int id -> id = expression."
      );

      this.advance();
      this.synchronizeToNextStatementOrBoundary();
    }

    this.cst.endChildren();
  }

  // WhileStatement ::= while BooleanExpr Block
  private parseWhileStatement(): void {
    this.cst.addBranch("WhileStatement");

    this.match(TokenType.WHILE, "Expected 'while'.");

    const boolToken = this.currentToken();

    if (
      boolToken === undefined ||
      this.isBoundaryToken(boolToken.type) ||
      this.startsValidStatementAt(0)
    ) {
      this.reportCurrentError(
        "While statement is missing a boolean expression.",
        "true, false, or parenthesized boolean comparison",
        boolToken === undefined ? "end of input" : `${boolToken.type} [${boolToken.value}]`,
        "A while statement must be given a boolean expression as a conditional (true, false, comparison): while (boolean expression) {}."
      );

      this.cst.endChildren();
      return;
    }

    this.parseBooleanExpr();

    const blockToken = this.currentToken();

    if (blockToken?.type !== TokenType.L_BRACE) {
      this.reportCurrentError(
        "While statement is missing a block.",
        "L_BRACE [{]",
        blockToken === undefined ? "end of input" : `${blockToken.type} [${blockToken.value}]`,
        "A while statement must be followed by a block: while true { print(1) }."
      );

      if (
        blockToken !== undefined &&
        !this.isBoundaryToken(blockToken.type) &&
        !this.isStatementStartAtCurrent()
      ) {
        this.advance();
      }

      this.cst.endChildren();
      return;
    }

    this.parseBlock();

    this.cst.endChildren();
  }

  // IfStatement ::= if BooleanExpr Block
  private parseIfStatement(): void {
    this.cst.addBranch("IfStatement");

    this.match(TokenType.IF, "Expected 'if'.");

    const boolToken = this.currentToken();

    if (
      boolToken === undefined ||
      this.isBoundaryToken(boolToken.type) ||
      this.startsValidStatementAt(0)
    ) {
      this.reportCurrentError(
        "If statement is missing a boolean expression.",
        "true, false, or parenthesized boolean comparison",
        boolToken === undefined ? "end of input" : `${boolToken.type} [${boolToken.value}]`,
        "An if statement must be given a boolean expression (true, false, comparison) as a conditional: if (boolean expression) {}."
      );

      this.cst.endChildren();
      return;
    }

    this.parseBooleanExpr();

    const blockToken = this.currentToken();

    if (blockToken?.type !== TokenType.L_BRACE) {
      this.reportCurrentError(
        "If statement is missing a block.",
        "L_BRACE [{]",
        blockToken === undefined ? "end of input" : `${blockToken.type} [${blockToken.value}]`,
        "An if statement must be followed by a block: if (condition) {block}."
      );

      if (
        blockToken !== undefined &&
        !this.isBoundaryToken(blockToken.type) &&
        !this.isStatementStartAtCurrent()
      ) {
        this.advance();
      }

      this.cst.endChildren();
      return;
    }

    this.parseBlock();

    this.cst.endChildren();
  }

  // Expr ::= IntExpr | StringExpr | BooleanExpr | Id
  private parseExpr(): void {
    this.cst.addBranch("Expr");

    const token = this.currentToken();

    if (token === undefined) {
      this.reportCurrentError(
        "Unexpected end of input while parsing expression.",
        "expression",
        "end of input",
        "Add an expression before continuing."
      );

      this.cst.endChildren();
      return;
    }

    switch (token.type) {
      case TokenType.DIGIT:
        this.parseIntExpr();
        break;

      case TokenType.QUOTE:
        this.parseStringExpr();
        break;

      case TokenType.BOOL_TRUE:
      case TokenType.BOOL_FALSE:
      case TokenType.L_PAREN:
        this.parseBooleanExpr();
        break;

      case TokenType.ID:
        this.parseId();
        break;

      default:
        this.reportTokenError(
          token,
          "Invalid expression.",
          "integer, string, boolean, or identifier",
          `${token.type} [${token.value}]`,
          "Use a valid expression: int, str, bool, identifier."
        );

        if (!this.isBoundaryToken(token.type) && !this.isStatementStartAtCurrent()) {
          this.advance();
        }

        break;
    }

    this.cst.endChildren();
  }

  // IntExpr ::= digit intop Expr | digit
  private parseIntExpr(): void {
    this.cst.addBranch("IntExpr");

    this.match(TokenType.DIGIT, "Expected digit.");

    if (this.currentToken()?.type === TokenType.PLUS) {
      this.match(TokenType.PLUS, "Expected '+' .");
      this.parseExpr();
    }

    this.cst.endChildren();
  }

  // StringExpr ::= " CharList "
  private parseStringExpr(): void {
    this.cst.addBranch("StringExpr");

    this.match(TokenType.QUOTE, "Expected opening quote.");
    this.parseCharList();
    this.match(TokenType.QUOTE, "Expected closing quote.");

    this.cst.endChildren();
  }

  // BooleanExpr ::= ( Expr boolop Expr ) | boolval
  private parseBooleanExpr(): void {
    this.cst.addBranch("BooleanExpr");

    const token = this.currentToken();

    if (token?.type === TokenType.BOOL_TRUE || token?.type === TokenType.BOOL_FALSE) {
      this.parseBoolVal();
    } else if (token?.type === TokenType.L_PAREN) {
      this.match(TokenType.L_PAREN, "Expected '(' to start boolean expression.");
      this.parseExpr();

      const operatorToken = this.currentToken();

      // catches parenthesized expressions missing a boolean operator (i.e. if token stream = L_PAREN, QUOTE, CHAR..., QUOTE, R_PAREN, it recognizes that this is not a valid boolean comparison because boolop is missing and prevents cascading errors after the closing paren)
      if (operatorToken?.type === TokenType.R_PAREN) {
        this.reportTokenError(
          operatorToken,
          "Parenthesized boolean expression is missing a boolean operator.",
          "== or !=",
          `${operatorToken.type} [${operatorToken.value}]`,
          "A parenthesized boolean expression must look like (expression == expression) or (expression != expression)."
        );

        this.match(TokenType.R_PAREN, "Expected ')' to close boolean expression.");

        this.cst.endChildren();
        return;
      }

      this.parseBoolOp();

      const rightToken = this.currentToken();

      // catches boolean comparisons missing the right side (i.e. if token stream = L_PAREN, ID, EQUALITY, R_PAREN, it reports the missing expression before consuming the closing paren so it doesn't cascade)
      if (
        rightToken === undefined ||
        this.isBoundaryToken(rightToken.type) ||
        rightToken.type === TokenType.R_PAREN ||
        this.isStatementStartAtCurrent()
      ) {
        this.reportCurrentError(
          "Boolean comparison is missing a right-hand expression.",
          "integer, string, boolean, or identifier",
          rightToken === undefined ? "end of input" : `${rightToken.type} [${rightToken.value}]`,
          "Add an expression after the boolean operator."
        );

        if (this.currentToken()?.type === TokenType.R_PAREN) {
          this.match(TokenType.R_PAREN, "Expected ')' to close boolean expression.");
        }

        this.cst.endChildren();
        return;
      }

      this.parseExpr();
      this.match(TokenType.R_PAREN, "Expected ')' to close boolean expression.");
    } else {
      this.reportCurrentError(
        "Invalid boolean expression.",
        "true, false, or parenthesized boolean comparison",
        token?.value ?? "end of input",
        "Use true, false, or a comparison."
      );

      if (
        token !== undefined &&
        !this.isBoundaryToken(token.type) &&
        !this.isStatementStartAtCurrent()
      ) {
        this.advance();
      }
    }

    this.cst.endChildren();
  }

  // CharList ::= char CharList | space CharList | ε
  private parseCharList(): void {
    this.cst.addBranch("CharList");

    while (
      this.currentToken()?.type === TokenType.CHAR ||
      this.currentToken()?.type === TokenType.SPACE
    ) {
      const token = this.currentToken();

      if (token?.type === TokenType.CHAR) {
        this.match(TokenType.CHAR, "Expected character.");
      } else {
        this.match(TokenType.SPACE, "Expected space.");
      }
    }

    this.cst.addLeaf("ε");
    this.cst.endChildren();
  }

  // Id ::= char
  private parseId(): void {
    this.cst.addBranch("Id");

    this.match(TokenType.ID, "Expected identifier.");

    this.cst.endChildren();
  }

  // type ::= int | string | boolean
  private parseType(): void {
    this.cst.addBranch("Type");

    const token = this.currentToken();

    if (
      token?.type === TokenType.TYPE_INT ||
      token?.type === TokenType.TYPE_STRING ||
      token?.type === TokenType.TYPE_BOOLEAN
    ) {
      this.match(token.type, "Expected type.");
    } else {
      this.reportCurrentError(
        "Invalid type declaration.",
        "int, string, or boolean",
        token?.value ?? "end of input",
        "Use one of the valid types: int, string, or boolean."
      );

      if (
        token !== undefined &&
        !this.isBoundaryToken(token.type) &&
        !this.isStatementStartAtCurrent()
      ) {
        this.advance();
      }
    }

    this.cst.endChildren();
  }

  // boolop ::= == | !=
  private parseBoolOp(): void {
    this.cst.addBranch("BoolOp");

    const token = this.currentToken();

    if (token?.type === TokenType.EQUALITY || token?.type === TokenType.INEQUALITY) {
      this.match(token.type, "Expected boolean operator.");
    } else {
      this.reportCurrentError(
        "Invalid boolean operator.",
        "== or !=",
        token?.value ?? "end of input",
        "Use '==' for equality or '!=' for inequality."
      );

      if (
        token !== undefined &&
        !this.isBoundaryToken(token.type) &&
        !this.isStatementStartAtCurrent()
      ) {
        this.advance();
      }
    }

    this.cst.endChildren();
  }

  // boolval ::= false | true
  private parseBoolVal(): void {
    this.cst.addBranch("BoolVal");

    const token = this.currentToken();

    if (token?.type === TokenType.BOOL_TRUE || token?.type === TokenType.BOOL_FALSE) {
      this.match(token.type, "Expected boolean value.");
    } else {
      this.reportCurrentError(
        "Invalid boolean value.",
        "true or false",
        token?.value ?? "end of input",
        "Use either true or false."
      );

      if (
        token !== undefined &&
        !this.isBoundaryToken(token.type) &&
        !this.isStatementStartAtCurrent()
      ) {
        this.advance();
      }
    }

    this.cst.endChildren();
  }

  // token matching
  private match(expectedType: TokenType, message: string): void {
    const token = this.currentToken();

    if (token === undefined) {
      this.reportCurrentError(
        message,
        expectedType,
        "end of input",
        "The program ended before this grammar rule was complete."
      );

      return;
    }

    if (token.type === expectedType) {
      this.cst.addLeaf(`${token.type} [${token.value}]`);
      this.log(`Matched ${token.type} [${token.value}]`);
      this.advance();
      return;
    }

    this.reportTokenError(
      token,
      message,
      expectedType,
      `${token.type} [${token.value}]`,
      this.getSuggestion(expectedType)
    );

    if (!this.isBoundaryToken(token.type) && !this.isStatementStartAtCurrent()) {
      this.advance();
    }
  }

  // misplaced expression recovery
  private consumeMisplacedExpression(): void {
    const token = this.currentToken();

    if (token === undefined) {
      return;
    }

    switch (token.type) {
      case TokenType.ID:
      case TokenType.DIGIT:
      case TokenType.BOOL_TRUE:
      case TokenType.BOOL_FALSE:
        this.cst.addLeaf(`MISPLACED_EXPR ${token.type} [${token.value}]`);
        this.advance();
        return;

      case TokenType.QUOTE:
        this.cst.addLeaf(`MISPLACED_EXPR ${token.type} [${token.value}]`);
        this.advance();

        while (
          this.currentToken()?.type === TokenType.CHAR ||
          this.currentToken()?.type === TokenType.SPACE
        ) {
          const charToken = this.currentToken();

          if (charToken !== undefined) {
            this.cst.addLeaf(`MISPLACED_EXPR ${charToken.type} [${charToken.value}]`);
          }

          this.advance();
        }

        if (this.currentToken()?.type === TokenType.QUOTE) {
          const quoteToken = this.currentToken();

          if (quoteToken !== undefined) {
            this.cst.addLeaf(`MISPLACED_EXPR ${quoteToken.type} [${quoteToken.value}]`);
          }

          this.advance();
        }

        return;

      default:
        this.advance();
        return;
    }
  }

  // catches comparisons missing parentheses, like a = a==b
  private reportUnwrappedBooleanComparison(): void {
    const operatorToken = this.currentToken();
    const rightToken = this.peekToken(1);
    const leftToken = this.previousToken();

    if (operatorToken === undefined) {
      return;
    }

    const leftValue = leftToken?.value ?? "left";
    const operatorValue = operatorToken.value;
    const rightValue = rightToken?.value ?? "right";

    this.reportTokenError(
      operatorToken,
      "Boolean comparison must be wrapped in parentheses.",
      "parenthesized boolean comparison",
      `${operatorToken.type} [${operatorToken.value}]`,
      `Use (${leftValue} ${operatorValue} ${rightValue}) instead of ${leftValue}${operatorValue}${rightValue}.`
    );

    // consume == or !=
    this.advance();

    // consume the right side of the comparison
    if (this.isExpressionStart(this.currentToken()?.type)) {
      this.consumeMisplacedExpression();
    }

    // catches cases like a = a!=b)
    if (this.currentToken()?.type === TokenType.R_PAREN) {
      this.advance();
    }
  }

  // error recovery
  private synchronizeToNextStatementOrBoundary(): void {
    while (!this.isAtEnd()) {
      const token = this.currentToken();

      if (
        this.isStatementListBoundary(token?.type) ||
        this.isStatementStartAtCurrent()
      ) {
        return;
      }

      this.advance();
    }
  }

  // error helpers
  private reportTokenError(
    token: Token,
    message: string,
    expected: string,
    found: string,
    suggestion?: string
  ): void {
    this.diagnostics.error(
      "Parser",
      message,
      token.line,
      token.startColumn,
      token.endColumn,
      token.programNumber,
      found,
      expected,
      suggestion
    );
  }

  private reportCurrentError(
    message: string,
    expected: string,
    found: string,
    suggestion?: string
  ): void {
    const token = this.currentToken() ?? this.previousToken();

    this.diagnostics.error(
      "Parser",
      message,
      token?.line ?? 1,
      token?.startColumn ?? 1,
      token?.endColumn ?? 1,
      token?.programNumber ?? 1,
      found,
      expected,
      suggestion
    );
  }

  private getSuggestion(expectedType: TokenType): string {
    switch (expectedType) {
      case TokenType.L_PAREN:
        return "Add '(' before the expression.";

      case TokenType.R_PAREN:
        return "Check that the expression is complete and closed with ')'.";

      case TokenType.L_BRACE:
        return "Add '{' to start the block.";

      case TokenType.R_BRACE:
        return "Add '}' to close the block.";

      case TokenType.EOP:
        return "Add '$' at the end of the program.";

      case TokenType.ASSIGN:
        return "Use '=' for assignment. Use '==' only inside boolean comparisons.";

      default:
        return "Check this token against the grammar.";
    }
  }

  //tools
  private isStatementStartAtCurrent(): boolean {
    return this.startsValidStatementAt(0);
  }

  private startsValidStatementAt(offset: number): boolean {
    const token = this.peekToken(offset);

    if (token === undefined) {
      return false;
    }

    switch (token.type) {
      case TokenType.PRINT:
      case TokenType.WHILE:
      case TokenType.IF:
      case TokenType.L_BRACE:
        return true;

      case TokenType.TYPE_INT:
      case TokenType.TYPE_STRING:
      case TokenType.TYPE_BOOLEAN:
        return this.peekToken(offset + 1)?.type === TokenType.ID;

      case TokenType.ID:
        return this.peekToken(offset + 1)?.type === TokenType.ASSIGN;

      default:
        return false;
    }
  }

  private isExpressionStart(type: TokenType | undefined): boolean {
    return (
      type === TokenType.DIGIT ||
      type === TokenType.QUOTE ||
      type === TokenType.BOOL_TRUE ||
      type === TokenType.BOOL_FALSE ||
      type === TokenType.L_PAREN ||
      type === TokenType.ID
    );
  }

  private isBooleanOperator(type: TokenType | undefined): boolean {
    return type === TokenType.EQUALITY || type === TokenType.INEQUALITY;
  }

  private isStatementListBoundary(type: TokenType | undefined): boolean {
    return type === TokenType.R_BRACE || type === TokenType.EOP || type === undefined;
  }

  private isBoundaryToken(type: TokenType): boolean {
    return type === TokenType.R_BRACE || type === TokenType.EOP;
  }

  private currentToken(): Token | undefined {
    return this.tokens[this.currentIndex];
  }

  private previousToken(): Token | undefined {
    return this.tokens[this.currentIndex - 1];
  }

  private peekToken(offset: number): Token | undefined {
    return this.tokens[this.currentIndex + offset];
  }

  private advance(): void {
    this.currentIndex++;
  }

  private isAtEnd(): boolean {
    return this.currentIndex >= this.tokens.length;
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`PARSER: ${message}`);
    }
  }
}