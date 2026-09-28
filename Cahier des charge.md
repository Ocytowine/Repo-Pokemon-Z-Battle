# Cahier des charges — Pokémon Z Coop / Duel

## 1. Présentation du projet

L’objectif est de créer une application web inspirée et alimentée par les données du fangame **Pokémon Z v2.12 FR**, permettant à deux joueurs de jouer ensemble.

Le projet est initialement conçu comme un projet personnel / expérimental.

L’objectif n’est pas de modifier directement Pokémon Z pour lui ajouter du multijoueur.

L’approche retenue est :

```text
Pokémon Z
   ↓
Extraction / analyse
   ↓
Données structurées + assets
   ↓
Nouveau moteur de jeu web
   ↓
Client web
   ↓
Serveur multijoueur
   ↓
Coop + Duel
```

Le projet doit être développé de manière progressive et modulaire.

---

# 2. Objectifs principaux

L'application devra à terme permettre :

* de charger les données provenant de Pokémon Z ;
* d'afficher les Pokémon avec leurs sprites et animations ;
* de reproduire les principales mécaniques de combat ;
* de créer une équipe Pokémon ;
* de sauvegarder une partie ;
* de créer une session multijoueur ;
* de rejoindre une partie avec un code ;
* de synchroniser automatiquement deux joueurs ;
* de faire des combats Pokémon entre joueurs ;
* de permettre une aventure coopérative ;
* de synchroniser les déplacements des deux joueurs ;
* de synchroniser les événements importants du monde.

Le développement devra cependant être effectué par étapes.

Le premier objectif n'est PAS de recréer immédiatement l'intégralité de Pokémon Z.

---

# 3. Principe architectural

Le projet devra être séparé en plusieurs couches indépendantes.

Architecture cible :

```text
pokemon-z-online/
│
├── apps/
│   │
│   ├── client/
│   │
│   └── server/
│
├── packages/
│   │
│   ├── game-data/
│   │
│   ├── game-engine/
│   │
│   ├── multiplayer-protocol/
│   │
│   └── shared/
│
├── assets/
│
├── tools/
│   └── pokemon-z-extractor/
│
├── docs/
│
├── tests/
│
└── CAHIER_DES_CHARGES.md
```

Cette organisation pourra être adaptée si l'analyse technique montre qu'une autre structure est plus pertinente.

Toute modification importante de l'architecture devra cependant être documentée.

---

# 4. Stack technique envisagée

Technologies privilégiées :

## Front-end

* TypeScript
* Vue 3
* Nuxt
* Pinia si nécessaire
* moteur graphique à déterminer entre :

  * PixiJS
  * Phaser

Le choix entre PixiJS et Phaser devra être argumenté avant implémentation.

Pour le déplacement sur une carte Pokémon classique, Phaser peut être pertinent.

PixiJS reste envisageable si nous voulons contrôler davantage le moteur.

---

## Back-end

Infrastructure privilégiée :

* Cloudflare Workers
* Cloudflare Durable Objects
* WebSockets
* Cloudflare D1 lorsque nécessaire

Les Durable Objects devront être étudiés comme système principal pour représenter une partie multijoueur active.

Exemple :

```text
ROOM_ABC123
     ↓
Durable Object
     ↓
Player 1
Player 2
Game State
Battle State
World State
```

---

# 5. Principe fondamental : serveur autoritaire

Le client ne devra jamais être considéré comme la source de vérité pour les actions importantes.

Exemple :

Le client ne doit PAS envoyer :

```text
Pikachu a infligé 74 dégâts.
```

Il doit envoyer :

```text
Pikachu utilise Tonnerre.
```

Puis le serveur calcule :

```text
priorité
vitesse
précision
critique
dégâts
effets
KO
```

Le serveur renvoie ensuite le résultat aux deux joueurs.

Cette règle devra être respectée pour :

* combats ;
* captures ;
* objets ;
* inventaires ;
* statistiques ;
* RNG importante ;
* progression ;
* événements partagés.

---

# 6. Synchronisation multijoueur

La communication en cours de partie devra principalement se faire avec des WebSockets.

Le réseau doit transmettre des intentions ou changements d'état, et non les animations elles-mêmes.

Exemple de déplacement :

```json
{
  "type": "PLAYER_MOVE",
  "playerId": "player1",
  "x": 42,
  "y": 18,
  "direction": "left"
}
```

