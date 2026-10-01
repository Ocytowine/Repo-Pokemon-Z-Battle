# Reprise du developpement par une IA

Derniere mise a jour : 2026-10-01.

Ce document est la reference courte pour reprendre Pokemon Z-Battle sans refaire
l'analyse historique du depot. Il doit etre lu avec la section 9.7 de
`docs/ROADMAP.md`.

## Intention du projet

Pokemon Z-Battle est un moteur web TypeScript qui interprete les donnees locales de
Pokemon Z v2.12 FR sans executer son Ruby et sans versionner ses assets. Les donnees
extraites vivent dans `.pokemon-z/`, qui reste local et ignore par Git.

Une correction doit autant que possible profiter a toutes les cartes. Ne pas coder
une regle metier a partir de `Map002`, `EV017`, du switch 67 ou de Keunotor si la
structure de la commande source permet une detection generique.

## Etat Git au moment de cette note

Le dernier commit connu est `1b4b9d0 FIX : Histoire bloqué`. Le worktree contient
le decoupage stabilise de l'orchestrateur overworld et le noyau 9.7 qui raccorde
les routes autonomes personnalisees, le contact initie par un evenement, les
ambiances BGS, l'ordonnanceur des pages paralleles et le Pokemon suiveur.

Le porteur du projet prefere effectuer lui-meme les commits apres validation
manuelle. Ne pas supprimer ou restaurer ce lot pendant une reprise.

## Ordre de travail convenu

### 1. Progression des starters — fonctionnel

Etat : termine dans le code, validation manuelle principale effectuee.

- Une page de starter est detectee par sa structure source : ajout du Pokemon,
  choix du type et rencontre obligatoire, sans liste d'identifiants d'evenements.
- Des qu'un membre existe dans l'equipe, les trois pages de choix et le raccourci
  de test sont verrouilles. Il n'est plus possible de prendre plusieurs starters.
- La victoire contre Keunotor applique son interrupteur de victoire puis selectionne
  uniquement l'autorun nouvellement active. L'autorun d'introduction `EV001`, deja
  actif auparavant, n'est donc plus relance par erreur.
- `EV017` joue ensuite ses commandes dans l'ordre. Le switch 67 est active et
  persiste ; le switch 68 revele Crisanto ; le switch 69 fait apparaitre la lettre.
- Les tests de selection du starter, d'etat, de combat et d'autorun protegent la
  non-duplication et la progression.

Recette manuelle : vider la sauvegarde locale, choisir un starter, vaincre Keunotor,
verifier l'impossibilite de choisir un autre starter et la scene de Crisanto.

```js
localStorage.removeItem("pokemon-z-battle.source-event-state.v1");
localStorage.removeItem("pokemon-z-battle.source-world-save.v1");
location.reload();
```

### 2. Deplacements fluides et animations — fonctionnel

Etat : termine pour les primitives de mouvement actuellement extraites.

- Le joueur garde une position logique entiere et une position affichee interpolee.
- La camera suit la position affichee en restant alignee aux pixels.
- Le maintien d'une touche enchaine les cases sans delai clavier artificiel.
- Joueur et PNJ utilisent les motifs de marche ; les PNJ autonomes respectent leur
  vitesse, leur frequence et les collisions.
- Les routes source gerent pas, diagonales, sauts, orientations, attentes, vitesse,
  opacite, sprite et interrupteurs.
- Les routes d'acteurs differents peuvent etre concurrentes. Les routes d'un meme
  acteur sont ordonnees. `wait-for-movement` sert de barriere.
- La scene du starter anime l'approche du Keunotor. Apres la victoire, Crisanto sort
  du bonhomme de neige et la lettre est emportee.

Les effets audiovisuels ne font pas partie de ce jalon de mouvement ; ils sont
inventories automatiquement par l'audit de scene decrit plus bas.

### 3. Gestionnaire de scenes — en cours

Etat : parcours overworld/combat integre ; politique des controles centralisee.

- Le combat source est maintenant superpose au canvas overworld, au lieu d'etre
  rendu dans un panneau lateral independant.
- Les combats de Dresseurs demandes par une condition source utilisent le meme
  moteur et la meme transition, mais interdisent la fuite et reprennent la sequence
  narrative avec le resultat du combat.
- Un fondu masque l'entree et la sortie. La fin du combat attend le fondu avant de
  rendre les controles a l'overworld ; la carte et la position ne sont pas recreees.
- Les actions, le message et les HUD font partie de la meme scene 4:3.
- Le placement des battlers reproduit les constantes de Pokemon Z et son script
  `SpriteAutoAlign` : centre horizontal de la frame et dernier pixel visible pose
  sur la ligne de sol. Les bases utilisent egalement leurs coordonnees source.
