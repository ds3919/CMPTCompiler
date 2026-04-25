import * as fs from "fs";
import { DiagnosticReporter } from "./DiagnosticReporter";
import { Lexer } from "./Lexer";

function main(): void {
  // file handling
  const inputFile = process.argv[2];
  
  if (!inputFile) {
    console.error("Usage: node dist/Compiler.js <input-file>");
    process.exit(1);
  }

  if (!inputFile.endsWith(".cmpt")) {
    console.error("Invalid file type, expected .cmpt source file.")
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const source = fs.readFileSync(inputFile, "utf8");

  const sourceLines = source.split(/\r?\n/); //saving a copy of the source for error messaging

  console.log("COMPILER: Starting compilation");
  console.log("COMPILER: Running Lexer");
  console.log("");
  
  // general reporter for all compilation stages
  const diagnostics = new DiagnosticReporter(sourceLines);

  // run lexer
  const lexer = new Lexer(source, diagnostics, true);
  const tokens = lexer.lex();

  console.log("");
  console.log("COMPILER: Lexer finished");
  console.log(`COMPILER: Tokens produced: ${tokens.length}`);
  console.log(`COMPILER: Errors: ${diagnostics.getErrorCount()}`);
  console.log(`COMPILER: Warnings: ${diagnostics.getWarningCount()}`);

  diagnostics.printAll();

  // compiler phases stop on errors
  if (diagnostics.hasErrors()) {
    console.log("");
    console.log("COMPILER: Lex failed, stopping before Parser.");
    process.exit(1);
  }

  console.log("");
  console.log("COMPILER: Lex passed, ready for Parser.");
  console.log("");
  console.log("TOKEN STREAM:");

  // display final token stream for debugging
  for (const token of tokens) {
    console.log(token.toString());
  }
}

main();