# Fiche Pokemon partagee - analyse de Pokemon Z et plan d'integration

Date de reference : 2026-10-03  
Jeu source controle : `Pokemon Z V2.12 - Francais`

## Objectif

Construire une seule fiche Pokemon reutilisable par l'equipe, le Ranch et les
combats, sans dupliquer les regles metier entre le solo, l'hote et l'invite. La
presentation peut changer selon le contexte, mais elle doit toujours lire le meme
modele persistant et appeler les memes operations.

La puissance actuelle et le potentiel restent disponibles pour les tris du Ranch,
mais ne sont pas affiches sur la carte compacte. La carte montre l'identite, les PV
et les quatre capacites typees. `Placer en tete` appartient exclusivement au
contexte Equipe : cette action ne doit pas etre proposee depuis le Ranch, meme si
le Pokemon selectionne se trouve actuellement dans l'equipe.

## Controle obligatoire contre Pokemon Z

Chaque increment de cette fiche commence par un controle du jeu source V2.12 FR,
avant toute implementation. Le compte rendu de l'increment doit preciser :

1. les scripts Ruby et les donnees source relus ;
2. les informations et interactions reellement presentes dans Z ;
3. les assets utilises par Z, leurs variantes et leurs replis ;
4. le comportement observe pour un Pokemon normal et, si le lot les concerne,
   pour un oeuf, une forme, un shiny, le Pokerus ou un Pokemon obscur ;
5. ce qui est reproduit, adapte a la nouvelle UX ou explicitement reporte ;
6. l'autorite, la persistance et l'audience en solo et en Coop.

Les principales references deja identifiees sont :

- `.pokemon-z/data/scripts/134-65688308-pscreen-summary.rb` pour l'ecran de resume ;
- `.pokemon-z/data/scripts/122-12627955-pokebattle-pokemon.rb` pour l'instance Pokemon,
  l'identite, les IV/EV, le genre, le shiny, le bonheur et les statistiques ;
- `.pokemon-z/data/scripts/067-55559301-pbnatures.rb` pour les 25 natures et leurs
  modificateurs ;
- `Graphics/Pictures/summary*.png`, `category.png`, `ribbons.png`, `shiny.png`,
  `statuses.PNG`, `summaryball*.png`, `summaryPokerus*` et les assets obscurs pour
  les conventions graphiques de la version source.

Les chemins source restent locaux dans `.pokemon-z/` ou dans l'installation du
jeu et ne doivent jamais etre ajoutes a Git.

## Ce que propose l'ecran d'origine

L'ecran de Z est organise en cinq pages, avec haut/bas pour changer de Pokemon et
gauche/droite pour changer de page. Le cri est joue a l'ouverture et au changement
de Pokemon.

### 1. Donnees

- sprite, nom, niveau, genre, statut ou K.O., shiny, Pokerus, ball et marques ;
- objet tenu ;
- numero du Pokedex, espece et type(s) ;
- Dresseur d'Origine et identifiant public ;
- experience totale et experience necessaire au prochain niveau ;
- jauge du coeur a la place des informations normales pour un Pokemon obscur.

### 2. Notes du Dresseur

- nature ;
- date et lieu de reception ;
- methode et niveau d'obtention : rencontre, oeuf, echange, cadeau ou rencontre
  fatidique ;
- date et lieu d'eclosion ;
- caracteristique calculee depuis le meilleur IV et l'identifiant personnel ;
- presentation speciale des oeufs.

### 3. Caracteristiques

- PV actuels/maximaux, Attaque, Defense, Attaque Speciale, Defense Speciale et
  Vitesse ;
- couleur des statistiques favorisee et penalisee par la nature ;
- talent et description ;
- objet tenu ;
- appreciation simplifiee des IV.

La validation ouvre dans Z une sous-page avancee affichant les IV et EV exacts,
le bonheur, le type de Puissance Cachee ainsi que le talent et sa description.

### 4. Mouvements

