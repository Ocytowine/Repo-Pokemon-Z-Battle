export type SourceCommandFamily = "dialogue" | "state" | "movement" | "timing" | "transition" | "audiovisual" | "metadata";
export type SourceCommandSupport = "rendered" | "executed" | "absorbed" | "accepted";

export interface SourceCommandCapability {
  readonly family: SourceCommandFamily;
  readonly support: SourceCommandSupport;
  readonly detail: string;
}

const capability = (family: SourceCommandFamily, support: SourceCommandSupport, detail: string): SourceCommandCapability =>
  ({ family, support, detail });

export const SOURCE_COMMAND_CAPABILITIES: Readonly<Record<string, SourceCommandCapability>> = Object.freeze({
  "show-text": capability("dialogue", "rendered", "boite de dialogue"),
  "text-continuation": capability("dialogue", "absorbed", "suite du texte precedent"),
  "text-options": capability("metadata", "accepted", "options de texte non rendues"),
  "set-switches": capability("state", "executed", "interrupteurs persistants"),
  "set-self-switch": capability("state", "executed", "interrupteur local persistant"),
  "change-variables": capability("state", "executed", "variables persistantes"),
  "grant-item": capability("state", "executed", "ajout d'objet"),
  "remove-item": capability("state", "executed", "retrait d'objet"),
  "set-checkpoint": capability("state", "executed", "point de reprise"),
  "heal-party": capability("state", "executed", "soin de l'equipe"),
  "add-pokemon": capability("state", "executed", "ajout a l'equipe"),
  "request-encounter": capability("state", "executed", "rencontre source"),
  "set-follower": capability("state", "accepted", "suiveur non rendu"),
  "move-route": capability("movement", "rendered", "route animee"),
  "move-route-continuation": capability("movement", "absorbed", "etape deja incluse dans la route"),
  "wait-for-movement": capability("movement", "executed", "barriere de routes"),
  wait: capability("timing", "executed", "attente a 40 images par seconde"),
  "transfer-player": capability("transition", "executed", "changement de carte"),
  "change-map-settings": capability("audiovisual", "accepted", "reglage de carte non rendu"),
  "screen-tone": capability("audiovisual", "accepted", "teinte d'ecran non rendue"),
  "screen-flash": capability("audiovisual", "accepted", "flash non rendu"),
  "show-picture": capability("audiovisual", "accepted", "image superposee non rendue"),
  "move-picture": capability("audiovisual", "accepted", "animation d'image non rendue"),
  "erase-picture": capability("audiovisual", "accepted", "retrait d'image non rendu"),
  "show-animation": capability("audiovisual", "accepted", "animation de carte non rendue"),
  "play-cry": capability("audiovisual", "accepted", "cri non joue"),
  "play-jingle": capability("audiovisual", "accepted", "jingle non joue"),
  "play-sound": capability("audiovisual", "accepted", "effet sonore non joue"),
  "play-music": capability("audiovisual", "accepted", "musique non jouee"),
  "play-background-sound": capability("audiovisual", "accepted", "ambiance non jouee"),
  "fade-music": capability("audiovisual", "accepted", "fondu musical non joue"),
  "scroll-map": capability("audiovisual", "accepted", "defilement de camera non rendu"),
  "runtime-noop": capability("metadata", "absorbed", "commande source sans effet web"),
  end: capability("metadata", "absorbed", "fin de liste"),
});

export function sourceCommandCapability(kind: string): SourceCommandCapability | null {
  return SOURCE_COMMAND_CAPABILITIES[kind] ?? null;
}

export function isSourceStateCommand(kind: string): boolean {
  return sourceCommandCapability(kind)?.family === "state"
    && sourceCommandCapability(kind)?.support === "executed";
}

export function isKnownSourceCommand(kind: string): boolean {
  return sourceCommandCapability(kind) !== null;
}
