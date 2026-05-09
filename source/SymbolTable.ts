export type VariableType = "int" | "string" | "boolean" | "unknown";

export type SymbolEntry = {
  name: string;
  type: VariableType;
  scope: number;
  line: number;
  startColumn: number;
  endColumn: number;
  programNumber: number;
  initialized: boolean;
  used: boolean;
};

type Scope = {
  id: number;
  parent: number | null;
  symbols: Map<string, SymbolEntry>;
};

export class SymbolTable {
  private scopes: Map<number, Scope> = new Map();
  private scopeStack: number[] = [];
  private nextScopeId = 0;
  private symbols: SymbolEntry[] = [];

  // enter a new scope
  public enterScope(): number {
    const parent = this.currentScopeId();
    const scopeId = this.nextScopeId++;

    this.scopes.set(scopeId, {
      id: scopeId,
      parent,
      symbols: new Map()
    });

    this.scopeStack.push(scopeId);

    return scopeId;
  }

  // leave the current scope
  public leaveScope(): void {
    this.scopeStack.pop();
  }

  public currentScopeId(): number | null {
    if (this.scopeStack.length === 0) {
      return null;
    }

    return this.scopeStack[this.scopeStack.length - 1];
  }

  public declare(symbol: SymbolEntry): boolean {
    const currentScope = this.getCurrentScope();

    if (currentScope === undefined) {
      return false;
    }

    if (currentScope.symbols.has(symbol.name)) {
      return false;
    }

    currentScope.symbols.set(symbol.name, symbol);
    this.symbols.push(symbol);

    return true;
  }

  public lookup(name: string): SymbolEntry | undefined {
    let scopeId = this.currentScopeId();

    while (scopeId !== null) {
      const scope = this.scopes.get(scopeId);
      const symbol = scope?.symbols.get(name);

      if (symbol !== undefined) {
        return symbol;
      }

      scopeId = scope?.parent ?? null;
    }

    return undefined;
  }

  public lookupCurrentScope(name: string): SymbolEntry | undefined {
    const currentScope = this.getCurrentScope();

    return currentScope?.symbols.get(name);
  }

  public getSymbols(): SymbolEntry[] {
    return this.symbols;
  }

  public toString(): string {
    if (this.symbols.length === 0) {
      return "No symbols.";
    }

    const rows = [
      "Name | Type | Scope | Line | Initialized | Used",
      "-----------------------------------------------"
    ];

    for (const symbol of this.symbols) {
      rows.push(
        `${symbol.name} | ${symbol.type} | ${symbol.scope} | ${symbol.line} | ${symbol.initialized} | ${symbol.used}`
      );
    }

    return rows.join("\n");
  }

  private getCurrentScope(): Scope | undefined {
    const currentScopeId = this.currentScopeId();

    if (currentScopeId === null) {
      return undefined;
    }

    return this.scopes.get(currentScopeId);
  }
}