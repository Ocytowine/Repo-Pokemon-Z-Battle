# Format des donnees normalisees

## Statut

- Version de schema : `1.0.0`
- Producteur : `@pokemon-z-battle/extractor` 0.1.0
- Source actuelle : Pokemon Z 2.12 FR
- Perimetre : Phase 1.4, donnees PBS de base, dresseurs et rencontres
- Extension runtime : Phase 1.5, Ruby Marshal 4.8 et localisation

Les types TypeScript de reference se trouvent dans `packages/game-data/src/index.ts`.

## Fichiers produits

La commande `pnpm extract:pbs` produit :

| Fichier | Contenu |
|---|---|
| `types.json` | types, faiblesses, resistances et immunites |
| `pokemon.json` | especes et proprietes PBS |
| `moves.json` | attaques et codes de fonction source |
| `abilities.json` | talents et descriptions |
| `items.json` | objets et proprietes d'utilisation |
| `trainer-types.json` | types de dresseurs, musiques, genre et niveau d'IA |
| `trainers.json` | variantes de dresseurs, objets et membres d'equipe |
| `encounters.json` | rencontres par carte, methode et emplacement pondere |
| `extraction-report.json` | compteurs, trous et doublons |
| `validation-report.json` | references, collisions, orphelins provisoires et comparaison compilee |
| `engine-support-report.json` | couverture explicite des mecaniques par le futur moteur |
| `localization.json` | catalogue francais resolu avec provenance par texte |
| `localization-report.json` | priorites, compteurs et conflits de traduction |
| `map-infos.json` | 507 objets `RPG::MapInfo` normalises |
| `scripts-manifest.json` | index, noms et hashes des 262 scripts Ruby |
| `runtime-report.json` | controle Marshal, cartes, localisation et charge `Table` |
| `scripts/*.rb` | scripts decomprimes de reference, jamais executes |
| `asset-manifest.json` | index physique des graphismes et sons, dimensions et hashes |
| `pokemon-assets.json` | associations par Pokemon et par variante |
| `asset-report.json` | doublons, couverture, anomalies et plans de tilesets |

Ces fichiers sont generes localement sous `.pokemon-z/data/` et ne sont pas suivis par Git.

## Enveloppe commune

Chaque jeu de donnees utilise la meme enveloppe :

```json
{
  "schemaVersion": "1.0.0",
  "kind": "pokemon",
  "source": {
    "game": "Pokemon Z",
    "version": "2.12 FR",
    "file": "PBS/pokemon.txt",
    "sha256": "..."
  },
  "count": 1018,
  "records": []
}
```

Le chemin absolu de l'installation n'est jamais enregistre.

## Provenance d'une entite

Chaque entite possede une provenance locale :

```json
{
  "_source": {
    "game": "Pokemon Z",
    "version": "2.12 FR",
    "file": "PBS/pokemon.txt",
    "sourceId": 25,
    "line": 662
  }
}
```

Les proprietes `raw` conservent les champs PBS avant interpretation. Elles permettent de diagnostiquer une erreur de conversion sans rouvrir immediatement le fichier source.

## Statistiques Pokemon

Le format source utilise l'ordre historique de cette version de Pokemon Essentials :

```text
PV, Attaque, Defense, Vitesse, Attaque Speciale, Defense Speciale
```

La sortie remplace cet ordre implicite par des noms :

```json
{
  "baseStats": {
    "hp": 45,
    "attack": 65,
    "defense": 40,
    "speed": 90,
    "specialAttack": 50,
    "specialDefense": 50
  }
}
```

Le meme mapping est applique aux EV accordes par `EffortPoints`.

## Attaques

`functionCode` et `targetCode` restent des chaines afin de conserver les zeros initiaux et les codes hexadecimaux historiques :

```json
{
  "functionCode": "0A5",
  "targetCode": "00"
}
```

