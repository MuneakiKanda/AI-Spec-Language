// =============================================
// AI-Spec Language - Scanner（文字レベルスキャン）
// =============================================

export class Scanner {
  private pos = 0;
  private _line = 1;
  private _column = 1;

  constructor(private readonly source: string) {}

  get line(): number {
    return this._line;
  }

  get column(): number {
    return this._column;
  }

  get isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  peek(): string {
    if (this.isAtEnd) return "\0";
    return this.source[this.pos];
  }

  peekNext(): string {
    if (this.pos + 1 >= this.source.length) return "\0";
    return this.source[this.pos + 1];
  }

  advance(): string {
    if (this.isAtEnd) return "\0";
    const ch = this.source[this.pos];
    this.pos++;
    if (ch === "\n") {
      this._line++;
      this._column = 1;
    } else {
      this._column++;
    }
    return ch;
  }

  match(expected: string): boolean {
    if (this.isAtEnd || this.source[this.pos] !== expected) return false;
    this.advance();
    return true;
  }

  skipWhitespace(): void {
    while (!this.isAtEnd) {
      const ch = this.peek();
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
        this.advance();
      } else {
        break;
      }
    }
  }
}