- `source-battle-layout.ts` contient les calculs purs et leurs tests de regression.
- `SourceSceneCoordinator.allows(...)` est l'unique politique d'autorisation pour
  les controles du monde, les dialogues, les changements de scene, les mouvements
  ambiants et les transferts de cinematique. Les boutons et les entrees clavier
  consultent les memes regles.

Les briques existent (`SourceBattleController`, dialogues, sequences, chargement de
cartes). Leurs donnees d'activite sont encore produites par plusieurs sous-systemes,
mais les decisions de controle ne dupliquent plus leurs combinaisons dans `main.ts`.

Objectif : introduire un coordinateur ou une machine d'etats explicite couvrant au
minimum :

```text
overworld -> transition combat -> combat -> transition retour -> overworld
                     \-> menu -> overworld
```

Criteres d'acceptation :

- le combat s'ouvre depuis l'overworld sans donner l'impression de changer
  d'application ou d'ecran independant ;
- une transition visuelle masque proprement le changement de mode ;
- la victoire, la defaite ou la fuite rendent la meme carte et la meme position ;
- un seul mode possede les controles a un instant donne : couvert par la politique
  et ses tests tabulaires ;
- le coordinateur remplace les gardes dupliques de `main.ts` pour les actions
  utilisateur ; les mouvements de camera et animations de carte sont raccordes a
  la couche de presentation.

### 4. Menu en jeu minimal — fonctionnel

Etat : perimetre minimal termine ; validation manuelle a effectuer.

- `SourceSceneCoordinator` expose les modes overworld, dialogue, combat, menu et
  transition, et refuse l'ouverture pendant une activite incompatible.
- Le menu s'ouvre avec `Echap`, `M` ou le bouton du sandbox et gele joueur, PNJ et
  interactions.
- Les onglets Equipe et Sac affichent les vraies donnees persistantes.
- Sauvegarde enregistre manuellement carte, position, direction et date. Le lancement
  suivant recharge cette carte et cette position ; une donnee invalide revient
  proprement a Bourg Canvas.
- Options memorise le volume choisi et le raccorde aux musiques et effets des
  cinematiques. Le lecteur audio du combat conserve encore son reglage propre.
- Le visuel reutilise les assets locaux `partybg.png`, `partyBall.PNG`,
  `bagPocket*.png` et `pause.png`, avec un repli CSS structurel.

Le menu doit etre un mode du gestionnaire de scenes, pas une nouvelle page. Premier
perimetre :

- equipe : membres, niveau, PV et capacites ;
- sac : objets et quantites de `SourceEventState.inventory` ;
- sauvegarde : etat, carte et position courante ;
- options : volume et commandes essentielles ;
- ouverture/fermeture par clavier avec gel de l'overworld.

La sauvegarde manuelle de position utilise `pokemon-z-battle.source-world-save.v1`.
Elle reste distincte du checkpoint de soin et de l'etat narratif persiste dans
`pokemon-z-battle.source-event-state.v1`.

### 5. Moteur complet des evenements 9.7 — partiel

Etat actuel :

- interaction directe : prise en charge ;
- pages conditionnelles et choix : pris en charge pour le sous-ensemble converti ;
- routes imposees et mouvements autonomes : pris en charge ;
- autorun nouvellement active apres changement d'etat : pris en charge ;
- contact joueur/evenement : pris en charge dans les deux sens. Un evenement en
  mouvement aleatoire ou sur une route autonome personnalisee lance sa page de
  contact lorsqu'il tente d'atteindre la case du joueur, sans l'occuper ;
- premier autorun actif apres un transfert de carte : pris en charge ;
- evenements paralleles : un ordonnanceur par carte/evenement/page execute en
  concurrence les presentations, attentes, mutations d'etat et routes ; une page
  interactive est serialisee temporairement par le lecteur de scene ;
- Pokemon suiveur : activation persistante, asset de l'espece active, suivi fluide
  et repositionnement entre les cartes pris en charge ;
- tonalite, flash, panorama, brouillard, images, musique et sons de cinematique :
  rendus par `SourceScenePresentation` ;
- camera scriptable, animations de carte et options de boite de texte : rendues.

Ne pas lancer aveuglement le premier autorun actif d'une carte. `Map002` contient
par exemple un autorun d'introduction inconditionnel et un autorun post-combat. Lors
d'un changement d'etat, il faut selectionner la page qui vient d'etre activee en
comparant l'etat precedent et le nouvel etat.

## Registre, plan et audit de scene

