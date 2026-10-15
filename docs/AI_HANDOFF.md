# Reprise du developpement par une IA

Derniere mise a jour : 2026-10-15.

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

## Contrat UI/UX multi-ecran

L'application vise le telephone comme le PC. Deux familles de surfaces doivent
rester distinctes :

- les scenes issues du jeu (`overworld`, combat, evolution et cinematiques)
  conservent le cadre 4:3 du portage, sont montees dans `#world-stage` et sont
  redimensionnees comme un bloc unique, sans deborder dans la page ;
- les interfaces de gestion (menu, Equipe, Sac, Ranch, resume, Coop et options)
  sont responsives. Elles utilisent l'espace disponible, une colonne en portrait
  et plusieurs panneaux lorsque le paysage ou le bureau le permet. Elles ne
  doivent pas heriter artificiellement des dimensions internes du jeu source.

Les dialogues et effets appartenant a une scene sont ancres dans cette scene.
Les fenetres ajoutees directement a `document.body`, les dimensions dependantes
de `vw` sans rapport avec le conteneur et les petites cibles tactiles sont a
eviter. Une action principale doit rester utilisable au tactile (cible d'environ
44 px), sans survol obligatoire. Chaque nouveau visuel doit etre verifie au moins
en telephone portrait, telephone paysage et bureau avant fermeture du lot.

## Etat Git au moment de cette note

Le dernier commit observe lors de l'audit du 2026-10-09 est `9d816c0 FIX : Import
v2`. Le worktree etait propre avant la mise a jour documentaire de reprise.

Le porteur du projet prefere effectuer lui-meme les commits apres validation
manuelle. Ne pas supprimer ou restaurer ce lot pendant une reprise.

### Ordre de reprise valide le 2026-10-09

L'etat reel a depasse plusieurs resumes historiques de la roadmap : objets
personnels, capture fonctionnelle, classement du Sac et evolution principale sont
deja en place. La suite est organisee en cinq portes :

1. fidelite de combat par lot vertical sur les prochains Dresseurs atteignables ;
2. registre Pokedex personnel persistant ;
3. fermeture evolution/capture, dont Munja, surnom et animation ;
4. validation manuelle des musiques de cartes et de leur restauration apres combat ;
5. matrice manuelle solo, hote, invite, doubles et reconnexion avant cloture.

Le premier lot ne doit pas viser les 353 fonctions de capacite en bloc. Il audite
les equipes du prochain parcours, implemente generiquement les fonctions, talents
et objets tenus effectivement requis, puis ajoute leurs preuves en simple/double
et dans la room. L'autorite des regles et du RNG reste le noyau local en solo et la
room en Coop ; les joueurs n'envoient que leurs intentions. Les ressources,
inventaires et progressions demeurent personnels, tandis que les evenements et le
snapshot tactiques sont presentes aux participants. Une reconnexion restaure
l'etat autoritaire sans rejouer les tours.

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

Le menu en jeu possede un onglet `Test dev`, qui regroupe les commandes de
deplacement dans un sous-menu. Son interrupteur de deblocage des mouvements rend
localement toutes les capacites disponibles des le debut, sans
ajouter de badge, objet, CS ou interrupteur a la progression. Il est persiste dans
une cle locale distincte et vaut independamment pour chaque joueur Coop. Le mode
courant est enregistre avec la position ; les anciennes sauvegardes migrent vers
`walk`. Le serveur valide la topologie et le terrain, mais les prerequis personnels
restent pour ce premier lot controles par le client, car inventaire et equipe ne
sont volontairement pas publies dans la room.

Recette manuelle : ouvrir `Menu > Test dev > Deblocages`, activer les mouvements de test, verifier le
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
- Sauvegarde enregistre manuellement un instantane coherent : carte, position,
  direction, equipe, Sac et etat narratif. Un lancement solo a froid revient a cet
  instantane ; une donnee invalide revient proprement a Bourg Canvas.
- Options memorise le volume choisi et le raccorde aux musiques et effets des
  cinematiques et du combat par un volume maitre commun.
- Le visuel reutilise les assets locaux `partybg.png`, `partyBall.PNG`,
  `bagPocket*.png` et `pause.png`, avec un repli CSS structurel.

Le menu doit etre un mode du gestionnaire de scenes, pas une nouvelle page. Premier
perimetre :

- equipe : membres, niveau, PV et capacites ;
- sac : objets et quantites de `SourceEventState.inventory` ;
- sauvegarde : etat, carte et position courante ;
- options : volume et commandes essentielles ;
- ouverture/fermeture par clavier avec gel de l'overworld.

La sauvegarde manuelle utilise `pokemon-z-battle.source-world-save.v1` avec un
schema interne v2. Elle reste distincte du checkpoint de soin et embarque maintenant
un instantane valide de `SourceEventState`. La cle
`pokemon-z-battle.source-event-state.v1` demeure une copie de travail automatique :
elle protege les mutations et la reprise d'un combat Coop effectivement actif,
mais ne remplace plus le dernier choix explicite de `Sauvegarder ici` lors d'un
rechargement ordinaire. Les anciennes sauvegardes de position v1 restent lisibles ; faute
d'instantane historique, leur etat narratif courant sert de migration jusqu'a la
prochaine sauvegarde manuelle.

Correctif de sauvegarde du 2026-10-09 : auparavant, la victoire contre un Dresseur
mettait immediatement a jour la copie de travail narrative. Quitter sans sauvegarder
puis relancer conservait donc le drapeau de victoire et le combat ne pouvait plus
se declencher, alors que la position provenait de la sauvegarde manuelle precedente.
Le snapshot v2 restaure desormais ensemble position, equipe, inventaire, progression
et drapeaux de combat. Pendant la reprise d'un combat Coop marque explicitement
actif dans `sessionStorage`, la copie de travail reste prioritaire afin de ne pas
annuler un reglement personnel deja accuse a la room. Correctif complementaire :
la seule presence d'un ancien ticket de room ne suffit plus a activer cette
exception. Elle faisait ignorer la sauvegarde manuelle a un joueur revenu en solo.

Correctif de ralliement du 2026-10-09 : pendant la fenetre d'attente d'un combat
de Dresseur, l'invite ouvre maintenant le choix de participation en etant adjacent
a l'hote puis en utilisant l'interaction. L'ancien garde reutilisait la visee
stricte du defi PvP : la direction devait deja etre acquittee par la room et pointer
exactement vers l'hote. Une collision avec le Dresseur ou un retard de confirmation
pouvait donc rendre l'hote visible mais non interactif. Client et serveur partagent
desormais la regle d'adjacence ; la visee stricte reste propre aux duels PvP. Le
serveur continue de verifier carte partagee, presence, proprietaire du combat et
fenetre de ralliement avant d'accepter la composition.

Correctif de preparation d'equipe Coop du 2026-10-09 : `currentPlayerDuelTeam`
masquait toute erreur de projection (notamment une capacite pas encore portee)
derriere le meme `null` qu'une equipe entierement K.O. L'ecran de ralliement
affichait alors a tort `Soignez d'abord votre equipe` a un invite ayant tous ses
PV. Le ralliement utilise maintenant `prepareSourceBattleJoinTeam` : les vrais KO
restent distingues, une incompatibilite explique sa cause et un Pokemon conscient
qui possede au moins une capacite supportee peut participer avec ce sous-ensemble.
Les capacites non portees et les Pokemon totalement incompatibles sont exclus de
ce combat seulement ; leur etat personnel et leurs PP restent inchanges lors du
reglement. La room continue de valider la composition finale et de calculer le
combat de facon autoritaire.

Revision du flux Dresseur du 2026-10-09 : la presence d'un second joueur ne force
jamais un combat Coop. Un combat de Dresseur partage entre d'abord dans l'etat
`invite-choice` : la transition et la musique normales se jouent, les deux
Dresseurs apparaissent face a face et le message de defi est presente, mais aucune
Poke Ball n'est encore lancee. Une petite boite propose alors au proprietaire
narratif `Continuer seul` ou `Appeler [nom]`. Continuer active immediatement le
combat simple. Appeler ouvre seulement alors `join-window` ; l'autre joueur peut
venir, interagir, choisir son camp et ses propres Pokemon selon les limites deja
portees. Le meneur peut encore continuer sans lui. L'acceptation de la composition
ferme la fenetre, convertit le combat en double et reprend la meme introduction aux
lancers de Poke Ball, sans redemarrer la transition.

Autorite : le choix d'appel est une intention du proprietaire narratif validee et
repliquee par la room. L'invite ne peut proposer une composition avant l'appel.
Les etats `invite-choice -> join-window -> active` (ou `invite-choice -> active`)
sont persistants et restaurables ; le solo conserve son adaptateur direct sans
afficher ce choix lorsqu'aucune room n'est active.

Correctif de confirmation du 2026-10-09 : une proposition de l'invite est rendue
avant le panneau generique d'attente du meneur. L'hote voit donc le camp demande,
les Pokemon personnels proposes et les membres deja presents, puis doit choisir
`Accepter et lancer le combat` ou `Refuser`. L'ancien ordre d'affichage masquait
ces boutons derriere `Continuer sans lui`, alors que la room attendait toujours
l'accord. Cote invite, l'interface separe maintenant le choix du camp de celui de
ses propres Pokemon ; les membres de l'autre Dresseur sont affiches en lecture
seule, les K.O. ne sont pas selectionnables et le total personnel est borne a
trois ainsi qu'aux six places du camp. Apres envoi, un recapitulatif confirme
clairement que la demande attend la decision de l'hote.

Correctif de boucle double du 2026-10-09 : la presentation cumule maintenant les
mutations de chaque action positionnee au lieu de repartir de l'etat du debut du
tour. Les PV ne reviennent donc plus a une ancienne valeur entre deux attaques.
Le slot exact est conserve pendant un K.O. et un remplacement ; un sprite a zero
PV reste masque meme si le rendu recharge l'autre combattant, et l'interface de
remplacement suit aussitot le snapshot autoritaire au lieu de rester ouverte sur
l'ancien actif. Pour un invite rallie au camp adverse, les cibles choisies dans
la vue miroir sont reconverties vers les camps autoritaires avant l'envoi.

La reprise d'introduction relit desormais l'etat double accepte avant les lancers
de Ball. Le Dresseur arrivant est affiche a cote de son camp avec son visuel de
profil, puis un message contextualise est presente : le meneur voit l'aide
annoncer son arrivee et l'aide voit le remerciement du meneur. Un ralliement au
camp adverse utilise le visuel du joueur adverse plutot que de continuer a
presenter le PNJ comme s'il etait encore l'unique Dresseur de ce point de vue.

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

Correctif UX du 2026-10-14 : l'ecran Ranch ne melange plus les deux emplacements
dans une collection unique et son titre ne reprend plus la mention source
`PC de Leo`. L'equipe possede un tiroir repliable expose par une commande fixe ;
son conteneur et celui du stockage sont freres, de sorte que replier l'equipe ne
peut plus masquer un Pokemon qui vient d'etre depose. La selection contextuelle
est egalement fermee avant chaque transfert.

Correction complementaire du 2026-10-14 : masquer le noeud Equipe le retirait du
placement automatique de la grille CSS et faisait glisser le stockage dans la
premiere colonne, volontairement reduite a zero. Les deux panneaux utilisent
desormais les zones nommees `team` et `storage` ; le stockage reste donc ancre dans
sa propre colonne lorsque l'equipe est absente du rendu. Le test
`source-ranch-layout.test.ts` verrouille ce contrat de disposition.

Finition visuelle du 2026-10-14 : le fond anime etait porte par
`source-ranch-workspace`, noeud reconstruit lors de l'ouverture des filtres, du tri
ou du repli de l'equipe. Chaque rendu redemarrait donc l'animation et produisait un
micro-saut. Le calque appartient maintenant a la racine stable `source-ranch`.
Le mode replie ne conserve plus une premiere colonne de largeur zero : il utilise
une grille a une seule zone `storage`, ce qui supprime les bandes sombres residuelles.

La grille du Ranch est paginee : 3 colonnes sur 3 lignes avec l'equipe ouverte,
puis 4 colonnes sur 4 lignes avec l'equipe repliee. Le changement de disposition
conserve autant que possible le premier resultat visible. Les filtres et le tri
sont deux tiroirs independants, fermes a chaque nouvelle ouverture. Le tri par
defaut est le numero croissant ; nom, niveau, type principal, potentiel, moyenne
IV et moyenne EV sont aussi proposes sans modifier l'ordre persistant du stockage.
L'image locale `Graphics/Ranch.png` forme un decor legerement floute, assombri et
anime, avec respect de `prefers-reduced-motion`. L'en-tete, les commandes et les
cartes du Ranch emploient une palette verte coherente avec ce decor.

Les cartes restent la primitive commune au tiroir Equipe, au Ranch et a l'onglet
Equipe. Leur variante compacte conserve nom, niveau, PV, objet tenu et
statut majeur. Les types restent visibles sous forme de petits badges avec leur
icone, et les quatre emplacements de capacite sont ranges dans une grille 2 x 2
resserree afin de ne pas agrandir fortement la carte. Lorsqu'un Pokemon tient un
objet, elles affichent un repere dore et le nom francais resolu depuis le catalogue
d'objets ; un identifiant source inconnu reste un repli explicite. Ce changement
est purement visuel : equipe, Ranch, inventaire et objet tenu restent des donnees
personnelles, sans nouvelle intention ni replication Coop.

Finition de densite du 2026-10-14 : la variante compacte ne rend plus la ligne
bleue `numero - emplacement`, deja implicite dans le panneau qui contient la carte.
Le panneau Equipe occupe exactement 25 % de la surface : ses trois colonnes de
stockage restantes ont donc la meme largeur que les quatre colonnes obtenues apres
repli. Les cartes du Ranch ne changent plus de largeur ni de composition.

Dans chaque carte compacte, le sprite occupe la colonne gauche sur toute la hauteur,
tandis que l'identite puis les capacites 2 x 2 utilisent la colonne droite. Les
types sont places sous le nom sous forme de badges d'icone accessibles. Les cartes
Equipe conservent leurs PV ; les cartes du stockage ne rendent plus cette barre,
redondante dans le Ranch. Les dimensions specifiques du tiroir permettent aux six
cartes Equipe et a leurs capacites de rester dans leurs emplacements sans deborder.
Enfin, le voile du decor est une teinte uniforme : l'ancien degrade vertical, qui
produisait une bande sombre visible en bas lorsque le stockage n'etait pas masque
par l'etat vide, a ete retire.

Correctif structurel du 2026-10-14 : lorsque le tiroir Filtre/Tri etait vide,
l'auto-placement de la grille faisait remonter `source-ranch-content` dans la
deuxieme ligne de hauteur automatique. La troisieme ligne extensible restait alors
inutilisee et laissait voir une large zone du decor en bas. Les trois niveaux sont
maintenant ancres dans les zones nommees `toolbar`, `tools` et `content` ; le
stockage occupe donc toute la hauteur disponible dans tous les etats. Le petit
bandeau de rappel du nombre de resultats et du tri a ete retire, le compteur global
restant visible dans l'en-tete du stockage. La pagination demeure dans la derniere
ligne du stockage, au pied de l'ecran. Le mode replie exploite la hauteur liberee
avec 16 cartes par page en grille 4 x 4, contre 9 cartes en 3 x 3 avec l'equipe.

Un clic ouvre `source-pokemon-actions.ts`, menu radial dont le contrat varie entre
equipe, Ranch et combat. `Placer en tete`, `Deposer` et `Retirer` sont raccordes au
noyau personnel persistant ; le placement en tete reordonne reellement l'equipe et
selectionne son premier membre. `Details`, la gestion d'objet et la liberation
depuis le stockage sont raccordes. Le marquage et le changement en combat restent
visiblement indisponibles tant que leur mecanique ou leur ecran n'existe pas. Les choix observes dans les scripts
source sont Donnees/Deplacer/Objet pour l'equipe et
Deplacer/Donnees/Deposer-Retirer/Objet/Marquer/Relacher pour le PC.

