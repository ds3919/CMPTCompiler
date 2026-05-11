Intended (condensed) output for compilation of invalidSemantic.cmpt:
'''
COMPILER: Starting compilation

COMPILER: Running Lexer


COMPILER: Lexer finished
COMPILER: Tokens produced: 66
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
COMPILER: Errors: 6
COMPILER: Warnings: 3

[WARNING] Semantic Analysis - Program 1 - line 6, chars 9-9
Variable 'a' was used before it was initialized.
Found: a
Expected: initialized variable
Source:
6 |   print(a)
            ^
Suggestion: Assign a value to the variable before using it.

[ERROR] Semantic Analysis - Program 1 - line 8, chars 3-3
Type mismatch in assignment to 'a'.
Found: string
Expected: int
Source:
8 |   a = "hello"
      ^
Suggestion: Assign a value of type int to 'a'.

[ERROR] Semantic Analysis - Program 1 - line 9, chars 3-3
Type mismatch in assignment to 's'.
Found: int
Expected: string
Source:
9 |   s = 5
      ^
Suggestion: Assign a value of type string to 's'.

[ERROR] Semantic Analysis - Program 1 - line 10, chars 3-3
Type mismatch in assignment to 'f'.
Found: int
Expected: boolean
Source:
10 |   f = 1
       ^
Suggestion: Assign a value of type boolean to 'f'.

[ERROR] Semantic Analysis - Program 1 - line 12, chars 9-9
Variable 'b' was used before it was declared.
Found: b
Expected: declared variable
Source:
12 |   print(b)
             ^
Suggestion: Declare the variable before using it.

[ERROR] Semantic Analysis - Program 2 - line 17, chars 7-7
Variable 'x' has already been declared in this scope.
Found: x
Expected: unique identifier in the current scope
Source:
17 |   int x
           ^
Suggestion: Use a different identifier name, or remove the duplicate declaration.

[ERROR] Semantic Analysis - Program 2 - line 24, chars 7-7
Boolean comparison has mismatched expression types.
Found: int compared with string
Expected: matching expression types
Source:
24 |   z = (x == y)
           ^
Suggestion: Compare values of the same type.

[WARNING] Semantic Analysis - Program 1 - line 3, chars 10-10
Variable 's' was initialized but never used.
Found: s
Expected: used variable
Source:
3 |   string s
             ^
Suggestion: Use the variable after assigning it, or remove it.

[WARNING] Semantic Analysis - Program 1 - line 4, chars 11-11
Variable 'f' was initialized but never used.
Found: f
Expected: used variable
Source:
4 |   boolean f
              ^
Suggestion: Use the variable after assigning it, or remove it.

COMPILER: Semantic Analysis failed, stopping before Code Generation.'''