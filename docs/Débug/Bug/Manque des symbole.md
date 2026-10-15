Titre : il manque des symbole
Description : l'ui de combat est notament les entete de pokemon, sont incomplete, il manque les symbole (pokemon restant / ko, il y sont mais ce ne sont pas les bon), le genre du pokemon
1. Je lance un combat contre un Pokémon sauvage.
2. Je constate que les symboles sont manquants ou incorrects.
Résultat attendu : Les symboles pour les Pokémon restants, les KO et le genre du Pokémon devraient être correctement affichés dans l'interface de combat.
Résultat réel : Les symboles pour les Pokémon restants, les KO et le genre du Pokémon ne sont pas correctement affichés dans l'interface de combat.

Statut au 2026-10-15 : corrigé dans le code, validation manuelle requise. Le HUD
utilise désormais `ballnormal.png`, `ballstatus.PNG` et `ballfainted.png` du jeu
source et affiche le symbole mâle/femelle fourni par l'état du combattant.

Reprise après retour visuel : les six emplacements utilisent une grille fixe avec
un espacement identique. Un Pokémon K.O. conserve `ballfainted.png`, complété par
un fond rouge et une croix blanche afin que son état soit immédiatement lisible.
Validation manuelle toujours requise.
