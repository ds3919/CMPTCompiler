import * as fs from "fs";
import { DiagnosticReporter } from "./DiagnosticReporter";
import { Lexer } from "./Lexer";
import { Parser } from "./Parser";

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
    console.log("COMPILER: Parse failed, stopping before Semantic Analysis.");
    process.exit(1);
  }

  console.log("\nCOMPILER: Parse passed.\n");
  console.log("CONCRETE SYNTAX TREE:");
  console.log(cst.toString());

  console.log("COMPILER: Ready for Semantic Analysis.");
}

main();