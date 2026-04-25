import { DiagnosticReporter } from "./DiagnosticReporter";
import { Token, TokenType } from "./Token";

export class Lexer {
  // token storage
  private tokens: Token[] = [];

  // source position
  private currentIndex = 0;
  private line = 1;
  private column = 1;
  private programNumber = 1;

  // lexer state
  private insideString = false;

  constructor(
    private source: string,
    private diagnostics: DiagnosticReporter,
    private verbose = true
  ) {}

  // main lexer method
  public lex(): Token[] {
    this.tokens = [];

    while (!this.isAtEnd()) {
      const char = this.peek();

      if (this.insideString) {
        this.lexInsideString();
        continue;
      }

      if (char === " " || char === "\t" || char === "\r") {
        this.advance();
        continue;
      }

      if (char === "\n") {
        this.advanceLine();
        continue;
      }

      if (char === "/" && this.peekNext() === "*") {
        this.skipComment();
        continue;
      }

      this.lexNormalToken();
    }

    this.checkForMissingFinalEOP();

    return this.tokens;
  }

  // normal token handling
  private lexNormalToken(): void {
    const char = this.peek();
    const startLine = this.line;
    const startColumn = this.column;

    switch (char) {
      case "{":
        this.addToken(TokenType.L_BRACE, char, startLine, startColumn);
        this.advance();
        break;

      case "}":
        this.addToken(TokenType.R_BRACE, char, startLine, startColumn);
        this.advance();
        break;

      case "(":
        this.addToken(TokenType.L_PAREN, char, startLine, startColumn);
        this.advance();
        break;

      case ")":
        this.addToken(TokenType.R_PAREN, char, startLine, startColumn);
        this.advance();
        break;

      case "+":
        this.addToken(TokenType.PLUS, char, startLine, startColumn);
        this.advance();
        break;

      case "$":
        this.addToken(TokenType.EOP, char, startLine, startColumn);
        this.advance();
        this.programNumber++;
        break;

      case "\"":
        this.addToken(TokenType.QUOTE, char, startLine, startColumn);
        this.insideString = true;
        this.advance();
        break;

      case "=":
        if (this.peekNext() === "=") {
          this.addToken(TokenType.EQUALITY, "==", startLine, startColumn);
          this.advance();
          this.advance();
        } else {
          this.addToken(TokenType.ASSIGN, char, startLine, startColumn);
          this.advance();
        }
        break;

      case "!":
        if (this.peekNext() === "=") {
          this.addToken(TokenType.INEQUALITY, "!=", startLine, startColumn);
          this.advance();
          this.advance();
        } else {
          this.diagnostics.error(
            "Lexer",
            "Unexpected character '!'.",
            startLine,
            startColumn,
            startColumn,
            this.programNumber,
            "!",
            "!=",
            "Use '!=' for not-equal comparisons."
          );
          this.advance();
        }
        break;

      default:
        if (this.isDigit(char)) {
          this.addToken(TokenType.DIGIT, char, startLine, startColumn);
          this.advance();
        } else if (this.isLowercaseLetter(char)) {
          this.lexWord();
        } else {
          this.diagnostics.error(
            "Lexer",
            `Unrecognized character '${char}'.`,
            startLine,
            startColumn,
            startColumn,
            this.programNumber,
            char,
            "valid token from the grammar",
            "Remove this character or replace it with a valid grammar token."
          );
          this.advance();
        }
        break;
    }
  }

  // string token handling
  private lexInsideString(): void {
    const char = this.peek();
    const startLine = this.line;
    const startColumn = this.column;

    if (char === "\"") {
      this.addToken(TokenType.QUOTE, char, startLine, startColumn);
      this.insideString = false;
      this.advance();
      return;
    }

    if (char === "\n") {
      this.diagnostics.error(
        "Lexer",
        "String literal was opened but never closed before the end of the line.",
        startLine,
        startColumn,
        startColumn,
        this.programNumber,
        "end of line",
        "closing double quote",
        "Add a closing quote before the line ends."
      );

      this.insideString = false;
      this.advanceLine();
      return;
    }

    if (char === " ") {
      this.addToken(TokenType.SPACE, char, startLine, startColumn);
      this.advance();
      return;
    }

    if (this.isLowercaseLetter(char)) {
      this.addToken(TokenType.CHAR, char, startLine, startColumn);
      this.advance();
      return;
    }

    this.diagnostics.error(
      "Lexer",
      `Invalid character '${char}' inside string literal.`,
      startLine,
      startColumn,
      startColumn,
      this.programNumber,
      char,
      "lowercase letter, space, or closing quote",
      "Only lowercase letters and spaces are allowed inside strings for this grammar."
    );

    this.advance();
  }

