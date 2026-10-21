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
| 10 - Stabilisation du vertical jouable | En cours, quatre lots clos | `STAB-BATTLE-1` valide apres ses dependances et musique des lieux restauree |
| 11 - Mecanismes solo structurants | En cours, noyaux objets/capture/evolution et registre Pokedex fonctionnels | Fidelite de combat verticale puis finitions capture/evolution |
| 12 - Extensions Coop | Planifiee | Capture, loot, Ranch et chat selon contrats autoritaires |
| 13 - Plateforme et ergonomie | A qualifier | Cloud, import de sauvegarde, responsive et Android cadres |

Le rapport de reference de la Phase 0 est `docs/POKEMON_Z_ANALYSIS.md`.
Les constats produit ajoutes le 2026-10-05 sont normalises dans
`docs/PRODUCT_BACKLOG.md`. `docs/note importantes.md` reste la note d'origine ; le
backlog est la reference de travail pour les priorites, dependances et contrats
solo/Coop.

Audit d'alignement du 2026-10-09 : `STAB-NET-1`, `STAB-NET-2`,
`STAB-WORLD-1` et `STAB-WORLD-2` sont clos. Les objets personnels, la boucle de
capture, le classement principal du Sac et 17 des 18 methodes d'evolution sont
fonctionnels ; la phase 11 n'est donc plus seulement planifiee. Le goulet P0 est
la fidelite des combats du prochain parcours ; le premier registre Pokedex
personnel est maintenant raccorde.
Les rapports de support doivent etre regeneres apres toute evolution de ces
registres afin que les anciens constats historiques ne soient pas pris pour l'etat
courant.

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
- [x] deploiement Cloudflare et smoke test sur l'URL publique.

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

Deploiement valide le 2026-10-13 : le Worker et son Durable Object sont accessibles
sur `https://pokemon-z-battle.mimidu33-eb.workers.dev`. L'Overworld local propose
cette adresse par defaut et conserve les assets Pokemon Z sur chaque poste. Un
correctif de cadence reprend l'appui maintenu lorsque la confirmation autoritaire
arrive apres la fin de l'interpolation locale, sans autoriser plus d'une intention
de mouvement simultanee.

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

Refonte UI/UX du combat implementee le 2026-10-04 : les commandes du joueur sont
regroupees dans un panneau 2 x 2 `Attaque`, `Pokemon`, `Sac`, `Fuite`. Chaque
commande ouvre son propre sous-ecran avec retour explicite. Attaque conserve les
quatre capacites typees et leurs PP ; Pokemon liste toute l'equipe, ses PV, le
K.O. et le membre actif, puis propose `Details` ou `Changer`. Le changement
volontaire passe maintenant par le meme `TeamBattleAction` en combat source local
et dans la room Coop autoritaire ; l'adversaire conserve son action du tour.

Le Sac expose les trois familles demandees a partir de l'inventaire reel : Balls,
soins et objets de combat. La famille Balls est inaccessible contre un Dresseur
ou un joueur. Les objets eux-memes restent volontairement desactives tant que
capture, ciblage des soins et effets de combat ne sont pas portes dans le noyau
partage puis dans la room ; l'UI indique cette dette au lieu de simuler un effet.
Le HUD joueur est aligne avec ce panneau, montre les membres disponibles/actif/K.O.
et colore sa jauge de PV aux seuils de danger.

Cycle de presentation repris le 2026-10-04 d'apres `pbBattleAnimation`,
`pbStartBattle`, `pbTrainerSendOut`, `pbSendOut`, `pbGainEXP` et `pbEndBattle`.
L'ouverture joue les flashes gris, le passage au noir puis l'ouverture verticale
de la scene. Pokemon sauvage et Dresseurs ont leurs entrees distinctes. La victoire
ne ferme plus la scene avant le reglement : baisse de la musique de combat, ME de
victoire, texte et jauge d'EXP sur chaque seuil de niveau, annonces de niveau et de
capacite, argent, puis fondu final. Defaite et fuite n'emploient pas le ME de
victoire. Le noyau calcule et persiste toujours le resultat avant sa presentation.

Contrat combat Coop/PvP revise le 2026-10-06 : rejoindre convertit le combat en
vrai combat double. Chaque Dresseur choisit et controle uniquement ses propres
Pokemon, trois au maximum ; un camp contient au plus deux Dresseurs et six Pokemon.
Chaque actif choisit son action et, lorsque la capacite le permet, sa cible. Un
sauvage seul reste une cible unique en 2 contre 1. Un camp de Dresseur emploie deux
actifs s'il dispose d'assez de Pokemon. La room reste autoritaire ; equipe, EXP,
objets et recompenses restent personnels ; l'issue narrative appartient a l'hote ;
une reconnexion restaure camp, places actives, proprietaires, actions encore dues
et battlers. Le controle de chaque action et remplacement appartient au
proprietaire du slot actif concerne.

Correctif du 2026-10-09 : le ralliement a un combat source utilise l'adjacence
avec son meneur comme contrat d'interaction. Il ne reutilise plus la visee stricte
du defi PvP, car l'orientation affichee et son acquittement reseau pouvaient
diverger pres du PNJ Dresseur et rendre l'hote non interactif. Client et room
verifient la meme distance d'une case ; carte partagee, presence et fenetre de
jonction restent obligatoires.

Revision du meme jour : un Dresseur connecte ne rend pas la Coop obligatoire.
Le cycle autoritaire devient `invite-choice -> join-window -> active`, avec la
branche directe `invite-choice -> active` lorsque l'initiateur continue seul. La
presentation atteint d'abord le face-a-face et le message du Dresseur, puis attend
ce choix avant tout lancer de Poke Ball. La fenetre de jonction n'est visible et
utilisable par l'autre joueur qu'apres un appel explicite du meneur.

Correctif UI du 2026-10-09 : la proposition confirmee par l'invite prend maintenant
priorite sur le panneau d'attente de l'hote. Celui-ci recoit le recapitulatif du
camp et des Pokemon proposes avec les actions accepter/refuser ; il ne reste plus
bloque sur `Continuer sans lui`. La saisie invite distingue visuellement le camp,
les Pokemon personnels selectionnables et les membres deja presents en lecture
seule, avec limites, PV et etat K.O. explicites.

Correctif de composition du 2026-10-09 : une erreur de projection d'equipe ne se
transforme plus en faux message demandant de soigner des Pokemon ayant tous leurs
PV. Le preparateur du ralliement distingue equipe vide, equipe K.O. et mecanique
non encore portee. Un Pokemon conscient reste admissible s'il possede au moins une
capacite supportee ; seules ses capacites non portees sont omises de ce combat et
leurs PP personnels restent intacts au reglement. Les Pokemon totalement
incompatibles sont ecartes avec un avertissement explicite. L'intention reduite
reste validee par la room comme toute autre composition Coop.

Stabilisation double du 2026-10-09 : le lecteur visuel conserve les degats entre
actions positionnees, le vrai slot lors des K.O. et remplacements, et l'etat
autoritaire pendant les animations reseau. Les cibles d'un invite rallie au camp
adverse sont remises dans la perspective de la room avant validation. La reprise
de l'introduction consomme la composition double acceptee, affiche le second
Dresseur a cote de son camp et presente l'annonce d'aide ou le remerciement selon
le joueur qui regarde la scene.

Premier noyau de ce contrat implemente le 2026-10-04 puis etendu le 2026-10-06 dans
`battle-engine` : `SharedBattleParticipation` separe format, camps, Dresseurs,
proprietaire de chaque Pokemon et actifs. Une proposition de jonction valide les
identifiants, camps pleins et compositions, exige au moins un Pokemon de l'invite,
limite chaque Dresseur a trois Pokemon et recueille les accords requis. Son
acceptation passe le combat en double et active un Pokemon de chaque participant.
Le resolveur indique ensuite quel joueur a autorite sur chaque slot.

Deuxieme noyau implemente le 2026-10-04 : le protocole v9 transporte la
participation et la proposition dans chaque snapshot. L'invite choisit le camp et
la composition finale depuis un panneau en jeu ; l'hote accepte ou refuse avant le
premier tour. La room persiste proposition, accords, proprietaires et actif, bloque
les actions pendant la decision et n'accepte ensuite l'action que du proprietaire
du Pokemon actif. Une reconnexion restaure ces informations. Les rencontres du
monde reseau utilisent ce flux ; publier les combats narratifs actuellement locaux
de Pokemon Z dans la room reste le lot suivant avant une recette manuelle complete
depuis le parcours source.

Troisieme fondation commencee le 2026-10-04 : la restitution d'un camp mixte est
desormais filtree par proprietaire avec `storeOwnedBattleResults`. Elle ne recopie
que PV, statut, PP et actif des Pokemon personnels presents dans le combat ; les
Pokemon ecartes et ceux de l'autre Dresseur restent intacts. La publication du
combat source attend encore la conversion du journal autoritaire des engagements
et K.O. pour attribuer l'EXP au bon proprietaire, y compris apres un changement
d'actif. `SharedBattleLedger`/`recordSharedBattleTurn` enregistre les actifs
successifs et battlers vaincus sans doublon ; la room le met a jour, le publie et le
restaure deja. La conversion en gains selon les courbes source constitue le prochain
sous-lot.

Plan global valide le 2026-10-04 :
[`SHARED_SOURCE_BATTLE_PLAN.md`](SHARED_SOURCE_BATTLE_PLAN.md) decoupe la suite en
stabilisation, session/reglement communs, publication des combats source, jonction,
boucle tactique autoritaire, resultats personnels, reprise narrative et E2E. Le
jalon ne sera coche qu'apres un sauvage et un Dresseur reels valides en solo, chez
l'hote, chez l'invite et apres reconnexion.

Premier increment du plan implemente le 2026-10-05 : le lot de stabilisation est
termine. Le noyau refuse les participations et propositions incoherentes ; un refus
de jonction ne perd plus le journal. Les engagements sont desormais suivis par
adversaire et chaque K.O. fige ses participants eligibles. Une projection pure
filtre ces credits par proprietaire et les anciens journaux v9 sont migres lors de
la restauration.

Deuxieme increment du plan implemente le 2026-10-05 : `SharedBattleSession`
formalise le cycle irreversible `invite-choice -> join-window -> active -> settling -> closed`
(avec la branche directe `invite-choice -> active`),
exige un resultat tactique avant le reglement et conserve un identifiant de
reglement stable. La projection de chaque K.O. expose aussi le nombre total de
participants conscients du camp. `player-state` reproduit la branche participant
de l'override final `repexp.rb` (partage, bonus Dresseur, coefficients Z, switches
661/252/624, Oeuf Chance, plafond de badges et troncatures) puis applique uniquement
les gains du proprietaire concerne dans l'ordre des K.O. Le lot 1 reste ouvert
pour l'idempotence persistante ; Partage Exp/Exp Tous attendent le noyau d'objets.
La publication de ce cycle et du contexte source dans la room commence au lot 2.

Troisieme increment du plan implemente le 2026-10-05 : le protocole v10 publie un
`SourceBattleContext` strict et l'intention host-only `openSourceBattle`. Le
controleur source remet a la room le meme brouillon que celui utilise localement,
sans demarrer un second combat client. Carte, presentation logique, adversaires,
faits de recompense, politique d'EXP et continuation sont bornes ; aucune sauvegarde
privee n'est transmise. La room valide la carte et le manifeste, initialise combat,
participation, journal et cycle atomiquement, ferme la jonction au premier tour et
persiste le resultat en `settling`. Le chemin solo utilise aussi ce cycle, fuite
sauvage comprise. La recette manuelle a deux navigateurs reste ouverte ; reglement
personnel, fermeture/reprise narrative, fuite reseau et IA source complete restent
dans leurs lots suivants.

Quatrieme increment du plan implemente le 2026-10-05 : le protocole v11 finalise
la fenetre de jonction. L'invite present sur la carte choisit explicitement
Observer, Rejoindre l'hote ou Rejoindre l'adversaire. Sa decision d'observer, les
proprietaires et la composition survivent a la reconnexion. La composition finale
est revalidee par la room : six membres au maximum, identifiants uniques entre
camps et au moins un Pokemon de chaque joueur lors d'une jonction alliee. L'hote
voit les membres retenus et doit traiter toute proposition avant de fermer la
fenetre ; le premier tour autorise la ferme aussi. Une intention d'observateur ne
peut pas avancer le cycle. La recette deux navigateurs reste a effectuer avant de
valider visuellement ce lot.

Cinquieme increment du plan implemente le 2026-10-05 : le protocole v12 termine la
boucle tactique autoritaire du lot 4. Le noyau commun choisit les capacites et les
remplacements des Pokemon source sans proprietaire avec la RNG autoritaire ; le
solo utilise les memes fonctions. Attaque, changement et remplacement sont routes
vers le proprietaire de l'actif ou du reserve eligible, sans permettre d'envoyer
le Pokemon d'un autre joueur. Une deconnexion annule l'intention de ce proprietaire
et conserve le meme tour jusqu'a sa reconnexion. Seul le proprietaire narratif
peut demander une fuite sauvage ; tentative, resultat et compteur survivent a la
restauration de room. La regle de capture future refuse deja toute cible possedee
par un invite. La validation manuelle a deux navigateurs reste ouverte.

Sixieme increment du plan implemente le 2026-10-05 : le lot 5 regle chaque
participant separement. La room fige un resultat autoportant par proprietaire,
adresse seulement au joueur concerne et le conserve jusqu'a son accuse, y compris
apres export/restauration et deconnexion. Le client fusionne ressources puis EXP
dans ses Pokemon persistants, applique l'argent narratif autorise et journalise les
128 derniers identifiants avant l'accuse. Un doublon ou une reconnexion ne peut
donc pas rejouer un gain. Plusieurs reglements en retard sont remis l'un apres
l'autre sans bloquer l'hote. La presentation de fin accepte desormais plusieurs
gains d'EXP. Objets rares et continuation de l'histoire restent reserves au lot 6.

Septieme increment du plan implemente le 2026-10-05 : le lot 6 ferme un combat
source uniquement sur intention de l'hote et apres l'accuse de son reglement. La
room retire alors la scene publique sans supprimer les gains encore dus a un
invite absent. Introduction, tours, K.O., EXP, argent, audio et fondu utilisent la
meme file d'animations ; une reconnexion sur un resultat deja termine repasse par
une fin coherente. Le snapshot ferme reprend exactement une fois la continuation
locale gardee par le controleur, puis les mutations narratives normales de l'hote
sont republiees. Victoire, defaite et fuite suivent les branches solo. La recette
deux navigateurs et la reconstruction du curseur narratif apres rechargement total
restent au lot 7.

