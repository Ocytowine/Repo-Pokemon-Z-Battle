import type {
  RubyDataObject,
  RubyExtendedValue,
  RubyHash,
  RubyMarshalValue,
  RubyObject,
  RubyRegexp,
  RubyString,
  RubyStruct,
  RubySymbol,
  RubyUserDefined,
  RubyUserMarshal,
} from "./types.js";

const UTF8 = new TextDecoder("utf-8", { fatal: false });
const WINDOWS_1252 = new TextDecoder("windows-1252", { fatal: false });

export class RubyMarshalError extends Error {
  public constructor(message: string, public readonly offset: number) {
    super(`Ruby Marshal offset ${offset}: ${message}`);
    this.name = "RubyMarshalError";
  }
}

export class RubyMarshalReader {
  private offset = 0;
  private readonly objects: RubyMarshalValue[] = [];
  private readonly symbols: RubySymbol[] = [];

  public constructor(private readonly bytes: Uint8Array) {}

  public read(): RubyMarshalValue {
    const major = this.readByte();
    const minor = this.readByte();
    if (major !== 4 || minor !== 8) {
      throw new RubyMarshalError(`Version non prise en charge : ${major}.${minor}.`, 0);
    }
    const value = this.readValue();
    if (this.offset !== this.bytes.length) {
      throw new RubyMarshalError(`${this.bytes.length - this.offset} octets non lus.`, this.offset);
    }
    return value;
  }

  private readValue(): RubyMarshalValue {
    const tagOffset = this.offset;
    const tag = String.fromCharCode(this.readByte());
    switch (tag) {
      case "0": return null;
      case "T": return true;
      case "F": return false;
      case "i": return this.readFixnum();
      case "l": return this.readBignum();
      case "f": return this.readFloat();
      case '"': return this.readString();
      case ":": return this.readNewSymbol();
      case ";": return this.readSymbolLink();
      case "[": return this.readArray();
      case "{": return this.readHash(false);
      case "}": return this.readHash(true);
      case "o": return this.readObject();
      case "S": return this.readStruct();
      case "u": return this.readUserDefined();
      case "U": return this.readUserMarshal();
      case "I": return this.readIvarWrapped();
      case "@": return this.readObjectLink();
      case "/": return this.readRegexp();
      case "c": return this.readNamedReference("class");
      case "m": case "M": return this.readNamedReference("module");
      case "e": return this.readExtended("extended");
      case "C": return this.readExtended("user-class");
      case "d": return this.readDataObject();
      default: throw new RubyMarshalError(`Balise inconnue : 0x${tag.charCodeAt(0).toString(16)}.`, tagOffset);
    }
  }

  private readByte(): number {
    const value = this.bytes[this.offset];
    if (value === undefined) throw new RubyMarshalError("Fin de fichier inattendue.", this.offset);
    this.offset += 1;
    return value;
  }

  private readSignedByte(): number {
    const value = this.readByte();
    return value > 127 ? value - 256 : value;
  }

