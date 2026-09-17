# Analyse de Pokemon Z v2.12 FR

## Statut du document

- Phase : 0 - analyse du jeu source
- Date de l'analyse : 2026-09-17
- Source analysee : `C:\Users\Utilisateur\Desktop\Pokémon Z V2.12 - Français`
- Mode d'analyse : lecture seule
- Fichiers du jeu modifies : aucun

Cette analyse porte sur la distribution francaise disponible localement. Les conclusions marquees **confirme** proviennent directement des fichiers inspectes. Les hypotheses sont explicitement separees des faits.

## Resume executif

Pokemon Z repose sur RPG Maker XP/RGSS1 et une branche ancienne, fortement personnalisee, de Pokemon Essentials. Le jeu est execute avec un runtime MKXP. L'identification RPG Maker XP/RGSS1 est certaine ; le numero exact de la version de Pokemon Essentials n'est pas declare dans les scripts et ne doit pas etre devine.

Le jeu fournit deux niveaux de donnees :

1. des sources texte `PBS/*.txt`, qui sont le meilleur point d'entree pour les Pokemon, attaques, talents, objets, dresseurs, rencontres et metadonnees ;
2. des fichiers compiles `Data/*.dat` et serialises `Data/*.rxdata`, utilises par le jeu a l'execution.

Les cartes, evenements, scripts et animations ne sont pas de simples fichiers texte. Ils utilisent Ruby Marshal 4.8, parfois avec des objets RPG Maker specifiques et des charges binaires compressees avec zlib. Un prototype de lecture en memoire a confirme que `MapInfos.rxdata`, les 507 cartes et `Scripts.rxdata` sont decodables sans lancer ni modifier le jeu.

La Phase 0 est consideree terminee : chaque categorie importante a une source et une strategie de conversion identifiees. Les inconnues restantes sont des points de validation du debut de la Phase 1.

## Empreinte de la distribution analysee

| Ensemble | Fichiers | Taille |
|---|---:|---:|
| `Audio/` | 2 668 | 555 750 960 octets |
| `Data/` | 560 | 54 352 720 octets |
| `Fonts/` | 8 | 222 668 octets |
| `Graphics/` | 15 787 | 277 320 251 octets |
| `PBS/` | 28 | 1 761 375 octets |
| Distribution complete | 19 073 | 906 197 644 octets |

Empreintes de controle principales :

| Fichier | SHA-256 |
|---|---|
| `Game.exe` | `6196fb269072c9968bd5a7f8913973bcda19f5b142a030bc403743199ae71ee6` |
| `Data/Scripts.rxdata` | `cc72bf89af0a599387af0fe0015a1ba2ef61d1f72007f5a82dd0d1cf3ecc9c45` |
| `Data/MapInfos.rxdata` | `9fce296c17b645d25f6dca04b145170aa5034e4d1dfcc12e7282cb13091d2ef9` |
| `Data/PkmnAnimations.rxdata` | `d5887f3f093826ee4d0a3cfeefbb070efeb2d577c21354cb423d3193e7c12b4a` |
| `Data/french.dat` | `9fd26b8da2d43b974e5369c08395853a10b844ade6ab409f804a3ee1f717ca07` |
| `PBS/pokemon.txt` | `9a6f0304c855b1b07e7cae22ad6a6cf7307532e88880bb3744c63ef6e13be16b` |

La Phase 1 devra produire un manifeste SHA-256 complet afin de rendre chaque extraction reproductible.

## Moteur et framework

### Confirme

- `Game.ini` declare `Library=RGSS102E.dll` et `Scripts=Data\Scripts.rxdata`.
- Les donnees RPG Maker portent l'extension `.rxdata` et commencent par l'en-tete Ruby Marshal `04 08`.
- Les objets serialises sont notamment `RPG::Map`, `RPG::MapInfo`, `RPG::Event` et les classes d'evenements RPG Maker XP.
- `mkxp.json` configure le runtime MKXP ; `preload.rb` adapte zlib a MKXP.
- `Scripts.rxdata` contient les familles de classes historiques de Pokemon Essentials : `PokeBattle_*`, `PField_*`, `PItem_*`, `PScreen_*`, `Compiler`, etc.
- Le projet est donc un jeu RPG Maker XP/RGSS1 fonde sur Pokemon Essentials, avec de nombreuses modifications.

