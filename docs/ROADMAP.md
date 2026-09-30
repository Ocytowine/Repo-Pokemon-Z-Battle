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
| 9 - Import progressif du monde | En cours | Cartes compatibles importees par lots |

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

- [x] decoder `MapInfos`, `RPG::Map`, `Table`, tilesets et autotiles ;
- [x] importer geometrie, collisions et teleports simples ;
- [x] produire des rapports visuels de comparaison.

Critere de sortie valide le 2026-09-28 : `extract:maps` normalise les trois couches
et les collisions directionnelles des 507 cartes, les 50 configurations de
tileset et 2 613 transferts directs. Les hashes SHA-256 conservent la provenance ;
aucune des destinations n'est invalide et aucun fichier attendu ne manque. Un SVG
local par carte superpose terrain, blocages complets et origines de transfert sans
copier les images du jeu dans Git. Le branchement du rendu des vrais tilesets dans
le sandbox overworld reste une etape distincte de l'import des donnees. La commande
`prepare:local` enchaine toutes les extractions et configure le chargement
automatique des assets dans les outils de test, sans selection repetee.

### Increment 9.2 - Evenements standard

- [x] convertir les commandes RPG Maker supportees vers un AST independant ;
- [x] conserver les commandes inconnues avec leur provenance ;
- [x] importer dialogues, interrupteurs, variables, mouvements et transitions par lots.

Critere de sortie valide le 2026-09-28 : `extract:events` couvre les 507 cartes,
12 070 evenements, 18 737 pages, 100 evenements communs et 188 037 commandes.
170 199 commandes standard (90,51 %) sont normalisees, 17 838 appels ou conditions
Ruby restent `reference-only`, et aucune commande observee ne tombe en `raw`.
Chaque commande conserve code, indentation, index et provenance via sa carte,
son evenement et sa page. Le rapport distingue explicitement conversion de format
et execution : les commandes converties ne deviennent executables dans le moteur
qu'au fil des prochains increments.

### Increment 9.3 - Scripts specifiques

- [x] inventorier les 2 483 signatures initiales distinctes observees dans les appels script ;
- [x] regrouper les appels equivalants ;
- [x] porter uniquement les fonctions necessaires aux cartes ciblees ;
- [x] attribuer et tester une politique coop a chaque famille d'evenements.

Critere de sortie valide le 2026-09-28 : les 12 750 lignes `355`/`655` des cartes
reproduisent les 2 483 signatures distinctes de l'analyse et se regroupent en 222
formes parametrees. Les 2 899 lignes des evenements communs, 2 177 conditions Ruby
et huit scripts de route sont inventories separement. Les 15 hooks du premier lot
`Map001 - Intro` sont tous traduits vers cinq actions declaratives sans evaluer de
Ruby. Les 15 familles ont une politique `PERSONAL`, `SHARED`, `HOST_ONLY` ou
`SYNCED`, testee et accompagnee de sa justification. La phase 9 reste en cours :
les donnees sont importees, mais leur execution reste a integrer progressivement.

### Increment 9.4 - Premier rendu jouable

- [x] charger automatiquement une carte et ses images depuis la copie locale ;
- [x] restituer tileset, trois couches et autotiles RPG Maker XP animes ;
- [x] ajouter une camera et un deplacement local sur les collisions directionnelles ;
- [x] conserver le prototype coop original dans des onglets separes ;
- [x] afficher le joueur et les PNJ actifs avec leurs feuilles de personnages source ;
- [x] lire les dialogues simples sans executer les commandes non supportees ;
- [x] executer les transferts directs et les zones `size(w,h)` sans condition ;
- [x] evaluer les conditions simples d'evenement persistantes.