Les prochaines commandes d'evenement doivent suivre ce circuit :

```text
page resolue -> registre des commandes -> plan de scene -> audit -> execution
```

Fichiers principaux :

- `apps/overworld-sandbox/src/source-command-registry.ts` : famille et niveau de
  support de chaque commande ;
- `apps/overworld-sandbox/src/source-scene-plan.ts` : compilation et audit ;
- `apps/overworld-sandbox/src/source-sequence-runner.ts` : attentes et concurrence
  des routes ;
- `apps/overworld-sandbox/src/source-move-route.ts` : interpretation pure d'une
  etape de route ;
- `apps/overworld-sandbox/src/source-event-flow.ts` : choix, conditions et portage
  des commandes Ruby reconnues.

Niveaux du registre :

- `rendered` : effet visible effectivement rendu ;
- `executed` : effet logique execute sans rendu propre ;
- `absorbed` : donnees consommees par une autre commande ;
- `accepted` : commande reconnue mais rendu encore manquant.

Audit actuel observe pour `EV017` :

```text
145 commandes · 15 dialogues · 64 commandes de mouvement
aucun rendu en attente
```

L'absence de `erreurs:` signifie que les routes, acteurs et sprites requis sont
coherents. Les 64 entrees de mouvement comprennent les routes, leurs continuations
et les barrieres ; ce ne sont pas 64 deplacements distincts.

`SourceScenePresentation` rend maintenant `screen-tone`, `screen-flash`, les deux
variantes observees de `change-map-settings` (panorama et brouillard), `show-picture`,
`move-picture`, `erase-picture`, `play-music`, `play-sound` et `fade-music`. Les
images utilisent le repere RPG Maker 512 x 384 et les fichiers audio essaient les
extensions OGG, WAV et MP3. Le volume du menu pilote ces pistes de cinematique.

Le defilement de camera respecte direction, distance et vitesse RPG Maker sans
bloquer les dialogues. `show-animation` lit les 100 animations normalisees depuis
`map-animations.json`, les place sur le joueur ou l'evenement cible et joue leurs
sons et flashs. `text-options` applique les positions haute, centrale et basse,
ainsi que le mode transparent. L'audit d'EV017 ne signale donc plus aucun rendu en
attente.

Les images de cinematique sont composees au-dessus de la tonalite d'ecran : une
tonalite noire peut donc masquer la carte sans cacher les portraits et cartons de
chapitre. Apres un transfert commande par une sequence, le premier `autorun` actif
de la carte d'arrivee est lance dans l'ordre des identifiants. Le transfert final
d'EV017 enchaine ainsi sur l'evenement `crisanto` de Map003, qui restaure la
tonalite au lieu de laisser la carte noire.

Le rendu de carte utilise maintenant les `priorities` du tileset selon la formule
RPG Maker XP. Les tuiles de toit et de cime peuvent donc repasser devant un acteur
selon sa ligne. Une ombre de contact est dessinee sous les charsets du joueur et
des PNJ ; la convention source `/noShadow/` dans le nom d'un evenement la retire
pour les portes, objets et effets qui ne doivent pas en recevoir.

Lorsqu'une commande d'etat active une autre page d'evenement, sa nouvelle apparence
prime immediatement sur les substitutions de sprite conservees par une ancienne
route. La position logique reste preservee, mais un PNJ dont la nouvelle page est
vide disparait bien. Cette synchronisation corrige notamment Crisanto apres sa
marche vers la droite dans la scene d'arrivee de Map003.

`play-cry` resout l'identifiant interne de l'espece dans `pokemon-assets.json` et
lit son cri extrait. `play-jingle` lit les fichiers de `Audio/ME` et
`play-background-sound` pilote une piste bouclée distincte dans `Audio/BGS`. La
musique, l'ambiance et les sons ponctuels suivent tous le volume du menu.

Les routes autonomes `moveType 3` sont conservees au chargement et parcourues par
le meme interpreteur pur que les routes imposees. Les pas cardinaux, orientations,
attentes et repetitions observes sur les pages de contact sont donc joues dans
l'overworld. Le controleur renvoie le couple evenement/page exact lorsqu'un de ces
pas vise le joueur ; l'orchestrateur demarre alors la sequence source auditee.

`SourceParallelController` maintient une tache annulable pour chaque page
`trigger 4` active. Les boucles sont reevaluees apres au moins une frame RPG Maker,
ce qui evite les boucles CPU sans attente source. Un changement de page ou de carte
annule l'ancienne tache ; une mutation persistante resynchronise immediatement les
pages actives. Etat, presentation, temporisation et routes s'executent en fond avec
leurs barrieres de mouvement. Les pages qui ouvrent dialogue, choix, combat,
boutique ou transfert passent par le lecteur de scene exclusif, puis les paralleles
sont resynchronises a sa terminaison.

