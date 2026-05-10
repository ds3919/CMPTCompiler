import * as fs from "fs";
import { ASTBuilder } from "./ASTBuilder";
import { CodeGenerator, CodeGenerationError } from "./CodeGenerator";
import { DiagnosticReporter } from "./DiagnosticReporter";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";
import { SemanticAnalyzer } from "./SemanticAnalyzer";
import { TerminalColors } from "./TerminalColors";

function main(): void {
  // file handling
  const inputFile = process.argv[2];

  if (!inputFile) {
    console.error(TerminalColors.error("Usage: node dist/Compiler.js <input-file>"));
    process.exit(1);
  }

  if (!inputFile.endsWith(".cmpt")) {
    console.error(TerminalColors.error("Invalid file type, expected .cmpt source file."));
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(TerminalColors.error(`Input file not found: ${inputFile}`));
    process.exit(1);
  }

  const source = fs.readFileSync(inputFile, "utf8");

  // saving a copy of the source for error messaging
  const sourceLines = source.split(/\r?\n/);

  console.log(TerminalColors.phase("COMPILER: Starting compilation"));
  console.log("");

  // general reporter for all compilation stages
  const diagnostics = new DiagnosticReporter(sourceLines);

  // lexer stage
  console.log(TerminalColors.phase("COMPILER: Running Lexer"));
  console.log("");

  const lexer = new Lexer(source, diagnostics, true);
  const tokens = lexer.lex();

  console.log("");
  console.log(TerminalColors.phase("COMPILER: Lexer finished"));
  console.log(`COMPILER: Tokens produced: ${tokens.length}`);
  console.log(`COMPILER: Errors: ${diagnostics.getErrorCount()}`);
  console.log(`COMPILER: Warnings: ${diagnostics.getWarningCount()}`);

  diagnostics.printAll();

  // compiler stages stop on errors
  if (diagnostics.hasErrors()) {
    console.log("");
    console.log(TerminalColors.error("COMPILER: Lex failed, stopping before Parser."));
    process.exit(1);
  }

  console.log("");
  console.log(TerminalColors.success("COMPILER: Lex passed."));
  console.log("");
  console.log(TerminalColors.phase("TOKEN STREAM:"));

  // display final token stream for debugging
  for (const token of tokens) {
    console.log(token.toString());
  }

  // parser phase
  console.log("");
  console.log(TerminalColors.phase("COMPILER: Running Parser"));
  console.log("");

  const parser = new Parser(tokens, diagnostics, true);
  const cst = parser.parse();

  console.log("");
  console.log(TerminalColors.phase("COMPILER: Parser finished"));
  console.log(`COMPILER: Errors: ${diagnostics.getErrorCount()}`);
  console.log(`COMPILER: Warnings: ${diagnostics.getWarningCount()}`);

  diagnostics.printAll();

  if (diagnostics.hasErrors()) {
    console.log("");
    console.log(TerminalColors.error("COMPILER: Parse failed, stopping before AST Builder."));
    process.exit(1);
  }

  console.log("");
  console.log(TerminalColors.success("COMPILER: Parse passed."));
  console.log("");
  console.log(TerminalColors.phase("CONCRETE SYNTAX TREE:"));
  console.log(cst.toString());

  // AST builder phase
  console.log(TerminalColors.phase("COMPILER: Running AST Builder"));
  console.log("");

  const astBuilder = new ASTBuilder(tokens, true);
  const ast = astBuilder.build();

  console.log("");
  console.log(TerminalColors.phase("COMPILER: AST Builder finished"));
  console.log("");
  console.log(TerminalColors.phase("ABSTRACT SYNTAX TREE:"));
  console.log(ast.toString());

  // semantic analysis phase
  console.log(TerminalColors.phase("COMPILER: Running Semantic Analysis"));
  console.log("");

  const semanticAnalyzer = new SemanticAnalyzer(ast, diagnostics, true);
  const symbolTable = semanticAnalyzer.analyze();

  console.log("");
  console.log(TerminalColors.phase("COMPILER: Semantic Analysis finished"));
  console.log(`COMPILER: Errors: ${diagnostics.getErrorCount()}`);
  console.log(`COMPILER: Warnings: ${diagnostics.getWarningCount()}`);

  diagnostics.printAll();

  console.log("");
  console.log(TerminalColors.phase("SYMBOL TABLE:"));
  console.log(symbolTable.toString());

  if (diagnostics.hasErrors()) {
    console.log("");
    console.log(TerminalColors.error("COMPILER: Semantic Analysis failed, stopping before Code Generation."));
    process.exit(1);
  }

  console.log("");
  console.log(TerminalColors.success("COMPILER: Semantic Analysis passed."));

  // code generation phase
  console.log(TerminalColors.phase("COMPILER: Running Code Generation"));
  console.log("");

  try {
    const codeGenerator = new CodeGenerator(ast, true);
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
    return;
  }
}

main();