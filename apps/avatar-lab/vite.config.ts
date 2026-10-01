import { defineConfig } from "vite";
import { localPokemonZPlugin } from "../../tools/vite-local-game.mjs";

export default defineConfig({ plugins: [localPokemonZPlugin()] });