Correction de stabilite des choix : une boucle parallele de presentation ne doit
pas appeler le rendu complet de l'interface a chaque frame. Sur Map002, cela
remplacait les boutons Oui/Non entre `pointerdown` et `click`. Les boucles mettent
maintenant a jour leur couche directement, et `SourceDialogueView` conserve les
noeuds de choix lorsque leurs libelles sont inchanges.

Correction de reprise apres rencontre sauvage scriptée :
`SourceBattleController.startPendingEncounter` accepte un callback de resultat,
comme les combats de Dresseur. `SourceSequenceEffects` l'installe uniquement pour
les rencontres lancees par une sequence et reprend le curseur apres une victoire ;
une fuite ou une defaite termine proprement la sequence. Sans ce raccord, le combat
du Keunotor de Map002 se terminait mais EV003 restait en pause avant ses quatre
dernieres commandes. Le catalogue local `map-animations.json`, absent d'une
ancienne extraction, peut etre regenere seul par `extract:runtime` sans recopier
les assets.

`set-follower` active maintenant un drapeau personnel persistant. Le Pokemon a
l'index actif de l'equipe utilise son sprite par defaut lu dans
`pokemon-assets.json`. `SourceFollowerMotionController` le place sur une case
praticable derriere le joueur, interpole son trajet vers chaque case liberee et le
repositionne apres un transfert. La position elle-meme reste visuelle et transitoire
afin de ne pas alourdir la sauvegarde narrative. Une ancienne sauvegarde sans ce
drapeau l'active automatiquement lorsqu'une equipe existe deja.

La scene d'entree du laboratoire, Map005 evenement `crisanto`, est un jalon
vertical valide par les donnees locales : 302 commandes resolues, 30
dialogues, 182 commandes de mouvement et aucun rendu en attente. Les scripts Ruby
fractionnes sur plusieurs commandes sont reunis avant portage. Les appels
`dependentEvents.remove_sprite(true)` et `refresh_sprite`, utilises pour masquer ou
rafraichir ponctuellement le compagnon pendant certaines scenes, restent absorbes
comme hooks de presentation ; ils ne modifient pas son activation persistante.

Les routes sont auditees primitive par primitive avant lecture. L'effet sonore
embarque dans une route RPG Maker est execute par la meme couche audio que les
commandes de scene. Cela corrige l'interruption de Map005 au moment ou M. Mime
saute hors du bocal : la route `play-sound`, `jump` se poursuit sans rendre les
controles au joueur. Un autorun dont l'audit reste incomplet est maintenant refuse
avant son demarrage, au lieu de pouvoir echouer au milieu de la cinematique.

Le premier combat de Dresseur, Map003 evenement 28, constitue le dix-septieme
noyau vertical. Une zone de contact non visible demarre sa sequence, puis les
conditions Ruby `pbTrainerBattle` sont converties en demandes de combat differees.
`trainers.json` fournit l'equipe correspondant a la variable de starter et
`trainer-types.json` fournit la musique de combat. Crisanto utilise donc Grenousse,
Marisson ou Feunnec niveau 5 selon le choix initial. La fuite est interdite ; a la
fin, le resultat revient dans la sequence, puis l'autorun nouvellement active par
le switch 70 joue les dialogues, mouvements et objets d'apres-combat. La commande
`play-jingle`, rencontree sur un autre evenement de la carte, est egalement rendue
par la couche audio.

Les trois variantes d'avant-combat compilent chacune 59 commandes, 7 dialogues et
30 commandes de mouvement. La page d'apres-combat compile 111 commandes, 16
dialogues et 52 commandes de mouvement. Les quatre audits sont complets et ne
signalent aucun rendu en attente.

Recette manuelle : apres la scene du laboratoire, sortir vers Bourg Canvas puis
avancer dans la zone devant Crisanto. Verifier que la mise en place se joue, que le
combat affiche le starter complementaire de Crisanto, que la fuite n'est pas
proposee et que la victoire enchaine sur les dialogues et la remise des objets sans
rendre le controle entre les deux scenes.

Correction de reprise : le premier transfert de cette scene vise Map003 depuis
Map003. Un transfert vers la carte deja chargee repositionne maintenant les acteurs
sans recharger tous les assets et sans armer un autorun d'entree parasite. Toute
exception de sequence libere aussi les controles et affiche la commande fautive au
lieu de laisser le jeu silencieusement fige. Les pages `player touch` sont detectees
dans la direction demandee avant la resolution du pas : une zone placee sur une
tuile infranchissable demarre donc bien depuis la case voisine, meme si le joueur
regardait auparavant dans une autre direction.