- quatre capacites, leur type et leurs PP ;
- pour la capacite selectionnee : categorie, puissance, precision et description ;
- reorganisation des quatre capacites.

### 5. Rubans

- nombre de rubans et grille des rubans possedes ;
- marques et objet tenu restent accessibles.

## Proposition pour Pokemon Z-Battle

La fiche moderne conserve ces cinq familles d'information : `Identite`,
`Historique`, `Stats`, `Capacites` et `Rubans`. Le composant visuel est commun,
mais recoit un contrat de contexte :

| Contexte | Lecture | Mutations autorisees |
| --- | --- | --- |
| Equipe | fiche complete du proprietaire | placer en tete, objet, marques, ordre des capacites |
| Ranch | fiche complete du proprietaire | deposer/retirer, objet, marques, liberation ; jamais placer en tete |
| Combat | donnees utiles au combat | lecture seule dans le premier lot, puis changement si les regles l'autorisent |
| Autre joueur Coop | projection publique minimale | aucune mutation ni exposition des IV/EV ou de l'historique prive |

Les fonds originaux peuvent servir de reference, mais l'interface ne dependra pas
d'un assemblage fixe d'images RPG Maker. Les sprites, icones de type, categories,
statuts, balls, shiny et rubans passent par des resolvers d'assets communs.

## Briques disponibles et manquantes

Les imports contiennent deja 1 018 definitions de Pokemon, 730 capacites,
255 talents et 906 objets. Les definitions d'espece comprennent notamment les
types, statistiques de base, rendement EV, taux de genre, croissance, bonheur,
talents, groupes d'oeufs, taille et poids. Les capacites connaissent leur type,
categorie, puissance, precision, PP, cible, priorite, drapeaux et description.

Le modele persistant historique ne conservait toutefois que l'espece, le niveau,
l'experience, les statistiques calculees, les PV, le statut, le talent, l'objet et
les capacites. Il manque donc encore, selon les lots :

- identifiant personnel, IV, EV, nature, bonheur, genre, shiny et forme ;
- identite stable du Dresseur d'Origine et identifiant public ;
- ball, methode/lieu/date/niveau d'obtention et donnees d'eclosion ;
- marques, rubans, Pokerus et etat d'oeuf ;
- calculateur unique des statistiques et progression EV/bonheur ;
- exposition runtime des descriptions de capacites et talents ;
- resolver generique espece/forme/genre/shiny pour face, dos, icone et cri ;
- gestion sure des objets tenus, sans equiper un objet que le moteur de combat ne
  sait pas encore appliquer ;
- controleur de fiche partage et projection publique Coop.

## Contrat solo et Coop

Ces donnees sont personnelles et sous l'autorite du proprietaire. Elles sont
persistees dans sa sauvegarde en solo, pour l'hote comme pour l'invite. Les actions
de consultation, de tri, de marquage ou de reorganisation n'envoient aucune
intention a la room narrative.

Lorsqu'un Pokemon participe a un combat partage, seule l'intention de combat est
envoyee a l'autorite de la room. Les autres joueurs recoivent la projection
strictement necessaire au rendu et au resultat : identite visuelle publique,
niveau, PV/statut utiles et actions visibles. Les IV, EV, historique, identite
privee du proprietaire et contenu complet du Ranch ne sont pas repliques. Apres
reconnexion, la sauvegarde personnelle restaure les donnees completes ; l'etat
autoritaire du combat restaure seulement sa projection active.

## Ordre d'implementation

### Etape 1 - Modele persistant et migration

- ajouter un sous-modele Pokemon versionne, compatible avec les informations de Z ;
- migrer deterministement les anciennes sauvegardes pour qu'un meme Pokemon garde
  toujours le meme identifiant personnel, ses IV et sa nature ;
- valider strictement les bornes IV/EV, le total EV, les identites et metadonnees ;
- ne pas changer les statistiques de combat visibles avant le calculateur de
  l'etape 3.