Premier increment valide le 2026-09-28 : `Map003 - Bourg Canvas` est la premiere
carte source affichee et parcourable dans l'overworld sandbox. Le renderer compose
les 48 motifs d'autotile par quarts de tuile, anime leurs planches, dessine les
trois couches et suit l'avatar avec une camera. Le mouvement exige le passage dans
les deux sens (sortie de la case courante et entree dans la cible). Les neuf
origines de transfert sont signalees sans etre executees, car leurs pages et leurs
conditions doivent encore passer par l'interpreteur d'evenements. L'avatar reste
alors volontairement un marqueur temporaire, remplace dans l'increment suivant.

Deuxieme increment valide le 2026-09-28 : le joueur utilise `trchar000` avec quatre
directions et quatre poses de marche. Les pages sans condition des 47 evenements de
Bourg Canvas selectionnent 22 apparences visibles, rendues avec leur taille native,
leur opacite et un tri vertical. Ces evenements participent aux collisions lorsqu'ils
ne sont pas traversables. Espace ou Entree lit les commandes `show-text` et
`text-continuation` de l'evenement situe devant le joueur ; aucune autre commande
n'est executee implicitement. La table issue de `Data/french.dat` est appliquee avec
recomposition des messages coupes sur plusieurs commandes et normalisation des
espaces : 114 des 118 groupes de texte de Map003 sont traduits ; les quatre fallbacks
restants sont vides ou deja rediges en francais, donc aucun dialogue espagnol connu
de cette carte n'est affiche dans ce parcours.

Troisieme increment valide le 2026-09-28 : les transferts directs de la page active
sont maintenant executes sur contact ou interaction. La carte cible, son tileset,
ses autotiles, ses personnages et son contexte de traduction sont charges a la
demande puis conserves en cache. Les quatre portes de Bourg Canvas ouvrent Map004
ou Map005 et leurs sorties permettent le retour. Les transferts internes de ces
batiments utilisent le meme mecanisme. Les pages conditionnelles et les zones
`size(...)` restent volontairement hors de ce lot.

Quatrieme increment valide le 2026-09-28 : la convention du script source
`197-39262853-event-size.rb` est reproduite sans approximation. Une ancre `(x,y)`
nommee `size(w,h)` couvre horizontalement `x..x+w-1` et verticalement
`y-h+1..y`. Toute cette empreinte est affichee en jaune et declenche le transfert
actif. Les transferts associes a une page conditionnelle inactive ne sont plus
affiches ni executes. Les sorties nord et ouest sans condition de Bourg Canvas
peuvent ainsi charger leurs cartes voisines depuis chacune de leurs cases.

### Increment 9.5 - Etat persistant des evenements

- [x] selectionner la derniere page dont les conditions simples sont satisfaites ;
- [x] gerer les interrupteurs, variables et self-switches scopes par carte/evenement ;
- [x] persister cet etat localement entre cartes et redemarrages du navigateur ;
- [x] appliquer atomiquement les commandes d'etat des pages sans controle de flux ;
- [x] interpreter les choix et leurs branches imbriquees ;
- [x] interpreter les conditions standard sur interrupteur, variable et self-switch ;
- [x] porter le premier lot declaratif d'inventaire et de cris de Pokemon ;
- [x] persister les points de soin et de reprise personnels ;
- [x] definir l'equipe persistante partagee par overworld et moteur de combat ;
- [x] attribuer le starter depuis les vrais evenements de Map002 ;
- [ ] porter les autres scripts requis et commandes de gameplay.

Premier noyau valide le 2026-09-28 : le sandbox evalue desormais les deux
interrupteurs de page, le seuil de variable et le self-switch avant de retenir la
derniere page active. Les changements d'interrupteurs, de variables (constante ou
copie de variable) et de self-switches sont appliques a la fin d'un dialogue puis
stockes dans le navigateur. Les nouvelles pages peuvent changer apparence,
collision, dialogue et transfert sans recharger l'application. L'execution est
atomique : une page contenant un choix, une branche, un script Ruby, un objet ou
une autre commande non prise en charge ne modifie aucun etat. Ce garde-fou evite
de valider une progression narrative dont les effets n'ont pas tous ete portes.

