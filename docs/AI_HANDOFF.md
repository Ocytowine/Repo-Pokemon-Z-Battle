# Reprise du developpement par une IA

Derniere mise a jour : 2026-10-07.

Ce document est la reference courte pour reprendre Pokemon Z-Battle sans refaire
l'analyse historique du depot. Il doit etre lu avec la section 9.7 de
`docs/ROADMAP.md`. Les nouveaux constats et fonctionnalites planifiees sont classes
par priorite, dependances et contrat solo/Coop dans `docs/PRODUCT_BACKLOG.md` ; ne
consulter ce backlog qu'apres avoir compris l'etat reel decrit ici.

## Intention du projet

Pokemon Z-Battle est un moteur web TypeScript qui interprete les donnees locales de
Pokemon Z v2.12 FR sans executer son Ruby et sans versionner ses assets. Les donnees
extraites vivent dans `.pokemon-z/`, qui reste local et ignore par Git.

Une correction doit autant que possible profiter a toutes les cartes. Ne pas coder
une regle metier a partir de `Map002`, `EV017`, du switch 67 ou de Keunotor si la
structure de la commande source permet une detection generique.

## Etat Git au moment de cette note

Le dernier commit connu est `9abd598 AJOUT : Co-op local en cours`. Le worktree
contient le premier lot de synchronisation narrative visuelle decrit plus bas.

Le porteur du projet prefere effectuer lui-meme les commits apres validation
manuelle. Ne pas supprimer ou restaurer ce lot pendant une reprise.

## Ordre de travail convenu

### 0. Nouvelle partie et prologue condense — fonctionnel dans le code

Jalon du 2026-10-05 : le lancement distingue maintenant une aventure existante
(`source-event-state` ou sauvegarde de position) d'une
installation sans sauvegarde. Sans aventure, une introduction legere restitue les
trois points utiles de Map001/Map170/Map171/Map065 : admission par la Professeure
Olivier, objet de ses recherches en alchimie Pokemon et voyage depuis Paldea avec
deux autres apprentis. Le bouton `Abreger le prologue` rejoint immediatement les
decisions sans supprimer leurs effets.

L'ecran conserve les trois choix structurants observes dans les sources : difficulte
classique/difficile/heroique, aventure normale/Nuzlocke et region des starters.
Il ouvre le laboratoire de personnage existant pour le nom, le modele, la palette
et les pronoms. Le profil actif alimente aussi les variables source 51 (silhouette)
et 88 (palette), afin que les branches genre/apparence des scenes restent coherentes.
Le choix Nuzlocke est persiste et clairement presente comme une preparation : les
regles Nuzlocke non encore portees ne sont pas simulees.

La validation cree ensuite la premiere sauvegarde en Map002 `(37,71)`, arme son
autorun original et laisse le moteur generique jouer le conducteur, la recherche
de Christian, les socles de starters, Keunotor et la revelation de Christian. Un
rechargement avant la fin du dialogue du conducteur rearme cet autorun tant que le
switch source 61 n'a pas ete applique. Une sauvegarde existante ne voit jamais le
prologue se relancer.

Autorite et Coop : la preparation est personnelle et precede toute room. Une fois
une room creee, les switches/variables du choix de l'hote rejoignent l'etat narratif
autoritaire deja replique ; le profil cosmetique suit le contrat public existant.
Il n'existe donc aucune seconde implementation de ce flux cote serveur ni aucune
publication des donnees privees du profil. Persistance : choix, etat narratif,
profil et position initiale sont restaures localement apres rechargement.

Recette manuelle : supprimer les cles d'aventure, recharger, parcourir puis abreger
le resume, choisir une configuration, appliquer un personnage et commencer. Verifier
la scene du conducteur, le choix d'un starter de la region retenue, le combat contre
Keunotor puis la scene de Christian. Recharger pendant le premier dialogue pour
controler sa reprise, puis recharger apres le switch 61 pour verifier l'absence de
double lancement.

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

### 2 bis. Modes de deplacement du joueur — premier lot fonctionnel

Jalon du 2026-10-02 : le solo et la Coop utilisent maintenant le meme resolveur
pur `resolveSourceMovement`. Il couvre marche, sprint, Chevroum, saut de corniche,
entree et sortie de Surf, glissade sur glace, Cascade et les transitions de
plongee. Le serveur de room reapplique ce resolveur aux intentions de l'hote et de
l'invite ; mode et action sont inclus dans les snapshots afin de conserver le bon
sprite, la vitesse et l'animation apres une confirmation ou une reconnexion. Les
escalades Chevroum existantes restent pilotees par les routes source, mais
`pbMountBike` et `pbDismountBike` changent desormais le contexte visuel du joueur.

Les conditions de progression portees depuis le jeu source sont : chaussures de
course pour le sprint ; un objet `BICYCLE*` pour la monture ; `BICYCLE` pour les
parois Chevroum ; cinq badges et `SURFMONTURA` pour Surf ; sept badges et une
capacite `DIVE` dans l'equipe pour Plongee ; huit badges et `WATERFALL` pour
Cascade. `$PokemonGlobal.runningShoes` et les tests Ruby de quantite du Sac sont
convertis en commandes declaratives et audites. Les metadonnees `Outdoor`,
`Bicycle`, `BicycleAlways` et `DiveMap` sont extraites generiquement des 507 cartes.

Le menu en jeu possede un onglet `Deplacements`. Son interrupteur
`Deplacements de test` debloque localement toutes les capacites des le debut, sans
ajouter de badge, objet, CS ou interrupteur a la progression. Il est persiste dans
une cle locale distincte et vaut independamment pour chaque joueur Coop. Le mode
courant est enregistre avec la position ; les anciennes sauvegardes migrent vers
`walk`. Le serveur valide la topologie et le terrain, mais les prerequis personnels
restent pour ce premier lot controles par le client, car inventaire et equipe ne
sont volontairement pas publies dans la room.

Recette manuelle : ouvrir `Menu > Deplacements`, activer le mode test, verifier le
sprint avec Maj et Chevroum ; tester une corniche, une plaque de glace et une rive.
Sur une eau profonde associee a `DiveMap`, utiliser Plonger puis Remonter. Refaire
les pas avec deux navigateurs et verifier le sprite et la trajectoire distante.

Correction apres la premiere validation manuelle : `enteringWater` ne s'applique
qu'au passage terre vers eau. Un joueur deja en Surf utilise maintenant l'action
`step`, sans arc de saut repete. Le sprite `*_surf_offset` reprend l'ancrage vertical
de 16 px, ses quatre images tournent toutes les 15 frames source et les deux
dernieres ajoutent le flottement de 2 px, y compris a l'arret et pour le joueur
distant. La sortie conserve le sprite Surf jusqu'a la fin du saut. Le sprite de
Plongee natif `*_dive_offset` est egalement selectionne.

Correction de transition du 2026-10-02 : l'interaction d'embarquement transmet
maintenant une intention `surf` sans modifier le mode courant avant le passage
dans le resolveur. L'action `surf-transition`, et donc son arc visible, est ainsi
produite en solo comme par la room. Le debarquement valide l'entree sur la rive
sans exiger un bit de sortie sur la tuile d'eau ; ce masque source bloquait la
sortie de Surf sur des rives pourtant franchissables.

Chevroum parcourt une case en 115 ms au lieu de 92 ms et anime ses quatre images
pendant un deplacement continu. Les corniches suivent exactement les deux controles
utiles du Ruby : le passage dans la direction regardee jusqu'a la tuile `Ledge`,
puis une case d'atterrissage non totalement bloquee. L'ancien controle d'un passage
sortant de la corniche etait trop strict et supprimait certains sauts lateraux ou
verticaux. Ces regles restent dans le resolveur commun solo/room.

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

Correction des rencontres aleatoires du 2026-10-02 : la suppression de l'ancien
bouton HUD de reprise avait revele qu'une rencontre personnelle encore presente
dans `pendingEncounter` bloquait tous les tirages suivants. Chaque pas reprend
maintenant automatiquement cette rencontre avant de lancer un nouveau tirage. Si
la creation d'un combat aleatoire echoue, son attente est purgee et le compteur
est rearme ; une rencontre scriptée invalide reste au contraire en attente afin
de ne pas avancer silencieusement une sequence narrative. Cet etat demeure
personnel et persistant : il fonctionne en solo, pour l'hote et pendant une
excursion personnelle de l'invite, sans etre replique dans le monde narratif de
l'hote. Dans le monde partage, l'invite ne tire toujours pas de rencontre locale,
conformement a la politique Coop existante.

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
affiche. Le porteur souhaite revoir plus tard les interfaces lourdes du Pokedex
et de la carte. Le premier ecran du ranch est decrit ci-dessous.

### Ranch Pokemon et presentation partagee

Premier lot implemente le 2026-10-02 : les 60 appels source `pbPokeCenterPC`
reconnus dans les evenements sont portes generiquement vers `open-ranch`, declare
dans le registre et audite comme transition rendue. La sequence est mise en pause
pendant l'ecran puis reprend a sa fermeture. Il n'existe aucun traitement lie a un
numero de carte ou d'evenement.

Le stockage `SourceEventState.ranch` est personnel, persistant et distinct de
l'equipe de six. Il n'est jamais publie dans le snapshot narratif de l'hote. Les
anciennes sauvegardes migrent vers un stockage vide ; un Pokemon obtenu quand
l'equipe est pleine rejoint automatiquement ce stockage. L'hote et l'invite
ouvrent chacun leur propre Ranch et seul le joueur concerne voit l'interface.

`source-pokemon-collection.ts` produit le modele commun equipe/Ranch : identite,
numero, types, niveau, emplacement, sprite, puissance actuelle et potentiel.
`source-pokemon-card-view.ts` rend la meme carte dans l'onglet Equipe et le Ranch ;
ce contrat doit aussi servir aux futures selections en combat et a la fiche de
statistiques. La puissance actuelle est la somme des six statistiques calculees
au niveau courant. Le potentiel est le total des six statistiques de base de
l'espece ; ce ne sont donc ni des IV ni une prediction arbitraire du niveau 100.

Le Ranch cumule recherche par nom/numero, deux filtres de type, bornes de numero,
minimum de puissance actuelle et minimum de potentiel. Le tri peut utiliser le
numero, le nom, le niveau ou l'une des deux puissances. Les icones classiques sont
lues dans `Graphics/Icons/iconNNN.png` et leur premiere pose est recadree sans
copie dans Git. Les 18 icones de types et leur repli `unknown` sont en revanche
des assets versionnes communs dans `packages/game-assets`. Elles ont ete copiees
du projet local KantoTeam a la demande du porteur, puis renommees avec des
identifiants stables. `pokemonTypeIconUrl` est le registre unique utilise par les
cartes partagees de l'equipe et du Ranch, les boutons de capacites du combat integre
et les badges du sandbox de combat. Les futures fiches doivent reutiliser ce meme
registre.

