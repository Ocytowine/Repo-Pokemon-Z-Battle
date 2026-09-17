import { readFile } from "node:fs/promises";

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

export async function readPbsText(filePath: string): Promise<string> {
  const bytes = await readFile(filePath);
  const text = UTF8_DECODER.decode(bytes);
  return text.startsWith("\uFEFF") ? text.slice(1) : text;
}

export function normalizeLines(text: string): readonly string[] {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
}