Le transfert interne d'une sequence vers la carte deja chargee est execute de
maniere synchrone par le lecteur de sequence. Il repositionne le joueur et remet les
PNJ a leur position source sans ouvrir une transition de carte intermediaire. Cela
evite que la zone de contact du duel soit reevaluee entre le teleport en `40,15` et
la route qui fait avancer le joueur. Le panneau Moteur expose aussi la sequence, son
curseur, sa prochaine commande et le nombre de routes actives pour diagnostiquer un
eventuel prochain blocage sans ouvrir les outils du navigateur.

Important : une entree de `map.transfers` signifie seulement qu'une page contient
une commande de transfert ; elle ne prouve pas que la page est une porte simple.
Tous les evenements `player touch` passent donc par le lecteur de sequence. Celui-ci
joue une porte courte comme une cinematique complexe avant d'executer son transfert.
EV028 n'est ainsi plus reduit a son transfert initial vers `40,15` : ses mouvements,
dialogues et son combat sont conserves.

Le lot Route 1 relie maintenant Map003, Map007 et Map009 sans correctif lie a ces
numeros de carte. Les interactions directes sans choix utilisent le lecteur de
sequence complet, ce qui preserve notamment les cris, animations, routes, sons et
objets dans leur ordre. Les 24 pages actives de Map007 compilent sans commande
inconnue ni rendu en attente. EV025, parallele, initialise le panorama `fondoAgua`
et son mouvement par le meme ordonnanceur que les autres boucles `trigger 4`.

Toute augmentation d'inventaire detectee pendant un dialogue ou une sequence joue
le jingle `ItemGet`, affiche le nom localise et la quantite, et remplace temporairement
le joueur par le charset de ramassage `trchar000_2`. Cette pose effectue un court
saut de mise en valeur avant de rester affichee jusqu'a la fermeture du message.
Le canvas de carte conserve ses pixels vides transparents afin que le panorama
source reste visible sous les tuiles qui le revelent. La recette manuelle consiste a
sortir au nord de Bourg Canvas apres Crisanto, verifier le panorama et les cris,
ramasser plusieurs objets, provoquer une rencontre dans les herbes puis rejoindre
Map009 par la sortie nord. Ne cocher le parcours complet de la roadmap qu'apres ce
test avec les assets locaux.

La scene principale suivante se trouve sur Map009 dans EV011, une zone de contact
en `59,34`. Elle est maintenant entierement resolue : 238 commandes apres fusion
des continuations Ruby, 36 dialogues, 110 commandes de mouvement et aucun rendu en
attente. L'obtention du Pokedex est conservee dans `SourceEventState.pokedexEnabled`
et migre les anciennes sauvegardes vers `false`, mais aucun nouvel ecran n'est
affiche. Le porteur souhaite revoir plus tard les interfaces lourdes du Pokedex,
du ranch et de la carte.

L'autorun d'entree EV035 est egalement complet. `weather` gere effacement, pluie,
orage et neige dans une couche CSS legere ; `erase-event` est absorbe par le cycle
de visite de carte, qui ne lance deja l'autorun qu'une fois par chargement. EV040
peut remettre `ACapsula`, car les identifiants mixtes de `pbItemBall` sont maintenant
preserves. EV039 reste volontairement hors de ce lot : son arbre appelle l'evenement
commun 59 et sa fabrication de hache demandera le support generique des evenements
communs et des conditions d'inventaire.

Le premier Centre Pokemon accessible depuis Map009 est Map010. Son infirmiere
EV004 se trouve une case derriere le comptoir : les `passages` du tileset sont
maintenant charges et le bit `0x80` autorise une interaction a deux cases uniquement
quand la case intermediaire est un comptoir. Cette regle est generique et ne depend
ni de la carte ni du nom de l'evenement.

Le lecteur de sequence sait maintenant s'arreter sur un choix. Il execute le
prefixe resolu, affiche les options, ajoute la selection, recompile la branche puis
reprend apres le dernier pas deja execute. Cela remplace l'ancien chemin qui
affichait tous les dialogues d'une branche avant d'appliquer ses effets. Pour la
branche Oui de l'infirmiere, l'ordre est donc : checkpoint, question, choix,
annonce, soin, variable, fondu, jingle, animation, message final. Son audit donne
19 commandes, 3 dialogues, 4 mouvements et aucun rendu en attente ; la branche Non
donne 5 commandes et 2 dialogues.