Deuxieme lot Ranch implemente le 2026-10-02 : un Pokemon selectionne peut etre
depose au Ranch ou retire vers la fin de l'equipe. Les fonctions pures
`transferPokemonToStorage` et `transferPokemonToParty` portent la mutation commune,
recalculent l'index actif sans changer l'identite ni les ressources du Pokemon,
conservent au moins un membre et limitent l'equipe a six. L'operation est persistee
dans le meme etat personnel pour le solo, l'hote et l'invite ; elle n'est pas
publiee dans la room et seul le joueur concerne voit sa collection.

Troisieme lot de presentation implemente le 2026-10-02 : la carte partagee ne
montre plus les scores de puissance actuelle et potentielle, qui restent cependant
disponibles pour les filtres et tris du Ranch. Elle montre maintenant les PV et
quatre emplacements de capacites, avec le nom localise et l'icone de type de chaque
attaque. Le modele de collection resout ces capacites une seule fois depuis le
catalogue et reste commun a l'equipe, au Ranch et aux futures selections de combat.

Un clic ouvre `source-pokemon-actions.ts`, menu radial dont le contrat varie entre
equipe, Ranch et combat. `Placer en tete`, `Deposer` et `Retirer` sont raccordes au
noyau personnel persistant ; le placement en tete reordonne reellement l'equipe et
selectionne son premier membre. `Details`, gestion d'objet, marquage, liberation et
changement en combat sont deja classes mais restent visiblement indisponibles tant
que leur mecanique ou leur ecran n'existe pas. Les choix observes dans les scripts
source sont Donnees/Deplacer/Objet pour l'equipe et
Deplacer/Donnees/Deposer-Retirer/Objet/Marquer/Relacher pour le PC.

Autorite Coop : ces mutations appartiennent au joueur concerne, sont conservees
dans son `SourceEventState` et ne produisent aucune intention ni replication dans
la room narrative. Le meme noyau est utilise en solo, par l'hote et par l'invite ;
le menu n'est presente qu'au proprietaire de la collection. Le contrat `battle`
est prepare mais son raccord attend la future selection d'equipe en combat.

Dette explicite : la capture en combat et la fiche detaillee (IV/EV, nature,
talent, capacites et historique) restent a porter. L'ecran n'injecte toujours
aucune donnee de demonstration dans la sauvegarde.

Le plan complet de la fiche, l'inventaire controle dans Pokemon Z V2.12 FR et
l'ordre des briques sont consignes dans `docs/POKEMON_DETAILS_PLAN.md`. Toute
sous-etape doit commencer par le controle source decrit dans ce document. La
premiere brique porte le modele persistant versionne et la migration des anciennes
sauvegardes, sans changer les statistiques visibles avant le calculateur commun.

Premier increment de cette brique implemente le 2026-10-03 : chaque
`PersistentPokemon` possede maintenant un bloc `metadata` versionne. Les anciennes
sauvegardes le reconstruisent deterministement (identifiant personnel, IV, EV
nuls et nature) sans reroll au rechargement ; les informations impossibles a
retrouver restent `null` ou `unknown`. Les bornes 31 par IV, 252 par EV et 510 au
total ainsi que l'ordre des 25 natures ont ete verifies directement dans les
scripts extraits de Z. Cette donnee personnelle reste preservee par les operations
Equipe/Ranch et n'est pas ajoutee aux snapshots de room. Les calculs historiques
de statistiques ne la consomment pas encore, afin de ne pas modifier le combat
avant le calculateur partage. Le menu Ranch ne propose plus `Placer en tete`,
action reservee au contexte Equipe.

Etape d'identite et de fabrique implementee le 2026-10-03 :
`PlayerAvatarSelection` passe au schema 2 et possede une identite Dresseur privee
32 bits, persistee des le premier chargement meme si l'aventure est ensuite
effacee. Les selections schema 1 sont migrees et reecrites une fois ; les profils
de deux onglets conservent leurs identites propres. `NetworkPlayerProfile` reste
strictement cosmetique et ne transmet pas cet identifiant prive.

`createPersistentPokemon` accepte desormais un contexte commun proprietaire/origine.
Les ajouts de Pokemon issus des sequences normales, des dialogues termines et des
evenements paralleles lui transmettent le profil actif, la carte, la date et la
Poke Ball standard. Le catalogue runtime expose maintenant `genderRate` et
`happiness`. Genre, bonheur initial, DO, ID public et shiny sont ainsi determines
une fois a la creation selon les regles controlees dans Z ; la formule shiny de
cette version utilise bien le seuil 100. La projection
`publicPokemonIdentity` omet trainerId, IV, EV et historique. Elle est preparee
pour les echanges/combats Coop mais n'est pas encore publiee dans la room.

Calculateur de statistiques implemente le 2026-10-03 :
`calculatePokemonStats` est le noyau pur unique IV/EV/nature et suit exactement
l'ordre et les troncatures de `PokeBattle_Pokemon#calcStats`. Il couvre egalement
le cas special d'un PV de base egal a 1. Creation et montee de niveau utilisent ce
noyau ; `playerPartyToBattleTeam` continue de consommer les statistiques
persistantes, donc aucune seconde formule n'existe dans le pont de combat.

A l'activation d'une carte source, `recalculatePlayerPokemonCollection` migre les
statistiques historiques de l'equipe et du Ranch avec le catalogue complet puis
persiste le resultat. Le deficit de PV est conserve, un K.O. reste un K.O. et la
migration ne peut pas mettre K.O. un Pokemon auparavant vivant. Cette operation
est personnelle et identique pour le solo, l'hote et l'invite ; elle n'ajoute rien
au snapshot narratif. Les filtres de puissance du Ranch refleteront donc les
statistiques exactes apres le premier chargement suivant cette version.

Catalogues et assets de fiche implementes le 2026-10-03 : le chargeur overworld
construit maintenant un `PlayerDetailsCatalog` avec les champs d'espece manquants,
les talents, les cibles et les descriptions. Les libelles disponibles passent par
les categories francaises extraites. L'entree Pokedex de `pokemon.json` reste en
anglais et ne doit pas etre presentee dans la future fiche avant raccord d'une
traduction fiable.

`local-assets` fournit un resolveur generique et teste pour battlers face/dos,
icones, overworld, empreintes et cris, avec formes, variantes, shiny et genre. La
forme persistante `0` equivaut a la forme de base `null` du manifeste. Cartes de
collection, suiveurs, combats et cris reutilisent ce resolveur. Les assets fixes
de resume (categorie, rubans, shiny, statuts, Pokerus et 24 Balls) sont indexes
depuis `asset-manifest.json` mais ne sont pas copies dans Git et ne sont pas encore
rendus : cela appartient a l'ecran de lecture de l'etape suivante.

Le raccord Coop est fait dans le meme lot. Les battlers autoritaires portent leur
apparence publique ; un suiveur invite publie uniquement espece, forme, shiny et
genre. Le protocole refuse les champs prives et la room conserve cette apparence
pendant les replacements et reconnexions. IV, EV, identite Dresseur, objet,
historique et contenu du Ranch restent personnels.

Fiche en lecture implementee le 2026-10-03 : `source-pokemon-summary.ts` fournit
le modele et la vue communs Equipe/Ranch/combat. Le bouton `Details` des cartes et
le bouton `Resume` du combat ouvrent les cinq pages de Z. La navigation clic ou
fleches change de page et de Pokemon ; chaque changement joue le cri resolu selon
la forme. Sprite, Ball, statut, shiny, Pokerus et rubans utilisent les assets
locaux indexes, sans copie dans Git.

Identite, historique, stats, talent et sous-page IV/EV/bonheur/Puissance Cachee
sont deja alimentes par la sauvegarde et le catalogue reels. La caracteristique
reproduit le departage par `personalID % 6` de Z et l'appreciation IV reprend ses
seuils 6/16/25. La page Capacites reste volontairement sommaire (type et PP) :
descriptions, categorie, puissance, precision et changement d'ordre constituent
l'etape 6. Les libelles de lieu non persistes restent `Carte NNN`, l'entree
Pokedex anglaise n'est pas affichee, et les boucles oeuf/obscur/rubans non portees
sont signalees plutot que simulees.

Autorite : cette consultation est personnelle et fonctionne avec le meme composant
pour le solo, l'hote et l'invite. Elle ne publie rien. Une projection publique
pure et testee ne contient que l'identite visuelle, le niveau, les types et le DO
public ; elle exclut explicitement historique, IV/EV, bonheur, objet et origine.

Etape 6 de la fiche implementee le 2026-10-03 : la page Capacites utilise les
definitions francaises completes pour afficher icone de type, categorie, puissance,
precision, PP et description. Les sentinelles du script source sont respectees
(`power == 1` devient `???`, zero devient un tiret). `reorderPokemonMoves` permute
deux emplacements dans le modele canonique `player-state`, aussi bien en Equipe
qu'au Ranch, puis persiste le resultat. `playerPartyToBattleTeam` conserve deja
l'ordre du tableau, donc les futurs combats l'utilisent sans seconde logique ;
un combat en cours expose seulement la fiche en lecture seule.

Le contrat solo/Coop reste personnel : l'hote et l'invite utilisent le meme noyau
local, rien n'est publie dans la room et la sauvegarde personnelle restaure l'ordre
apres reconnexion. Le sprite du resume est maintenant reellement anime. Les PNG
de battler de Z regroupent leurs images horizontalement ; le canvas decoupe la
feuille avec les dimensions et `frameCount` extraits, puis avance toutes les
120 ms selon le rythme visuel retenu apres recette. La boucle est annulee
au changement/fermeture et `prefers-reduced-motion` fige la premiere image.

Correctif visuel du 2026-10-03 : `sourcePokemonIconHtml` anime les deux poses
64 x 64 des icones de carte et de la roue d'action sans changer le resolveur de
forme/genre/shiny. La cadence reproduit les paliers de `PokemonIconSprite` selon
les PV (cycle de 250, 500 ou 1 000 ms) et le K.O. reste fixe. Cette presentation
est purement locale et ne change ni la sauvegarde ni le contrat Coop.

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