  private readBytes(length: number): Uint8Array {
    if (length < 0 || this.offset + length > this.bytes.length) {
      throw new RubyMarshalError(`Longueur invalide : ${length}.`, this.offset);
    }
    const value = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  private readFixnum(): number {
    const marker = this.readSignedByte();
    if (marker === 0) return 0;
    if (marker >= 5) return marker - 5;
    if (marker <= -5) return marker + 5;
    const length = Math.abs(marker);
    let value = marker < 0 ? -1 : 0;
    for (let index = 0; index < length; index += 1) {
      const byte = this.readByte();
      const mask = 0xff << (index * 8);
      value = (value & ~mask) | (byte << (index * 8));
    }
    return value;
  }

  private readLength(label: string): number {
    const length = this.readFixnum();
    if (!Number.isSafeInteger(length) || length < 0) {
      throw new RubyMarshalError(`${label} invalide : ${length}.`, this.offset);
    }
    return length;
  }

  private readBignum(): bigint {
    const sign = String.fromCharCode(this.readByte());
    const words = this.readLength("Nombre de mots du grand entier");
    let value = 0n;
    for (let index = 0; index < words * 2; index += 1) {
      value |= BigInt(this.readByte()) << BigInt(index * 8);
    }
    const result = sign === "-" ? -value : value;
    this.objects.push(result);
    return result;
  }

  private readFloat(): number {
    const payload = this.decodeBytes(this.readBytes(this.readLength("Longueur du flottant")), "utf8");
    // Ruby 1.8 can append a NUL and binary mantissa bytes to the textual value.
    // The textual prefix remains the portable representation used by modern Ruby.
    const separator = payload.indexOf("\0");
    const text = separator === -1 ? payload : payload.slice(0, separator);
    const value = text === "nan"
      ? Number.NaN
      : text === "inf"
        ? Number.POSITIVE_INFINITY
        : text === "-inf"
          ? Number.NEGATIVE_INFINITY
          : Number(text);
    if (Number.isNaN(value) && text !== "nan") {
      throw new RubyMarshalError(`Flottant invalide : ${text}.`, this.offset);
    }
    this.objects.push(value);
    return value;
  }

  private readString(): RubyString {
    const bytes = this.readBytes(this.readLength("Longueur de chaine"));
    const value: RubyString = {
      kind: "string",
      bytes,
      text: this.decodeBytes(bytes, "auto"),
      ivars: {},
    };
    this.objects.push(value);
    return value;
  }

  private readNewSymbol(): RubySymbol {
    const bytes = this.readBytes(this.readLength("Longueur de symbole"));
    const value: RubySymbol = { kind: "symbol", name: this.decodeBytes(bytes, "auto") };
    this.symbols.push(value);
    return value;
  }

  private readSymbolLink(): RubySymbol {
    const index = this.readLength("Index de symbole");
    const value = this.symbols[index];
    if (value === undefined) throw new RubyMarshalError(`Symbole ${index} absent.`, this.offset);
    return value;
  }

  private readArray(): RubyMarshalValue[] {
    const length = this.readLength("Longueur de tableau");
    const value: RubyMarshalValue[] = [];
    this.objects.push(value);
    for (let index = 0; index < length; index += 1) value.push(this.readValue());
    return value;
  }

  private readHash(hasDefault: boolean): RubyHash {
    const length = this.readLength("Longueur de hash");
    const value: RubyHash = { kind: "hash", entries: [] };
    this.objects.push(value);
    for (let index = 0; index < length; index += 1) {
      value.entries.push([this.readValue(), this.readValue()]);
    }
    if (hasDefault) value.defaultValue = this.readValue();
    return value;
  }

  private readSymbolName(): string {
    const value = this.readValue();
    if (typeof value !== "object" || value === null || Array.isArray(value) || value.kind !== "symbol") {
      throw new RubyMarshalError("Symbole attendu.", this.offset);
    }
    return value.name;
  }

  private readObject(): RubyObject {
    const className = this.readSymbolName();
    const value: RubyObject = { kind: "object", className, ivars: {} };
    this.objects.push(value);
    this.readNamedValues(value.ivars, "variables d'instance");
    return value;
  }

  private readStruct(): RubyStruct {
    const className = this.readSymbolName();
    const value: RubyStruct = { kind: "struct", className, members: {} };
    this.objects.push(value);
    this.readNamedValues(value.members, "membres de structure");
    return value;
  }

  private readNamedValues(target: Record<string, RubyMarshalValue>, label: string): void {
    const count = this.readLength(`Nombre de ${label}`);
    for (let index = 0; index < count; index += 1) target[this.readSymbolName()] = this.readValue();
  }

  private readUserDefined(): RubyUserDefined {
    const className = this.readSymbolName();
    const value: RubyUserDefined = {
      kind: "user-defined",
      className,
      bytes: this.readBytes(this.readLength("Longueur de charge utilisateur")),
    };
    this.objects.push(value);
    return value;
  }

  private readUserMarshal(): RubyUserMarshal {
    const className = this.readSymbolName();
    const value: RubyUserMarshal = { kind: "user-marshal", className, value: null };
    this.objects.push(value);
    value.value = this.readValue();
    return value;
  }

  private readIvarWrapped(): RubyMarshalValue {
    const value = this.readValue();
    const count = this.readLength("Nombre de variables d'encodage");
    const ivars: Array<readonly [string, RubyMarshalValue]> = [];
    for (let index = 0; index < count; index += 1) ivars.push([this.readSymbolName(), this.readValue()]);
    if (typeof value === "object" && value !== null && !Array.isArray(value) && value.kind === "string") {
      for (const [name, entry] of ivars) value.ivars[name] = entry;
      const encoding = ivars.find(([name]) => name === "encoding")?.[1];
      const utf8 = ivars.some(([name, entry]) => name === "E" && entry === true)
        || (typeof encoding === "object" && encoding !== null && !Array.isArray(encoding)
          && encoding.kind === "string" && /UTF-?8/iu.test(encoding.text));
      value.text = this.decodeBytes(value.bytes, utf8 ? "utf8" : "auto");
    } else if (typeof value === "object" && value !== null && !Array.isArray(value) && "ivars" in value) {
      for (const [name, entry] of ivars) value.ivars[name] = entry;
    }
    return value;
  }

  private readObjectLink(): RubyMarshalValue {
    const index = this.readLength("Index d'objet");
    const value = this.objects[index];
    if (value === undefined) throw new RubyMarshalError(`Objet ${index} absent.`, this.offset);
    return value;
  }

  private readRegexp(): RubyRegexp {
    const bytes = this.readBytes(this.readLength("Longueur d'expression reguliere"));
    const source: RubyString = {
      kind: "string",
      bytes,
      text: this.decodeBytes(bytes, "auto"),
      ivars: {},
    };
    const value: RubyRegexp = { kind: "regexp", source, options: this.readByte() };
    this.objects.push(value);
    return value;
  }

  private readNamedReference(kind: "class" | "module"): RubyMarshalValue {
    const name = this.decodeBytes(this.readBytes(this.readLength(`Longueur de ${kind}`)), "auto");
    const value = { kind, name } as const;
    this.objects.push(value);
    return value;
  }

  private readExtended(kind: "extended" | "user-class"): RubyExtendedValue {
    const moduleName = this.readSymbolName();
    const value: RubyExtendedValue = { kind, moduleName, value: null, ivars: {} };
    value.value = this.readValue();
    return value;
  }

  private readDataObject(): RubyDataObject {
    const className = this.readSymbolName();
    const value: RubyDataObject = { kind: "data", className, value: null };
    this.objects.push(value);
    value.value = this.readValue();
    return value;
  }

  private decodeBytes(bytes: Uint8Array, encoding: "utf8" | "auto"): string {
    if (encoding === "utf8") return UTF8.decode(bytes);
    const utf8 = UTF8.decode(bytes);
    return utf8.includes("\uFFFD") ? WINDOWS_1252.decode(bytes) : utf8;
  }
}

export function readRubyMarshal(bytes: Uint8Array): RubyMarshalValue {
  return new RubyMarshalReader(bytes).read();
}