Raccord fonctionnel du 2026-10-14 : la roue d'action n'utilise plus le viewport du
navigateur comme repere ; son voile absolu est centre dans le panneau de jeu qui
la contient. `Relacher` est actif uniquement pour un Pokemon du stockage et ouvre
une confirmation destructive explicite. La transaction personnelle retire le
Pokemon, restitue d'abord son objet tenu au Sac avec controle de la limite de 999,
persiste l'etat et renseigne `releasedSpecies` dans l'historique Pokedex.

La gestion d'objet tenu distingue maintenant possession et effet tactique. Tout
objet ordinaire non important peut etre donne depuis le Sac ou le selecteur
Equipe/Ranch, remplace ou retire par la meme transaction atomique. Si son effet de
combat n'est pas encore porte, la preparation de combat le neutralise sans modifier
la collection personnelle. Les objets importants et CT/CS restent exclus du don.

Finition du selecteur d'objet tenu du 2026-10-14 : `Donner objet` ouvre d'abord la
roue generique avec les huit categories reelles du Sac et leurs icones source ; une
categorie sans objet admissible reste visible mais desactivee. Son choix ouvre un
navigateur modal commun a l'Equipe et au Ranch. Il reutilise directement
`sourceBagNodes`, les sous-dossiers automatiques, les cartes d'objet et la
pagination du Sac, avec six entrees par page, retour au dossier puis retour a la
roue. Aucun nouvel etat persistant ou reseau n'est cree par cette navigation.

Correctif d'integration du 2026-10-14 : la modale d'objet tenu reserve maintenant
explicitement une rangee basse a la pagination. Sa hauteur est bornee par le
panneau de jeu et six objets par page occupent une grille 3 x 2, sans aucun
defilement vertical. Chaque carte consacre sa rangee principale a l'icone, au nom
sans ellipse et a la description jusqu'a quatre lignes. Une unique pastille compacte
affiche le compteur sous l'icone : quantite de la pile pour un objet ordinaire, ou
nombre total d'objets pour un dossier automatique. Le nombre de sortes n'est plus
affiche. Le texte utilise toute la hauteur a droite, sans bordure ni contour autour
de la description. Cette structure supprime la rangee vide et ramene les cartes de
92 a 68 px. Les boutons
`Precedente` et `Suivante` restent dans le cadre sur Android.

Alignement du Sac principal du 2026-10-14 : le navigateur du menu reutilise la
meme construction de carte que le selecteur d'objet tenu. Icone et compteur
occupent la colonne gauche ; nom et description sans cadre occupent la colonne
droite. Une pile affiche uniquement sa quantite et un dossier uniquement son total
d'objets. Le rappel du nombre de sortes est aussi retire du fil d'Ariane. La grille
reste paginee, sans liste verticale, avec quatre cartes en telephone portrait et
neuf sur les surfaces plus larges. La description exploite toute la hauteur utile :
jusqu'a six lignes sur la carte standard et huit sur la carte mobile plus haute,
au lieu d'une ellipse prematuree apres quatre lignes. Cette modification est exclusivement visuelle :
l'inventaire reste personnel, persistant et non replique en Coop.

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
les categories francaises extraites. Depuis le correctif du 2026-10-12, la
categorie `pokedexEntries` de `localization.json`, issue en priorite de
`Data/french.dat`, remplace aussi l'entree anglaise de `pokemon.json` dans le
`PlayerDetailsCatalog`.

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

Correctif de cadence sur Worker public du 2026-10-13 : avec un aller-retour reseau
superieur a la duree locale d'un pas, l'interpolation pouvait se terminer avant
l'acquittement autoritaire. La tentative suivante de l'appui maintenu etait alors
refusee comme encore en attente, sans nouveau signal pour la relancer. Le client
memorise maintenant cette continuation et la reprend des que la room confirme le
pas, tout en conservant strictement une seule intention de mouvement en vol. Le
serveur reste l'autorite des collisions et des coordonnees ; cet etat d'attente est
local, transitoire, non persiste et sans nouvelle donnee repliquee. Le comportement
vaut pour l'hote, l'invite et les mouvements automatiques continus deja portes.
L'adresse proposee par defaut dans l'onglet Coop est le Worker public
`https://pokemon-z-battle.mimidu33-eb.workers.dev`; une session memorisee continue
de restaurer explicitement l'adresse avec laquelle elle a ete creee.

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
lots, l'autorite, le cycle `invite-choice -> join-window -> active -> settling -> closed`, les
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

`SharedBattleSession` porte le cycle pur `invite-choice -> join-window -> active -> settling ->
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

Correctif de detection Coop des Dresseurs du 2026-10-06, revise le 2026-10-13 :
le noyau generique de mouvement des PNJ distingue desormais les participants qui
bloquent physiquement une case de ceux qui peuvent declencher une sequence
narrative. Tous les joueurs presents restent des obstacles pour les routes
autonomes, mais seul l'hote appartient a l'audience narrative. Un Dresseur ne peut
donc plus remarquer l'invite, marcher vers lui, ouvrir son dialogue ou lancer son
combat. Le contact transporte toujours une copie de la position canonique de
l'hote dans `SourceSequenceSession` pour l'orientation, la bulle et les commandes
`step-toward-player`.

L'autorite reste exclusivement l'hote : l'invite n'execute aucune IA ni narration
locale et n'envoie pas de nouvelle intention de combat. Ses position et presence
canoniques viennent du `SourceWorldSnapshot` de la room. L'etat narratif et le
combat de Dresseur restent ceux de l'hote, tandis que les poses du PNJ sont un etat
partage visible par les joueurs presents et le combat est diffuse aux participants
selon le contrat Coop existant. La rotation initiale et chaque pas de l'approche
sont maintenant republies dans `sourceActorsUpdated`, meme pendant la sequence qui
suspend l'animation ambiante. Les poses canoniques de la room restaurent le rendu
apres une reconnexion ; la cible ponctuelle n'est pas persistante une fois la
sequence terminee. Le noyau sait encore sélectionner la cible la plus proche parmi
plusieurs cibles narratives, mais l'adaptateur du monde source ne lui transmet
désormais que l'hôte. La copie immuable de cette cible dans la session reste testée.

Correctif de reprise Dresseur du 2026-10-06 : un contact de l'hote detecte pendant
l'interpolation d'un pas est conserve jusqu'a la fin du mouvement, puis demarre
avant l'evenement de case et la rencontre sauvage. Les positions de depart et
d'arrivee du pas local ou distant participent a la detection ; traverser rapidement
une ligne de vue ne perd donc plus l'alerte. Une alerte reste ensuite verrouillee
tant que l'hote n'a pas quitte la ligne de vue, ce qui empeche un
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

Premier lot vertical de fidelite du 2026-10-09 : l'audit des equipes de Jean puis
des trois variantes de Melia montre que toutes leurs fonctions de capacite etaient
deja supportees sauf `030`, utilisee par Agilite. Le noyau applique maintenant ses
deux crans de Vitesse, y compris en double via le meme resolveur. Le talent propre
a Z `FLORACION`, porte par Flabebe, applique aussi le multiplicateur source de 1,5
aux capacites Plante dans le calculateur commun de degats. `CHEEKPOUCH` n'a aucun
effet dans l'equipe actuelle de Jean, son Sapereau ne tenant pas de Baie ; son hook
reste volontairement lie au futur lot generique de consommation des Baies. La room
continue de recevoir les seules intentions et replique l'etat tactique calcule ;
aucune ressource personnelle supplementaire n'est exposee. Le rapport moteur
regenere passe a 24/353 fonctions, 14/255 talents et 17/18 evolutions, soit 74/651
mecanismes. Le test double d'Agilite a aussi revele puis corrige un ecrasement
generique des effets ciblant l'utilisateur : l'etat du defenseur factice ne
remplace plus l'acteur lorsqu'acteur et cible designent le meme slot. Tests
complets, build et typecheck overworld passent.

Deuxieme lot vertical du 2026-10-12 : la frontiere inclut Vin et toutes les
rencontres terrestres capturables de Map007, Map009, Map014 et Map016, soit 21
especes uniques. Leur projection au niveau maximal de chaque table et leurs 69
capacites ont ete executees contre les donnees locales, sans suppression. Treize fonctions ont
rejoint le noyau commun : peur `00F`, confusion `013`, concentration critique
`023`, doubles hausses `027/028`, Tornade `077`, puissance par poids `09A`,
Clairvoyance `0A7`, Entrave `0B9`, Encore `0BC`, ligotage `0CF`, Malediction
`10D` et Tour Rapide `110`. Les effets temporaires font partie du snapshot de
combat autoritaire, sont acceptes par le protocole Coop, presentes aux joueurs et
effaces au switch ; ils ne contaminent jamais la sauvegarde personnelle. Le detail
de la frontiere et des dettes est conserve dans `docs/COMBAT_VERTICAL_AUDIT.md`.

La peche et Surf ne sont pas inclus : l'overworld ne sait pas encore declencher ces
methodes. Le prochain lot vertical est Navarroc puis la Forteresse (Alexandre,
Micael, Maria et Canola), avec le raccord generique des objets tenus source.

Troisieme lot vertical du 2026-10-12 : les rencontres terrestres de Map017 et les
equipes Alexandre/Micael/Maria versions 0/1 puis Canola version 0 sont maintenant
projetables sans suppression. L'import Dresseur conserve generiquement
`heldItem` et `abilityIndex` ; Canola obtient donc bien Peau Seche sur Croagunk.
Vingt-et-une fonctions rejoignent le registre, dont Bluff, Coup Bas, Choc Venin,
Reflet, Air Veinard, Tourniquet, Anti-Brume, Provoc, Depit, Detection, Tenacite,
Piqure et les frappes multiples. Vent Feerique, extrait avec `00`, est normalise
en `000`. Les effets de camp/terrain et les nouveaux volatiles sont dans le
snapshot autoritaire et le validateur Coop accepte leur contrat sans dupliquer la
regle metier.

Les Gemmes Combat/Insecte, Evoluroc, Baie Aranja et Baie Payapa sont executes ;
leur consommation est persistee uniquement pour le proprietaire. Le meme hook de
Baie active Bajoues et est appele par le simple comme le double. Peau Seche,
Contraguardia, Impassible, Regard Vif, Serenite, Mue, Essaim, Synchro,
Intimidation et Rege-Force disposent de leurs hooks requis. Un audit local a
projete 19 instances et resolu leurs 74 emplacements de capacites sur les donnees
2.12 FR. Tests complets, typecheck et build passent sur ce jalon.

Fermeture P0 Forteresse du 2026-10-13 : les quatre raccords sont implementes dans
le noyau commun. `ImportedTrainer.items` conserve les objets source et
`BattleTeam.items` porte uniquement l'inventaire du Dresseur controle par le jeu ;
le Sac personnel reste hors de ce snapshot. La room est autoritaire, consomme
l'objet une fois et restaure ce reliquat apres reconnexion. Le choix de soin suit
les seuils Ruby : garanti sous 25 % des PV, puis tirage de 30 % sous 50 %. Cette
regle minimale ferme Canola sans pretendre remplacer la future IA tactique.

Poursuite est extraite de l'ordre normal lorsqu'une cible change : elle frappe et
double ses degats sur le Pokemon sortant, puis le changement a lieu, en simple et
en double. `protectRate` appartient aux volatiles tactiques, double apres chaque
Protection/Detection/Tenacite reussie et revient a 1 apres echec ou rupture de la
chaine. Les frappes `0C0` produisent des evenements `damageApplied` distincts ; le
sequenceur joue donc chaque impact et chaque palier de PV. Le validateur Coop
accepte l'inventaire PNJ borne et `protectRate`. `088`, `0AA` et `0C0` quittent la
liste partielle : le registre courant comptait 55 fonctions de capacite supportees,
4 partielles, 28 talents actifs et 17/18 methodes d'evolution. La regeneration du
rapport local n'a pas ete possible sur ce poste car le chemin source memorise dans
`.pokemon-z/local-test.json` n'existe plus ; les comptes proviennent directement
des registres testes. La recette manuelle Forteresse et la matrice
`STAB-BATTLE-1` restent a faire. Peche/Surf de Map017 restent hors scope.

Correctif de projection Coop du 2026-10-09 : le validateur strict du protocole
n'avait pas repris `030` apres son ajout au type et au resolveur du moteur. Une
equipe contenant Agilite etait donc valide localement, puis rejetee avant la room
avec `openSourceBattle mal forme`. Le registre reseau accepte maintenant cette
fonction et un test ouvre explicitement un combat de Dresseur avec Agilite. La
presentation audio consulte aussi `asset-manifest.json` avant de choisir une
extension : `Exit Door` et `GEN8- Exclaim`, disponibles en WAV/MP3 mais pas en OGG,
ne produisent plus de 404 preliminaire dans la console.

Diagnostic d'etat personnel Coop du 2026-10-09 : l'hypothese d'une copie de
sauvegarde `sessionStorage` par onglet n'a pas corrige le refus de ralliement et
a ete retiree afin de ne pas introduire une seconde autorite personnelle. Equipe,
sac, soins et preparation de combat relisent donc tous le meme `sourceEventState`
persistant. Le panneau de refus affiche maintenant l'index actif et les PV exacts
lus par le moteur au moment de l'interaction ; cette information distingue un
etat en memoire divergent d'une erreur de projection sans demander d'inspecter
les stockages du navigateur. La room ne recoit toujours que la projection
tactique bornee au moment de la participation. La preparation reserve en outre
« Soignez d'abord votre equipe » au seul cas ou tous les PV lus valent zero ; une
espece ou une capacite non encore projetable produit un diagnostic distinct et
les membres conscients compatibles restent utilisables.

Correctif de presentation du 2026-10-09 : pendant un combat de Dresseur, la fin
de l'envoi adverse retirait trop tot la classe `revealing-opponent`. Comme la scene
restait encore en mode `intro-playing`, le CSS remasquait alors le Pokemon adverse
pendant toute l'entree du Pokemon joueur, avant de le faire reapparaitre au premier
tour. L'envoi adverse conserve maintenant sa classe de revelation jusqu'au
nettoyage global termine apres les deux entrees. Le chemin sauvage la conservait
deja correctement ; aucun etat tactique, reseau ou persistant n'est modifie.

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
source l'interdit. Le drapeau double ouvre maintenant le moteur double commun au
lieu de lancer a tort un combat simple ; une bataille deja double n'accepte pas de
ralliement supplementaire dans le contrat actuel. Les six appels restants sont les formes
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

Audit source cible du 2026-10-05, actualise le 2026-10-09 :
`engine-support-report.json` confirme 19/19 interactions de types, mais seulement
24/353 fonctions d'attaque et 14/255 talents. Son registre declare maintenant
17/18 methodes d'evolution supportees ; `Shedinja` reste explicitement non porte
car il cree un second Pokemon. Aucune famille source d'objets n'est encore declaree
complete. Le rapport regenere compte 74 mecanismes supportes sur 651. Les rapports de
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

Au moment de cette note, la suite complete contient 520 tests et passe avec le build.
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

Dette manuelle constatee le 2026-10-07 : malgre ce contrat, l'hote a pu utiliser
le menu de changement pour envoyer un Pokemon appartenant a l'invite pendant un
double Coop. Le comportement par defaut doit rester strictement borne au
proprietaire. Le porteur souhaite toutefois garder comme amelioration possible un
partage tactique optionnel, accepte par les deux joueurs avant le combat. Si cette
extension est retenue, la room devra persister une permission limitee a la session
de combat et continuer d'attribuer ressources, EXP et sauvegarde au vrai
proprietaire ; aucun echange permanent de Pokemon n'est implique.

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

Correctif de contrat capture/Coop du 2026-10-07 : le poids extrait du PBS est en
kilogrammes decimaux, alors que `PokeBattle_Battler#weight` et les seuils de la
Masse Ball emploient des hectogrammes entiers. La projection vers `BattlerState`
effectue maintenant cette conversion une seule fois. Avant ce correctif, le champ
decimal ajoute avec les donnees de capture faisait rejeter par le validateur strict
les equipes de `respondPlayerChallenge` et `openSourceBattle`. Les deux chemins
reseau acceptent desormais la meme projection bornee, sans assouplir le protocole.

