export class TerminalColors {
  private static readonly RESET = "\x1b[0m";
  private static readonly DIM = "\x1b[2m";

  // softer terminal colors
  private static readonly RED = "\x1b[38;2;239;130;130m";
  private static readonly GREEN = "\x1b[38;2;134;239;172m";
  private static readonly YELLOW = "\x1b[38;2;250;204;121m";
  private static readonly BLUE = "\x1b[38;2;147;197;253m";
  private static readonly MAGENTA = "\x1b[38;2;216;180;254m";
  private static readonly CYAN = "\x1b[38;2;125;211;252m";
  private static readonly GRAY = "\x1b[38;2;156;163;175m";
  private static readonly WHITE = "\x1b[38;2;244;244;245m";

  public static error(text: string): string {
    return `${this.RED}${text}${this.RESET}`;
  }

  public static warning(text: string): string {
    return `${this.YELLOW}${text}${this.RESET}`;
  }

  public static success(text: string): string {
    return `${this.GREEN}${text}${this.RESET}`;
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
    return `${this.WHITE}${text}${this.RESET}`;
  }
}