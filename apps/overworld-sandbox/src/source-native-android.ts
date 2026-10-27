export interface SourceAndroidSystemBars {
  hide(): Promise<void>;
}

/** Le mode immersif natif reste optionnel et ne doit jamais bloquer le jeu. */
export async function hideSourceAndroidSystemBars(systemBars: SourceAndroidSystemBars): Promise<boolean> {
  try {
    await systemBars.hide();
    return true;
  } catch {
    return false;
  }
}
