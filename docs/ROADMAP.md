# Roadmap Pokemon Z-Battle

## Etat actuel

| Phase | Etat | Condition de sortie |
|---|---|---|
| 0 - Analyse | Terminee | Sources, formats et strategie d'extraction documentes |
| 1 - Extracteur de donnees | Terminee | Extraction reproductible et validee des donnees de base |
| 2 - Assets | Terminee | Manifeste et affichage controle d'un Pokemon |
| 3 - Combat minimal hors ligne | Terminee | Duel deterministe 1 contre 1 teste |
| 4 - Battle Sandbox | Terminee | Interface de diagnostic du moteur |
| 5 - Premier multijoueur | Terminee localement | Deploiement Cloudflare differe jusqu'au premier lot de la phase 6 |
| 6 - Equipes completes | Terminee | Equipes de six, test local et mecanismes principaux |
| 7 - Prototype overworld | Terminee | Deux personnages synchronises sur deux zones de test |
| 8 - Prototype coop | Terminee | Interactions et evenements classes |
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

- [x] mutualiser le chargement local des manifestes et du dossier source avec l'Asset Lab ;
- [x] regrouper les Battlebacks en scenes composees `battlebg`, `playerbase` et `enemybase` ;
- [x] permettre de choisir la scene de combat dans le sandbox avec un fallback pour les triplets incomplets ;
- [x] afficher le battler de dos du joueur et le battler de face de l'adversaire ;
- [x] lire les bandes de frames detectees par le pipeline d'assets ;
- [x] associer les sprites aux Pokemon selectionnes sans copier les fichiers du jeu ;
- [x] ajouter les transitions generiques d'entree, d'attaque, d'impact et de KO ;
- [x] synchroniser les barres de PV avec les evenements du moteur ;
- [x] lire les cris quand ils sont disponibles ;
- [x] conserver un fallback visuel si un fichier local est absent ou inaccessible.

Critere de sortie : apres selection des deux manifestes et du dossier local de
Pokemon Z, un combat du sandbox affiche une vraie scene composee et anime les deux
vrais battlers. Les sprites, cris et PV suivent les evenements deterministes sans
introduire de regle de combat dans la couche graphique. Le choix du Battleback est
manuel dans ce sandbox ; son association automatique au terrain et a la carte sera
ajoutee avec l'import du monde en phase 9.

Implementation terminee le 2026-09-18 : `@pokemon-z-battle/local-assets` fournit
le chargement valide des deux manifestes, l'acces en lecture seule au dossier choisi,
la selection des battlers et des cris, ainsi que la composition des scenes. L'Asset
Lab et le sandbox utilisent tous deux ce module. Les triplets complets et incomplets
sont testes sans inclure d'asset du jeu dans le depot. La recette visuelle finale sur
les 149 fichiers reels reste a executer avec l'extraction locale de l'utilisateur.

### Phase 4.2 - Presentation des attaques

- [x] definir un format d'effet visuel independant de la logique de combat ;
- [x] fournir un effet generique lisible pour chaque attaque supportee ;
- [x] analyser puis associer progressivement les animations sources comprises ;
- [x] ajouter messages, efficacite, critique et transitions de fin de combat ;
- [ ] verifier le rythme et le rendu sur ordinateur et mobile.

Critere de sortie : les six attaques du catalogue minimal ont toutes une
presentation complete. Une animation source non comprise utilise explicitement un
effet generique et ne bloque jamais la resolution du tour.

Premier increment implemente le 2026-09-18 : un registre declaratif fournit six
presentations distinctes (`impact`, vitesse, griffes, eau, liane et etoiles), avec
un fallback par type/categorie. Le sequenceur est annulable, propose un rythme
normal ou rapide et respecte `prefers-reduced-motion`. Les evenements de degats
exposent maintenant critique et efficacite comme donnees de domaine.

Deuxieme increment implemente le 2026-09-18 : le lecteur Marshal prend en charge
les flottants Ruby 1.8 avec mantisse binaire et les variables d'instance des classes
derivees d'Array. L'extracteur indexe les 730 associations de `move2anim.dat` et
normalise les neuf animations joueur/adversaire necessaires aux six attaques. Le
sandbox restitue les cellules des planches source a 20 images/seconde et les sons de
timing, avec retour automatique aux effets generiques en cas d'incompatibilite.
Les cellules source `-1` et `-2` pilotent aussi les transformations des battlers ;
les priorites separent les effets situes derriere et devant eux. La mise en page a
ete controlee par captures headless en `1440 x 1000` et `500 x 900`, puis protegee
contre les debordements horizontaux. La derniere etape de cette phase est la recette
interactive des animations importees sur un appareil mobile reel.

