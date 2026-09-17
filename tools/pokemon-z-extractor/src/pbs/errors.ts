export class PbsParseError extends Error {
  public constructor(
    message: string,
    public readonly file: string,
    public readonly line: number,
  ) {
    super(`${file}:${line}: ${message}`);
    this.name = "PbsParseError";
  }
}
