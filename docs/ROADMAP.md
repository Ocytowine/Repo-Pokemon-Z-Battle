# Roadmap Pokemon Z-Battle

## Etat actuel

| Phase | Etat | Condition de sortie |
|---|---|---|
| 0 - Analyse | Terminee | Sources, formats et strategie d'extraction documentes |
| 1 - Extracteur de donnees | En cours (1.1 terminee) | Extraction reproductible et validee des donnees de base |
| 2 - Assets | En attente | Manifeste et affichage controle d'un Pokemon |
| 3 - Combat minimal hors ligne | En attente | Duel deterministe 1 contre 1 teste |
| 4 - Battle Sandbox | En attente | Interface de diagnostic du moteur |
| 5 - Premier multijoueur | En attente | Room a deux joueurs et combat autoritaire |
| 6 - Equipes completes | En attente | Equipes de six et mecanismes principaux |
| 7 - Prototype overworld | En attente | Deux personnages sur une carte de test |
| 8 - Prototype coop | En attente | Interactions et evenements classes |
| 9 - Import progressif du monde | En attente | Cartes compatibles importees par lots |

Le rapport de reference de la Phase 0 est `docs/POKEMON_Z_ANALYSIS.md`.

## Phase 0 - Analyse terminee

Livrables obtenus :

- identification confirmee de RPG Maker XP/RGSS1, MKXP et Pokemon Essentials personnalise ;
- inventaire des donnees PBS, donnees compilees, cartes, scripts, graphismes et audio ;
- lecture validee de `Scripts.rxdata`, `MapInfos.rxdata` et des 507 cartes ;
- reperage des regles propres au fangame dans les scripts Ruby ;
- strategie d'extraction en lecture seule ;
- risques et incertitudes documentes.

Les inconnues non bloquantes a verifier au debut de la Phase 1 sont la version exacte d'Essentials, le modele d'animation `PBAnimations` et la resolution des textes francais.

## Phase 1 - Extracteur de donnees

### Increment 1.1 - Socle reproductible

- [x] initialiser le monorepo TypeScript strict et les tests ;
- [x] creer la CLI `pokemon-z-extractor` avec `--source` et `--output` ;
- [x] interdire une sortie dans le dossier source ;
- [x] produire un manifeste chemin/taille/SHA-256 ;
- [x] ajouter le versionnement du manifeste et l'identite du generateur ;
- [x] ignorer explicitement toute copie locale du jeu et toute sortie generee dans Git.

Critere de sortie valide le 2026-09-17 : deux executions sur les 19 073 fichiers de la source donnent le meme manifeste SHA-256 `2c77c0774fc92cd753356037520dd445f56f22221fda4d91d28a8cf8c88cacb7` et la meme empreinte source `9cbe95644c45ab72829ba63d9a59d969051360fac2a17a208013a7a9b046db46`.

### Increment 1.2 - Lecteur PBS

- gerer BOM UTF-8, commentaires, sections et CSV correctement echappe ;
- extraire les types, Pokemon, attaques, talents et objets ;
- conserver IDs, noms internes et valeurs source ;
- signaler les trous et doublons sans correction silencieuse ;
- ajouter des fixtures et tests unitaires pour chaque grammaire.

Critere de sortie : les compteurs attendus sont 19 types, 1 018 Pokemon, 730 attaques, 255 talents et 906 lignes d'objets ; l'anomalie de l'ID objet 692 est visible dans le rapport.

### Increment 1.3 - Validation et references

- verifier les references Pokemon/type/talent/attaque/objet/evolution ;
- produire les rapports d'orphelins et de collisions ;
- separer `extracted` de `engineSupport` ;
- comparer les sorties aux donnees compilees lorsque cela apporte un controle utile.

Critere de sortie : aucune reference invalide n'est ignoree et toute divergence est expliquee.

### Increment 1.4 - Dresseurs et rencontres

- extraire les 196 types de dresseurs ;
- extraire les 477 variantes et leurs 1 295 membres d'equipe ;
- extraire les rencontres par carte et methode ;
- valider les references et conserver les options historiques.

Critere de sortie : chaque equipe et table de rencontre peut etre chargee sans le moteur RPG Maker.

### Increment 1.5 - Ruby Marshal et localisation

- implementer ou encapsuler un lecteur Ruby Marshal 4.8 teste ;
- prendre en charge graphes de references, symboles, objets et charges `Table` ;
- decoder `messages.dat` et `french.dat` ;
- definir la priorite de traduction et produire un rapport de conflits ;
- exporter les 262 scripts Ruby comme references tracables, sans les executer dans le produit web.

Critere de sortie : un Pokemon, une attaque, un objet et un dialogue de carte peuvent etre restitues avec leur texte francais et leur provenance.