Correctif transversal valide le 2026-10-05 avant le lot 7 : le premier Dresseur
ordinaire de route a revele la signature longue de `pbTrainerBattle` et les hooks
de presentation propres aux pages Dresseur. Le portage couvre maintenant ces
formes de facon generique, ainsi que le contact initie par le joueur contre une
page fixe `trigger 2`. Le scenario reel Jean/CAMPESINO version 0 atteint le combat
et son self-switch de victoire. Le defi PvP classique est egalement repropose a
partir des positions et orientations autoritaires de la room, que l'initiateur
soit l'hote ou l'invite ; il ne touche pas a l'histoire de l'hote.

Mise en scene Dresseur validee le 2026-10-05 : `Trainer(n)` pilote maintenant une
ligne de vue bornee et respectueuse des collisions. `pbNoticePlayer` est porte par
la commande auditee `trainer-notice` : bulle d'exclamation, orientation et marche
jusqu'au joueur precedent le dialogue. La route est executee une seule fois par
l'hote et replique ses poses et son effet aux invites presents. Ce lot reste
generique pour les 258 appels `pbNoticePlayer` releves dans les cartes locales.

Dialogue standard de victoire Dresseur valide le 2026-10-05 : le texte `_I`
embarque dans `pbTrainerBattle` est extrait, localise et affiche dans la fin de
combat avant l'EXP et l'argent, en solo et via le contexte de presentation de la
room. La boucle standard couvre donc detection, dialogue avant combat, equipe,
phrase de defaite, self-switch de victoire et dialogue d'apres-combat.

Variantes Dresseur explicitement reportees a des lots ulterieurs, a traiter par
capacites generiques lorsqu'elles apparaissent dans le parcours :

- revanche et remise a zero volontaire de l'etat vaincu ;
- selection d'equipe ou de version par scripts conditionnels non encore portes ;
- boss et scripts speciaux modifiant les regles pendant le combat ;
- six appels a arguments implicites du Doppelganger Majara sur Map263.

L'audit actuel extrait correctement texte, format, version et droit a la defaite
sur 516 appels `pbTrainerBattle` parmi 522. `canLose` est deja respecte. Les formats
doubles source sont maintenant transmis au moteur double commun ; leur recette
manuelle sur les cartes concernees reste necessaire avant cloture du lot.

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

Rectification d'audit du 2026-10-13 : « accepte » ne signifie pas « complet ».
`CHLOROPHYLL` attend encore l'etat meteo du combat et est donc partiel ; `STATIC`
a ete corrige pour pouvoir se declencher apres le K.O. de son porteur. Le rapport
ne compte plus les talents meteorologiques comme pleinement supportes sur la seule
base de leur identite.

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
- [x] prendre en charge les declencheurs contact, automatique et parallele ;
- [x] afficher overworld, menus et combat dans une seule scene de jeu avec transitions ;
- [x] ajouter le menu en jeu : equipe, sac, sauvegarde et options ;
- [x] sauvegarder la carte et la position courantes ;
- [x] porter le Miroir de la Vérité (`#EOT HIDE/SHOW`) avec collisions personnelles
  communes au solo et à la room Coop ;
- [x] généraliser les raccourcis de terrain configurables pour la Boussole, le
  Miroir de la Vérité, la Pêche et Chevroum ;
- [x] porter les rochers Éclate-Roc propres à Z : événement commun de fabrication,
  Poudre Explosive, disparition persistante ou temporaire et rencontre optionnelle ;
- [x] porter les arbustes Coupe propres à Z : fabrication contextuelle de la
  Hachuela Endeble, son et animation 19, récompenses, casse et disparition Coop ;
- [x] porter les 18 amulettes de type : usage depuis le Sac, effet personnel de
  500 pas, filtre source à 50 %, persistance et tables marche/grotte/pêche/Éclate-Roc ;
- [x] porter les objets d’Illysée : chaîne Regadera Mágica, Talisman de Malvo
  sensible à la position et mutation du monde réservée à l’hôte en Coop ;
- [x] porter le prédicat de l’énigme Zarbi ETERNO à partir des formes ordonnées de
  l’équipe persistante ;
- [x] porter le minijeu de fouilles déclenché par Marteau + Ciseau : plateau 13 × 10,
  burin/marteau, métal, fissures, trésors source, sons, récompenses personnelles,
  commande `pbMiningGame` auditée et raccourci Test dev ;
- [x] porter l'interface Guide des personnages depuis son catalogue Ruby et sa
  variable de progression 240, avec un repli explicite lorsque les infographies
  référencées sont absentes de la distribution ;
- [ ] porter PokéObjectif lorsque sa table d'objectifs ou son gestionnaire source
  sera disponible : la v2.12 FR ne fournit que l'objet, sans logique d'utilisation ;
- [x] proposer un prologue condense sur une installation vierge puis reprendre la scene source de Map002 ;
- [ ] valider le parcours Map002 vers Map003, Map007 puis Map009.
- [x] automatiser et valider Route 3 → Bois-en-Tronc (Maps 023 à 029) : Dresseurs,
  branche simple/double selon l'équipe apte, rencontres de nid et récompenses
  post-victoire autoritaires. Le parcours et les deux nids ont été validés
  manuellement avec les assets locaux le 2026-10-19. Le rendu générique des
  commandes `jump` de PNJ a ensuite été corrigé (arc, durée selon la distance et
  réplication Coop) pour la vieille dame de Map029/EV026 ; cette scène précise
  attend une nouvelle vérification visuelle.
- [ ] fermer Route 5 (Maps 055–056) avec l'audit `map:ID`, les rencontres et les
  cinq Dresseurs. Le portage automatisé est terminé : fonctions à compteur et à
  contexte, Morphing/Imposteur, climat/terrain, talents de contact et contrats
  solo/room sont dans le noyau commun. Après `prepare:local`, `map:55` est à zéro
  alerte et `map:56` ne conserve que `FAINTATTACK`, réellement absent de
  `move2anim.dat` et rendu par le fallback prévu. Reste uniquement la recette
  manuelle solo/hôte/invité/reconnexion avant de cocher le lot.
- [ ] valider manuellement le combat narratif de Núbila à la Clairière Collinaire
  (Map046/EV020). Le blocage de construction est corrigé : index de talent caché
  Essentials, Acidarmure, Gyroballe, Ignifugé, Alchimie Vil et Baie Lichii sont
  portés dans le noyau partagé. L'audit ciblé ne conserve que l'animation source
  absente de `LUZDECADENTE`, couverte par le fallback prévu.
- [ ] porter progressivement les effets des talents source encore inertes ; leur
  identite valide est conservee et repliquee sans bloquer les combats.
- [ ] terminer la Méga-Évolution ; les lots 1 à 4 extraient automatiquement les
  106 espèces/114 formes, transportent les gemmes et l'intention, puis appliquent
  autoritairement forme, caractéristiques, types et talent avec un usage par
  propriétaire en solo, PvP et Coop. Les deux animations communes, leurs plans,
  sons et changement de sprite sont raccordés. Restent les effets des
  talents/climats que le moteur général ne sait pas encore rendre et la validation
  manuelle complète des variantes de forme. Le lot 5 ajoute un périmètre d'audit
  `mega:ESPECE:FORME`, contrôle automatiquement les références d'acquisition des
  gemmes et porte seize talents déterministes dans le noyau partagé. Le lot 6
  ajoute les conversions de type, Lévitation, Querelleur, Anti-Bruit et Sans
  Limite, avec un premier contrat Brise Moule audité comme partiel. 59/114 formes
  ont désormais leur talent actif ; les 55 autres restent reliées aux 38 talents
  généraux précisément listés par `battle-integration-report.json`. L'audit source
  confirme également trois gemmes sans acquisition événementielle
  (`DURALUDONITA`, `GROUDONITE`, `RAYQUAZITE`), dont `GROUDONITE` absente du
  catalogue d'objets ; ne pas inventer leur distribution.

Jalon nouvelle partie du 2026-10-05 : l'absence de sauvegarde ouvre un resume
passable des cartes d'introduction avant trois choix issus des sources (difficulte,
mode normal/Nuzlocke et region des starters) et la personnalisation partagee du
heros. Le resultat initialise les switches et variables source, cree la premiere
sauvegarde en Map002 puis lance son autorun original. La recherche de Christian,
les starters, Keunotor et la rencontre avec Christian ne sont pas remplaces par un
resume. La preparation est personnelle avant la Coop ; dans une room, l'etat
narratif de l'hote et le profil public reprennent les contrats autoritaires deja en
place. Les regles Nuzlocke completes restent une dette explicite.

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

Dixieme noyau 9.7 implemente le 2026-09-29, corrige le 2026-10-09 : l'onglet
Sauvegarde cree un emplacement manuel versionne, distinct des checkpoints de soin.
Son schema v2 capture ensemble carte, coordonnees, direction, equipe, Sac et etat
narratif. Un lancement solo a froid restaure donc les drapeaux de combat de la
derniere sauvegarde explicite au lieu de conserver une victoire obtenue apres
celle-ci. La copie de travail automatique reste prioritaire uniquement lorsqu'un
marqueur confirme qu'un combat Coop etait encore actif, pour proteger les
reglements deja accuses. Un ancien ticket de room seul ne peut donc plus faire
ignorer la sauvegarde manuelle pendant une partie solo.
Les anciennes positions v1 sont migrees sans inventer un etat historique. Une
position mal formee, inaccessible ou hors carte est rejetee puis ramenee vers
Bourg Canvas. Le menu minimal couvre desormais equipe, sac, sauvegarde et options ;
le volume est memorise en attente du raccordement des commandes audio de
cinematique.

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

Seizieme noyau 9.7 implemente le 2026-09-30 : le transfert de Bourg Canvas vers le
laboratoire peut lancer l'autorun `crisanto` de Map005. Le resoluteur reconstitue
les appels Ruby repartis entre `ruby-script` et leurs continuations ; les hooks de
presentation du compagnon absent du moteur web sont absorbes explicitement. Le cri
de Pokemon resout maintenant l'espece dans `pokemon-assets.json` et lit son asset
source. Avec un des trois interrupteurs de starter actif, la scene du laboratoire
compile 302 commandes, 30 dialogues et 182 commandes de mouvement sans blocage ni
rendu en attente.

Correction de route Map005 validee le 2026-09-30 : l'audit execute desormais une
validation pure de chaque primitive contenue dans les routes. `play-sound`, utilise
juste avant le saut de M. Mime hors du bocal, transmet son fichier, volume et pitch
a la couche audio. Une primitive inconnue est donc signalee par l'audit avant la
lecture, au lieu d'interrompre la sequence et de rendre les controles en plein
milieu d'une cinematique.

Dix-septieme noyau 9.7 implemente le 2026-09-30 : les zones de contact non visibles
peuvent lancer une sequence source, pas seulement un transfert. Une condition Ruby
`pbTrainerBattle` devient une transition differee vers le moteur de combat, avec
equipe chargee depuis `trainers.json`, musique issue de `trainer-types.json`, fuite
interdite et reprise de la sequence a la fin. Le premier duel contre Crisanto choisit
ainsi Grenousse, Marisson ou Feunnec niveau 5 selon la variable de starter. Le
switch 70 active ensuite generiquement la page automatique d'apres-combat. Ses
dialogues, mouvements et gains d'objets sont joues dans l'ordre sans rendre les
controles entre les deux pages. Les trois plans d'avant-combat comptent
59 commandes, 7 dialogues et 30 mouvements ; le plan d'apres-combat compte 111
commandes, 16 dialogues et 52 mouvements. Leurs audits ne signalent aucun rendu en
attente.

Correction du duel Crisanto validee le 2026-09-30 : son transfert initial vise la
carte courante. Ce cas repositionne desormais la scene sans recharger les assets ni
programmer un autorun d'entree parasite. L'executeur intercepte egalement toute
exception inattendue, rend les controles et nomme la commande fautive dans le
panneau au lieu de conserver une sequence figee. Le contact joueur est maintenant
cherche dans la direction du pas demande, avant la collision : la zone de Crisanto
peut ainsi se declencher depuis `40,15` bien que sa tuile ne soit pas franchissable.
Dans une sequence, le transfert vers la carte courante est maintenant un
repositionnement synchrone ; aucun interstice de changement de carte ne peut donc
relancer la zone avant le premier mouvement impose. L'etat courant du lecteur est
visible dans le panneau Moteur.

Correction de classification : `map.transfers` indexe toute page contenant un
transfert, y compris EV028 et ses 87 commandes. Un contact joueur n'utilise donc
plus cette presence comme raccourci de porte ; il lance toujours son plan de scene,
qui executera le transfert a sa position exacte. Cela supprime la boucle de
teleportation en `40,15` qui sautait toute la cinematique du duel.

Dix-huitieme noyau 9.7 implemente le 2026-09-30 : le trajet de Bourg Canvas a la
Route 1 (`Map003 -> Map007`) puis a la carte suivante (`Map009`) est raccorde. Les
interactions directes qui ne contiennent pas de choix passent desormais par le meme
lecteur que les cinematiques ; cris, sons, animations, mouvements et changements
d'etat sont donc conserves dans leur ordre source. Les 24 pages actives de Map007
sont resolues et auditees sans commande inconnue ni rendu en attente.

Le premier raccord des evenements paralleles initialise leurs effets de
presentation lors du chargement de carte. EV025 applique ainsi le panorama
`fondoAgua` et son defilement ; le noyau vingt-quatre generalise ensuite leur
execution en boucle. Les gains d'inventaire declenchent egalement le
jingle `ItemGet`, un texte avec nom francais et quantite, puis la pose source
`trchar000_2`, accompagnee d'un court saut, jusqu'a la fermeture du message. Le
canvas laisse aussi ses pixels sans tuile transparents afin que le panorama soit
visible au lieu d'etre masque par son ancien fond opaque. Cela couvre aussi bien les objets
ramasses directement que ceux remis au milieu d'une sequence.

Recette manuelle : apres Crisanto, prendre la sortie nord de Bourg Canvas, verifier
le panorama anime et les cris, ramasser plusieurs objets, provoquer une rencontre
dans les hautes herbes puis atteindre Map009 par la sortie nord. Les boucles
paralleles sont maintenant ordonnancees par le noyau generique decrit plus bas ;
le parcours complet reste a valider manuellement avant de cocher le jalon global.

