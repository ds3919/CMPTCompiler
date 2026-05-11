Intended (condensed) output for compilation of invalidLexer.cmpt:
'''COMPILER: Starting compilation

COMPILER: Running Lexer


COMPILER: Lexer finished
COMPILER: Tokens produced: 29
COMPILER: Errors: 1
COMPILER: Warnings: 1

[ERROR] Lexer - Program 1 - line 3, chars 8-8
Invalid character 'H' inside string literal.
Found: H
Expected: lowercase letter, space, or closing quote
Source:
3 |   s = "Hello"
           ^
Suggestion: Only lowercase letters and spaces are allowed inside strings for this grammar.

[WARNING] Lexer - Program 2 - line 11, chars 1-1
Program ended without an explicit end-of-program marker.
Found: end of file
Expected: $
Source:
11 | }
     ^
Suggestion: Add $ at the end of the program.

COMPILER: Lex failed, stopping before Parser.'''