### Reste incertain

- Le numero exact de Pokemon Essentials. Aucun `ESSENTIALSVERSION` exploitable n'est declare. La structure des PBS et des scripts correspond a une generation ancienne d'Essentials, probablement anterieure aux formats modernes, mais les modifications accumulees rendent une identification par ressemblance insuffisamment fiable.
- La provenance et la version exacte de l'executable MKXP personnalise.

Ces deux points n'empechent pas l'extraction : les parseurs seront fondes sur les formats reels de cette distribution et non sur un numero de version suppose.

## Inventaire des donnees

### Pokemon

Source principale : `PBS/pokemon.txt`.

- 1 018 sections, numerotees sans trou de 1 a 1 018.
- Champs confirmes : identifiant source, `InternalName`, nom, types, statistiques, EV, taux de capture, bonheur, talents, talent cache, courbe d'experience, experience de base, attaques par niveau, attaques oeuf, groupes d'oeufs, objets sauvages, evolutions, formes, taille, poids, habitat, texte Pokedex et metriques de sprite.
- Les derniers identifiants comprennent des especes recentes et des especes originales du fangame.
- `Data/dexdata.dat`, `Data/eggEmerald.dat`, `Data/evolutions.dat`, `Data/metrics.dat`, `Data/tm.dat` et `Data/regionals.dat` sont des sorties compilees ou des index secondaires.
- `Pokemon_MultipleForms` et `Pokemon_MegaEvolution` dans `Scripts.rxdata` portent une partie importante des regles de formes et mega-evolutions ; ces regles ne sont donc pas entierement presentes dans `pokemon.txt`.

Conversion : parser les sections PBS en premier, conserver l'ID numerique et `InternalName`, puis enrichir les formes, mega-evolutions et comportements speciaux depuis les scripts. Les fichiers `.dat` servent au controle croise, pas de source principale tant que le PBS equivalent existe.

### Attaques

Source principale : `PBS/moves.txt`.

- 730 lignes, IDs de 1 a 731 avec l'ID 601 absent.
- Format CSV historique avec, entre autres : ID, nom interne, nom affiche, code de fonction, puissance, type, categorie, precision, PP, chance d'effet, cible, priorite, drapeaux et description.
- Les implementations sont dans `PokeBattle_Move` et surtout `PokeBattle_MoveEffects`.
- Des codes personnalises sont confirmes, notamment les familles `900` a `942` et `1000` a `1002`.

Conversion : parser le CSV avec un vrai lecteur CSV, conserver le code de fonction original, et produire un registre explicite `functionCode -> implementation`. Une attaque ne doit jamais etre consideree comme completement supportee parce que sa ligne PBS a ete convertie : son code d'effet doit aussi etre classe et porte dans le moteur web.

### Talents

Source principale : `PBS/abilities.txt`.

- 255 talents, IDs continus de 1 a 255.
- La ligne PBS fournit ID, nom interne, nom affiche et description.
- Les effets sont codes dans les scripts de combat, notamment `PokeBattle_Battler`, `PokeBattle_BattlerEffects`, `PokeBattle_Battle`, `PokeBattle_MoveEffects` et `PokeBattle_AI`.
- Plusieurs talents sont propres au fangame ou ont un comportement personnalise.

Conversion : extraire automatiquement les metadonnees, mais etablir un registre d'effets code par code. Les descriptions ne doivent pas etre utilisees comme specification executable.

### Objets

Source principale : `PBS/items.txt`.

- 906 lignes, avec IDs allant jusqu'a 948.
- IDs 571 a 612 et 711 absents.
- L'ID 692 apparait deux fois pour `SASSYMINT`, avec deux descriptions differentes. Le parseur devra signaler ce doublon et appliquer une politique explicite ; il ne devra pas ecraser silencieusement une ligne.
- Les effets se trouvent principalement dans `PItem_Items`, `PItem_ItemEffects`, `PItem_PokeBalls`, ainsi que dans les scripts de mega-evolution et divers scripts personnalises.
- Les icones sont majoritairement dans `Graphics/Icons/itemNNN.png`.

Conversion : parser le CSV, conserver les trous d'ID, emettre une erreur ou un avertissement structure pour les doublons, puis associer separement les effets scripts et les assets.