La presence d'une attaque dans `moves.json` signifie qu'elle est extraite, pas que son effet est deja implemente par le futur moteur de combat.

## Pokemon

Les listes alternees du PBS sont converties en objets explicites :

```json
{
  "levelUpMoves": [
    { "level": 1, "move": "TACKLE" }
  ],
  "evolutions": [
    {
      "species": "IVYSAUR",
      "method": "Level",
      "parameter": "18"
    }
  ]
}
```

Un `Type2` absent ou identique a `Type1` produit une liste `types` a un element. Les formes et mega-evolutions codees uniquement dans les scripts Ruby ne sont pas encore integrees a ce stade.

## Objets

Le dernier champ des objets, correspondant a l'attaque d'une machine, est optionnel dans la distribution. Les lignes PBS a 10 et 11 colonnes sont donc acceptees. Une absence devient :

```json
{
  "machineMove": null
}
```

## Dresseurs

Une variante est identifiee de facon stable par le triplet type, nom et version.
La propriete `internalName` contient la serialisation JSON de ce triplet, par
exemple `["CRISANTO1","Crisanto",1]`. Les objets utilisables par le dresseur sont
separes des objets portes par ses Pokemon.

Chaque membre d'equipe expose les options historiques du compilateur embarque :

- espece et niveau ;
- objet porte et quatre emplacements d'attaque, y compris les emplacements vides ;
- index de talent, genre et forme ;
- chromatique, nature, IV, bonheur et surnom ;
- options Pokemon obscur et Ball, si elles sont presentes.

La ligne CSV complete reste disponible dans `raw`. Les trois valeurs `F` trouvees
dans la source sont normalisees en `Female`, sans perdre leur representation brute.
Les 477 variantes contiennent 1 295 membres, 121 objets de sac, 520 objets portes et
2 583 attaques explicites.

## Rencontres

`encounters.json` conserve pour chaque bloc l'ID et le nom de carte, les trois taux
historiques (terre, grotte, eau), les methodes et l'ordre exact des emplacements.
Les poids implicites connus du compilateur sont rendus explicites. Une methode
inconnue reste chargeable avec un poids `null`, ce qui permet de conserver une
extension sans inventer sa distribution de probabilite.

La distribution utilise uniquement `Land` et `OldRod` : 149 blocs source,
148 cartes uniques, 209 tables et 1 778 emplacements. La carte 51 est repetee a
l'identique aux lignes 551 et 570. Les deux blocs sont preserves et le doublon est
signale dans les rapports, plutot que fusionne silencieusement.
Chaque ID est aussi controle contre la presence de son fichier `Data/MapXXX.rxdata`.
Le contenu de `MapInfos.rxdata` sera controle lorsque le lecteur Marshal de
l'increment 1.5 sera disponible.

## Rapport d'extraction

Le rapport ne corrige pas les donnees source. Il expose :

- nombre total d'enregistrements ;
- nombre d'IDs uniques ;
- ID minimum et maximum ;
- IDs manquants ;
- IDs dupliques ;
- noms internes dupliques ;
- lignes sources concernees.

Anomalies confirmees en Phase 1.2 :

- attaque ID 601 absente ;
- `SECRETSWORD` sous les IDs 95 et 728 ;
- objets 571 a 612 et 711 absents ;
- objet ID 692 present deux fois ;
- `SASSYMINT` present deux fois aux lignes 658 et 659.
- bloc de rencontres de la carte 51 present deux fois aux lignes 551 et 570.

Ces anomalies sont conservees comme donnees a arbitrer. Aucune entree n'est supprimee ou fusionnee automatiquement.

## Validation croisee

`validation-report.json` controle les relations suivantes :

- faiblesses, resistances et immunites vers les types ;
- type de chaque attaque ;
- types, talents et attaques de chaque Pokemon ;
- objets sauvages et encens ;
- espece cible, methode et parametre de chaque evolution ;
- attaque associee aux objets machines.
- type de chaque dresseur ;
- especes, objets de sac, objets portes et attaques explicites des equipes ;
- especes de chaque emplacement de rencontre.
- fichier de carte correspondant a chaque bloc de rencontre.