Un bouton volontaire `Donner tous les objets de test` est disponible dans l'onglet
Deplacements. Il place 99 exemplaires de chaque objet extrait dans la seule
sauvegarde personnelle du navigateur courant. Il ne modifie ni l'inventaire de
l'autre joueur ni la room et evite toute edition directe des fichiers internes du
navigateur.

Quatrieme increment `SOLO-ITEMS-1` du 2026-10-07 : le registre commun couvre les
restaurateurs de PP verifies dans les handlers source : `ETHER` et `LEPPABERRY`
restaurent 10 PP a une capacite choisie, `MAXETHER` la remplit, `ELIXIR` restaure
10 PP a toutes les capacites et `MAXELIXIR` les remplit. Le Sac personnel demande
le Pokemon puis la capacite lorsque necessaire ; un index absent/invalide ou une
capacite deja pleine ne consomme rien. Les PP resultants sont egalement portes par
l'evenement tactique afin que la presentation animee reste coherente avant le
snapshot final.

Le meme increment active en combat les familles `XATTACK`, `XDEFEND`/`XDEFENSE`,
`XSPECIAL`/`XSPATK`, `XSPDEF`, `XSPEED` et `XACCURACY`, avec les variantes
1/2/3/6 presentes dans les donnees. Elles ne sont jamais applicables hors combat
et visent automatiquement le Pokemon actif controle. Le protocole passe en v15
pour transporter l'index de capacite des objets PP ; l'ancien etat persiste v14
reste chargeable. La room refuse un Pokemon non possede ou une reserve pour un
objet X, reserve le stock personnel et restitue consommation/reliquat apres
reconnexion. Un test double fait consommer au meme tour un soin par l'invite et un
objet X par l'hote, avec deux reglements strictement separes.

`DIREHIT`/Puissance et `GUARDSPEC`/Garde-Stats restent explicitement reportes :
leurs effets source exigent Focus Energy et Mist, deux etats volatils que le moteur
ne represente pas encore. Ils ne doivent pas etre simules par un simple cran de
statistique.

`SOLO-ITEMS-1` reste en cours pour les objets de combat a etat volatil, objets
tenus, pierres et CT/CS. `SOLO-CAPTURE-1` possede maintenant sa boucle fonctionnelle
solo/Coop ; restent l'animation, le surnom, la capture critique/Pokedex et les
modificateurs contextuels heure/milieu/type de rencontre. Les sous-categories et
tris avances du Sac restent planifies dans `UI-BAG-1` apres le noyau metier.

Cinquieme increment `SOLO-ITEMS-1` du 2026-10-08 : les onze objets tenus dont les
effets sont deja portes dans le moteur (`ASSAULTVEST`, `BLACKSLUDGE`, `EXPERTBELT`,
`FOCUSSASH`, `LEFTOVERS`, `LIFEORB`, `MUSCLEBAND`, `ROCKYHELMET`, `SCOPELENS`,
`WIDELENS`, `WISEGLASSES`) peuvent maintenant etre equipes, remplaces ou retires
depuis la roue d'action commune de l'Equipe et du Ranch. L'ecran ne propose que
les exemplaires reellement possedes et rend atomiquement l'ancien objet au Sac ;
la roue reste ouvrable lorsque cette liste est vide afin de ne pas masquer la
fonction, tandis que toute modification demeure interdite pendant un combat ;
la limite de 999, une disparition de stock et une cible etrangere annulent toute
la transaction. Un ancien objet encore inerte peut toujours etre retire afin de
ne pas enfermer une sauvegarde migree.

Le noyau personnel `changePokemonCollectionHeldItem` traite equipe et stockage
avec la meme transaction immutable. Il est utilise sans variante par le solo,
l'hote et l'invite et ne publie ni inventaire ni Ranch dans la room. Le pont de
combat existant transporte ensuite uniquement l'objet equipe et ses effets deja
supportes vers le noyau local ou autoritaire. Ce jalon ne pretend pas couvrir tous
les objets tenus de Z : leurs autres hooks doivent etre ajoutes par lots verticaux
avant de les rendre selectionnables.

Sixieme increment `SOLO-ITEMS-1` du 2026-10-08 : la roue d'actions n'est plus un
composant propre aux Pokemon. Le presentateur generique `source-action-wheel`
sert maintenant aux cartes Pokemon et aux entrees du Sac. Un clic sur n'importe
quel objet ouvre `Utiliser`, `Donner` et `Jeter`; le centre annule. Utiliser garde
le choix de Pokemon puis de capacite, Donner rejoint la transaction d'objet tenu,
et Jeter demande une quantite avant une mutation personnelle atomique. Les objets
importants (`itemType 6`) et les CS (`fieldUse 4`) sont proteges. Les actions non
encore portees restent visibles mais desactivees avec leur raison. Le contrat
`specificActions` permet aux futurs modules (enregistrement, plantation, CT/CS,
pierres, etc.) d'ajouter leurs choix sans dupliquer la roue. Inventaire et effets
restent personnels et persistants en solo/hote/invite, sans replication du Sac.

Jalon ergonomique `UI-BAG-1` du 2026-10-08 : les listes verticales du Sac et du
Sac de combat utilisent maintenant la meme grille de cartes a taille fixe. Nom,
icone, description multilignes et quantite mise en valeur partagent un composant ;
la pagination remplace le defilement interne (neuf cartes dans le menu, quatre sur
petit ecran et en combat). La page est bornee apres toute consommation afin de ne
jamais rester sur une page devenue vide.

Un classifieur semantique pur place les objets dans des sous-familles (Baies,
Menthes, materiaux, familles de soins, Balls specialisees, equipements tenus,
Pierres, Fossiles, Mega-Gemmes, boosts de combat, outils, cles, etc.). Un dossier
virtuel n'apparait qu'a partir de huit references distinctes possedees ; en dessous,
les objets restent directement visibles. Le dossier affiche simultanement le
nombre de sortes et la quantite cumulee. Il n'existe qu'un niveau de dossier.
La poche CT/CS est une exception explicite : elle reste plate et paginee, sans
dossier CT ou CS. Un filtre propre a ce catalogue sera ajoute dans un lot ulterieur.

Finition `UI-BAG-1` du 2026-10-08 : objet et dossier sont rendus par la meme
primitive `InventoryCard`. Icone, bloc nom/description, quantite principale et
compteur secondaire possedent des zones de grille reservees ; aucun badge n'est
superpose au texte. Le titre conserve le contexte `Sac · poche`, la grille est
isolee du debordement et la pagination occupe une rangee stable. Le contrat reste
partage entre Sac d'exploration et Sac de combat.

Refonte du menu principal du 2026-10-08 : le bandeau superieur porte desormais le
contexte, le titre de l'onglet et sa metadonnee utile (argent, taille d'equipe,
etat de sauvegarde ou Coop). Les titres internes redondants et le pied de page ont
ete retires de la composition visuelle ; la navigation et le contenu utilisent
toute la hauteur restante. Sur grand ecran, la navigation reste laterale. Sous
430 px, le menu devient une modale plein viewport avec navigation basse afin de
ne plus etre contraint par le cadre 4:3 de l'overworld. Cet etat est purement
visuel et personnel : aucune donnee supplementaire n'est repliquee en Coop.

L'onglet Equipe exploite cette nouvelle surface avec une grille fixe de deux
colonnes sur trois lignes. Les six emplacements sont toujours visibles : une
carte occupee conserve sprite anime, identite, niveau, types, PV et quatre
capacites ; une place vacante affiche un slot neutre non interactif. Les actions
restent celles de la carte partagee Equipe/Ranch et l'etat reste personnel.

Le meme classifieur et le meme composant alimentent l'exploration et le combat.
Le combat projette d'abord le stock personnel autorise par le noyau local ou la
room, retire les objets inutilisables, puis construit ses dossiers ; aucun stock
prive supplementaire n'est replique. Autorite et persistance restent donc celles
de l'inventaire personnel de l'hote ou de l'invite. Dossier et page sont un etat
visuel local non persiste, reconstruit apres reconnexion, visible seulement par le
joueur concerne.

Correctif de boucle UI du 2026-10-08 : les choix de cible n'apparaissent plus sous
la longue liste du Sac. Utiliser et Donner ouvrent une etape modale visible avec
les membres de l'equipe, leurs sprites, niveaux, PV et objet tenu pertinent. Les
objets a PP enchainent ensuite le choix de capacite. Chaque mutation se termine
par un resultat explicite puis Continuer ou Recommencer si le stock le permet ;
Retour rejoint la roue et le centre de la roue annule l'interaction. Le contrat
`sourceItemTargetFlow` a prepare pour les CT/CS les etapes Pokemon, compatibilite,
remplacement eventuel et confirmation avant leur activation dans l'increment
suivant.

Septieme increment `SOLO-ITEMS-1` du 2026-10-08 : `PBS/tm.txt` est maintenant
extrait dans `machines.json`. Les 114 sections et 26 802 liens espece/capacite
sont parses sur plusieurs lignes, dedupliques et valides contre les catalogues ;
le rapport controle desormais 60 140 references, dont seules les deux ambiguities
`SECRETSWORD` deja connues restent en erreur. L'ecran CT/CS annote Compatible,
Incompatible ou Capacite deja connue, demande une capacite a oublier lorsque les
quatre emplacements sont occupes, puis confirme et affiche le resultat.

Le noyau personnel `teachPokemonMachineMove` effectue la mutation atomique de
l'equipe. Il preserve le PP courant de l'emplacement remplace, plafonne au maximum
de la nouvelle capacite, conformement a `pbLearnMove(..., bymachine=true)`. Le
script source fixe `INFINITETMS=true` : ni CT ni CS ne sont consommees, jetables
ou donnables. Solo, hote et invite utilisent leur inventaire/equipe persistants
sans etat de Sac replique. Audit source restant : `HM05/WATERFALL` et `HM06/DIVE`
ont un objet mais aucune section dans `tm.txt`, donc Apprendre reste desactive pour
ces deux cas plutot que d'inventer une compatibilite ; six sections de `tm.txt`
n'ont inversement aucun objet machine associe.

Huitieme increment `SOLO-ITEMS-1` du 2026-10-08 : les medecines ameres de Z sont
portees depuis leurs handlers Ruby. `ENERGYPOWDER` restaure 50 PV,
`ENERGYROOT` 200 PV, `HEALPOWDER` soigne les statuts majeurs et
`REVIVALHERB` ranime completement. Leurs diminutions de bonheur respectent les
seuils exacts de `changeHappiness` et suivent le Pokemon dans l'etat tactique,
le reglement personnel et la reconnexion Coop. Comme dans la source,
`REVIVALHERB` contourne la restriction Nuzlocke. `Cenizas`, objet propre a Z,
ranime aussi completement sans perte de bonheur et reste reserve au terrain car
aucun handler de combat ne lui est associe.

`SACREDASH` utilise une transaction personnelle d'equipe distincte : une seule
unite ranime tous les Pokemon K.O. non oeufs et restaure PV, statut et PP. Le Sac
demande une confirmation d'equipe plutot qu'une cible individuelle. Ces usages
hors combat sont locaux a la sauvegarde du proprietaire chez le joueur solo,
l'hote et l'invite ; en combat, la room reste autoritaire et ne restitue que le
bonheur et les ressources du Pokemon possede. Dette explicite : la branche
Confusion de `HEALPOWDER` sera ajoutee avec les etats volatils, la Confusion
n'etant pas encore representee dans le moteur.

Le bonheur est directement visible dans la colonne permanente du resume Pokemon
(equipe, Ranch et lecture de combat), avec sa valeur exacte sur 255, une jauge et
une appreciation lisible. Il n'est donc plus necessaire d'ouvrir la sous-page
IV/EV pour verifier l'effet d'un remede amer ; la fiche est reconstruite depuis
l'etat personnel courant a chaque ouverture ou changement de Pokemon.

Neuvieme increment `SOLO-ITEMS-1` du 2026-10-08 : `PPUP` et `PPMAX` augmentent
durablement le maximum de PP de la capacite choisie selon les trois paliers du
jeu source. Le compteur et les PP de base sont conserves dans la sauvegarde de la
capacite avec une migration compatible : leur absence dans une ancienne sauvegarde
vaut zero. L'utilisation ne restaure pas les PP courants et devient sans effet au
troisieme palier.

Les vitamines classiques (+10 EV), les Super Vitamines propres a Z (+20 EV) et
les Ailes (+1 EV) sont egalement actives hors combat. Elles respectent les limites
source de 250 EV pour les vitamines, 252 par statistique et 510 au total ; le gain
reel peut donc etre inferieur a la valeur nominale. Statistiques et PV sont
recalcules en preservant les degats, et le gain de bonheur `vitamin` tient compte
des seuils de Z et du Grelot Zen. Ces mutations restent strictement personnelles
et persistantes chez le solo, l'hote et l'invite ; aucune donnee IV/EV ou de Sac
n'est repliquee dans la room.

Dixieme increment `SOLO-ITEMS-1` du 2026-10-08 : les six Capsules propres a Z
(`SCapsula`, `ACapsula`, `DCapsula`, `AECapsula`, `DECapsula`, `VCapsula`)
augmentent de 7 l'IV cible, dans les limites de 31 par statistique et 186 au total,
puis appliquent le meme gain de bonheur `vitamin`. La Capsule doree
`CHAPADORADA` parcourt les six statistiques dans l'ordre source et ajoute jusqu'a
7 IV a chacune, sans bonheur.

Anomalie source conservee explicitement : la description de `CHAPADORADA` annonce
`+10`, mais son handler Ruby appelle six fois `pbRaiseIndividualValues`, dont le
gain par defaut est `+7`. Le port suit le comportement runtime `+7`. En revanche,
il corrige prudemment la consommation a vide implicite du handler : si aucun IV
ne peut augmenter, la transaction echoue et conserve l'objet, conformement a
l'invariant commun des objets. Les Capsules restent personnelles, persistantes et
inutilisables en combat chez le solo, l'hote et l'invite.

Onzieme increment `SOLO-ITEMS-1` du 2026-10-08 : les 21 Menthes reellement
presentes dans `items.json` changent la nature stockee du Pokemon, comme le fait
`setNature` dans Z, puis recalculent ses statistiques en preservant ses degats.
Il ne s'agit donc pas du comportement des jeux officiels recents qui gardent une
nature d'origine separee des effets statistiques. L'usage reste personnel,
persistant et reserve au terrain en solo, chez l'hote et chez l'invite.

Deux anomalies source sont traitees explicitement : `QUITEMINT` est un handler
mort visant la nature inexistante `QUITE` et n'est pas expose ; le vrai objet est
`QUIETMINT` et applique `QUIET`. De plus, les handlers Ruby renvoient indirectement
le resultat vrai de l'affichage meme lorsque la nature est deja identique, ce qui
consomme la Menthe sans effet. Le port applique l'invariant transactionnel commun :
une nature deja identique renvoie `no-effect` et conserve l'objet.

Douzieme increment `SOLO-ITEMS-1` du 2026-10-08, lot groupe d'ajustement EV :
les six baies Grana/Algama/Ispero/Meluce/Uvav/Tamate retirent jusqu'a 10 EV de
leur statistique et appliquent simultanement le gain de bonheur `EV berry` de Z
(+10 sous 100, +5 sous 200, sinon +2, avec Grelot Zen et plafond 255). Une baie
reste donc utilisable si un seul des deux effets est possible, mais n'est pas
consommee lorsque l'EV vaut zero et le bonheur est deja maximal.

`POKESENCIA` et `POKESENCIAREFINADA` parcourent les statistiques dans l'ordre
source, ajoutent 80 EV lorsqu'une valeur est inferieure ou egale a 152, sinon la
completent vers 252, et bornent le total a la limite particuliere 508 codee dans
Z. Depuis zero, une premiere utilisation produit donc 80 dans chaque statistique,
soit 480 ; une seconde ajoute les 28 restants aux PV. Les deux handlers Ruby sont
identiques, mais `POKESENCIAREFINADA` a `fieldUse=5` et n'est pas consommee, alors
que `POKESENCIA` a `fieldUse=1` et l'est. Le port empeche aussi le delta negatif
que le script pourrait calculer sur une sauvegarde deja au-dessus de 508 : dans
ce cas l'objet reste sans effet et n'est pas consomme. Toutes ces mutations sont
personnelles en solo/hote/invite et ne quittent jamais la sauvegarde du proprietaire.

