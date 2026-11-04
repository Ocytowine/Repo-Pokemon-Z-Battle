/** Source command 201 uses 0 for the default screen transition and 1 for none. */
export function sourceTransferUsesFade(fade: number | undefined): boolean {
  return fade === 0;
}

/** `NOSIGNPOSTS` is empty in Pokémon Z v2.12 FR; equal map names suppress the sign. */
export function sourceShouldShowArea(previousName: string | null, nextName: string,
  changedMap: boolean, showArea: boolean): boolean {
  return changedMap && showArea && nextName.trim() !== ""
    && (previousName === null || previousName !== nextName);
}

export function sourceAreaBannerVariant(name: string): 0 | 1 | 2 | 3 {
  const normalized = name.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/\p{M}/gu, "");
  if (/meseta|plateau|cueva|grotte|caverne|tunel|tunnel|islas|iles/u.test(normalized)) return 3;
  if (/montana|montagne/u.test(normalized)) return 2;
  if (/ruta|route|bosque|bois|foret|bosquet|oculto|cache/u.test(normalized)) return 1;
  return 0;
}