L'argent est stocke dans `SourceEventState.money`, avec migration a 3 000 ₽ et
plafond a 999 999 ₽ selon les constantes du jeu. `change-money` accepte montant
constant ou variable, et les conditions natives `gold` comparent le solde. Le
montant est visible dans le panneau moteur et l'onglet Sac.

Le vingt-et-unieme noyau porte l'economie jouable. Les appels Ruby multilignes
`pbPokemonMart([...])` deviennent une commande `open-shop` declaree dans le
registre et auditee comme toute transition. La boutique superpose une interface
legere a l'overworld, affiche nom et description francais, prix, quantite possedee
et solde, puis reprend la sequence source a sa fermeture. Un achat d'un exemplaire
est atomique : fonds et limite de 999 objets sont verifies avant de modifier le
portefeuille et le sac. Le stock de Map010 EV005 est ainsi directement issu des
donnees de l'evenement ; sa variante conditionnee par le switch 326 est egalement
prise en charge sans logique propre a la carte.

Une victoire contre un Dresseur verse le niveau maximal de son equipe multiplie
par `baseMoney` de sa classe, conformement au script source. Une defaite retire le
niveau maximal de l'equipe du joueur multiplie par `[8,16,24,36,48,60,80,100,120]`
selon le nombre de badges, sans depasser le solde ; les switches de badges connus
sont lus et le switch 33 annule la perte. Les bonus Amulette, Encens Veine et Heure
Chanceuse attendent encore les mecanismes d'objets tenus et d'effets de combat.

Recette manuelle : dans Map010, parler au marchand, acheter une Potion, verifier le
solde et le Sac, fermer avec le bouton Quitter ou Echap puis rouvrir la boutique.
Verifier ensuite qu'une victoire contre Crisanto augmente le portefeuille et qu'une
defaite retire le montant de debut de jeu attendu sans effacer l'inventaire.

Le rendu d'inventaire respecte maintenant les deux familles d'icones du jeu source.
Une fiche d'objet, dans la boutique comme dans le Sac, utilise son identifiant
numerique pour charger `Graphics/Icons/itemNNN.png` ; `item000.png` sert de repli si
un ajout propre au fangame ne possede pas de fichier numerique. Les images
`bagPocket1.png` a `bagPocket8.png` ne representent plus arbitrairement les objets :
elles servent d'onglets aux huit poches source (Objets, Medicaments, Poke Balls,
CT/CS, Ingredients, Mega-Gemmes, objets de combat et objets rares). Le catalogue
`items.json` fournit l'identifiant et la poche, et le Sac filtre puis trie les objets
de la poche choisie. Les nombres affiches sur les onglets comptent les types
d'objets, pas leur quantite totale.

## Decoupage de l'orchestrateur overworld

Premier lot structurel valide le 2026-10-01 : `main.ts` ne porte plus directement
le rendu du menu, du Sac, de la sauvegarde, des options et de la boutique. Ces vues,
leurs echappements HTML, le volume persistant, la poche selectionnee et les liaisons
DOM vivent dans `source-menu-view.ts`. Les mutations metier restent explicites dans
l'orchestrateur : sauvegarde, suppression, achat et reprise de sequence.

La presentation de l'ancien prototype coop local est egalement isolee dans
`demo-overworld-view.ts`. Le dessin de ses cartes et avatars, son journal, son etat
de session et son guide ne sont donc plus melanges au parcours Pokemon source.
Le grand gabarit DOM vit maintenant dans `overworld-app-shell.ts`, qui centralise
aussi la resolution stricte des elements requis. Le panneau de diagnostic du monde
source, ses controles et ses libelles sont rendus par `source-overworld-hud.ts` ;
les donnees issues des catalogues y sont echappees avant insertion HTML.

`source-dialogue-view.ts` porte maintenant la boite de dialogue, les choix, les
indications de progression et leurs liaisons DOM. `source-battle-overlay.ts` rend
le resume, les attaques, l'observation reseau et la fuite, tandis que le controleur
de combat conserve seul la resolution des tours et les mutations de partie.

`source-world-navigation.ts` centralise maintenant les decisions pures du cycle de
cartes : conversion des directions RPG Maker, repositionnement sans rechargement,
chargement d'une destination, checkpoint, restauration d'une sauvegarde et repli
sur Bourg Canvas lorsqu'elle est inaccessible. `main.ts` conserve l'installation
des assets dans la scene, la transition visuelle et l'armement des autoruns.

`source-sequence-controller.ts` possede maintenant la session narrative active,
son curseur, le regroupement des continuations de texte, les pauses, les choix, la
barriere finale des mouvements et le cycle erreur/terminaison. Les effets concrets
des commandes restent injectes depuis `main.ts`, ce qui preserve l'acces explicite
au combat, a l'inventaire, aux transferts et a la presentation sans coupler le
controleur au DOM.