Treizieme increment `SOLO-ITEMS-1` du 2026-10-08 : le Bonbon Rare possede une
transaction de progression dediee, car son effet traverse plusieurs noyaux. Le
Sac demande une quantite, puis applique les caps narratifs exacts de Z
(`17/27/36/42/50/56/70/75/80/85/94/100`) issus des interrupteurs de badges
`88/97/150/211/326/502/503/504/505/506/744`. Seule la quantite qui produit
effectivement des niveaux est consommee ; le niveau 100, le cap courant et les
oeufs refusent proprement l'usage. Experience, statistiques et PV sont recalcules
par le meme noyau que l'EXP de combat, en preservant les degats, et le bonheur
`level up` de la source est applique une fois par utilisation, avec Luxe Ball et
Grelot Zen.

Les capacites de niveau franchies remplissent les emplacements libres. Si les
quatre emplacements sont occupes, elles sont conservees dans la sauvegarde afin
de survivre a un rechargement, puis l'ecran obligatoire demande immediatement et
dans l'ordre si une capacite doit etre remplacee. Ce contrat corrige egalement les
apprentissages traverses par l'EXP de combat. Les
donnees `evolutions` extraites alimentent un premier resolveur pur pour les
methodes de niveau, genre, rapport Attaque/Defense, Silcoon/Cascoon, bonheur et
capacite connue, avec Pierre Stase. Il retourne le candidat apres le Bonbon Rare,
mais ne change pas encore l'espece : mutation, annulation et scene d'evolution
forment le prochain lot `SOLO-EVOLUTION-1`.

Autorite : inventaire, equipe, capacites en attente et resultat d'evolution sont
personnels et persistants. Le solo, l'hote et l'invite appellent la meme
transaction locale ; aucune donnee privee n'est publiee a la room. Le cap est
toutefois derive de l'etat narratif de l'hote deja replique pendant une session
partagee, afin que les deux joueurs respectent l'avancement du monde visite. Une
reconnexion restaure l'equipe personnelle et les choix de capacite non resolus.

Correctif de recette du 2026-10-08 : le raccord UI du Bonbon Rare et le recalcul
des objets d'entrainement referencaient par erreur une propriete inexistante
`playerDetailsCatalog` au lieu du catalogue reel `battleCatalog`. Vite seul ne
typecheckait pas cette application et le defaut n'apparaissait qu'au clic. Les
deux chemins utilisent maintenant le catalogue charge, et le typecheck explicite
de l'overworld fait partie de la validation du correctif.

Le catalogue source contient en outre 43 objets sans bitmap `itemNNN.png` (cles,
montures, lettres, quelques Mega-Gemmes et objets particuliers). Ce ne sont pas
des echecs d'extraction : leur absence est confirmee par `asset-manifest.json`.
L'overworld construit desormais l'ensemble des icones disponibles depuis ce
manifeste et choisit `item000.png` avant le rendu pour toute entree absente. Un
repli runtime memorise aussi toute incoherence residuelle, afin d'eviter une
nouvelle requete 404 a chaque rerendu du Sac.

Finition mobile du meme jalon : le champ numerique natif des quantites a ete
retire. Un selecteur tactile commun propose de grandes cibles `-10`, `-1`, `+1`,
`+10` et `Max`, bornees au stock. Il sert au Bonbon Rare et au jet d'objets, afin
que les prochains flux quantifies reutilisent la meme interaction sans les petits
controles de navigateur difficiles a manipuler au telephone.

Premier increment `SOLO-EVOLUTION-1` du 2026-10-08 : l'audit de
`pokemon-evolution.rb` et des 557 branches extraites confirme 18 methodes utilisees
par Z. Le resolveur pur en couvre 17 comme evolutions principales : niveau,
Ninjask, bonheur et bonheur jour/nuit, genre, rapport Attaque/Defense,
Silcoon/Cascoon, capacite connue, espece presente dans l'equipe, objet tenu de jour
ou de nuit, pierre et pierre reservee aux femelles. Les bornes jour/nuit suivent
la source (`06:00-19:59` / `20:00-05:59`), les oeufs, la Pierre Stase et le Pichu
forme 1 sont bloques. `Shedinja` est volontairement distingue : il s'agit d'une
creation secondaire apres Ninjask, pas de l'evolution principale.

Une montee de niveau par Bonbon Rare, par le reglement EXP local ou par le
reglement autoritaire d'un combat partage persiste maintenant le candidat sur le
Pokemon personnel, puis lance automatiquement le conducteur de progression des
que le combat est ferme. Il resout d'abord chaque
capacite en attente, puis ouvre l'ecran d'evolution. Il n'existe pas de choix
`Evoluer` dans l'Equipe : l'annulation n'est offerte que pendant l'animation,
comme dans Z. Une evolution non annulee conserve identite, Dresseur,
IV, EV, bonheur, shiny, rubans et degats, passe a la forme 0, recalcule les
statistiques, transpose le talent au meme emplacement lorsque possible, consomme
l'objet tenu des methodes jour/nuit et propose les capacites de la nouvelle espece
au niveau courant. L'annulation retire l'offre comme l'arret de la scene source.

Les 21 parametres d'objet presents dans les donnees (`Item`/`ItemFemale`) sont
actifs depuis le Sac et consommes atomiquement uniquement sur une cible eligible.
Cela inclut les neuf pierres `*IMBUIDA`, qui ajoutent le `+7` source a chaque IV
avant l'evolution. Les mutations restent personnelles et persistantes en solo,
chez l'hote et chez l'invite ; seules les informations tactiques normales du
Pokemon rejoignent ensuite un combat partage.

L'ecran visuel reprend le fond GIF `evolutionbg`, le cri initial, la musique
`evolv`, l'alternance acceleree des deux silhouettes pendant sept secondes, le
flash final, le cri de la nouvelle espece et le jingle `EvolutionSuccess`. Il
bloque les controles du monde ; `prefers-reduced-motion` le raccourcit. Une sauvegarde ou
reconnexion avec une capacite/evolution en attente reprend automatiquement ce
conducteur, l'etat persiste n'etant donc pas une option de menu differee.

Deuxieme increment `SOLO-EVOLUTION-1` du 2026-10-08 : les pierres et autres objets
d'evolution passent maintenant par la meme presentation bloquante apres leur
transaction atomique. Contrairement aux evolutions de niveau, aucun bouton
d'annulation n'est affiche. L'espece, les IV des pierres impregnees et l'inventaire
sont persistes avant la presentation : une fermeture ou reconnexion ne peut donc
ni rendre l'objet ni appliquer deux fois l'evolution.

Correctif de fidelite visuelle du 2026-10-08 : la scene suit maintenant quatre
temps explicites du script source. Elle montre d'abord le Pokemon colore avec
`Quoi ? [nom] evolue !`, ne blanchit et n'alterne les deux silhouettes que pendant
la transformation, puis montre la nouvelle espece coloree avec le message de
felicitations ; une annulation restaure de meme l'ancienne espece coloree et son
message. Le decor `evolutionbg` occupe le cadre rectangulaire 4:3 d'origine, sans
masque ovale. Les battlers de Z etant des planches horizontales (71 frames pour
Goupix, 53 pour Feunard), le rendu les decoupe et les anime frame par frame au
lieu d'afficher la bande complete aplatie. Forme, chromatisme et sexe sont resolus
une fois au debut de la scene et restent stables apres la mutation persistante.

Dettes explicites avant fermeture : valider manuellement le cadrage et les
temporisations sur plusieurs tailles de Pokemon, creer Munja avec une Poke Ball et une place libre,
puis raccorder le futur registre Pokedex vu/possede. Le noyau ne simule pas Munja
en silence.

Outils de recette du 2026-10-08 : l'ancien onglet `Deplacements` s'appelle
desormais `Test dev` et separe quatre sous-menus : mouvements, deblocages, Sac et
don de Pokemon. Le Sac peut ajouter une quantite choisie d'un objet ou de toute
une poche, puis vider uniquement la poche confirmee. Le don recherche une espece
dans le catalogue extrait, choisit son niveau et l'envoie dans l'equipe ou au
Ranch selon la place disponible. Le cap de niveau peut suivre l'histoire ou etre
simule jusqu'a 100 ; cette preference et le deblocage des mouvements restent dans
le stockage local de developpement et ne changent aucun switch narratif.

Revision ergonomique du 2026-10-15 : le selecteur de don n'expose plus le nom
interne anglais dans un `datalist`. `parseBattleCatalog` fournit les noms issus de
`Data/french.dat` pour les 1 018 especes extraites ; l'identifiant interne reste
seulement la cle transmise au noyau de creation. L'ecran affiche une grille paginee
de 12 cartes avec icone, numero, nom francais et types. La recherche instantanee
accepte nom francais sans accent, numero et identifiant interne de secours ; elle
se combine avec le type et le tri par numero ou nom. Aucun bouton Appliquer n'est
requis, une selection explicite est obligatoire avant le don, et les cibles tactiles
restent utilisables sur mobile. Ce changement demeure un outil personnel : il ne
modifie ni l'autorite narrative ni l'etat partage Coop.

Les objets et Pokemon donnes modifient en revanche la sauvegarde personnelle du
navigateur, comme l'indique l'interface. En Coop, hote et invite possedent leurs
propres outils et collections ; le cap simule de l'initiateur est inscrit dans le
contrat du prochain combat source partage, sans publier son Sac ni son equipe
complete. Une reconnexion conserve les mutations personnelles normalement.

Correctif Coop du 2026-10-08 : la validation runtime des equipes de combat ne
maintient plus une liste partielle d'objets tenus distincte du moteur. Elle utilise
desormais `isHeldItemSupported`, autorite canonique commune aux projections solo,
PvP et combats source. Les cinq objets jusque-la oublies par le protocole
(`EXPERTBELT`, `FOCUSSASH`, `LIFEORB`, `ROCKYHELMET`, `WIDELENS`) ne rendent donc
plus `respondPlayerChallenge` ni `openSourceBattle` mal formes. Le correctif ne
change ni l'autorite de la room, ni la persistance personnelle de l'objet : seule
sa projection tactique minimale est repliquee aux participants. Un test parcourt
les onze objets supportes sur l'acceptation d'un duel et l'ouverture d'un combat
sauvage, tout en maintenant le rejet d'un identifiant inconnu.

Correctif de projection PvP du 2026-10-12 : le refus « Il faut au moins un
Pokemon en etat de combattre » masquait encore toute exception produite par
`playerPartyToBattleTeam`. Le symptome suivait donc la sauvegarde du joueur et non
son role hote/invite. Le contenu du Sac n'entre jamais dans un defi classique ;
la cause possible est une mecanique portee par l'equipe, notamment un objet tenu
ou une capacite non encore supportee. Defi PvP et ralliement Coop utilisent
desormais le meme `prepareSourcePlayerBattleTeam` : les Pokemon conscients et les
capacites compatibles restent engageables, tandis qu'un objet tenu source non
supporte est neutralise uniquement dans la projection tactique. La room ne recoit
ni le Sac ni l'objet neutralise. `storeProjectedBattleTeam` restitue ensuite PV,
statut, bonheur et PP connus sans supprimer les membres, capacites ou objets
source absents de cette projection. Le panneau d'acceptation affiche la cause
reelle s'il reste impossible et signale les mecanismes neutralises sinon.

Correctif de presentation des combats du 2026-10-12 : les variations de PV ne
reposent plus sur une transition CSS et un delai suppose equivalent. La file
visuelle anime explicitement la jauge et attend sa promesse de fin avant les
messages d'efficacite, le K.O. et les enchainements. Le client reseau conserve
egalement l'ancien etat presente jusqu'a la fin de cette file ; l'etat autoritaire
recu reste la source de verite, mais la demande de remplacement ne devient visible
qu'apres le K.O. effectivement joue. Le choix d'un remplacant ferme immediatement
la liste au profit d'un message d'attente local, conserve meme si l'accuse serveur
arrive avant la fin de l'animation, puis disparait lorsque l'etat autoritaire
remplace le Pokemon. Ce verrou est seulement visuel et volatil : aucune nouvelle
persistance ni regle de combat n'est creee, et le meme animateur sert les combats
solo, hote et invite.

Correctif de lancement des combats PNJ du 2026-10-12 : les rencontres sauvages et
les Dresseurs passaient encore directement la sauvegarde personnelle a
`playerPartyToBattleTeam`, contrairement au PvP et au ralliement Coop. Un objet
tenu source ou une capacite pas encore portee pouvait donc interrompre la sequence
apres la marche et le dialogue du PNJ, en particulier chez l'hote Coop. Tous les
combats source utilisent maintenant le meme preparateur tactique : seuls les
elements compatibles sont envoyes a la room, sans exposer le Sac. Le reglement
solo ou autoritaire restaure PV, statut, bonheur et PP par identifiant tout en
conservant dans la sauvegarde les capacites et objets source neutralises. Une
validation locale du message `openSourceBattle` empeche enfin de declarer une
ouverture partagee sur une requete que le protocole refuserait ; le chemin local
reste alors disponible avec un diagnostic explicite au lieu de suspendre la
sequence. Autorite narrative et recompenses restent celles de l'hote.

Correctif visuel PvP du 2026-10-12 : un duel classique ne possede pas de
`SharedBattleParticipation`, contrairement aux combats source rejoignables. La
presentation ne resolvait donc que l'identifiant local et laissait le Dresseur
adverse absent, ce qui activait `trainer000` par defaut. Chaque client projette
desormais son propre profil public au dos et le profil de l'autre joueur de face,
independamment de sa place hote/invite. Le modele `visualPreset` et les couleurs
publiques deja synchronises sont charges par le pipeline de personnalisation
commun ; aucune image, couleur ni identite privee supplementaire n'est repliquee.

Abandon PvP du 2026-10-12 : dans un duel joueur contre joueur, l'action `Fuite`
est remplacee par `Abandon`, avec un ecran de confirmation tactile. Elle reste
disponible tant que le combat est actif, y compris lorsqu'une action du tour a
deja ete soumise. L'intention reseau existante `leaveBattle` prend le sens de
concession sur un duel actif : la room annule les intentions en attente, attribue
autoritairement la victoire au camp adverse, publie un `battleEnded` dans la file
visuelle commune puis place la session en reglement. Une seconde utilisation
apres le resultat ferme le duel comme auparavant. La fuite sauvage et son vote
Coop ne changent pas ; aucun abandon n'est propose contre un PNJ.

Lot global de presentation des combats du 2026-10-12 : les variantes CSS d'abord
ajoutees pour evoquer les familles de `transiciones.rb` ont ete retirees apres
recette, car elles ne reproduisaient ni leurs assets ni leur mise en scene. Deux
references seulement sont maintenant portees depuis les boucles Ruby :
`ebWildAnimationOutdoor`, qui ferme l'image par blocs noirs symetriques en 32
frames, et `ebTrainerAnimation3`, qui fait entrer six bandes noires alternees
derriere des `vsBall` tournantes en 28 frames. Les trois pulsations grises communes
et le devoilement final en 18 frames suivent egalement les temporisations source a
40 FPS. La capture du canvas overworld reste sous les effets jusqu'au noir, puis le
combat deja prepare est revele. Le choix sauvage/Dresseur ne porte aucun etat et
est donc identique en solo, hote et invite.

Toutes les autres transitions (interieur, grotte, eau, sur-niveau, legendaires,
VS et Dresseurs speciaux) sont volontairement reportees apres la consolidation de
l'ensemble des fonctionnalites. Leur futur port doit etendre le meme moteur de
frames et employer les assets et conditions source ; ne pas les recreer par des
approximations CSS.

