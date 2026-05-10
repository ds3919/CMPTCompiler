import { ASTBuilder } from "../../source/ASTBuilder";
import { CodeGenerator, CodeGenerationError } from "../../source/CodeGenerator";
import { DiagnosticReporter } from "../../source/DiagnosticReporter";
import { Lexer } from "../../source/Lexer";
import { Parser } from "../../source/Parser";
import { SemanticAnalyzer } from "../../source/SemanticAnalyzer";
import { TerminalColors } from "../../source/TerminalColors";

export function compileSource(source: string, showDetails: boolean): string {
  const output: string[] = [];

  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    output.push(args.map(String).join(" "));
  };

  console.error = (...args: unknown[]) => {
    output.push(args.map(String).join(" "));
  };

  try {
    runCompiler(source, showDetails);
  } catch (error) {
    console.log("");
    console.log(TerminalColors.error("COMPILER: Unexpected compiler failure."));
    console.log("");

    if (error instanceof Error) {
      console.log(TerminalColors.error(error.message));
    } else {
      console.log(TerminalColors.error("Unknown compiler failure."));
    }
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return output.join("\n");
}

function runCompiler(source: string, showDetails: boolean): void {
  const sourceLines = source.split(/\r?\n/);
  const diagnostics = new DiagnosticReporter(sourceLines);

  console.log(TerminalColors.phase("COMPILER: Starting compilation"));
  console.log("");

  console.log(TerminalColors.phase("COMPILER: Running Lexer"));
  console.log("");

  const lexer = new Lexer(source, diagnostics, showDetails);
  const tokens = lexer.lex();

  console.log("");
  console.log(TerminalColors.phase("COMPILER: Lexer finished"));
  console.log(`COMPILER: Tokens produced: ${tokens.length}`);
  console.log(`COMPILER: Errors: ${diagnostics.getErrorCount()}`);
  console.log(`COMPILER: Warnings: ${diagnostics.getWarningCount()}`);

  diagnostics.printAll();

  if (diagnostics.hasErrors()) {
    console.log("");
    console.log(TerminalColors.error("COMPILER: Lex failed, stopping before Parser."));
    return;
  }

  console.log("");
  console.log(TerminalColors.success("COMPILER: Lex passed."));

  if (showDetails) {
    console.log("");
    console.log(TerminalColors.phase("TOKEN STREAM:"));

    for (const token of tokens) {
      console.log(token.toString());
    }
  }

  console.log("");
  console.log(TerminalColors.phase("COMPILER: Running Parser"));
  console.log("");

  const parser = new Parser(tokens, diagnostics, showDetails);
  const cst = parser.parse();

  console.log("");
  console.log(TerminalColors.phase("COMPILER: Parser finished"));
  console.log(`COMPILER: Errors: ${diagnostics.getErrorCount()}`);
  console.log(`COMPILER: Warnings: ${diagnostics.getWarningCount()}`);

  diagnostics.printAll();

  if (diagnostics.hasErrors()) {
    console.log("");
    console.log(TerminalColors.error("COMPILER: Parse failed, stopping before AST Builder."));
    return;
  }

  console.log("");
  console.log(TerminalColors.success("COMPILER: Parse passed."));

  if (showDetails) {
    console.log("");
    console.log(TerminalColors.phase("CONCRETE SYNTAX TREE:"));
    console.log(cst.toString());
  }

  console.log("");
  console.log(TerminalColors.phase("COMPILER: Running AST Builder"));
  console.log("");

  const astBuilder = new ASTBuilder(tokens, showDetails);
  const ast = astBuilder.build();

  console.log("");
  console.log(TerminalColors.phase("COMPILER: AST Builder finished"));

  if (showDetails) {
    console.log("");
    console.log(TerminalColors.phase("ABSTRACT SYNTAX TREE:"));
    console.log(ast.toString());
  }

  console.log("");
  console.log(TerminalColors.phase("COMPILER: Running Semantic Analysis"));
  console.log("");

  const semanticAnalyzer = new SemanticAnalyzer(ast, diagnostics, showDetails);
  const symbolTable = semanticAnalyzer.analyze();

  console.log("");
  console.log(TerminalColors.phase("COMPILER: Semantic Analysis finished"));
  console.log(`COMPILER: Errors: ${diagnostics.getErrorCount()}`);
  console.log(`COMPILER: Warnings: ${diagnostics.getWarningCount()}`);

  diagnostics.printAll();

  if (showDetails) {
    console.log("");
    console.log(TerminalColors.phase("SYMBOL TABLE:"));
    console.log(symbolTable.toString());
  }

  if (diagnostics.hasErrors()) {
    console.log("");
    console.log(TerminalColors.error("COMPILER: Semantic Analysis failed, stopping before Code Generation."));
    return;
  }

  console.log("");
  console.log(TerminalColors.success("COMPILER: Semantic Analysis passed."));

  console.log("");
  console.log(TerminalColors.phase("COMPILER: Running Code Generation"));
  console.log("");

  try {
    const codeGenerator = new CodeGenerator(ast, showDetails);
    const generatedCode = codeGenerator.generate();

    console.log("");
    console.log(TerminalColors.phase("COMPILER: Code Generation finished"));
    console.log("");
    console.log(TerminalColors.phase("GENERATED CODE:"));

    for (const line of generatedCode) {
      console.log(line);
    }
  } catch (error) {
    console.log("");
    console.log(TerminalColors.error("COMPILER: Code Generation failed."));
    console.log("");

    if (error instanceof CodeGenerationError) {
      console.log(`${TerminalColors.error("[ERROR]")} ${TerminalColors.phase("Code Generation")} - ${error.programLabel}`);
      console.log(TerminalColors.bold(error.message));

      if (error.suggestion !== undefined) {
        console.log(`${TerminalColors.hint("Suggestion:")} ${error.suggestion}`);
      }

      return;
    }

    if (error instanceof Error) {
      console.log(`${TerminalColors.error("[ERROR]")} ${TerminalColors.phase("Code Generation")}`);
      console.log(TerminalColors.bold(error.message));
      return;
    }

    console.log(`${TerminalColors.error("[ERROR]")} ${TerminalColors.phase("Code Generation")}`);
    console.log(TerminalColors.bold("Unknown code generation failure."));
  }
}