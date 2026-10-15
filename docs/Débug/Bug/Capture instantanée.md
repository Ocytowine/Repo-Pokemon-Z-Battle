Titre : Capture instantanée
Description : il n'y a pas d'animation lors de la capture comme dans le jeu de base.
Étapes pour reproduire :
1. Je déclenche un combat contre un sauvage
2. Je tente de capturer le Pokémon sauvage.
3. Je lance la Pokéball.
4. Je constate qu'il n'y a pas d'animation lors de la capture.
Résultat attendu : Il devrait y avoir une animation lors de la capture du Pokémon. la pokeball est sencé bouger de droite à gauche. et si le pokemon est capturé la pokeball devient grise et le message apparait.
Résultat réel : Il n'y a pas d'animation lors de la capture, le message apparait en bas disant que la capture a échoué ou réussi, intantanement apres le lancé de la Pokéball.

Statut au 2026-10-15 : corrigé dans le moteur et déjà validé visuellement par le
porteur. Le séquenceur joue le lancer, l'ouverture, l'absorption, la fermeture,
les secousses, la libération ou la réussite, avec les sons source associés. Le
point d'atterrissage fait l'objet de la fiche séparée correspondante.

Finition du 2026-10-15 : l'ouverture produit maintenant un flash bleu localisé et
le Pokémon se replie rapidement vers le centre de la Ball pendant l'absorption.
La fermeture et la chute ne commencent qu'une fois ces deux effets terminés.

Affinage du 2026-10-15 : la Ball s'ouvre et déclenche le flash renforcé dès son
contact avec le Pokémon, sans temps mort intermédiaire. En cas d'échec, elle se
rouvre au sol avec le même flash et le Pokémon se redéploie depuis sa position.

Finition de réussite du 2026-10-15 : après la dernière secousse réussie, la Ball
produit un bref éclat puis perd ses couleurs. Elle reste grisée pendant le message
de capture et retrouve son rendu normal lors du nettoyage de la scène.

Finition d'échec du 2026-10-15 : l'ouverture, le flash et le redéploiement du
Pokémon sont conservés. Le flash agit maintenant comme une explosion unique : le
Pokémon en ressort entouré d'une lumière bleue tandis que la Ball, encore ouverte,
est immédiatement rejetée en rotation vers la droite et hors du terrain.

Rythme des secousses ajusté le 2026-10-15 : chaque son `ballshake` déclenche une
oscillation plus courte et plus ample, avec deux impulsions latérales et un retour
central sec. L'intervalle entre deux sons et deux mouvements a aussi été réduit.

Suite de capture du 2026-10-15 : après une réussite, une scène personnelle demande
le surnom puis la destination. Le Pokémon est sécurisé au Ranch avant le choix ;
une équipe incomplète peut l'accueillir directement, tandis qu'une équipe de six
demande quel membre échanger. Le choix reprend après rechargement de la page.
