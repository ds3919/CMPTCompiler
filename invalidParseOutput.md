Intended (condensed) output for compilation of invalidParse.cmpt:
'''COMPILER: Starting compilation

COMPILER: Running Lexer


COMPILER: Lexer finished
COMPILER: Tokens produced: 37
COMPILER: Errors: 0
COMPILER: Warnings: 0
No diagnostics.

COMPILER: Lex passed.

COMPILER: Running Parser


COMPILER: Parser finished
COMPILER: Errors: 5
COMPILER: Warnings: 0

[ERROR] Parser - Program 1 - line 5, chars 5-5
Assignment statement is missing an expression after '='.
Found: ASSIGN [=]
Expected: integer, string, boolean, or identifier
Source:
5 |   a =
        ^
Suggestion: Add a value after '=' before starting the next statement, for example a = 1.

[ERROR] Parser - Program 1 - line 8, chars 9-9
Expected an expression before ')'.
Found: R_PAREN [)]
Expected: integer, string, boolean, or identifier
Source:
8 |   print()
            ^
Suggestion: Add an expression inside print, for example print(a), print(1), or print("hello").

[ERROR] Parser - Program 1 - line 9, chars 11-11
Invalid integer expression.
Found: PLUS [+]
Expected: ')' after identifier expression
Source:
9 |   print(a + b)
              ^
Suggestion: This grammar only allows addition to start with a digit, for example print(1 + a) or print(1 + 2).

[ERROR] Parser - Program 1 - line 11, chars 8-9
Boolean comparison must be wrapped in parentheses.
Found: INEQUALITY [!=]
Expected: parenthesized boolean comparison
Source:
11 |   a = a!=b)
            ^^
Suggestion: Use (a != b) instead of a!=b.

[ERROR] Parser - Program 2 - line 15, chars 9-9
Variable declaration cannot include an assignment.
Found: ASSIGN [=]
Expected: end of declaration or next statement
Source:
15 |   int a =
             ^
Suggestion: Declare first, then assign separately. Use: int id -> id = expression.

COMPILER: Parse failed, stopping before AST Builder.'''