Le prototype visuel Prairie/Bosquet et `demo-overworld-view.ts` ont ete retires de
l'application le 2026-10-02. Les fixtures generiques homonymes restent uniquement
dans le noyau et la room pour leurs regressions de protocole ; elles ne sont plus
des cartes, des controles ou des destinations accessibles dans l'UI. Le grand
gabarit DOM vit dans `overworld-app-shell.ts`, qui ne presente plus que la scene de
jeu et le diagnostic `Moteur / Evenements`, repliable par un bouton. Le panneau de
diagnostic du monde source et ses libelles sont rendus par
`source-overworld-hud.ts` ; les donnees issues des catalogues y sont echappees
avant insertion HTML.

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
Les manifestes `player-avatars.json` et `player-avatar-report.json` doivent exister
dans `.pokemon-z/data` ; `corepack pnpm prepare:local` les regenere. Leur absence
n'enferme plus l'ecran integre sur « Chargement » : une erreur actionnable permet
de revenir au jeu ou de reessayer apres extraction.
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
progression. Le protocole v8 transmet le profil lors de la creation/jonction,
l'intention `setProfile` permet de publier une application ulterieure, et la room
le valide, le persiste et le diffuse dans chaque snapshot. Le monde source de
l'hote est maintenant partage avec sa topologie compacte, son etat
narratif visible et les deux avatars. Sa sauvegarde personnelle reste exclue.
Le parcours de connexion se trouve maintenant dans l'onglet `Coop` du menu en jeu,
et non dans une commande externe. Il permet de creer, rejoindre, voir le code et
les participants, ouvrir la personnalisation puis quitter. La personnalisation
possede un retour direct vers l'onglet Coop ; une deconnexion revient au monde
source personnel.

Une commande implementee doit passer de `accepted` a `rendered` ou `executed`. Elle
disparait alors automatiquement de la liste `rendu en attente`.

## Observation narrative en Coop

Premier lot implemente le 2026-10-02 : l'hote publie un `SourceSceneSnapshot`
distinct de la progression. Il contient la boite de dialogue courante, les choix
affiches, l'etat actif de la sequence, les poses des PNJ et la derniere commande
audiovisuelle rendue. La room valide, persiste et diffuse cet etat ; seul l'hote
peut le modifier.

L'invite affiche les dialogues et choix en lecture seule, anime les destinations
des routes de PNJ et du personnage distant, et rejoue les commandes de presentation
(tonalite, images, animations, camera, musique et sons). Ses controles de monde
sont bloques pendant une sequence observee. Il ne peut ni avancer un texte, ni
choisir une branche, ni appliquer un switch, une variable, un objet ou une autre
mutation narrative. Les combats source restent hors de ce lot.

Recette manuelle : lancer le Worker et deux Overworld Sandbox, creer la room depuis
une carte source avec le premier navigateur, la rejoindre avec le second, puis
declencher une scene comprenant dialogue et route imposee. Verifier que l'invite
voit les memes textes, effets et mouvements, que ses choix ne sont pas cliquables,
que ses deplacements sont bloques pendant la scene puis rendus a sa fin. Tester
enfin une reconnexion pendant un dialogue.

Correction Coop du 2026-10-02 : les deux places envoient maintenant chaque pas de
carte source par `moveAvatar`. Le serveur valide le pas puis le diffuse aussitot ;
le client local predit immediatement un seul pas puis le rapproche de la reponse
autoritaire sans rejouer le mouvement confirme. Un second pas n'est emis qu'apres
cette confirmation, ce qui evite les boucles de correction et les rollbacks. Le
client distant interpole depuis sa position actuellement affichee, et une mise a
jour sans mouvement ne peut plus annuler son animation en cours. Maintenir une
direction montre donc la marche case par case sans attendre l'arret du joueur.
Une mise a jour provoquee par l'autre place ne reconcilie jamais le pas local en
attente : elle ne peut donc plus ramener provisoirement l'hote en arriere. Les
profils visuels sont caches par signature et ne sont plus vides/recharges sur les
snapshots narratifs, ce qui supprimait auparavant les avatars pendant la marche.
La frame de marche distante est transmise au renderer dans son champ `pattern` de
premier niveau et reste visible pendant toute l'interpolation ; ne pas la ranger
uniquement dans `pose`, car `ImportedRemotePlayerRender` l'ignorerait.

Chaque place publie aussi uniquement l'espece de son Pokemon suiveur actif. La room
choisit sa position initiale, le deplace sur la case liberee apres chaque pas et
persiste cet etat visuel. L'autre navigateur charge le sprite local correspondant
et interpole le suiveur independamment du joueur. L'equipe, ses statistiques et la
sauvegarde restent exclues du protocole. Le suiveur de l'autre place est un obstacle
valide a la fois par le client et par la room ; son propre suiveur ne bloque pas le
joueur qu'il accompagne.

Deuxieme lot Coop du 2026-10-02 : l'invite peut quitter seul la carte narrative de
l'hote par un transfert source. La room conserve desormais une presence explicite
`shared`/`away` : pendant une excursion personnelle, l'avatar et son suiveur ne sont
plus rendus et ne bloquent plus l'hote, tandis que l'invite parcourt ses cartes avec
sa propre sauvegarde. Revenir par un transfert vers la carte actuellement partagee
demande au serveur de valider la position d'arrivee avant de rendre l'avatar visible.

Sur la carte partagee, l'invite peut aussi lancer les evenements dont la structure
contient `heal-party`, ainsi que les transferts. Le choix, les dialogues et les
effets visuels sont joues localement ; checkpoint, PV, statuts et PP modifient
uniquement son `SourceEventState`. Les autres evenements restent sous l'autorite
narrative de l'hote, et aucun autorun ni evenement parallele de l'hote n'est execute
localement par l'invite. Hors de la carte partagee, le parcours redevient entierement
personnel, rencontres comprises.

