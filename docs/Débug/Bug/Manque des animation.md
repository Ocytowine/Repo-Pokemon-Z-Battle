Titre : Manque des animations lors d'attaque
Description : Certaine attaques n'ont pas d'animation lors de leur utilisation, ce qui peut rendre le combat moins immersif et moins compréhensible pour le joueur.Il manque les animation des confusion, paralysie, sommeil...
Étapes pour reproduire :
1. Lancer un combat contre un Pokémon sauvage.
2. Utiliser une attaque qui devrait avoir une animation.
3. Observer l'absence d'animation pendant l'attaque.
Résultat attendu : Une animation par attaque devrait être présente pour rendre le combat plus immersif et compréhensible.
Résultat réel : Certaines attaques n'ont pas d'animation, ce qui rend le combat moins immersif.

Statut au 2026-10-15 : traitement partiel, fiche encore ouverte. Les états
Sommeil, Paralysie, Gel, Brûlure, Poison, Confusion et Peur disposent désormais
d'un retour visuel générique, de même que les hausses et baisses de statistiques.
Les capacités possédant une animation extraite continuent d'utiliser celle du jeu
source et les autres gardent le mouvement d'attaque/impact générique. Il reste à
auditer les capacités sans correspondance dans `battle-animations.json` avant de
considérer cette fiche entièrement corrigée.