Les parametres d'evolution sont interpretes selon la table `PBEvolution::EVOPARAM` extraite des scripts du jeu. Le validateur distingue les parametres numeriques et les references vers un objet, une attaque, une espece ou un type.

Resultat apres la Phase 1.4 :

- 33 224 references controlees ;
- 33 222 references valides et non ambigues ;
- aucune reference vers une definition absente ;
- deux references ambigues a `SECRETSWORD`, pour Samurott et Keldeo ;
- cinq collisions de definition : `SECRETSWORD`, ID objet 692, `SASSYMINT`, et
  les deux index (`id` et `internalName`) du bloc duplique pour la carte 51 ;
- aucune divergence entre les 730 attaques PBS et `Data/moves.dat` ;
- taille et nombre d'enregistrements coherents entre les 1 018 Pokemon et `Data/dexdata.dat`.

`Constants.rxdata` contient successivement `SECRETSWORD=95` puis `SECRETSWORD=728`. Le runtime Ruby utilise donc vraisemblablement la derniere affectation, mais l'extracteur ne choisit pas silencieusement l'ID 728 : la collision reste visible jusqu'a l'adoption d'une regle de resolution documentee.

La liste `unreferencedDefinitions` est volontairement marquee provisoire. Elle
connait maintenant les dresseurs et les rencontres, mais pas encore `tm.txt`, les
formes codees en Ruby ni les evenements de carte. Une definition non referencee a
ce stade n'est donc pas consideree comme inutilisable.

## Extraction et support moteur

`engine-support-report.json` empeche de confondre deux notions :

- la mecanique a ete identifiee et extraite ;
- la mecanique est effectivement implementee dans le moteur TypeScript.

Le rapport actuel recense 651 cles mecaniques :

- 19 interactions de type ;
- 353 codes de fonction d'attaque utilises ;
- 255 talents ;
- 6 types d'objet ;
- 18 methodes d'evolution utilisees.

Depuis la phase 3, le rapport porte `engineState: "in-development"`. Les 19 types
et les codes d'effet d'attaque `000`, `003`, `005`, `006`, `007`, `00A`, `00C`,
`01C`, `01D`, `01F`, `020`, `042` a `047`, `0A5`, `159` et `906`
portent `engineSupport: "supported"` ;
les talents `GUTS`, `HUGEPOWER`, `MAGICGUARD`, `PUREPOWER` et `QUICKFEET` sont
egalement `supported`. Le type d'objet tenu `0` est marque `partial`, car seuls
`LEFTOVERS`, `BLACKSLUDGE`, `SCOPELENS`, `MUSCLEBAND`, `WISEGLASSES` et
`ASSAULTVEST` sont portes. Les autres entrees restent `not-implemented`. Sur les
donnees completes, cela represente 44 cles prises en charge sur 651, plus une
categorie partielle. Ce statut decrit le noyau TypeScript et ne modifie pas les
donnees extraites.

## Ruby Marshal 4.8

Le lecteur TypeScript prend en charge les entiers, grands entiers, flottants,
chaines, symboles, tableaux, hashes, structures, objets, expressions regulieres,
classes, modules, charges utilisateur et wrappers d'instance. Les tables de
symboles et d'objets sont conservees : deux references Ruby vers le meme objet
restent identiques et les graphes cycliques sont acceptes.
Les flottants Ruby 1.8 contenant une mantisse binaire apres un octet nul sont lus
depuis leur prefixe decimal portable. Les variables d'instance portees par une
classe derivee d'`Array`, comme `PBAnimations` et `PBAnimation`, sont conservees.

