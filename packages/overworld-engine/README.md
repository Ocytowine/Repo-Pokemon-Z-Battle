# Overworld engine

Noyau TypeScript sans DOM des phases 7 et 8. Il valide un catalogue de cartes sur
grille et resout une intention de deplacement a la fois avec collisions, occupation
par un autre avatar et transitions entre cartes. Le rendu et le clavier restent
dans l'application `overworld-sandbox`.

Le moteur resout aussi une intention d'interaction sur la case regardee. L'etat
distingue la progression personnelle, la session partagee et le monde, avec les
politiques `PERSONAL`, `SHARED`, `HOST_ONLY` et `SYNCED`. Le client ne choisit pas
l'identifiant de l'interaction qu'il veut activer.

Une interaction peut demander une rencontre sauvage ou de dresseur. Le moteur
émet seulement le contexte `encounterRequested` ; la room construit et exécute le
combat, ce qui conserve l'indépendance entre exploration et règles de combat.

Le moteur ne lit encore aucune carte Pokemon Z : le prototype utilise uniquement
des cartes originales, conformement au perimetre de la phase 7.