Le deuxième client reçoit la nouvelle position et joue lui-même l'animation correspondante.

---

# 7. Protocole réseau

Créer un protocole réseau typé.

Par exemple :

```ts
type ClientMessage =
  | PlayerMoveMessage
  | PlayerActionMessage
  | BattleActionMessage
  | InteractionMessage;
```

et :

```ts
type ServerMessage =
  | PlayerStateMessage
  | BattleStateMessage
  | WorldStateMessage
  | ErrorMessage;
```

Éviter autant que possible :

```ts
any
```

Tous les messages réseau devront être validés côté serveur.

Une bibliothèque de validation telle que Zod pourra être utilisée.

---

# 8. Extraction des données Pokémon Z

Il s'agit d'une partie critique du projet.

Nous disposons ou pourrons disposer des fichiers du jeu Pokémon Z v2.12 FR.

Avant de développer le moteur complet, il faudra analyser précisément ces fichiers.

L'objectif est de déterminer :

* le moteur utilisé par Pokémon Z ;
* la structure du dossier Data ;
* la structure du dossier Graphics ;
* les formats utilisés ;
* les données facilement extractibles ;
* les données nécessitant une conversion ;
* les scripts contenant les règles spécifiques à Pokémon Z.

Ne jamais modifier les fichiers sources du jeu pendant l'analyse.

---

# 9. Extracteur Pokémon Z

Créer un outil séparé :

```text
tools/pokemon-z-extractor/
```

Son rôle sera de transformer les données Pokémon Z en un format indépendant du moteur original.

Exemple :

```text
Pokemon Z
Data/
Graphics/
Scripts/
     ↓
pokemon-z-extractor
     ↓
game-data/
assets/
```

L'objectif est que le moteur web n'ait ensuite plus besoin de comprendre directement les formats utilisés par Pokémon Z.

---

# 10. Format normalisé des Pokémon

Exemple indicatif :

```json
{
  "id": 25,
  "internalName": "PIKACHU",
  "name": "Pikachu",

  "types": [
    "ELECTRIC"
  ],

  "baseStats": {
    "hp": 35,
    "attack": 55,
    "defense": 40,
    "specialAttack": 50,
    "specialDefense": 50,
    "speed": 90
  },

  "abilities": [],

  "moves": [],

  "evolutions": [],

  "assets": {
    "front": "",
    "back": "",
    "icon": ""
  }
}
```

Ce format est uniquement indicatif.

Il devra être adapté aux données réellement présentes dans Pokémon Z.

---

# 11. Données à extraire

À terme, essayer de récupérer :

## Pokémon

* Pokédex ;
* noms ;
* formes ;
* types ;
* statistiques ;
* EV ;
* expériences ;
* talents ;
* capacités ;
* évolutions ;
* taux de capture ;
* groupes d'œufs si pertinent.

## Capacités

* nom ;
* ID ;
* type ;
* catégorie ;
* puissance ;
* précision ;
* PP ;
* priorité ;
* effets ;
* description.

## Objets

* objets classiques ;
* objets tenus ;
* objets de combat ;
* objets clés ;
* pierres d'évolution ;
* CT / CS si présentes.

## Talents

* nom ;
* description ;
* effets.

## Types

* résistances ;
* faiblesses ;
* immunités.

## Dresseurs

* nom ;
* classe ;
* équipe ;
* niveaux ;
* objets ;
* IA éventuelle.

## Rencontres

* maps ;
* Pokémon sauvages ;
* niveaux ;
* taux de rencontre.

## Monde

* maps ;
* tilesets ;
* événements ;
* PNJ ;
* téléportations ;
* portes ;
* déclencheurs.

## Graphismes

* Pokémon ;
* personnages ;
* overworld ;
* icônes ;
* tilesets ;
* effets ;
* interfaces ;
* animations.

---

# 12. Conservation des identifiants d'origine

Lorsque cela est possible, conserver les identifiants internes de Pokémon Z.

Exemple :

```text
Pokemon Z ID
+
internalName
+
nouvel ID interne éventuel
```

Cela facilitera :

* les comparaisons avec les fichiers originaux ;
* le debugging ;
* la correction de l'extracteur ;
* les mises à jour ;
* la détection des Pokémon modifiés par le fangame.