Deuxieme noyau valide le 2026-09-28 : l'indentation RPG Maker est maintenant
conservee par le chargeur et utilisee pour parcourir les choix imbriques. La boite
de dialogue affiche les reponses traduites, accepte un clic ou les touches 1 a 9,
et ne projette que la branche choisie. Les conditions standard sur interrupteur,
variable et self-switch selectionnent egalement leur branche vraie ou leur `else`.
L'interpreteur s'arrete avant la premiere commande non supportee : les dialogues
situes apres un script Ruby ne sont plus affiches comme s'ils avaient ete executes,
et aucune mutation partielle n'est enregistree.

Troisieme noyau valide le 2026-09-28 : les appels simples `pbItemBall`,
`pbReceiveItem`, `pbStoreItem`, `pbDeleteItem` et `pbPlayCry` sont reconnus par des
expressions strictes puis convertis en actions declaratives ; aucun Ruby n'est
evalue dans le navigateur. L'inventaire personnel rejoint l'etat persistant et
les retraits impossibles annulent atomiquement l'evenement. Les noms affiches
proviennent du catalogue d'objets et de la traduction francaise locale. Sur
Map003, les evenements 14, 21 et 38 donnent maintenant respectivement une Baie
Oran, une Potion et un Repoussenlit, puis activent leur self-switch. Les appels
non listes restent bloques par defaut.

Quatrieme noyau valide le 2026-09-28 : `pbSetPokemonCenter` devient une action
declarative personnelle qui memorise carte, coordonnees et direction. Le bouton de
reinitialisation recharge desormais cette carte et replace le joueur au dernier
point connu. `recover-all` est reconnu comme intention de soin, tandis que les
temporisations, tonalites, animations et sons standard peuvent traverser
l'interpreteur sans bloquer la progression d'etat. Aucun soin d'equipe n'est
simule tant que l'overworld source ne possede pas encore l'equipe persistante du
joueur. Les deux branches de l'infirmiere de Map003 (evenement 30) terminent ainsi
leur dialogue et enregistrent le point de reprise sans executer de Ruby.

Cinquieme noyau valide le 2026-09-28 : le package `player-state` definit une
sauvegarde d'equipe versionnee de zero a six Pokemon, sans inventer de starter
avant le choix narratif. Chaque membre conserve identite, espece, niveau,
experience, statistiques, PV, statut majeur, talent, objet tenu et un a quatre
slots avec PP courants et maximums. Un adaptateur strict produit le `BattleTeam`
du moteur puis reinjecte PV, statut, PP et membre actif apres le combat. Les
fonctions de capacite, talents et objets encore inconnus provoquent un diagnostic
au lieu d'etre supprimes. L'equipe rejoint la persistance de l'overworld et
`recover-all` restaure maintenant reellement PV, statuts et PP lorsqu'elle n'est
plus vide. Le raccordement d'une rencontre reste bloque volontairement tant que
l'histoire n'a pas attribue le premier Pokemon.

Sixieme noyau valide le 2026-09-28 : les trois socles de `Map002` peuvent
maintenant attribuer Marisson, Feunnec ou Grenousse au niveau 5 depuis leur appel
source `pbAddPokemon`, sans equipe de test injectee. Le Pokemon est construit a
partir des catalogues locaux (statistiques neutres deterministes, premier talent
et quatre dernieres capacites apprises au niveau courant), puis conserve dans la
sauvegarde personnelle. La suite du meme evenement active le compagnon, les
interrupteurs et la variable narrative d'origine, evalue la direction du joueur
pour la mise en scene, puis place la rencontre obligatoire contre Keunotor niveau
2 dans l'etat persistant. Un raccourci **Tester les starters** charge `Map002` devant le
socle de Marisson quand aucune equipe n'existe. La rencontre est encore mise en
attente afin de pouvoir survivre a un rechargement avant son lancement.

