# Battle engine

Ce paquet contient le noyau de combat hors ligne de la phase 3. Il ne depend ni du
DOM, ni de Node.js, ni d'un moteur graphique. Son entree principale est :

```ts
resolveTurn(state, actions, rng)
```

L'etat d'entree n'est jamais modifie. Le resultat contient le nouvel etat, les
evenements de domaine et une trace structuree de chaque tirage et calcul.
L'evenement `damageApplied` expose aussi `critical` et `effectiveness`, afin que la
presentation puisse afficher ces informations sans lire les traces de diagnostic.

## Perimetre compatible Pokemon Z v2.12 FR

- ordre par priorite, puis vitesse, puis tirage d'egalite ;
- precision et esquive avec leurs niveaux de statistique ;
- statistiques offensives et defensives avec leurs niveaux ;
- critique standard a 1/16, variance 85–100, STAB et efficacite des 19 types ;
- PP, degats, KO et fin de combat ;
- sommeil, poison, poison grave, brulure, paralysie, gel, `CADUCO` et
  `HEMORRAGIA` avec leurs hooks de tour et de calcul ;
- talents `GUTS`, `QUICKFEET`, `MAGICGUARD`, `HUGEPOWER` et `PUREPOWER` ;
- objets tenus `LEFTOVERS`, `BLACKSLUDGE`, `SCOPELENS`, `MUSCLEBAND`,
  `WISEGLASSES` et `ASSAULTVEST` ;
- fonctions d'attaque `000`, `003`, `005`, `006`, `007`, `00A`, `00C`, `0A5`,
  `01C`, `01D`, `01F`, `020`, `042` a `047`, `159` et `906` ;
- catalogue initial : `TACKLE`, `QUICKATTACK`, `SCRATCH`, `WATERGUN`,
  `VINEWHIP`, `SWIFT`, `SLEEPPOWDER`, `POISONPOWDER`, `TOXIC`, `THUNDERWAVE`
  `WILLOWISP`, `ICEBEAM`, `LUZDECADENTE` et `CUT`.

Les autres talents, objets, climats, terrains et codes d'effet ne sont pas encore
pris en charge. Une attaque non supportee ne peut
pas etre construite comme `BattleMove` sans traitement TypeScript explicite.

Les valeurs de ce premier lot suivent les scripts exportes de Pokemon Z : poison
normal a `1/12` des PV max, brulure a `1/16`, attaque physique divisee par deux,
vitesse paralysee divisee par quatre, 25 % d'immobilisation et sommeil initial de
deux a quatre tours. Le compteur du poison grave augmente jusqu'a 15 et revient a
zero lors d'un changement, tandis que le statut reste conserve.

Le gel de Pokemon Z retire `1/16` des PV max par tour et divise par deux les degats
speciaux. `CADUCO` multiplie par `1,5` les degats recus sous la moitie des PV ;
`HEMORRAGIA` ajoute deux niveaux au taux de critique. Les premiers hooks de talent
couvrent attaque, vitesse et prevention des degats indirects. Les hooks suivants
doublent l'attaque physique avec `HUGEPOWER`/`PUREPOWER`. Les objets couvrent
critique, soin, degats de fin de tour, bonus physique/special et la hausse de
Defense Speciale avec interdiction des capacites de statut de `ASSAULTVEST`.

Les fonctions `01C`, `01D`, `01F` et `020` augmentent respectivement l'Attaque,
la Defense, la Vitesse et l'Attaque Speciale du lanceur. Les fonctions `042` a
`047` diminuent respectivement l'Attaque, la Defense, la Vitesse, l'Attaque
Speciale, la Defense Speciale et la Precision de la cible. Les effets secondaires
utilisent leur probabilite PBS et tous les niveaux sont bornes entre -6 et +6.

Les formules et l'ordre des tirages sont compares aux scripts exportes
`pokebattle-move.rb` et `pokebattle-battle.rb`. `SeededRandom` fournit des parties
reproductibles ; tout objet implementant `RandomSource` peut etre injecte dans les
tests ou un futur protocole reseau.

## Equipes

La phase 6 ajoute une couche compatible au-dessus du duel historique :

- `createTeamBattleState` construit deux equipes de un a six Pokemon ;
- `activeBattlers` expose les deux combattants actifs ;
- `resolveTeamTurn` accepte une attaque ou un changement pour chaque camp ;
- `replaceFaintedPokemon` traite les remplacements obligatoires sans avancer le tour.

Les changements volontaires sont executes avant les attaques. Les niveaux de
statistiques du Pokemon retire sont remis a zero, tandis que ses PV et PP restent
conserves. Le combat ne se termine que lorsqu'un camp ne possede plus aucun membre
conscient. L'API `BattleState`/`resolveTurn` reste disponible pour le Sandbox et le
prototype multijoueur existants jusqu'a leur migration durant l'increment 6.2.
