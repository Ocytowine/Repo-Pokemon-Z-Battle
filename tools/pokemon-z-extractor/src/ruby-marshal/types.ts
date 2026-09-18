export interface RubyString {
  readonly kind: "string";
  readonly bytes: Uint8Array;
  text: string;
  readonly ivars: Record<string, RubyMarshalValue>;
}

export interface RubySymbol {
  readonly kind: "symbol";
  readonly name: string;
}

export interface RubyHash {
  readonly kind: "hash";
  readonly entries: Array<readonly [RubyMarshalValue, RubyMarshalValue]>;
  defaultValue?: RubyMarshalValue;
}

export interface RubyObject {
  readonly kind: "object";
  readonly className: string;
  readonly ivars: Record<string, RubyMarshalValue>;
}

export interface RubyStruct {
  readonly kind: "struct";
  readonly className: string;
  readonly members: Record<string, RubyMarshalValue>;
}

export interface RubyUserDefined {
  readonly kind: "user-defined";
  readonly className: string;
  readonly bytes: Uint8Array;
}

export interface RubyUserMarshal {
  readonly kind: "user-marshal";
  readonly className: string;
  value: RubyMarshalValue;
}

export interface RubyRegexp {
  readonly kind: "regexp";
  readonly source: RubyString;
  readonly options: number;
}

export interface RubyClassReference {
  readonly kind: "class" | "module";
  readonly name: string;
}

export interface RubyExtendedValue {
  readonly kind: "extended" | "user-class";
  readonly moduleName: string;
  value: RubyMarshalValue;
  readonly ivars: Record<string, RubyMarshalValue>;
}

export interface RubyDataObject {
  readonly kind: "data";
  readonly className: string;
  value: RubyMarshalValue;
}

export type RubyMarshalValue =
  | null
  | boolean
  | number
  | bigint
  | RubyString
  | RubySymbol
  | RubyMarshalValue[]
  | RubyHash
  | RubyObject
  | RubyStruct
  | RubyUserDefined
  | RubyUserMarshal
  | RubyRegexp
  | RubyClassReference
  | RubyExtendedValue
  | RubyDataObject;

export interface RpgTable {
  readonly dimensions: number;
  readonly xSize: number;
  readonly ySize: number;
  readonly zSize: number;
  readonly values: readonly number[];
}