Septieme noyau valide le 2026-09-28 : la rencontre en attente ouvre maintenant le
panneau de combat directement dans l'overworld. Les deux equipes sont construites
depuis les donnees persistantes et les catalogues locaux, l'adversaire choisit une
capacite disponible avec la RNG deterministe, et chaque tour passe par le moteur
commun. Les noms de Pokemon et de capacites affiches proviennent des donnees
francaises. `OVERGROW`, `BLAZE`, `TORRENT`, `SIMPLE` et la fonction `06F` de
Psywave reproduisent leurs regles source, ce qui rend les trois starters et
Keunotor convertibles sans suppression silencieuse. Une victoire reinjecte PV,
statuts, PP et Pokemon actif dans la sauvegarde puis consomme la rencontre. Une
defaite soigne l'equipe et conserve la rencontre pour permettre une nouvelle
tentative. Les deplacements et changements de mode restent verrouilles pendant
le combat.

Huitieme noyau valide le 2026-09-28 : le combat source ne se limite plus au
panneau technique. L'overworld charge automatiquement `asset-manifest.json` et
`pokemon-assets.json`, compose une battlemap complete (fond neige pour cette
rencontre), puis affiche le sprite dos du starter et le sprite face de Keunotor,
y compris leurs frames animees. Les cadres de nom, niveau et PV, la boite de
message, les mouvements d'attaque, impacts et K.O. accompagnent la resolution des
tours. Le chargement utilise la route locale deja preparee par `prepare:local` :
aucun dossier ni manifeste ne doit etre reselectionne. Un fallback lisible garde
le combat jouable si un asset manque. Cet increment utilisait encore les
mouvements generiques du laboratoire avant le raccordement du noyau suivant.

Neuvieme noyau valide le 2026-09-28 : `battle-animations.json` est charge avec les
deux autres manifestes sans action manuelle. Le presentateur choisit l'animation
joueur ou adversaire de chaque capacite, inverse les animations a sens unique,
dessine les cels avant ou apres les battlers selon leur priorite et applique aux
sprites les translations, rotations, echelles, opacites et miroirs de la source.
Les timings declenchent aussi leurs effets sonores avec volume et hauteur
d'origine. L'extracteur normalise maintenant les 19 animations necessaires aux
capacites initiales de Marisson, Feunnec, Grenousse et Keunotor : les onze
capacites de ce parcours disposent toutes de leurs frames et sons locaux. Une
capacite non encore exportee conserve le fallback generique, sans bloquer le
combat.

Dixieme noyau valide le 2026-09-28 : la couche audio du combat lit les references
du jeu source. `Map002` declare `Salvaje.ogg` comme musique de rencontre sauvage
et `VictoriaSalvaje.ogg` comme theme de victoire ; ces pistes sont maintenant
jouees aux bons moments. Les cris du starter et de Keunotor sont selectionnes
depuis `pokemon-assets.json`, sans chemin propre a une espece code dans l'UI.
Chaque session audio possede un cycle de vie explicite afin qu'une fin de combat
ou une nouvelle tentative coupe la musique et les sons precedents. Un refus
d'autoplay ou un asset audio absent ne bloque jamais le moteur de combat.

Onzieme noyau valide le 2026-09-28 : les commandes placees apres un combat dans
l'evenement source ne sont plus appliquees avant son resultat. Pour le parcours
des starters, l'interrupteur 65 est conserve dans la rencontre persistante puis
active uniquement apres une victoire. Une defaite restaure donc l'equipe et laisse
la rencontre disponible sans faire avancer artificiellement l'histoire. Les
anciennes sauvegardes de rencontre restent lisibles ; les futurs types de
continuation restent bloques tant qu'ils ne disposent pas d'une representation
declarative sure.

Douzieme noyau valide le 2026-09-28 : l'equipe persistante utilise desormais les
six courbes d'experience de Pokemon Z et initialise un Pokemon au total requis par
son niveau, au lieu de zero. Une victoire sauvage applique la formule ajustee au
niveau du script source, conserve l'experience, recalcule les statistiques et
preserve les degats deja subis lors d'une montee de niveau. Les capacites de niveau
sont ajoutees si un emplacement est libre ; celles qui exigent d'en oublier une
sont signalees explicitement et restent a raccorder a une interface de choix. Le
premier Keunotor niveau 2 rapporte ainsi 13 points au starter niveau 5.

