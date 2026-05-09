import { Token } from "./Token";

export class ASTNode {
  public children: ASTNode[] = [];

  constructor(
    public kind: string,
    public value: string | null = null,
    public token: Token | null = null,
    public parent: ASTNode | null = null
  ) {}

  public label(): string {
    if (this.value === null) {
      return this.kind;
    }

    if (this.kind === "Program") {
      return `${this.kind} ${this.value}`;
    }

    return `${this.kind} [${this.value}]`;
  }
}

export class AST {
  private root: ASTNode | null = null;
  private current: ASTNode | null = null;

  // add a branch node and move on to it
  public addBranch(
    kind: string,
    value: string | null = null,
    token: Token | null = null
  ): void {
    const node = new ASTNode(kind, value, token);

    if (this.root === null) {
      this.root = node;
      this.current = node;
      return;
    }

    if (this.current === null) {
      throw new Error("Cannot add branch without a current node.");
    }

    node.parent = this.current;
    this.current.children.push(node);
    this.current = node;
  }

  // add a leaf node but stay at the current branch
  public addLeaf(
    kind: string,
    value: string | null = null,
    token: Token | null = null
  ): void {
    if (this.current === null) {
      throw new Error("Cannot add leaf without a current node.");
    }

    const node = new ASTNode(kind, value, token, this.current);
    this.current.children.push(node);
  }

  // move back to the parent node
  public endChildren(): void {
    if (this.current !== null && this.current.parent !== null) {
      this.current = this.current.parent;
    }
  }

  public getRoot(): ASTNode | null {
    return this.root;
  }

  public toString(): string {
    if (this.root === null) {
      return "";
    }

    return this.expand(this.root, 0);
  }

  //does a pre-order traversal and prints out each node
  private expand(node: ASTNode, depth: number): string {
    const indent = "-".repeat(depth);
    let result = `${indent}<${node.label()}>\n`;

    if (node.children.length === 0) {
      result = `${indent}[${node.label()}]\n`;
      return result;
    }

    for (const child of node.children) {
      result += this.expand(child, depth + 1);
    }

    return result;
  }
}