Dix-neuvieme noyau 9.7 implemente le 2026-09-30 : la grande scene d'arrivee de
Map009 peut maintenant etre lue jusqu'au bout. L'appel Ruby qui active le Pokedex
devient un etat personnel persistant, sans imposer encore d'ecran Pokedex. Le choix
de son interface, comme celui de la carte, est reporte a une refonte
graphique ulterieure. Le plan resolu d'EV011 compte 238 commandes, 36 dialogues et
110 commandes de mouvement ; ses acteurs, sprites et effets sont complets et son
audit ne signale aucun rendu en attente.

Premier lot Ranch implemente le 2026-10-02 : `pbPokeCenterPC` ouvre maintenant une
collection personnelle persistante pour l'hote comme pour l'invite. L'ecran reunit
equipe et stockage, affiche les icones source et combine recherche, deux types,
bornes de numero, puissance actuelle et potentiel avant un tri par numero, nom,
niveau ou puissance. La carte Pokemon et son modele sont partages avec l'onglet
Equipe et prepares pour les selections de combat. Les icones de types ont ensuite
ete centralisees dans le paquet versionne `game-assets` afin d'etre reutilisees
par toutes les interfaces. Le deuxieme lot raccorde les transferts persistants
equipe/Ranch : il conserve au moins un Pokemon dans l'equipe, respecte la limite
de six et reste strictement personnel en solo comme pour chaque place Coop.
Restent a porter la capture et la fiche de statistiques detaillee.

Troisieme lot UI de collection implemente le 2026-10-02 : les cartes communes de
l'equipe et du Ranch remplacent les scores de puissance visibles par les PV et les
quatre capacites typees. Un menu radial contextuel expose les familles d'actions
du jeu source ; placement en tete et transferts sont fonctionnels, tandis que la
fiche detaillee, les objets, marques, liberation et actions de combat restent
explicitement desactivees jusqu'a leurs lots respectifs. Les mutations actives
utilisent le noyau personnel persistant commun au solo, a l'hote et a l'invite,
sans publier la collection privee dans la room.

Plan de fiche detaillee valide le 2026-10-02 :
`docs/POKEMON_DETAILS_PLAN.md` inventorie les cinq pages et la sous-page avancee
de Pokemon Z V2.12 FR, les donnees disponibles, les briques manquantes et le
contrat solo/Coop. Chaque increment doit reverifier scripts, donnees, assets et cas
speciaux propres a cette version avant implementation. L'ordre commence par le
modele persistant et sa migration deterministe, puis l'identite du Dresseur, le
calculateur IV/EV/nature, les catalogues/assets et enfin la fiche en lecture et
ses mutations. `Placer en tete` est reserve au contexte Equipe et ne doit pas etre
propose depuis le Ranch.

Premier increment de modele implemente le 2026-10-03 : le Pokemon persistant a
desormais un bloc personnel versionne couvrant les champs necessaires aux cinq
pages de Z. La migration des sauvegardes existantes est deterministe et valide les
IV/EV selon les plafonds confirmes dans le script source, sans recalculer encore
les statistiques visibles. Les champs historiques non reconstructibles restent
explicitement inconnus. La suite de l'etape 1 devra enrichir ce contrat lors de la
creation avec les donnees d'espece et de Dresseur, apres mise en place de
l'identite stable de l'etape 2.

Etape 2 de la fiche detaillee implementee le 2026-10-03 : une identite Dresseur
privee 32 bits est maintenant creee et migree avec la selection de personnage,
sans entrer dans le profil reseau. La fabrique Pokemon commune renseigne pour les
ajouts scenarises le DO, l'ID public, le genre, le bonheur, la carte, la date et la
ball selon les donnees et scripts de Z. Le seuil shiny specifique de la version
(100/65 536) est respecte. Une projection publique sans trainerId, IV/EV ni
historique prepare les futurs usages Coop ; aucune nouvelle donnee personnelle
n'est repliquee par la room dans ce lot.

Etape 3 de la fiche detaillee implementee le 2026-10-03 : le calcul simplifie a
IV 31/nature neutre est remplace par le calculateur exact de Z pour la creation,
la montee de niveau et la restauration. IV, EV, nature, ordre source des
statistiques, troncatures et cas PV de base egal a 1 sont couverts. Les anciennes
equipes et le Ranch sont recalcules au chargement en conservant les degats et le
K.O., avec une protection contre un K.O. provoque uniquement par la migration.
La mutation reste personnelle en solo, chez l'hote et chez l'invite ; le combat
et le rendu distant reutilisent les statistiques persistantes deja existantes.

Etape 4 de la fiche detaillee implementee le 2026-10-03 : le catalogue runtime
expose les talents, descriptions, cibles et champs d'espece verifies dans Z. Les
traductions francaises extraites ont priorite. Le correctif du 2026-10-12 raccorde
également `pokedexEntries` depuis `french.dat`, qui remplace désormais l'entrée PBS
anglaise. Un resolveur commun couvre formes, variantes, genre,
shiny, face/dos, icones, overworld, empreintes et cris avec replis deterministes.
Les feuilles de categorie, rubans, shiny, statuts, Pokerus et les 24 Balls sont
indexees pour la future fiche sans copier les sources dans Git.

Ce meme contrat alimente deja les cartes de collection, suiveurs et combats. En
Coop, seule l'apparence publique minimale des battlers et suiveurs est repliquee
et preservee par la room ; toute donnee personnelle demeure locale. L'etape 5
peut maintenant construire les cinq pages de lecture et decouper les feuilles
fixes preparees par ce lot.

Etape 5 de la fiche detaillee implementee le 2026-10-03 : un ecran commun en
lecture s'ouvre depuis l'Equipe, le Ranch et le combat. Ses cinq pages reprennent
Identite, Historique, Stats, Capacites et Rubans, avec navigation au clavier,
changement de Pokemon et cri de forme. La fiche lit les donnees persistantes,
catalogues francais et assets locaux reels ; sa sous-page avancee expose IV/EV,
bonheur et Puissance Cachee selon les regles controlees dans Z.

Les donnees non disponibles ne sont pas inventees : nom du lieu historique, etat
obscur et cycle complet des oeufs/rubans restent explicites. Les descriptions
Pokédex françaises sont raccordées depuis `french.dat` depuis le 2026-10-12. La
page Capacites affiche seulement les quatre attaques typees et leurs PP avant le
lot 6. La consultation reste personnelle en solo comme pour chaque participant
Coop ; une projection publique minimale testee exclut toutes les metadonnees
privees et aucune nouvelle information n'est repliquee par la room.

Etape 6 de la fiche detaillee implementee le 2026-10-03 : la page Capacites
affiche maintenant categorie, puissance, precision, PP et description francaise,
avec les conventions `???` et tiret du script source. Une selection en deux temps
permute les emplacements dans le noyau persistant commun a l'Equipe et au Ranch.
Le pont de combat consomme directement cet ordre lors de la creation de l'equipe ;
la fiche d'un combat deja actif reste en lecture seule afin de ne pas diverger de
l'etat autoritaire du tour.

Cette mutation appartient au joueur et suit exactement le meme chemin local en
solo, chez l'hote et chez l'invite. Elle n'est pas repliquee, tandis que la
sauvegarde personnelle la restaure apres reconnexion. Le sprite de fiche n'affiche
plus la feuille horizontale comme une image unique : un canvas la decoupe selon
les dimensions et `frameCount` du manifeste, puis anime les images au rythme de
120 ms retenu pour la lisibilite du portage. La reduction d'animations et l'annulation
des boucles lors d'un changement de Pokemon sont prises en charge.

Correctif du 2026-10-03 : les petites icones des cartes Equipe/Ranch et de la roue
d'action alternent leurs deux poses source. Leur cadence suit aussi la logique de
`PokemonIconSprite` : normale au-dessus de la moitie des PV, ralentie sous la
moitie puis le quart, et figee au K.O. Le rendu de la fiche detaillee a en parallele
ete accelere de 250 a 120 ms par image a la demande du porteur.

Correctif de boucle sauvage implemente le 2026-10-02 : un `pendingEncounter`
personnel n'inhibe plus indefiniment les rencontres apres la suppression du bouton
HUD historique. Le pas suivant reprend automatiquement une rencontre valide ; une
creation aleatoire invalide est purgee et rearme le compteur, tandis qu'une
rencontre scriptée reste protegee pour ne pas contourner l'histoire. Le contrat est
commun au solo, a l'hote et aux excursions personnelles de l'invite ; le monde
partage continue volontairement de laisser l'autorite des rencontres a l'hote.

La commande native `weather` restitue l'effacement, la pluie, l'orage et la neige
dans une couche legere superposee a la carte. `erase-event` est absorbe comme
effacement temporaire : l'autorun ne reboucle pas pendant la visite et redevient
disponible apres un rechargement de carte, comme dans RPG Maker. L'autorun EV035
de Map009 compile ainsi ses 5 commandes sans blocage. Les identifiants d'objets
mixtes sont egalement preserves, ce qui rend l'objet `ACapsula` d'EV040 compatible.

Vingtieme noyau 9.7 implemente le 2026-09-30 : les interactions reconnaissent le
drapeau de passage `0x80` des comptoirs RPG Maker. Le joueur peut donc parler a un
evenement situe une case derriere un comptoir, sans assouplir les collisions. Les
choix sont maintenant integres au lecteur de sequence : celui-ci execute le prefixe,
attend la reponse, recompile uniquement la branche retenue puis reprend au curseur
exact. Dialogues, etat, mouvements et effets audiovisuels restent ainsi dans leur
ordre source.

L'infirmiere de Map010 EV004 constitue le premier parcours valide de cette capacite.
La branche Oui compile 19 commandes, 3 dialogues et 4 commandes de mouvement sans
rendu en attente. Elle enregistre le checkpoint, soigne PV, statuts et PP, joue le
fondu et le jingle, anime l'infirmiere puis affiche son message final. Le refus
compile 5 commandes et laisse l'equipe intacte. Le soin reste gratuit.

`SourceEventState` possede desormais un portefeuille personnel. Une ancienne
sauvegarde migre vers les 3 000 ₽ initiaux du jeu source ; la valeur est bornee
entre 0 et 999 999 ₽. Les commandes natives `change-money` et les conditions
`gold` sont executees, et le solde apparait discretement dans le panneau moteur et
l'onglet Sac.

Vingt-et-unieme noyau 9.7 implemente le 2026-09-30 : les appels multilignes
`pbPokemonMart` exposent leur stock a une boutique legere superposee a l'overworld.
Nom et description localises, prix, quantite possedee et solde viennent des catalogues
extraits. Chaque achat unitaire verifie fonds et capacite du sac avant une mise a jour
atomique persistante ; fermer la boutique reprend exactement la sequence appelante.
Les deux stocks conditionnels de Map010 EV005 utilisent cette capacite generique.

Les resultats de combat alimentent maintenant le portefeuille. Une victoire de
Dresseur applique `niveau maximal adverse × baseMoney` ; une defaite applique la
table source dependante du nombre de badges, plafonnee au solde, et respecte le
switch 33 `NO_MONEY_LOSS`. Les multiplicateurs lies aux objets tenus ou aux effets
de combat seront ajoutes lorsque ces mecanismes existeront.

Vingt-deuxieme noyau 9.7 implemente le 2026-10-01 : le contact peut maintenant etre
initie par l'evenement lui-meme. Les routes autonomes personnalisees `moveType 3`
sont conservees par le chargeur et executees en boucle avec leurs pas cardinaux,
orientations et attentes. Lorsqu'un pas aleatoire ou personnalise d'une page
`trigger 2` vise la case du joueur, l'evenement reste sur sa case et sa sequence
source auditee demarre. Cette capacite generique couvre notamment les 23 pages de
contact a mouvement aleatoire et les 62 pages a route personnalisee observees dans
les donnees locales ; les 189 pages fixes etaient deja joignables par le contact
initie par le joueur.

Correction du 2026-10-05 : le contact initie par le joueur accepte explicitement
les deux semantiques source `trigger 1` (contact joueur) et `trigger 2` (contact
evenement). Cela rend effectivement joignables les pages fixes annoncees
ci-dessus, notamment les Dresseurs de route qui ne peuvent pas avancer eux-memes.

Vingt-troisieme noyau 9.7 implemente le 2026-10-01 : la commande
`play-background-sound` passe de reconnue a rendue. Elle lit `Audio/BGS`, boucle
l'ambiance independamment de la musique BGM et remplace ou arrete proprement la
piste precedente. Son volume suit le reglage global sans perturber les sons
ponctuels et les jingles.

Vingt-quatrieme noyau 9.7 implemente le 2026-10-01 : les pages `trigger 4` ne sont
plus reduites a une initialisation visuelle. `SourceParallelController` lance une
tache concurrente par carte, evenement et page active, repete son plan avec un
minimum d'une frame RPG Maker, puis l'annule lors d'un changement de page ou de
carte. Mutations persistantes, attentes, effets audiovisuels et routes de mouvement
sont executes dans leur ordre, avec les barrieres de mouvement existantes. Les
pages qui demandent une interaction exclusive — dialogue, choix, combat, boutique
ou transfert — sont promues dans le lecteur de scene puis resynchronisent les
boucles a leur terminaison. Une mutation d'etat peut egalement activer une nouvelle
page parallele sans recharger la carte.

Vingt-cinquieme noyau 9.7 implemente le 2026-10-01 : `set-follower` n'est plus une
commande seulement reconnue. Son activation est conservee dans l'etat personnel
avec migration des anciennes sauvegardes possedant deja une equipe. Le Pokemon actif de l'equipe resout son
sprite overworld par `pokemon-assets.json`, apparait sur une case praticable derriere
le joueur et rejoint chaque case liberee avec la meme interpolation de grille. Un
transfert ou un chargement de carte le replace proprement sans sauvegarder une
coordonnee visuelle devenue obsolete. Le rendu rejoint la pile de profondeur des
PNJ, du joueur et des tuiles prioritaires.

Correction des choix de starter le 2026-10-01 : la boucle parallele visuelle de
Map002 ne reconstruit plus toute l'interface toutes les 25 ms. Le panorama conserve
son animation sans remplacer les boutons de dialogue ; la vue reutilise aussi les
memes noeuds Oui/Non tant que les choix n'ont pas change. Un clic commence et se
termine donc sur le meme bouton.