### Increment 9.6 - Rencontres sauvages du monde

- [x] exposer le terrain effectif de chaque case selon les trois couches et les
  `terrainTags` du tileset ;
- [x] charger automatiquement la table de rencontres de la carte courante ;
- [x] reproduire le delai de trois pas, le taux de rencontre et le tirage pondere
  de Pokemon Z avec une RNG persistante ;
- [x] declencher uniquement les rencontres terrestres sur les tags herbe valides ;
- [x] raccorder fuite, experience, montee de niveau et retour exact sur la carte ;
- [x] porter les capacites et talents requis par le premier lot complet de Route 1.

Audit initial du 2026-09-28 : la premiere table terrestre du parcours est celle de
`Map007 - Route 1`, avec un taux de 12 et les especes Keunotor, Passerouge,
Ceribou, Wattouat et Lépidonille aux niveaux 3 a 5. Le moteur sait deja construire
Keunotor, mais ne doit pas supprimer silencieusement les talents `BIGPECKS`,
`CHLOROPHYLL`, `STATIC`, `SHIELDDUST` ni les fonctions `0D8` et `0DD`. Cet audit a
donc defini le lot vertical porte avant l'activation des tirages aleatoires.

Premier noyau 9.6 valide le 2026-09-28 : les `terrainTags` sont charges avec le
tileset et la couche effective reproduit la priorite haute-vers-basse de RPG Maker,
en ignorant ponts et tags neutres. Une table `Land` n'est interrogee que sur les
tags herbe 2, 10, 11 et 14. Apres trois pas eligibles sans combat, le taux de la
carte, les poids des slots et la plage de niveau utilisent une RNG dont l'etat est
sauvegarde. Les anciennes sauvegardes recoivent des valeurs de migration stables.
La Route 1 peut ainsi produire ses cinq especes sans modifier la carte a la main.

Deuxieme noyau 9.6 valide le 2026-09-28 : `BIGPECKS`, `CHLOROPHYLL`, `STATIC` et
`SHIELDDUST` sont acceptes et appliquent leurs effets pertinents dans le contexte
actuel. Le contact utilise le drapeau PBS de la capacite ; Aurore (`0D8`) soigne la
moitie des PV hors meteo et Absorber (`0DD`) rend la moitie des degats. Les 24
animations requises par les starters, Keunotor et le lot Route 1 sont maintenant
normalisees. `map-battle-metadata.json` generalise egalement le choix du battleback,
de la musique sauvage et du theme de victoire : Route 1 utilise donc `Pradera`,
alors que le combat du starter conserve `Snow`. Le rapport moteur passe a 55
mecaniques supportees sur 651.

Troisieme noyau 9.6 valide le 2026-09-28 : les rencontres aleatoires proposent la
fuite, contrairement au Keunotor obligatoire du scenario. La formule reprend les
vitesses non modifiees, le tirage sur 256 et le bonus de 30 par tentative du script
source. Un echec consomme le tour et laisse le Pokemon sauvage attaquer ; une
reussite sauvegarde PV et PP puis restaure exactement la meme carte et la meme
case. L'action generique `wait` ajoutee au moteur permet ce tour adverse sans
simuler une fausse attaque du joueur. L'increment 9.6 est fonctionnellement clos ;
la recette interactive du parcours complet reste a effectuer sur les assets locaux.

### Increment 9.7 - Boucle de jeu et mise en scene

Le statut operationnel detaille, les recettes de validation et l'ordre de reprise
sont conserves dans [`AI_HANDOFF.md`](AI_HANDOFF.md) pour les prochaines sessions.