---

# 13. Traçabilité des données

Chaque donnée convertie devrait idéalement permettre de retrouver sa provenance.

Exemple :

```json
{
  "id": 25,
  "internalName": "PIKACHU",

  "_source": {
    "game": "Pokemon Z",
    "version": "2.12 FR",
    "sourceId": 25
  }
}
```

Cela permettra d'éviter beaucoup de problèmes pendant le développement.

---

# 14. Assets graphiques

Les assets devront être séparés des données.

Exemple :

```text
assets/
│
├── pokemon/
│   ├── front/
│   ├── back/
│   ├── icons/
│   └── animations/
│
├── characters/
│
├── tilesets/
│
├── animations/
│
└── ui/
```

Ne pas dupliquer inutilement les fichiers.

Créer si possible un manifeste :

```json
{
  "pokemon:25:front": "/pokemon/front/0025.png",
  "pokemon:25:back": "/pokemon/back/0025.png"
}
```

---

# 15. Game Engine

Le moteur devra être indépendant du moteur graphique.

Exemple :

```text
game-engine
```

ne doit pas dépendre directement de :

```text
Vue
Nuxt
Pixi
Phaser
DOM
```

Il doit être utilisable :

* dans le navigateur ;
* sur le serveur ;
* dans les tests.

---

# 16. Combat Engine

Créer progressivement un moteur de combat déterministe.

Exemple :

```ts
resolveTurn(battleState, playerActions, rng)
```

retourne :

```ts
{
  state,
  events
}
```

Exemple d'événements :

```json
[
  {
    "type": "MOVE_USED",
    "pokemon": "PIKACHU",
    "move": "THUNDERBOLT"
  },
  {
    "type": "DAMAGE",
    "target": "SQUIRTLE",
    "amount": 32
  }
]
```

Les animations graphiques seront déclenchées à partir de ces événements.

---

# 17. RNG

Le hasard devra être centralisé.

Ne pas utiliser directement :

```ts
Math.random()
```

dans les mécaniques importantes.

Prévoir une abstraction :

```ts
interface RandomGenerator {
  next(): number;
}
```

Cela permettra :

* tests reproductibles ;
* synchronisation multijoueur ;
* replays éventuels ;
* debugging.

---

# 18. Sauvegarde

Séparer :

## données joueur

```text
player
pokemon
team
inventory
progression
```

et :

## données session

```text
room
connectedPlayers
sharedEvents
battle
temporaryWorldState
```

---

# 19. Coopération

Le mode coop permettra deux personnages indépendants dans le même monde.

Chaque joueur conservera :

* son personnage ;
* son équipe ;
* ses Pokémon ;
* son inventaire ;
* certaines progressions personnelles.

Certaines données seront communes.

Il faudra définir progressivement trois catégories :

```text
PLAYER_STATE
```

```text
SESSION_STATE
```

```text
WORLD_STATE
```

---

## 19.1 Variante coop dynamique : monde de l'hôte

Décision validée le 28 septembre 2026 : chaque joueur possède sa propre sauvegarde
solo. Lorsqu'un joueur rejoint un autre joueur, il participe temporairement au
monde de l'hôte avec son propre personnage et ses propres Pokémon.

Pendant cette expédition :

* la sauvegarde de l'hôte est l'autorité narrative ;
* l'histoire, les quêtes, les badges et les interrupteurs du monde suivent la
  progression de l'hôte ;
* le joueur invité ne copie pas cette progression dans son propre monde ;
* le joueur invité conserve les gains personnels explicitement autorisés ;
* les alliés prévus par l'histoire originale restent des personnages narratifs et
  ne sont pas automatiquement remplacés par le deuxième joueur ;
* le joueur invité est présenté comme un partenaire d'expédition ou un autre
  apprenti, sans réécrire systématiquement tout le scénario.

Le meneur de l'histoire est lié à la sauvegarde hôte, pas simplement à la connexion
qui héberge techniquement la room.

## 19.2 Synchronisation adaptative des Pokémon

À l'entrée dans une session, le joueur invité pourra choisir entre :

* `ADAPTIVE`, mode recommandé, qui rapproche temporairement la puissance de son
  équipe de celle de l'hôte et du plafond narratif actuel ;