La file de presentation commune porte maintenant l'efficacite des impacts et la
capture structuree. Elle joue les sons source au moment visible correspondant :
impact normal/resiste/super efficace, cri puis chute K.O., rappel et nouvel envoi,
signal chromatique, seuil d'EXP, lancer/absorption/secousses/chute de Ball et
jingle de capture. Le succes de capture n'est plus annonce deux fois. La musique
de victoire commence avant les textes de defaite, l'EXP et l'argent, puis se fond
a la sortie. Les commandes tactiles jouent aussi decision, retour ou erreur. Le
duel PvP emploie les themes Dresseur au lieu des themes sauvages par defaut.

`NormalizedWorldMap.audio` extrait desormais `@autoplay_bgm`, `@bgm`,
`@autoplay_bgs` et `@bgs`. Le lecteur de scene conserve l'instant de lecture de la
BGM/BGS de carte, les met en pause au debut du combat et les reprend a la fin. Le
volume maitre s'applique au lecteur de carte, aux musiques de combat, aux jingles,
aux sons fixes et aux timings des animations d'attaque. Ce raccord est local et
visuel : aucune musique n'est persistee ni repliquee, chaque client lit les memes
metadonnees de carte et le meme contexte de combat. `prepare:local` doit avoir ete
relance pour enrichir les JSON de cartes existants ; le parseur garde un repli
silencieux pour les anciennes extractions. Validation manuelle encore requise sur
le mixage, la capture, les deux transitions standard et la reprise audio en solo
et Coop ; l'extension aux autres transitions reste un lot de finition distinct.

Decision de validation `STAB-BATTLE-1` du 2026-10-07 : le socle est implemente,
mais le lot ne peut pas etre clos avec le parcours jouable actuel. Les changements
et remplacements multiples dependent d'une acquisition naturelle de plusieurs
Pokemon ; Jean/Sapereau depend des capacites et talents de toute son equipe ; les
combats doubles source et leurs variantes hote/invite dependent des scenes et
regles atteignables. Le statut devient donc `validation partielle suspendue par
dependances`, sans bloquer objets, capture et les lots verticaux de regles de
combat. La recette complete reprendra apres ces dependances.

## Rapport de diagnostic de combat exportable

Jalon du 2026-10-13 : le panneau `Moteur` conserve maintenant un rapport JSON du
combat courant puis du dernier combat termine. Il contient le contexte et l'etat
initial, chaque action avec son camp/emplacement, chaque etat avant/apres un tour, les evenements, la trace exacte du RNG et
des calculs de degats, les remplacements, puis le reglement personnel. Ce dernier
porte les entrees et sorties utiles au calcul d'EXP (adversaires, experience de
base, niveaux, participants, politique de plafond/bonus, gains et niveaux obtenus),
l'argent avant/apres, les objets consommes et la capture eventuelle. Le bouton
`Telecharger le JSON` produit un fichier directement transmissible pour analyse.

Autorite : le noyau local en solo et la room en Coop. La room transmet desormais
la `trace` autoritaire avec `turnResolved`; le client ne recalcule pas les effets.
Domaine et audience : diagnostic personnel du participant, non replique comme un
etat de jeu. Persistance : aucune; seul le combat courant ou le dernier rapport de
la page reste en memoire. Le Sac complet et la sauvegarde ne sont jamais inclus,
seuls les objets effectivement presents dans le snapshot tactique ou le reglement
apparaissent. Une reconnexion commence un rapport depuis le snapshot autoritaire
restaure et y joint le reglement idempotent recu ensuite.

Le panneau n'affiche plus l'inventaire ni l'equipe en une phrase illimitee : ces
deux contenus sont replies par defaut et leur resume indique seulement le nombre
de sortes/objets ou de Pokemon. Les erreurs et le journal courant restent visibles
sans allonger la page.

Recette manuelle : terminer un combat sauvage puis un combat de Dresseur en solo,
telecharger chaque rapport et verifier `turns[].trace`, les etats avant/apres et
`settlements`. Refaire comme hote et invite; les deux rapports doivent partager
les memes tours autoritaires, tandis que chaque reglement conserve seulement les
recompenses de son proprietaire. Tester enfin une capture, une defaite et une fuite.

Complement du 2026-10-13 : `captureAttempted.calculation` conserve desormais le
taux de base, le taux modifie par la Ball, les termes PV, le multiplicateur de
statut, le taux final, le seuil des secousses, le tirage de capture critique et
chaque tirage de secousse. Master Ball et capture automatique par depassement du
taux indiquent explicitement leur motif sans inventer de RNG. Les gains d'EXP
embarquent eux aussi leur formule executee et chaque arrondi intermediaire :
partage entre participants, bonus Dresseur, division par cinq, ajustement de
niveau, interrupteurs de bonus/desactivation, Oeuf Chance et plafond. Le chemin
solo historique `legacy-wild` expose sa formule distincte au lieu de la masquer;
le rapport indique aussi pourquoi aucune EXP n'a ete attribuee lors d'une capture,
une fuite, une defaite ou faute de beneficiaire eligible.

Correctif diagnostic du 2026-10-13 : un rapport sauvage contre Helionceau a mis
en evidence que l'identite `RIVALRY` etait conservee mais encore inerte. Le
calculateur commun applique desormais le comportement reel du Ruby de Z lorsque
les deux combattants ont un genre male ou femelle : 1,25 pour le meme genre et
aucune reduction pour des genres opposes. Cette implementation differe de la regle
Pokemon habituelle et meme de l'estimation de l'IA Ruby, qui emploie 0,75, mais le
calcul de combat source fait autorite. Un genre absent ou asexue reste neutre. La
trace de degats expose separement le talent et son multiplicateur. Le rapport
analyse reste donc correct a 32 degats contre Feunnec male. Autorite : noyau local
en solo et meme noyau dans la room ; etat :
genres publics du snapshot tactique ; persistance et intentions reseau : aucune
donnee nouvelle ; audience : participants via la trace autoritaire.

Audit de conformite des talents du 2026-10-13 : la presence d'un identifiant dans
le type `ImplementedBattleAbility` n'est plus employee seule comme preuve de
support. Une matrice exhaustive doit maintenant contenir une entree pour chaque
talent annonce par le noyau. La comparaison avec les scripts Ruby de Z a corrige
les hooks suivants : `FLORACION` multiplie le degat final Plante, `KEENEYE` bloque
les baisses de Precision et ignore l'Esquive positive de la cible, `STATIC` peut
paralyser apres un contact meme si son porteur vient de tomber K.O., `SYNCHRONIZE`
renvoie aussi Caduco et Hemorragie, et `MAGICGUARD` annule les degats de ligotage
et de Malediction sans figer leur duree. `CHEEKPOUCH` soigne apres toute Baie
consommee par les chemins portes, y compris Payapa et Piqure. `ACOMETIDA` applique
desormais son bonus de Vitesse du premier tour dans le resolveur double comme dans
le simple.

Le rapport de support classe desormais honnetement `CHLOROPHYLL` et `DRYSKIN`
comme partiels tant que le combat ne porte pas un etat meteo tactique complet.
`INTIMIDATE` reste partiel jusqu'aux immunites et interactions source manquantes.
La condition Ruby atypique de `SHIELDDUST` a ete confirmee comme une regle voulue
de cette version : seul le cumul du talent et de `COVERTCLOAK` (Cape Obscure)
bloque les effets secondaires ; chacun reste inerte seul. Cape Obscure est donc
un objet tenu supporte et `SHIELDDUST` redevient pleinement supporte. Les identites
encore partielles restent acceptees et leurs hooks deja portes fonctionnent, mais
elles ne doivent pas gonfler le total « supported ».
Autorite et domaine : snapshot tactique, noyau local en solo et meme noyau dans la
room ; persistance : identite du talent sur le Pokemon, effets temporaires dans le
combat/reconnexion ; intentions reseau : aucune nouvelle ; audience : participants
via les evenements et la trace autoritaires.

Correctif de presentation des talents du 2026-10-13 : les evenements tactiques
continuent de transporter l'identifiant stable (`BIGPECKS`, `KEENEYE`, etc.), mais
le sequenceur de combat resout maintenant leur nom depuis le catalogue francais.
Les protections de statistique utilisent la phrase d'effet de Z au lieu du texte
generique « Le talent X s'active » : Cœur de Coq annonce qu'il empeche la perte de
Defense et Regard Vif la perte de Precision. Cette transformation est seulement
visuelle ; l'autorite, le snapshot, la sauvegarde et les intentions Coop ne changent
pas. Le meme sequenceur couvre le solo et les tours recus de la room.

Correctif Doux Parfum du 2026-10-13 : une equipe de Dresseur a revele la fonction
de capacite `048` encore absente des registres. Le noyau commun reproduit maintenant
le Ruby de Pokemon Z avec `USENEWBATTLEMECHANICS = true` : `SWEETSCENT` baisse
l'Esquive de deux crans. Sa cible source `04` applique le meme effet a chaque
adversaire actif en combat double, avec une seule consommation de PP. Le code est
accepte par la projection d'equipe, le validateur Coop et le rapport de support,
qui compte desormais 56 fonctions pleinement supportees et 4 partielles. Autorite
et domaine : snapshot tactique resolu par le noyau local en solo ou par la room en
Coop ; persistance : niveaux de statistiques temporaires dans le combat et sa
restauration ; intention reseau : choix normal de capacite ; audience : tous les
participants via les evenements autoritaires. L'utilisation de Doux Parfum hors
combat pour provoquer une rencontre reste une mecanique d'overworld distincte et
n'est pas declaree portee par ce correctif.

Correctif EXP Dresseur solo du 2026-10-13 : le controleur local ne passe plus les
victoires de Dresseur dans `settleSourceEncounter`, qui appliquait la formule
historique `legacy-wild` au seul Pokemon actif a la fin. Le solo construit
desormais une participation personnelle `local` et alimente
`createSharedBattleLedger` / `recordSharedBattleTurn` a chaque tour, changements
et remplacements compris. Au reglement, `settleSourceTrainerBattle` reutilise
`sharedBattleOwnerSettlement` puis `applySharedBattleExperience`, exactement comme
la room autoritaire. Les participants encore conscients recoivent donc chacun leur
part, le diviseur couvre tout le camp engage et le bonus Dresseur x1,5 ainsi que
les interrupteurs de progression sont appliques. Le rapport JSON expose une liste
`experiences` avec la formule `pokemon-z-participant` et tous ses arrondis ; pour
le combat Remi/Fluvetin analyse, Feunnec doit recevoir 142 EXP au lieu des 143 de
la formule sauvage. Autorite : noyau local en solo, room en Coop ; domaine et
persistance : progression personnelle appliquee a la sauvegarde apres reglement ;
intentions reseau : aucune nouvelle ; audience : proprietaire pour la progression,
participants pour la presentation tactique. Les combats sauvages conservent pour
ce lot leur chemin `legacy-wild` afin de ne pas modifier leur progression sans un
audit dedie.

## Garde-fou des donnees locales

Jalon du 2026-10-09 : `prepare:local` ecrit desormais
`local-data-manifest.json` en dernier, apres toutes les extractions. Ce manifeste
versionne contient la version du schema, sa date de generation et la liste des
fichiers reellement produits. La preparation refuse de certifier un lot auquel il
manque un catalogue requis par le moteur.

L'overworld valide ce manifeste avant la nouvelle partie, la reprise d'une
sauvegarde et chaque chargement de carte. Une extraction ancienne ou incomplete
n'aboutit plus a un canvas silencieusement bloque : une vue d'erreur nomme les
fichiers manquants, affiche `corepack pnpm prepare:local` et permet de reessayer
sans recharger la page. La nouvelle tentative purge aussi les promesses de donnees
et d'images precedemment rejetees. Le contrat partage et ses tests couvrent en
particulier `machines.json`, dont l'ajout au moteur avait rendu les extractions du
2 octobre incompatibles avec le code du 8 octobre. Un favicon SVG explicite retire
egalement le 404 sans rapport avec le jeu qui brouillait la console.

Autorite et Coop : ce garde-fou est strictement local au client et ne porte aucun
etat de jeu. Il ne modifie ni la room, ni la persistance, ni la replication ; hote
et invite valident chacun leur propre extraction avant de charger leurs assets.

Complement multi-postes du meme jalon : la configuration decouvrable vit maintenant
dans `.pokemon-z/local-test.json`, independamment du dossier d'extraction. Elle
contient `sourceDirectory` et `dataDirectory`, tous deux propres au poste et ignores
par Git. Le serveur Vite ne suppose donc plus que les donnees se trouvent dans
`.pokemon-z/data`. Le premier lancement de chaque collegue utilise `--source` et
`--output`, puis `corepack pnpm prepare:local` reutilise ses chemins personnels.
L'ancien `.pokemon-z/data/local-test.json` est encore lu comme format de migration.
Sans aucune configuration, les routes locales repondent explicitement HTTP 503 et
l'interface affiche la commande d'initialisation complete au lieu d'une erreur JSON.

## Jalon finition overworld du 2026-10-12

Correctif des seuils de grotte du 2026-10-13 : avancer sur une page source de
contact contenant `pbCaveEntrance` ou `pbCaveExit` ne reste plus bloque avant son
transfert. Ces deux hooks Ruby standard sont absorbes generiquement comme
presentation de transition ; les tons, attentes et commandes de transfert qui les
encadrent dans l'evenement continuent d'etre lus dans l'ordre par le sequenceur.
Cela couvre les 62 entrees et 48 sorties presentes dans l'extraction, notamment le
seuil Route 2 vers Grotte Navarre, sans exception de carte, de coordonnee ou
d'evenement. Le clic d'interaction n'est donc plus necessaire pour contourner le
lecteur : le contact en avancant suit le chemin normal.

Autorite et Coop : le transfert reste une intention de deplacement du joueur
concerne ; le solo et l'hote executent la sequence normale, tandis que l'invite
emploie le contrat de transfert personnel deja existant. Aucun nouvel etat n'est
persiste ou replique et l'audience reste le joueur qui franchit le seuil. Dette
explicite : l'animation Ruby en bandes de `pbCaveEntranceEx` et le point de retour
utilise par une future Corde Sortie ne sont pas portes par ce correctif ; ils ne
sont pas inventes par le `runtime-noop`.

Premier lot de reprise narrative apres la Grotte Navarre du 2026-10-13 : les
references d'objet Ruby `:ITEM` et `PBItems::ITEM` sont maintenant normalisees par
le meme porteur pour `pbReceiveItem`, `pbItemBall`, `pbStoreItem` et
`pbDeleteItem`, avec quantite optionnelle strictement positive. La casse de
l'identifiant source est preservee afin de rester compatible avec les noms mixtes
du catalogue, par exemple `ACapsula` et `Cenizas`. Les conditions
`$PokemonBag.pbQuantity(...)` acceptent les six comparateurs `<`, `<=`, `==`,
`!=`, `>=` et `>` ainsi qu'un seuil entier positif ou nul. Le deverrouillage de
test des mouvements est applique comme une possession virtuelle avant la meme
comparaison, sans branche speciale `> 0`.

Ce lot rend executables le don de `POLVOBRILLANTE` et `BRASACANDENTE` ainsi que
leurs branches de recuperation `< 1` sur Map016. L'effacement temporaire du rocher
et sa rencontre aleatoire restent les etapes suivantes de l'ordre valide.
Autorite et Coop : les
mutations et lectures du Sac restent personnelles et persistantes dans
`SourceEventState.inventory`; le monde partage ne replique pas le contenu du Sac.
La narration demeure sous l'autorite de l'hote et ne recoit que le resultat de la
condition necessaire a son branchement. L'invite en excursion reutilise exactement
le meme noyau local, sans seconde implementation de l'inventaire.

Deuxieme lot de reprise narrative du 2026-10-13 : l'Alchimie est integree comme
rubrique du menu en jeu. L'extracteur lit declarativement `RECETAS_CRAFTEO` et les
blocs `stock.push` sans executer Ruby, puis produit `alchemy-recipes.json`. Les 50
recettes de la source sont conservees avec niveau de deblocage, resultat,
ingredients et quantites ; le fichier fait partie du manifeste local obligatoire,
donc une extraction ancienne demande `corepack pnpm prepare:local`.

