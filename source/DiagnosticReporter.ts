import { TerminalColors } from "./TerminalColors";

export enum DiagnosticLevel {
  ERROR = "ERROR",
  WARNING = "WARNING",
  HINT = "HINT",
  SUGGESTION = "SUGGESTION",
  INFO = "INFO"
}

export type CompilerPhase =
  | "Lexer"
  | "Parser"
  | "Semantic Analysis"
  | "Code Generation";

export type Diagnostic = {
  level: DiagnosticLevel;
  phase: CompilerPhase;
  message: string;

  // source location
  line: number;
  startColumn: number;
  endColumn: number;

  programNumber: number;

  found?: string;
  expected?: string;
  suggestion?: string;
};

export class DiagnosticReporter {
  // stores all messages
  private diagnostics: Diagnostic[] = [];

  constructor(private sourceLines: string[]) {}

  // direct reporting
  public report(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  // shortcut for reporting errors
  public error(
    phase: CompilerPhase,
    message: string,
    line: number,
    startColumn: number,
    endColumn: number,
    programNumber: number,
    found?: string,
    expected?: string,
    suggestion?: string
  ): void {
    this.report({
      level: DiagnosticLevel.ERROR,
      phase,
      message,
      line,
      startColumn,
      endColumn,
      programNumber,
      found,
      expected,
      suggestion
    });
  }

  // shortcut for reporting warnings
  public warning(
    phase: CompilerPhase,
    message: string,
    line: number,
    startColumn: number,
    endColumn: number,
    programNumber: number,
    found?: string,
    expected?: string,
    suggestion?: string
  ): void {
    this.report({
      level: DiagnosticLevel.WARNING,
      phase,
      message,
      line,
      startColumn,
      endColumn,
      programNumber,
      found,
      expected,
      suggestion
    });
  }

  // tools

  // true if an error is found at any compilation stage
  public hasErrors(): boolean {
    return this.diagnostics.some(d => d.level === DiagnosticLevel.ERROR);
  }

  public getErrorCount(): number {
    return this.diagnostics.filter(d => d.level === DiagnosticLevel.ERROR).length;
  }

  public getWarningCount(): number {
    return this.diagnostics.filter(d => d.level === DiagnosticLevel.WARNING).length;
  }

  // print all diagnostics
  public printAll(): void {
    if (this.diagnostics.length === 0) {
      console.log(TerminalColors.success("No diagnostics."));
      return;
    }

    for (const diagnostic of this.diagnostics) {
      this.printDiagnostic(diagnostic);
    }
  }

  // print a specific diagnostic
  private printDiagnostic(diagnostic: Diagnostic): void {
    const levelLabel = this.colorLevel(`[${diagnostic.level}]`, diagnostic.level);

    console.log("");
    console.log(
      `${levelLabel} ${TerminalColors.phase(diagnostic.phase)} - Program ${diagnostic.programNumber} - line ${diagnostic.line}, chars ${diagnostic.startColumn}-${diagnostic.endColumn}`
    );

    console.log(TerminalColors.bold(diagnostic.message));

    // display found
    if (diagnostic.found !== undefined) {
      console.log(`${TerminalColors.found("Found:")} ${diagnostic.found}`);
    }

    // display expected
    if (diagnostic.expected !== undefined) {
      console.log(`${TerminalColors.expected("Expected:")} ${diagnostic.expected}`);
    }

    // show the source line with a pointer under the problem area
    const snippet = this.getSourceSnippet(
      diagnostic.line,
      diagnostic.startColumn,
      diagnostic.endColumn
    );

    if (snippet.length > 0) {
      console.log(TerminalColors.source("Source:"));
      console.log(TerminalColors.source(snippet));
    }

    // show optional fix suggestion
    if (diagnostic.suggestion !== undefined) {
      console.log(`${TerminalColors.hint("Suggestion:")} ${diagnostic.suggestion}`);
    }
  }

  private colorLevel(label: string, level: DiagnosticLevel): string {
    switch (level) {
      case DiagnosticLevel.ERROR:
        return TerminalColors.error(label);

      case DiagnosticLevel.WARNING:
        return TerminalColors.warning(label);

      case DiagnosticLevel.HINT:
      case DiagnosticLevel.SUGGESTION:
        return TerminalColors.hint(label);

      case DiagnosticLevel.INFO:
        return TerminalColors.phase(label);

      default:
        return label;
    }
  }

  // builds the source-code pointer shown under error messages
  private getSourceSnippet(
    line: number,
    startColumn: number,
    endColumn: number
  ): string {
    const sourceLine = this.sourceLines[line - 1];

    if (sourceLine === undefined) {
      return "";
    }

    const lineNumberText = String(line);

    // line number
    const lineNumPrefix = lineNumberText.length + 3;

    // move pointer to start of token
    const pointerStart = lineNumPrefix + Math.max(startColumn - 1, 0);

    // fetches the whole token, not just the first char
    const pointerLength = Math.max(endColumn - startColumn + 1, 1);

    return `${lineNumberText} | ${sourceLine}\n${" ".repeat(pointerStart)}${"^".repeat(pointerLength)}`;
  }
}