Correction du 2026-10-02 : lorsqu'un evenement personnel de l'invite ouvre un
dialogue (notamment l'infirmiere), ce dialogue local a priorite visuelle sur la
scene de l'hote observee. Auparavant, une scene reseau vide masquait le texte local
alors que le controleur attendait toujours sa validation, laissant `world-input`
verrouille et donnant l'impression d'un freeze. Une fois le texte ou le choix
termine, la sequence reprend, applique le soin local puis libere les controles.

Correction de modele Coop du 2026-10-02 : la progression narrative n'est plus
instanciee par joueur. Les switches, variables et self-switches de l'hote sont la
reference de l'invite sur toutes les cartes, y compris lorsqu'il se trouve
temporairement sur une carte differente. L'invite ne peut jamais executer un
evenement narratif, un autorun ou une boucle parallele concurrente ; seuls ses
soins, ses transferts et ses rencontres personnelles restent locaux.

Les dialogues et cinematiques de l'hote ne sont plus affiches et ne verrouillent
plus l'invite. Leurs consequences narratives publiees modifient toutefois aussitot
les pages actives, obstacles et acces visibles chez lui. Si l'invite rejoint une
carte avant l'hote, il reste temporairement `away`. Lorsque l'hote arrive ensuite
sur cette meme carte, le client demande automatiquement son rattachement a
l'instance partagee ; la room conserve sa position si elle est libre ou choisit
une case voisine valide. Les deux avatars, suiveurs et collisions sont alors de
nouveau communs.

Un changement de `mapId` publie par l'hote marque maintenant toujours l'invite
`away` au lieu de reconstruire son avatar sur la nouvelle carte. Son client garde
donc sa carte et sa position courantes. Le callback des `SourceSceneSnapshot` est
deliberement debranche cote Overworld : aucun texte, choix, mouvement de PNJ ou
effet de presentation appartenant a l'hote ne doit atteindre l'affichage invite.

Correction d'interaction du 2026-10-02 : sur une carte partagee, un evenement de
carte vise a priorite sur le defi entre joueurs. Un invite place devant l'hote,
notamment sur la case d'un comptoir, ne masque donc plus l'infirmiere ou un autre
PNJ situe dans la portee d'interaction. Le defi 1 contre 1 reste propose lorsqu'il
n'existe aucun evenement interactif dans cette direction.

La personnalisation active possede maintenant une surcharge en `sessionStorage`.
Deux onglets de la meme origine peuvent donc publier et conserver des profils
distincts dans une room ; la copie persistante en `localStorage` reste le profil par
defaut des futurs onglets. Un test couvre explicitement cette isolation.

Recette manuelle : avec deux onglets, appliquer deux profils differents, creer puis
rejoindre une room. Depuis l'invite, utiliser une sortie de carte et verifier sa
disparition chez l'hote, rejoindre un Centre Pokemon, faire soigner une equipe
blessee, puis revenir sur la carte courante de l'hote. Verifier que l'equipe de
l'hote et les deux apparences n'ont pas change.

## Combat direct entre joueurs

Jalon du 2026-10-02 : sur la carte source partagee, un joueur place face a l'autre
peut utiliser l'interaction normale pour lui envoyer un defi. La room verifie la
presence, la connexion, l'adjacence et l'orientation avant de publier la demande.
Le destinataire dispose d'un panneau Accepter/Refuser ; l'emetteur peut annuler.
Les deplacements et les autres interactions sont verrouilles tant que la demande
est ouverte.

L'acceptation transmet une copie validee de chaque equipe et cree un
`TeamBattleState` autoritaire. Chaque navigateur ne soumet ensuite que ses propres
intentions : attaque, changement volontaire ou remplacement apres K.O. Le serveur
resout les tours avec son RNG, diffuse l'etat canonique et conserve le combat fini
jusqu'au retour sur la carte. PV, statuts, PP et Pokemon actif du resultat sont
alors recopies dans la partie locale de chaque joueur ; aucune equipe n'est publiee
dans le profil cosmetique persistant.

Correction de presentation du meme jalon : un duel reseau passe desormais par le
meme pipeline visuel que les combats source locaux. `startBattle` joue l'entree des
deux Dresseurs, le lancer de Ball, les cris et la musique ; chaque `turnResolved`
est serialise vers `playTurn`, qui rejoue les animations de capacite, impacts,
statuts et K.O. avant d'afficher l'etat autoritaire suivant. Les changements jouent
aussi une transition. Pour l'invite, equipes et evenements sont presentes en miroir
afin que son propre Dresseur et son Pokemon restent du cote joueur. Les images
`battleBack` et `battleFront` proviennent des deux profils personnalises charges.
Les boutons sont verrouilles pendant toute animation reseau.

Refonte de commandes du 2026-10-04 : `SourceBattleOverlay` utilise maintenant
quatre entrees stables (`Attaque`, `Pokemon`, `Sac`, `Fuite`) et des sous-ecrans
partages entre combat source et duel Coop. La projection reseau deja retournee du
point de vue de l'invite est toujours lue comme equipe `player`, ce qui evite de
presenter les commandes de l'hote chez l'invite. L'ecran Pokemon liste chaque
membre avec PV, etat actif/K.O., `Details` et `Changer`; les remplacements forces
emploient la meme liste.

Le changement local n'est plus une dette : `resolveSourceEncounterAction` accepte
la meme union `TeamBattleAction` que le moteur commun, choisit l'action adverse,
puis resout attaque ou changement dans un tour unique. Le duel continue d'envoyer
seulement l'intention `switch` a la room autoritaire. La restauration persiste
l'index actif avec les PV/PP comme auparavant.

Le Sac de combat lit les poches 3, 2 et 7 de l'inventaire personnel pour afficher
respectivement Balls, soins et objets de combat. Aucun usage n'est encore actif :
capture, consommation atomique, cible de soin et modificateurs d'objet doivent
etre implementes dans un noyau partage et valides par la room avant activation.
Les Balls sont deja masquees comme action contre un Dresseur ou un joueur. Le HUD
affiche aussi les membres prets, actif et K.O., avec jauges verte/orange/rouge.

Reprise de mise en scene du 2026-10-04 : le cycle suit maintenant l'ordre des
scripts Pokemon Z. L'introduction enchaine flashes gris, noir, ouverture de la
scene, apparition sauvage ou entree du Dresseur, puis envoi du Pokemon joueur. La
fin calcule le reglement avant de masquer la scene : baisse de la BGM, ME de
victoire, message d'EXP, jauge animee sur chaque seuil, annonces de niveau et de
capacite, argent puis fondu noir et audio. `SourceBattleOutcome` ne transporte que
les donnees tranchees par le noyau ; la vue ne modifie ni equipe ni portefeuille.
Les duels reseau sans EXP utilisent le meme pipeline de sortie.

Contrat valide pour le prochain lot : l'invite apporte ses propres Pokemon, mais le
combat reste simple avec un seul actif par camp. Chaque camp contient au maximum
six Pokemon et deux Dresseurs. Une bataille source deja double, ou une bataille dont
les deux camps ont deja deux Dresseurs, n'accepte personne. Cote adverse, l'invite
choisit sa contribution dans la limite des six places. Cote hote, une proposition
de composition finale doit etre acceptee par les deux joueurs du camp. Le Pokemon
actif determine quel proprietaire soumet l'action ; aucun joueur ne pilote le
Pokemon de l'autre.

Ne pas greffer ce comportement sur le duel binaire actuel. Autorite : room. Domaine
: combat partage, ressources/progression personnelles, histoire de l'hote.
Intentions minimales : proposer/rejoindre/refuser, choisir un camp, proposer une
composition, accepter la composition et soumettre l'action de son Pokemon. Snapshot
minimal : participants, camp, proprietaire de chaque membre, actif, actions
attendues et revision. La reconnexion restaure place et proprietes ; l'audience se
limite aux participants et observateurs presents. EXP, PP, PV, objets et evolutions
doivent etre reventiles vers la sauvegarde du proprietaire apres le combat.

Fondation implementee le 2026-10-04 dans `battle-engine` :
`SharedBattleParticipation`, `proposeBattleJoin`, `approveBattleJoin`,
`applyBattleJoin` et `activeBattleController` constituent le noyau pur commun. Ils
valident format simple, maximum de deux Dresseurs et six Pokemon par camp,
proprietes, composition finale et accords. Trois tests couvrent jonction alliee,
jonction adverse et refus des cas interdits. Ce premier noyau etait initialement
sans protocole ni interface ; le deuxieme lot ci-dessous les raccorde.

Deuxieme lot implemente le 2026-10-04 : `PROTOCOL_VERSION` passe a 9 et les
snapshots de combat exposent `participation` et `joinProposal`. Les intentions
`proposeBattleJoin` et `respondBattleJoin` sont strictement validees. La room
accepte une proposition uniquement au tour 1 d'une rencontre simple sans action
en attente, attend l'accord du meneur, reconstruit l'equipe autoritaire et route
chaque action vers le proprietaire de l'actif. Proposition et proprietes survivent
a l'export/restauration ; une deconnexion annule seulement une proposition non
validee. `SourceBattleJoinView` fournit dans le jeu le choix du camp, la selection
cumulee a six et le panneau Accepter/Refuser. Un joueur qui n'a pas l'actif reste
en observation et ses commandes sont bloquees.

Dette explicite : ce flux est raccorde aux rencontres deja creees par la room, mais
les combats du parcours Pokemon Z naissent encore dans `SourceBattleController`
sur le client. Le prochain lot doit publier leur ouverture et leur contexte dans
la room, puis reventiler le resultat vers les sauvegardes personnelles avant que la
participation soit testable sur les combats narratifs courants.

Troisieme fondation commencee le 2026-10-04 : `storeOwnedBattleResults` restaure
PV, statut, PP et membre actif uniquement pour les Pokemon dont le participant est
proprietaire dans `SharedBattleParticipation`. Les membres non retenus dans le camp
restent inchanges et les Pokemon d'un autre joueur ne peuvent pas entrer dans sa
sauvegarde. Ce garde-fou est teste sur un camp hote/invite mixte. Avant de publier
les combats source, la room doit encore journaliser les Pokemon effectivement
engages et les K.O. credités : l'etat final seul ne suffit pas pour attribuer l'EXP
sans erreur lorsque l'actif change de proprietaire. Le noyau pur
`SharedBattleLedger`/`recordSharedBattleTurn` conserve maintenant les identifiants
passes sur le terrain et chaque battler vaincu sans doublon. La room le cree avant
le premier tour, le met a jour apres chaque resolution et le persiste dans les
snapshots/reconnexions. Il reste a convertir ces credits avec les courbes source.

Le plan d'integration complet est consigne dans
[`SHARED_SOURCE_BATTLE_PLAN.md`](SHARED_SOURCE_BATTLE_PLAN.md). Il fixe l'ordre des
lots, l'autorite, le cycle `join-window -> active -> settling -> closed`, les
credits d'EXP par K.O., les reglements personnels idempotents et la reprise
narrative. Cette planification ne declare pas le raccord termine : les combats de
`SourceBattleController` restent locaux jusqu'au lot de publication dans la room.

Premier increment du plan implemente le 2026-10-05 : les invariants de
`SharedBattleParticipation` sont controles dans le noyau pur et une proposition
alteree ne peut plus etre appliquee. Refuser une jonction conserve le journal du
combat. `SharedBattleLedger` suit maintenant les engagements par adversaire, puis
fige a chaque K.O. les participants eligibles encore conscients ; les changements
volontaires et remplacements forces alimentent le meme chemin. La projection
`sharedBattleOwnerSettlement` ne restitue que les membres et credits d'un
proprietaire. Une migration restaure les anciens journaux v9 sans casser une room
hibernee. L'override final `repexp.rb` a ete controle : participants par adversaire
et Pokemon conscients alimentent maintenant `pokemonZParticipantExperience` et
`applySharedBattleExperience`. La conversion reproduit les arrondis, le partage
entre tous les participants du camp, le bonus Dresseur, les coefficients de niveau
propres a Z, les switches 661/252/624, l'Oeuf Chance et le plafond lie aux badges,
puis applique seulement la part du proprietaire vise. Partage Exp et Exp Tous
restent reportes avec les effets d'objets car ils creditent des non-participants.

`SharedBattleSession` porte le cycle pur `join-window -> active -> settling ->
closed`. Le premier tour ferme irreversiblement la fenetre, un resultat tactique
termine est requis avant `settling` et l'identifiant `${battleId}:settlement` reste
stable apres fermeture pour la future idempotence/reconnexion. Ce cycle n'est pas
encore publie dans le protocole v9 ni consomme par la room : le lot 2 devra brancher
les adaptateurs solo et reseau sur ces transitions sans les dupliquer.

Lot 2 implemente dans le code le 2026-10-05 : le protocole passe a v10 et ajoute
`SourceBattleContext` ainsi que l'intention host-only `openSourceBattle`. Le
contexte public contient origine, carte, format, fuite, presentation par
identifiants logiques, adversaires/recompenses bornes, politique d'EXP et type de
continuation. Il exclut chemins locaux, sauvegarde, Ranch, IV/EV et inventaire.
La room exige la carte partagee de l'hote, compare le manifeste a l'equipe adverse,
puis cree dans une seule mutation l'etat tactique, la participation, le journal et
`SharedBattleSession`. Le premier tour ferme `join-window`; un resultat source
reste en `settling` avec son contexte et survit a export/restauration.

`SourceBattleController` construit ce brouillon aussi bien pour le sauvage que le
Dresseur. Si la room l'accepte, aucun combat local concurrent n'est lance et le
snapshot pilote la presentation des deux clients ; sans room, le solo suit le meme
cycle pur, y compris la transition de fuite sauvage. Le code est couvert, mais la
recette Keunotor/herbes/Crisanto dans deux navigateurs reste a effectuer. Le combat
source reseau reste volontairement affiche en `settling` apres sa fin : application
personnelle idempotente, fermeture et reprise narrative sont les lots 5 et 6 ; IA
source avancee et fuite reseau sont au lot 4.

Lot 3 implemente dans le code le 2026-10-05 : le protocole passe a v11. Pendant
`join-window`, l'invite present sur la carte choisit Observer, le camp de l'hote ou
le camp adverse. Le choix d'observer est autoritaire et persiste ; la reconnexion
ne repropose pas une participation. L'interface expose proprietaire, actif et
membres retenus. Le noyau et la room imposent six Pokemon maximum, des identifiants
uniques entre camps, au moins un Pokemon de l'invite et, cote allie, au moins un
Pokemon du meneur. Seul l'hote peut fermer explicitement la fenetre et une
proposition en attente doit etre acceptee ou refusee auparavant. La premiere action
valide la ferme aussi, mais une action envoyee par un observateur ne le peut pas.
Un refus est conserve dans le snapshot et affiche au joueur concerne jusqu'a sa
prochaine decision.

La recette manuelle a deux navigateurs reste ouverte : verifier successivement
Observer, jonction alliee, jonction adverse, refus, composition pleine et
reconnexion pendant la fenetre.

Lot 4 implemente dans le code le 2026-10-05 : le protocole passe a v12. La room
route attaque, changement volontaire et remplacement force vers le proprietaire
concerne. Une deconnexion supprime son intention en attente et suspend le combat au
meme tour ; la reconnexion ne declenche aucun pilote automatique. Les Pokemon
source sans proprietaire choisissent leur capacite et leur remplacement avec la
RNG autoritaire. Ces decisions et la formule de fuite ont ete extraites dans
`battle-engine` et sont aussi consommees par l'adaptateur solo. Seul le
proprietaire narratif peut demander la fuite globale ; son resultat et le nombre
de tentatives sont persistables. La regle preparatoire des Balls ne rend capturable
qu'un adversaire sauvage sans proprietaire, jamais le Pokemon d'un invite. Le duel
direct reste sur deux intentions humaines et n'emprunte pas l'IA source.

Tests ajoutes : selection IA non figee sur l'index zero, controle des remplacements,
capture selon origine/proprietaire, fuite host-only, persistance de la fuite,
remplacement source automatique et suspension/reprise apres deconnexion. La recette
manuelle a deux navigateurs reste ouverte. Le prochain lot est le reglement
personnel idempotent (lot 5), avant la fermeture et la reprise narrative du lot 6.

Lot 5 implemente dans le code le 2026-10-05 : la room genere un
`SourceBattleSettlement` immuable et autoportant par proprietaire lors d'une fin
ou d'une fuite source. Son audience est strictement personnelle. Il contient
l'etat tactique final, la participation, les credits de K.O., la politique d'EXP,
l'argent autorise et un emplacement borne pour les objets. Le client applique
d'abord `storeOwnedBattleResults`, puis `applySharedBattleExperience` sur les
Pokemon persistants existants ; il ne reconstruit jamais une creature depuis le
reseau. Le proprietaire narratif recoit seul l'argent de Dresseur ou sa politique
de perte/soin apres defaite. Les objets restent vides : les raretes appartiennent
a la continuation narrative de l'hote et les gains `PERSONAL_EACH` attendent un
manifeste source explicite.

`SourceEventState.appliedBattleSettlementIds` garde un journal compact de 128
entrees, migre les anciennes sauvegardes et rend application puis accuse
idempotents. La room persiste tous les reglements non accuses, en joint un au
`welcome` et remet le suivant apres chaque accuse. Un invite absent ne bloque donc
pas la sauvegarde de l'hote et retrouve son resultat a la reconnexion. La fin de
combat sait afficher une liste de gains d'EXP personnels. Tests ajoutes : fusion
des seules ressources possedees, preservation des metadonnees, doublon sans effet,
fuite persistante, deux proprietaires, invite deconnecte et accuse independant.
A l'issue du lot 5, le combat source restait volontairement en `settling` jusqu'au
raccord de continuation et de fermeture decrit ci-dessous.

Lot 6 implemente dans le code le 2026-10-05 : le protocole accepte maintenant
`closeSourceBattle`. Seul le proprietaire narratif peut l'envoyer et la room la
refuse jusqu'a l'accuse de son propre reglement. Une fermeture valide passe le
cycle en `closed`, retire la bataille du snapshot et conserve tous les reglements
d'invites encore absents. La fin visuelle est serialisee apres le dernier tour :
K.O., etat final, gains d'EXP personnels, argent, audio et fondu precedent toujours
la demande de fermeture. Une reconnexion sur un snapshot deja termine execute le
meme chemin de fin.

Lorsque le snapshot ferme arrive, `SourceBattleController` consomme une garde de
continuation unique. Une victoire termine la rencontre en attente, une defaite la
laisse disponible et une fuite la purge avec son compteur de pas ; la fermeture
reprise ou dupliquee ne peut pas relancer la sequence. Un combat de Dresseur rend
le controle a son `SourceSequenceSession`, qui poursuit alors les commandes source
et leur publication narrative habituelle. L'invite ferme seulement sa presentation
et ne peut ni appliquer ni publier cette continuation.

Tests ajoutes : fermeture invite refusee, fermeture hote prematuree refusee,
fermeture apres accuse, conservation du reglement invite, reprise de victoire et
fuite exactement une fois. Limite protegee pour le lot 7 : une reconnexion socket
conserve la session narrative, mais un rechargement complet de page au milieu d'un
combat de Dresseur perd encore son curseur local. Dans ce cas la fermeture
automatique est volontairement bloquee plutot que de sauter l'histoire.

Correctif Dresseurs ordinaires et PvP du 2026-10-05 : les pages Dresseur fixes en
`trigger 2` demarrent aussi lorsque le joueur tente d'entrer sur leur case, tandis
que le contact autonome existant reste inchange. Les hooks generiques
`pbTrainerIntro` et `pbTrainerEnd` sont absorbes sans bloquer, et
`pbTrainerBattle` accepte desormais la
signature longue terminee par l'argument de resultat. Le cas source reel
Map014/EV022 (`CAMPESINO`, Jean, version 0) compile donc dialogue, combat et
self-switch de victoire sans correctif lie au numero de carte ou d'evenement.

`pbNoticePlayer(get_character(0))` est maintenant une vraie commande auditee
`trainer-notice`. Le nom source `Trainer(n)` fournit la portee : un Dresseur fixe
detecte le joueur seulement dans son axe, sa direction et une ligne praticable,
affiche l'animation source 3 (bulle d'exclamation), se tourne puis avance jusqu'a
la case adjacente avant le dialogue. L'approche reutilise le moteur generique de
routes et publie effet et poses d'acteur dans `SourceSceneSnapshot`. L'hote est
seul autoritaire sur le declenchement ; l'invite present recoit la meme mise en
scene sans executer une seconde IA locale. Cette presentation n'est pas
persistante : apres reconnexion, le snapshot de scene et les poses courantes de la
room suffisent tant que la sequence est active.