Le noyau `source-alchemy.ts` valide le catalogue et realise une transaction
atomique : recette connue et debloquee, quantite entiere, ingredients suffisants
et resultat sous la limite de 999 objets sont tous controles avant la moindre
mutation. Le menu affiche uniquement les recettes apprises, les noms et icones du
catalogue d'objets, les quantites possedees/requises et le maximum fabricable. La
fabrication de `POLVOEXPLOSIVO` devient ainsi disponible des que Map016 place la
variable 926 a 3 et remet les deux ingredients.

Finition visuelle apres controle du 2026-10-13 : l'entree du menu utilise les
assets source `crafteoA.png` et `crafteoB.png`, avec la meme bascule et la meme
animation active que les autres rubriques. L'atelier reutilise egalement
`Crafting/bg.png`, `menu_craft.png` et les deux `seleccionador*.png` pour son fond
et ses recettes, tout en conservant la disposition responsive et les cibles
tactiles du menu web. Aucun asset source n'est ajoute a Git.

Le grimoire a ensuite ete ferme sans defilement interne : cinq recettes occupent
la page gauche et des boutons precedent/suivant changent de feuillet avec une
courte animation 3D, neutralisee par `prefers-reduced-motion`. La page droite
reste fixe, compacte les controles de quantite et affiche la description francaise
de l'objet produit. Le cas complet de 50 recettes donne dix feuillets ; les rendus
bureau et telephone ont ete controles sans debordement de la page de details.
Le selecteur de fabrication possede son propre composant visuel : `Max` reste dans
l'entete de l'encart, les pas `-10/-1/+1/+10` encadrent la quantite sur une seule
ligne bornee, puis l'action principale occupe seule la ligne suivante. Cette
structure remplace le selecteur generique du Sac qui se chevauchait dans la page
etroite ; elle a ete verifiee avec une limite fabricable de 99 sur les deux formats.

Autorite et Coop : le niveau de recette appartient a la narration de l'hote et est
lu depuis son snapshot par l'invite present ; ingredients, resultat et transaction
restent personnels, persistants et absents du protocole. Une reconnexion restaure
le Sac local puis relit le niveau narratif partage. L'invite en excursion utilise
ses variables et son Sac locaux. L'audience de l'interface et de son resultat est
le seul joueur concerne.

La reprise des cinq lots d'effets overworld a commencé par une capacité générique
`source-field-effects.ts`, sans exception liée à une carte ou un événement. Elle
lit les terrains et le bit buisson du tileset, puis produit les règles de rendu et
les retours de déplacement. `drawImportedMap` applique désormais la profondeur de
buisson source de 12 px, les deux bandes terminales translucides, les reflets sur
StillWater/Puddle/LagoReflejo et les exclusions d'ombre (buisson, Surf, Plongée,
événements lumineux). Ces règles couvrent joueur, PNJ, suiveur et avatar distant.

Les dialogues jouent les sons de décision/annulation, l'herbe joue
`se_step_run_grass`, la corniche joue `jump` puis l'animation Dust n°2, y compris
la poussière visible d'un avatar distant. Une collision tente `bump` avec une
limite de 250 ms ; cet ancien SE RTP n'est pas présent dans le manifeste local de
Z et doit donc rester silencieux plutôt que d'être remplacé arbitrairement. Le
résolveur audio est insensible à la casse et essaie les autres extensions du même
nom lorsqu'une commande cite un `.ogg` absent mais que Z fournit un `.wav` ou un
`.mp3`. Cela couvre notamment les sons de portes observés en 404.

Le premier système persistant de pas est également porté : `happinessSteps` migre
les anciennes sauvegardes à zéro et déclenche tous les 128 pas le tirage de bonheur
individuel de Z, avec lieu d'obtention, Luxe Ball et Grelot Zen. Autorité : joueur
propriétaire ; domaine : équipe personnelle ; persistance : sauvegarde locale ;
réplication : aucune mutation narrative, l'équipe mise à jour ne voyage que par
les contrats de combat existants ; audience : propriétaire uniquement. Cette
règle s'exécute donc pareil en solo, chez l'hôte et chez l'invité, sans dépendre de
l'histoire de l'hôte. Le poison de terrain n'est pas porté car Z fixe
`POISONINFIELD = false`.

Les lots 3 à 5 restent partiels. Surf/Plongée/Cascade, portes, météo, brouillard,
panoramas, tons, flashes et animations de carte existaient déjà et utilisent le
même socle. Les sillages doivent être validés visuellement. Les lumières et les
treize familles du Particle Engine exigent d'abord l'extraction des commentaires
`Particle Engine Type`, actuellement absents des événements JSON. Poké Radar,
baies, suie et capacités de terrain attendent encore leurs contrats d'état. Ne pas
simuler ces métadonnées par numéro d'événement. Le détail et la recette sont dans
la section 9.7 de `docs/ROADMAP.md`.

Correctif de recette Coop associé : `SourceNpcMotionController` conserve une
interpolation distante déjà commencée lorsque le paquet `idle` final arrive, et
les coordonnées de `SourceSceneActorSnapshot` viennent désormais de la pose
animée, pas de la position initiale de l'événement. À l'entrée d'une carte,
l'invité réapplique toujours `world.actors` après le reset local. Les snapshots
reçus pendant son chargement sont différés ; un ancien état `shared` d'une autre
carte est rejeté pendant l'excursion. Ne pas retirer ce garde-fou : sans lui, une
réponse réseau peut recharger la carte précédente et obliger à franchir le seuil
une seconde fois.

Les traces de terrain sont des `SourceFieldMark` de 1,5 seconde, produites depuis
le mouvement partagé et les tags du tileset. Sable utilise `footset.png` ou
`footsetbike.png` selon le mode ; StillWater, Water et LagoReflejo utilisent les
huit frames de `waterpondbubble.png` selon la cadence du script Z. Le joueur local
et le joueur distant créent les mêmes marques côté affichage. Elles ne font pas
partie de la sauvegarde ni du snapshot. Les sons distants de saut, collision et
herbe sont dérivés du mouvement autoritaire avec atténuation selon la distance.
Les commandes `play-sound` utilisent désormais une intention réseau éphémère
`emitSourceSound` dans les deux sens. La room vérifie que l'émetteur et le
destinataire sont présents sur la même carte partagée, puis transmet uniquement
le nom, le volume et le pitch au partenaire. Le client destinataire applique
l'atténuation selon la distance. Autorité : room pour l'audience, joueur local
pour le déclenchement ; domaine : présentation seulement ; persistance et
restauration : aucune ; audience : autre participant sur la même carte. Le son
n'est donc ni stocké dans le snapshot, ni rejoué après reconnexion. Les BGM, BGS
et sons d'interface/dialogue personnels ne passent pas par ce contrat.

Les options audio ne reposent plus sur un volume global. Trois canaux locaux et
persistants sont exposés dans le menu : `Musiques` pour BGM/BGS/ME, `Effets` pour
SE, cris, interface et animations locales, et `Effets Coop` pour les SE provenant
du partenaire (déplacement et `emitSourceSound`). L'atténuation spatiale Coop est
appliquée avant ce dernier volume. Les anciennes installations migrent les trois
curseurs depuis `pokemon-z-battle.options.volume.v1`; chaque canal possède ensuite
sa propre clé `pokemon-z-battle.options.*-volume.v1`. Les changements s'appliquent
à chaud aux scènes, combats, évolutions et cris de fiche déjà en cours. Autorité
et persistance : préférences strictement personnelles dans le `localStorage` de
chaque navigateur ; aucune préférence audio n'est envoyée à la room.
Les interfaces hors combat (menu principal, Sac, équipe, Ranch, résumé, boutique,
progression, prologue et fenêtres Coop) utilisent une délégation d'événements en
phase capture pour jouer `Select`, `Choose` ou `BW2Cancel` selon navigation,
validation ou fermeture. Ne pas ajouter un second son dans chaque vue : cette
délégation couvre aussi les boutons recréés dynamiquement après un rendu.

Le premier écran Pokédex est raccordé au menu principal. Il réutilise une grille
paginée de 12 espèces avec recherche nom/numéro, filtres cumulables de deux types,
statut et tri. La progression compte les espèces obtenues sur le catalogue extrait
et les cartes indiquent : inconnue, vue, obtenue, présente dans l'équipe, présente
au Ranch, espèce ayant déjà évolué ou espèce relâchée. Les sprites à deux frames
restent animés. La page `Zones de capture` est désormais active dans chaque fiche
vue et utilise le catalogue régional partagé décrit ci-dessous.

Jalon UI Pokédex/Ranch du 2026-10-12 : tous les filtres sont désormais appliqués
immédiatement (`input` pour la recherche, `change` pour les listes) et seul le
bouton `Réinitialiser` demeure. Les deux champs numériques de numéro et les seuils
de puissance actuels ont été retirés du Ranch. Le potentiel correspond exclusivement
à la somme des six statistiques de base et emploie un contrat commun de six paliers :
`0–299`, `300–399`, `400–449`, `450–499`, `500–599`, puis `600+`. Lorsqu'un palier
est actif, sa valeur exacte et son libellé sont affichés sur les cartes du Ranch et
du Pokédex. Le Ranch ajoute deux seuils indépendants, calculés sur la moyenne des
six valeurs : qualité IV et entraînement EV, chacun présenté avec une à quatre
étoiles. Ne pas fusionner ces deux mesures : leurs échelles et leurs seuils sont
différents.

Une fiche générale interne s'ouvre depuis toute espèce vue dans le Pokédex. Une
espèce seulement observée reste en silhouette ; sa capture débloque catégorie,
taille, poids, types, empreinte, statistiques de base, potentiel, talents et
évolutions suivantes. La présentation réutilise désormais la structure visuelle
de la fiche Équipe/Ranch et la même boucle canvas à 120 ms pour les battlers multi-
frames. Les descriptions françaises proviennent de la catégorie `pokedexEntries`
de `localization.json`, elle-même extraite de `Data/french.dat`.

Les icônes du menu utilisent les images locales de `Graphics/Pictures/DP Pause
Menu` par URL servie ; aucun asset source n'est copié ou ajouté à Git. Le contrat
source est reproduit : variante grise `A` au repos, variante colorée `B` pour la
rubrique active et oscillation de -12 à +12 degrés. Sac et Sauvegarde choisissent
`Bf` ou `Bm` selon la morphologie du profil local. Toutes les rubriques actuellement
affichées possèdent leur variante colorée dans le jeu source.

Correctif UI du 2026-10-12 : le sélecteur de composition racine est limité à
`body > main`. Ne jamais réélargir ce sélecteur à toutes les balises `main` : la
première fiche Pokédex utilisait une balise `main` interne et héritait alors de
`width: fit-content` ainsi que des colonnes de l'application, ce qui contractait
et superposait toutes ses cartes. La colonne de contenu de la fiche est désormais
une `section` et occupe toute la seconde colonne de `.source-summary-layout`.

Validation manuelle du 2026-10-12 : le porteur a controle et valide le Pokedex et
son interface. Les zones de capture ont été ajoutées avec le premier lot Carte du
2026-10-13 et restent à valider visuellement par le porteur.

Premier lot Carte du 2026-10-13 : l'extracteur produit `region-map.json` depuis
`PBS/townmap.txt` et ajoute `mapPosition` aux entrées de
`map-battle-metadata.json`. Le chargeur compose ces données avec `map-infos.json`
et `encounters.json` dans `SourceRegionMapCatalog`. L'héritage par parent RPG Maker
donne notamment à Map010 la position régionale `{ region: 0, x: 18, y: 13 }` de
Map009, au lieu d'un faux point 0,0. Le catalogue local contrôlé contient une
région, 176 points, 33 destinations de Vol et 524 espèces présentes dans au moins
une table de rencontres.

L'onglet `Carte` du menu emploie l'icône source `DP Pause Menu/rider.png`,
`mapRegion0.png`, `mapCursor.png` et la variante `mapPlayer000/001.png` adaptée à
la morphologie directement depuis le jeu local. Les repères sont sélectionnables
et exposent nom et description lorsqu'elle existe. Ce premier état ne déclenchait
aucun Vol ; le raccord de test décrit plus bas lui a succédé le même jour. La fiche
Pokédex propose maintenant `Informations` et `Zones de capture` ;
la seconde projette toutes les méthodes de rencontre de l'espèce sur le même
quadrillage 30 x 20, comme `PokemonNestMapScene` dans le Ruby source.

Contrat solo/Coop : le catalogue et les habitats sont statiques. La consultation
reste personnelle ; seule la carte régionale courante de chaque participant est
répliquée dans `regionalMapIds`. Le Vol de test appelle le noyau de transfert : en
solo il reste local, l'hôte publie ensuite le monde partagé autoritaire, et
l'invité poursuit ou rejoint son excursion selon la politique existante. Les
destinations visitées du futur déblocage normal seront un état personnel persistant
et ne devront jamais être déduites des 33 destinations extraites.

Ajustement visuel Carte du 2026-10-13 : la composition suit désormais la maquette
large validée par le porteur, avec la carte presque pleine largeur, la fiche du
lieu en bandeau inférieur et un fond aérien clair construit en CSS. Le nom du lieu
sélectionné est aussi repris dans la pastille d'en-tête. Sur les 172 points nommés
de `townmap.txt`, seuls 23 possèdent réellement une description ; la fiche omet
donc entièrement la ligne descriptive pour les 149 autres au lieu d'afficher un
texte de remplacement. Les coordonnées techniques, l'état de destination de Vol
et la légende ont été retirés de cette vue joueur, mais restent disponibles dans
le catalogue pour les futurs consommateurs.

Raccord de localisation Carte du 2026-10-13 : `SourceRegionMapCatalog` applique
désormais `regionNames`, `placeNames` et `placeDescriptions` depuis
`localization.json`, donc selon la priorité existante `french.dat` puis données
source. Le catalogue local couvre en français les 172 points nommés (89 noms
uniques) et les 23 descriptions renseignées (21 uniques). En cas de traduction
absente, le texte source reste le repli générique. Cette composition unique est
partagée par la Carte, le mode Vol et les habitats du Pokédex.

Raccord Boussole du 2026-10-13 : l'analyse de
`204-87933021-cartelespokemon.rb` confirme que l'objet source `DEXNAV` ouvre
`EncounterListUI`. Cette vue fusionne toutes les méthodes de rencontre de la
carte, déduplique les espèces, les trie par numéro et masque en silhouette celles
que le joueur n'a jamais possédées. Le port reproduit ce contrat dans
`source-compass.ts` et conserve désormais toutes les méthodes dans
`ImportedEncounterTable` au lieu de la seule table `Land` utilisée par les pas.
Le bouton emploie l'asset source `DP Pause Menu/radar.png`, reste discret en haut
à droite de l'overworld et n'apparaît que si l'inventaire contient `DEXNAV`.

Autorité et Coop de la Boussole : consultation strictement personnelle, fondée
sur le catalogue statique de la carte et `SourceEventState.pokedex` local. Elle ne
change ni le tirage de rencontre ni le monde, n'envoie aucune intention réseau et
n'ajoute aucune persistance : l'objet et l'historique Pokédex sont déjà restaurés
par la sauvegarde personnelle. Son audience est uniquement le joueur concerné ;
l'ouverture bloque ses entrées d'overworld via `SourceSceneCoordinator`, sans
interrompre ni répliquer l'activité de l'autre participant.

Raccord Vol de test du 2026-10-13 : le bypass `Tous les déplacements` expose
désormais une capacité `fly`, distincte des `SourceMovementMode`. Depuis une carte
extérieure, l'onglet Carte bascule explicitement entre `Consultation` et `Vol` ;
les 33 destinations extraites deviennent alors sélectionnables. Un clic joue un
fondu blanc local, ferme le menu au blanc plein, puis emprunte
`followSourceTransfer` avant de révéler l'overworld d'arrivée. Aucune destination
n'est inscrite comme visitée : le vrai déblocage narratif et sa persistance restent
à raccorder ultérieurement.