Correction visuelle du Sac : les fiches d'objet de la boutique et de l'inventaire
chargent desormais leur sprite source `itemNNN.png`, avec `item000.png` en repli.
Les huit `bagPocketN.png` retrouvent leur role de selecteurs de categorie. Le Sac
regroupe et trie les objets selon le champ `pocket` extrait, affiche le nombre de
types par poche et conserve la poche selectionnee pendant la session.

### Chantier profil joueur et personnalisation

Ce chantier est volontairement isole de la progression source pendant sa phase de
validation. Le laboratoire de personnalisation possedera son propre etat local : il
ne changera ni le sprite de l'overworld, ni la sauvegarde narrative, ni Map001, ni
le profil effectivement transmis au multijoueur avant un raccord explicite.

- [x] extraire les six profils historiques et auditer leurs contextes graphiques ;
- [x] definir un `PlayerProfile` cosmetique, strict et versionne ;
- [x] construire le laboratoire autonome avec apercus overworld, portrait et combat ;
- [x] preparer le contrat reseau du profil sans l'activer dans la partie ;
- [x] reproduire l'introduction de combat, le lancer et l'apparition du Pokemon ;
- [x] appliquer les trois couleurs de tenue sans recolorer peau ni cheveux ;
- [x] raccorder explicitement le profil applique a l'overworld et aux combats ;
- [x] raccorder le profil actif au reseau et aux avatars de la room ;
- [ ] raccorder ulterieurement le profil actif a Map001 ;
- [ ] creer de nouveaux corps, coiffures et tenues — explicitement reporte.

Premier jalon implemente le 2026-10-01 : `extract:assets` produit
`player-avatars.json` et `player-avatar-report.json` depuis `PBS/metadata.txt` et
le manifeste reel des assets. Chaque profil conserve ses contextes overworld,
course, velo, surf, plongee, peche, portrait d'introduction, face et dos de combat,
ainsi que ses variantes de pose. Un asset absent reste visible dans l'audit avec
son repli au lieu d'etre masque. `PlayerProfile`, dans le paquet `player-state`,
decrit separement nom, pronoms, modele, peau, cheveux, tenue et trois couleurs par
identifiants controles ; il n'est encore persiste par aucune vue du jeu.

Deuxieme jalon implemente le 2026-10-01 : `apps/avatar-lab` est une application
Vite autonome lancee par `corepack pnpm lab:avatar`. Elle charge les six profils
depuis les catalogues locaux, anime les quatre poses de chaque charset, permet de
parcourir marche, course, velo, surf et peche, affiche la face du Dresseur et sa
vue de dos principale. Les fichiers suffixes de dos sont inventories comme
variantes narratives, et non comme images d'une animation. Nom, pronoms, profil source et trois couleurs controlees
sont conserves sous la seule cle `pokemon-z-battle.avatar-lab-profile.v1` et peuvent
etre exportes en JSON. Les couleurs sont maintenant appliquees aux PNG par des
masques semantiques calcules depuis les trois ethnies historiques d'une meme
silhouette. Un pixel qui varie entre ces references est protege comme composante
d'identite ; seuls les groupes bleu, or et rouge restes identiques sont associes
aux couleurs principale, secondaire et d'accent. Le meme traitement couvre les
charsets d'actions, la face du Dresseur et son dos de combat, dans l'application
autonome comme dans l'onglet integre.
Le remappage conserve le rapport de luminosite de chaque nuance par rapport a sa
couleur source. Les palettes tres claires, notamment le blanc, gardent donc les
contours, plis et ombrages sombres au lieu d'aplatir les details du sprite.

Le meme laboratoire est integre a l'Overworld Sandbox dans l'onglet `Personnage`,
au meme niveau que Monde source, Prairie et Bosquet. Cet onglet masque la scene et
bloque ses commandes de deplacement sans modifier la partie en cours. Il partage
uniquement la cle cosmetique du laboratoire : supprimer ou reinitialiser une
sauvegarde du monde ne supprime donc jamais le personnage edite.

Cinquieme jalon implemente le 2026-10-01 : le laboratoire distingue maintenant le
brouillon cosmetique du profil actif. Le bouton `Appliquer au joueur` copie le
brouillon dans `pokemon-z-battle.active-player-profile.v1`, sans toucher a la
sauvegarde narrative. Le moteur recharge alors les charsets recolores du modele
choisi, les variantes de pose equivalentes demandees par les routes source et le
dos du Dresseur utilise par l'introduction de combat. Les alias sont resolus par
contexte entre les six profils historiques : une commande visant par exemple une
pose `trcharNNN_2` conserve son intention avec le modele applique. Le profil actif
est restaure au prochain lancement et n'est pas efface avec la position ou l'etat
de l'histoire. Le protocole reseau et Map001 restent volontairement hors de ce
premier raccord explicite.

Sixieme jalon implemente le 2026-10-01 : le nom du profil actif alimente le moteur
de dialogue source. La balise RPG `\\PN` est remplacee apres selection de la
traduction francaise, aussi bien dans les textes que dans les choix, et n'est plus
figee sur `Joueur`. Une session conserve le nom avec lequel elle a commence afin
que ses branches restent coherentes. Les pronoms attendent encore des textes ou
une convention d'interpolation explicite ; l'introduction Map001 reste reportee.

Septieme jalon implemente le 2026-10-01 : le protocole v7 publie un
`NetworkPlayerProfile` valide pour chaque place. La room autoritaire persiste ces
profils, les diffuse dans ses snapshots et accepte leur mise a jour explicite sans
transporter equipe ni progression. Le prototype Prairie/Bosquet affiche desormais
le nom et le charset recolore de chaque participant dans les deux navigateurs. La
recette HTTP/WebSocket complete valide deux profils distincts, reconnexion,
interactions, mouvements et combats. Le monde source de l'hote n'est pas encore
synchronise : il constitue le prochain jalon coop, pas un comportement implicite
de ce raccord cosmetique.

Huitieme jalon implemente le 2026-10-01 : la creation et la jonction ne passent
plus par le panneau technique lateral. L'onglet `Coop` du menu en jeu rassemble
l'adresse du serveur, la creation, le code d'invitation, la jonction, la liste des
participants et la deconnexion. Ce menu reste accessible avec Echap ou M dans les
cartes reseau ; quitter rend la carte source et la sauvegarde personnelle intactes.
Il expose egalement le profil publie et ouvre le laboratoire de personnalisation.
Le bouton `Retour au jeu` restaure la carte precedente et son onglet Coop, sans
reinitialiser la progression ni obliger a recreer le profil.
Cette integration unifie le parcours utilisateur sans pretendre que Prairie et
Bosquet sont deja la carte narrative de l'hote.

Nettoyage UI du 2026-10-02 : Prairie et Bosquet ne sont plus exposes par
l'application, leur vue de demonstration et leurs controles tactiles ont ete
retires. Le sandbox demarre directement sur le monde source. Son chrome externe se
limite au canvas et au diagnostic `Moteur / Evenements`, qu'un bouton permet de
masquer ; personnalisation, sauvegarde, equipe, Sac, deplacements et Coop restent
accessibles depuis le menu du jeu. Les fixtures Prairie/Bosquet du noyau et de la
room sont temporairement conservees comme banc de regression du protocole, sans
route utilisateur.

Neuvieme jalon implemente le 2026-10-01 : le protocole v8 transporte la topologie
compacte de la carte source, les switches et variables visibles et les deux avatars.
La room valide les collisions des deux joueurs et reserve la publication du monde
narratif a l'hote. L'invite charge localement la meme carte sans recevoir equipe,
inventaire ni sauvegarde personnelle.

Dixieme jalon implemente le 2026-10-02 : un `SourceSceneSnapshot` host-only separe
la presentation narrative de la progression. Dialogues, choix affiches, routes de
PNJ et commandes audiovisuelles sont diffuses a l'invite en lecture seule. Celui-ci
observe la scene et ses mouvements interpoles sans pouvoir avancer le texte,
selectionner une branche ou appliquer un effet d'etat. La room persiste ce dernier
etat visuel pour la reconnexion. Le prochain lot Coop pourra raccorder l'observation
des combats source sans donner le controle narratif a l'invite.

Onzieme jalon implemente le 2026-10-02 : l'hote et l'invite soumettent desormais
leurs pas de carte source au meme serveur autoritaire. Chaque resultat est diffuse
immediatement. Le client predit un seul pas local en attendant sa confirmation,
puis interpole les autres avatars depuis leur pose affichee courante sans annuler
une animation sur un snapshot secondaire. Cela supprime les saccades, rollbacks et
teleportations apres une marche continue. Les deux places publient egalement
l'espece de leur suiveur actif sans exposer leur equipe ; la room positionne et
deplace chaque suiveur sur la case liberee, puis les clients chargent son sprite
local et l'animent separement. Les apparences reseau sont conservees entre deux
snapshots identiques au lieu d'etre rechargees, et les suiveurs distants participent
aux collisions autoritaires. Le rendu distant recoit explicitement son index de
frame au niveau `pattern`, aussi bien pour le joueur que pour son suiveur.

Douzieme jalon implemente le 2026-10-02 : une presence `shared`/`away` permet a
l'invite de quitter seul la carte de l'hote par les transferts source. En excursion,
il poursuit ses cartes, rencontres et interactions avec sa sauvegarde personnelle ;
son avatar et son suiveur disparaissent des collisions et du rendu de l'hote. Un
transfert vers la carte actuellement partagee le rattache a une position controlee
par la room. Sur cette carte, les transferts et les evenements contenant le soin
generique `heal-party` sont les seules sequences personnelles autorisees : le Centre
Pokemon restaure ainsi l'equipe et le checkpoint de l'invite sans muter l'histoire
de l'hote. Les profils actifs utilisent en plus une surcharge propre a l'onglet,
afin que deux participants testes sur la meme origine gardent des apparences
distinctes.

Correction d'interpretation le 2026-10-01 : les `trbackNNN_3`, `_4`, `_5` et `_7`
correspondent a des variantes narratives ou de tenue. Le moteur source ne les lit
pas comme une sequence de lancer : il n'anime horizontalement un Dresseur que si
sa planche est plus large que haute, ce qui n'est pas le cas de ces images
`160 × 210/220`. Les deux laboratoires conservent maintenant le dos principal fixe.
Le Dresseur n'a pas d'animation de bras dans le jeu source : son image statique
glisse hors de l'ecran. La trajectoire, l'ouverture de la Poke Ball et l'apparition
du Pokemon sont des effets separes.

Troisieme jalon implemente le 2026-10-01 : `NetworkPlayerProfile` definit la seule
identite cosmetique publiable dans une room. Son schema strict et versionne
associe un preset visuel aux champs semantiques de `PlayerProfile`, refuse les
champs inconnus et ne transporte ni chemins d'assets, ni equipe, ni inventaire, ni
progression narrative. Son activation effective intervient avec le septieme jalon
et le protocole v7.

Quatrieme jalon implemente le 2026-10-01 : l'entree du Pokemon du joueur reprend
la mise en scene de `pbSendOut`. Le dos principal du Dresseur reste statique et
glisse vers la gauche, tandis que `ball00` suit les 20 coordonnees de la courbe
source avec sa rotation et le decalage vertical de 64 px impose en 384 px de haut.
Le battler grandit ensuite de 1/8 de sa taille jusqu'a sa position de combat. Les commandes sont masquees pendant
cette courte introduction et `prefers-reduced-motion` conserve un passage accelere.

Correction visuelle apres validation manuelle : les Dresseurs utilisent leurs
ancrages centre-bas exacts `(128,384)` et `(384,168)`. Un combat de Dresseur montre
d'abord son sprite de face resolu par l'identifiant de sa classe, puis le fait
sortir a droite avec l'apparition de son Pokemon. La phase joueur attend avant de
faire glisser son dos a gauche ; la Ball ne demarre qu'apres ce mouvement initial
et conserve `ball00`, comme `pbSendOut` (pas de faux passage a `ball00_open`).
`IconSprite` affiche le bitmap `ball00.png` complet en 32 x 64 ; il ne s'agit pas
d'une planche de deux frames 32 x 32. Le rendu web conserve donc son ratio 1:2 au
lieu de recadrer sa moitie superieure.

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

### Modes de deplacement partages — premier lot implemente le 2026-10-02

- [x] utiliser un resolveur commun pour le solo, l'hote et l'invite ;
- [x] porter marche, sprint, monture, corniches, Surf, glace, Cascade et Plongee ;
- [x] extraire les permissions de monture et les liens surface/profondeur ;
- [x] convertir les chaussures de course et les appels de monture source ;
- [x] synchroniser mode, action, vitesse, sprite et reconnexion en Coop ;
- [x] ajouter dans le menu un deblocage de test local, sans mutation narrative ;
- [x] conserver le mode dans la sauvegarde de position avec migration `walk` ;
- [ ] valider manuellement chaque terrain sur ses cartes source representatives ;
- [ ] remplacer, si necessaire pour une exploitation publique, la confiance dans
  les prerequis client par une preuve serveur minimale de capacites de session.

Les parois Chevroum du fangame sont des routes d'evenement, et non un terrain
universel : elles utilisent donc le lecteur generique de routes avec un changement
de contexte `mount`. Les deblocages normaux restent issus des badges, objets et
capacites personnels ; le bouton de test n'ecrit aucune de ces valeurs.

Correction visuelle du 2026-10-02 : l'arc Surf est limite a l'embarquement et au
debarquement ; la navigation courante utilise le cycle aquatique source et son
flottement. Chevroum est ralenti et anime ses quatre poses. Les sauts de corniche
n'exigent plus une direction de sortie sur la tuile Ledge, condition absente du
Ruby et trop restrictive pour certaines orientations. Le test manuel multi-cartes
reste ouvert pour les ajustements fins de vitesse.

Correction de transition du 2026-10-02 : l'embarquement conserve le mode terrestre
jusqu'a la resolution de l'intention Surf afin de produire l'arc d'entree. La sortie
ignore le masque directionnel de la tuile d'eau et valide uniquement l'entree sur
la rive, ce qui evite de rester bloque sur une berge franchissable. Le meme
resolveur couvre le solo, l'hote et l'invite.

### Increment 9.8 - Stabilisation du vertical jouable

Decision du 2026-10-05 : les regressions observees pendant la recette manuelle
sont traitees avant l'empilement de nouvelles fonctions. Les identifiants et
contrats complets vivent dans `docs/PRODUCT_BACKLOG.md`.

Ordre convenu :

- [x] `STAB-NET-1` : cycle PvP valide automatiquement et manuellement ;
- [x] `STAB-NET-2` : cycle de presence, grace, notifications, rendu et collisions
  valide dans deux navigateurs le 2026-10-06 ;