### Types

Source principale : `PBS/types.txt`.

- 19 sections numerotees de 0 a 18.
- Les 18 types usuels sont presents, ainsi que le pseudo-type historique `QMARKS`.
- Faiblesses, resistances et immunites sont declarees dans le PBS.
- `Data/types.dat` est la version compilee, produite par `pbCompileTypes`.

Conversion : produire une matrice normalisee et valider sa coherence. `QMARKS` doit rester identifiable comme pseudo-type source et ne pas etre confondu avec un type jouable ordinaire.

### Dresseurs

Sources principales :

- `PBS/trainertypes.txt` : 196 types, IDs continus de 0 a 195 ;
- `PBS/trainers.txt` : 477 variantes de dresseurs et 1 295 emplacements de Pokemon dans les equipes ;
- `PBS/trainerlists.txt` et fichiers de Battle Tower/coupes pour les listes annexes.

Les lignes d'equipe contiennent selon les cas niveau, objet, attaques, IV, genre, nature et autres options. Les scripts `PTrainer_NPCTrainers`, `PokeBattle_AI` et les appels places dans les evenements determinent le declenchement et une partie du comportement.

Conversion : parseur avec grammaire correspondant exactement au `Compiler` embarque, index stable par `(trainerType, name, version)`, et validation de toutes les references vers Pokemon, attaques et objets.

### Rencontres

Source principale : `PBS/encounters.txt`.

- 148 blocs de carte ont ete reperes.
- Des rencontres terrestres et de peche sont confirmees ; le parseur doit accepter tous les types definis par le compilateur embarque, sans se limiter aux exemples observes.
- `Data/encounters.dat` est la sortie compilee.

Conversion : parser par ID de carte et methode, conserver l'ordre et les poids implicites des emplacements, puis verifier que chaque ID de carte existe dans `MapInfos.rxdata`.

### Monde, cartes et tilesets

Sources :

- `Data/MapInfos.rxdata` : 507 entrees avec ID, nom, hierarchie et ordre ;
- `Data/Map001.rxdata` a `Data/Map507.rxdata` : contenu de chaque carte ;
- `Data/Tilesets.rxdata` : definitions des tilesets ;
- `Graphics/Tilesets/` : 49 images de tilesets ;
- `Graphics/Autotiles/` : 24 images d'autotiles ;
- `PBS/metadata.txt` et `Data/metadata.dat` : metadonnees globales et par carte ;
- `PBS/townmap.txt` et `Data/townmap.dat` : carte regionale ;
- `PBS/connections.txt` est vide et `Data/connections.dat` ne contient qu'une structure vide de 4 octets.

Chaque `RPG::Map` contient notamment largeur, hauteur, tileset, table de tuiles, audio et table d'evenements. Les tables de tuiles sont des objets binaires RPG Maker `Table` inclus dans Ruby Marshal.

Conversion : decoder Ruby Marshal vers un modele intermediaire RPG Maker, decoder les objets `Table`, puis produire des JSON independants du moteur. Les tuiles devront referencer un manifeste de tilesets ; aucune logique de rendu ne doit entrer dans le convertisseur.

### Evenements

Sources :

- les tables `@events` de chaque `MapNNN.rxdata` ;
- `Data/CommonEvents.rxdata` pour les evenements communs.

Le decodage de toutes les cartes a confirme :

- 12 070 evenements ;
- 18 737 pages d'evenement ;
- environ 181 049 commandes ;
- 12 750 lignes de commandes script (`355`/`655`), dont 2 483 premieres lignes distinctes.

Les commandes comprennent dialogues, deplacements, interrupteurs, variables, teleports, conditions, sons, animations et appels Ruby personnalises comme `pbWildBattle`, `pbAddPokemon`, `pbPokemonFollow` ou des fonctions propres au fangame.

Conversion :

1. convertir automatiquement la structure des evenements et les commandes RPG Maker standard ;
2. conserver toute commande non supportee sous une forme `raw` tracable ;
3. classifier les appels Ruby par signature ;
4. attribuer ensuite la politique coop `PERSONAL`, `SHARED`, `HOST_ONLY` ou `SYNCED` ;
5. porter manuellement les commandes qui appellent une logique Ruby specifique.

