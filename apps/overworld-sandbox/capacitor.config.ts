import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "fr.ocytowine.pokemonzbattle",
  appName: "Pokemon Z-Battle",
  webDir: "dist",
  plugins: {
    SystemBars: {
      hidden: true,
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;
