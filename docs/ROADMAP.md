# Roadmap Pokemon Z-Battle

## Etat actuel

| Phase | Etat | Condition de sortie |
|---|---|---|
| 0 - Analyse | Terminee | Sources, formats et strategie d'extraction documentes |
| 1 - Extracteur de donnees | Terminee | Extraction reproductible et validee des donnees de base |
| 2 - Assets | Terminee | Manifeste et affichage controle d'un Pokemon |
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

- [x] gerer BOM UTF-8, commentaires, sections et CSV correctement echappe ;
- [x] extraire les types, Pokemon, attaques, talents et objets ;
- [x] conserver IDs, noms internes, lignes et valeurs source ;
- [x] signaler les trous et doublons sans correction silencieuse ;
- [x] ajouter des fixtures et tests unitaires pour chaque grammaire ;
- [x] produire six JSON deterministes et un rapport d'extraction.

Critere de sortie valide le 2026-09-17 : 19 types, 1 018 Pokemon, 730 attaques, 255 talents et 906 lignes d'objets ont ete extraits. Le rapport conserve le doublon objet 692, les IDs manquants et le nom d'attaque `SECRETSWORD` duplique sous les IDs 95 et 728. Deux executions produisent des fichiers identiques.

### Increment 1.3 - Validation et references

- [x] verifier les references Pokemon/type/talent/attaque/objet/evolution ;
- [x] valider les parametres d'evolution selon `PBEvolution::EVOPARAM` ;
- [x] produire les rapports d'orphelins provisoires et de collisions ;
- [x] separer les mecaniques extraites de leur prise en charge moteur ;
- [x] comparer les 730 attaques a `Data/moves.dat` champ par champ ;
- [x] comparer la structure des 1 018 Pokemon a `Data/dexdata.dat`.

Critere de sortie valide le 2026-09-17 : 26 301 references controlees, 26 299 resolues sans ambiguite, aucune reference absente et deux references ambigues expliquees. Les deux concernent `SECRETSWORD`, defini sous les IDs 95 et 728 puis utilise par Samurott et Keldeo. Les deux comparaisons avec les donnees compilees correspondent exactement. Le rapport moteur recense 651 cles mecaniques extraites et 0 implementee, ce qui reflete l'absence actuelle de moteur plutot que de confondre extraction et support.

### Increment 1.4 - Dresseurs et rencontres

- [x] extraire les 196 types de dresseurs ;
- [x] extraire les 477 variantes et leurs 1 295 membres d'equipe ;
- [x] extraire les rencontres par carte et methode ;
- [x] valider les references et conserver les options historiques.

Critere de sortie valide le 2026-09-17 : les 477 equipes et les 149 blocs source de
rencontre se chargent sans RPG Maker. Ces blocs representent 148 cartes uniques,
209 tables de methode et 1 778 emplacements. Le doublon strict de la carte 51 aux
lignes 551 et 570 est conserve et signale. Les 6 923 nouvelles references vers les
types de dresseurs, Pokemon, objets, attaques et fichiers de carte sont toutes resolues ; les deux
seules erreurs du rapport restent les references ambigues a `SECRETSWORD` deja
documentees en 1.3.

### Increment 1.5 - Ruby Marshal et localisation

- [x] implementer un lecteur Ruby Marshal 4.8 teste ;
- [x] prendre en charge graphes de references, symboles, objets et charges `Table` ;
- [x] decoder `messages.dat` et `french.dat` ;
- [x] definir la priorite de traduction et produire un rapport de conflits ;
- [x] exporter les 262 scripts Ruby comme references tracables, sans les executer dans le produit web.

Critere de sortie valide le 2026-09-17 : les 24 categories de chaque catalogue ont
produit 30 726 textes resolus avec leur provenance. La priorite explicite est
`french.dat`, puis `messages.dat`, puis PBS. Le rapport detaille 23 296 traductions
qui different du texte source et 7 668 differences entre texte compile et PBS.
Les 262 scripts sont decomprimes, hashes et marques `reference-only`. Les 507
`RPG::MapInfo` sont extraits, aucune rencontre ne reference une carte absente et
une vraie charge `Table` 3D de carte est decodee. Pikachu, Megacorne, Repoussenlit
et un dialogue de Bourg Canvas ont ete restitues en francais avec leur source.

### Hors perimetre de la Phase 1

- portage complet des effets de combat ;
- conversion complete des cartes et evenements ;
- client Nuxt ;
- Phaser/PixiJS ;
- serveur Cloudflare et WebSockets ;
- coop et duel en ligne.

## Phase 2 - Assets

- [x] indexer les fichiers sans duplication ;
- [x] associer battlers, dos, shiny, sexe, formes, icones, empreintes et cris ;
- [x] detecter automatiquement les bandes d'animation et leurs frames ;
- [x] normaliser les chemins et la casse pour le Web ;
- [x] traiter les tilesets tres hauts via decoupage compatible WebGL ;
- [x] produire un manifeste versionne ;
- [x] creer une page de test affichant un Pokemon et ses variantes.

