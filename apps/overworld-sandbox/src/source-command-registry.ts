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
  "text-options": capability("metadata", "rendered", "position et transparence de la boite de dialogue"),
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
  "change-map-settings": capability("audiovisual", "rendered", "panorama et brouillard de carte"),
  "screen-tone": capability("audiovisual", "rendered", "transition de teinte d'ecran"),
  "screen-flash": capability("audiovisual", "rendered", "flash colore"),
  "show-picture": capability("audiovisual", "rendered", "image superposee"),
  "move-picture": capability("audiovisual", "rendered", "animation d'image"),
  "erase-picture": capability("audiovisual", "rendered", "retrait d'image"),
  "show-animation": capability("audiovisual", "rendered", "animation de carte source"),
  "play-cry": capability("audiovisual", "accepted", "cri non joue"),
  "play-jingle": capability("audiovisual", "accepted", "jingle non joue"),
  "play-sound": capability("audiovisual", "rendered", "effet sonore source"),
  "play-music": capability("audiovisual", "rendered", "musique source"),
  "play-background-sound": capability("audiovisual", "accepted", "ambiance non jouee"),
  "fade-music": capability("audiovisual", "rendered", "fondu musical"),
  "scroll-map": capability("audiovisual", "rendered", "defilement anime de camera"),
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