`source-sequence-effects.ts` route enfin les commandes selon six familles : etat,
combat de Dresseur, boutique, transfert, mouvement et presentation. Il applique les
effets a travers des dependances injectees ; le registre des commandes reste la
source de verite pour reconnaitre les mutations persistantes.

`main.ts` passe ainsi de 1 520 a 1 084 lignes. Le jalon de decoupage est considere
stabilise ici a la demande du porteur du projet. Ne pas poursuivre la fragmentation
par principe : reprendre les fonctionnalites de la roadmap, et n'extraire un autre
module que lorsqu'une nouvelle responsabilite le justifie concretement.

## Profil joueur en laboratoire

Le chantier de personnalisation commence sans raccord au jeu source. L'extracteur
genere `player-avatars.json` et `player-avatar-report.json` a partir des declarations
`PlayerA` a `PlayerF` de `PBS/metadata.txt`. Le catalogue relie les six profils aux
actions overworld, portraits et vues de combat ; le rapport distingue asset natif,
repli et absence, puis compare les suffixes de variantes entre profils.

Le paquet `player-state` expose un `PlayerProfile` schema 1 et une selection
`PlayerAvatarSelection`, mais ces objets ne font partie ni de `SourceEventState`,
ni de `SourceWorldSave`, ni du protocole reseau. Leur raccord au jeu est explicite
et uniquement cosmetique : un brouillon ne modifie jamais le joueur sans action.
La creation de nouvelles tenues, coiffures ou silhouettes est reportee ; le prochain
lot attendu est l'ecran autonome sur les six profils extraits.

Ce lot existe maintenant dans `apps/avatar-lab` et se lance avec
`corepack pnpm lab:avatar` sur `http://127.0.0.1:4174`. Son stockage se limite a
`pokemon-z-battle.avatar-lab-profile.v1`; le bouton de reinitialisation ne touche
aucune cle de l'aventure. `Appliquer au joueur` copie volontairement ce brouillon
dans `pokemon-z-battle.active-player-profile.v1`. Les apercus utilisent directement
les chemins audites.
La palette est editee, exportee et rendue dans tous les apercus. Le module partage
`local-assets/avatar-palette.ts` compare les trois ethnies d'une meme silhouette :
les pixels variables sont proteges comme peau, cheveux ou contour antialiase, puis
les couleurs de tenue bleu, or et rouge sont remappees vers les roles principal,
secondaire et accent en conservant leurs ombres. Cette generation de masque a
l'execution couvre overworld, course, velo, surf, peche, face et dos de combat sans
copier d'asset source dans Git. Si les variantes ne sont pas comparables, le rendu
reste volontairement inchange plutot que d'appliquer un filtre global dangereux.
La luminosite est remappee par rapport a la couleur source de chaque role, et non
par simple decalage vers la cible. Ce point est important pour le blanc et les
teintes tres claires : les pixels de contour et d'ombrage restent nettement plus
sombres que les hautes lumieres.

L'Overworld Sandbox expose aussi ce laboratoire via l'onglet `Personnage`.
`AvatarLabView` partage la meme cle locale avec l'application autonome, masque la
scene de jeu sans modifier son etat, et ignore les commandes de mouvement tant que
l'onglet est ouvert. `clearSourceWorldSave` et la reinitialisation narrative ne
touchent aucune des deux cles cosmetiques ; un test protege explicitement cette
separation. `source-player-profile.ts` charge le profil actif au lancement, remplace
le charset overworld, traduit les poses historiques equivalentes et fournit le dos
recolore a `SourceBattleVisuals`. Le nom actif est transmis a chaque session de
dialogue : `\\PN` est interpole apres la traduction francaise dans les repliques et
les choix. Les pronoms restent persistes sans interpolation, et leur consommation
ainsi que l'introduction Map001 attendent toujours le portage correspondant. Le
profil est publie dans les rooms multijoueur v7 sous sa forme publique
`NetworkPlayerProfile` ; la sauvegarde narrative et l'equipe en restent exclues.

Ne pas interpreter `battleBackVariants` comme des frames. Les fichiers suffixes
sont des variantes narratives/de tenue et les planches `trback` historiques sont
moins larges que hautes, donc statiques selon `PlayerFadeAnimation`. Les vues du
laboratoire affichent le dos principal sans alternance. L'introduction de combat
respecte maintenant cette lecture : image statique ancree en `(128,384)` puis
glissant a gauche, trajectoire source de `ball00` decalee de 64 px vers le bas,
puis croissance du battler depuis 1/8 de sa taille.
Il n'existe pas d'animation de bras propre a ces profils dans le jeu source.

