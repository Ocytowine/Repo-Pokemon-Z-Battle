# Architecture coopérative

## Trois niveaux d'état

- `PLAYER_STATE` contient l'inventaire, les drapeaux et les interactions terminées
  propres à un joueur.
- `SESSION_STATE` contient les drapeaux partagés, les interactions consommées et
  les participants en attente d'une synchronisation.
- `WORLD_STATE` rassemble avatars, progression des joueurs et session. La room le
  persiste et le diffuse comme état autoritaire.

## Politiques

- `PERSONAL` applique l'effet et la complétion séparément pour chaque joueur.
- `SHARED` est consommé par la première intention valide ; la suivante reçoit
  `completed`.
- `HOST_ONLY` refuse tout joueur autre que le meneur de la room.
- `SYNCED` mémorise les participants et applique l'effet lorsque tous les avatars
  présents sur la zone ont interagi.

Le message réseau `interact` ne transporte ni coordonnées ni identifiant de cible.
Le serveur utilise la position et la direction déjà présentes dans `WORLD_STATE`
pour trouver la case regardée. Ce choix empêche un navigateur modifié d'activer un
objet distant ou masqué.

Les définitions de la phase 8 restent originales. L'adaptation des événements RPG
Maker et des cartes Pokémon Z demeure réservée à la phase 9.

## Politiques des hooks importes

La phase 9.3 classe les hooks Ruby en 15 familles. Profil, inventaire, equipe,
dialogue, transition, soin, boutique et presentation sont `PERSONAL`. Les mutations
du monde, mouvements de PNJ et compagnons visibles sont `SHARED`. Les rencontres,
reglages systeme et hooks inconnus sont `HOST_ONLY` par defaut. Les sequences
globales de cinematique sont `SYNCED`.

Cette attribution est une politique de migration, pas une autorisation d'executer
le Ruby. Seules les actions declaratives explicitement portees peuvent devenir des
effets serveur ; tout le reste demeure `reference-only`.

## Rencontres de la phase 8.2

Une interaction peut produire `encounterRequested` avec un identifiant et le type
`wild` ou `trainer`. Le moteur overworld ne construit pas le combat : la room crée
un état du moteur de combat à partir de ce contexte et devient propriétaire de la
transition entre exploration et combat.

Pendant la rencontre, toute intention de mouvement ou nouvelle interaction est
refusée. Le meneur choisit une capacité dans l'Overworld Sandbox et l'adversaire
minimal est piloté par le serveur. Le second joueur reçoit les mêmes tours en mode
observation. Une fois le combat terminé, la room enregistre le vainqueur dans
`SESSION_STATE.battleResults`, retire le combat actif et diffuse le snapshot de
retour dans le monde. Une participation coopérative plus riche reste au programme
du parcours 8.3.

## Parcours valide en 8.3

Le serveur sérialise les intentions concurrentes dans l'ordre de réception. Pour
`SHARED`, une seule intention applique l'effet et la suivante reçoit `completed`.
Pour `SYNCED`, la liste des participants appartient à `SESSION_STATE` : elle reste
donc disponible après hibernation du Durable Object ou reconnexion d'un joueur.

Le sandbox affiche un guide de toutes les interactions avec politique, zone et
progression. La recette E2E couvre désormais la chaîne complète : état personnel,
conflit partagé, changement de zone, attente synchronisée, reconnexion, rencontre,
combat autoritaire et retour dans le monde. La phase 9 pourra remplacer les
définitions originales par des lots d'événements importés sans changer ce contrat.
