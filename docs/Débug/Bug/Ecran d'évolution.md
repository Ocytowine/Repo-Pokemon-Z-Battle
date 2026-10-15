Titre : Écran d'évolution figé et effets source incomplets
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

Complément d'enquête du 2026-10-15 : le script source actif
`PokemonEvolutionScene` crée six exemplaires de `EBS/line1.png`, initialisés à
`hauteur / 6 * index`. Ils remontent tous de 2 px par image, reviennent en bas à
la sortie haute, s'aplatissent au centre et pivotent dans la moitié supérieure.
Notre première version cumulait leur position verticale et un retard négatif, ce
qui annulait une partie de l'espacement et formait le paquet visible au démarrage.
Les lignes partent maintenant d'une animation cyclique de 4,8 s, déphasée de
800 ms par exemplaire : leur intervalle reste exactement égal à un sixième de la
scène pendant tout le mouvement. La variante d'éclosion emploie aussi son asset
source distinct `line2.png`.

Le même script confirme que l'éclat absent n'était pas un filtre inventé. La
séquence superpose `shine1.png` au flash initial, `shine3.png` au cœur lumineux,
`shine4.png` au flash final, huit `ray.png` et seize particules `shine2.png`.
Ces couches sont désormais rendues et calées sur les 7 secondes de la scène. Elles
sont exclusivement visuelles, locales au participant qui regarde l'évolution et
ne modifient ni l'autorité ni l'état persistant solo/Coop.
