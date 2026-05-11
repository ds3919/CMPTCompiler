Intended (condensed) output for compilation of invalidCodeGen.cmpt:
```COMPILER: Starting compilation

COMPILER: Running Lexer


COMPILER: Lexer finished
COMPILER: Tokens produced: 251
COMPILER: Errors: 0
COMPILER: Warnings: 0
No diagnostics.

COMPILER: Lex passed.

COMPILER: Running Parser


COMPILER: Parser finished
COMPILER: Errors: 0
COMPILER: Warnings: 0
No diagnostics.

COMPILER: Parse passed.

COMPILER: Running AST Builder


COMPILER: AST Builder finished

COMPILER: Running Semantic Analysis


COMPILER: Semantic Analysis finished
COMPILER: Errors: 0
COMPILER: Warnings: 0
No diagnostics.

COMPILER: Semantic Analysis passed.

COMPILER: Running Code Generation


COMPILER: Code Generation failed.

[ERROR] Code Generation - Program 1
Program is too large for 256 bytes. Generated code, static memory, and heap strings overlap.
Suggestion: Shorten string literals, reduce the number of statements, or split the source into smaller programs.```