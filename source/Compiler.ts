import * as fs from "fs";
import { ASTBuilder } from "./ASTBuilder";
import { CodeGenerator, CodeGenerationError } from "./CodeGenerator";
import { DiagnosticReporter } from "./DiagnosticReporter";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";
import { SemanticAnalyzer } from "./SemanticAnalyzer";

function main(): void {
  // file handling
  const inputFile = process.argv[2];

  if (!inputFile) {
    console.error("Usage: node dist/Compiler.js <input-file>");
    process.exit(1);
  }

  if (!inputFile.endsWith(".cmpt")) {
    console.error("Invalid file type, expected .cmpt source file.");
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const source = fs.readFileSync(inputFile, "utf8");

  // saving a copy of the source for error messaging
  const sourceLines = source.split(/\r?\n/);

  console.log("COMPILER: Starting compilation\n");

  // general reporter for all compilation stages
  const diagnostics = new DiagnosticReporter(sourceLines);

  // lexer stage
  console.log("COMPILER: Running Lexer\n");

  const lexer = new Lexer(source, diagnostics, true);
  const tokens = lexer.lex();

  console.log("");
  console.log("COMPILER: Lexer finished");
  console.log(`COMPILER: Tokens produced: ${tokens.length}`);
  console.log(`COMPILER: Errors: ${diagnostics.getErrorCount()}`);
  console.log(`COMPILER: Warnings: ${diagnostics.getWarningCount()}`);

  diagnostics.printAll();

  // compiler stages stop on errors
  if (diagnostics.hasErrors()) {
    console.log("\nCOMPILER: Lex failed, stopping before Parser.");
    process.exit(1);
  }

  console.log("\nCOMPILER: Lex passed.");
  console.log("\nTOKEN STREAM:");

  // display final token stream for debugging
  for (const token of tokens) {
    console.log(token.toString());
  }

  // parser phase
  console.log("\nCOMPILER: Running Parser\n");

  const parser = new Parser(tokens, diagnostics, true);
  const cst = parser.parse();

  console.log("\nCOMPILER: Parser finished");
  console.log(`COMPILER: Errors: ${diagnostics.getErrorCount()}`);
  console.log(`COMPILER: Warnings: ${diagnostics.getWarningCount()}`);

  diagnostics.printAll();

  if (diagnostics.hasErrors()) {
    console.log("");
    console.log("COMPILER: Parse failed, stopping before AST Builder.");
    process.exit(1);
  }

  console.log("\nCOMPILER: Parse passed.\n");
  console.log("CONCRETE SYNTAX TREE:");
  console.log(cst.toString());

  // AST builder phase
  console.log("COMPILER: Running AST Builder\n");

  const astBuilder = new ASTBuilder(tokens, true);
  const ast = astBuilder.build();

  console.log("\nCOMPILER: AST Builder finished");
  console.log("\nABSTRACT SYNTAX TREE:");
  console.log(ast.toString());

  // semantic analysis phase
  console.log("COMPILER: Running Semantic Analysis\n");

  const semanticAnalyzer = new SemanticAnalyzer(ast, diagnostics, true);
  const symbolTable = semanticAnalyzer.analyze();

  console.log("\nCOMPILER: Semantic Analysis finished");
  console.log(`COMPILER: Errors: ${diagnostics.getErrorCount()}`);
  console.log(`COMPILER: Warnings: ${diagnostics.getWarningCount()}`);

  diagnostics.printAll();

  console.log("\nSYMBOL TABLE:");
  console.log(symbolTable.toString());

  if (diagnostics.hasErrors()) {
    console.log("");
    console.log("COMPILER: Semantic Analysis failed, stopping before Code Generation.");
    process.exit(1);
  }

  console.log("\nCOMPILER: Semantic Analysis passed.");

  // code generation phase
    console.log("COMPILER: Running Code Generation");
  console.log("");

  try {
    const codeGenerator = new CodeGenerator(ast, true);
    const generatedCode = codeGenerator.generate();

    console.log("");
    console.log("COMPILER: Code Generation finished");
    console.log("");

    console.log("GENERATED CODE:");
    for (const line of generatedCode) {
      console.log(line);
    }
  } catch (error) {
    console.log("");
    console.log("COMPILER: Code Generation failed.");
    console.log("");

    if (error instanceof CodeGenerationError) {
      console.log(`[ERROR] Code Generation - ${error.programLabel}`);
      console.log(error.message);

      if (error.suggestion !== undefined) {
        console.log(`Suggestion: ${error.suggestion}`);
      }

      return;
    }

    if (error instanceof Error) {
      console.log("[ERROR] Code Generation");
      console.log(error.message);
      return;
    }

    console.log("[ERROR] Code Generation");
    console.log("Unknown code generation failure.");
    return;
  }
}

main();