### Hors perimetre de la Phase 1

- portage complet des effets de combat ;
- conversion complete des cartes et evenements ;
- client Nuxt ;
- Phaser/PixiJS ;
- serveur Cloudflare et WebSockets ;
- coop et duel en ligne.

## Phase 2 - Assets

- indexer les fichiers sans duplication ;
- associer battlers, dos, shiny, sexe, formes, icones, empreintes et cris ;
- detecter automatiquement les bandes d'animation et leurs frames ;
- normaliser les chemins et la casse pour le Web ;
- traiter les tilesets tres hauts via decoupage compatible WebGL ;
- produire un manifeste versionne ;
- creer une page de test affichant un Pokemon et ses variantes.

Decision attendue : choisir Phaser ou PixiJS seulement apres un prototype d'affichage et avant la Phase 7. Phaser reste le candidat naturel pour l'overworld, mais le choix doit reposer sur un test, pas sur une preference abstraite.

## Phase 3 - Combat minimal hors ligne

- definir les etats et actions sans dependance graphique ;
- ajouter un generateur aleatoire injectable et seedable ;
- implementer ordre, priorite, precision, types, degats et KO ;
- limiter le catalogue a quelques attaques dont les codes d'effet sont compris ;
- emettre des evenements de domaine et des traces de calcul ;
- construire des tests de comparaison avec Pokemon Z.

Critere de sortie : `resolveTurn(state, actions, rng)` est deterministe et fonctionne dans Node et le navigateur.

## Phase 4 - Battle Sandbox

- selection de deux Pokemon ;
- actions et progression tour par tour ;
- affichage des etats et evenements ;
- journal detaille des calculs et tirages RNG ;
- import/export d'un cas de test reproductible.

## Phase 5 - Premier multijoueur

- protocole TypeScript partage et validation runtime ;
- Worker Cloudflare, Durable Object par room et WebSocket ;
- creation/rejoindre par code ;
- authentification legere d'une place dans la room ;
- ready, action de combat, reconnexion et snapshot ;
- serveur autoritaire sur toutes les decisions et la RNG.

Le message client exprime une intention. Il ne transmet jamais des degats, un resultat de capture ou une statistique calculee.

## Phase 6 - Equipes completes

- equipes jusqu'a six ;
- switch et remplacement apres KO ;
- statuts, talents et objets par lots testes ;
- couverture progressive des codes de fonction de Pokemon Z ;
- suivi explicite des fonctions supportees et non supportees.

## Phase 7 - Prototype overworld

- petite carte originale de test, pas encore une carte Pokemon Z ;
- collisions sur grille et transitions ;
- deux avatars visibles ;
- synchronisation d'intentions de mouvement a frequence bornee ;
- correction serveur et interpolation client ;
- changement de carte et reconnexion.

## Phase 8 - Prototype coop

- interactions, PNJ et objets simples ;
- combat sauvage et dresseur minimal ;
- modele `PLAYER_STATE`, `SESSION_STATE`, `WORLD_STATE` ;
- politiques `PERSONAL`, `SHARED`, `HOST_ONLY`, `SYNCED` ;
- tests des conflits entre deux interactions simultanees.

## Phase 9 - Import progressif du monde

### Increment 9.1 - Cartes statiques

- decoder `MapInfos`, `RPG::Map`, `Table`, tilesets et autotiles ;
- importer geometrie, collisions et teleports simples ;
- produire des rapports visuels de comparaison.

### Increment 9.2 - Evenements standard

- convertir les commandes RPG Maker supportees vers un AST independant ;
- conserver les commandes inconnues avec leur provenance ;
- importer dialogues, interrupteurs, variables, mouvements et transitions par lots.

### Increment 9.3 - Scripts specifiques

- inventorier les 2 483 signatures initiales distinctes observees dans les appels script ;
- regrouper les appels equivalants ;
- porter uniquement les fonctions necessaires aux cartes ciblees ;
- attribuer et tester une politique coop a chaque famille d'evenements.

L'import du monde ne sera jamais une bascule unique. Chaque lot de cartes devra avoir un taux de commandes supportees mesurable et des tests de parcours.

## Regles transversales

- aucun fichier source du fangame dans Git ;
- aucune modification du dossier source ;
- TypeScript strict et aucune donnee importante en `any` ;
- schemas versionnes et provenance obligatoire ;
- moteur de jeu independant de Vue, Nuxt, Phaser, PixiJS et du DOM ;
- serveur autoritaire ;
- RNG centralisee et reproductible ;
- decisions structurantes documentees ;
- fonctionnalite consideree terminee seulement avec tests et rapport de couverture.