Correctif de detection Coop des Dresseurs du 2026-10-06 : le noyau generique de
mouvement des PNJ recoit maintenant toutes les positions de joueurs eligibles sur
la carte et choisit deterministement la cible visible la plus proche. Le contact
transporte une copie de cette position dans `SourceSequenceSession`; l'orientation,
la bulle et les commandes `step-toward-player` visent donc le joueur effectivement
detecte, y compris l'invite, au lieu de toujours viser l'avatar local de l'hote.
Les collisions autonomes tiennent egalement compte de tous les participants.

L'autorite reste exclusivement l'hote : l'invite n'execute aucune IA ni narration
locale et n'envoie pas de nouvelle intention de combat. Ses position et presence
canoniques viennent du `SourceWorldSnapshot` de la room. L'etat narratif et le
combat de Dresseur restent ceux de l'hote, tandis que les poses du PNJ sont un etat
partage visible par les joueurs presents et le combat est diffuse aux participants
selon le contrat Coop existant. La rotation initiale et chaque pas de l'approche
sont maintenant republies dans `sourceActorsUpdated`, meme pendant la sequence qui
suspend l'animation ambiante. Les poses canoniques de la room restaurent le rendu
apres une reconnexion ; la cible ponctuelle n'est pas persistante une fois la
sequence terminee. Tests ajoutes : selection de l'invite visible le plus proche et
copie immuable de la cible dans la session.

Correctif de reprise Dresseur du 2026-10-06 : un contact detecte pendant
l'interpolation d'un pas est conserve jusqu'a la fin du mouvement, puis demarre
avant l'evenement de case et la rencontre sauvage. Les positions de depart et
d'arrivee du pas local ou distant participent a la detection ; traverser rapidement
une ligne de vue ne perd donc plus l'alerte. Une alerte reste ensuite verrouillee
tant que tous les participants n'ont pas quitte la ligne de vue, ce qui empeche un
dialogue de Dresseur echoue de se relancer chaque seconde.

La resolution d'equipe accepte aussi une variante localisee non ambigue du nom,
sans relacher la classe ni la version. Cela raccorde generiquement les conjonctions
de langues differentes presentes entre les evenements et le PBS (cas audite :
`Hector et Zaida` / `Hector y Zaida`). En cas d'autre refus de creation, le HUD
conserve maintenant la cause concrete fournie par `SourceBattleController` au lieu
de la remplacer par un message generique. Tests ajoutes : verrouillage jusqu'a la
sortie du champ de vision et resolution localisee bornee par classe/version.

Correctif des talents source du 2026-10-07 : la creation d'un combattant ne
confond plus identite extraite et effet deja implemente. Tout identifiant source
borne (`[A-Z][A-Z0-9_]{0,63}`) est conserve dans `BattlerState` et accepte par la
validation Coop ; seuls les talents explicitement codes dans le moteur produisent
un effet ou un evenement `abilityActivated`. Un talent connu des donnees mais pas
encore simule est donc inerte, sans empecher le combat. Cela debloque notamment le
Sapereau de Jean dont `CHEEKPOUCH` faisait echouer le combat apres son dialogue.

L'autorite du talent reste celle de l'etat de combat : en solo et dans la room, le
meme noyau lit la meme identite ; le serveur replique cette valeur publique avec le
combattant et aucune intention cliente supplementaire n'est necessaire. La valeur
personnelle reste persistee dans le Pokemon, tandis que le Pokemon de Dresseur est
recree depuis le catalogue source a chaque rencontre. Dette volontaire : les
effets des talents ainsi admis mais encore inertes doivent etre portes un par un et
couverts dans le moteur de combat. Tests ajoutes : conversion personnelle avec
talent source inerte, validation reseau bornee et combat de Dresseur Sapereau avec
`CHEEKPOUCH` jusqu'a la resolution d'un tour.

La phrase de defaite `_I("...")` de `pbTrainerBattle` est conservee dans
`request-trainer-battle`, localisee avec le catalogue de la carte puis transmise
comme `presentation.defeatText` dans le contexte public borne. Elle ne contient ni
etat prive ni mutation narrative. En solo comme en combat autoritaire, elle est
affichee une seule fois lorsque le camp du joueur gagne, avant « Victoire ! », les
gains d'EXP et l'argent. Elle n'est pas affichee apres une defaite du joueur. Le
self-switch source reste la seule autorite qui rend ensuite le Dresseur non
recombattable et active son dialogue d'apres-combat.

L'audit local reconnait 516 appels `pbTrainerBattle` sur 522. Le port conserve
aussi `canLose` : une defaite ne coupe la suite de l'evenement que lorsque la
source l'interdit. Le drapeau double est conserve mais provoque un arret explicite
au lieu de lancer a tort un combat simple. Les six appels restants sont les formes
a arguments par defaut du Doppelganger Majara sur Map263 ; ils restent documentes
avec les variantes, sans incidence sur les premiers Dresseurs du parcours.

Ces combats restent `HOST_ONLY` pour leur declenchement et leurs mutations
narratives ; la room diffuse le combat aux participants avec les reglements
personnels deja definis par les lots 2 a 6. Le duel PvP classique reste une
intention de chaque joueur, autoritaire dans la room, transitoire dans son snapshot
et presentee aux deux participants. Sa detection d'interaction lit maintenant les
deux avatars du snapshot autoritaire, dans les deux sens, au lieu de comparer un
avatar distant avec une position locale potentiellement interpolee. Les equipes
et le reglement restent personnels ; aucune mutation narrative n'est produite.

