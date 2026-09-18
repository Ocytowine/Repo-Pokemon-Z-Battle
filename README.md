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

## Extraction des PBS

```powershell
pnpm extract:pbs --source "C:\chemin\vers\Pokémon Z V2.12 - Français" --output ".pokemon-z\data"
```

Cette commande produit huit jeux de donnees (`types`, `pokemon`, `moves`, `abilities`,
`items`, `trainer-types`, `trainers` et `encounters`) ainsi que trois rapports de
controle. Les sorties sont deterministes, restent locales et sont ignorees par Git.

## Extraction Ruby Marshal et localisation

Apres l'extraction PBS, la commande suivante decode les catalogues compiles, les
informations de carte et les scripts Ruby :

```powershell
pnpm extract:runtime --source "C:\chemin\vers\Pokémon Z V2.12 - Français" --output ".pokemon-z\data"
```

Elle produit le catalogue francais et son rapport de conflits, les 507 informations
de carte, un manifeste de 262 scripts et `battle-animations.json` pour les attaques
prises en charge par le sandbox. Les sources Ruby sont decomprimees
dans `.pokemon-z/data/scripts/` uniquement comme references : elles ne sont jamais
executees par le produit web.

## Assets et page de contrôle

Après les extractions de données :

```powershell
pnpm extract:assets --source "C:\chemin\vers\Pokémon Z V2.12 - Français" --output ".pokemon-z\data"
pnpm preview:assets
```

Ouvrez ensuite `http://127.0.0.1:4173`, chargez `asset-manifest.json` et
`pokemon-assets.json`, puis sélectionnez le dossier source du jeu. Le navigateur lit
les images et les cris localement ; aucun asset n'est copié dans le dépôt.

Voir `docs/POKEMON_Z_ANALYSIS.md` pour l'analyse de la distribution, `docs/DATA_FORMAT.md` pour les schemas normalises et `docs/ROADMAP.md` pour les phases du projet.

## Combat hors ligne

Le paquet `@pokemon-z-battle/battle-engine` fournit le premier noyau de combat
deterministe. Il expose `resolveTurn(state, actions, rng)`, un generateur seedable,
les 19 interactions de type et un catalogue volontairement limite a six attaques.
Le detail du perimetre supporte est documente dans `packages/battle-engine/README.md`.

## Battle Sandbox

Pour lancer l'interface locale de combat :

```powershell
pnpm sandbox:battle
```

Le sandbox permet de choisir deux Pokemon, de resoudre leurs actions tour par tour,
d'inspecter les evenements et chaque tirage RNG, puis d'exporter ou importer un cas
de test JSON reproductible. Il peut aussi charger les deux manifestes d'assets et le
dossier local du jeu pour composer une scene, animer les vrais battlers et lire leurs
cris sans copier les fichiers sources. Voir `apps/battle-sandbox/README.md` pour les
hypotheses des presets de niveau 50 et le chargement visuel local.

## Serveur multijoueur local

Le prototype Cloudflare Worker et Durable Object se lance localement avec :

```powershell
corepack pnpm multiplayer:dev
```

Il expose la creation et la jonction de rooms a deux joueurs ainsi qu'un WebSocket
autoritaire. Aucun compte Cloudflare n'est necessaire pour ce mode local. Voir
`apps/multiplayer-worker/README.md` pour l'API et la commande de deploiement.
