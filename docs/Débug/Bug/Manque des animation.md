Titre : Manque des animations lors d'attaque
Description : Certaine attaques n'ont pas d'animation lors de leur utilisation, ce qui peut rendre le combat moins immersif et moins compréhensible pour le joueur.Il manque les animation des confusion, paralysie, sommeil...
Étapes pour reproduire :
1. Lancer un combat contre un Pokémon sauvage.
2. Utiliser une attaque qui devrait avoir une animation.
3. Observer l'absence d'animation pendant l'attaque.
Résultat attendu : Une animation par attaque devrait être présente pour rendre le combat plus immersif et compréhensible.
Résultat réel : Certaines attaques n'ont pas d'animation, ce qui rend le combat moins immersif.

Statut au 2026-10-15 : pipeline automatique en place, fiche encore ouverte pour
les absences réelles de la source. Les capacités dont la fonction moteur est
supportée ou partielle font désormais importer leurs animations sans liste par
espèce. Les états Sommeil, Paralysie, Gel, Brûlure, Poison, Confusion, Caduco et
Hémorragie ainsi que les hausses et baisses de statistiques lisent leurs séquences
`Common:*` originales ; le retour générique ne sert qu'en cas d'asset indisponible.

`battle-integration-report.json` relie chaque manque aux Pokémon et Dresseurs
concernés. Sur l'extraction locale du 2026-10-15, 469 animations sont normalisées,
les dix animations communes attendues sont présentes et 43 capacités exécutables
n'ont aucune correspondance dans `move2anim.dat`. Ces 43 cas conservent le fallback
et restent visibles dans l'audit plutôt que de recevoir une animation inventée.