Une conversion automatique aveugle des scripts d'evenement vers JavaScript est exclue.

### Scripts personnalises

`Data/Scripts.rxdata` contient 262 sections. Chaque entree est un triplet Ruby Marshal contenant un ID, un nom et une source Ruby compressee avec zlib. L'archive a ete lue en memoire sans lancer le jeu.

Groupes majeurs confirmes :

- coeur RPG Maker : `Game_*`, `Sprite_*`, `Scene_*`, `Interpreter` ;
- coeur Essentials : `PokeBattle_*`, `PField_*`, `PItem_*`, `Pokemon_*`, `PScreen_*`, `Compiler` ;
- extensions graphiques : `Animated Sprites`, `Transiciones`, `Evolucion`, `GIFs`, `Zoom`, `DynamicShadows` ;
- systemes de jeu : `Following`, `Nuzlocke`, `Wonder Trade`, `PokeVial`, `Incubadora`, `Crafteo`, `Dropeo`, `Dexnav`, `Monotype`, `Logros`, `TorreBatalla` ;
- outils et interface : `Pokedex Mejorada`, `Menu Mejorado`, `BagSearcher`, `BetterMoveRelearner`, `Export to Showdown` ;
- correctifs de traduction : sections `BROKE - ...` et `RAZEJIN - ...`.

Les scripts de combat sont fortement modifies. Deux statuts additionnels sont explicitement definis : `CADUCO` et `HEMORRAGIA`. Des attaques, talents, objets, formes et mega-evolutions specifiques sont codes en Ruby.

Conversion : exporter d'abord chaque section vers un fichier Ruby de reference accompagne de son ID et de son hash. Construire ensuite un inventaire des hooks de combat et des fonctions appelees par les evenements. Le Ruby reste une specification de reference ; il ne sera pas execute par le client web.

### Localisation francaise

Sources :

- `Data/french.dat` ;
- `Data/messages.dat` ;
- quelques tables auxiliaires `Data/*_en.txt` ;
- textes directement inclus dans les PBS, cartes et scripts.

`Settings` configure deux entrees identiques `Français -> french.dat`. Les PBS restent partiellement en espagnol ou en anglais alors que l'experience de jeu est francaise. Il faut donc considerer `french.dat` comme une source fonctionnelle importante, et non supposer que les noms affiches du PBS sont les textes definitifs.

Conversion : decoder les fichiers de messages Ruby Marshal, produire des catalogues localises par cle stable, puis etablir et tester une priorite entre traduction compilee et texte PBS. Tous les fichiers PBS inspectes sont des fichiers UTF-8 avec BOM ; les chaines serialisees plus anciennes devront etre decodees prudemment car certaines sources Ruby utilisent un encodage historique.

### Sprites Pokemon et personnages

`Graphics/Battlers/` contient 5 656 fichiers, dont 5 651 suivent une convention numerique. Les IDs couvrent 0 a 1 018, ce qui correspond au placeholder plus les 1 018 especes.

Conventions principales observees :

- `NNN.png` : sprite principal ;
- `NNNb.png` : dos ;
- `NNNs.png` : shiny ;
- `NNNsb.png` : shiny dos ;
- `f`, `fs`, `fb`, `fsb` : variantes femelles ;
- `_N` : variante ou forme.

Une grande partie des battlers ne sont pas des images statiques : ce sont des bandes horizontales d'animation, par exemple `1152x96`, `960x96` ou `1536x96`. Il faudra donc extraire largeur de frame, hauteur et nombre de frames plutot que copier le fichier comme un sprite unique.

`Graphics/Characters/` contient 4 312 fichiers, principalement des planches de personnages et d'overworld. Les noms melangent IDs numeriques de Pokemon, variantes et noms de PNJ ; l'association aux evenements de carte doit etre conservee.

### Icones, animations et autres graphismes