- [x] `STAB-WORLD-1` : blocages narratifs, autorite de l'hote, excursions et
  services personnels invites valides dans deux navigateurs le 2026-10-06 ;
- [x] `STAB-WORLD-2` : positions logiques, collisions, interpolation distante et
  reconnexion validees dans deux navigateurs le 2026-10-06 ;
- [ ] `STAB-BATTLE-1` : socle implemente ; validation partielle suspendue aux
  dependances objets/capture, equipes naturelles, regles de combat du parcours et
  acces aux variantes doubles source. Le sequenceur commun transitions, textes,
  PV, KO, EXP et
  musiques implemente, avec ralliement Coop explicite aux combats sauvages ou de
  Dresseur et ouverture sauvage symetrique hote/invite sur la carte partagee ;
  vrai moteur double, controle par proprietaire et ciblage explicite implementes ;
  placements source, HUD types/statuts, envoi du partenaire et consensus de fuite
  implementes ; le HUD emploie aussi les symboles d'equipe source et le genre ;
  en local, un K.O. attend desormais le choix explicite du joueur tandis que l'IA
  seule choisit automatiquement son remplacant, comme dans la room autoritaire ;
  la Ball de capture retombe sur le centre du socle adverse plutot que sur un
  decalage arbitraire lie au sprite ;
  le Dresseur adverse revient avant son dialogue de fin et les statuts principaux
  possedent un effet visuel generique derive des evenements autoritaires ;
  `ebWildAnimationOutdoor` et `ebTrainerAnimation3` sont portees avec leurs frames
  et `vsBall`; toutes les autres transitions source sont reportees apres la
  consolidation globale des fonctionnalites ;
  le changement et le remplacement croises observes pendant la recette sont
  maintenant refuses par la room en simple et en double ; le partage tactique
  precombat reste une extension distincte, uniquement sur consentement des deux
  joueurs ;
  recette solo et deux navigateurs a valider ;
- [ ] `STAB-AUDIO-1` : implementation terminee le 2026-10-12, validation manuelle
  restante. Les BGM/BGS automatiques sont extraites des cartes, mises en pause
  pendant le combat et reprises a leur position de lecture au retour. Le volume
  maitre couvre desormais carte, combat et effets ; la recette doit encore verifier
  solo, hote, invite, changement de carte et reconnexion.

Condition de sortie : aucun avatar ou defi orphelin, meme geometrie autoritaire
pour les deux joueurs, presentation de combat lisible et musique coherente du lieu
au retour de combat. La validation couvre solo, hote, invite et reconnexion.

## Phases produit planifiees

#### Finition overworld en cinq lots (démarrée le 2026-10-12)

Le port ne doit pas recréer ces détails carte par carte. Le noyau
`source-field-effects.ts` dérive les effets depuis le terrain, les passages du
tileset et le contrat de déplacement partagé. Les effets audiovisuels sont locaux
et non persistés ; le mode et l'action qui les déclenchent sont déjà répliqués par
`SourceWorldSnapshot`. Les compteurs qui modifient réellement un Pokémon restent
personnels à son propriétaire et sont sauvegardés sur son client.

- [x] Lot 1, retours immédiats : validation/annulation des dialogues, son de pas
  dans l'herbe, son du saut de corniche et poussière source à l'atterrissage. Le
  blocage demande aussi le SE `bump`, limité à un appel toutes les 250 ms ; le
  lecteur reste silencieux si cet asset RTP absent du dossier de Z n'est pas
  disponible.
- [x] Lot 2, intégration au décor : profondeur de buisson de 12 px et bandes
  translucides conformes au correctif final de Z, ombres masquées dans l'herbe,
  en Surf/Plongée et pour les événements lumineux, et reflets animés sur les
  terrains 6, 16 et 17. Le joueur, le suiveur, les PNJ et l'avatar Coop utilisent
  la même primitive de rendu.
- [~] Lot 3, eau et transitions de carte : marche/Surf/Plongée/Cascade et leur
  rendu distant reposent déjà sur le contrat commun. Le résolveur audio accepte
  maintenant la casse réelle des extensions et replie un nom `.ogg` manquant vers
  le `.wav`/`.mp3` extrait, notamment pour les portes. Z ne joue ni `jump` ni
  `Splash` lors du saut de montée/descente de Surf ; ne pas en inventer. Restent
  la validation des sillages et les variantes de portes sur le parcours complet.
- [~] Lot 4, ambiance : météo, brouillard, panorama, tons, flashes et animations
  de carte sont déjà portés. Les lumières et les treize familles de particules de
  Z restent bloquées par l'absence des commentaires `Particle Engine Type` dans
  les événements extraits ; étendre l'extracteur avant leur rendu.
- [~] Lot 5, systèmes de pas : le bonheur de marche est maintenant persistant et
  conforme à Z tous les 128 pas (tirage individuel, lieu d'obtention, Luxe Ball,
  Grelot Zen). Les dégâts de poison hors combat restent désactivés comme dans
  `settings.rb` de Z. Poké Radar, baies, suie et capacités de terrain nécessitent
  encore leurs états et métadonnées autoritaires dédiés.

Recette manuelle minimale : comparer herbe normale/herbe haute, corniche dans les
quatre directions, flaque/lac avec joueur et invité, ombres en Surf, entrée/sortie
de bâtiment et reprise après reconnexion au voisinage du seuil de 128 pas.

Correctif Coop et terrain du même jalon : les mouvements autonomes des PNJ ne sont
plus interrompus lorsque l'état `idle` de l'hôte arrive avant la fin de
l'interpolation de l'invité. Les positions de routes scénarisées utilisent le
sprite courant, et l'état canonique des PNJ est réappliqué après chaque chargement
de carte. Durant un transfert invité, les snapshots sont différés et un
acquittement tardif de l'ancienne carte ne peut plus recharger celle-ci : cela
supprime le rollback qui obligeait à franchir une porte deux fois.

Les assets source `footset`, `footsetbike` et `waterpondbubble` rendent maintenant
les empreintes temporaires sur le terrain Sable et le sillage animé après chaque
pas sur StillWater, Water ou LagoReflejo. Ces marques sont visuelles et volatiles ;
elles sont dérivées localement du mouvement autoritaire pour le joueur concerné et
son partenaire, sans nouvelle persistance réseau. Les SE de déplacement distant
et les commandes `play-sound` des deux joueurs sont entendus par leur partenaire
sur la même carte avec une atténuation de distance. La room borne le message,
vérifie la présence partagée et ne le transmet qu'à l'autre participant. Ils ne
sont ni persistés ni rejoués après reconnexion.

Réglages audio du même lot : le volume général est remplacé par trois canaux
persistants `Musiques`, `Effets` et `Effets Coop`. Le troisième agit uniquement
sur les sons du partenaire après leur atténuation spatiale ; il ne modifie donc
ni les effets locaux ni le mix envoyé sur le réseau. La valeur globale historique
sert de migration initiale. Ces préférences restent personnelles au navigateur et
s'appliquent immédiatement aux lecteurs de scène, de combat et d'évolution.
Les boutons et sélecteurs des menus hors combat jouent également un SE court de
navigation, validation ou annulation via le canal `Effets`, avec un branchement
générique qui couvre les contrôles recréés dynamiquement.

### Phase 10 - Stabilisation du vertical jouable

La phase 10 formalise la sortie de l'increment 9.8 et peut etre menee en parallele
des validations narratives sans modifier leur ordre. Aucun ajout produit lourd ne
doit masquer un P0 ouvert.

Correctif Coop transverse du 2026-10-13, implémenté et en validation manuelle :
l'audience des contacts de PNJ est séparée de leur collision. Seul l'hôte peut
déclencher narration, dialogue et combat de Dresseur, tandis que l'invité continue
de bloquer les cases et de voir la scène partagée. La sauvegarde manuelle d'un
invité conserve désormais son ancien point de reprise solo tout en actualisant ses
données personnelles. Enfin, les mises à jour d'acteurs sont ordonnées par leur
révision dédiée, indépendamment de la révision globale que les déplacements des
joueurs peuvent faire avancer avant leur diffusion. Elles poursuivent une
correction depuis la pose affichée afin
d'éviter les sauts des PNJ et Pokémon de grotte. La clôture attend une recette à
deux navigateurs couvrant déclencheur, sauvegarde/rechargement et mouvements
autonomes sur une même carte.

### Phase 11 - Mecanismes solo structurants

Decision produit du 2026-10-19 : la priorite de cette phase est desormais le
portage fonctionnel complet des Pokemon et des Dresseurs avant les ameliorations
de confort UI/UX. Les refontes de navigation, le rangement avance de l'equipe et
les autres optimisations d'interface restent autorisees uniquement lorsqu'elles
bloquent le test d'une mecanique portee.

Le travail avance par frontieres verticales du parcours. Pour chaque nouvelle
espece, rencontre ou equipe de Dresseur, le pipeline controle les capacites, les
talents, les objets tenus, les statuts, les formes/evolutions et les animations
source. Toute dependance manquante est portee comme mecanique generique dans le
noyau commun, puis validee avec le meme contrat en solo, hote et invite. Une
espece n'est pas consideree terminee parce que ses donnees ou son sprite sont
charges : toutes les dependances qu'elle peut effectivement employer dans le
perimetre teste doivent etre executees ou explicitement auditees comme partielles.

Ordre de travail retenu :

1. fermer les dettes fonctionnelles des lots verticaux deja accessibles ;
2. continuer le parcours narratif par groupes de cartes, rencontres et Dresseurs ;
3. terminer les mecanismes transverses du cycle Pokemon (capacites, talents,
   objets tenus, statuts, capture, evolution, formes et apprentissage) rencontres
   par ces lots ;
4. seulement apres cette couverture, reprendre les ameliorations UI/UX qui ne
   conditionnent pas les tests.

L'audit source cible du 2026-10-05, actualise le 2026-10-20, confirme que les
donnees importees masquent encore un ecart de comportement important : 62/353
fonctions d'attaque sont executees et 4 partielles ; 79/255 talents sont executes
et 5 partiels. Les objets sont avances mais
aucune famille source n'est encore declaree complete ; 17 des 18 methodes
d'evolution sont maintenant resolues, `Shedinja` restant une creation secondaire.
L'ordre de dependance devient donc : fidelite du combat par lots
verticaux, utilisation des objets, capture, evolution, Pokedex, puis rencontres
de terrain avancees, apprentissage/rappel, Mega-Evolution, Pokévial, oeufs/Pension,
Carte/Boussole, Alchimie et Succes. DexNav, Nuzlocke/Monotype, Échange Miracle et
Tour de Combat sont inventories dans `docs/PRODUCT_BACKLOG.md` sans devancer les
P0. Chaque mecanique est concue une fois pour l'adaptateur local et la room
autoritaire.

Increment Pokévial du 2026-10-14 : le soin portable est désormais un état
personnel persistant, compatible avec les variables source 238/239 et leurs quatre
améliorations. Le bouton de l'en-tête Équipe emploie l'icône originale, confirme
le soin complet puis consomme une charge. Les Centres Pokémon portent leur
recharge explicite via `refill-poke-vial`. Les compteurs ne sont pas inclus dans
la projection narrative Coop ; hôte et invité utilisent et rechargent chacun leur
propre Pokévial sans intention réseau.

Premier incrément Pension du 2026-10-15 : le noyau personnel persistant porte
deux emplacements, le niveau au dépôt, la progression exacte de 1 EXP par pas et
le tarif source `(niveaux gagnés + 1) × 100 ₽`. Dépôt, retrait et échange avec un
membre de l'équipe sont atomiques ; le dernier Pokémon apte ne peut pas être
déposé et le Pokémon confié est soigné comme dans Z. Les capacités rencontrées
pendant la garde utilisent la file d'apprentissage persistante existante afin de
ne pas effacer silencieusement un choix du joueur. L'interface responsive de
service affiche les deux places, l'équipe, le coût et une analyse d'évolution ;
elle est accessible par les événements source identifiés par leur famille
`pbDayCare*`, ainsi que depuis Test dev pour les validations anticipées.

Autorité : état exclusivement personnel en solo, chez l'hôte et chez l'invité ;
les pas de chacun ne progressent que sa propre Pension et aucune donnée privée
n'est répliquée à la room. La sauvegarde et la reconnexion restaurent les deux
pensionnaires.

Reproduction, lot 1/6 du 2026-10-15 : le même noyau personnel calcule désormais
les quatre degrés de compatibilité de Z puis effectue un tirage tous les 256 pas,
avec les probabilités normales ou celles du Charme Ovale. Son RNG est sauvegardé ;
un succès crée immédiatement un Œuf caché et immuable, de sorte qu'un rechargement
ne relance ni espèce, ni IV, ni nature, ni caractère chromatique. Le schéma
Pension passe à la version 2 et migre les deux pensionnaires du schéma 1.

La génération couvre les lignées de bébé et leurs encens, les couples avec
Métamorph, les espèces spéciales du script, capacités initiales/naturelles/Œuf,
Électacle, trois IV ou cinq avec Nœud Destin, objets Pouvoir, Pierre Stase,
talents normaux/cachés, formes héritées prévues par Z, Ball maternelle, Charme
Chroma et Pokérus. Les capacités Œuf et le nombre de pas sont maintenant exposés
dans le catalogue runtime. La méthode Masuda reste explicitement suspendue : la
langue du Dresseur d'origine n'existe pas encore dans le modèle persistant ;
l'état Pokémon obscur n'est pas davantage représenté.

Reproduction, lot 2/6 du 2026-10-15 : les pages source qui exécutent réellement
`pbDayCareGenerateEgg` sont désormais distinguées génériquement de la gestion
`pbDayCare*` et deviennent la commande auditée `open-day-care-eggs`. Le gardien
présente en français l'état du couple ou l'Œuf caché, puis permet de le recevoir
dans l'équipe, de le laisser en attente ou de le refuser après une seconde
confirmation. Une équipe pleine ne consomme jamais l'Œuf. Retrait et échange des
parents sont bloqués tant que l'Œuf prêt n'a pas été traité, ce qui supprime toute
perte silencieuse. La remise est atomique, persistante et ne révèle pas l'espèce
au Pokédex avant l'éclosion. L'action Incubateur est déjà visible dans le contrat
mais reste honnêtement indisponible jusqu'au lot 3/6.

