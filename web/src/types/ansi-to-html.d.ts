declare module "ansi-to-html" {
  type ConvertOptions = {
    fg?: string;
    bg?: string;
    newline?: boolean;
    escapeXML?: boolean;
  };

  export default class Convert {
    constructor(options?: ConvertOptions);
    toHtml(input: string): string;
  }
}