import { open, readFile } from "node:fs/promises";
import path from "node:path";

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

export interface ImageMetadata extends ImageDimensions {
  readonly format: "png" | "gif" | "bmp" | "jpg";
}

async function readHeader(filePath: string, length = 32): Promise<Buffer> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function jpegDimensions(bytes: Buffer): ImageDimensions {
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) break;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error("Dimensions JPEG introuvables.");
}

export async function readImageMetadata(filePath: string): Promise<ImageMetadata | null> {
  const extension = path.extname(filePath).toLowerCase();
  const bytes = await readHeader(filePath, 32);
  if (bytes.length >= 24 && bytes.toString("hex", 0, 8) === "89504e470d0a1a0a") {
    return { format: "png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 10 && bytes.toString("ascii", 0, 6).startsWith("GIF8")) {
    return { format: "gif", width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (bytes.length >= 26 && bytes.toString("ascii", 0, 2) === "BM") {
    return { format: "bmp", width: Math.abs(bytes.readInt32LE(18)), height: Math.abs(bytes.readInt32LE(22)) };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return { format: "jpg", ...jpegDimensions(await readFile(filePath)) };
  }
  if ([".png", ".gif", ".bmp", ".jpg", ".jpeg"].includes(extension)) {
    throw new Error(`Format d'image non reconnu malgre l'extension ${extension} : ${filePath}`);
  }
  return null;
}

export async function readImageDimensions(filePath: string): Promise<ImageDimensions | null> {
  const metadata = await readImageMetadata(filePath);
  return metadata === null ? null : { width: metadata.width, height: metadata.height };
}