- `Graphics/Icons/` : 2 975 fichiers directs et 3 624 avec `Footprints/` ; 2 094 suivent la convention d'icone Pokemon `iconNNN...` ; les autres comprennent objets et interface.
- `Graphics/Icons/Footprints/` : 649 empreintes.
- `Graphics/Animations/` : 532 fichiers d'effets.
- `Data/PkmnAnimations.rxdata` : 12 790 363 octets, animations de combat Pokemon.
- `Data/Animations.rxdata` : animations RPG Maker.
- `Data/move2anim.dat` : association attaque vers animation.
- `Graphics/Battlebacks/` : 149 images.
- `Graphics/Pictures/` : 1 068 fichiers en incluant les sous-dossiers d'interface et de minijeux.
- `Graphics/Tilesets/` : les images font 256 pixels de large et peuvent depasser 30 000 pixels de haut ; le rendu doit donc decouper les tuiles et tenir compte des limites de texture WebGL.

Conversion : construire un manifeste sans dupliquer les fichiers, extraire les dimensions et conventions, puis creer des descripteurs d'animation. `PkmnAnimations.rxdata` necessite le decodeur Ruby Marshal et la reconstruction des classes `PBAnimations`/`PBAnimation` avant normalisation.

### Audio

- `Audio/BGM/` : 165 fichiers ;
- `Audio/BGS/` : 6 fichiers ;
- `Audio/ME/` : 27 fichiers ;
- `Audio/SE/` : 1 379 fichiers, dont 1 090 cris dans `Audio/SE/Cries/`.

Les formats rencontres sont OGG, WAV et MP3. Les navigateurs n'offrant pas tous les memes garanties de decodage, un manifeste audio et eventuellement une conversion de build seront necessaires. Les sources originales doivent rester intactes.

## Matrice source vers sortie normalisee

| Categorie | Source prioritaire | Source secondaire | Conversion | Automatisation |
|---|---|---|---|---|
| Pokemon | `PBS/pokemon.txt` | scripts de formes, `.dat` | sections PBS vers JSON | forte, sauf comportements de formes |
| Attaques | `PBS/moves.txt` | `PokeBattle_MoveEffects` | CSV vers JSON + registre d'effets | metadonnees oui, effets a porter |
| Talents | `PBS/abilities.txt` | scripts de combat | CSV vers JSON + registre d'effets | metadonnees oui, effets a porter |
| Objets | `PBS/items.txt` | `PItem_*` | CSV vers JSON + validation | metadonnees oui, effets a porter |
| Types | `PBS/types.txt` | `Data/types.dat` | sections vers matrice | complete |
| Dresseurs | `trainertypes.txt`, `trainers.txt` | scripts IA | grammaire du compilateur vers JSON | equipes oui, IA separee |
| Rencontres | `PBS/encounters.txt` | `encounters.dat` | blocs par carte/methode | complete |
| Cartes | `MapInfos.rxdata`, `MapNNN.rxdata` | metadata/tilesets | Ruby Marshal + `Table` vers JSON | structure complete |
| Evenements | objets `RPG::Event` | `CommonEvents.rxdata` | AST de commandes + appels bruts | standard oui, Ruby specifique non |
| Textes FR | `french.dat`, `messages.dat` | PBS/scripts/cartes | Ruby Marshal vers catalogues | a valider au debut de Phase 1 |
| Sprites | `Graphics/*` | metriques PBS | manifeste + dimensions + frames | forte |
| Animations | `.rxdata`, `move2anim.dat`, PNG | scripts graphiques | modele d'animation normalise | partielle |
| Regles de combat | scripts `PokeBattle_*` | PBS | portage TypeScript teste | manuelle et incrementale |

## Strategie d'extraction recommandee

### 1. Ne jamais travailler en place

La CLI recoit un chemin source et un chemin de sortie distincts. Elle refuse toute sortie situee dans le dossier du jeu et n'ecrit jamais dans la source.

### 2. Produire un inventaire avant conversion

Generer `source-manifest.json` avec chemin relatif, taille et SHA-256. L'extraction enregistre l'empreinte de la distribution et la version de chaque schema de sortie.

### 3. Utiliser des lecteurs specialises

- `pbs-reader` : lignes, sections et CSV avec BOM UTF-8 ;
- `ruby-marshal-reader` : graphes Ruby Marshal 4.8, symboles, references et objets ;
- `rpgxp-reader` : `RPG::Map`, `RPG::Event`, commandes, `Table`, tilesets ;
- `scripts-reader` : triplets de scripts et decompression zlib ;
- `asset-indexer` : chemins, dimensions, frames, hash et collisions ;
- `localization-reader` : messages compiles et resolution des textes.

