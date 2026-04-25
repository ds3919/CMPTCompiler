export class TreeNode {
  public children: TreeNode[] = [];

  constructor(
    public name: string,
    public parent: TreeNode | null = null
  ) {}
}

export class Tree {
  private root: TreeNode | null = null;
  private current: TreeNode | null = null;

  // add a branch node and move on to it
  public addBranch(name: string): void {
    const node = new TreeNode(name);

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
  public addLeaf(name: string): void {
    if (this.current === null) {
      throw new Error("Cannot add leaf without a current node.");
    }

    const node = new TreeNode(name, this.current);
    this.current.children.push(node);
  }

  // move back to the parent node
  public endChildren(): void {
    if (this.current !== null && this.current.parent !== null) {
      this.current = this.current.parent;
    }
  }

  public toString(): string {
    if (this.root === null) {
      return "";
    }

    return this.expand(this.root, 0);
  }

  //does a pre-order traversal and prints out each node
  private expand(node: TreeNode, depth: number): string {
    const indent = "-".repeat(depth);
    let result = `${indent}<${node.name}>\n`;

    if (node.children.length === 0) {
      result = `${indent}[${node.name}]\n`;
      return result;
    }

    for (const child of node.children) {
      result += this.expand(child, depth + 1);
    }

    return result;
  }
}