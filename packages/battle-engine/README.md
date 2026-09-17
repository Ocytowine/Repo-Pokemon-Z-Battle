# Battle engine

Ce paquet contient le noyau de combat hors ligne de la phase 3. Il ne depend ni du
DOM, ni de Node.js, ni d'un moteur graphique. Son entree principale est :

```ts
resolveTurn(state, actions, rng)
```

L'etat d'entree n'est jamais modifie. Le resultat contient le nouvel etat, les
evenements de domaine et une trace structuree de chaque tirage et calcul.

## Perimetre compatible Pokemon Z v2.12 FR

- ordre par priorite, puis vitesse, puis tirage d'egalite ;
- precision et esquive avec leurs niveaux de statistique ;
- statistiques offensives et defensives avec leurs niveaux ;
- critique standard a 1/16, variance 85–100, STAB et efficacite des 19 types ;
- PP, degats, KO et fin de combat ;
- fonctions d'attaque `000` et `0A5` ;
- catalogue initial : `TACKLE`, `QUICKATTACK`, `SCRATCH`, `WATERGUN`,
  `VINEWHIP` et `SWIFT` (libelles PBS conserves dans le code).

Les talents, objets, climats, statuts, terrains, changements de Pokemon et autres
codes d'effet ne sont pas encore pris en charge. Une attaque non supportee ne peut
pas etre construite comme `BattleMove` sans traitement TypeScript explicite.

Les formules et l'ordre des tirages sont compares aux scripts exportes
`pokebattle-move.rb` et `pokebattle-battle.rb`. `SeededRandom` fournit des parties
reproductibles ; tout objet implementant `RandomSource` peut etre injecte dans les
tests ou un futur protocole reseau.