Premier increment retenu : poser le contrat complet, remplir seulement les valeurs
qui peuvent etre migrees sans inventer un historique (identifiant personnel, IV,
EV nuls, nature, forme, shiny historique a `false`, champs inconnus explicites),
et conserver les calculs actuels. L'enrichissement des valeurs dependantes du
catalogue ou du Dresseur sera fait par les etapes suivantes.

Premier increment implemente le 2026-10-03 : `PersistentPokemon.metadata` porte
un schema propre pour l'identifiant personnel, IV, EV, nature, genre, bonheur,
shiny, forme, proprietaire, origine, marques, rubans, Pokerus et pas d'oeuf. Les
anciennes sauvegardes sans ce bloc sont migrees de facon deterministe depuis
l'identifiant d'instance et l'espece. Le controle du script source confirme les
six IV aleatoires entre 0 et 31, les EV initiaux nuls, les plafonds 252/510,
l'ordre exact des 25 natures et `nature = personalID % 25`. Le genre, le bonheur
et le proprietaire restent explicitement inconnus lorsqu'ils ne peuvent pas etre
deduits de l'ancienne sauvegarde ; aucun historique fictif n'est cree. Les
statistiques de combat restent volontairement calculees comme avant jusqu'a
l'etape 3.

### Etape 2 - Identite stable du Dresseur et fabrique de Pokemon

- donner au profil un identifiant de Dresseur stable et un identifiant public ;
- faire passer tout Pokemon obtenu par une fabrique recevant proprietaire, methode,
  lieu, ball et date ;
- definir les projections publiques necessaires aux echanges et a la Coop.

Etape implementee le 2026-10-03 : la selection de personnage contient une
`PlayerTrainerIdentity` privee et versionnee. Son identifiant 32 bits est genere
une seule fois, persiste independamment de la sauvegarde d'aventure et migre les
anciens profils au premier chargement. Son identifiant public correspond aux
16 bits bas, comme `PokeBattle_Trainer#publicID` dans Z. Cette identite privee
n'entre pas dans `NetworkPlayerProfile`.

La fabrique commune accepte maintenant un contexte de proprietaire et d'obtention.
Les trois chemins `add-pokemon` de l'overworld lui transmettent le Dresseur actif,
la carte, la date et `POKEBALL`, correspondant a `ballused = 0` dans le script
source. Le genre est derive du taux d'espece et de l'octet bas du `personalID`, le
bonheur initial vient du catalogue, et le shiny suit le seuil propre a cette
version (`SHINYPOKEMONCHANCE = 100`). `publicPokemonIdentity` prepare les futurs
echanges et rendus Coop sans exposer trainerId, IV, EV ni historique prive. Aucune
projection Pokemon n'est encore envoyee dans la room.

### Etape 3 - Calculateur exact IV/EV/nature

- porter les formules et modificateurs controles dans Z ;
- utiliser un noyau pur unique pour creation, montee de niveau, fiche et combat ;
- migrer les PV courants sans soin ou K.O. involontaire.

Etape implementee le 2026-10-03 : `calculatePokemonStats` reproduit les divisions
entieres de `PokeBattle_Pokemon#calcHP`, `#calcStat` et `#calcStats`, y compris le
cas `base HP = 1`, `EV / 4` tronque, puis le multiplicateur de nature 110/90 apres
le `+5`. L'ordre source est respecte : Attaque, Defense, Vitesse, Attaque Speciale,
Defense Speciale. Le meme noyau calcule les nouveaux Pokemon et les montees de
niveau ; le combat lit ensuite ces statistiques persistantes sans formule bis.

`recalculatePlayerPokemonCollection` reconcilie une seule fois les anciennes
statistiques de l'equipe et du Ranch des que le catalogue est disponible. Le
deficit de PV est conserve. Un Pokemon deja K.O. reste a 0 PV et un Pokemon vivant
est protege d'un K.O. artificiel si son nouveau maximum est inferieur a l'ancien.
Le resultat est persiste localement pour le solo, l'hote et l'invite ; seuls les
champs de combat deja prevus sont visibles a distance.