Comme la Pension, ce service est `PLAYER_STATE` et `PERSONAL` : hôte et invité
consultent et modifient uniquement leur propre sauvegarde, sans intention room ni
projection chez l'autre joueur. Restent aux lots suivants l'Incubateur à six
places, les pas d'éclosion, la scène d'éclosion et la validation visuelle sur
téléphone.

Reproduction, lot 3/6 du 2026-10-15 : l'Incubateur source est porté comme un
état personnel distinct de six emplacements, restauré avec la sauvegarde. L'objet
important `INCUBADORA` ouvre depuis le Sac une interface responsive 3 × 2 inspirée
du script `201-74253698-incubadora.rb`. Chaque case affiche l'icône Œuf animée,
les pas restants et l'un des quatre messages source de proximité d'éclosion.

Les transferts confirmés équipe → Incubateur, Incubateur → équipe et Incubateur
→ Ranch sont atomiques et refusent doublon, cible occupée, Pokémon éclos ou équipe
pleine sans mutation partielle. Le gardien peut maintenant remettre directement
l'Œuf de Pension dans le premier emplacement libre si l'objet a été obtenu ; un
Incubateur plein conserve l'Œuf chez le gardien. Les cartes Équipe/Ranch masquent
espèce, types, capacités, statistiques potentielles et résumé d'un Œuf non éclos.
L'état demeure `PLAYER_STATE`, privé pour l'hôte comme pour l'invité, sans message
room. Le lot 4/6 portera la décrémentation des pas, Corps Ardent/Armumagma et le
déclenchement sûr de l'éclosion.

Reproduction, lots 4-6/6 implémentés le 2026-10-15 : chaque pas local décrémente
les Œufs de l'équipe et de l'Incubateur, jamais ceux du Ranch ni l'Œuf encore chez
le gardien. Corps Ardent ou Armumagma double une seule fois la progression. Une
file `pendingHatches` personnelle et persistante maintient l'Œuf opaque à un pas
jusqu'à ce que la scène bloquante puisse commencer ; plusieurs éclosions sont
présentées séquentiellement après les combats, dialogues et transferts.

La scène utilise l'Œuf et les cinq fissures source, les secousses et sons
`ballshake`/`recall`, la musique `evolv`, le cri, le jingle `EvolutionSuccess`,
la révélation du sprite animé et le choix facultatif d'un surnom. Un Œuf de
l'équipe éclot en place ; un Œuf de l'Incubateur rejoint ensuite l'équipe ou le
Ranch. La finalisation persiste bonheur 120, date/carte d'éclosion et Pokédex.
Le sprite réel `iconEgg` remplace l'œuf CSS du gardien et sa cadence augmente à
l'approche de l'éclosion.

Le décor animé est partagé avec l'évolution par
`source-transformation-stage.ts`. L'ancien `evolutionbg.gif` est statique dans
les données : le moteur reproduit maintenant les couches EBS actives (`evobg` ou
`hatchbg`, `overlay`, lignes mobiles), avec réduction de mouvement accessible.
Autorité et persistance restent celles du propriétaire ; aucune donnée d'Œuf ni
scène privée n'est répliquée à la room. Restent une validation manuelle du
cadrage, des sons et des temporisations sur téléphone et plusieurs espèces.

Premier increment Pokedex du 2026-10-12 : l'onglet du menu est débloqué par le
switch narratif source déjà porté et affiche le catalogue extrait dans une grille
paginée. Recherche par nom/numéro, deux types cumulables, tri et filtres de statut
couvrent non vu, vu seulement, obtenu, possédé actuellement, équipe, Ranch,
espèce ayant évolué et espèce relâchée. Une barre mesure les espèces obtenues sur
l'ensemble du catalogue ; les cartes distinguent silhouettes inconnues, espèces
observées et espèces obtenues, avec badges Équipe/Ranch et historique.

Deuxième increment UI Pokédex/Ranch du 2026-10-12 : les filtres se mettent à jour
automatiquement et conservent uniquement une action de réinitialisation. Le filtre
de potentiel partagé remplace les anciens seuils numériques et classe la somme des
six statistiques de base en six degrés (`0–299`, `300–399`, `400–449`, `450–499`,
`500–599`, `600+`) ; la valeur exacte apparaît sur les cartes tant que ce filtre
est actif. Le Ranch supprime les bornes de numéro et la puissance actuelle, puis
ajoute deux filtres en étoiles distincts fondés sur les moyennes des six IV et des
six EV. La fiche Pokédex fournit les données générales fiables du catalogue source
avec sprite animé, types, catégorie, taille, poids, empreinte, statistiques de base,
talents et évolutions. La fiche reprend la structure visuelle Équipe/Ranch et la
même animation canvas de battler ; les descriptions françaises sont lues depuis
`french.dat`. Les zones de capture ont rejoint le module Carte le 2026-10-13.
Les icônes locales `DP Pause Menu` décorent les rubriques avec l'état gris
`A`, l'état actif coloré `B` et l'oscillation du script source ; Sac et Sauvegarde
emploient leurs variantes `Bf/Bm`. Aucun asset n'est versionné. Ce lot demeure une
présentation et un état personnel : aucune donnée
de filtre, de Ranch ou de Pokédex n'est répliquée à la room Coop.

Correctif UX Ranch du 2026-10-14 : la mention `PC de Léo` a été retirée et
l'équipe et le stockage sont maintenant deux zones visuellement séparées. Une
commande fixe déplie l'équipe sans agir sur le stockage ; la sélection est fermée
avant un transfert pour éviter qu'une carte déposée suive le repli du panneau.
La grille paginée affiche 3 × 3 cartes lorsque l'équipe est ouverte et 4 × 4
lorsqu'elle est repliée. Filtre et tri utilisent deux tiroirs fermés par défaut ;
le tri purement visuel couvre numéro, nom, niveau, type principal, potentiel, IV
et EV. Le décor `Graphics/Ranch.png` est légèrement flouté et animé, sauf avec la
préférence de réduction des mouvements ; la palette du Ranch est désormais verte.
La carte Pokémon commune possède une variante compacte conservant identité, niveau,
PV, statut et objet tenu. Les badges de types et les quatre capacités y restent
visibles dans une grille 2 × 2 resserrée. Elle affiche le nom français de l'objet
tenu dans l'Équipe comme dans le Ranch. Il n'existe aucune nouvelle mutation ni
donnée réseau : la collection, l'ordre persistant et l'objet restent personnels.

Finition de densité du 2026-10-14 : les cartes compactes retirent la ligne redondante
`numéro · emplacement`. Le panneau Équipe occupe désormais exactement 25 % de la
surface, soit la largeur d'une carte : les cartes du stockage conservent donc la
même largeur en 3 × 3 avec l'équipe ou en 4 × 4 sans elle. Le sprite couvre les
deux rangées gauches, les types deviennent des badges d'icône sous le nom et les
capacités restent en 2 × 2 dans la colonne droite. La variante Équipe est resserrée
pour empêcher tout débordement ; la variante Ranch ne rend plus la barre de PV.
Le voile du décor est désormais uniforme, sans bande sombre produite par l'ancien
dégradé vertical.

Correction complémentaire du 2026-10-14 : lorsque le panneau Équipe masqué sortait
du placement automatique CSS Grid, le stockage occupait par erreur sa colonne de
largeur nulle et paraissait lui aussi replié. Les zones nommées `team` et `storage`
ancrent désormais chaque panneau à sa colonne, avec un test de régression dédié.

Finition visuelle du 2026-10-14 : le fond animé a été déplacé sur la racine stable
du Ranch afin que les rendus provoqués par Filtre, Tri et le repli de l'équipe ne
redémarrent plus son animation. La disposition repliée est maintenant une véritable
grille à une colonne `storage`, sans piste nulle ni assombrissement résiduel.

Correctif structurel du 2026-10-14 : les zones verticales `toolbar`, `tools` et
`content` sont maintenant nommees explicitement. La fermeture du tiroir Filtre/Tri
ne peut plus faire remonter le contenu dans une ligne automatique et abandonner la
ligne extensible en bas de l'ecran. La grille et sa pagination utilisent toute la
hauteur ; les commandes de page restent au pied du stockage. Le bandeau secondaire
qui repetait le nombre de resultats et le tri a ete supprime, le compteur de
stockage de l'en-tete restant la reference visible.

L'historique `pokedex` appartient au joueur, persiste dans sa sauvegarde locale et
n'est jamais répliqué à la room. Les combats locaux et partagés enregistrent les
espèces adverses du point de vue de chaque participant ; cadeaux, captures et
créations de test sont réconciliés depuis la collection personnelle ; les deux
chemins d'évolution enregistrent l'espèce quittée. Les anciennes sauvegardes
reconstituent seulement les espèces encore présentes dans l'équipe ou au Ranch :
une évolution ou une libération antérieure ne peut pas être inventée. La
libération depuis le Ranch exige maintenant une confirmation, retire le Pokemon
du stockage personnel, restitue son objet tenu au Sac et enregistre son espèce
dans l'historique persistant.

Premier incrément Carte du 2026-10-13 : `PBS/townmap.txt` est extrait dans un
catalogue régional générique et `MapPosition` rejoint les métadonnées normalisées.
L'onglet Carte du menu affiche l'image source de Kalos, son quadrillage 30 x 20,
les 176 points nommés ou structurels, le curseur animé source et la position du
joueur. Les intérieurs sans `MapPosition`, dont Map010, héritent de la position du
premier parent RPG Maker qui en possède une. Les 33 destinations définies dans
`townmap.txt` alimentent depuis le 2026-10-13 le mode Vol de test : le bypass local
`Tous les déplacements` les rend sélectionnables depuis une carte extérieure, le
clic joue un fondu blanc, ferme le menu et réutilise le transfert d'overworld.
Aucune destination n'est considérée visitée par défaut ; le déblocage narratif
normal du Vol reste donc à implémenter.

Les libellés régionaux ne sont plus affichés directement depuis l'espagnol de
`townmap.txt` : le chargeur compose le catalogue avec `regionNames`, `placeNames`
et `placeDescriptions` de `localization.json`. Les 89 noms uniques et les 21
descriptions uniques actuellement utilisés par la carte possèdent tous une valeur
française issue de `french.dat`, avec repli source si un futur point n'en possède
pas.

Premier lot Boussole implémenté le 2026-10-13 : l'objet `DEXNAV` révèle dans
l'overworld un raccourci utilisant `DP Pause Menu/radar.png`. La fenêtre reproduit
`EncounterListUI` du jeu source : union de toutes les méthodes de rencontre de la
carte, déduplication, tri par numéro du Pokédex, icônes normales pour les espèces
capturées et silhouettes pour les autres. La consultation est personnelle et
locale en solo comme en Coop ; elle réutilise l'inventaire et l'historique Pokédex
persistants, sans état ou message réseau supplémentaire et sans influencer le
tirage des rencontres.

Le même noyau projette toutes les méthodes de `encounters.json` sur la carte. La
page `Zones de capture` des fiches Pokédex affiche les cellules d'habitat réelles,
dédupliquées par région et coordonnées, sans table propre à une espèce. Depuis le
2026-10-15, ce volet retire sa colonne de sprite pour agrandir la carte et ancre
les vrais noms de lieux directement aux zones provenant de la hiérarchie des cartes. La
fiche générale conserve maintenant la méthode et le paramètre de chaque évolution
et les présente en français au lieu de réduire l'évolution à sa seule espèce cible.
Autorité :
catalogue extrait en lecture seule et position du joueur concerné ; domaine :
présentation personnelle ; persistance : aucune donnée supplémentaire, car carte
et habitats sont déterministes ; audience : joueur local uniquement. En Coop,
hôte et invité calculent leurs lieux depuis le même catalogue. Le snapshot de room
réplique uniquement un `mapId` régional par joueur : l'hôte publie le monde partagé,
l'invité met à jour sa présence lors de ses excursions, et leurs coordonnées fines
restent privées hors du monde partagé. Deux curseurs colorés rendent ces positions
visibles sur la Carte et `regionalMapIds` est persisté/restauré par la room. Le vrai
déblocage de Vol devra encore ajouter les destinations visitées personnelles ; le
bypass actuel n'altère ni progression ni sauvegarde narrative.

Finition des grands sprites du 2026-10-15 : un lecteur canvas commun anime les
battlers des résumés Équipe/Ranch/Combat, du Pokédex, de la Pension, des combats,
de la résolution post-capture, de l'évolution et de l'éclosion. Il réutilise les
frames source opaques, précompose chaque pose avant son affichage et ajoute une
respiration ancrée au sol via le compositeur du navigateur. Le fondu expérimental
entre poses a été retiré après validation, car il faisait clignoter le pixel art.
Le lecteur respecte la réduction de mouvement et ne produit aucun nouvel asset. Cette
présentation est reconstruite localement en solo, chez l'hôte et chez l'invité ;
elle n'ajoute ni état persistant ni trafic Coop.
La cadence n'est plus une approximation propre au portage : elle reproduit les
15 poses par seconde de `BitmapWrapperEX` dans Pokémon Z, dérivées de ses 60 Hz et
de son changement de pose toutes les quatre mises à jour.

Premier lot vertical de combat du 2026-10-09 : Jean puis les trois variantes de
Melia sur le parcours suivant ont ete pris comme frontiere, sans logique liee a
leur carte ou leur nom. La fonction `030` d'Agilite ajoute deux crans de Vitesse
et le talent `FLORACION` renforce de 50 % les capacites Plante dans le noyau de
degats. Le simple, le double local et le double autoritaire reutilisent ces memes
fonctions. `CHEEKPOUCH`, present sur le Sapereau de Jean mais inactif sans Baie
tenue, reste rattache au futur lot generique de consommation des Baies.

Deuxieme lot vertical du 2026-10-12 : Vin et les 21 especes terrestres uniques des
premieres zones (Map007, Map009, Map014 et Map016) sont projetables avec toutes
leurs capacites de niveau. Treize fonctions generiques ont ete ajoutees, dont
confusion, peur, Entrave, Encore, ligotage, Malediction, puissance par poids et les
hausses composees. Leur etat temporaire est calcule par le meme noyau en solo,
double et room Coop, replique dans le snapshot puis efface au switch. La liste
exacte et les limites sont dans `docs/COMBAT_VERTICAL_AUDIT.md`. Le prochain lot
porte Navarroc et la Forteresse, ainsi que les objets tenus des equipes source.