Les charges utilisateur `Table` de RPG Maker XP sont decodees en dimensions,
tailles et valeurs `int16`. Le controle reel utilise `Data/Map001.rxdata`, dont la
table fait `20 x 15 x 3`, soit 900 valeurs. `MapInfos.rxdata` produit 507 entrees et
confirme que toutes les cartes des rencontres existent.

## Localisation

Les 24 categories de `messages.dat` et `french.dat` sont fusionnees selon une
priorite stable :

1. traduction non nulle de `Data/french.dat` ;
2. texte de base de `Data/messages.dat` ;
3. texte PBS si les deux catalogues compiles sont absents.

Une chaine vide explicite est conservee et n'est pas confondue avec une traduction
absente. Chaque entree de `localization.json` indique le fichier et le chemin de sa
valeur retenue. Les dialogues de carte ajoutent l'ID de carte comme contexte.

Le catalogue contient 30 726 textes : 29 492 viennent de `french.dat` et 1 234 sont
des replis vers `messages.dat`. Aucun repli PBS n'est necessaire dans cette version.
Le rapport conserve 23 296 differences traduction/source et 7 668 differences
compile/PBS. Ces differences sont des arbitrages documentes, pas des erreurs de
decodage.

## Scripts Ruby de reference

Les 262 triplets de `Scripts.rxdata` sont decomprimes avec zlib. Chaque entree du
manifeste conserve son index, son ID Ruby, son nom, son chemin relatif, la taille et
les SHA-256 compresse/decompresse. La politique `reference-only` interdit de traiter
leur presence comme une implementation JavaScript ou de les executer dans le client.

## Animations de combat

`battle-animations.json` croise les 730 attaques normalisees avec les deux tables
de `Data/move2anim.dat` (joueur et adversaire). Pour l'increment 4.2, les neuf
animations distinctes des six attaques supportees sont developpees depuis
`Data/PkmnAnimations.rxdata`.

Chaque animation conserve son index, son nom, sa planche sous
`Graphics/Animations/`, ses frames, ses cellules non nulles et ses timings. Les 27
positions implicites d'une cellule Ruby deviennent des champs nommes : coordonnees,
zoom, angle, miroir, mode de fusion, visibilite, motif, opacite, priorite et focus.
Le repere source fait `512 x 384`, une cellule de planche fait 192 pixels et les
planches ont cinq colonnes. Le lecteur web joue les frames a 20 images/seconde.
Les motifs `-1` et `-2` representent respectivement les deux battlers. Les autres
motifs decoupent la planche ; leur priorite determine le calque Canvas place derriere
ou devant les Pokemon. Une animation adverse absente reutilise la variante joueur
en inversant la ligne historique `(128,224) -> (384,96)`.

Cette sortie ne pretend pas encore supporter toutes les animations indexees. Une
association non developpee reste dans `mappings`, mais son contenu graphique n'est
pas duplique dans `animations`; le sandbox utilise alors son effet generique.

## Animations de carte

`map-animations.json` normalise les 100 entrees de `Data/Animations.rxdata`. Chaque
animation conserve son ID RPG Maker, sa planche sous `Graphics/Animations/`, sa
position par rapport au personnage cible, ses cellules et ses timings sonores ou
lumineux. Une cellule expose motif, coordonnees, zoom, angle, miroir, opacite et
mode de fusion ; les planches utilisent des cellules de 192 pixels sur cinq
colonnes et sont lues a 20 images/seconde.

Les commandes `show-animation` referencent ce catalogue par ID. La cible `-1`
represente le joueur, `0` l'evenement courant et une valeur positive l'evenement de
ce numero. Les entrees reservees sans planche restent presentes afin de conserver
les IDs source, sans inventer d'asset.

## Manifeste des assets

`asset-manifest.json` indexe les 18 455 fichiers de `Graphics/` et `Audio/`, sans les
copier. Chaque entree conserve le chemin source relatif, un chemin Web normalise en
NFC avec separateurs `/` et casse minuscule, la taille, le SHA-256, le format et la
categorie. Les images exposent leurs dimensions sans decodage complet des pixels.

