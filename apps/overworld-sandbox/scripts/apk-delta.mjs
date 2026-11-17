import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, openSync, closeSync, readSync, writeSync, statSync,
  unlinkSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

const MAGIC = Buffer.from("PZBD1");
const BLOCK = 64 * 1024;
const MAX_APK = 2_000_000_000;

function readAt(fd, offset, length) {
  const result = Buffer.alloc(length);
  let done = 0;
  while (done < length) {
    const count = readSync(fd, result, done, length - done, offset + done);
    if (count === 0) throw new Error("Archive ZIP tronquée.");
    done += count;
  }
  return result;
}

function entries(fd, size) {
  const tailOffset = Math.max(0, size - 65_557);
  const tail = readAt(fd, tailOffset, size - tailOffset);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50 && i + 22 + tail.readUInt16LE(i + 20) === tail.length) {
      eocd = i; break;
    }
  }
  if (eocd < 0 || tail.readUInt16LE(eocd + 4) !== 0 || tail.readUInt16LE(eocd + 6) !== 0
    || tail.readUInt16LE(eocd + 8) !== tail.readUInt16LE(eocd + 10)) {
    throw new Error("Répertoire ZIP APK invalide ou multidisque.");
  }
  const count = tail.readUInt16LE(eocd + 10);
  const directorySize = tail.readUInt32LE(eocd + 12);
  const directoryOffset = tail.readUInt32LE(eocd + 16);
  if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff
    || directoryOffset + directorySize > size) throw new Error("ZIP64 non pris en charge.");
  const directory = readAt(fd, directoryOffset, directorySize);
  const result = new Map();
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > directory.length || directory.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Entrée ZIP invalide.");
    }
    const compressed = directory.readUInt32LE(cursor + 20);
    const nameLength = directory.readUInt16LE(cursor + 28);
    const extraLength = directory.readUInt16LE(cursor + 30);
    const commentLength = directory.readUInt16LE(cursor + 32);
    const localOffset = directory.readUInt32LE(cursor + 42);
    const name = directory.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    if (compressed === 0xffffffff || localOffset === 0xffffffff || result.has(name)
      || cursor + 46 + nameLength + extraLength + commentLength > directory.length) {
      throw new Error("Entrée ZIP incompatible.");
    }
    const local = readAt(fd, localOffset, 30);
    if (local.readUInt32LE(0) !== 0x04034b50) throw new Error("En-tête ZIP local invalide.");
    const dataOffset = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
    if (dataOffset + compressed > size) throw new Error("Données ZIP hors archive.");
    result.set(name, { offset: dataOffset, length: compressed });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return result;
}

function sameBytes(oldFd, oldOffset, newFd, newOffset, length) {
  for (let position = 0; position < length; position += BLOCK) {
    const part = Math.min(BLOCK, length - position);
    if (!readAt(oldFd, oldOffset + position, part)
      .equals(readAt(newFd, newOffset + position, part))) return false;
  }
  return true;
}

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

function writeAt(fd, bytes) {
  let done = 0;
  while (done < bytes.length) {
    const count = writeSync(fd, bytes, done, bytes.length - done);
    if (count <= 0) throw new Error("Écriture du patch interrompue.");
    done += count;
  }
}

function writeLiteral(fd, sourceFd, offset, length) {
  if (!length) return;
  const header = Buffer.alloc(5);
  header[0] = 1;
  header.writeUInt32BE(length, 1);
  writeAt(fd, header);
  for (let done = 0; done < length; done += BLOCK) {
    writeAt(fd, readAt(sourceFd, offset + done, Math.min(BLOCK, length - done)));
  }
}

function writeCopy(fd, offset, length) {
  const header = Buffer.alloc(13);
  header[0] = 0;
  header.writeBigUInt64BE(BigInt(offset), 1);
  header.writeUInt32BE(length, 9);
  writeAt(fd, header);
}

/** Byte-exact signed APK reconstruction; ZIP entries only identify reusable byte spans. */
export async function createApkDelta(base, target, output) {
  const baseSize = statSync(base).size;
  const targetSize = statSync(target).size;
  if (baseSize <= 0 || targetSize <= 0 || baseSize > MAX_APK || targetSize > MAX_APK) {
    throw new Error("Taille APK incompatible avec le patch.");
  }
  const baseHash = await sha256(base);
  const targetHash = await sha256(target);
  const baseFd = openSync(base, "r");
  const targetFd = openSync(target, "r");
  const raw = `${output}.raw`;
  let rawFd;
  try {
    const oldEntries = entries(baseFd, baseSize);
    const newEntries = entries(targetFd, targetSize);
    const spans = [];
    for (const [name, current] of newEntries) {
      const previous = oldEntries.get(name);
      if (previous && current.length >= 1_024 && current.length === previous.length
        && sameBytes(baseFd, previous.offset, targetFd, current.offset, current.length)) {
        spans.push({ target: current.offset, base: previous.offset, length: current.length });
      }
    }
    spans.sort((a, b) => a.target - b.target);
    const operations = [];
    let cursor = 0;
    for (const span of spans) {
      if (span.target < cursor) throw new Error("Entrées ZIP chevauchantes.");
      if (span.target > cursor) operations.push({ type: "literal", offset: cursor, length: span.target - cursor });
      operations.push({ type: "copy", offset: span.base, length: span.length });
      cursor = span.target + span.length;
    }
    if (cursor < targetSize) operations.push({ type: "literal", offset: cursor, length: targetSize - cursor });
    rawFd = openSync(raw, "w");
    const header = Buffer.alloc(89);
    MAGIC.copy(header);
    Buffer.from(baseHash, "hex").copy(header, 5);
    Buffer.from(targetHash, "hex").copy(header, 37);
    header.writeBigUInt64BE(BigInt(baseSize), 69);
    header.writeBigUInt64BE(BigInt(targetSize), 77);
    header.writeUInt32BE(operations.length, 85);
    writeAt(rawFd, header);
    for (const op of operations) {
      if (op.type === "copy") writeCopy(rawFd, op.offset, op.length);
      else writeLiteral(rawFd, targetFd, op.offset, op.length);
    }
    closeSync(rawFd); rawFd = undefined;
    await pipeline(createReadStream(raw), createGzip({ level: 9 }), createWriteStream(output));
    return { baseSha256: baseHash, targetSha256: targetHash, baseSizeBytes: baseSize,
      targetSizeBytes: targetSize, sizeBytes: statSync(output).size, sha256: await sha256(output),
      reusedBytes: spans.reduce((sum, span) => sum + span.length, 0), operations: operations.length };
  } finally {
    if (rawFd !== undefined) closeSync(rawFd);
    closeSync(baseFd); closeSync(targetFd);
    try { unlinkSync(raw); } catch { /* no temporary file */ }
  }
}
