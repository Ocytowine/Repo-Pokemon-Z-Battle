Titre : Synchronisation des PNJ / pokemon des grottes en mode multijoueur saccadée
Description : Les PNJ et les Pokémon dans les grottes ne se synchronisent pas correctement entre les joueurs en mode multijoueur, ce qui entraîne des décalages et des incohérences dans le gameplay.
Étapes pour reproduire :
1. Rejoindre une partie en mode multijoueur.
2. Se rendre dans une grotte avec des Pokémon. ou en ville avec des pnj
3. Observer le comportement des PNJ et des Pokémon par rapport aux autres joueurs.
Résultat attendu : Les PNJ et les Pokémon devraient se synchroniser correctement entre tous les joueurs, assurant une expérience de jeu fluide et cohérente.
Résultat réel : Les PNJ et les Pokémon ne se synchronisent pas correctement, entraînant des décalages et des incohérences dans le gameplay.

Statut au 2026-10-13 : interpolation continue implémentée. La cause du gel lorsque
l'invité se déplaçait était un filtre sur la révision globale de room : Cloudflare
pouvait diffuser le déplacement invité après sa persistance, puis diffuser un paquet
PNJ démarré plus tôt avec une révision globale inférieure. Le paquet était rejeté.
`sourceActorsUpdated` est maintenant filtré uniquement par `actorRevision`, son
horloge dédiée ; une révision égale reste transmise afin de poser réellement le
cache reçu par snapshot. Un test couvre explicitement cet entrelacement.
Validation manuelle requise. Tester plusieurs mouvements autonomes consécutifs en
ville et dans une grotte pendant que l'invité marche, puis une sortie/entrée de
carte et une reconnexion. Un
acteur ne doit ni revenir à une ancienne case, ni se téléporter au milieu d'un pas.