Les contenus identiques sont regroupes par SHA-256. Le premier chemin trie devient
canonique ; chaque copie indique `duplicateOf`. La distribution contient 16 545
contenus uniques et 1 910 fichiers dupliques, soit 21 044 113 octets de contenu
repete. Aucun fichier source n'est supprime ou remplace.

Deux fichiers avec extension PNG sont en realite des GIF et restent signales :

- `Graphics/Battlers/131s_1.png` ;
- `Graphics/Battlers/131sb_1.png`.

Le format effectif est detecte par signature, ce qui permet malgré tout de lire
leurs dimensions sans masquer l'anomalie d'extension.

## Associations Pokemon

`pokemon-assets.json` associe les chemins aux 1 018 especes et conserve :

- famille : battler, icone, empreinte, cri ou overworld ;
- vue de face ou de dos ;
- shiny et variante femelle ;
- numero de forme ;
- variantes nommees historiques comme `egg` et `shadow` ;
- dimensions et nombre de frames lorsque disponibles.

Les 1 018 Pokemon ont un battler, une icone, un cri et un overworld. Les 649
empreintes presentes sont associees. Les cinq fichiers d'ID `000` sont declares
comme placeholders. Aucun fichier suivant une convention Pokemon ne reste non
classe et aucune association ne pointe hors des IDs connus.

Les bandes horizontales de battlers sont reconnues quand leur largeur est un
multiple entier de leur hauteur. Le frame est alors carre, avec un nombre explicite
d'images. 5 642 fichiers suivent cette convention ; les fichiers atypiques restent
des images simples au lieu de recevoir un decoupage estime.

## Tilesets et WebGL

Les 49 tilesets ont un plan de rectangles source alignes sur des tuiles de 32 pixels.
La hauteur maximale d'un rectangle est 4 096 pixels. Quarante-huit tilesets
necessitent plusieurs rectangles ; le plus haut mesure 31 236 pixels. Ce plan ne
duplique pas les PNG et pourra alimenter une conversion ou un chargement Canvas au
moment du build du client.

## Cartes statiques

`pnpm extract:maps` lit `MapInfos.rxdata`, `Tilesets.rxdata` et les 507 fichiers
`MapNNN.rxdata`. Il produit localement :

- `tilesets.json`, avec les noms de planches et d'autotiles ainsi que les tables
  de passage, de priorite et de terrain ;
- `world-map-manifest.json`, index leger des cartes et de leur provenance ;
- `maps/MapNNN.json`, avec les trois couches de tuiles, les collisions et les
  transferts directs ;
- `map-previews/index.html` et `MapNNN.svg`, galerie de controle sans copie des images source ;
- `world-map-report.json`, bilan des references et des volumes importes.

Les tableaux de couches utilisent l'ordre RPG Maker XP : `x` varie en premier,
puis `y`. Le masque de collision d'une case emploie les bits `1` bas, `2` gauche,
`4` droite et `8` haut ; un bit present signifie que la direction est autorisee.
Le calcul parcourt les couches du dessus vers le dessous et utilise la priorite
pour determiner si la couche suivante doit etre consultee. Le moteur de mouvement devra verifier a la fois la
sortie de la case courante et l'entree opposee de la case cible.
Ce masque de base ne tient pas encore compte des evenements mobiles, du surf, du
velo ni de l'etat dynamique des ponts ; ces regles restent explicitement hors du
perimetre `base-tiles-only` et seront raccordees avec les evenements de 9.2.

Une teleportation simple correspond a la commande RPG Maker `201` en adressage
direct. Elle conserve l'evenement, sa position, la page et l'index de commande,
ainsi que la carte et les coordonnees cibles. Les variantes utilisant des
variables seront traitees avec les evenements standard de l'increment 9.2.

