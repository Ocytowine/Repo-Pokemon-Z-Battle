# Pokemon Z-Battle

Pokemon Z-Battle est un nouveau moteur web destine a interpreter, sans les modifier, les donnees locales de Pokemon Z v2.12 FR.

Le jeu source et ses assets ne doivent jamais etre ajoutes a ce depot.

## Prerequis

- Node.js 22 ou plus recent
- pnpm 10 ou plus recent

## Installation

```powershell
pnpm install
```

## Inventaire en lecture seule

La commande suivante lit le jeu source et ecrit uniquement un manifeste dans le dossier de sortie :

```powershell
pnpm inventory --source "C:\chemin\vers\Pokémon Z V2.12 - Français" --output ".pokemon-z\inventory"
```

Le dossier de sortie ne peut pas etre le dossier source, ni se trouver a l'interieur de celui-ci. Le manifeste ne contient pas le chemin absolu local.

## Verification

```powershell
pnpm typecheck
pnpm test
pnpm build
```

Voir `docs/POKEMON_Z_ANALYSIS.md` pour l'analyse de la distribution et `docs/ROADMAP.md` pour les phases du projet.