Recette manuelle : connecter deux onglets possedant chacun une equipe, placer les
avatars sur deux cases adjacentes et orienter l'un vers l'autre. Interagir, verifier
l'acceptation et le refus, puis jouer un combat complet depuis les deux onglets,
avec au moins un changement et un remplacement force. Verifier enfin que les deux
equipes conservent leurs PV/PP au retour sur la carte et qu'un joueur sans Pokemon
conscient ne peut ni lancer ni accepter un defi.

Correctif de synchronisation Coop du 2026-10-05 : `SourceWorldSnapshot` reste
desormais sur chaque client une copie exacte de l'etat autoritaire de la room. La
position optimiste du joueur local n'est plus reinjectee dans ce cache pendant
l'attente d'un acquittement ; elle ne sert qu'au rendu local. Cote room, une
publication ordinaire de `setSourceWorld` met a jour carte, collisions, histoire,
mode de deplacement et presentation sans pouvoir ecraser les coordonnees deja
validees de l'hote. Les seuls remplacements de position sur une carte identique
sont marques explicitement par `relocateHost` pour les routes scenarisees, les
transferts et l'orientation necessaire au contact. Un changement de carte reste
autoritaire sans ce marqueur. Le champ est optionnel au decodage afin de ne pas
casser les clients v12 deja ouverts, et vaut `false` par defaut.

La creation de room valide aussi la carte source cote client avant le POST et
refuse les doubles demandes simultanees. Une carte mal formee produit donc une
erreur locale precise au lieu d'une rafale de `POST /api/rooms` en 400. La recette
E2E verifie maintenant que le meme mouvement source arrive aux deux sockets et
qu'une republication narrative obsolete ne provoque aucun rollback. Autorite :
room pour les positions ; domaine et persistance : snapshot partage et restaure ;
intention : direction/mode ou relocalisation scenarisee explicite ; audience :
tous les participants presents sur la carte.

Diagnostic PvP du 2026-10-05 : les retours de demande Coop sont maintenant
visibles directement dans le HUD du canvas, sans devoir rouvrir l'onglet Coop ou
le panneau Moteur. Le demandeur voit successivement l'envoi puis la confirmation
que la room a enregistre le defi ; l'invite voit le nom du demandeur lorsque le
snapshot lui parvient. Tout refus autoritaire (`INTERACTION_UNAVAILABLE`, phase
invalide, joueur absent, orientation ou position refusee), erreur reseau ou ticket
remplace est affiche avec son code et son message. Ce retour est seulement visuel,
non persiste et adresse au joueur concerne ; il ne modifie ni la narration ni le
combat partage.

Correctif du payload PvP du 2026-10-05 : `playerPartyToBattleTeam` projetait une
capacite avec un spread de son entree de catalogue. Le catalogue detaille reel de
Pokemon Z ajoutait donc `targetCode` et `description` au message
`challengePlayer`, contrairement aux fixtures minimales et au schema public
strict ; le Worker repondait `INVALID_MESSAGE`. La projection enumere maintenant
explicitement les seuls champs de `BattleMove` autorises. Les metadonnees d'UI
restent locales et les donnees de combat utiles continuent d'etre partagees avec
les participants. Un test emploie desormais une definition detaillee pour eviter
la regression.

Durcissement `STAB-NET-1` du 2026-10-05 : la room couvre maintenant par test le
refus par le joueur cible, l'annulation par le demandeur et la deconnexion de
chacun des deux participants, en plus de l'acceptation et de la fermeture d'un
duel termine. Toute reponse tardive vise un defi deja supprime et recoit
`INVALID_PHASE`. La vue du defi efface aussi son ancien contenu et se masque des
qu'un combat est actif ; le HUD retire son message d'attente quand le snapshot ne
porte plus de defi, sans effacer une erreur reseau utile. Autorite et persistance
restent celles de la room ; l'UI ne conserve aucun etat parallele. Le porteur a
valide le cycle PvP dans deux navigateurs le 2026-10-05 ; `STAB-NET-1` est termine.

Premier jalon `STAB-NET-2` du 2026-10-05 : la connexion d'un participant possede
desormais un etat autoritaire explicite `connected`, `reconnecting` ou `left` et
une echeance publique. Une coupure WebSocket retire immediatement son avatar et
son suiveur du rendu et des collisions, puis conserve sa place pendant une grace
de 15 secondes. Une alarme du Durable Object confirme ensuite `left` et diffuse
un nouveau snapshot, meme sans autre intention. Le bouton de deconnexion envoie
l'intention stricte `leaveRoom` et saute directement la grace.

Profil, position, mode et suiveur restent dans l'etat de room pour la reconnexion.
Si l'autre joueur a occupe l'ancienne case pendant l'absence, la room choisit une
case cardinale praticable et replace le suiveur sans perdre son apparence. Le HUD
annonce une seule fois la coupure/depart et le retour ; l'onglet Coop distingue
`Connecté`, `Reconnexion…` et `Parti`. Le schema v12 reste compatible par ajout de
champs de snapshot et d'une intention ; les donnees personnelles ne changent pas.
La recette deux navigateurs a ete validee par le porteur le 2026-10-06 ;
`STAB-NET-2` est clos.

Correctif de reprise manuelle du 2026-10-06 : une place invitee marquee `left`
apres un depart explicite ou l'expiration des 15 secondes ne compte plus comme une
place occupee. Une nouvelle jonction par le code de room remplace cette identite,
revoque son ancien ticket et conserve la protection de la grace tant que l'etat
reste `reconnecting`. Une bataille active ou un reglement personnel non accuse
interdit toujours ce remplacement afin de ne perdre aucune ressource du joueur.
Le validateur du monde accepte aussi `mode` et `action` sur un suiveur, conformement
au type public `SourceFollowerSnapshot`; leur presence transitoire ne provoque plus
le message `setSourceWorld mal forme`.

Premier jalon `STAB-WORLD-1` du 2026-10-05 : les obstacles narratifs publies par
l'hote incluent maintenant les zones invisibles de contact `trigger 1/2`. L'hote
continue de declencher une telle zone avant son pas ; l'invite, qui ne peut pas
executer la narration, est arrete par le meme `blockedPoints` dans le resolveur
commun et par la room autoritaire. Une page vide sans declencheur de contact reste
traversable, conformement au comportement RPG Maker.

Cette occupation est recalculee apres chaque mutation persistante, donc un switch,
une variable ou un self-switch qui change de page publie simultanement la nouvelle
histoire et sa geometrie. Le snapshot de room la conserve pour la reconnexion.
Les tests couvrent une zone invisible, les changements par switch/self-switch, le
refus puis l'autorisation d'un pas invite et la restauration de la room. Les positions
des PNJ mobiles en dehors de ces publications restent le perimetre distinct de
`STAB-WORLD-2`.

Premier jalon `STAB-WORLD-2` du 2026-10-05 : les PNJ visibles possedent maintenant
un contrat `SourceWorldActorSnapshot` distinct de la presentation de scene. L'hote
reste l'autorite qui execute les pages et routes RPG Maker ; il publie une projection
compacte (`eventId`, case, direction, vitesse, blocage, `idle/step`). La room refuse
un emetteur invite, verifie carte/bornes/unicite, incremente `actorRevision`,
persiste les acteurs et les utilise dans le resolveur de mouvement, les spawns de
suiveur et les replacements de reconnexion.

L'invite applique les positions logiques au meme `SourceNpcMotionController` et
interpole un pas avec la vitesse source. Un snapshot restaure une pose `idle`
directement, sans rejouer un ancien mouvement. Pour eviter les collisions fantomes,
`blockedPoints` ne transporte plus les PNJ visibles : il conserve seulement les
zones narratives invisibles de contact ; `actors` est l'unique occupation mobile.
Les tests couvrent schema strict, deduplication client, refus invite, collision
avant/apres mouvement, persistence/reconnexion et interpolation. Le porteur a
juge la recette deux navigateurs acceptable le 2026-10-06 ; `STAB-WORLD-2` est
clos.

Audit source cible du 2026-10-05 : `engine-support-report.json` confirme 19/19
interactions de types, mais seulement 23/353 fonctions d'attaque, 13/255 talents,
aucune famille d'objets complete et 0/18 methodes d'evolution. Les rapports de
cartes sont structurellement complets (507 cartes et 2 613 transferts simples sans
cible invalide) ; le prochain goulet n'est donc pas une nouvelle extraction des
maps. `docs/PRODUCT_BACKLOG.md` inventorie desormais les systemes Ruby de Z jusque
la sous-representes : Pokévial, Incubateur, DexNav, peche/Eclate-Roc, Maître des
capacites, Nuzlocke/Monotype, Échange Miracle, drops/craft et Tour de Combat. Les
statuts CADUCO et HEMORRAGIA sont deja portes et ne font pas partie de cette dette.

## Strategie de tests

Ne pas creer un gros test propre a chaque cinematique. Privilegier :

- tests tabulaires du registre pour les familles et niveaux de support ;
- tests purs du compilateur et de l'interpreteur de routes ;
- une trace courte d'ordonnancement pour concurrence et barrieres ;
- quelques recettes fonctionnelles representatives, dont `EV017` ;
- audit automatique pour detecter une commande, une cible ou un asset oublie.

Au moment de cette note, la suite complete contient 436 tests et passe avec le build.
La recette `test:multiplayer:e2e` passe egalement jusqu'au retour de l'invite dans
la carte source. Son profil de fixture respecte la limite publique de 12 caracteres
et l'attente du retour ignore les anciens snapshots `shared` encore en file en
exigeant une revision posterieure a celle de l'excursion.

Correctif d'autorite narrative du 2026-10-06 : sur la carte source partagee,
l'invite ne peut plus lancer une sequence qui contient un combat, une rencontre
ou une mutation de l'histoire, meme si cette page contient aussi un effet
personnel comme un soin ou un transfert. L'hote reste l'unique proprietaire de la
narration et des combats qui en decoulent ; les services personnels restent
locaux au joueur concerne et une excursion `away` conserve son parcours local.
Le meme jalon empeche tout debut de combat avec un actif K.O. : le noyau choisit
un reserve conscient ou refuse une equipe entierement K.O., y compris lors d'une
proposition de composition Coop. `STAB-WORLD-2` a ete accepte manuellement par le
porteur le meme jour.