  // keyword and identifier handling
  private lexWord(): void {
    const startLine = this.line;
    const startColumn = this.column;

    const keywordMatch = this.matchKeywordAtCurrent();

    if (keywordMatch !== undefined) {
      this.addToken(keywordMatch.type, keywordMatch.value, startLine, startColumn);
      this.advanceBy(keywordMatch.value.length);
      return;
    }

    const char = this.peek();

    if (this.isLowercaseLetter(char)) {
      this.addToken(TokenType.ID, char, startLine, startColumn);
      this.advance();
      return;
    }

    this.diagnostics.error(
      "Lexer",
      `Unrecognized character '${char}'.`,
      startLine,
      startColumn,
      startColumn,
      this.programNumber,
      char,
      "valid token from the grammar",
      "Remove this character or replace it with a valid grammar token."
    );

    this.advance();
  }

  private matchKeywordAtCurrent(): { type: TokenType; value: string } | undefined {
    const keywords = [
      { value: "boolean", type: TokenType.TYPE_BOOLEAN },
      { value: "string", type: TokenType.TYPE_STRING },
      { value: "while", type: TokenType.WHILE },
      { value: "print", type: TokenType.PRINT },
      { value: "false", type: TokenType.BOOL_FALSE },
      { value: "true", type: TokenType.BOOL_TRUE },
      { value: "int", type: TokenType.TYPE_INT },
      { value: "if", type: TokenType.IF }
    ];

    for (const keyword of keywords) {
      if (this.sourceStartsWith(keyword.value)) {
        return keyword;
      }
    }

    return undefined;
  }

  private sourceStartsWith(value: string): boolean {
    return this.source.substring(
      this.currentIndex,
      this.currentIndex + value.length
    ) === value;
  }

  // comment handling
  private skipComment(): void {
    const startLine = this.line;
    const startColumn = this.column;

    this.advance();
    this.advance();

    while (!this.isAtEnd()) {
      if (this.peek() === "*" && this.peekNext() === "/") {
        this.advance();
        this.advance();
        return;
      }

      if (this.peek() === "\n") {
        this.advanceLine();
      } else {
        this.advance();
      }
    }

    this.diagnostics.error(
      "Lexer",
      "Comment block was opened but never closed.",
      startLine,
      startColumn,
      startColumn + 1,
      this.programNumber,
      "/*",
      "*/",
      "Add */ before the end of the program."
    );
  }

  // EOP handling
  private checkForMissingFinalEOP(): void {
    if (this.tokens.length === 0) {
      return;
    }

    const lastToken = this.tokens[this.tokens.length - 1];

    if (lastToken.type !== TokenType.EOP) {
      this.diagnostics.warning(
        "Lexer",
        "Program ended without an explicit end-of-program marker.",
        lastToken.line,
        lastToken.startColumn,
        lastToken.endColumn,
        lastToken.programNumber,
        "end of file",
        "$",
        "Add $ at the end of the program."
      );

      this.addToken(
        TokenType.EOP,
        "$",
        lastToken.line,
        lastToken.endColumn + 1
      );
    }
  }

  // token creation
  private addToken(
    type: TokenType,
    value: string,
    line: number,
    startColumn: number
  ): void {
    const endColumn = startColumn + value.length - 1;
    const token = new Token(
      type,
      value,
      line,
      startColumn,
      endColumn,
      this.programNumber
    );

    this.tokens.push(token);

    if (this.verbose) {
      console.log(`LEXER: ${token.toString()}`);
    }
  }

  // iteration tools
  private peek(): string {
    return this.source[this.currentIndex];
  }

  private peekNext(): string {
    return this.source[this.currentIndex + 1] ?? "\0";
  }

  private advance(): void {
    this.currentIndex++;
    this.column++;
  }

  private advanceBy(amount: number): void {
    for (let i = 0; i < amount; i++) {
      this.advance();
    }
  }

  private advanceLine(): void {
    this.currentIndex++;
    this.line++;
    this.column = 1;
  }

  // helper tools
  private isAtEnd(): boolean {
    return this.currentIndex >= this.source.length;
  }

  private isDigit(char: string): boolean {
    return char >= "0" && char <= "9";
  }

  private isLowercaseLetter(char: string): boolean {
    return char >= "a" && char <= "z";
  }
}