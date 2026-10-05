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

## Decision produit : expedition dans le monde hote

Chaque joueur possede une sauvegarde solo independante. Une session d'aventure
charge le `WORLD_STATE` narratif de l'hote et importe une vue bornee du
`PLAYER_STATE` de l'invite. Les drapeaux d'histoire, badges, objets cles et uniques
ne sont jamais recopies vers le monde de l'invite.

Deux profils de puissance sont prevus : `ADAPTIVE` et `REAL_LEVELS`. En mode
adaptatif, un niveau effectif de session recalcule seulement les statistiques de
combat. Niveau et experience reels, espece, evolution, capacites, talent, IV, EV et
objet tenu ne sont pas reecrits. Experience, apprentissages et evolutions ne sont
persistes que lorsqu'ils sont legitimement obtenus sur les valeurs reelles.

Les gains exportables sont journalises comme des deltas personnels idempotents.
La sauvegarde invitee doit disposer d'un bail exclusif pendant la session afin
d'empecher une ouverture concurrente et les duplications lors d'une reconnexion.
Les recompenses narratives restent `HOST_ONLY`; les recompenses ordinaires peuvent
etre `PERSONAL` pour chaque participant et les objectifs de session restent
`SHARED` ou `SYNCED` selon leur nature.

Une zone coop dediee pourra etre integree plus tard directement dans la carte du
monde. Elle est explicitement hors perimetre actuel et ne remplacera pas la coop
dans l'histoire principale.

## Regle de conception commune solo et Coop

Une mecanique jouable ne doit pas posseder une implementation solo puis une seconde
implementation reseau ajoutee plus tard. Son etat et ses transitions appartiennent
a un noyau commun. En solo, un adaptateur local joue le role de l'autorite ; en
Coop, les memes intentions passent par la room et le resultat autoritaire est
replique.

Chaque conception doit identifier avant le code : autorite, proprietaire de l'etat,
persistance, audience visuelle et donnees de reconnexion. La matrice de validation
minimale contient solo, hote, invite, rendu distant et reconnexion. Cette regle
s'applique en particulier aux modes de deplacement : le mode courant, la vitesse,
les collisions, le contexte de sprite, les transferts et la representation distante
forment un seul contrat partage.

Les sequences d'evenements recoivent aussi une audience semantique :

- `NARRATIVE_SHARED` pour l'histoire et les mutations du monde de l'hote ;
- `PERSONAL_SERVICE` pour le soin, les boutiques, le PC et les autres fonctions
  propres au joueur qui les utilise ;
- `AMBIENT_SHARED` pour les effets visibles sans progression personnelle.

La classification repose sur les commandes et leurs effets, pas sur un identifiant
de carte ou d'evenement. Une sequence mixte ou inconnue reste narrative par prudence
et doit apparaitre dans l'audit jusqu'a l'ajout d'une regle generique.

## Application aux deplacements source

`resolveSourceMovement` est le noyau commun au mode local et a la room. Une
intention transporte direction, mode demande et demande de Cascade ; le resultat
porte position, direction, mode et action visuelle. Les masques de passage et les
terrain tags compacts sont identiques dans les deux adaptateurs. La room reste
autoritaire pour les collisions, les occupations et la position finale, puis
replique le mode et l'action pour le rendu distant et la reconnexion.

Les capacites appartiennent au `PLAYER_STATE` : chaussures, badges, Sac et
capacites de l'equipe ne sont pas partages. Chaque client calcule donc ses propres
autorisations avant d'envoyer une intention. L'interrupteur de test est lui aussi
strictement local et ne modifie aucun de ces prerequis. Une validation serveur des
droits de traversal exigera plus tard une preuve de capacites de session bornee,
jamais la publication brute de l'inventaire ou de l'equipe.

## Application aux PNJ mobiles source

Les routes autonomes et narratives sont calculees une seule fois chez l'hote, qui
possede deja les pages RPG Maker actives et l'histoire autoritaire. Il publie une
projection bornee de chaque acteur visible : identifiant d'evenement, case logique,
direction, vitesse, occupation et action `idle/step`. L'invite ne possede aucune
intention permettant de deplacer un PNJ.

La room valide la carte, les bornes et l'unicite des identifiants, persiste la liste
avec sa revision et l'emploie pour les collisions, le choix des cases de spawn et
la reconnexion. Les navigateurs ne font qu'interpoler entre deux cases. Les zones
de contact invisibles restent dans la geometrie narrative `blockedPoints`, tandis
que les PNJ visibles appartiennent exclusivement a `actors`; une ancienne case ne
peut donc pas rester bloquee apres le deplacement de son acteur.