## AST des evenements

`pnpm extract:events` produit un fichier `events/MapNNN.json` pour chaque carte,
`common-events.json`, `event-manifest.json` et `event-coverage-report.json`. Chaque
carte conserve son fichier et son SHA-256 source ; chaque commande conserve son
code RPG Maker, son indentation et son index dans la page. La page contient les
conditions d'activation, le graphique, les reglages de mouvement et le trigger.

L'AST utilise trois statuts :

- `converted` : commande RPG Maker standard normalisee ;
- `reference-only` : Ruby ou script de mouvement conserve textuellement mais
  interdit d'execution ;
- `raw` : commande inconnue conservee avec ses parametres et sa provenance.

Les dialogues et choix, interrupteurs globaux et locaux, variables, conditions,
routes de mouvement, transferts, defilements, transitions visuelles et commandes
audio ont des noms independants de Ruby. Les valeurs binaires `Tone` et `Color`
sont developpees en composantes numeriques. Les routes exposent chaque pas et
signalent individuellement les appels Ruby.

Sur Pokemon Z v2.12 FR, les 507 cartes contiennent 12 070 evenements et 18 737
pages. Avec les 100 evenements communs, 188 037 commandes sont inventoriees :
170 199 sont converties (90,51 %), 17 838 restent `reference-only` et aucune ne
tombe en `raw`. Ce pourcentage mesure la conversion de format, pas encore
l'execution dans le moteur overworld.

## Hooks Ruby specifiques

`pnpm extract:hooks` inspecte les lignes `355` et `655` sans jamais les evaluer.
Les sorties locales sont :

- `script-hook-catalog.json`, signatures exactes et groupes normalises ;
- `script-hook-policies.json`, famille, politique coop et justification ;
- `ported-script-hooks.json`, actions declaratives du lot cible avec provenance ;
- `script-hook-report.json`, volumes et couverture du lot.

La normalisation remplace les nombres, chaines, symboles et constantes Pokemon par
des marqueurs types. Elle regroupe ainsi, par exemple, les appels `pbItemBall`
qui ne different que par l'objet. Le texte original et des localisations source
restent presents dans le catalogue ; la normalisation n'est jamais utilisee comme
code executable.

Les 12 750 lignes script des cartes possedent exactement 2 483 signatures
distinctes et deviennent 222 groupes parametres. Les evenements communs ajoutent
2 899 lignes. Les conditions Ruby et scripts de mouvement sont comptes separement.

Le premier lot cible est `Map001 - Intro`. Ses 15 occurrences sont traduites en
cinq actions declaratives : choix d'avatar, saisie du nom, tonalite d'ecran,
difficulte et mode Nuzlocke. Ces actions restent des donnees ; leur branchement a
l'interface et a l'etat autoritaire sera realise avec l'execution des cartes.

Sur Pokemon Z v2.12 FR, le rapport contient 507 cartes, 50 enregistrements de
tileset, 1 058 059 cases et 2 613 transferts directs. Aucun fichier de carte ne
manque et aucune destination de transfert n'est invalide. Les 49 planches de
tileset graphiques mentionnees plus haut sont distinctes des 50 enregistrements
de configuration : un enregistrement peut ne pas apporter de planche autonome.

## Asset Lab

`apps/asset-preview/index.html` est une page de controle locale. Elle charge les deux
manifestes via un selecteur de fichiers, puis demande le dossier du jeu avec l'API
File System Access. Elle affiche les variantes, anime les bandes de battlers frame
par frame et permet d'ecouter les cris. Les assets restent hors du serveur HTTP et
ne quittent pas la machine.

## Determinisme

Les sorties n'incluent ni date de generation, ni chemin absolu, ni ordre dependant du systeme. Deux extractions de la meme version source doivent produire les memes octets. Toute evolution volontaire du format necessite une nouvelle valeur de `schemaVersion`.