Critere de sortie valide le 2026-09-17 : 18 455 assets representant 833 071 211
octets sont indexes sans copie. Les 1 018 Pokemon ont chacun au moins un battler,
une icone, un cri et un sprite overworld ; 649 ont une empreinte source. Les 5 642
bandes de battlers detectees exposent leurs frames. Les 49 tilesets disposent d'un
plan de rectangles, dont 48 sont decoupes logiquement sous 4 096 pixels. Les 1 910
fichiers au contenu duplique referencent un original canonique. Aucune collision de
chemin Web ni association Pokemon hors plage ne subsiste. L'Asset Lab charge les
manifestes et le dossier local sans copier les fichiers du jeu.

Decision differee : l'Asset Lab valide le pipeline avec les API DOM/Canvas natives,
mais ne compare pas encore Phaser et PixiJS. Ce choix reste a faire sur un prototype
d'overworld avant la Phase 7 ; Phaser demeure le candidat naturel.

## Phase 3 - Combat minimal hors ligne

- [x] definir les etats et actions sans dependance graphique ;
- [x] ajouter un generateur aleatoire injectable et seedable ;
- [x] implementer ordre, priorite, precision, types, degats et KO ;
- [x] limiter le catalogue a quelques attaques dont les codes d'effet sont compris ;
- [x] emettre des evenements de domaine et des traces de calcul ;
- [x] construire des tests de comparaison avec Pokemon Z.

Critere de sortie valide le 2026-09-17 : `resolveTurn(state, actions, rng)` est un
noyau TypeScript sans API Node, DOM ou graphique. Un tour ne modifie pas son etat
d'entree et renvoie un nouvel etat, des evenements et les traces des tirages/calculs.
Les tests reproduisent les formules Ruby de priorite, vitesse, precision, critique,
variance, STAB, efficacite, degats et KO. Le catalogue initial contient six attaques
limitees aux codes compris `000` et `0A5`; le rapport moteur expose 21 mecaniques
supportees sur les 651 extraites.

## Phase 4 - Battle Sandbox

- [x] selection de deux Pokemon ;
- [x] actions et progression tour par tour ;
- [x] affichage des etats et evenements ;
- [x] journal detaille des calculs et tirages RNG ;
- [x] import/export d'un cas de test reproductible.

Critere de sortie valide le 2026-09-17 : le sandbox Vite propose cinq combattants
issus des statistiques PBS, les attaques du catalogue minimal et les deux choix
d'action de chaque tour. L'interface affiche PV, statistiques, PP, evenements de
domaine et traces de calcul/RNG. Le format JSON versionne conserve la seed et
l'historique des intentions ; son import valide puis rejoue le combat depuis son
etat initial au lieu de faire confiance a des resultats sauvegardes.

### Phase 4.1 - Combat visuel local

- [ ] mutualiser le chargement local des manifestes et du dossier source avec l'Asset Lab ;
- [ ] regrouper les 149 Battlebacks en scenes composees `battlebg`, `playerbase` et `enemybase` ;
- [ ] permettre de choisir la scene de combat dans le sandbox avec un fallback pour les triplets incomplets ;
- [ ] afficher le battler de dos du joueur et le battler de face de l'adversaire ;
- [ ] lire les bandes de frames detectees par le pipeline d'assets ;
- [ ] associer les sprites aux Pokemon selectionnes sans copier les fichiers du jeu ;
- [ ] ajouter les transitions generiques d'entree, d'attaque, d'impact et de KO ;
- [ ] synchroniser les barres de PV avec les evenements du moteur ;
- [ ] lire les cris quand ils sont disponibles ;
- [ ] conserver un fallback visuel si un fichier local est absent ou inaccessible.

Critere de sortie : apres selection des deux manifestes et du dossier local de
Pokemon Z, un combat du sandbox affiche une vraie scene composee et anime les deux
vrais battlers. Les sprites, cris et PV suivent les evenements deterministes sans
introduire de regle de combat dans la couche graphique. Le choix du Battleback est
manuel dans ce sandbox ; son association automatique au terrain et a la carte sera
ajoutee avec l'import du monde en phase 9.

### Phase 4.2 - Presentation des attaques

- [ ] definir un format d'effet visuel independant de la logique de combat ;
- [ ] fournir un effet generique lisible pour chaque attaque supportee ;
- [ ] analyser puis associer progressivement les animations sources comprises ;
- [ ] ajouter messages, efficacite, critique et transitions de fin de combat ;
- [ ] verifier le rythme et le rendu sur ordinateur et mobile.

Critere de sortie : les six attaques du catalogue minimal ont toutes une
presentation complete. Une animation source non comprise utilise explicitement un
effet generique et ne bloque jamais la resolution du tour.

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

Ici, `overworld` designe tout ce qui se passe hors des combats : la carte vue du
dessus, le personnage qui se deplace, les collisions, portes, changements de zone
et la presence des autres joueurs. Ce prototype valide d'abord ces mecanismes sur
une petite carte originale ; l'import des vraies cartes de Pokemon Z reste en
phase 9.

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
