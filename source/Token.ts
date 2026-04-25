export enum TokenType {
  // block/structure related
  L_BRACE = "L_BRACE",
  R_BRACE = "R_BRACE",
  L_PAREN = "L_PAREN",
  R_PAREN = "R_PAREN",

  // operators
  ASSIGN = "ASSIGN",
  EQUALITY = "EQUALITY",
  INEQUALITY = "INEQUALITY",
  PLUS = "PLUS",
  
  // string stuff
  QUOTE = "QUOTE",
  CHAR = "CHAR",
  SPACE = "SPACE",

  // keywords
  PRINT = "PRINT",
  WHILE = "WHILE",
  IF = "IF",

  // types
  TYPE_INT = "TYPE_INT",
  TYPE_STRING = "TYPE_STRING",
  TYPE_BOOLEAN = "TYPE_BOOLEAN",

  // bool literals
  BOOL_TRUE = "BOOL_TRUE",
  BOOL_FALSE = "BOOL_FALSE",

  // misc.
  ID = "ID",
  DIGIT = "DIGIT",
  EOP = "EOP"
}

export class Token {
  constructor(
    public type: TokenType,
    public value: string,
    public line: number,
    public startColumn: number,
    public endColumn: number,
    public programNumber: number
  ) {}

  public toString(): string {
    return `${this.type} [${this.value}] at line ${this.line}, chars ${this.startColumn}-${this.endColumn}`;
  }
}