Les combats de Dresseurs affichent avant cela l'adversaire de face, ancre en
`(384,168)`, en resolvant `trainerNNN.png` depuis l'identifiant de classe extrait.
Il sort a droite pendant l'apparition de son Pokemon. Les temporisations web sont
volontairement plus lentes que les 40 images/seconde brutes afin que cette
presentation automatique reste lisible sans attendre une validation de dialogue.
Attention : `ball00.png` mesure 32 x 64 et `IconSprite` l'affiche integralement.
Ne pas le traiter comme deux frames carrees ; le conteneur web garde un ratio 1:2.

La sortie du Pokemon joueur est maintenant synchronisee avec la fin de cette
trajectoire : le lancer dure 650 ms, la Ball disparait au dernier point puis le
Pokemon apparait sans pause. Le rendu reproduit aussi `PokeballPlayerSendOutAnimation`
avec le son `Audio/SE/recall`, le cri, la croissance depuis 1/8 et le flash blanc
du decor. Les battlers passent par les echelles du plugin `BitmapWrapperEX` avant
l'auto-alignement : `BACKSPRITE_SCALE = 3` cote joueur et
`FRONTSPRITE_SCALE = 2` cote adverse. Le dernier pixel opaque est recalcule apres
agrandissement, ce qui conserve les lignes de sol `(128,320)` et `(384,168)`.

Le contrat public est `NetworkPlayerProfile`, dans `multiplayer-protocol`.
Il associe un `visualPreset` sans chemin de fichier au `PlayerProfile` semantique,
avec validation stricte des champs. Il exclut volontairement equipe, inventaire et
progression. Le protocole v7 transmet le profil lors de la creation/jonction,
l'intention `setProfile` permet de publier une application ulterieure, et la room
le valide, le persiste et le diffuse dans chaque snapshot. `DemoOverworldView`
affiche les noms et charsets recolores des deux places sur Prairie/Bosquet. Ce
raccord ne synchronise pas encore le monde source ni la sauvegarde de l'hote.
Le parcours de connexion se trouve maintenant dans l'onglet `Coop` du menu en jeu,
et non dans l'ancien panneau lateral. Il permet de creer, rejoindre, voir le code
et les participants, ouvrir la personnalisation puis quitter. Le menu reste
ouvrable sur Prairie/Bosquet. La personnalisation possede un retour direct vers
l'onglet Coop de la carte precedente ; une deconnexion revient au monde source
personnel.

Une commande implementee doit passer de `accepted` a `rendered` ou `executed`. Elle
disparait alors automatiquement de la liste `rendu en attente`.

## Strategie de tests

Ne pas creer un gros test propre a chaque cinematique. Privilegier :

- tests tabulaires du registre pour les familles et niveaux de support ;
- tests purs du compilateur et de l'interpreteur de routes ;
- une trace courte d'ordonnancement pour concurrence et barrieres ;
- quelques recettes fonctionnelles representatives, dont `EV017` ;
- audit automatique pour detecter une commande, une cible ou un asset oublie.

Au moment de cette note, la suite complete contient 305 tests et passe avec le build.

## Commandes utiles

```powershell
corepack pnpm sandbox:overworld
corepack pnpm lab:avatar
corepack pnpm test
corepack pnpm build
corepack pnpm --filter @pokemon-z-battle/overworld-sandbox typecheck
```

Le Worker multijoueur local se lance separement si necessaire :

```powershell
corepack pnpm multiplayer:dev
```

Un `GET /` retourne normalement 404 sur ce Worker : seules ses routes d'API et WebSocket
sont attendues.

## Points de vigilance

- Les fichiers source utilisent parfois des textes espagnols ; les traductions
  doivent venir du catalogue de localisation extrait.
- Les assets particuliers a Pokemon Z peuvent avoir des dimensions differentes des
  sprites standards. Ne pas imposer une taille globale sans verifier le charset.
- Les donnees `.pokemon-z` existent localement mais pas dans la CI GitHub. Les tests
  versionnes doivent employer de petits fixtures structurels.
- `main.ts` contient encore 1 084 lignes, mais ses vues, sa navigation et son cycle
  narratif sont separes. Le decoupage est volontairement arrete a ce jalon ; eviter
  une refonte monolithique ou des extractions sans besoin fonctionnel.
- Apres une modification de progression, une ancienne sauvegarde locale peut masquer
  le nouveau declenchement. Rejouer la recette avec un etat vierge.