Isolation d'excursion du 2026-10-06 : un invite `away` qui livre un combat local
ne recoit plus le combat source ouvert en parallele par l'hote. Le snapshot de
room est projete pour ce joueur sans ce combat tant qu'il ne participe pas et
reste hors de la carte partagee ; son combat, ses commandes et ses deplacements
personnels continuent donc sans etre remplaces. Lorsqu'il revient sur le `mapId`
de l'hote, `setSourcePresence` accepte desormais le meme contrat de mouvement
optionnel `mode/action` que les avatars de monde, tout en supprimant les champs
visuels locaux avant envoi. Enfin, l'hote ne publie les PNJ qu'apres confirmation
du `mapId` par la room, ce qui supprime les erreurs transitoires de carte.

Garde de rattachement du 2026-10-06 : atteindre le `mapId` de l'hote ne suffit
plus a rattacher un invite `away` lorsqu'un combat existe deja dans la room. Le
client conserve l'etat brut `roomBattleActive` meme lorsque ce combat lui est
masque, et la room refuse aussi autoritairement tout `setSourcePresence(attached)`
retarde. L'invite poursuit donc son exploration personnelle sans devenir
spectateur ; le snapshot de fermeture du combat declenche ensuite son rattachement
automatique s'il se trouve toujours sur la carte de l'hote.

Garde de scene du 2026-10-06 : comme les positions de PNJ, un
`SourceSceneSnapshot` n'est publie par l'hote que si son `mapId` correspond a la
derniere carte confirmee par la room. Une scene ignoree pendant une transition
n'est pas dedupliquee comme si elle avait ete envoyee ; elle pourra donc etre
publiee apres confirmation. Cela supprime le `INVALID_PHASE` de cinematique qui
pouvait apparaitre apres la fermeture propre d'un combat.

Correction des services invites du 2026-10-06 : une page de Centre Pokemon peut
contenir des switches techniques en plus de `heal-party`. Elle reste desormais
classifiee comme service personnel, mais ses commandes d'etat sont filtrees une
par une sur la carte partagee : seuls le soin et `set-checkpoint` s'appliquent a
l'invite. Les switches, variables, ajouts de Pokemon, rencontres et mutations de
l'histoire ne sont jamais executes par ce chemin. Le meme filtrage protege les
transferts personnels sans reouvrir l'autorite narrative a l'invite.

Cloture manuelle du 2026-10-06 : le porteur confirme que l'ensemble de la recette
passe dans deux navigateurs. Depart et reconnexion, blocages narratifs, autorite
exclusive de l'hote, excursions et combats simultanes, retour sur la carte partagee,
fin propre des combats et soin personnel de l'invite fonctionnent sans erreur HUD
persistante. `STAB-NET-2` et `STAB-WORLD-1` sont donc termines, comme `STAB-NET-1`
et `STAB-WORLD-2`. Le prochain lot de stabilisation est `STAB-BATTLE-1`.

Premier jalon `STAB-BATTLE-1` du 2026-10-06 : `TeamBattleEvent` alimente desormais
un sequenceur visuel pur commun aux combats locaux et aux combats autoritaires de
room. L'autorite reste le moteur de combat ; la file locale ne fait que projeter
les evenements recus. Elle ordonne action, impact, mise a jour visible des PV,
critique/efficacite ou echec, statut, KO puis remplacement. Les remplacements
automatiques locaux conservent leur evenement `pokemonSwitched`, ce qui evite
l'apparition brutale du Pokemon suivant. L'etat est transitoire ; une reconnexion
repart du snapshot autoritaire courant sans rejouer les anciens tours. L'audience
reste chaque participant ou observateur qui recoit le combat.

Les messages de rate, immunite, faible/forte efficacite, critique, statuts, soins,
degats residuels, objets et blocages d'action ont un delai lisible independant de
`prefers-reduced-motion`. Un clic, Entree ou Espace permet de les avancer et la
boite utilise `role=status`. Les PV atteignent zero avant le texte et l'animation
de KO ; un remplacement recharge ensuite le bon battler. La transition d'entree
est un fondu noir sans flash gris. En fin de victoire, textes de Dresseur, EXP,
niveaux, capacites et argent precedent la musique de victoire et la sortie ; la
fuite possede aussi un message explicite. `STAB-BATTLE-1` reste en validation
manuelle solo/PvP/Coop avant cloture.

Ralliement Coop du 2026-10-06 : un joueur non engage reste maintenant dans
l'overworld et le combat source lui est masque jusqu'a une interaction face au
meneur. Contre un sauvage, cette interaction propose uniquement d'aider le meneur
et reste disponible entre deux tours, meme apres le premier tour. L'acceptation
conserve le numero de tour, les PV et le registre de participation ; le premier
Pokemon retenu de l'arrivant devient l'actif du camp au tour suivant. Contre un
Dresseur source, l'invite choisit entre aider l'hote et se rallier au Dresseur
adverse. La room bloque les actions du combat et la presentation avant l'envoi
des Pokemon jusqu'a ce choix et a son acceptation. L'invite non engage peut se
deplacer pour rejoindre l'hote, tandis que les participants et observateurs
restent verrouilles. L'autorite et la persistance appartiennent a la room ; le
panneau de composition est seulement une projection personnelle et transitoire.
La reconnexion restaure le snapshot, le camp, l'actif et le tour autoritaires.

Correction symetrique du meme jalon : `openSourceBattle` n'est host-only que pour
les combats de Dresseurs et les combats issus de la narration. Une rencontre
sauvage aleatoire peut etre publiee par l'invite lorsqu'il est `shared` sur la
carte de l'hote. L'invite devient alors `battleOwnerId` et proprietaire de la
continuation `pending-encounter`; l'hote recoit le combat masque comme rejoignable,
peut se deplacer jusqu'a l'invite et emploie exactement le meme choix `Aider`.
Les projections, noms, validations de proximite, reglements personnels, fuite et
fermeture utilisent l'identite du meneur du combat plutot que le role fixe hote.
Une rencontre sauvage declenchee par l'invite `away` est aussi publiee avec son
`mapId`, sans rattacher ni teleporter l'hote. Elle reste masquee a l'hote pendant
son trajet. Lorsque celui-ci publie cette carte puis rejoint physiquement
l'invite, `setSourcePresence(attached)` est autorise malgre le combat : les deux
avatars partagent alors l'instance et l'interaction `Aider` devient disponible,
sans recreer la bataille ni perdre son tour. Un combat PNJ ou narratif ne peut
toujours pas etre ouvert par l'invite.

Isolation des compositions du meme jalon : le panneau de jonction affiche les
Pokemon deja engages de l'autre joueur comme membres fixes. Le joueur qui rejoint
ne selectionne que ses propres Pokemon, et le noyau refuse autoritairement toute
proposition qui retirerait un membre possede par l'autre participant. Chaque
sauvegarde et chaque reglement restent limites a leur proprietaire.

Moteur double du 2026-10-06 : le ralliement ne remplace plus l'actif du meneur et
ne simule plus un combat simple. Son acceptation passe la participation et l'etat
tactique au format `double`, avec un slot actif par Dresseur. Chaque joueur engage
au maximum trois de ses Pokemon, ne choisit que l'action, la cible, le changement
et le remplacement de son propre actif, et ne peut jamais piloter celui de son
partenaire. Un camp reste limite a deux Dresseurs et six Pokemon. Contre un sauvage
seul, les deux joueurs combattent en 2 contre 1 ; contre un Dresseur, le camp PNJ
emploie un second actif s'il en possede un. Un invite rallie a l'ennemi controle de
la meme facon son propre Pokemon dans ce camp.

Le noyau partage `double-team-battle` resout les quatre intentions dans un ordre
global de priorite et vitesse. Il porte le ciblage source `PBTargets`, les attaques
de zone, leur coefficient de degats, les PP consommes une seule fois, les effets de
fin de tour, les K.O. et les remplacements par slot. Le solo, la room et les combats
source emploient ce meme noyau. Le protocole ajoute seulement les positions et
cibles optionnelles, de sorte que les anciens messages simples restent valides.
La room est l'autorite des actions et de la persistance ; elle attend chaque slot
possede, complete les slots sans proprietaire par l'IA, conserve le tour et les
places actives a la reconnexion, puis adresse les evenements positionnes a tous les
participants. L'interface affiche jusqu'a quatre battlers, demande la cible lorsque
plusieurs adversaires sont eligibles et avance automatiquement vers le second actif
local lorsqu'un meme joueur en controle deux.

Preuves automatiques : resolution de quatre actions, ciblage individuel, attaque
de zone, conversion de jonction, actifs possedes, action et remplacement par
proprietaire, persistance de room et presentation des evenements positionnes. La
recette manuelle reste ouverte : sauvage 2 contre 1 initie par chacun des joueurs,
ralliement allie et adverse contre un Dresseur, source double natif, choix des deux
cibles, K.O./remplacements des quatre slots et reconnexion au milieu d'un tour.
`STAB-BATTLE-1` reste donc `En validation`.

Correctif visuel et de consensus du 2026-10-06 : les positions doubles ne reposent
plus sur des marges CSS. Elles reprennent les origines exactes
`PLAYERBATTLERD1/D2`, `FOEBATTLERD1/D2`, `PLAYERBOXD1/D2` et `FOEBOXD1/D2` de
`PokeBattle_SceneConstants`, dans le repere source 512 x 384. Les HUD simple et
double affichent de nouveau les icones de types et la ligne de statut issue de
`battleStatuses.png`; le format double reste volontairement compact. Lorsqu'une
aide est acceptee pendant un sauvage, le nouveau slot est d'abord masque puis sa
Ball, son effet d'envoi, son cri et son HUD sont joues sur la scene existante. Une
ouverture double en attente joue aussi chaque second envoi separement.

La fuite d'un sauvage rejoint est desormais un consensus de tous les Dresseurs
engages, quelle que soit l'identite du meneur. La room persiste la liste des
confirmations et la replique aux participants ; une reconnexion conserve donc le
vote. Le tirage de fuite et la consommation du tour n'ont lieu qu'une fois tous
les accords recus. Une action differente annule le vote et debloque les clients.
En solo, la confirmation unique conserve le comportement existant. La recette
manuelle doit encore verifier les placements avec plusieurs tailles de sprites,
l'arrivee vue des deux navigateurs et une fuite acceptee puis annulee.