* `REAL_LEVELS`, qui conserve les statistiques correspondant aux niveaux réels,
  même en cas d'écart important.

Le mode adaptatif ne modifie jamais les données persistantes d'un Pokémon. Il lui
attribue un **niveau effectif de session**, utilisé uniquement pour calculer ses
statistiques de combat dans le monde hôte.

Restent toujours inchangés :

* niveau réel et expérience réelle ;
* espèce et évolution ;
* capacités connues ;
* talent ;
* IV et EV ;
* objet tenu.

L'expérience gagnée s'applique au niveau réel. Une capacité ou une évolution ne
peut être obtenue que si ses conditions réelles sont remplies. Aucun niveau,
apprentissage ou évolution temporaire ne doit donc être annulé au retour dans le
monde d'origine.

L'équilibrage des rencontres importantes pourra utiliser une estimation de
puissance plus large que le niveau : niveau effectif, statistiques de base,
capacités, talent, objet tenu et taille de l'équipe.

## 19.3 Progression et récompenses d'une expédition

Les récompenses suivent les règles suivantes :

| Récompense | Hôte | Joueur invité |
|---|---:|---:|
| Expérience réelle et argent | Oui | Oui |
| Consommables et objets ordinaires | Oui | Oui, récompense personnelle |
| Pokémon sauvage capturé | Personnel | Personnel, si la capture est autorisée |
| Badge ou progression narrative | Oui | Non |
| Objet clé | Oui | Non |
| Pokémon ou objet unique de l'histoire | Oui | Compensation non unique |
| Récompense coop spécifique | Oui | Oui |

Les compensations possibles comprennent monnaie, consommables, éléments
cosmétiques ou jetons d'expédition. Elles ne doivent pas permettre de dupliquer un
objet clé, un Pokémon unique ou une récompense narrative.

Au retour dans son monde, l'invité conserve uniquement les deltas personnels
validés : expérience réelle, niveaux réellement gagnés, capacités apprises,
évolutions légitimes, captures autorisées, monnaie et objets exportables.

La sauvegarde invitée devra être protégée par un verrou ou bail de session. Les
gains matériels devront utiliser un journal idempotent et être enregistrés
progressivement afin qu'une déconnexion ou reconnexion ne provoque ni perte ni
duplication.

## 19.4 Zone coop intégrée au monde

Une zone spécialement conçue pour la coopération pourra être ajoutée plus tard,
mais elle devra être intégrée naturellement à la carte et à l'univers plutôt que
présentée comme un mode complètement séparé. Elle pourra accueillir énigmes,
défis, raids ou récompenses coopératives spécifiques.

Cette zone est une extension future. Aucun développement ni contenu ne doit être
réalisé pour elle dans la phase actuelle. Elle complète la coopération dans
l'histoire principale et ne la remplace pas.

---

# 20. Événements coop

Tous les événements du fangame ne doivent pas être immédiatement rendus coopératifs.

Chaque événement devra pouvoir être classifié.

Par exemple :

```text
PERSONAL
SHARED
HOST_ONLY
SYNCED
```

Exemples à déterminer :

* objets au sol ;
* dresseurs ;
* PNJ ;
* interrupteurs ;
* portes ;
* cinématiques ;
* légendaires ;
* champions ;
* quêtes.

Cette logique devra être abstraite et non codée en dur map par map lorsque cela est évitable.

---

# 21. Mode Duel

Le mode Duel sera développé avant le mode aventure coop complet.

Flux cible :

```text
Créer partie
     ↓
Code invitation
     ↓
Joueur 2 rejoint
     ↓
Choix équipe
     ↓
Ready
     ↓
Combat
     ↓
Résultat
```

Le premier prototype multijoueur devra se concentrer sur ce système.

---

# 22. Lobby

Une partie devra avoir un identifiant simple.

Exemple :

```text
ABCD12
```

Le joueur 1 :

```text
Créer une partie
```

Le serveur retourne :

```text
ABCD12
```

Le joueur 2 entre :

```text
ABCD12
```

Les deux joueurs sont connectés à la même session.

---

# 23. Reconnexion

Prévoir dès l'architecture la possibilité qu'un joueur perde temporairement sa connexion.

Ne pas détruire immédiatement la session.

Prévoir :

```text
CONNECTED
DISCONNECTED
RECONNECTING
```

Le joueur doit pouvoir retrouver l'état actuel de la partie.