## Phase 5 - Premier multijoueur

Decision du 2026-09-18 : le socle multijoueur est considere termine localement. Le
deploiement Cloudflare reste volontairement differe jusqu'a l'obtention d'un
premier combat jouable avec equipes, afin de ne pas figer publiquement le format
temporaire du duel de demonstration. La recette locale reste un test de regression
obligatoire pendant la phase 6.

- [x] protocole TypeScript partage et validation runtime ;
- [x] noyau autoritaire de room independant de Cloudflare ;
- [x] Worker Cloudflare, Durable Object par room et WebSocket ;
- [x] creation/rejoindre par code ;
- [x] authentification legere d'une place dans la room ;
- [x] ready, action de combat, reconnexion et snapshot ;
- [x] serveur autoritaire sur toutes les decisions et la RNG.
- [x] recette locale HTTP/WebSocket avec deux clients et reconnexion ;
- [ ] deploiement Cloudflare et smoke test sur l'URL publique.

Le message client exprime une intention. Il ne transmet jamais des degats, un resultat de capture ou une statistique calculee.

Premier increment implemente le 2026-09-18 : `@pokemon-z-battle/multiplayer-protocol`
versionne et valide strictement les intentions client, avec une limite de 4 Kio et
des identifiants de requete idempotents. `@pokemon-z-battle/room-server-core`
attribue deux places stables, gere ready/deconnexion/reconnexion, attend les deux
actions puis resout le tour avec le moteur et la RNG du serveur. Ce noyau ne depend
d'aucun runtime reseau et reste testable sans compte Cloudflare.

Deuxieme increment implemente le 2026-09-18 : le Worker public cree et rejoint les
rooms par code de six caracteres, puis transfere les WebSockets au Durable Object
SQLite correspondant. Les sockets utilisent l'API d'hibernation ; les places sont
protegees par un jeton aleatoire dont seul le SHA-256 est persiste. L'etat complet,
les intentions en attente et la position de la RNG survivent aux reveils. Le
deploiement Cloudflare reel et le branchement du client restent a effectuer.

Troisieme increment implemente le 2026-09-18 : le Battle Sandbox peut creer ou
rejoindre une room, conserver un ticket par onglet, se reconnecter, annoncer ready
et soumettre uniquement l'action de sa place. Les snapshots et tours resolus par le
serveur alimentent les cartes, PV, messages et animations existants. Le mode local
reste disponible sans Worker. Le deploiement Cloudflare reel reste a effectuer.

Quatrieme increment implemente le 2026-09-18 : une recette de bout en bout lancee
contre Wrangler controle la sante HTTP, la creation et la jonction d'une room, les
deux WebSockets, le passage en ready, la resolution autoritaire d'un tour, l'egalite
des etats recus puis la reconnexion au tour suivant. Les fichiers SQLite temporaires
de Miniflare sont retires du suivi Git et ignores. Le compte Cloudflare local est
authentifie ; le deploiement public reste une action explicite a effectuer.

## Phase 6 - Equipes completes

### Increment 6.1 - Equipes et changements

- [x] definir un etat d'equipe de un a six Pokemon sans casser l'API de duel ;
- [x] selectionner et exposer le Pokemon actif de chaque camp ;
- [x] executer les changements volontaires avant les attaques ;
- [x] imposer un remplacement valide apres le KO d'un Pokemon actif ;
- [x] terminer le combat uniquement lorsque toute une equipe est K.O. ;
- [x] tester les changements, KO, remplacements et invariants d'equipe.

Critere de sortie valide le 2026-09-18 : `TeamBattleState` encapsule deux equipes
de un a six membres et expose leur combattant actif sans modifier `BattleState` ni
`resolveTurn`. `resolveTeamTurn` execute les changements volontaires avant les
attaques et remet a zero les niveaux du Pokemon retire. Un KO avec une reserve
produit `replacementRequired`; `replaceFaintedPokemon` effectue ce remplacement
sans consommer un tour ni la RNG. La victoire n'est emise qu'une fois la derniere
reserve consciente eliminee.

### Increment 6.2 - Protocole et Sandbox d'equipe

- [x] ajouter les intentions de changement au protocole multijoueur ;
- [x] persister les equipes et remplacements en attente dans les rooms ;
- [x] afficher les reserves, PV et choix de remplacement dans le Sandbox ;
- [x] etendre la recette locale a un combat avec changement et KO.

