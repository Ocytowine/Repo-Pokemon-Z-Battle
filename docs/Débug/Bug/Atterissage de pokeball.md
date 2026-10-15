Titre : Atterissage de la pokeball
Description : La pokeball lors d'une capture n'atterie pas au centre de la zone adverse, elle tombe soit trop haut soit trop bas
Étapes pour reproduire :
1. Je déclenche un combat contre un sauvage
2. Je tente de capturer le Pokémon sauvage.
3. Je lance la Pokéball.
4. Je constate que la pokeball n'atterit pas au centre de la zone adverse.
Résultat attendu : La pokeball devrait atterir au centre de la zone adverse, comme dans le jeu de base. (et encore je la trouve aussi pas ouf)
Résultat réel : La pokeball n'atterit pas au centre de la zone adverse, elle tombe soit trop haut soit trop bas.

Statut au 2026-10-15 : corrigé dans le code, validation manuelle requise. La cible
est maintenant le centre du rectangle source `enemybase*` (384, 158), et non plus
le centre du Pokémon suivi d'un décalage vertical arbitraire. Le lancer a aussi
été légèrement ralenti et la Ball agrandie pendant la capture.

Reprise après retour visuel : les interpolations avec `fill` se chevauchaient et
pouvaient provoquer des sauts verticaux. La séquence fixe maintenant chaque pose
avant d'annuler l'animation précédente : vol fermé, arrêt, ouverture, absorption,
fermeture, chute unique puis oscillations uniquement horizontales. Le canvas Ball
source mesure `32 x 64` ; le rendu de capture respecte désormais ce ratio au lieu
de le comprimer dans un carré. Validation manuelle toujours requise.