---

# 24. Sécurité minimale

Même pour un projet personnel :

* ne jamais faire confiance aux valeurs envoyées par le client ;
* valider les messages ;
* vérifier que le joueur appartient à la partie ;
* vérifier qu'une action est autorisée ;
* éviter les modifications directes des statistiques ;
* ne pas laisser le client décider des résultats de combat.

---

# 25. Tests

Créer des tests dès la construction du moteur.

Priorité élevée pour :

```text
types
dégâts
priorités
ordre des tours
statuts
évolutions
captures
attaques
RNG
```

Les tests doivent permettre de comparer facilement le comportement attendu avec Pokémon Z.

---

# 26. Journalisation du moteur

Prévoir un système permettant d'obtenir :

```text
TURN 18

Pikachu uses Thunderbolt
accuracy = 100
roll = 53
hit = true

damage:
base = ...
modifier = ...
random = ...

finalDamage = 42
```

Ce système sera très important pour corriger les différences avec Pokémon Z.

---

# 27. Performance

Ne pas optimiser prématurément.

Priorités :

1. fonctionnement correct ;
2. architecture propre ;
3. tests ;
4. multijoueur fiable ;
5. optimisation.

Pour les déplacements réseau, éviter néanmoins d'envoyer inutilement des centaines de messages par seconde.

---

# 28. Documentation

Le dossier :

```text
docs/
```

devra progressivement contenir :

```text
ARCHITECTURE.md
DATA_FORMAT.md
MULTIPLAYER.md
BATTLE_ENGINE.md
POKEMON_Z_EXTRACTION.md
ROADMAP.md
```

Ne pas laisser les décisions importantes uniquement dans le code.

---

# 29. Roadmap générale

## PHASE 0 — Analyse du projet Pokémon Z

Objectif :

comprendre précisément les fichiers disponibles.

Travail :

* inspecter la structure ;
* identifier le moteur ;
* identifier les formats ;
* analyser Data ;
* analyser Graphics ;
* analyser les scripts ;
* documenter les résultats.

Aucune réécriture complète du jeu pendant cette phase.

Livrable :

```text
docs/POKEMON_Z_ANALYSIS.md
```

---

## PHASE 1 — Extracteur

Créer :

```text
tools/pokemon-z-extractor/
```

Commencer par :

```text
Pokémon
Types
Moves
Abilities
Items
```

Produire des fichiers normalisés.

Exemple :

```text
packages/game-data/generated/
```

---

## PHASE 2 — Assets

Analyser et référencer :

```text
sprites
icons
animations
```

Créer un système de manifest.

Afficher un Pokémon dans une page de test.

---

## PHASE 3 — Battle Engine minimal

Supporter uniquement :

```text
2 joueurs
1 Pokémon chacun
quelques capacités simples
PV
stats
types
vitesse
précision
dégâts
KO
```

Tout doit fonctionner hors ligne avant le multijoueur.

---

## PHASE 4 — Battle Sandbox

Créer une interface de développement :

```text
Pokémon A
VS
Pokémon B
```

Permettant de tester le moteur.

Ajouter :

```text
logs
état
actions
résultats
```

---

## PHASE 5 — Premier multijoueur

Créer :

```text
Create Room
Join Room
Ready
Battle
```

Infrastructure :

```text
Cloudflare Worker
+
Durable Object
+
WebSocket
```

Seulement deux joueurs.

---

## PHASE 6 — Équipes complètes

Passer progressivement de :

```text
1 vs 1
```

à :

```text
équipe de 6
```

Ajouter :

* switch ;
* KO ;
* ordre ;
* statuts ;
* talents ;
* objets.

---

## PHASE 7 — Prototype Overworld

Créer une petite map de test.

Deux personnages peuvent :

```text
marcher
voir l'autre joueur
changer de direction
changer de map
```

Pas besoin d'utiliser immédiatement les maps Pokémon Z.

---

## PHASE 8 — Coop prototype

Ajouter progressivement :

* interactions ;
* PNJ ;
* objets ;
* combats sauvages ;
* dresseurs ;
* événements synchronisés.

---

## PHASE 9 — Importation du monde Pokémon Z

Seulement lorsque le moteur coop est fonctionnel.

Étudier alors :

```text
maps
events
NPC
warps
encounters
scripts
```