Correctif de sortie de fuite du 2026-10-06 : la fermeture autoritaire de la room
n'est plus bloquee par l'absence d'un curseur de continuation locale. Une fois le
reglement personnel applique, le proprietaire narratif peut fermer le combat et
liberer les deux clients. La branche `battleEscaped` possede maintenant un repli
qui arrete l'etat d'animation et demande quand meme la fermeture si le fondu ou un
asset echoue. Une requete de fermeture non envoyee sur socket ferme ne verrouille
plus les tentatives suivantes, et une erreur/reconnexion libere aussi ce verrou.

Correctif HUD du 2026-10-06 : les badges de statut sans etat etaient tout de meme
affiches, car la declaration `display` du composant prenait le pas sur l'attribut
HTML `hidden`. Cela donnait visuellement `Som` au sauvage neuf et pouvait conserver
une ancienne ligne telle que `Par` sur un allie, sans que le moteur ne leur ait
applique ces statuts. La variante `[hidden]` masque maintenant explicitement le
badge. Le selecteur des deux Pokemon controles est aussi presente sur une seule
ligne compacte au-dessus des commandes au lieu de deux boutons noirs superposes
aux HUD.

Correctif d'identite visuelle du Dresseur du 2026-10-06 : la scene de combat ne
confond plus le camp tactique `player/opponent` avec le cote de room hote/invite.
Le sprite dos est choisi a partir du `ownerId` du Pokemon actif replique dans la
participation autoritaire, avec repli sur le premier Dresseur du camp. Un sauvage
declenche par l'invite montre donc le profil visuel de l'invite sur les deux
clients, y compris si l'hote rejoint ensuite. Le meme calcul oriente conserve le
bon profil dos/face pour un duel ou un joueur rallie au camp oppose. Le profil est
charge a la demande s'il n'est pas encore present dans le cache local ; cette
presentation reste seulement visuelle et ne modifie aucun etat de combat.

Correctif de continuite narrative multi-carte du 2026-10-06 : le mode `away` ne
rend plus l'autorite narrative a l'invite. Une ancienne condition autorisait tous
ses evenements des qu'il quittait la carte courante de l'hote ; il pouvait alors
rejouer sa propre etape d'histoire sur une carte intermediaire. Les pages, acces et
blocages continuent maintenant d'etre selectionnes depuis les switches, variables
et self-switches autoritaires de l'hote sur toutes les cartes. L'invite n'execute
que ses services personnels et ses transferts ; un transfert est suivi directement
sans rejouer le dialogue ou la mise en scene narrative qui l'entoure. Les effets
personnels autorises sont reappliques sur son etat local sans y recopier la
projection narrative de l'hote. La selection d'une cible d'animation utilise elle
aussi l'etat narratif projete. Autorite et persistance restent donc : histoire et
monde chez l'hote/room, equipe et services chez le joueur concerne, rendu des
consequences de l'histoire pour tous les participants, y compris en excursion.
La geometrie locale employee par `resolveSourceMovement` en excursion est elle
aussi reconstruite avec cette projection : `blockedPoints` et pages des acteurs ne
peuvent plus rester sur l'avancement personnel alors que le decor affiche celui de
l'hote.

Correctif de rattachement en combat du 2026-10-06 : un invite `away` qui atteint
la carte ou un combat source est actif peut de nouveau rejoindre l'instance. La
regle existait lors de la reception d'un snapshot, mais les deux chemins de
transfert exigeaient encore a tort `roomBattleActive === false`. Ils utilisent
maintenant tous `sourceBattleAllowsAttachment` et `shouldRejoinSharedSourceMap` :
le contexte doit viser la carte d'arrivee et le combat doit etre actif. Le client
quitte immediatement son mode excursion, demande `setSourcePresence(true)` et rend
donc l'avatar de l'hote ; la room valide ensuite la case de rattachement. Les
combats d'une autre carte, termines ou non source ne desserrent pas cette garde.

Premier increment `SOLO-ITEMS-1` du 2026-10-07 : le paquet `player-state` porte
desormais le noyau pur et commun d'utilisation d'un objet personnel sur un Pokemon.
Le registre explicite reproduit les valeurs de soin de
`116-98118426-pitem-itemeffects.rb` pour les potions, boissons, baies de soin,
antidotes et autres soins de statut, Restauration Totale et Rappels. La difference
source de `SWEETHEART` (150 PV hors combat, 20 en combat) reste contextuelle et
testee. Un effet invalide ne consomme rien ; un effet valide retire exactement une
unite et remplace immuablement uniquement le membre cible de l'equipe fournie. Les
Rappels respectent le switch Nuzlocke 320.

Le Sac permet maintenant de choisir un objet porte, puis un Pokemon de sa propre
equipe. Cet usage hors combat appartient entierement au `PLAYER_STATE` : en solo,
chez l'hote et chez l'invite, l'adaptateur passe seulement l'inventaire et l'equipe
de ce joueur, persiste le resultat localement et n'envoie aucune intention a la
room narrative. Une identite de Pokemon absente de cette equipe est refusee ; il
n'existe donc aucun chemin permettant de soigner ou de consommer depuis le
proprietaire voisin.

Deuxieme increment `SOLO-ITEMS-1` du 2026-10-07 : les memes effets de soin sont
maintenant des actions de tour en combat simple et double. Le choix porte sur un
objet supporte, puis sur un Pokemon du proprietaire, actif ou en reserve. Le noyau
pur des effets vit dans `battle-engine` et est reutilise par `player-state`, le
controleur solo et la room. L'option Heroique issue du switch 666 interdit ces
soins avant toute consommation. Un objet invalide ou sans effet ne passe pas a
l'etape tactique.

Le protocole v13 transmet a l'ouverture ou a la jonction une projection bornee des
seuls soins supportes. La room conserve un compteur par `ownerId`, refuse de cibler
le Pokemon de l'autre Dresseur et limite chaque Dresseur a un objet par tour. Le
reliquat personnel est renvoye seulement a ce joueur et restaure avec la room lors
d'une reconnexion. La sauvegarde locale n'est debitee qu'au reglement personnel :
`consumedItems` est applique dans la meme transaction idempotente que PV, EXP et
argent. Les autres participants voient l'evenement tactique necessaire a la
presentation, jamais le contenu complet du Sac.

Troisieme increment objets/capture du 2026-10-07 : les 28 Balls declarees par
`$BallTypes` sont reconnues par le noyau commun. La formule reprend les PV, le taux
de capture, les multiplicateurs de statut, le seuil sur 65 536 et les quatre
secousses du script source. Les modificateurs calculables depuis le combat sont
portes (Balls fixes, Filet, Esprit, Faiblo, Chrono, Rapide, Speed, Niveau, Masse,
Amour, Lune et Parc) ; les bonus qui dependent encore d'un Pokedex, de l'heure ou
du type de rencontre attendent leurs contrats personnels/monde au lieu de faire
confiance au client.

L'action `capture` fonctionne dans le resolveur simple et double. En solo,
l'adaptateur consomme la Ball puis ajoute le Pokemon au joueur, dans l'equipe si
elle contient moins de six membres, sinon au Ranch. En Coop, le protocole v14 ne
transmet que la Ball et la cible ; la room verifie le combat sauvage, la cible non
possedee et le stock prive, effectue les tirages puis remet `capturedPokemon`
uniquement dans le reglement du Dresseur ayant lance la Ball. Forme, shiny, genre,
PV, statut, capacites, Ball, carte, date et identite du nouveau proprietaire sont
persistes localement. La consommation et l'ajout sont couverts par le meme journal
idempotent que les autres resultats, y compris apres reconnexion. La presentation
textuelle est fonctionnelle ; l'animation source du lancer et le surnom sont
explicitement reportes a la reprise visuelle demandee par le porteur.

Un bouton volontaire `Donner tous les objets de test` est disponible dans l'onglet
Deplacements. Il place 99 exemplaires de chaque objet extrait dans la seule
sauvegarde personnelle du navigateur courant. Il ne modifie ni l'inventaire de
l'autre joueur ni la room et evite toute edition directe des fichiers internes du
navigateur.

`SOLO-ITEMS-1` reste en cours pour les soins de PP, objets de statistiques, objets
tenus, pierres et CT/CS. `SOLO-CAPTURE-1` possede maintenant sa boucle fonctionnelle
solo/Coop ; restent l'animation, le surnom, la capture critique/Pokedex et les
modificateurs contextuels heure/milieu/type de rencontre. Les sous-categories et
tris avances du Sac restent planifies dans `UI-BAG-1` apres le noyau metier.

Decision de validation `STAB-BATTLE-1` du 2026-10-07 : le socle est implemente,
mais le lot ne peut pas etre clos avec le parcours jouable actuel. Les changements
et remplacements multiples dependent d'une acquisition naturelle de plusieurs
Pokemon ; Jean/Sapereau depend des capacites et talents de toute son equipe ; les
combats doubles source et leurs variantes hote/invite dependent des scenes et
regles atteignables. Le statut devient donc `validation partielle suspendue par
dependances`, sans bloquer objets, capture et les lots verticaux de regles de
combat. La recette complete reprendra apres ces dependances.

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

- Toute nouvelle fonctionnalite doit etre pensee dans le meme lot pour le solo et
  la Coop, conformement a `AGENTS.md` et `docs/COOP_ARCHITECTURE.md`. Definir avant
  le code son autorite, son domaine d'etat, sa persistance, son audience et son
  contrat de replication. Le solo utilise un adaptateur local du meme noyau ; ne
  pas maintenir une seconde implementation reseau.
- Pour les futurs modes de deplacement, partager mode, vitesse, collisions,
  animation, transitions et rendu distant. Tester solo, hote, invite et reconnexion
  avant de declarer le lot termine.
- Les scenes Coop doivent distinguer narration partagee, service personnel et
  ambiance partagee a partir des commandes de la sequence. Un soin lance par un
  joueur ne doit jamais diffuser tout son dialogue et son animation aux autres.

- Les fichiers source utilisent parfois des textes espagnols ; les traductions
  doivent venir du catalogue de localisation extrait.
- Les assets particuliers a Pokemon Z peuvent avoir des dimensions differentes des
  sprites standards. Ne pas imposer une taille globale sans verifier le charset.
- Les donnees `.pokemon-z` existent localement mais pas dans la CI GitHub. Les tests
  versionnes doivent employer de petits fixtures structurels.
- `main.ts` contient environ 1 470 lignes apres les raccords de profil et de Coop,
  mais ses vues, sa navigation et son cycle
  narratif sont separes. Le decoupage est volontairement arrete a ce jalon ; eviter
  une refonte monolithique ou des extractions sans besoin fonctionnel.
- Apres une modification de progression, une ancienne sauvegarde locale peut masquer
  le nouveau declenchement. Rejouer la recette avec un etat vierge.
