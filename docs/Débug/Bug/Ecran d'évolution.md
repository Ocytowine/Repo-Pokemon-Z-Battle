Titre : Écran d'évolution figé
Statut : corrigé dans le moteur le 2026-10-15 ; validation visuelle manuelle à refaire sur plusieurs espèces et formats d'écran.
Description : l'écran durant l'évolution est animé, il y'a des effets visuels, mais dans ce bug, l'écran reste figé et aucune animation ne se produit à part la superposition des sprites.
Étapes pour reproduire :
1. Faire évoluer un Pokémon.
Résultat attendu : L'écran d'évolution devrait afficher les animations et effets visuels comme prévu.
Résultat réel : L'écran reste figé et aucune animation ne se produit à part la superposition des sprites.

Cause identifiée : `Graphics/Pictures/evolutionbg.gif` ne contient qu'une seule
image. Dans la version active de Pokémon Z, le mouvement ne vient pas de ce GIF
mais de `PokemonEvolutionScene` et des ressources `Graphics/Pictures/EBS`
(`evobg`, `overlay`, `line1`, rayons et particules).

Correction : `source-transformation-stage.ts` fournit désormais le décor animé
commun aux scènes de transformation. L'évolution utilise la variante `evolution`
et l'éclosion la variante `hatch`, ce qui évite deux implémentations divergentes.