- [x] verrouiller tous les autres socles des qu'un starter appartient a l'equipe ;
- [x] declencher l'evenement automatique post-Keunotor et sa progression narrative ;
- [x] separer la position logique sur la grille de la position affichee ;
- [x] interpoler les pas, la camera et les motifs de marche du joueur ;
- [x] rendre les animations sur place declarees par les pages des PNJ ;
- [x] executer et interpoler les deplacements aleatoires autonomes des PNJ ;
- [x] interpreter les primitives des routes personnalisees de RPG Maker ;
- [x] ordonnancer les routes et mouvements imposes par les cinematiques ;
- [ ] prendre en charge les declencheurs contact, automatique et parallele ;
- [x] afficher overworld, menus et combat dans une seule scene de jeu avec transitions ;
- [x] ajouter le menu en jeu : equipe, sac, sauvegarde et options ;
- [x] sauvegarder la carte et la position courantes ;
- [ ] valider le parcours Map002 vers Map003, Map007 puis Map009.

Premier garde-fou 9.7 valide le 2026-09-29 : une page est reconnue comme choix de
starter par sa sequence source (ajout d'un Pokemon, interrupteur de type et combat
obligatoire contre Keunotor), sans dependre des numeros d'evenement ni de l'espece.
Des qu'une equipe existe, ces pages ne peuvent plus devenir actives et le raccourci
de test est desactive. Ce verrouillage protege immediatement la sauvegarde ; le
futur executeur automatique devra encore jouer l'evenement 17 de Map002, qui
transforme normalement la victoire (interrupteur 65) en progression (interrupteur
67), puis enchainer la mise en scene originale.

Deuxieme noyau 9.7 implemente le 2026-09-29 : chaque pas conserve une destination
logique entiere pour les collisions, mais expose une position d'affichage interpolee
sur 125 ms. La camera suit cette position en restant alignee aux pixels pour eviter
les coutures entre tuiles. Une seule pose de marche est jouee par case, en alternant
les deux jambes, puis le motif de repos revient. L'etat des touches est lu en continu
afin d'enchainer les pas sans le delai de repetition du systeme. Les commandes
concurrentes sont bloquees jusqu'a la fin du pas ; transferts, evenements de contact
et tirages de rencontres sont ensuite evalues sur la case d'arrivee.

Troisieme noyau 9.7 implemente le 2026-09-29 : les drapeaux d'animation des pages
source sont maintenant conserves par le chargeur. Un evenement avec `stepAnimation`
fait defiler son charset sur place, tandis qu'un evenement statique garde exactement
le motif declare. Cette premiere couche rend les sprites animes sans encore modifier
leur position logique ; les routes autonomes seront raccordees au meme interpolateur
que le joueur dans le lot suivant.

Quatrieme noyau 9.7 implemente le 2026-09-29 : les pages `moveType 1` disposent
d'un etat logique propre et d'une position affichee interpolee. Leur vitesse et leur
frequence pilotent respectivement la duree du pas et le temps d'attente ; le tirage
des directions est deterministe pour une meme carte. Les PNJ alternent leurs poses
de marche et respectent les collisions de carte, le joueur et les autres evenements.
Ce lot couvre les promeneurs autonomes de Map003 et Map009 ; les routes explicites
des cinematiques restent a brancher sur le meme controleur.

Cinquieme noyau 9.7 implemente le 2026-09-29 : un interpreteur pur valide les
routes personnalisees puis resout pas absolus, relatifs, aleatoires et diriges vers
le joueur, sauts, orientations, attentes, vitesse, frequence, drapeaux d'animation,
traversee, priorite, sprite, opacite et interrupteurs. Les attentes reprennent les
40 images par seconde de RPG Maker XP. Une primitive inconnue produit un blocage
explicite. Il reste a ordonnancer ces resultats dans le temps et a les raccorder aux
acteurs affiches pour jouer la cinematique complete.