Critere de sortie valide le 2026-09-18 : le protocole v2 transporte les attaques,
les changements volontaires et les remplacements obligatoires sans accepter de
resultat calcule par le client. Les rooms sauvegardent les deux equipes, les actions
et les remplacements en attente. Le combat de demonstration utilise trois Pokemon
par camp ; le Sandbox affiche leurs PV, distingue l'actif et les K.O., puis ne
propose que les reserves valides lorsqu'un remplacement est requis. La recette
HTTP/WebSocket execute un changement, restaure la partie apres reconnexion, provoque
un K.O. et controle le remplacement autoritaire.

### Increment 6.3 - Mecaniques par lots

- [x] ajouter un premier lot de statuts documente et teste ;
- [x] completer le gel et les statuts propres a Pokemon Z ;
- [x] ajouter une premiere famille de hooks de talents et d'objets ;
- [x] augmenter progressivement la couverture des codes de fonction de Pokemon Z ;
- [x] conserver le suivi explicite des fonctions supportees et non supportees.

Premier lot implemente le 2026-09-18 : le moteur conserve un statut majeur par
Pokemon et prend en charge sommeil, poison, poison grave, brulure et paralysie via
les fonctions `003`, `005`, `006`, `007` et `00A`. Les hooks couvrent ordre par
vitesse, immobilisation, reveil, degats residuels, reduction des degats physiques,
immunites de type, K.O. et remplacement d'equipe. Les valeurs sont alignees sur les
scripts Ruby exportes, y compris le poison normal a `1/12`. Le Sandbox expose les
cinq attaques de statut et leur etat visuel. Le protocole passe en v3 afin de
persister ces donnees sans restaurer une ancienne room v2 incompatible.

Deuxieme lot implemente le 2026-09-18 : le gel suit la variante de Pokemon Z avec
degats residuels et reduction des attaques speciales. `CADUCO` fragilise une cible
sous la moitie de ses PV et `HEMORRAGIA` augmente de deux niveaux le taux de
critique. Les effets secondaires des fonctions `00C`, `159` et `906` utilisent leur
chance PBS et un tirage RNG trace. Les premiers hooks de talent couvrent `GUTS`,
`QUICKFEET` et `MAGICGUARD`; ceux des objets couvrent `LEFTOVERS`, `BLACKSLUDGE`
et `SCOPELENS`. Le rapport marque ces trois talents comme supportes et le type
d'objet tenu comme partiel. Le protocole passe en v4 pour transporter talent et
objet sans ambiguite avec les anciennes rooms.

Troisieme lot implemente le 2026-09-18 : les fonctions `01C`, `01D`, `01F`, `020`
et `042` a `047` couvrent les hausses personnelles et baisses adverses d'Attaque,
Defense, Vitesse, Attaque Speciale, Defense Speciale et Precision. Les effets
secondaires utilisent leur chance PBS et les niveaux sont bornes entre -6 et +6.
Les talents `HUGEPOWER` et `PUREPOWER`, ainsi que `MUSCLEBAND`, `WISEGLASSES` et
`ASSAULTVEST`, etendent les hooks de calcul. La Veste de Combat renforce la Defense
Speciale et bloque les capacites de statut. Le Sandbox expose Rayon Charge et Jet
de Sable, et le rapport passe a 44 mecaniques supportees sur 651.

### Increment 6.4 - Testabilite et consolidation

- [x] rendre les equipes jouables sans demarrer le serveur multijoueur ;
- [x] exposer changements volontaires et remplacements obligatoires en local ;
- [x] rendre les talents et objets supportes configurables dans le Sandbox ;
- [x] afficher l'equipement actif et conserver les anciens scenarios exportes ;
- [x] valider le Sandbox, le moteur et le build complet avant cloture.

Critere de sortie valide le 2026-09-18 : le Sandbox propose un duel ou un combat
local trois contre trois. Les deux listes d'action exposent attaques et reserves,
puis se limitent aux remplacements valides apres un K.O. Les talents et objets
supportes sont configurables sur les deux Pokemon de tete et visibles sur leurs
cartes. Le format de scenario passe en v2 pour persister ces configurations, avec
migration des exports v1. L'export des equipes n'est pas encore persiste : leur
parcours local reste un outil de test par seed, tandis que l'export/rejeu v2 couvre
les duels. Les futurs codes de fonction seront ajoutes par besoins verticaux sans
bloquer le debut de la phase 7.

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

### Increment 7.1 - Noyau local et carte originale

- [x] isoler un moteur de grille sans DOM ni renderer ;
- [x] definir et valider cartes, obstacles, avatars et transitions ;
- [x] afficher deux avatars independants sur une carte originale ;
- [x] accepter clavier et commandes tactiles pour les deux joueurs ;
- [x] tracer mouvements, blocages, directions et changements de carte ;
- [x] tester collisions, occupation, immutabilite et transitions.

