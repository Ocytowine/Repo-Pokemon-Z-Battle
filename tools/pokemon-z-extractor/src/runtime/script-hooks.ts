export type CoopPolicy = "PERSONAL" | "SHARED" | "HOST_ONLY" | "SYNCED";

export type ScriptHookFamily =
  | "profile" | "inventory" | "encounter" | "party" | "follower" | "dialogue"
  | "world-state" | "movement" | "transition" | "healing" | "shop"
  | "audio-visual" | "cutscene" | "system" | "custom";

export interface ScriptFamilyPolicy {
  readonly policy: CoopPolicy;
  readonly rationale: string;
}

export const SCRIPT_FAMILY_POLICIES: Readonly<Record<ScriptHookFamily, ScriptFamilyPolicy>> = {
  profile: { policy: "PERSONAL", rationale: "Identite et apparence propres au joueur." },
  inventory: { policy: "PERSONAL", rationale: "Objets attribues et consommes dans l'inventaire du joueur." },
  encounter: { policy: "HOST_ONLY", rationale: "Le serveur autoritaire laisse le meneur declencher le combat du groupe." },
  party: { policy: "PERSONAL", rationale: "Equipe et progression propres au joueur." },
  follower: { policy: "SHARED", rationale: "Le compagnon est visible dans le monde commun." },
  dialogue: { policy: "PERSONAL", rationale: "Texte et choix presentes au joueur qui interagit." },
  "world-state": { policy: "SHARED", rationale: "Modification persistante du monde de la session." },
  movement: { policy: "SHARED", rationale: "Position des evenements visible par tous les joueurs." },
  transition: { policy: "PERSONAL", rationale: "Changement de carte applique a l'avatar concerne." },
  healing: { policy: "PERSONAL", rationale: "Soin applique a l'equipe du joueur." },
  shop: { policy: "PERSONAL", rationale: "Transaction et interface propres au joueur." },
  "audio-visual": { policy: "PERSONAL", rationale: "Presentation locale sans mutation autoritaire." },
  cutscene: { policy: "SYNCED", rationale: "Sequence globale demarree lorsque les participants sont prets." },
  system: { policy: "HOST_ONLY", rationale: "Reglage de partie choisi par le meneur et valide par le serveur." },
  custom: { policy: "HOST_ONLY", rationale: "Politique conservatrice jusqu'au portage explicite." },
};

export function normalizeRubySignature(source: string): string {
  return source.trim()
    .replace(/\bKernel\./gu, "")
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gu, "<string>")
    .replace(/\b(PB(?:Items|Species|Trainers|Moves|Abilities))::[A-Z][A-Z0-9_]*/gu, "$1::<constant>")
    .replace(/(^|[^:\w]):[A-Z][A-Z0-9_]*/gu, "$1:<symbol>")
    .replace(/\b\d+(?:\.\d+)?\b/gu, "<number>")
    .replace(/\s+/gu, " ")
    .replace(/\s*([(),=<>+\-*\/\[\]])\s*/gu, "$1");
}

export function classifyRubyHook(source: string): ScriptHookFamily {
  const value = source.toLowerCase();
  if (/pbchangeplayer|pbtrainername/u.test(value)) return "profile";
  if (/pbitemball|pbreceiveitem|pokemonbag|pbstoreitem|pbdeleteitem/u.test(value)) return "inventory";
  if (/pbwildbattle|pbtrainerbattle|pbencounter|randomencounter/u.test(value)) return "encounter";
  if (/pbaddpokemon|pbaddtoparty|pbremovepokemon|trainer\.party|pbhas(?:species|pokemon)/u.test(value)) return "party";
  if (/follow|dependentevent/u.test(value)) return "follower";
  if (/pbmessage|pbconfirm|pbchoose|text\s*=/u.test(value)) return "dialogue";
  if (/nuzlocke|difficulty|gamespeed|pokemonsystem|save/u.test(value)) return "system";
  if (/switch|pbset\(|variable|pokemonGlobal\.[a-z_]+\s*=/iu.test(source)) return "world-state";
  if (/cutscene|pbscene|followinganimation/u.test(value)) return "cutscene";
  if (/move|character|bridge|caveentrance|caveexit/u.test(value)) return "movement";
  if (/transfer|teleport|mapfactory/u.test(value)) return "transition";
  if (/heal|pokemoncenter|pokecenter/u.test(value)) return "healing";
  if (/mart|shop/u.test(value)) return "shop";
  if (/play|tone|picture|animation|cry|audio|bgm|bgs/u.test(value)) return "audio-visual";
  return "custom";
}

export type PortedScriptAction =
  | { readonly kind: "set-player-avatar"; readonly avatarId: number; readonly family: "profile"; readonly policy: "PERSONAL" }
  | { readonly kind: "request-trainer-name"; readonly defaultName: string | null; readonly family: "profile"; readonly policy: "PERSONAL" }
  | { readonly kind: "set-screen-tone"; readonly red: number; readonly green: number; readonly blue: number; readonly gray: number; readonly duration: number; readonly family: "audio-visual"; readonly policy: "PERSONAL" }
  | { readonly kind: "set-difficulty"; readonly level: number; readonly family: "system"; readonly policy: "HOST_ONLY" }
  | { readonly kind: "set-nuzlocke"; readonly enabled: boolean; readonly family: "system"; readonly policy: "HOST_ONLY" };

export function portTargetRubyLine(source: string): PortedScriptAction | null {
  let match = /^\s*pbChangePlayer\((\d+)\)\s*$/u.exec(source);
  if (match !== null) return { kind: "set-player-avatar", avatarId: Number(match[1]), family: "profile", policy: "PERSONAL" };
  match = /^\s*pbTrainerName(?:\((['"])(.*?)\1\))?\s*$/u.exec(source);
  if (match !== null) return { kind: "request-trainer-name", defaultName: match[2] ?? null, family: "profile", policy: "PERSONAL" };
  match = /^\s*pbToneChangeAll\(Tone\.new\((-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\),\s*(\d+)\)\s*$/u.exec(source);
  if (match !== null) return {
    kind: "set-screen-tone", red: Number(match[1]), green: Number(match[2]), blue: Number(match[3]), gray: Number(match[4]), duration: Number(match[5]), family: "audio-visual", policy: "PERSONAL",
  };
  match = /^\s*\$PokemonSystem\.difficulty\s*=\s*(\d+)\s*$/u.exec(source);
  if (match !== null) return { kind: "set-difficulty", level: Number(match[1]), family: "system", policy: "HOST_ONLY" };
  match = /^\s*\$PokemonGlobal\.nuzlocke\s*=\s*(true|false)\s*$/u.exec(source);
  if (match !== null) return { kind: "set-nuzlocke", enabled: match[1] === "true", family: "system", policy: "HOST_ONLY" };
  return null;
}
