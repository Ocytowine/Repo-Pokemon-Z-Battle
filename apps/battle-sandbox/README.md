# Battle Sandbox

Interface locale de la phase 4, construite directement sur
`@pokemon-z-battle/battle-engine`.

```powershell
pnpm sandbox:battle
```

Vite affiche l'adresse locale, normalement `http://127.0.0.1:5173`.

Le sandbox propose cinq presets issus des statistiques de base de Pokemon Z v2.12
FR : Bulbasaur, Charmander, Squirtle, Pikachu et Eevee. Leurs statistiques de
combat sont calculees au niveau 50 avec 31 IV, 0 EV et une nature neutre. Seules
les attaques du catalogue minimal du moteur sont proposées.

Un export JSON contient :

- la version du format ;
- la seed initiale ;
- les deux especes ;
- l'index des deux attaques choisies a chaque tour.

L'import valide ces champs puis rejoue toute la sequence avec un nouveau
`SeededRandom`. Il ne fait donc pas confiance a un resultat de degats sauvegarde.