Critere de sortie valide le 2026-09-18 : `overworld-engine` resout une intention
par tick et refuse limites, obstacles ou case occupee. `overworld-sandbox` affiche
deux cartes originales reliees et deux avatars controles localement. Le rendu
Canvas ne contient aucune regle de mouvement. La decision de differer Phaser est
documentee dans `docs/OVERWORLD_ARCHITECTURE.md`.

### Increment 7.2 - Synchronisation de mouvement

- [x] ajouter les intentions overworld au protocole ;
- [x] valider et appliquer les mouvements dans le Durable Object ;
- [x] borner la frequence d'envoi ;
- [x] interpoler les positions distantes et corriger les divergences.

Critere de sortie valide le 2026-09-18 : le protocole v5 ne transmet que la
direction et un numero de sequence croissant. La room resout chaque intention avec
`overworld-engine`, persiste le monde puis diffuse son etat autoritaire aux deux
clients. Le sandbox limite les envois a 120 ms et interpole la correction recue sur
110 ms. La recette E2E compare les etats recus par les deux sockets.

### Increment 7.3 - Zones et reconnexion

- [x] conserver le ticket de room dans le client overworld ;
- [x] reconnecter automatiquement le WebSocket apres une coupure ;
- [x] verifier la restauration d'un changement de zone apres reconnexion ;
- [x] ajouter une recette navigateur a deux clients overworld.

Critere de sortie valide le 2026-09-18 : le ticket est conserve dans le
`sessionStorage` et recharge avec la page. Une coupure inattendue declenche des
tentatives automatiques de 500 ms a 8 s. Le snapshot restaure carte, position,
direction et dernier numero de mouvement accepte. La recette E2E traverse une
zone, reconnecte le premier client, compare le monde restaure puis reprend le
deplacement sans intention perimee. La recette manuelle a deux navigateurs est
documentee dans `apps/overworld-sandbox/README.md`.

## Phase 8 - Prototype coop

### Increment 8.1 - Interactions et politiques coop

- [x] definir `PLAYER_STATE`, `SESSION_STATE` et `WORLD_STATE` ;
- [x] ajouter PNJ, objets et interrupteurs originaux au catalogue ;
- [x] implementer `PERSONAL`, `SHARED`, `HOST_ONLY` et `SYNCED` ;
- [x] resoudre la cible cote serveur a partir de la position et de la direction ;
- [x] afficher interactions, inventaires et drapeaux dans le sandbox ;
- [x] tester les conflits simultanes et la persistance reseau.

Critere de sortie valide le 2026-09-18 : le protocole v6 transporte uniquement
l'intention `interact`, jamais un identifiant d'objet choisi par le client. Le
moteur resout la case regardee, applique la politique coop et produit un nouvel
etat immutable. Les quatre politiques sont testees, dont le premier gagnant d'une
interaction `SHARED` et l'attente des deux participants pour `SYNCED`. La recette
E2E valide un objet `PERSONAL` et un PNJ `SHARED` sur deux sockets.

### Increment 8.2 - Rencontres et combats depuis le monde

- [x] definir les declencheurs sauvage et dresseur ;
- [x] construire le combat depuis le contexte overworld ;
- [x] verrouiller puis restaurer les avatars pendant le combat ;
- [x] revenir dans le monde avec le resultat persiste.

Critere de sortie valide le 2026-09-18 : une interaction `encounter` construit un
combat minimal sauvage ou dresseur avec le moteur existant. Le serveur verrouille
mouvements et interactions, resout automatiquement l'action adverse et diffuse
chaque tour. A la fin, il supprime le combat actif, restaure l'exploration et ajoute
le resultat a `SESSION_STATE`. Le sandbox affiche les PV et capacites au meneur ;
le second joueur observe. La recette E2E valide declenchement, verrouillage, combat
complet et retour sur la carte.

### Increment 8.3 - Parcours coop complet

- [x] exposer les quatre politiques dans une recette visuelle guidee ;
- [x] restaurer inventaires, drapeaux et synchronisations apres reconnexion ;
- [x] tester les conflits reseau `SHARED` et `SYNCED` ;
- [x] ajouter une recette E2E monde-interaction-combat-retour.

Critere de sortie valide le 2026-09-18 : le sandbox expose chaque interaction,
sa politique, sa zone et son statut. La room restaure inventaires personnels,
interactions partagees et participants `SYNCED`. La recette E2E fait concourir
deux sockets pour le meme PNJ `SHARED`, traverse les zones avec les deux avatars,
interrompt une stèle `SYNCED` apres le premier participant, reconnecte ce joueur
puis applique l'effet avec le second. Le meme parcours automatise couvre aussi
interaction, combat sauvage, verrouillage et retour dans le monde.

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