Importer progressivement les éléments compatibles.

---

# 30. Principe de développement

Ne jamais essayer d'implémenter plusieurs phases importantes en même temps.

Avant chaque phase :

1. analyser l'existant ;
2. proposer une solution ;
3. identifier les fichiers concernés ;
4. créer ou mettre à jour les tests ;
5. implémenter ;
6. tester ;
7. documenter ;
8. mettre à jour la roadmap.

---

# 31. Règles pour l'assistant IA

Lorsqu'un assistant IA travaille sur ce projet :

## Avant toute modification importante

Il doit :

1. lire ce cahier des charges ;
2. analyser le repository existant ;
3. identifier la phase actuelle ;
4. vérifier ce qui existe déjà ;
5. éviter les réécritures inutiles.

Il ne doit jamais supposer qu'un système est absent sans rechercher son existence.

---

## Ne pas casser l'existant

Avant de modifier une architecture existante :

* expliquer pourquoi ;
* identifier les impacts ;
* préserver la compatibilité lorsque possible.

---

## Ne pas inventer les données Pokémon Z

Si une information dépend des fichiers du jeu :

```text
NE PAS DEVINER.
```

Inspecter les fichiers disponibles.

Si l'information n'est pas disponible, l'indiquer clairement.

---

## Favoriser TypeScript strict

Privilégier :

```ts
strict: true
```

Éviter :

```ts
any
```

Créer des types partagés lorsque nécessaire.

---

## Éviter les gros fichiers

Lorsque cela est pertinent :

```text
1 responsabilité importante
=
1 module
```

Ne pas créer un fichier de plusieurs milliers de lignes contenant tout le moteur.

---

# 32. Priorité actuelle

La priorité actuelle du projet est :

```text
PHASE 0
```

Analyse de Pokémon Z.

Le multijoueur, les combats complets et les maps ne doivent pas encore être développés.

---

# 33. Première mission de l'assistant IA

À la lecture de ce fichier, effectuer la mission suivante.

## Mission

Analyser le repository actuel ainsi que les fichiers Pokémon Z disponibles.

Ne modifier aucun fichier du jeu original.

Déterminer :

1. la structure générale du jeu ;
2. le moteur / framework utilisé ;
3. les formats de données ;
4. les fichiers contenant les Pokémon ;
5. les fichiers contenant les attaques ;
6. les fichiers contenant les talents ;
7. les fichiers contenant les objets ;
8. les fichiers contenant les dresseurs ;
9. les fichiers contenant les maps ;
10. les fichiers contenant les événements ;
11. l'organisation des sprites ;
12. l'organisation des animations ;
13. les éventuels scripts personnalisés de Pokémon Z.

Puis proposer la meilleure stratégie d'extraction.

Créer :

```text
docs/POKEMON_Z_ANALYSIS.md
```

Le document devra indiquer clairement :

```text
ce qui est compris
ce qui est confirmé
ce qui reste incertain
ce qui peut être extrait automatiquement
ce qui nécessitera un traitement spécifique
```

Ensuite créer ou mettre à jour :

```text
docs/ROADMAP.md
```

mais NE PAS encore implémenter l'intégralité de l'extracteur.

---

# 34. Critère de réussite de la Phase 0

La Phase 0 sera considérée comme terminée lorsque nous serons capables d'expliquer précisément :

```text
où se trouve chaque grande catégorie de données
```

et :

```text
comment la convertir automatiquement
```

avant de commencer à construire le moteur du nouveau jeu.

---

# 35. Vision long terme

L'architecture doit idéalement permettre d'obtenir :

```text
                    ┌───────────────┐
                    │ Pokémon Z Data│
                    └───────┬───────┘
                            ↓
                       Extractor
                            ↓
                     Normalized Data
                            ↓
                     ┌─────────────┐
                     │ Game Engine │
                     └──────┬──────┘
                            │
             ┌──────────────┴──────────────┐
             ↓                             ↓
       Single Player                 Multiplayer
                                           ↓
                              Cloudflare Durable Object
                                      ↙          ↘
                                 Player 1      Player 2
```

Le projet ne doit donc pas devenir :

```text
une copie web fragile de Pokémon Z
```

mais plutôt :

```text
un nouveau moteur capable d'interpréter les données de Pokémon Z.
```