Le même lot rend la présence régionale Coop explicite. `SourceWorldSnapshot`
porte `regionalMapIds` pour l'hôte et l'invité ; l'hôte met à jour sa carte via la
publication autoritaire du monde, tandis que l'invité transmet seulement son
`mapId` avec `setSourcePresence`, y compris pendant une excursion personnelle.
La room valide la carte de rattachement, persiste ces deux identifiants et les
restaure avec un fallback compatible pour les anciennes rooms. La Carte affiche
ainsi deux marqueurs et deux couleurs (cyan hôte, magenta invité), même lorsque
leurs positions régionales diffèrent. Les coordonnées internes de l'excursion de
l'invité restent privées et ne sont jamais répliquées.

Contrat d'état : `SourceEventState.pokedex` est personnel, persistant dans
`pokemon-z-battle.source-event-state.v1`, restauré après reconnexion et absent du
protocole Coop. Les combats solo et autoritaires enregistrent les adversaires vus
du point de vue local. La sauvegarde réconcilie automatiquement équipe et Ranch
pour couvrir cadeaux, captures et outils de test. Les évolutions par objet et par
progression enregistrent l'espèce d'origine dans `evolvedSpecies`. La migration
des anciennes sauvegardes sait uniquement déduire les espèces encore possédées ;
elle n'invente ni évolution ni libération passée. L'action Ranch `Relâcher`
alimente maintenant `recordSourcePokedexRelease` après confirmation et restitue
atomiquement l'objet tenu au Sac. Aucun lieu de capture n'est inventé avant le
module Carte.

Correctif de stabilité des transferts Coop du 2026-10-13 : les snapshots du monde
source sont maintenant différés pour l'hôte comme pour l'invité pendant tout
chargement de carte. À la fin d'un transfert local de l'hôte, un snapshot encore
attaché à la carte de départ est jeté au lieu d'être rechargé et republié. Ce
garde-fou casse la boucle intérieur/extérieur qui faisait clignoter les deux
clients, relançait alternativement leurs événements et survivait à une
actualisation via l'état autoritaire de la room. `room-server-core` tolère aussi
explicitement une room vivante ou persistée antérieure à `regionalMapIds` lors de
la première publication ou mise à jour de présence. La politique pure est couverte
dans `source-coop-policy.test.ts`; le transfert reste local en solo, autoritaire
côté hôte, et l'invité consomme toujours le dernier snapshot différé de l'hôte.

Lot de stabilisation Coop du 2026-10-13, en attente de recette manuelle à deux
navigateurs : trois régressions sont corrigées sans créer de chemin métier
distinct. Premièrement, l'hôte reste l'unique audience des contacts narratifs de
PNJ ; l'invité conserve sa collision physique et reçoit seulement la présentation
partagée. Deuxièmement, le bouton Sauvegarde de l'invité persiste son équipe, son
Ranch, son Sac, son argent et ses autres états personnels, mais conserve les
coordonnées et le mode de sa dernière sauvegarde solo. Sans sauvegarde antérieure,
la reprise utilise le point initial Map003 28,15 ; une position ou un checkpoint
obtenu temporairement dans le monde de l'hôte n'est jamais adopté implicitement.
Le menu annonce explicitement ce mode `progression personnelle`.

Troisièmement, les mises à jour `sourceActorsUpdated` utilisent leur
`actorRevision` dédiée et non la révision globale de room. Les handlers WebSocket
du Durable Object mutent l'état avant d'attendre la persistance ; une publication
de déplacement invité plus récente peut donc être diffusée avant une publication
de PNJ démarrée plus tôt. Le client conserve le maximum de révision globale, mais
accepte ce paquet PNJ tant que sa révision d'acteurs n'est pas périmée. Une
révision d'acteurs égale reste applicable, car le snapshot peut avoir actualisé le
cache avant que les poses aient été installées. Le test réseau reproduit l'ordre
`PNJ rev4 -> déplacement invité rev5 -> livraison PNJ rev4` et protège ce cas.
Lorsqu'un nouvel instantané arrive pendant
une interpolation, le PNJ repart de sa pose réellement affichée et ajuste la durée
à la distance restante au lieu de sauter depuis son ancienne case logique. Cette
règle couvre les PNJ et Pokémon de terrain rendus comme acteurs source ; l'hôte et
la room restent autoritaires, les invités n'exécutent aucune IA locale. Tests
ajoutés : invité bloquant mais non narratif, sauvegarde personnelle sans déplacement
du point de reprise, repli sans sauvegarde, concurrence déplacement/PNJ et correction
d'une trajectoire réseau en cours. Les trois fiches de `docs/Débug/Bug` portent la
recette manuelle restante.

