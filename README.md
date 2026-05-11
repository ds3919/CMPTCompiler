# 6502Compiler

6502Compiler is a TypeScript-based compiler project built for the Compilers course at Marist University. It takes source programs written in the course grammar and runs them through the full compilation pipeline: lexical analysis, parsing, concrete syntax tree construction, abstract syntax tree construction, semantic analysis, symbol table generation, and 6502a-style machine code generation.

In addition to the command-line compiler, this project includes a lightweight web interface that allows users to write source programs in the browser, import `.cmpt` files, compile them, view formatted terminal output, and copy the generated machine code for each compiled program.

## Live Demo

A browser-based version of the compiler is available here:

[Live Web Compiler](https://ds3919.github.io/6502Compiler/)

The web interface allows users to type source code, import `.cmpt` files, run the compiler, view terminal-style output, toggle detailed compiler output, and copy the generated hex code for each compiled program.

## Running Locally

To run the compiler locally, first rebuild the TypeScript project using the included bash script:

```bash
./c.sh
```

The `c.sh` script clears the old `dist/` folder and rebuilds the compiler from the TypeScript source files. This ensures the compiled JavaScript output is fresh before running the compiler or test scripts.

After rebuilding, the compiler can be run manually by passing a `.cmpt` file to the compiled `Compiler.js` file:

```bash
node dist/Compiler.js path/to/file.cmpt
```

For example:

```bash
node dist/Compiler.js valid.cmpt
```

The repository also includes npm scripts for running the included test programs:

```bash
npm run valid
npm run lexTest
npm run parseTest
npm run semanticTest
npm run genTest
```

The `valid` script runs a valid source file that should pass every compiler phase and produce generated machine code.

The invalid test scripts are organized by compiler phase:

- `lexTest` runs lexer-focused invalid programs.
- `parseTest` runs parser-focused invalid programs.
- `semanticTest` runs semantic-analysis-focused invalid programs.
- `genTest` runs a code-generation-focused invalid program.

The compiler stops after a failed phase. A lexer error prevents parsing, a parser error prevents AST construction, and semantic errors prevent code generation.

## Web Interface

The project also includes a browser-based compiler interface built with Vite and React. The site provides a source-code editor, `.cmpt` file import support, a terminal-style output panel, a detailed output toggle, and a dropdown for copying the generated hex code for each compiled program.

The import feature loads a selected `.cmpt` file directly into the browser editor. After importing, the user can review or edit the source before pressing Compile.

To run the site locally, move into the `web/` directory and start the Vite development server:

```bash
cd web
npm run dev
```

Vite will print a local development URL, usually:

```text
http://localhost:5173/
```

Open that URL in the browser to use the local version of the compiler website.

## Supported Language Features

The compiler supports the core language features required by the course grammar, including:

- Multiple programs in one input file, separated by `$`
- Block-based program structure using `{` and `}`
- Variable declarations for `int`, `string`, and `boolean`
- Single-character identifiers
- Assignment statements
- Print statements
- Integer literals
- String literals containing lowercase letters and spaces
- Boolean literals, `true` and `false`
- Integer addition in the grammar-supported form, such as `1 + a` or `1 + 2`
- Boolean comparisons using `==` and `!=`
- `if` statements
- `while` statements
- Nested blocks and scoped variables

Identifiers are intentionally limited to one character because that is how the course grammar defines identifiers. Strings are also limited to lowercase letters and spaces.

## Compiler Pipeline

The compiler is implemented as a staged pipeline. Each phase produces a clearly defined artifact for the next stage and stops compilation when it detects errors that would make later phases unreliable.

### Lexical Analysis

The lexer scans the source program and produces a token stream with line and character metadata. It supports multiple programs in a single input file, tracks program numbers, and reports lexical failures such as invalid characters, unterminated strings, and missing end-of-program markers.

### Parsing

The parser is a recursive descent parser built directly around the course grammar. It validates the token stream, performs targeted error recovery where appropriate, and constructs a concrete syntax tree. Parsing must complete successfully before AST construction begins.

### AST Construction

The AST builder converts the validated token stream into a simplified abstract syntax tree. The AST removes unnecessary grammar noise from the CST and keeps the program structure needed for semantic analysis and code generation.

### Semantic Analysis

The semantic analyzer performs scope checking, type checking, duplicate declaration detection, undeclared variable detection, initialization checks, and usage checks. It enforces the language’s semantic rules before allowing code generation to run.

### Symbol Table

The symbol table records declared identifiers across nested scopes. Each entry tracks the variable name, type, scope, declaration line, initialization state, and usage state. This table is used during semantic analysis and displayed as part of the compiler output.

### Code Generation

The code generator emits 6502a-style machine code for semantically valid programs. It handles integer values, booleans, strings, assignments, print statements, comparisons, conditionals, loops, static memory, heap allocation, and backpatching. It also detects backend-level failures, including branch distance issues and programs that exceed the 256-byte memory model.

## Diagnostics and Error Handling

The compiler includes structured diagnostics across the lexer, parser, semantic analyzer, and code generator. Diagnostic messages include the compiler phase, program number, source location, found value, expected value, and a targeted suggestion when applicable.

Parser diagnostics are designed to reduce cascading errors by recovering at statement and expression boundaries where possible. This makes invalid programs easier to debug because the reported error usually points to the real issue instead of a later token affected by the original mistake.

Semantic diagnostics enforce source-level correctness, including type safety, declaration rules, scope rules, initialization checks, and variable usage checks. Code generation diagnostics are reserved for backend constraints, such as unsupported internal AST shapes, branch offset limits, and 256-byte memory overflow.

The command-line compiler and web interface both preserve colored diagnostic output through ANSI-style terminal formatting. This makes errors, warnings, source snippets, expected values, found values, and suggestions easier to distinguish in the output.

## Testing

The repository includes test programs that exercise the compiler across valid execution paths and phase-specific failure paths.

The main test scripts are:

```bash
npm run valid
npm run lexTest
npm run parseTest
npm run semanticTest
npm run genTest
```

The `valid` test contains multiple valid programs that pass through the full pipeline and produce generated 6502a-style machine code. This test demonstrates correct handling of declarations, assignments, integer addition, boolean comparisons, `if` statements, `while` statements, string printing, nested scopes, and multiple programs in one source file.

The invalid tests are organized by compiler phase:

- `lexTest` validates lexical diagnostics, such as invalid characters, invalid string contents, and missing end-of-program markers.
- `parseTest` validates grammar-level diagnostics, including malformed assignments, empty print statements, invalid expression forms, missing parentheses, and invalid declarations.
- `semanticTest` validates semantic diagnostics, including duplicate declarations, undeclared variables, type mismatches, use-before-initialization warnings, and invalid comparisons.
- `genTest` validates backend diagnostics, especially code generation failures caused by the 256-byte memory model.

The invalid tests are deliberately separated by compiler phase. This keeps lexer, parser, semantic analysis, and code generation failures in their own test spaces, making it easier to verify that each stage reports the correct category of error without mixing unrelated failures together.

Test inputs and condensed output files:

- [`valid.cmpt`](valid.cmpt) → [`validOutput.md`](validOutput.md)
- [`invalidLexer.cmpt`](invalidLexer.cmpt) → [`invalidLexerOutput.md`](invalidLexerOutput.md)
- [`invalidParse.cmpt`](invalidParse.cmpt) → [`invalidParseOutput.md`](invalidParseOutput.md)
- [`invalidSemantic.cmpt`](invalidSemantic.cmpt) → [`invalidSemanticOutput.md`](invalidSemanticOutput.md)
- [`invalidCodeGen.cmpt`](invalidCodeGen.cmpt) → [`invalidCodeGenOutput.md`](invalidCodeGenOutput.md)

Compilation stops at the appropriate phase when errors are found. This prevents later phases from running on invalid intermediate structures and keeps the output tied to the compiler stage responsible for the failure.

## Project Structure

The project is split between the compiler implementation and the browser interface.

```text
source/
  AST.ts
  ASTBuilder.ts
  CodeGenerator.ts
  Compiler.ts
  DiagnosticReporter.ts
  Lexer.ts
  Parser.ts
  SemanticAnalyzer.ts
  SymbolTable.ts
  TerminalColors.ts
  Token.ts
  Tree.ts

web/
  src/
    App.tsx
    App.css
    compilerRunner.ts
    main.tsx
```

The `source/` directory contains the compiler itself. The command-line entry point is `Compiler.ts`, while the individual compiler phases are implemented in separate files.

The `web/` directory contains the Vite/React interface. The browser version does not use the command-line `Compiler.ts` file directly. Instead, `compilerRunner.ts` imports the compiler phases and runs them in the browser, preserving the same compiler behavior and terminal-style output.

## Known Limitations

This compiler intentionally follows the constraints of the course grammar and target machine model.

- Identifiers are limited to a single character.
- String literals support lowercase letters and spaces.
- Integer expressions follow the grammar-supported structure, so addition starts with a digit, such as `1 + a` or `1 + 2`.
- Boolean conditions must be either a boolean literal or a parenthesized comparison, such as `true`, `false`, `(a == b)`, or `(a != b)`.
- Generated programs are constrained by the 256-byte memory model.
- Code generation targets a 6502a-style instruction set and runtime environment.
- Emulator behavior may vary for system calls, especially string output, depending on which 6502a emulator is used.

## Generated Code Output

When code generation succeeds, the compiler prints the generated 6502a-style machine code for each program in the input file. Each program is emitted separately, which makes it easier to copy, test, and inspect generated output.

The web interface includes file import support and a program selector next to the compile controls. After compilation, users can select `Program 1`, `Program 2`, etc., and copy only that program’s generated hex code.

The generated memory layout uses a standard split-memory strategy. Executable code and static variable storage grow upward from the beginning of memory, while string data is stored on the heap growing downward from the end of memory. This structure makes memory collision detection straightforward: if the code/static pointer and heap pointer meet or cross, the compiler knows the generated program no longer fits inside the 256-byte memory model.

Static variables and temporary values are first emitted with placeholder labels, such as `T0 XX`, and are backpatched after code generation assigns final memory addresses. This allows the compiler to generate instructions before knowing the exact final location of every variable. String literals are placed in heap memory with null terminators, and variables that store strings hold the heap address where the string begins.

This layout keeps code generation deterministic, makes backpatching manageable, and separates fixed-size static values from variable-length string data.

## AI Disclosure

AI assistance was used as a development aid throughout this project. The assistance was used to help understand project parameters, clarify requirements, and design a step-by-step workflow for building the compiler from start to finish.

AI was also used for boilerplate and setup work, including TypeScript structure, the `c.sh` rebuild script, Vite/React web interface setup, GitHub Pages deployment setup, and basic command-line tooling.

During development, AI was used as a planning and review tool to help organize each compiler component cleanly. This helped keep the lexer, parser, AST builder, semantic analyzer, code generator, diagnostics, and web interface separated into maintainable parts instead of combining unrelated logic into one large implementation.

AI assistance was also used for the website design, terminal-style interface, color formatting, and overall presentation of compiler output.

The compiler implementation was developed specifically for this project, with AI used as a support tool for explanation, organization, boilerplate, debugging, and interface design.