Correctif du 2026-10-13 issu du rapport de combat : `RIVALRY`, rencontre sur
Helionceau, applique maintenant son multiplicateur de degats selon les genres
publics des combattants (meme genre x1,25, sinon neutre). Ce comportement suit le
calcul Ruby reel de Z, qui ne reprend pas le malus x0,75 utilise par son estimation
d'IA et par d'autres generations Pokemon. La trace autoritaire nomme le talent et
le multiplicateur ; le meme calcul couvre simple, double, solo et room Coop sans
nouvelle intention cliente.

Audit transversal talents du 2026-10-13 : une matrice de couverture exhaustive
est synchronisee avec la liste des talents actifs du noyau. La comparaison directe
aux scripts Ruby a corrige `FLORACION`, `KEENEYE`, `STATIC`, `SYNCHRONIZE`,
`MAGICGUARD`, `CHEEKPOUCH` et le tri de Vitesse double d'`ACOMETIDA`. Le rapport
classe maintenant `CHLOROPHYLL`, `DRYSKIN` et `INTIMIDATE` comme partiels, avec
leur dette explicite (meteo ou interactions source non encore modelisees), au lieu
de les annoncer termines. La variante propre a Z de `SHIELDDUST` est confirmee et
portee : les effets secondaires ne sont bloques que si le porteur tient aussi
`COVERTCLOAK` (Cape Obscure). Ces corrections utilisent le meme noyau en solo,
hote et invite et n'ajoutent aucune intention reseau.

Troisieme lot vertical du 2026-10-12, P0 ferme le 2026-10-13 : Map017 terrestre et les sept definitions
d'Alexandre, Micael, Maria et Canola sont constructibles avec leurs 74 emplacements
de capacites, objets tenus et talents forces. Vingt-et-une nouvelles fonctions,
les Gemmes Combat/Insecte, Evoluroc, Baies Aranja/Payapa et les effets de camp ou
terrain sont executes dans le noyau commun simple/double/Coop. Les objets de
Dresseur sont conserves et consommes dans le snapshot autoritaire ; Canola suit
les seuils source pour sa Super Potion. Poursuite intercepte le sortant avant son
retrait, `ProtectRate` porte la probabilite des protections consecutives et les
frappes multiples exposent chaque impact/PV a la presentation. `088`, `0AA` et
`0C0` sont donc pleinement supportees. La validation manuelle de cette frontiere
rejoint desormais la recette globale de `STAB-BATTLE-1` ; l'IA tactique generale
sera traitee dans un lot distinct.

Quatrieme lot vertical du 2026-10-19, P0 automatise : Route 3, Nouvelle Reunion,
Route 4, Clairiere Collinaire et Bois-en-Tronc sont couverts par le pipeline de
dependances. Le nombre de Pokemon aptes choisit generiquement la branche simple ou
double ; huit nouvelles fonctions completes, les capacites de bas niveau requises
et sept talents deterministes utilisent le noyau commun solo/Coop. Les combats de
nid et leurs recompenses differees sont hote-autoritaires et restaurables apres
reconnexion. Le sous-lot de fidelite porte maintenant le vrai deux-contre-un des
boss, leurs rangs initiaux, le tirage persistant du nid insecte et le
repositionnement replique des acteurs de la scene post-combat. Les mécaniques
partielles ont ensuite été fermées et la recette manuelle Maps 023 à 029, nids
compris, a été validée avec les assets locaux. Deux TP neutres de Test dev
permettent toujours d'atteindre les nids sans modifier les interrupteurs d'histoire.

Stabilisation Coop du 2026-10-19 : les combats de nid déjà doubles restent masqués
à l'invité jusqu'à ce qu'il interagisse avec l'hôte adjacent pour les observer,
sans autoriser un troisième combattant. Les
combats simples rejoignables refusent désormais toute modification de composition
pendant une action ou un remplacement. Leur passage en double conserve les effets
tactiques et ne rejoue pas les talents d'entrée des actifs existants. Le client
réconcilie toute modification structurelle des camps et sérialise le chargement
des sprites, ce qui supprime les compositions différentes entre hôte et invité.
Un raccourci Test dev vers Hector et Zaida (Map027, événement 12) fournit le vrai
combat duo source : deux adversaires sont actifs nativement. En Coop, l'invité
peut prendre le second poste allié avant le premier tour ; le second Pokémon de
l'hôte reste en réserve, sans dépasser le format 2 contre 2. Les combats sauvages
déjà doubles restent non rejoignables et seulement observables.
La persistance Cloudflare est désormais séparée du flux temps réel : sons et
transport ne sont pas écrits, tandis que mouvements joueur/PNJ sont consolidés
en checkpoints au lieu d'un `storage.put()` par message. Les mutations critiques
restent persistées immédiatement pour préserver combats, narration et reconnexion.

Fermeture des mécaniques partielles Route 3–Route 4 du 2026-10-19 : les douze
codes auparavant partiels (`021`, `049`, `082`, `083`, `093`, `098`, `09C`,
`0DC`, `0F1`, `0F4`, `0FA`, `110`) sont maintenant pris en charge dans le noyau
simple et double. Chargeur, Anti-Brume, Assurance, Chant Canon, Frénésie, Fléau,
Coup d'Main, Vampigraine, Larcin/Implore, Piqûre/Picore, le recul et Tour Rapide
partagent le même état autoritaire en solo et Coop. Les transferts d'objets sont
restaurés après un combat de Dresseur, mais conservés après un sauvage. L'audit
local passe à 81/353 fonctions supportées et aucune fonction classée `partial` ;
les 272 fonctions restantes demeurent explicitement non implémentées et seront
portées avec leurs futurs lots verticaux. Le fallback de Larcin reste nécessaire,
car le jeu source ne fournit aucun mapping dans `move2anim.dat`.

Correctif de frontiere du 2026-10-13 : `SWEETSCENT` (`048`) ne bloque plus la
construction d'une equipe de Dresseur. Doux Parfum baisse l'Esquive adverse de
deux crans comme dans les scripts de Z et vise les deux adversaires en double via
son ciblage source `04`. Projection personnelle, validation Coop et resolution
autoritaire partagent le meme code ; le registre passe alors a 56 fonctions pleinement
supportees. Son utilisation hors combat pour declencher une rencontre reste a
porter avec les mecanismes d'overworld et ne fait pas partie de ce jalon.

Correctif de progression du 2026-10-13 : les combats de Dresseur solo utilisent
desormais le meme registre de participants et le meme noyau de reglement EXP que
la Coop. Les Pokemon engages et encore conscients se partagent l'EXP, le bonus
Dresseur et les interrupteurs de progression de Z sont appliques, et le rapport
diagnostique expose `pokemon-z-participant` au lieu de `legacy-wild`. Un test
d'integration couvre aussi deux participants survivants apres un changement. Le
chemin sauvage historique reste volontairement inchange avant son audit propre.

Outil de diagnostic combat du 2026-10-13 : le panneau `Moteur` produit un rapport
JSON complet du combat courant ou du dernier combat termine. Le solo conserve la
trace issue du noyau local; la room joint la meme trace autoritaire aux tours Coop.
Le rapport rassemble contexte, actions positionnees, snapshots avant/apres, evenements, RNG, calculs de
degats, remplacements et reglement personnel (entrees/sorties EXP, niveaux, argent,
objets et capture). Il reste local au navigateur et ne contient jamais le Sac
complet. Equipe et inventaire du panneau sont replies par defaut afin que l'outil
reste court meme avec une sauvegarde de test tres chargee.

Le rapport detaille egalement la capture (taux de Ball, facteur PV, statut, seuil,
capture critique et tirages de secousse) et chaque arrondi du calcul d'EXP par
beneficiaire. Les formules solo historique et Coop autoritaire sont nommees dans
le JSON afin de rendre leurs divergences eventuelles directement auditables.

Premier increment objets du 2026-10-07 : un registre pur dans `player-state`
applique hors combat les soins de PV, soins de statut, Restauration Totale et
Rappels controles contre les handlers de Z. La transaction valide possession,
cible et effet avant de consommer exactement une unite. Elle ne recoit que l'equipe
et l'inventaire du proprietaire : solo, hote et invite utilisent donc le meme noyau
sans melanger leurs sauvegardes ni publier leur Sac dans la room. Le menu Sac rend
les objets portes selectionnables et demande une cible de l'equipe personnelle ;
les objets encore inertes restent visibles mais desactives.

Deuxieme increment objets du 2026-10-07 : les soins personnels sont des actions de
tour du moteur commun en simple et double. Le protocole v13 publie a la room une
projection bornee par proprietaire ; la room valide stock, mode de difficulte et
cible possedee, reserve la consommation et restitue le reliquat prive apres
reconnexion. Le reglement personnel transporte `consumedItems`, applique une seule
fois avec les autres resultats du combat. Le solo utilise le meme resolveur et
debite directement sa sauvegarde apres resolution valide.

Troisieme increment objets/capture du 2026-10-07 : les Balls et la formule de Z
sont executees par le moteur commun en simple et double. Le protocole v14 transporte
l'intention, puis la room valide cible sauvage, stock et proprietaire avant les
tirages. Le reglement ne remet le Pokemon qu'au lanceur ; son client conserve les
faits tactiques et cree les metadonnees personnelles. Depuis le 2026-10-15, toute
capture est d'abord conservee au Ranch, puis son proprietaire choisit le surnom et
la destination dans un flux bloquant : Ranch, place libre dans l'equipe, ou echange
atomique avec un des six membres. Le choix en attente est personnel et persistant ;
il reprend apres rafraichissement ou reconnexion sans perte ni duplication.
Consommation et acquisition sont idempotentes apres reconnexion. Le
solo reutilise le meme noyau avec un adaptateur local. L'ancien don global de 99
objets a ete remplace dans `Test dev` par une selection de poche, d'objet et de
quantite, avec remise a zero confirmee par poche.

Quatrieme increment objets du 2026-10-07 : Ether, Ether Max, Elixir, Elixir Max et
Baie Mepo restaurent maintenant les PP avec le meme noyau en exploration et en
combat ; les objets monocapacite demandent explicitement la capacite cible. Les
familles Attaque X, Defense X, Attaque Speciale X, Defense Speciale X, Vitesse X
et Precision X, y compris les variantes +2/+3/+6 et leurs alias source, modifient
les crans temporaires du seul Pokemon actif controle. Le protocole v15 transporte
`targetMoveIndex`, la room valide le proprietaire, la cible active et le stock,
puis conserve consommation et reliquat a travers reconnexion et reglement. Le
solo, l'hote et l'invite utilisent tous `applyPokemonItemEffect` ; aucun objet ne
permet de modifier le Pokemon de l'autre Dresseur.

Cinquieme increment objets du 2026-10-08, elargi le 2026-10-14 : la roue commune
Equipe/Ranch active la gestion des objets tenus. Tout objet ordinaire non important
peut etre donne, meme si son effet tactique n'est pas encore porte. Le choix vient
du stock personnel reel ; equipement, remplacement et retrait sont
une transaction atomique partagee entre l'equipe et le stockage, avec retour de
l'ancien objet au Sac et controle de sa limite. Le solo, l'hote et l'invite
emploient ce meme noyau local sans publier inventaire ou Ranch dans la room. Les
effets non portes sont neutralises dans la projection de combat sans alterer la
collection personnelle ; objets importants et CT/CS ne peuvent pas etre donnes.

Finition UI du 2026-10-14 : depuis une carte Pokemon, `Donner objet` conserve le
template radial commun et expose les huit categories du Sac avec leurs icones. Le
choix ouvre une modale paginee qui partage le classement semantique du Sac, y
compris ses sous-dossiers automatiques. Le meme composant et le meme etat personnel
sont utilises dans l'Equipe et le Ranch. La modale reserve une rangee fixe a sa
pagination et borne six objets par page dans une grille 3 x 2 : il n'existe aucun
defilement vertical et les commandes de page restent dans le cadre sur une surface
tactile Android. Chaque carte affiche un seul compteur sous son icone : quantite
de la pile pour un objet, ou total d'objets pour un dossier automatique. Le nombre
de sortes est retire. La zone de texte, sans delimitation pointillee, occupe toute
la hauteur restante. Cela supprime la rangee vide, ramene les cartes de 92 a 68 px
et preserve nom et description sans chevauchement.

Correctif Coop du 2026-10-08 : les projections de combat PvP et sauvage valident
maintenant ces onze objets via le registre canonique du moteur. La liste partielle
du protocole, qui bloquait l'acceptation d'un duel et la demande de combat sauvage
de l'hote pour cinq objets, a ete supprimee et couverte sur les deux messages.

Correctif PvP du 2026-10-12 : le duel classique partage maintenant la preparation
d'equipe tolerante du ralliement Coop. Une capacite ou un objet tenu source non
encore porte ne transforme plus une equipe consciente en faux K.O. : la mecanique
est neutralisee dans la seule projection tactique, explicitement signalee, puis
preservee dans la sauvegarde personnelle au reglement. Le Sac complet reste hors
du message reseau et n'influence pas l'eligibilite du duel.

Sixieme increment objets du 2026-10-08 : la roue radiale est devenue un composant
generique commun aux Pokemon et au Sac. Chaque entree du Sac expose Utiliser,
Donner et Jeter, avec annulation par le centre ; les actions indisponibles restent
lisibles avec leur motif. Le jet choisit sa quantite et preserve objets importants
et CS. Le contrat accepte des actions specifiques injectees par les futurs lots
d'objets. Toutes les mutations restent personnelles en solo/hote/invite.

La boucle UI a ensuite ete fermee : cible Pokemon et cible capacite sont des
modales visibles independamment de la longueur du Sac, suivies d'un resultat et
d'une reprise optionnelle. Le flux CT/CS reserve compatibilite, remplacement et
confirmation ; son activation depend de l'extraction fidele de `tm.txt`.

Septieme increment objets du 2026-10-08 : `tm.txt` rejoint `machines.json` et
l'apprentissage CT/CS est raccorde de bout en bout avec compatibilite source,
capacite deja connue, remplacement parmi quatre emplacements et confirmation.
Pokemon Z ayant `INFINITETMS=true`, CT et CS sont conservees et ne peuvent etre
jetees ou donnees. Les PP de la capacite remplacee suivent exactement le handler
Ruby. WATERFALL et DIVE restent des exceptions auditees : leurs objets existent
mais leurs sections manquent du `tm.txt` source.