Sixieme noyau 9.7 implemente le 2026-09-29 : apres la victoire obligatoire, le
passage de l'interrupteur 65 a l'etat actif recherche et demarre automatiquement la
page `autorun` de Map002. Les 145 commandes de l'evenement 17 sont projetees sans
blocage, ses 15 dialogues utilisent la traduction chargee, puis les interrupteurs
67 et 68 sont sauvegardes avant le transfert final vers Map003 en 15,16. Les effets
audio/visuels et routes sont actuellement valides comme presentation sure mais ne
sont pas encore ordonnances a l'ecran ; ils restent le prochain lot de mise en scene.

Correction narrative validee le 2026-09-29 : l'autorun n'applique plus toute sa
page apres avoir affiche tous les textes. Un curseur parcourt desormais les commandes
dans l'ordre source, suspend la sequence a chaque dialogue, applique immediatement
les interrupteurs et execute chaque transfert a sa position exacte. L'interrupteur
68 retire ainsi le bonhomme de neige et revele Crisanto avant ses repliques de
liberation ; l'interrupteur 69 fait apparaitre la lettre avant que le vent ne
l'emporte. Les controles du joueur restent verrouilles jusqu'a la fin de la scene.

Septieme noyau 9.7 implemente le 2026-09-29 : les routes imposees sont maintenant
executees sur le joueur et les evenements avec interpolation, changements de
direction, de sprite et d'opacite. Les routes concurrentes restent actives pendant
les dialogues, tandis que `wait-for-movement` attend reellement leur terminaison.
La scene des starters joue ainsi l'approche du Keunotor avant le combat ; apres la
victoire, Crisanto s'extrait du bonhomme de neige et sa lettre est emportee. Les
sprites cites uniquement par une route sont precharges avec ceux des pages.

Huitieme noyau 9.7 implemente le 2026-09-29 : un registre unique classe chaque
commande source par famille et niveau de support (`rendered`, `executed`, `absorbed`
ou `accepted`). Le resoluteur de branches et l'application de l'etat consomment ce
meme registre, supprimant leurs listes divergentes. Chaque page resolue est compilee
en plan de scene et auditee avant lecture : commandes inconnues, routes invalides,
cibles absentes, sprites de route manquants et effets audiovisuels encore non rendus
sont exposes dans le panneau du sandbox et la console. `SourceSequenceRunner`
centralise les attentes, la concurrence entre acteurs et l'ordre des routes d'un
meme acteur. Les tests du registre et de l'ordonnanceur sont tabulaires afin que
l'ajout d'une commande ne necessite pas un nouveau scenario de test volumineux.

Neuvieme noyau 9.7 implemente le 2026-09-29 : une premiere machine de modes interdit
l'ouverture du menu pendant dialogue, sequence, mouvement, transition ou combat.
Le menu superpose l'overworld et gele ses controles ; ses onglets Equipe et Sac
lisent l'etat persistant reel, Sauvegarde expose la position courante et Options
memorise le volume. Le fond, la Poké Ball, les poches et le curseur reutilisent les
assets originaux locaux sans les versionner. Ce premier lot laissait la sauvegarde
generique de la position au noyau suivant.

Dixieme noyau 9.7 implemente le 2026-09-29 : l'onglet Sauvegarde cree un emplacement
manuel versionne, distinct de l'etat narratif et des checkpoints de soin. Carte,
coordonnees, direction et date sont restaurees au prochain lancement. Une position
mal formee, inaccessible ou hors carte est rejetee puis ramenee vers Bourg Canvas.
Le menu minimal couvre desormais equipe, sac, sauvegarde et options ; le volume est
memorise en attente du raccordement des commandes audio de cinematique.

Onzieme noyau 9.7 implemente le 2026-09-29 : le combat source est rendu directement
au-dessus du canvas overworld et un fondu couvre son entree et sa sortie. La fin de
combat attend la transition avant de rendre la carte, qui conserve sa position.
Les battlers ne reposent plus sur des pourcentages visuels arbitraires : leurs
frames sont placees d'apres `PokeBattle_SceneConstants` et le dernier pixel visible,
comme le correctif `SpriteAutoAlign` du jeu source. Les deux bases reprennent aussi
leurs coordonnees natives dans le repere 512 x 384.