### Etape 4 - Catalogues et assets complets

- exposer talents, descriptions, cibles et champs d'espece manquants au runtime ;
- ajouter les resolvers de formes, genres, shiny, face/dos, icones, cris, balls,
  categories, statuts et rubans ;
- documenter chaque repli quand un asset de Z est absent.

Etape implementee le 2026-10-03 : `PlayerDetailsCatalog` expose au runtime les
talents et leurs descriptions, les descriptions et cibles de capacites, ainsi que
numero, espece, formes, EV donnes, talents caches, pas d'eclosion, taille et poids.
Noms, especes, formes, capacites et talents utilisent les catalogues francais
extraits. L'entree Pokedex restant uniquement disponible dans le catalogue source
anglais, elle est conservee comme donnee de provenance mais ne sera pas affichee
par la fiche tant qu'une source francaise fiable n'aura pas ete raccordee.

Un resolveur unique selectionne desormais battler face/dos, icone, sprite
overworld, empreinte et cri selon forme, variante, shiny et genre. Son ordre de
repli est deterministe et signale les dimensions absentes : variante exacte puis
neutre, forme exacte puis forme de base, shiny puis normal, femelle puis neutre ;
un dos ne peut jamais etre remplace silencieusement par une face si un dos existe.
La forme `0` et la forme source `null` representent toutes deux la forme de base.
Les cartes de collection, les suiveurs locaux/distants, les combats et les cris
passent par ce contrat. `category.png`, `ribbons.png`, `shiny.png`, `statuses.PNG`,
`summaryPokerus.png` et les 24 `summaryballNN.png` sont indexes depuis le manifeste
local pour la fiche de l'etape 5, sans copier de fichier du jeu dans Git.

En Coop, le combat transporte seulement l'apparence publique du battler. Un
suiveur invite publie espece, forme, shiny et genre ; la room valide et conserve
ce petit etat lors d'un changement de carte ou d'une reconnexion. Identifiant de
Dresseur, IV, EV, objet, historique et collection ne sont jamais ajoutes au
snapshot. Les feuilles de categories, statuts et rubans sont seulement preparees
ici : leur decoupage et leur presentation appartiennent a l'etape 5.

### Etape 5 - Fiche en lecture

- implementer les cinq onglets et la navigation equipe/Ranch/combat ;
- gerer les projections proprietaire et publique ;
- conserver les cas speciaux non portes comme etats explicites, pas comme fausses
  donnees de demonstration.

Etape implementee le 2026-10-03 apres relecture de
`134-65688308-pscreen-summary.rb`, des statuts, de `$BallTypes` et des 80 rubans
de Z. Le bouton `Details` de la roue ouvre maintenant un resume commun depuis
l'Equipe ou le Ranch ; un bouton `Resume` donne acces au meme ecran en lecture
seule pendant un combat. Les cinq pages `Identite`, `Historique`, `Stats`,
`Capacites` et `Rubans` sont navigables au clic ou avec les fleches. Haut/bas
change de Pokemon dans la collection du contexte et rejoue son vrai cri, comme
dans l'ecran source.

La colonne commune affiche sprite de forme/genre/shiny, niveau, statut, Ball,
objet, Pokerus et marques. Les pages couvrent numero, espece, types, DO et ID
public, experience, dimensions, nature, origine, caracteristique, statistiques et
effets de nature, talent, appreciation IV par etoiles, puis la sous-page avancee
IV/EV, bonheur et type de Puissance Cachee. Les quatre capacites et leurs PP sont
lisibles ; descriptions, categorie, puissance, precision et reorganisation sont
volontairement reservees a l'etape 6. Les rubans numeriques peuvent etre decoupes
depuis la feuille source ; les identifiants encore symboliques restent affiches
en texte plutot que d'inventer une correspondance.