Huitieme increment objets du 2026-10-08 : Poudrenergie, Racine Energie, Poudre
Soin, Herbe Rappel et les Cendres Sacrees propres a Z utilisent le noyau commun.
Les soins, exceptions Nuzlocke et pertes de bonheur reproduisent les handlers
source en exploration et en combat solo/Coop ; le bonheur tactique est restitue
au seul proprietaire apres reconnexion. La Cendre Sacree d'equipe ranime en une
transaction tous les membres K.O. non oeufs et restaure PV, statut et PP depuis
une confirmation dediee du Sac. La guerison de la Confusion par Poudre Soin reste
liee au futur etat volatil Confusion.

Neuvieme increment objets du 2026-10-08 : PP Plus et PP Max conservent les trois
paliers source par capacite. Vitamines, Super Vitamines de Z et Ailes appliquent
leurs gains EV permanents avec les plafonds 250/252/510, recalculent les
statistiques en preservant les degats et appliquent le gain de bonheur source.
Ces usages sont personnels et persistants en solo, chez l'hote et chez l'invite ;
ils ne sont pas utilisables en combat et ne repliquent aucune donnee privee a la
room.

Dixieme increment objets du 2026-10-08 : les six Capsules de potentiel de Z
ajoutent jusqu'a 7 IV a leur statistique, avec plafonds 31/186, recalcul immediat
et bonheur `vitamin`. La Capsule doree applique le `+7` reel de son handler aux
six statistiques, malgre sa description source `+10`, et n'est pas consommee si
aucune statistique ne peut progresser. Comme les EV, ces donnees personnelles ne
sont jamais repliquees a la room.

Onzieme increment objets du 2026-10-08 : les 21 Menthes existantes modifient la
nature reelle, recalculent les statistiques et preservent les degats. Elles sont
personnelles, persistantes et inutilisables en combat. Le faux handler
`QUITEMINT`/`QUITE` n'est pas expose, et une Menthe correspondant deja a la nature
du Pokemon n'est pas consommee malgre le retour ambigu du handler Ruby.

Douzieme increment objets du 2026-10-08 : le lot commun d'ajustement des EV couvre
les six baies bonheur/-10 EV et les deux Poké Essences de Z. Les seuils de bonheur,
le Grelot Zen, le recalcul des statistiques et la limite atypique de 508 EV sont
reproduits. L'Essence normale est consommee ; la raffinee (`fieldUse=5`) reste
reutilisable. Un effet nul ou un total deja superieur a 508 ne consomme rien et
ne peut jamais produire le delta negatif possible dans le Ruby source.

Treizieme increment objets du 2026-10-08 : le Bonbon Rare utilise le meme noyau
de progression que l'EXP, avec selection de quantite, caps narratifs exacts de Z,
recalcul des statistiques, preservation des degats et bonheur de montee de niveau.
Les capacites trouvees sur plusieurs niveaux sont apprises dans les emplacements
libres ou persistees pour reprise, puis un conducteur obligatoire demande aussitot
leur remplacement dans l'ordre. Les donnees d'evolution extraites produisent aussi
les candidats de niveau, genre, statistiques, bonheur ou capacite connue, sans
encore muter l'espece ni jouer la scene. Etat et inventaire restent personnels en
solo/hote/invite ; seul le cap vient de la progression narrative partagee de l'hote.

Correctif apres recette : le Bonbon Rare et les recalculs permanents recoivent le
catalogue `battleCatalog` effectivement charge. Les 43 icones d'objets absentes du
jeu source sont detectees via le manifeste avant affichage et remplacent leur URL
inexistante par l'icone generique, sans rafale de 404 dans la console.
Le choix de quantite du Bonbon Rare et du jet d'objets emploie aussi un selecteur
tactile commun (`-10/-1/+1/+10/Max`) a la place de l'incrementateur natif mobile.

Jalon `UI-BAG-1` : le Sac d'exploration et celui des combats partagent desormais
une grille paginee sans liste defilante. Les cartes ont une taille stable, une
description multilignes et une quantite accentuee. Un classifieur commun cree a
partir de huit references possedees des dossiers semantiques a un seul niveau et
affiche sur chacun le nombre de sortes et la quantite totale. Les objets isoles
restent au niveau de la poche. Le combat filtre d'abord les objets autorises puis
reutilise le meme classement, y compris pour soins, Balls et boosts. Navigation et
pagination sont locales et volatiles ; l'inventaire personnel et son autorite
solo/hote/invite ne changent pas.

Finition `UI-BAG-1` : items et dossiers utilisent maintenant une unique primitive
`InventoryCard`, avec zones reservees au texte et aux quantites pour eviter toute
collision sur desktop, mobile et dans le Sac de combat. Le navigateur de grille
isole les debordements et garde une pagination compacte sous une grille generale
de trois lignes par trois colonnes. Le mobile et le combat restent limites a quatre
cartes par page. Exception fonctionnelle
validee : la poche CT/CS ne cree jamais de dossier ; elle reste plate et paginee
jusqu'au futur filtre dedie a ce catalogue.

Alignement visuel du 2026-10-14 : le Sac principal adopte la carte compacte validee
pour le selecteur d'objet tenu. Le compteur unique est place sous l'icone, tandis
que le nom et la description sans delimitation occupent toute la colonne droite.
Il indique la quantite pour un objet et le nombre total d'objets pour un dossier ;
le nombre de sortes n'est plus presente, y compris dans le fil d'Ariane du dossier.
La description utilise jusqu'a six lignes, ou huit sur la carte mobile plus haute,
afin d'exploiter l'espace vertical avant toute ellipse. La pagination et les tailles
de page existantes sont conservees.

Refonte du menu principal : le bandeau global remplace les titres de contenu
dupliques et affiche la metadonnee propre a chaque onglet. Le pied de page a ete
supprime, la navigation laterale occupe toute la hauteur sur desktop et devient
une barre basse sous 430 px. Dans ce mode etroit, le menu utilise le viewport
complet au lieu de rester enferme dans la scene overworld 4:3.

L'onglet Equipe affiche maintenant les six places simultanement dans une grille
2 x 3, sans retirer les informations existantes des cartes Pokemon. Les places
vacantes restent visibles mais non interactives ; les places occupees continuent
d'utiliser la carte commune Equipe/Ranch et sa roue contextuelle.

La finition visuelle de capture, le surnom et le choix Equipe/Ranch sont implementes.
Le HUD sauvage remplace les symboles d'equipe adverses par `battleBoxOwned` colore
si l'espece appartient a l'historique personnel, ou grise si elle n'a jamais ete
capturee. Capture critique et bonus dependants de l'heure, de la plongee, de la peche
ou des especes deja possedees attendent leurs contextes autoritaires. Puissance,
Garde-Stats et les autres effets qui exigent encore un etat volatil, ainsi que les
effets d'objets tenus non portes restent ouverts dans `SOLO-ITEMS-1`. Les 21
pierres/objets d'evolution sont deja fonctionnels dans `SOLO-EVOLUTION-1`.

Premier increment evolution du 2026-10-08 : 17 des 18 methodes reellement utilisees
par Z sont resolues dans un noyau commun ; la dix-huitieme, `Shedinja`, est une
creation secondaire inventoriee separement. Bonbon Rare et EXP de combat
enregistrent une offre persistante de reprise. Apres les questions de capacites,
l'ecran d'evolution demarre automatiquement et ne peut etre annule que pendant son
animation ; aucune action differee n'est exposee dans l'Equipe. La mutation met a
jour espece, talent, statistiques, forme, objet tenu et capacites
du niveau. Les 21 pierres/objets d'evolution sont actifs, dont les neuf pierres
imprégnees et leur `+7` IV par statistique. Autorite et sauvegarde restent
personnelles en solo/hote/invite. Une premiere animation bloquante est raccordee ;
Les pierres et objets d'evolution utilisent desormais cette presentation apres
leur transaction atomique, sans possibilite d'annulation ; leur mutation et leur
consommation sont persistees avant l'effet visuel pour rendre une interruption
inoffensive. La scene reutilise maintenant le fond anime, les cris, la musique
`evolv`, l'alternance acceleree des silhouettes, le flash et le jingle de succes
observes dans le script source. Sa reprise de fidelite ajoute les ecrans colores
avant/apres et leurs messages, retire le masque ovale au profit du cadre 4:3 et
decoupe correctement les planches de battlers animees au lieu de les aplatir.
Restent sa validation visuelle fine sur plusieurs gabarits, la creation
de Munja et le registre Pokedex.

Outil de recette associe : l'onglet `Test dev` permet maintenant de simuler un cap
de niveau jusqu'a 100 et de creer une espece extraite au niveau choisi, dans
l'equipe ou au Ranch. Ces fonctions evitent de modifier artificiellement les
switches d'histoire pour tester apprentissages et evolutions. Les preferences de
deblocage sont locales ; les objets et Pokemon crees restent des donnees
personnelles persistantes, y compris pour chaque participant Coop.

Amelioration du 2026-10-15 : le don de Pokemon utilise desormais les noms francais
extraits de `Data/french.dat` et une grille paginee. Recherche sans accent, numero,
type et tri se combinent automatiquement ; l'identifiant anglais n'est plus montre
comme choix au joueur. La creation exige une carte selectionnee et conserve le
contrat existant equipe puis Ranch, personnel en solo comme en Coop.

Rencontres de terrain du 2026-10-15 : les cannes s'utilisent depuis leur roue
d'objet face à l'eau. Attente, morsure, fenêtre tactile de réaction, bonus des
talents Ventouse/Glue, pose source et tirage reproductible sont raccordés au même
contrôleur de combat en solo et dans la room Coop. Les données Z 2.12 FR chargées
ne fournissent que `OldRod` ; Bonne Canne et Super Canne restent donc volontairement
adossées à cette table d'espèces, avec leurs probabilités de morsure propres, jusqu'à
l'apparition éventuelle de tables source correspondantes.

Les Pokémon errants visibles des grottes sont portés comme événements de carte,
et non comme rencontres aléatoires inventées : le compilateur traduit génériquement
`pbEncounter(EncounterTypes::...)`, le combat suspend la séquence, puis
`erase-event` retire sprite, collision et acteur Coop jusqu'au rechargement de la
carte. Éclate-Roc et le DexNav restent les prochains sous-lots du chantier
`SOLO-FIELD-ENCOUNTERS-1`. La réplication de la pose de pêche distante et les bonus
de Balls dépendant de la pêche restent deux dettes explicites.

Finition ergonomique pêche : la case regardée est analysée avec le contrat de
terrain partagé avec Surf. Face à une eau pêchable, un bouton tactile voisin de la
Boussole sort directement la canne favorite choisie dans sa roue du Sac. La
préférence est personnelle et persistante ; en migration, une canne compatible
avec la table locale est choisie automatiquement sans modifier la sauvegarde.
Bonne Canne et Super Canne réutilisent la table `OldRod` disponible dans la zone,
sans inventer d'espèces, et conservent leur vitesse de morsure. La lecture de la
planche de pêche respecte aussi l'ordre inversé employé par RPG Maker.
La palette bleue spécifique de la canne est protégée du filtre de personnalisation
dans l'overworld comme dans les deux aperçus d'avatar ; seuls le personnage et ses
vêtements suivent les couleurs choisies.

### Phase 12 - Extensions Coop

La capture invitee depend de la capture solo ; le loot delegue depend de la
classification des objets ; le Ranch partage reste en lecture seule ; le chat est
un etat de session borne. Les permissions et transactions sont explicites et
idempotentes.

### Phase 13 - Plateforme et ergonomie

Les sauvegardes cloud exigent authentification et politique de conflit. L'import
de sauvegarde exige des echantillons v2.12 FR. Les menus plein canvas, le Sac
avance, les echelles de sprites et les controles Android reutilisent les noyaux
existants et ne creent pas de logique de gameplay parallele.

## Regles transversales

- aucun fichier source du fangame dans Git ;
- UI multi-ecran : overworld, combat, evolution et cinematiques restent dans une
  scene 4:3 redimensionnee ; menus, Sac, Equipe, Ranch, resume et Coop utilisent
  une surface responsive portrait/paysage, avec cibles tactiles d'au moins 44 px ;
- toute nouvelle mecanique doit partager son noyau entre solo et Coop dans le meme
  lot : autorite, domaine d'etat, persistance, audience et replication sont definis
  avant le code, puis testes en solo, comme hote, comme invite et apres reconnexion ;
- un report multijoueur doit etre demande explicitement et laisser des maintenant
  un contrat de donnees ainsi qu'une dette documentee ;
- aucune modification du dossier source ;
- TypeScript strict et aucune donnee importante en `any` ;
- schemas versionnes et provenance obligatoire ;
- moteur de jeu independant de Vue, Nuxt, Phaser, PixiJS et du DOM ;
- serveur autoritaire ;
- RNG centralisee et reproductible ;
- decisions structurantes documentees ;
- fonctionnalite consideree terminee seulement avec tests et rapport de couverture.

### Automatisation des lots Pokémon et Dresseurs — 2026-10-15

- [x] calculer automatiquement capacités et talents requis par chaque espèce et
  chaque équipe de Dresseur ;
- [x] produire un rapport ciblable qui distingue mécanique absente, partielle,
  animation non mappée et animation non importée ;
- [x] remplacer la liste manuelle d'animations par la couverture des fonctions de
  capacité déclarées supportées ou partielles ;
- [x] importer et lire les animations communes de statut du jeu source ;
- [ ] résorber progressivement les dettes signalées par périmètre au moment où les
  nouvelles rencontres deviennent jouables, sans bloquer sur les zones futures.

### Fidélité narrative des rencontres — 2026-10-19

- [x] extraire les statuts initiaux conditionnés par carte, espèce et switch depuis
  `onWildPokemonCreate` ;
- [x] appliquer l'Exténuation du Couafarel de Nouvelle Réunion et des zones
  concernées avant la création du snapshot de combat solo/Coop ;
- [x] employer le libellé français `Exténuation` tout en conservant l'identifiant
  source interne `caduco` et l'animation `Common:Caduco` ;
- [x] étendre le même catalogue aux formes, capacités forcées, objets, IV/EV,
  shiny et surnoms, puis appliquer ces données avant le snapshot autoritaire ;
- [x] inscrire toute mutation statique ou condition non comprise dans
  `encounter-modifiers.json.audit.unsupported` au lieu de l'appliquer globalement ;
- [x] porter le niveau dynamique de la Map999 et les profils de statistiques de
  boss de la variable 300 avec leur RNG et leur état tactique autoritaires ;
- [ ] ajouter à chaque lot de zone une vérification des préparatifs narratifs et
  des effets post-combat, au-delà du seul audit espèce/capacités/talents.