Douzieme noyau 9.7 implemente le 2026-09-29 : `SourceSceneCoordinator` centralise
la politique des actions du joueur. Deplacement, interaction, dialogue, ouverture
du menu, changement de carte et lancement d'une sequence partagent desormais les
memes exclusions. Les mouvements ambiants restent autorises pendant un pas du
joueur et les transferts ordonnes par une cinematique conservent un droit distinct.
Les anciens assemblages de drapeaux ont ete retires de `main.ts` et couverts par
des tests tabulaires.

Treizieme noyau 9.7 implemente le 2026-09-30 : une couche
`SourceScenePresentation` restitue les effets audiovisuels normalises sans les
melanger au moteur narratif. Tonalite, flash, panoramas, brouillards mobiles,
affichage/deplacement/retrait des images, musique, sons et fondu musical sont lus
dans l'ordre de la sequence. Les images conservent le repere source 512 x 384 et
le lecteur audio accepte le melange OGG/WAV/MP3 du jeu ; le volume du menu lui est
raccorde. L'audit d'EV017 ne conserve plus que `show-animation`, `scroll-map` et
`text-options` dans son rendu en attente.

Quatorzieme noyau 9.7 implemente le 2026-09-30 : `scroll-map` anime un decalage de
camera persistant avec les directions, distances et vitesses de RPG Maker, en
parallele des dialogues. L'extracteur produit `map-animations.json` depuis les 100
entrees de `Animations.rxdata` ; `show-animation` restitue leurs cellules, sons et
flashs au-dessus du joueur ou de l'evenement cible. `text-options` pilote enfin la
position et la transparence de la boite de dialogue. Les trois commandes passent
au niveau `rendered` et l'audit d'EV017 n'a plus aucun rendu en attente.

Quinzieme noyau 9.7 implemente le 2026-09-30 : l'ordre des couches conserve les
images de cinematique au-dessus d'une tonalite noire, ce qui rend les portraits et
cartons visibles pendant les fondus. Un transfert de carte arme maintenant le
premier `autorun` actif de la destination ; il ne demarre qu'apres la fin de la
sequence en cours. EV017 peut ainsi enchainer sur l'arrivee `crisanto` de Map003 et
sortir normalement du noir. Le canvas applique aussi les priorites de tuiles RPG
Maker XP aux acteurs et aux trois couches : les toits et cimes les masquent a la
bonne profondeur. Enfin, les charsets recoivent une ombre de contact generique,
sauf pour les evenements nommes avec la convention source `/noShadow/`.

Correction de changement de page validee le 2026-09-30 : les substitutions de
sprite produites par une route sont maintenant associees a la page qui les a
creees. Si un interrupteur ou une variable active une autre page, le rendu reprend
son apparence sans perdre la position logique de l'evenement. La page vide de
Crisanto apres son depart sur Map003 ne laisse donc plus un sprite fige et
traversable a l'ecran.

### Comment la couverture s'etend au jeu complet

Le portage suit deux niveaux complementaires. Le premier est generique : un seul
lecteur couvre les 507 cartes, les trois couches, les 50 tilesets, les pages, les
conditions, les transferts, les tables de rencontre, les metadonnees de combat et
les commandes RPG Maker normalisees. Une correction de cette couche profite donc
immediatement a toutes les cartes ; 90,51 % des 188 037 commandes sont deja
converties structurellement.

Le second niveau est vertical : les appels Ruby et regles de combat propres au
fangame sont portes par familles lorsqu'un parcours jouable les atteint. Ce n'est
pas un correctif limite a une seule carte : porter `pbWildBattle`, `STATIC` ou
`0DD` les rend disponibles partout ou ils apparaissent. Les rapports de couverture
gardent la liste exacte de ce qui reste bloque. Il faudra bien couvrir toutes les
mecaniques atteignables pour terminer le solo, mais pas reecrire individuellement
chaque evenement ni pretendre implementer d'avance les outils d'editeur, fonctions
de debug ou variantes jamais utilisees par le parcours final.

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
