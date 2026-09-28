# Battle Sandbox

Interface locale de la phase 4, construite directement sur
`@pokemon-z-battle/battle-engine`.

```powershell
pnpm sandbox:battle
```

Vite affiche l'adresse locale, normalement `http://127.0.0.1:5173`.

## Mode local par equipes

Le selecteur `Mode local` permet de passer du duel a un combat trois contre trois
sans lancer le Worker. Le Pokemon choisi devient le membre de tete et deux presets
distincts completent automatiquement chaque equipe. Les listes d'action proposent
les attaques et changements volontaires ; apres un K.O., elles imposent une reserve
valide avant la reprise du combat.

Les talents et objets deja supportes sont configurables pour les deux Pokemon de
tete et apparaissent sur leur carte. Le changement de configuration est applique
avec `Demarrer / reinitialiser`. Le parcours d'equipe est reproductible avec la
seed pendant la session, mais son export JSON reste desactive pour le moment.

## Mode multijoueur

Lancez le Worker et le sandbox dans deux terminaux :

```powershell
corepack pnpm multiplayer:dev
corepack pnpm sandbox:battle
```

Dans le premier navigateur, utilisez `Créer une room`, puis transmettez le code au
second joueur qui utilise `Rejoindre`. Chaque joueur clique ensuite sur `Je suis
prêt` et ne peut envoyer que l'action de la place qui lui a été attribuée.

Le ticket de reconnexion est conservé dans `sessionStorage` : deux onglets peuvent
donc représenter deux joueurs distincts. Les snapshots, PV, résultats et choix RNG
proviennent exclusivement du Worker ; les assets graphiques restent locaux à
chaque navigateur.

Le combat multijoueur de démonstration utilise trois Pokémon par camp. La bande
d'équipe montre l'actif, les réserves et leurs PV. Pendant un tour, une réserve
consciente peut être choisie à la place d'une attaque ; après le K.O. du Pokémon
actif, le Sandbox limite le choix aux remplaçants valides avant de poursuivre.

Le sandbox propose cinq presets issus des statistiques de base de Pokemon Z v2.12
FR : Bulbasaur, Charmander, Squirtle, Pikachu et Eevee. Leurs statistiques de
combat sont calculees au niveau 50 avec 31 IV, 0 EV et une nature neutre. Seules
les attaques du catalogue minimal du moteur sont proposées. Ce catalogue permet
aussi de tester sommeil, poison, poison grave, brûlure, paralysie, gel, `CADUCO`
et `HEMORRAGIA` ; le statut actif apparaît sur la carte du combattant et dans le
journal de domaine. Pikachu permet aussi de verifier `CHARGEBEAM` et `SANDATTACK` :
les variations de statistiques, y compris leurs plafonds, utilisent le meme
journal. Les activations d'objets de fin de tour utilisent egalement ce journal.

Un export JSON contient :

- la version du format ;
- la seed initiale ;
- les deux especes ;
- leurs talents et objets optionnels ;
- l'index des deux attaques choisies a chaque tour.

L'import valide ces champs puis rejoue toute la sequence avec un nouveau
`SeededRandom`. Il ne fait donc pas confiance a un resultat de degats sauvegarde.
Le format courant est la version 2 ; les anciens exports v1 sont convertis avec
talent et objet vides.

## Assets locaux

Avec une configuration creee par `pnpm prepare:local`, le serveur de developpement
charge automatiquement les manifestes et sert les assets uniquement depuis
`127.0.0.1`. Aucun selecteur n'est alors necessaire apres un redemarrage.

Sans cette configuration, le panneau `Presentation du combat` accepte `asset-manifest.json`,
`pokemon-assets.json` et facultativement `battle-animations.json`, puis demande le
dossier original de Pokemon Z. Cette fonction
necessite un navigateur Chromium recent pour l'API de selection de dossier.

Le sandbox regroupe automatiquement les fichiers `battlebg`, `playerbase` et
`enemybase`, propose les scenes detectees, affiche le battler de dos du joueur et le
battler de face de l'adversaire, anime les bandes de frames et lit les cris. Les
transitions d'attaque, impact, KO et les barres de PV suivent exclusivement les
evenements du moteur. Un rendu generique reste disponible si un manifeste, un
triplet de scene ou un fichier local manque.

Les fichiers du jeu restent locaux et ne sont jamais copies dans le depot. En
mode automatique, le serveur Vite de developpement les expose seulement a
l'application locale ; les requetes distantes ou cross-site sont refusees.

## Presentation des attaques

Les six attaques du catalogue minimal ont une presentation distincte : impact de
charge, lignes de vitesse, griffes, projectile d'eau, liane et etoiles. Un registre
decrit le mouvement de l'attaquant, l'effet, sa couleur, ses particules et sa duree
sans modifier la resolution du combat. Toute future attaque non referencee recoit
un fallback selon son type et sa categorie.

Lorsque `battle-animations.json` est charge, ces six attaques utilisent en priorite
les neuf animations joueur/adversaire normalisees depuis `PkmnAnimations.rxdata`,
leurs planches de cellules 192 px et leurs sons `PBAnimTiming`. Si une planche, un
son ou une association manque, le registre generique reprend automatiquement la
main.

Les messages de critique et d'efficacite proviennent des evenements de domaine du
moteur. Le bouton reste verrouille pendant la sequence, un reset annule proprement
l'animation et le panneau final conserve le nombre de tours et la seed. Le rythme
peut etre normal ou rapide et les preferences de reduction des mouvements sont
respectees.
