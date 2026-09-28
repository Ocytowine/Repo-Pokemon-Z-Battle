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

## Import local des cartes

Pour preparer en une seule fois toutes les donnees et les assets necessaires aux
tests locaux :

```powershell
pnpm prepare:local --source "C:\chemin\vers\Pokémon Z V2.12 - Français" --output ".pokemon-z\data"
```

Cette commande enchaine les extractions PBS, runtime, assets et cartes. Elle
memorise le chemin source dans `.pokemon-z/data/local-test.json`, fichier local
ignore par Git. Ensuite, l'Asset Lab et le Battle Sandbox chargent automatiquement
les manifestes et le dossier source au demarrage ; les selecteurs manuels restent
disponibles en secours.

Le premier lancement exige les deux chemins ci-dessus. Les mises a jour suivantes
reutilisent automatiquement cette configuration :

```powershell
pnpm prepare:local
```

Pour ne regenerer que les cartes, leurs trois couches de tuiles, les collisions
directionnelles et les teleportations directes :

```powershell
pnpm extract:maps --source "C:\chemin\vers\Pokémon Z V2.12 - Français" --output ".pokemon-z\data"
```

Les 507 cartes normalisees sont ecrites dans `.pokemon-z/data/maps/`. Le dossier
`map-previews/` contient un SVG de controle par carte : terrain en couleurs,
cases entierement bloquees en noir et departs de teleportation en orange. Le
fichier `map-previews/index.html` permet de les parcourir. Le manifeste et
`world-map-report.json` permettent de verifier les dimensions, les
hashes source et les references entre cartes. Ces fichiers restent locaux et
sont ignores par Git.

Pour ne regenerer que l'AST des evenements et son rapport de couverture :

```powershell
pnpm extract:events --source "C:\chemin\vers\Pokémon Z V2.12 - Français" --output ".pokemon-z\data"
```

Les fichiers `events/MapNNN.json` et `common-events.json` conservent pages,
conditions, graphismes et commandes avec leur index source. Les commandes Ruby ne
sont jamais executees : elles restent marquees `reference-only` pour leur portage
progressif.

L'inventaire des hooks Ruby peut aussi etre regenere seul :

```powershell
pnpm extract:hooks --source "C:\chemin\vers\Pokémon Z V2.12 - Français" --output ".pokemon-z\data"
```

Il regroupe les variantes equivalentes, attribue une famille et une politique
coop, puis produit les actions declaratives du lot de cartes cible. Aucun code
Ruby n'est evalue par cette commande ni par les sandboxes.

## Combat hors ligne

Le paquet `@pokemon-z-battle/battle-engine` fournit le premier noyau de combat
deterministe. Il expose `resolveTurn(state, actions, rng)`, un generateur seedable,
les 19 interactions de type et un catalogue volontairement limite a six attaques.
Le detail du perimetre supporte est documente dans `packages/battle-engine/README.md`.
La couche d'equipe de la phase 6 prend en charge jusqu'a six membres, les
changements volontaires et les remplacements obligatoires apres KO tout en
conservant l'API de duel existante.

## Battle Sandbox

Pour lancer l'interface locale de combat :

```powershell
pnpm sandbox:battle
```

Le sandbox permet de choisir un duel ou un combat local trois contre trois, de
tester les changements et remplacements, de configurer les talents et objets des
Pokemon de tete, puis d'inspecter les evenements et chaque tirage RNG. Les duels
peuvent etre exportes ou importes comme cas de test JSON reproductibles. Il peut
aussi charger les manifestes d'assets et le
dossier local du jeu pour composer une scene, animer les vrais battlers et lire leurs
cris sans copier les fichiers sources. Voir `apps/battle-sandbox/README.md` pour les
hypotheses des presets de niveau 50 et le chargement visuel local.

## Serveur multijoueur local

Le prototype Cloudflare Worker et Durable Object se lance localement avec :

```powershell
corepack pnpm multiplayer:dev
```

Il expose la creation et la jonction de rooms a deux joueurs ainsi qu'un WebSocket
autoritaire. Le protocole v6 gere les equipes de demonstration, les changements,
les remplacements apres K.O., les statuts, talents et objets persistants ainsi que
les intentions de mouvement et les interactions cooperatives overworld. Aucun compte Cloudflare
n'est necessaire pour ce mode local. Voir
`apps/multiplayer-worker/README.md` pour l'API et la commande de deploiement.

Pendant que le Worker local est ouvert, la recette complete a deux clients se lance
dans un second terminal avec :

```powershell
corepack pnpm test:multiplayer:e2e
```

## Overworld Sandbox

Le prototype local de la phase 7 se lance avec :

```powershell
pnpm sandbox:overworld
```

Il ouvre normalement `http://127.0.0.1:5174`. Sans serveur, les fleches ou ZQSD
controlent le joueur 1, et IJKL le joueur 2. Espace et O activent les interactions
placees devant chaque avatar. Avec `pnpm multiplayer:dev` lance dans
un autre terminal, deux pages peuvent creer puis rejoindre la meme room : chacune
ne controle alors que son avatar et recoit le monde autoritaire. Le ticket est
restaure apres rechargement et une coupure du Worker declenche une reconnexion
automatique. Une interaction de rencontre ouvre un panneau de combat autoritaire,
verrouille la carte puis rend le controle avec le resultat persiste. Les deux
cartes actuellement jouables dans ce sandbox restent originales. Les cartes
Pokemon Z sont desormais normalisees localement par l'extracteur, mais leur rendu
avec les vrais tilesets n'est pas encore branche a ce sandbox. L'architecture est documentee dans
`docs/OVERWORLD_ARCHITECTURE.md` et `docs/COOP_ARCHITECTURE.md`.