Les informations absentes restent explicites : lieu historique sous forme
`Carte NNN` lorsqu'aucun libelle persistant n'existe, entree Pokedex francaise
indisponible, etat obscur non represente, et presentation d'oeuf limitee aux pas
restants. `createPublicSourcePokemonSummary` produit separement une projection
publique minimale et marque Historique, Stats, Capacites et Rubans comme prives.
La fiche utilise uniquement la sauvegarde personnelle en solo, chez l'hote et
chez l'invite ; elle n'ajoute aucune donnee aux snapshots de room.

### Etape 6 - Capacites et ordre

- afficher descriptions, categorie, puissance, precision et PP ;
- reordonner les capacites via une operation personnelle persistante commune ;
- raccorder le nouvel ordre au combat sans seconde implementation.

Etape implementee le 2026-10-03 apres controle de `pbMoveSelection` dans
`134-65688308-pscreen-summary.rb`. La page Capacites propose les quatre
emplacements et affiche le nom et l'icone de type, les PP courants/maximaux, la
categorie source, la puissance, la precision et la description francaise. Les
valeurs speciales de Z sont conservees : puissance `1` affiche `???`, puissance
ou precision `0` affiche un tiret. Selectionner `Reorganiser`, puis une seconde
capacite, permute reellement les deux emplacements.

`reorderPokemonMoves` est une operation pure du noyau `player-state`, commune a
l'equipe et au Ranch. Son resultat est persiste dans la sauvegarde personnelle et
`playerPartyToBattleTeam` consomme deja les capacites dans cet ordre : le combat
suivant ne possede donc aucune implementation parallele. Une fiche ouverte depuis
un combat actif reste volontairement en lecture seule pour ne pas modifier un
etat de tour deja cree. Autorite et audience restent celles du proprietaire en
solo, chez l'hote comme chez l'invite ; aucune intention ni donnee privee n'est
repliquee a la room, et une reconnexion restaure l'ordre par la sauvegarde locale.

Le sprite de la colonne commune est aussi corrige dans ce lot. Les battlers de Z
sont des feuilles horizontales, pas des images fixes : le canvas decoupe maintenant
`frameCount` images a partir des dimensions du manifeste et les joue toutes les
120 ms pour obtenir le rythme visuel retenu par le portage. Le
changement ou la fermeture de fiche annule la boucle precedente et la preference
systeme de reduction des animations conserve uniquement la premiere image.

Correctif visuel du meme jalon : les icones 128 x 64 des cartes Equipe/Ranch et
de leur roue d'action alternent maintenant leurs deux poses 64 x 64, comme
`PokemonIconSprite` dans Z. Un Pokemon au-dessus de la moitie de ses PV effectue
un cycle en 250 ms ; l'animation ralentit a 500 puis 1 000 ms sous la moitie et le
quart des PV, et reste sur sa premiere pose au K.O. La preference de reduction des
animations est respectee.

### Etape 7 - Progression EV et bonheur

- attribuer les EV et faire evoluer le bonheur selon les evenements portes ;
- recalculer les statistiques via le noyau commun ;
- tester victoire, niveau, K.O., soin et restauration/reconnexion.

### Etape 8 - Objets tenus

- filtrer les objets equipables et gerer inventaire, echange et retrait atomiques ;
- n'activer un effet de combat que lorsqu'il est pris en charge par le noyau ;
- appliquer les memes regles en solo et Coop.

### Etape 9 - Marques, rubans et systemes avances

- marques et liberation securisee ;
- rubans lorsque leurs sources d'obtention sont portees ;
- oeufs, Pokerus, Pokemon obscurs et autres extensions uniquement apres controle
  de leurs boucles completes dans Z.

## Validation de chaque increment

Chaque increment doit avoir des tests unitaires du noyau, des tests de migration,
un controle du contexte UI concerne et, lorsqu'une mutation devient visible ou
persistante, les cas solo, hote, invite, rendu distant et reconnexion prevus par
son contrat. Le minimum de livraison reste `corepack pnpm test` et
`corepack pnpm build`.
