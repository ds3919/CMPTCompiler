// AI Generated

export class TerminalColors {
  private static readonly RESET = "\x1b[0m";
  private static readonly BOLD = "\x1b[1m";
  private static readonly DIM = "\x1b[2m";

  private static readonly RED = "\x1b[31m";
  private static readonly GREEN = "\x1b[32m";
  private static readonly YELLOW = "\x1b[33m";
  private static readonly BLUE = "\x1b[34m";
  private static readonly MAGENTA = "\x1b[35m";
  private static readonly CYAN = "\x1b[36m";
  private static readonly GRAY = "\x1b[90m";

  public static error(text: string): string {
    return `${this.BOLD}${this.RED}${text}${this.RESET}`;
  }

  public static warning(text: string): string {
    return `${this.BOLD}${this.YELLOW}${text}${this.RESET}`;
  }

  public static success(text: string): string {
    return `${this.BOLD}${this.GREEN}${text}${this.RESET}`;
  }

  public static phase(text: string): string {
    return `${this.CYAN}${text}${this.RESET}`;
  }

  public static hint(text: string): string {
    return `${this.BLUE}${text}${this.RESET}`;
  }

  public static found(text: string): string {
    return `${this.MAGENTA}${text}${this.RESET}`;
  }

  public static expected(text: string): string {
    return `${this.GREEN}${text}${this.RESET}`;
  }

  public static source(text: string): string {
    return `${this.GRAY}${text}${this.RESET}`;
  }

  public static dim(text: string): string {
    return `${this.DIM}${text}${this.RESET}`;
  }

  public static bold(text: string): string {
    return `${this.BOLD}${text}${this.RESET}`;
  }
}