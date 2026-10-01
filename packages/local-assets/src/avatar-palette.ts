export const AVATAR_PALETTE_COLORS = {
  navy: "#16345d", gold: "#d9a632", red: "#c74848", blue: "#397dc0", green: "#3d906d",
  purple: "#7756a8", rose: "#c65b82", orange: "#d77738", cream: "#e6d8b4", charcoal: "#313744",
  white: "#eef2f2", black: "#12151b",
} as const;

export interface AvatarPaletteSelection {
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
}

type ColorRole = keyof AvatarPaletteSelection;
interface Hsl { readonly hue: number; readonly saturation: number; readonly lightness: number }

function hsl(red: number, green: number, blue: number): Hsl {
  const r = red / 255; const g = green / 255; const b = blue / 255;
  const maximum = Math.max(r, g, b); const minimum = Math.min(r, g, b); const delta = maximum - minimum;
  let hue = 0;
  if (delta > 0) {
    if (maximum === r) hue = 60 * (((g - b) / delta) % 6);
    else if (maximum === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  const lightness = (maximum + minimum) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { hue, saturation, lightness };
}

function rgb(value: string): readonly [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/iu.exec(value); if (match === null) return null;
  const packed = Number.parseInt(match[1]!, 16); return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
}

function hslToRgb(color: Hsl): readonly [number, number, number] {
  const chroma = (1 - Math.abs(2 * color.lightness - 1)) * color.saturation;
  const segment = color.hue / 60; const intermediate = chroma * (1 - Math.abs((segment % 2) - 1));
  const [r, g, b] = segment < 1 ? [chroma, intermediate, 0] : segment < 2 ? [intermediate, chroma, 0]
    : segment < 3 ? [0, chroma, intermediate] : segment < 4 ? [0, intermediate, chroma]
      : segment < 5 ? [intermediate, 0, chroma] : [chroma, 0, intermediate];
  const match = color.lightness - chroma / 2;
  return [Math.round((r + match) * 255), Math.round((g + match) * 255), Math.round((b + match) * 255)];
}

function roleFor(color: Hsl): ColorRole | null {
  if (color.saturation < 0.22 || color.lightness < 0.04 || color.lightness > 0.96) return null;
  if (color.hue >= 190 && color.hue <= 270) return "primary";
  if (color.hue > 28 && color.hue < 78) return "secondary";
  if (color.hue <= 28 || color.hue >= 335) return "accent";
  return null;
}

const SOURCE_ANCHORS: Record<ColorRole, Hsl> = {
  primary: hsl(...rgb(AVATAR_PALETTE_COLORS.navy)!),
  secondary: hsl(...rgb(AVATAR_PALETTE_COLORS.gold)!),
  accent: hsl(...rgb(AVATAR_PALETTE_COLORS.red)!),
};

/**
 * Les trois ethnies historiques d'un meme modele ont des pixels de tenue
 * identiques. Tout pixel qui varie entre elles appartient a l'identite (peau,
 * cheveux ou contour antialiase) et reste donc strictement protege.
 */
export function recolorAvatarPixels(base: Uint8ClampedArray, identityVariants: readonly Uint8ClampedArray[],
  palette: AvatarPaletteSelection): Uint8ClampedArray {
  if (identityVariants.some((variant) => variant.length !== base.length)) throw new Error("Masques d'avatar incompatibles.");
  const result = new Uint8ClampedArray(base);
  for (let index = 0; index < base.length; index += 4) {
    if (base[index + 3] === 0) continue;
    const stable = identityVariants.length > 0 && identityVariants.every((variant) =>
      variant[index] === base[index] && variant[index + 1] === base[index + 1]
      && variant[index + 2] === base[index + 2] && variant[index + 3] === base[index + 3]);
    if (!stable) continue;
    const source = hsl(base[index]!, base[index + 1]!, base[index + 2]!); const role = roleFor(source);
    if (role === null) continue;
    const targetRgb = rgb(AVATAR_PALETTE_COLORS[palette[role] as keyof typeof AVATAR_PALETTE_COLORS] ?? "");
    if (targetRgb === null) continue;
    const target = hsl(...targetRgb); const anchor = SOURCE_ANCHORS[role];
    // Conserver un rapport de luminosite plutot qu'un simple decalage. Un blanc
    // cible reste ainsi blanc dans les hautes lumieres, mais les contours et les
    // plis sombres gardent un contraste net au lieu d'etre remontes vers le gris clair.
    const relativeLightness = source.lightness / Math.max(0.01, anchor.lightness);
    const recolored = hslToRgb({ hue: target.hue, saturation: target.saturation,
      lightness: Math.min(0.96, Math.max(0.04, target.lightness * relativeLightness ** 0.85)) });
    result[index] = recolored[0]; result[index + 1] = recolored[1]; result[index + 2] = recolored[2];
  }
  return result;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image(); image.src = url; await image.decode(); return image;
}

export async function loadRecoloredAvatarCanvas(source: string, identityVariants: readonly string[],
  palette: AvatarPaletteSelection): Promise<HTMLCanvasElement> {
  const [loadedBase, ...variants] = await Promise.all([source, ...identityVariants].map(loadImage));
  const base = loadedBase!;
  const canvas = document.createElement("canvas"); canvas.width = base.naturalWidth; canvas.height = base.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) throw new Error("Canvas de personnalisation indisponible.");
  const pixels = (image: HTMLImageElement): ImageData | null => {
    if (image.naturalWidth !== canvas.width || image.naturalHeight !== canvas.height) return null;
    context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height);
  };
  const basePixels = pixels(base)!; const variantPixels = variants.map(pixels).filter((value): value is ImageData => value !== null);
  const output = context.createImageData(canvas.width, canvas.height);
  output.data.set(recolorAvatarPixels(basePixels.data, variantPixels.map((value) => value.data), palette));
  context.putImageData(output, 0, 0);
  return canvas;
}