Les lecteurs produisent un modele intermediaire fidele. Les convertisseurs vers le domaine Pokemon ne doivent pas contenir le code binaire de lecture.

### 4. Separer donnees, provenance et support moteur

Chaque entite normalisee doit inclure au minimum :

```json
{
  "id": 25,
  "internalName": "PIKACHU",
  "_source": {
    "game": "Pokemon Z",
    "version": "2.12 FR",
    "file": "PBS/pokemon.txt",
    "sourceId": 25,
    "sourceHash": "..."
  }
}
```

Le schema doit distinguer une donnee extraite d'une mecanique effectivement implementee. Par exemple, une attaque peut etre `extracted: true` mais `engineSupport: unsupported` tant que son code de fonction n'est pas porte.

### 5. Valider avant d'ecrire les sorties

Controles minimaux : IDs dupliques, references inexistantes, formes sans asset, sprites orphelins, types inconnus, attaques sans code d'effet, dresseurs invalides, cartes manquantes et commandes d'evenement non reconnues.

### 6. Generer des rapports de couverture

Chaque execution doit produire :

- nombre d'entites lues/ecrites ;
- avertissements et erreurs ;
- codes d'effets rencontres ;
- commandes d'evenement supportees/non supportees ;
- assets associes/orphelins ;
- conflits de localisation.

## Arborescence conseillee pour la Phase 1

```text
tools/pokemon-z-extractor/
|-- src/
|   |-- cli/
|   |-- inventory/
|   |-- readers/
|   |   |-- pbs/
|   |   |-- ruby-marshal/
|   |   `-- rpgxp/
|   |-- converters/
|   |-- validators/
|   `-- reports/
|-- fixtures/
`-- tests/

packages/game-data/
|-- schemas/
|-- generated/
`-- manifests/
```

Les fixtures devront etre de petits objets synthetiques ou des extraits dont la redistribution est autorisee. Le jeu complet et ses assets ne doivent pas entrer dans Git.

## Ce qui est compris et confirme

- moteur RPG Maker XP/RGSS1 et runtime MKXP ;
- format Ruby Marshal 4.8 des `.rxdata` ;
- compression zlib des sources dans `Scripts.rxdata` ;
- emplacement de toutes les grandes categories de donnees ;
- schemas PBS historiques et routines de compilation embarquees ;
- structure des cartes, evenements et commandes ;
- conventions principales des battlers, icones et cris ;
- existence d'une localisation francaise compilee ;
- presence de nombreuses mecaniques specifiques dans les scripts Ruby.

## Ce qui reste incertain

- numero exact de la branche Pokemon Essentials ;
- semantique complete de chaque suffixe graphique atypique ;
- schema normalise final des formes complexes et mega-evolutions ;
- details de `PBAnimations` et couverture exacte de `move2anim.dat` ;
- regle de priorite definitive entre textes PBS et catalogues francais ;
- comportement exact de chaque attaque, talent, objet et appel Ruby personnalise.

Ces incertitudes seront traitees par des tests cibles pendant la Phase 1, sans developper encore le moteur de combat ou le multijoueur.

## Risques principaux

1. **Confondre donnees et comportement** : les PBS decrivent les entites, mais les effets sont dans Ruby.
2. **Perdre les IDs historiques** : ils sont utilises par les assets et les donnees compilees.
3. **Ecraser des anomalies source** : doublons et trous doivent etre signales, pas corriges silencieusement.
4. **Rater la localisation active** : les PBS ne refletent pas seuls les textes francais vus en jeu.
5. **Sous-estimer les evenements** : des milliers d'appels Ruby imposent une migration incrementale.
6. **Traiter les sprites comme statiques** : de nombreux battlers sont des bandes animees.
7. **Publier des fichiers proteges** : donnees et assets du fangame doivent rester locaux tant que les droits de redistribution ne sont pas etablis.

## Decision de fin de Phase 0

La Phase 0 est validee pour demarrer un extracteur minimal portant d'abord sur :

1. inventaire et empreintes ;
2. types ;
3. Pokemon ;
4. attaques ;
5. talents ;
6. objets ;
7. rapports de validation.

Les cartes, evenements, animations et le portage des regles de combat resteront hors du premier increment de l'extracteur.