Correctif de présentation de combat Coop du 2026-10-13, issu du rapport
`ZENSD5-1` : le règlement autoritaire était correct (BUNNELBY à 0 PV au tour 1 et
crédits d'EXP affectés au bon identifiant), mais la vue perdait l'identité du
bénéficiaire. Chaque présentation d'EXP transporte maintenant `pokemonId`. La
jauge principale ne s'anime que si cet identifiant occupe réellement son slot ;
un Pokémon remplacé conserve son message d'EXP sans faire progresser la jauge du
Pokémon actif. Plusieurs crédits successifs du même Pokémon utilisent des segments
contigus au lieu de rejouer chacun la progression cumulée complète. Enfin, après
un rerendu asynchrone (extension en double ou changement de composition), les
classes K.O. sont réappliquées immédiatement après le nettoyage des sprites : un
adversaire vaincu ne peut plus réapparaître en fondu pendant le chargement de son
image.

Raccord Pokévial du 2026-10-14 : le noyau `source-poke-vial.ts` reproduit le
contrat de `200-37313625-pokevial.rb` et du menu amélioré source. La possession de
`POKEVIAL` révèle dans l'en-tête de l'Équipe un bouton utilisant l'asset officiel
`Graphics/Pictures/DP Pause Menu/vial.png`, avec compteur courant/maximal et une
confirmation intégrée. Une utilisation restaure PV, statuts et PP de toute
l'équipe puis consomme exactement une charge. Les anciennes sauvegardes qui
possèdent déjà l'objet sans compteurs migrent vers `1/1`; les améliorations source
de la variable 239 restent compatibles jusqu'au plafond de cinq soins.

La recharge exacte `variable 238 = variable 239` des Centres Pokémon est portée
en commande générique `refill-poke-vial`, déclarée dans le registre et auditée
comme effet personnel. L'état typé `pokeVial` reste synchronisé avec les variables
historiques 238/239 pour les événements source, mais ces deux variables sont
retirées de `SourceStorySnapshot`. En Coop, chaque joueur conserve donc ses
charges dans sa sauvegarde personnelle, l'invité peut recharger son propre vial
au Centre, et aucun clic, soin ni compteur n'est envoyé à la room ou présenté à
l'autre participant. Le comportement solo, la migration, la consommation, la
recharge, le port de commande et l'isolation narrative sont couverts par tests.

Pension, premier jalon du 2026-10-15 : `source-day-care.ts` est le noyau métier
partagé par tous les contextes. Son état versionné vit dans `SourceEventState`
avec deux places, niveau initial, futur compteur d'Œuf et drapeau d'Œuf prêt. Une
ancienne sauvegarde migre vers une Pension vide ; les identifiants Pokémon sont
validés sans doublon avec l'Équipe et le Ranch. Chaque pas local attribue 1 EXP
aux pensionnaires via `grantPokemonExperience`. Le dépôt gratuit soigne le
Pokémon, le retrait facture `(gain de niveaux + 1) × 100 ₽`, et l'échange remplace
un membre de l'équipe dans une transaction unique. Le dernier Pokémon conscient
non-Œuf ne peut pas être déposé.

`SourceDayCareView` emploie le nouveau cadre responsive générique
`source-pokemon-facility-view.ts` : équipe, deux slots, roue Déposer/Analyser/
Récupérer/Échanger, prix et diagnostic d'évolution/capacités. Les pages contenant
la famille source `pbDayCare*` deviennent la commande auditée `open-day-care`,
sans dépendre d'un numéro de carte ou d'événement. Elles sont classées service
personnel pour qu'un invité Coop ouvre et modifie uniquement sa Pension. Test dev
offre aussi « Ouvrir la Pension Pokémon ». La compatibilité de couple est
informatrice ; la génération d'Œuf et l'Incubateur à six places restent le lot
suivant. Le schéma les anticipe afin d'éviter une migration supplémentaire.
Après validation visuelle, le cadre de Pension a été réaligné sur la structure
réelle du Ranch : mêmes classes de workspace, en-tête compact, barre
Équipe/Stockage, colonne de six places et cartes Pokémon. Seuls le thème, les deux
emplacements et les informations métier varient. Le genre est explicitement mis
en évidence par `♂`, `♀` ou `◇` dans l'équipe, chaque pensionnaire et l'analyse.
Le thème propre à la Pension utilise `Graphics/Pension.png`, une séparation
diagonale rose/bleu commune au fond, à l'en-tête et à la barre de sections, ainsi
que deux halos lumineux animés lentement. La structure et les dimensions restent
celles du Ranch ; le fond peut être remplacé sous le même nom sans modifier le
code.

Correction visuelle et interactive Pension du 2026-10-15 : cliquer sur une place
vide arme désormais explicitement cette place, met l'équipe en mode sélection et
le clic suivant sur un membre effectue le dépôt. Le parcours inverse (membre puis
place, ou roue d'action) reste disponible. Les cartes de l'équipe et des
pensionnaires n'appliquent plus de fond opaque dans cette vue. Chaque pensionnaire
affiche nom, niveau et genre avec le battler frontal animé utilisé par le résumé,
y compris ses variantes de forme, de genre et chromatique. `Pension.png` est
visible sous le workspace ; le voile rose/bleu est un dégradé large et animé qui
se déplace le long de la diagonale, sans rupture centrale franche. La préférence
de réduction des animations fige proprement le fond et les sprites.
Les opérations payantes ne sont jamais appliquées au premier clic : Récupérer
ouvre une confirmation avec pensionnaire, prix et solde restant ; Échanger attend
le choix du membre de l'équipe puis présente les deux Pokémon avec le même détail
financier. Annuler ferme la confirmation sans mutation ni écriture de sauvegarde.

Outils de test du 2026-10-15 : le sélecteur « Donner un Pokémon » est désormais
contraint par la largeur réelle de la colonne du menu. Filtres, cartes, pagination
et formulaire restent dans le cadre sur petit écran, avec deux cartes par ligne
tant que l'espace le permet puis une seule sur téléphone étroit. Le formulaire
permet aussi de choisir le genre avant création. Les choix sont dérivés du taux
de l'espèce : aléatoire/mâle/femelle pour une espèce mixte, ou valeur unique et
verrouillée pour une espèce exclusivement mâle, exclusivement femelle ou sans
genre. La valeur est écrite dans `PersistentPokemon.metadata.gender` et suit donc
le même état personnel persistant que le Pokémon dans l'Équipe, le Ranch et la
Pension ; aucun état Coop partagé supplémentaire n'est créé.

Reproduction Pension, lot 1/6 du 2026-10-15 : `source-day-care.ts` est maintenant
l'unique noyau de compatibilité et de génération. Il reproduit le score 0 à 3 de
`pbDayCareGetCompat`, les probabilités `[0,20,50,70]` ou `[0,40,80,88]` avec le
Charme Ovale, et le cycle de 256 pas. Le RNG personnel est persisté dans le schéma
Pension 2 ; lorsqu'un tirage réussit, le Pokémon-Œuf complet est créé et conservé
dans `pendingEgg`. Recharger la partie ne peut donc pas relancer ses propriétés.
Les sauvegardes Pension 1 migrent sans perdre leurs deux pensionnaires.

La génération porte les bébés/encens, Métamorph, Phione, les couples Nidoran et
Muciole/Lumivole, les trois formes héritées du Ruby, les capacités initiales,
naturelles et Œuf, Électacle, IV et objets Pouvoir/Nœud Destin, Pierre Stase,
talent, Ball maternelle, Charme Chroma et Pokérus. `PlayerCreationCatalog` expose
désormais `eggMoves` et `stepsToHatch` depuis les données déjà extraites. La
langue d'origine n'étant pas persistée, les cinq relances Masuda ne sont pas
inventées ; l'absence d'état Pokémon obscur reste la seconde limite connue.

Contrat solo/Coop : autorité locale du propriétaire, état `PLAYER_STATE`,
persistance dans `SourceEventState`, aucune intention ni réplication room et
audience privée. Les pas de l'hôte comme ceux de l'invité appellent le même noyau
sur leur propre sauvegarde.

Reproduction Pension, lot 2/6 du 2026-10-15 : le compilateur distingue maintenant
le gardien des Œufs par la présence fonctionnelle de `pbDayCareGenerateEgg`, sans
numéro de carte ou d'événement, puis émet `open-day-care-eggs`. Cette commande est
enregistrée, auditée et classée `PERSONAL`. Son écran privé présente l'état du
couple ou un Œuf dont l'espèce reste cachée, avec quatre issues préparées : équipe,
Incubateur (désactivé jusqu'au lot 3), laisser en attente et refus définitif avec
double confirmation. La récupération et le refus utilisent le noyau partagé
`source-day-care.ts`; une équipe pleine échoue sans mutation et le Pokédex ignore
les Pokémon dont `eggSteps` est positif.

Tant qu'un Œuf est prêt, retrait et échange d'un parent sont bloqués dans le noyau
et signalés dans l'UI de Pension. Autorité locale du propriétaire, persistance
`SourceEventState`, audience privée et aucune réplication room : le même chemin
fonctionne en solo, hôte et invité, y compris après rechargement/reconnexion. Le
prochain lot est l'Incubateur personnel à six places et son accès par l'objet.

Reproduction Pension, lot 3/6 du 2026-10-15 : `source-incubator.ts` porte le
schéma personnel de six cases et les transactions atomiques avec l'équipe, le
Ranch et `dayCare.pendingEgg`. L'ancien script source a été relu : l'accès vient
de l'objet `INCUBADORA` (ou du switch source 129), l'écran comporte six cases en
3 × 2, affiche `eggSteps` et quatre textes aux seuils 10 200, 2 550 et 1 275.
`SourceIncubatorView` reproduit ce contrat dans le canvas responsive, avec
confirmations avant chaque transfert. Le gardien des Œufs active désormais sa
destination Incubateur lorsqu'une case est libre.

Les Œufs présents dans l'équipe ou le Ranch utilisent l'icône `iconEgg`, le nom
générique « Œuf » et ne publient ni espèce, type, capacités, potentiel, résumé ni
entrée Pokédex. Autorité locale du propriétaire, persistance `SourceEventState`,
audience privée, aucune intention réseau : solo, hôte, invité et reconnexion
emploient exactement le même noyau. Le lot 4 doit décrémenter les pas des Œufs de
l'équipe et de l'Incubateur, appliquer Corps Ardent/Armumagma puis mettre en file
les éclosions sans ouvrir plusieurs scènes simultanément.

Outil de test Pension du 2026-10-15 : `Test dev > Services Pokémon` propose
désormais « TP devant la Pension ». Il emprunte le transfert générique du monde
vers la Route 5, Map056 en 30,15, soit la destination exacte de la porte source.
Il ne modifie aucun switch, événement ou état narratif. En Coop, l'hôte publie
normalement son changement de carte et l'invité conserve le comportement
d'excursion personnelle déjà porté par `followSourceTransfer`.

Reproduction Pension, lots 4-6/6 du 2026-10-15 : `source-egg-incubation.ts`
décrémente les Œufs de l'équipe et de l'Incubateur à chaque pas local terminé,
avec le second point source fourni par Corps Ardent ou Armumagma. Ranch et Œuf
non récupéré ne progressent pas. `SourceEventState.pendingHatches` est une file
personnelle persistante : un compteur arrivé à terme reste opaque à 1 jusqu'à sa
scène, reprend après rechargement et ne concurrence ni combat, dialogue,
transfert, menu ou autre progression. Plusieurs Œufs sont traités dans l'ordre.

`SourceEggHatchView` porte la scène dans le canvas : message initial, sprite
`Battlers/egg`, cinq cadres `eggCracks`, secousses et sons, musique `evolv`, flash,
sprite animé révélé, cri, `EvolutionSuccess`, surnom facultatif puis destination
Équipe/Ranch pour un Œuf issu de l'Incubateur. La transaction finale passe
`eggSteps` à zéro, restaure les PV, fixe le bonheur à 120, écrit carte/date
d'éclosion et réconcilie le Pokédex. Le sprite source `iconEgg` remplace l'œuf CSS
du gardien et accélère selon les quatre seuils de l'Incubateur.
`Test dev > Services Pokémon > Ramener les Œufs à 5 pas` permet de valider cette
séquence sans parcourir plusieurs milliers de cases ; cet outil personnel ne
touche ni les switches ni la progression narrative.

Le bug documenté `Débug/Bug/Ecran d'évolution.md` venait d'une hypothèse erronée :
`evolutionbg.gif` ne possède qu'une image. Le script actif de Z anime les couches
EBS. `source-transformation-stage.ts` fournit maintenant ces couches à l'évolution
et à l'éclosion (`evobg`/`hatchbg`, `overlay`, six lignes mobiles), avec le même
contrat responsive et `prefers-reduced-motion`. Autorité `PLAYER_STATE`, audience
privée, persistance locale : hôte et invité font progresser uniquement leurs
propres Œufs ; aucun contenu privé n'est envoyé à la room. Validation manuelle
encore requise pour le cadrage, la cadence et les sons sur téléphone.

Correctif visuel d'éclosion du 2026-10-15 : l'animation `iconEgg` n'utilise plus
un décalage fixe de 48 px ; elle passe de `left` à `right` et reste donc correcte
dans l'Incubateur comme dans la vignette agrandie du gardien. Les cinq cadres de
`eggCracks` sont maintenant enfants du sprite `Battlers/egg` : ils partagent son
ancrage, sa taille et ses secousses. Les quatre `ballshake` suivent l'attente et
la cadence du script source avant `recall` et le flash. Le Pokémon révélé est
affiché à environ un tiers de sa taille précédente, et son animation d'apparition
est limitée à la phase `revealed` ; les écrans de surnom et de destination ne la
relancent plus.

Correctif audio d'éclosion du 2026-10-15 : l'ouverture de la scène suspend la BGM
et le BGS de la carte avant de lancer la musique d'éclosion. L'ambiance du monde
reprend à sa position précédente uniquement après la fermeture complète de la
scène. Cette suspension reste une présentation personnelle : elle ne publie aucun
son ni état dans la room Coop et n'interrompt pas la musique des autres joueurs.

Rencontres de terrain du 2026-10-15 : la pêche est accessible depuis la roue de
la Vieille Canne, de la Bonne Canne et de la Super Canne. Le noyau vérifie l'objet,
la case d'eau regardée et un Pokémon apte, puis reproduit l'attente, les chances de
morsure, le délai de réaction et les bonus Ventouse/Glue du script source. La pose
de pêche source et une commande tactile « Remonter » sont rendues dans le canvas.
Le RNG et une rencontre effectivement ferrée sont persistés dans le même état
personnel que les rencontres terrestres ; le combat résultant emprunte ensuite le
contrôleur commun et la room autoritaire en Coop. L'attente avant morsure reste une
présentation personnelle transitoire et est annulée par un rechargement.

L'audit de Z 2.12 FR trouve 136 tables `Land` et 73 tables `OldRod`, mais aucune
table `Cave`, `GoodRod` ou `SuperRod`. Le moteur comprend ces méthodes sans en
inventer les espèces : Bonne Canne et Super Canne réutilisent la seule table
`OldRod` livrée par la carte, tout en conservant leurs chances de morsure supérieures
issues de `pbFishing(2)` et `pbFishing(3)`. Le
contexte `fishing` est conservé sur la rencontre pour les futurs bonus de capture,
notamment la Scuba Ball ; ces modificateurs restent à raccorder.

Les Pokémon qui errent visiblement dans les grottes sont, dans les données source,
des événements mobiles `nubehumo` au contact du joueur. Le port générique de
`pbEncounter(EncounterTypes::...)` tire maintenant la table demandée, suspend la
séquence durant le combat puis exécute réellement `erase-event`. Leur disparition
temporaire est incluse dans les acteurs autoritaires publiés par l'hôte, de sorte
que l'invité ne conserve ni sprite ni collision fantôme ; recharger la carte les
restaure comme dans RPG Maker. Aucun numéro de carte, d'événement ou d'espèce n'est
câblé en dur. La pose de pêche d'un joueur distant n'est pas encore répliquée : la
tentative et son message restent privés, tandis que le combat ferré est partagé.

Raccourci de pêche du 2026-10-15 : le détecteur de terrain regarde exclusivement
la case située devant le joueur et réutilise les tags d'eau de Surf, avec ajout de
l'eau calme pêchable. Si une canne possédée est disponible, un bouton tactile avec
son icône apparaît à côté de la Boussole ; il disparaît en tournant le dos à l'eau,
pendant un déplacement ou lorsqu'une scène bloque les contrôles. La roue de chaque
canne permet de la définir comme « Raccourci ». Ce choix est un état personnel
persistant de `SourceEventState`, jamais projeté dans l'histoire Coop. Une ancienne
sauvegarde choisit automatiquement la canne possédée la plus puissante ayant une
table sur la carte, puis la plus puissante possédée en dernier recours. Solo, hôte
et invité passent tous par `requestSourceFishing` et le même noyau de rencontre.
Une favorite sans table propre ne condamne plus chaque tentative : les cannes
supérieures exploitent la table `OldRod` locale. Si la carte ne possède même pas
cette table de repli, l'absence de rencontre est annoncée avant l'animation plutôt
que présentée comme une série de mauvais tirages. La planche de pêche est lue dans
l'ordre source `3 → 2 → 1 → 0`, puis reste sur la pose 0 ; les profils masculin,
féminin et leurs variantes continuent de passer par le catalogue recoloré commun.

Protection de la canne du 2026-10-15 : la recoloration sémantique accepte désormais
une palette d'équipement protégée. Les trois bleus propres aux planches de pêche,
absents des charsets ordinaires du personnage, ne sont plus transformés dans les
contextes `fish` et `fishSurf`. Peau et vêtements continuent d'utiliser les choix
du profil, tandis que canne, fil et contours non recolorables conservent la palette
source. Le même contrat est appliqué par l'overworld, l'écran de personnalisation
intégré et l'Avatar Lab ; il ne crée aucun nouvel état persistant ou réseau.

Correctifs HUD/capture/remplacement du 2026-10-15 : les indicateurs d'équipe du
HUD de combat ne sont plus des cercles CSS inventés. Ils affichent les assets
source `ballnormal`, `ballstatus` et `ballfainted`, avec le symbole de genre issu
du `BattlerState`. Le lancer de capture est légèrement ralenti et agrandi ; après
l'absorption, la Ball retombe sur le centre déclaré du rectangle `enemybase*`
(384, 158 dans le repère source 512 x 384), indépendamment de la taille du sprite
adverse. Ce placement reste une présentation locale dérivée du combat et ne crée
aucun état réseau.

Le remplacement après K.O. a également été remis sous le contrôle explicite du
joueur dans le combat local. Le noyau partagé conserve `replacementRequired`, la
vue demande le membre à envoyer et le contrôleur applique cette intention ; seuls
les Pokémon sans propriétaire contrôlés par l'IA restent automatiques. En Coop,
la room demeure autoritaire et reçoit la même intention de remplacement. Cet état
tactique est transitoire, déjà contenu dans le snapshot de combat et restauré par
la reconnexion ; son audience est limitée aux participants et observateurs du
combat. Validation manuelle encore attendue pour le rendu exact de la Ball, les
trois symboles d'équipe et un K.O. avec plusieurs réserves.

Deuxième passe des fiches Débug du 2026-10-15 : l'animation de capture complète
était déjà fonctionnelle et sa fiche est refermée. Le Dresseur adverse réapparaît
maintenant avant son dialogue de fin ; le visuel vient du jeu source en solo et du
profil public adverse en Coop/PvP. Cette présentation reste locale et dérivée du
contexte de combat partagé, sans nouvel état persistant ou répliqué.

Le noyau d'évolution apprend maintenant les capacités de niveau `0`, convention
Essentials pour une capacité propre à l'évolution, ainsi que celles du niveau
courant. Une capacité excédant les quatre emplacements rejoint le même
`pendingMoves` personnel que les apprentissages de niveau et passe donc par le
sélecteur existant. Enfin, les événements autoritaires de statut transportent une
intention visuelle : sommeil, paralysie, gel, brûlure, poison, confusion, peur et
variations de statistiques animent le bon sprite en simple ou double. La fiche
globale des animations reste ouverte pour inventorier les capacités sans mapping
source ; aucun résultat de combat n'est recalculé par ces effets visuels.

Reprise HUD/capture après validation visuelle du 2026-10-15 : les indicateurs de
l'équipe sont désormais posés dans six cellules régulières de 14 px séparées de
3 px. L'asset source K.O. est renforcé par une pastille rouge et une croix blanche,
sans modifier l'état de combat. La capture n'enchaîne plus des animations Web avec
leurs `fill` encore actifs : chaque position est figée avant l'étape suivante.
L'ordre visible est fermé en vol, pause, ouverture et absorption, fermeture,
chute vers l'ancre `enemybase`, puis oscillations sur le seul axe horizontal. Le
ratio vertical réel `32 x 64` des fichiers Ball est conservé pendant cette scène,
ce qui évite leur compression et les faux déplacements verticaux. Ces changements
sont strictement locaux et s'appliquent de la même façon aux snapshots solo et
Coop.

Ajustement demandé après essai : le vol de capture utilise de nouveau sa durée de
base de 680 ms et la largeur de la Ball passe de 7,5 % à 5,5 % du canvas. Son ratio
vertical source reste conservé ; seules la vitesse du vol et l'échelle changent.

Finition d'absorption du 2026-10-15 : lorsque la Ball ouverte intercepte la cible,
un flash radial bleu apparaît dans la couche d'effets, sous la Ball et devant le
Pokémon. Le sprite se surexpose en bleu puis se contracte rapidement vers son
centre, qui correspond à la position de la Ball, avant la fermeture et la chute.
L'effet et le repli sont joués en parallèle à partir du même événement de capture ;
ils restent purement visuels, locaux et compatibles avec `prefers-reduced-motion`.

Synchronisation affinée le 2026-10-15 : les pauses artificielles précédant le flash
ont été supprimées. À la fin exacte du vol, la Ball passe ouverte, le son de rappel,
le flash renforcé et l'absorption démarrent ensemble. Si la capture échoue, la Ball
se rouvre sur l'ancre `enemybase`, rejoue le même flash et le Pokémon se redéploie
depuis cette position vers sa place de combat. Cette séquence est une présentation
locale dérivée du résultat autoritaire ; aucun état solo ou Coop supplémentaire
n'est introduit.

Réussite de capture affinée le 2026-10-15 : après la dernière secousse, la Ball
émet un bref éclat puis passe progressivement en niveaux de gris. Cet état reste
visible pendant le message de réussite et son filtre est restauré au nettoyage,
afin de ne pas contaminer une capture ou une animation ultérieure. Le résultat de
capture reste celui du noyau autoritaire ; il s'agit uniquement de sa présentation.

Échec de capture affiné le 2026-10-15 : après la réouverture, le flash et le
redéploiement de la cible ne sont plus suivis d'un rejet séparé. Le flash forme une
explosion commune : la cible jaillit avec une enveloppe bleutée et la Ball encore
ouverte reçoit simultanément une forte impulsion vers la droite, avec rotation et
disparition hors du canvas. Ce rejet réutilise le même résultat de capture local
ou Coop et ne modifie aucune règle métier.

Oscillations de capture affinées le 2026-10-15 : le son source `ballshake` est
toujours démarré juste avant son mouvement associé. L'oscillation dure désormais
310 ms (180 ms en capture critique), utilise une amplitude latérale et angulaire
plus marquée, puis revient sèchement au centre. La pause inter-secousses passe à
190 ms pour préserver le lien perceptible entre chaque son et chaque mouvement.

Flux post-capture du 2026-10-15 : le noyau local et le règlement Coop ne placent
plus automatiquement le Pokémon dans l'équipe. La capture autoritaire et sa
consommation de Ball sont d'abord appliquées une seule fois, puis le Pokémon est
stocké durablement au Ranch du lanceur. Un état personnel
`pokemon-z-battle.pending-capture.v1` ouvre ensuite une scène obligatoire dans le
canvas : conservation ou saisie d'un surnom (12 caractères), choix Équipe/Ranch,
et, si les six places sont prises, sélection explicite du membre à échanger.
`placeCapturedPokemon` réalise cet échange atomiquement dans `player-state` pour
éviter tout état intermédiaire dupliqué ou perdu. Le choix en attente survit au
rafraîchissement et à la reconnexion ; il n'est jamais répliqué aux autres joueurs.
Autorité : room pour le résultat tactique en Coop, adaptateur local en solo, puis
propriétaire pour surnom et rangement. Domaine/persistance : collection et
historique Pokédex personnels. Audience : uniquement le propriétaire de la capture.

Dans un combat sauvage, le pied du HUD adverse ne simule plus une équipe de
Dresseur. Il montre l'asset source `battleBoxOwned.png` coloré si l'espèce figure
dans `caughtSpecies`, et sa variante grisée si elle n'a encore jamais été capturée.
Ce renseignement est calculé depuis le Pokédex local de chaque participant et ne
fait donc entrer aucune donnée personnelle supplémentaire dans le snapshot Coop.

Fidélité de l'évolution du 2026-10-15 : la cadence du décor est maintenant issue
de `PokemonEvolutionScene`. Les six barres `EBS/line1.png` conservent en permanence
un intervalle d'un sixième d'écran, avancent selon le rythme source de 2 px par
image (cycle de 4,8 s sur 384 px), s'aplatissent au centre et pivotent au-dessus.
Le double décalage CSS qui les agglutinait au démarrage a été supprimé. La scène
rejoue également les couches lumineuses absentes du portage : `shine1` au départ,
`shine3` au cœur, `shine4` à la conclusion, huit rayons et seize particules
`shine2`. L'éclosion conserve le composant partagé mais utilise désormais son
propre `line2.png`. Ces effets sont une présentation locale dérivée d'un état déjà
résolu ; aucune nouvelle donnée persistante ou répliquée n'est introduite.

## Commandes utiles

```powershell
corepack pnpm sandbox:overworld
corepack pnpm lab:avatar
corepack pnpm test
corepack pnpm build
corepack pnpm --filter @pokemon-z-battle/overworld-sandbox typecheck
```

Le serveur multijoueur de production est le Worker hébergé sur Cloudflare. Le
Worker Wrangler local ci-dessous est uniquement un outil de développement et de
test :

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

## Audit automatique des dépendances de combat — 2026-10-15

`prepare:local` produit désormais `battle-integration-report.json`. Le rapport
croise automatiquement les 1 018 définitions de Pokémon et les 477 équipes de
Dresseurs avec leurs capacités, codes de fonction, talents et correspondances
`move2anim.dat`. Chaque dépendance conserve ses périmètres `pokemon:*` et
`trainer:*`. Une entrée ciblée se contrôle avec
`corepack pnpm audit:combat -- --scope pokemon:INTERNAL_NAME`; la commande retourne
un code non nul si une mécanique, un talent ou une animation de ce périmètre manque.

La liste manuelle de 18 capacités animées a été supprimée. L'extracteur développe
maintenant toutes les animations des fonctions moteur supportées ou partielles,
ainsi que toutes les séquences `Common:*`. Sur les données locales actuelles, 469
animations sont préparées et les dix effets communs Sommeil, Poison, Brûlure,
Paralysie, Gel, Confusion, hausses/baisses de statistiques, Caduco et Hémorragie
sont disponibles. Le lecteur de combat les joue avant de revenir au fallback CSS.
Les capacités supportées sans entrée source dans `move2anim.dat` restent signalées
explicitement ; aucune animation n'est inventée.
