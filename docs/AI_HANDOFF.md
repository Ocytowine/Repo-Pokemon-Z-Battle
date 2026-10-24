# Reprise du developpement par une IA

Derniere mise a jour : 2026-10-22.

Les vérifications à effectuer par le porteur après les derniers lots de
fonctions d'attaque sont regroupées dans
[`VALIDATION_MANUELLE_COMBAT.md`](VALIDATION_MANUELLE_COMBAT.md). Les cases sont
volontairement laissées ouvertes jusqu'à une observation réelle en jeu.

## Reparation du merge du 2026-10-21

Le merge publie `da89cb5` avait conserve des marqueurs de conflit bruts dans 21
fichiers entre la branche de talents `6695aa3` et la ligne fonctionnelle
`52b0b91`. La reprise est effectuee sur `repair/merge-da89cb5`, avec le point de
securite local `backup/pre-repair-da89cb5-20261021`. Les deux familles d'apports
sont reunies : talents et audit de selection, Mega-Evolution, environnements et
capacites Route 3/Route 5, identifiants uniques, transferts d'objets et logique
solo/Coop. Les doubles declenchements issus des deux implementations concurrentes
(notamment Phobique, Peau Dure et Poisseux) ont ete elimines au profit des hooks
generiques communs. Aucun historique publie n'a ete reecrit et aucun push n'a ete
effectue. `corepack pnpm test` et `corepack pnpm build` passent apres reparation.

Ce document est la reference courte pour reprendre Pokemon Z-Battle sans refaire
l'analyse historique du depot. Il doit etre lu avec la section 9.7 de
`docs/ROADMAP.md`. Les nouveaux constats et fonctionnalites planifiees sont classes
par priorite, dependances et contrat solo/Coop dans `docs/PRODUCT_BACKLOG.md` ; ne
consulter ce backlog qu'apres avoir compris l'etat reel decrit ici.

## Intention du projet

Pokemon Z-Battle est un moteur web TypeScript qui interprete les donnees locales de
Pokemon Z v2.12 FR sans executer son Ruby et sans versionner ses assets. Les donnees
extraites vivent dans `.pokemon-z/`, qui reste local et ignore par Git.

Jalon narratif du 2026-10-19 : `encounter-modifiers.json` couvre maintenant les
profils de rangs places dans la variable source 300 avant les boss sauvages. La
commande `set-next-wild-battle-stages` conserve ce profil one-shot, le transfere
dans la rencontre persistante puis le noyau commun l'applique au snapshot tactique
utilise en solo et en Coop. La Map999 extrait aussi sa politique exacte
`pbBalancedLevel(equipe) - 4 + rand(5)` ; le niveau et l'etat du RNG sont memorises
avant l'ouverture du combat, donc une reconnexion ne relance pas le tirage. La
creation au niveau final recalcule naturellement statistiques et capacites. L'audit
des modificateurs ne garde plus que deux conditions dynamiques non portees : le
switch de debug shiny nomme et la case brillante du Poke Radar.

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

Seconde passe remplacement du 2026-10-15 : le sélecteur forcé se ferme désormais
explicitement après la réponse autoritaire, car un remplacement ne change pas le
numéro de tour et l'ancien reset fondé sur ce numéro laissait le menu affiché. Un
combat de Dresseur impose toujours le choix d'une réserve consciente. Une rencontre
sauvage ajoute `Fuite` au même écran ; si elle est choisie pendant un remplacement,
la sortie est garantie afin de ne pas faire attaquer un emplacement K.O. Le noyau
`battle-engine` porte cette règle pour le solo et la room Cloudflare. En Coop, le
vote de fuite existant reste requis pour chaque participant avant son règlement
autoritaire. Aucun état persistant supplémentaire n'est créé.

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

## Complétion du Pokédex — 2026-10-15

La fiche Pokédex ne jette plus les méthodes d'évolution extraites. Chaque cible
conserve `method` et `parameter`, puis présente une condition française résolue
avec les catalogues de Pokémon, capacités et objets : niveau, pierre, bonheur,
jour/nuit, sexe, capacité connue, compagnon requis, objet tenu, comparaisons
Attaque/Défense et embranchements particuliers sont couverts. Une méthode future
inconnue reste visible avec son paramètre au lieu d'être masquée.

Le catalogue régional retient aussi les noms de `map-infos.json`. Le volet Zones
de capture déduit ses lieux depuis les mêmes rencontres que ses cellules,
déduplique les noms, les ancre aux zones rouges et masque uniquement la colonne de
sprite sur ce volet. Il s'agit d'une projection locale en lecture
seule : autorité catalogue extrait, domaine personnel visuel, aucune persistance,
aucun message Coop et même calcul pour le joueur solo, l'hôte et l'invité.
La finition de densité garde la fiche Pokédex sans défilement : champs, statistiques
et évolutions utilisent des espacements spécifiques plus compacts. La carte
d'habitat reste en ratio 3:2 mais n'emploie plus une taille fixe ni de bandeau bas :
elle remplit toute la hauteur disponible. Le corps du volet est borné avant la
navigation ; cette composition tient compte de
la mise à l'échelle globale du canvas et empêche carte ou liste de passer sous les
boutons Précédent/Suivant.
Chaque cellule rouge porte en plus un libellé fixe des cartes qui partagent cette
coordonnée ; seul le marqueur pulse, pas son texte.

## Fluidité des grands sprites Pokémon — 2026-10-15

`source-pokemon-sprite-animator.ts` est le lecteur commun des grands battlers. Il
conserve les planches source sans créer de frame supplémentaire, utilise
`requestAnimationFrame` et ajoute une respiration très légère ancrée sous les
pieds. Après validation visuelle, le fondu entre poses a été retiré : il faisait
clignoter le pixel art. Chaque pose opaque est maintenant préparée hors écran puis
copiée en une opération, tandis que le mouvement continu passe par le compositeur
du navigateur. Le lissage bitmap reste désactivé et `prefers-reduced-motion` fige
proprement la première frame. La cadence reprend désormais celle du
`BitmapWrapperEX` source : avec `Graphics.frame_rate = 60`, vitesse normale à deux
frames internes et `frameSkip = 2`, une pose avance toutes les 4 mises à jour, soit
15 poses par seconde (environ 66,7 ms), dans les menus comme en combat.

Le même noyau équipe désormais les résumés Équipe/Ranch/Combat, la fiche Pokédex,
la Pension, les battlers actifs du combat, la résolution post-capture, l'évolution
et l'éclosion. Les animations de combat et de transformation continuent d'agir sur
les conteneurs externes, sans entrer en conflit avec le lecteur interne. Autorité :
présentation locale ; domaine : visuel dérivé des assets et de l'apparence du
Pokémon ; persistance : aucune ; réplication : aucune donnée supplémentaire, hôte
et invité reconstruisant le même rendu depuis leur état de combat.

## Miroir de la Vérité — 2026-10-16

Le Miroir de la Vérité de Pokémon Z est raccordé depuis le Sac sous son nom
français. L'action `Observer` n'utilise pas l'objet et active pendant dix secondes
une vision personnelle de trois cases, conforme au script source. Les événements
portant `#EOT HIDE [opacité]` deviennent invisibles et traversables à proximité ;
les événements `#EOT SHOW [opacité]` deviennent visibles, interactifs et bloquants.
Le parseur est générique et ne dépend d'aucun numéro de carte ou d'événement.

Architecture Coop : l'inventaire reste privé et le joueur émet seulement
l'intention `activateSourceFieldEffect: truth-lens`. La room démarre sa propre
fenêtre autoritaire de dix secondes puis applique les obstacles `truthEvents` au
joueur concerné dans le résolveur commun de mouvement. Cette fenêtre éphémère
n'entre jamais dans l'état persisté et est supprimée à la déconnexion ; une
reconnexion exige donc une nouvelle activation. Le contenu révélé et l'effet
visuel restent locaux. Les séquences narratives révélées conservent la politique
existante : l'hôte en garde l'autorité sur le monde partagé, tandis que les
services personnels restent réservés au joueur concerné.

Fichiers principaux : `source-truth-lens.ts`, `imported-map.ts`,
`source-world.ts`, `network-session.ts` et `room-server-core/src/index.ts`.
Les fixtures couvrent les balises, la portée euclidienne, les modes HIDE/SHOW,
la validation du protocole et l'expiration autoritaire simulée.

## Raccourcis de terrain — 2026-10-16

Les anciens boutons isolés de Boussole et de Pêche appartiennent maintenant à une
barre générique en haut à droite du canvas. Son ordre stable est Boussole, Miroir
de la Vérité, Pêche puis Chevroum. Le Miroir peut être ajouté ou retiré depuis sa
roue d'objet ; la canne choisie depuis le Sac devient simultanément favorite et
raccourci. Les quatre fonctions se configurent aussi dans Options sur une rangée
compacte compatible avec la hauteur Android.

La préférence est locale, versionnée sous
`pokemon-z-battle.field-shortcuts.v1` et ne contient que les identifiants des
boutons. Elle ne réplique ni inventaire ni progression. Une ancienne sauvegarde
conserve la Boussole par défaut et migre automatiquement sa canne favorite vers le
nouveau raccourci. Chaque bouton appelle le noyau existant : la Pêche vérifie la
case regardée, Chevroum les déblocages et la carte, et le Miroir l'activation
autoritaire Coop. Une fonction non possédée ou non débloquée peut rester choisie
mais n'est jamais exposée sur le terrain avant de devenir utilisable.

La Pêche reste un raccourci contextuel : son bouton n'apparaît que face à une
zone pêchable et hors mouvement. Le Miroir et Chevroum sont des raccourcis
persistants : ils restent visibles et utilisables pendant la marche ; une scène
qui interdit leur activation les désactive temporairement sans retirer leur bouton.

## Rochers Éclate-Roc et événements communs — 2026-10-16

Le prochain lot de terrain reprend la mécanique réellement employée par Pokémon Z,
pas une CS Coupe inventée. Les 78 pages de rochers trouvées sur les cartes source
appellent l'événement commun `TenerGolpeRoca` : le joueur peut fabriquer une dose
de `POLVOEXPLOSIVO` avec une `BRASACANDENTE` et une `POLVOBRILLANTE` lorsque le
niveau d'Alchimie le permet, puis choisir de la consommer pour libérer le passage.
Les textes et choix de l'événement commun utilisent le catalogue français de
contexte 0, désormais fusionné avec celui de la carte.

`source-common-events.ts` développe génériquement les commandes
`call-common-event` avant la résolution et l'audit de scène, avec protection contre
les cycles et la profondeur excessive. `source-event-flow.ts` projette les
mutations d'inventaire déjà retenues au sein du même échange : une poudre fabriquée
peut donc être reconnue par la condition suivante sans modifier prématurément la
sauvegarde. Les hooks `pbEraseThisEvent` et `pbRockSmashRandomEncounter` deviennent
respectivement `erase-event` et une rencontre `RockSmash` optionnelle à 25 %.
La distribution v2.12 FR locale ne contient actuellement aucune table RockSmash ;
dans ce cas le tirage reste silencieux comme la source et aucune rencontre n'est
inventée. Les objets remis après certains rochers continuent par le pipeline
générique du Sac.

Autorité et Coop : la poudre, ses ingrédients et les objets reçus sont personnels.
Sur une carte partagée, seul l'hôte exécute la mutation du rocher ; le self-switch
rejoint l'histoire persistante de l'hôte et son rendu est répliqué. Les rares
effacements `pbEraseThisEvent`, valables seulement jusqu'au rechargement de carte,
sont déduits chez l'invité de la liste autoritaire des acteurs. Une reconnexion
restaure donc les self-switches persistants et la room restaure les acteurs encore
présents. En excursion, l'invité utilise le même noyau local. Le profil d'avatar
web reste prioritaire sur les anciennes affectations numériques `$Trainer.outfit`.

Tests : développement d'événements communs et détection des cycles, projection de
fabrication, portage des deux hooks, traduction du contexte commun et effacement
temporaire Coop.

## Tirage des talents non forcés et audit de dépendances — 2026-10-20

La règle retenue avec le porteur est maintenant explicite : lorsqu'une rencontre
ou une équipe de Dresseur ne fournit aucun `abilityIndex`, le Pokémon tire son
talent parmi les talents normaux de son espèce. Un talent caché n'entre jamais
dans ce tirage ; il reste accessible lorsqu'un index source le force explicitement.
Le choix est dérivé de l'identité persistante du Pokémon. Les créations réelles
emploient une nouvelle identité pour chaque Pokémon sauvage et chaque membre de
Dresseur, puis conservent le résultat dans l'état de combat : un affichage, un
tour, une restauration ou une reconnexion ne relancent donc pas le tirage.

Le noyau commun `player-state` porte cette sélection pour les Pokémon possédés,
sauvages et de Dresseur. En solo, l'adaptateur local crée l'identité avant
l'ouverture du combat. En Coop, la même équipe est remise à la room, qui devient
autoritaire sur le snapshot et le RNG des tours ; les participants reçoivent le
talent déjà choisi. Le domaine du talent est l'état du Pokémon, son audience est
l'ensemble des participants au combat et aucune intention réseau supplémentaire
n'est nécessaire. Les anciennes sauvegardes gardent leur talent enregistré.

Le rapport `battle-integration-report.json` passe au schéma `1.1.0`. Chaque scope
Pokémon ou Dresseur expose désormais `abilitySelections` avec la politique
`random-normal` ou `forced-index` et ses candidats. Les talents cachés non forcés
ne gonflent plus les dépendances. Sur la distribution locale, le périmètre passe
de 243 à 229 talents référencés et de 217 à 203 problèmes de talent ; le total du
rapport passe de 643 à 629 problèmes. La commande `audit:combat -- --scope ...`
affiche aussi la politique et les candidats avant les effets manquants.

Couverture ajoutée : sélection stable depuis l'identité, exclusion des talents
cachés, respect d'un index forcé, variation entre identités de combat, et contrat
du rapport d'audit.

## Talents de précision, dégâts résistés et survie — 2026-10-20

Le premier lot de la phase de portage des talents couvre les dépendances immédiates
de Jean puis de Vin. `COMPOUNDEYES` multiplie la précision finale par 1,3,
`TINTEDLENS` double les dégâts d'une attaque résistée et `STURDY` laisse un Pokémon
à 1 PV lorsqu'il subit à pleine vie un coup normalement fatal. Les calculs et
événements appartiennent au noyau `battle-engine` partagé : la room en est
autoritaire en Coop, réplique le snapshot et la trace, et une reconnexion ne
rejoue aucun déclenchement déjà résolu. En solo, l'adaptateur local appelle le
même noyau. Leur audience est limitée aux participants et observateurs du combat.

La couverture reste volontairement exacte dans le registre : Lentiteintée est
supportée ; Œil Composé reste partiel tant que son effet 50/30/20 sur les objets
tenus sauvages n'est pas raccordé ; Fermeté reste partiel tant que l'immunité aux
capacités K.O. en un coup ne peut pas être exercée. Le rapport local compte donc
27 talents supportés, 5 partiels et 223 absents sur 255. Dans le périmètre de
dépendances jouable, les problèmes de talent passent de 203 à 202 et le total des
problèmes de 629 à 628.

La capture locale et le règlement autoritaire Coop recopient désormais le talent
du combattant capturé. La nouvelle identité persistante ne relance plus ce choix ;
PV, statut, capacités et apparence suivaient déjà cette même règle. Les tests
couvrent le seuil exact de précision, la trace du multiplicateur de dégâts, la
condition pleine vie de Fermeté et la conservation du talent capturé.

## Pickpocket et provenance des objets tenus — 2026-10-20

Le second lot de portage des talents ajoute `PICKPOCKET` au noyau commun. Après
une attaque de contact ayant infligé des dégâts, un porteur vivant et sans objet
prend l'objet tenu de l'attaquant. Le noyau émet `abilityActivated` puis
`heldItemTransferred`, met à jour les deux combattants et conserve dans
`BattleEffects.itemTransfers` la provenance nécessaire au règlement.

L'autorité est locale en solo et appartient à la room en Coop ; les clients
n'envoient qu'une intention d'action et reçoivent le snapshot ainsi que les
événements résolus. Le domaine est tactique partagé, avec une présentation aux
participants et observateurs du combat. Le contrat `BattleResolutionRules`
interdit à l'adversaire d'un combat `source-wild` de voler l'objet personnel du
joueur, sans empêcher le joueur de voler celui du sauvage. Cette règle est passée
aux combats simples et doubles par l'adaptateur local et la room autoritaire.

La persistance suit le jeu source : un transfert contre un Dresseur est temporaire
et le règlement personnel restaure les objets initiaux, en solo comme après une
reconnexion Coop ; les objets réellement consommés restent consommés. En sauvage,
un transfert autorisé vers le joueur reste persistant. La file visuelle traduit
le nom du talent et de l'objet et projette immédiatement le changement de porteur.

Après `prepare:local`, le rapport compte 627 problèmes globaux, dont 201 problèmes
de talents. Le registre moteur compte 28 talents supportés, 5 partiels et 222
absents sur 255. L'audit ciblé de Vin passe à deux problèmes : `COMPOUNDEYES` et
`STURDY`, tous deux partiels ; `PICKPOCKET` n'est plus signalé. Jean reste à un
problème partiel lié à `COMPOUNDEYES`.

Les régressions couvrent simple, double, présentation, règlement personnel et
room autoritaire : vol en combat de Dresseur, protection du joueur contre un
sauvage, vol permis au joueur sur un sauvage et restauration après règlement.

## Lot groupé de modificateurs de dégâts — 2026-10-20

La cadence de portage passe à des familles mécaniques. Un seul raccord dans
`calculateDamage` couvre dix talents : `ADAPTABILITY`, `IRONFIST`, `STRONGJAW`,
`TOUGHCLAWS`, `TECHNICIAN`, `SNIPER`, `THICKFAT`, `FILTER`, `SOLIDROCK` et
`MULTISCALE`. Les conditions proviennent des drapeaux source des capacités, de la
puissance effectivement calculée, du STAB, du critique, du type, de l'efficacité
et des PV pleins.

L'autorité, le domaine et l'audience ne changent pas : ce calcul tactique pur est
exécuté par le noyau partagé, localement en solo et par la room en Coop, puis sa
trace est répliquée aux participants. Il ne crée aucune intention réseau ni état
persistant. Les reconnexions restaurent directement les PV déjà calculés. La trace
expose maintenant la liste `abilityModifiers`, ce qui conserve simultanément un
modificateur offensif et un modificateur défensif ; `abilityModifier` reste le
premier élément pour les consommateurs existants.

Après une seule régénération en fin de lot, le rapport passe de 627 à 617
problèmes globaux et de 201 à 191 problèmes de talents. Le registre compte 38
talents supportés, 5 partiels et 212 absents sur 255. Les tests couvrent chaque
condition et la combinaison Technicien/Multiécaille.

## Lot groupé de réactions au contact — 2026-10-20

Le hook de contact partagé couvre maintenant `FLAMEBODY`, `POISONPOINT`,
`EFFECTSPORE`, `ROUGHSKIN`, `IRONBARBS`, `GOOEY` et `POISONTOUCH`. Corps Ardent et
Point Poison appliquent leur statut avec 30 % de chances ; Effet Spore effectue
le tirage source poison/sommeil/paralysie et respecte les immunités du type Plante,
de `OVERCOAT` et de `SAFETYGOGGLES`. Peau Dure et Épine de Fer retirent 1/8 des PV
maximaux à l'attaquant, Poisseux baisse sa Vitesse et Toucher Toxique empoisonne
la cible avec 30 % de chances.

La mécanique reste tactique, partagée et sans intention réseau supplémentaire :
le noyau résout le RNG localement en solo ou dans la room autoritaire en Coop,
puis réplique les statuts, statistiques, PV et événements aux participants. Une
reconnexion reprend ces valeurs dans le snapshot. `abilityDamage` donne à la file
visuelle un palier de PV explicite pour Peau Dure et Épine de Fer. Les statuts et
baisses de statistique utilisent les événements communs existants.

Après la régénération unique de fin de lot, l'audit passe de 617 à 610 problèmes
globaux et de 191 à 184 problèmes de talents. Le registre compte 45 talents
supportés, 5 partiels et 205 absents sur 255. Les tests couvrent les déclenchements,
les trois tirages d'Effet Spore, ses immunités, les dégâts, la baisse de Vitesse,
le talent offensif Toucher Toxique et la présentation des PV.

## Lot groupé d'immunités et absorptions élémentaires — 2026-10-20

Le hook commun d'immunité porte huit talents complets : `WATERABSORB`,
`VOLTABSORB`, `SAPSIPPER`, `STORMDRAIN`, `LIGHTNINGROD`, `MOTORDRIVE`,
`FLASHFIRE` et `LEVITATE`. Les deux absorptions rendent un quart des PV maximaux ;
Herbivore monte l'Attaque, Collecteur et Paratonnerre l'Attaque Spéciale, et
Motorisé la Vitesse. Lévitation annule les capacités Sol offensives. Torche annule
toute attaque Feu reçue ; la première arme un volatile tactique qui multiplie
ensuite les dégâts Feu du porteur par 1,5. `DRYSKIN` réutilise aussi l'absorption Eau mais reste
partiel à cause de ses effets dépendants de la météo.

En combat double, Collecteur et Paratonnerre reproduisent le balayage source des
combattants actifs : une capacité mono-cible Eau ou Électrik est redirigée vers le
porteur prioritaire, y compris s'il est l'allié de l'attaquant. Si la cible prévue
porte déjà le talent, elle reste la cible. Ces deux talents garantissent aussi la
réussite de la capacité attirée, indépendamment de sa précision.

L'autorité est locale en solo et appartient à la room en Coop. Le domaine est le
snapshot tactique partagé : PV, niveaux de statistique et volatile Torche sont
répliqués, puis restaurés tels quels après reconnexion. Les clients n'envoient que
leurs intentions d'action ; les participants et observateurs du combat constituent
l'audience de présentation. Le même noyau résout les combats simples, doubles,
hôte et invité, sans état persistant après la fin du combat.

Après `prepare:local`, l'audit passe de 610 à 602 problèmes globaux et de 184 à
176 problèmes de talents. Le registre compte 53 talents supportés, 5 partiels et
197 absents sur 255. Les tests couvrent soins, hausses de statistique, immunité
Sol, armement puis bonus de Torche, précision garantie et redirection double vers
un allié ou un adversaire.

## Lot groupé de protections passives — 2026-10-20

Douze talents supplémentaires utilisent quatre gardes communs du moteur.
`CLEARBODY` et `WHITESMOKE` bloquent toute baisse de statistique causée par un
adversaire ; `HYPERCUTTER` protège l'Attaque. Le même garde reste utilisé par
`BIGPECKS` et `KEENEYE`, sans bloquer les baisses que le porteur s'inflige
lui-même. Il est aussi consulté par Intimidation à la création du combat et lors
d'une entrée, en simple comme sur chaque emplacement actif d'un combat double.

`IMMUNITY`, `LIMBER`, `INSOMNIA`, `VITALSPIRIT`, `WATERVEIL` et `MAGMAARMOR`
empêchent respectivement poison, paralysie, sommeil, sommeil, brûlure et gel. Le
garde est partagé par les capacités de statut, les effets additionnels, les
talents de contact et Synchro. Lorsqu'un snapshot ancien ou une entrée porte déjà
un statut incompatible, le noyau le soigne et émet les mêmes événements tactiques.
`OWNTEMPO` applique le même principe à la confusion. `BATTLEARMOR` et
`SHELLARMOR` empêchent enfin le critique avant le tirage RNG, conformément à la
routine source.

L'autorité et le domaine restent ceux du combat : noyau local en solo, room
autoritaire en Coop, état tactique partagé et audience limitée aux participants
et observateurs. Les clients n'envoient aucune intention spécifique à ces
talents. Statuts, volatiles et niveaux de statistique sont déjà compris dans le
snapshot de reconnexion ; aucun de ces effets ne crée une nouvelle persistance
après le règlement du combat.

Après `prepare:local`, l'audit passe de 602 à 591 problèmes globaux et de 176 à
165 problèmes de talents. Le registre passe de 53 à 65 talents supportés, conserve
5 talents partiels et descend à 185 absents sur 255. Armumagma est bien supporté
dans le catalogue mais ne retire pas de problème supplémentaire, car aucun scope
jouable actuel ne le sélectionne. Les tests couvrent chaque statut, la confusion,
les trois familles de baisse de statistique, les deux protections critiques et
Intimidation en simple et en double.

## Lot offensif contrecoup et effets secondaires — 2026-10-20

Cinq talents supplémentaires sont portés dans le noyau commun. `SHEERFORCE`
augmente de 30 % les dégâts d'une capacité qui possède une chance d'effet
additionnel, supprime cet effet sans consommer son tirage RNG et empêche le recul
de l'Orbe Vie associé, comme dans `pbEffectsAfterHit` du jeu source. `RECKLESS`
augmente de 20 % les fonctions de contrecoup `0FA` à `0FE` ainsi que les attaques
à chute `10B`. `ROCKHEAD` bloque le contrecoup proportionnel, mais pas la chute
d'une attaque ratée ; Garde Magik bloque les deux. Les fractions source sont
respectivement 1/4, 1/3, 1/2, 1/3 et 1/3 des dégâts réellement infligés, tandis
que la chute retire la moitié des PV maximaux.

`SKILLLINK` fixe à cinq le nombre de frappes des capacités `0C0`, sans tirage de
compte, et chaque frappe conserve son calcul, son impact et son palier de PV.
`SUPERLUCK` ajoute un niveau au taux de critique avant le tirage. Les effets
additionnels paralysant de `0FD` et brûlant de `0FE` rejoignent le pipeline de
statut partagé. Un événement `recoilDamage` porte les PV autoritaires jusqu'à la
présentation au lieu de recalculer le contrecoup côté client.

Autorité et état : le calcul, le RNG, les PV, statuts et événements appartiennent
au noyau local en solo et à la room autoritaire en Coop. Les clients envoient
uniquement l'intention d'attaque ; participants et observateurs voient les mêmes
paliers. Le snapshot tactique suffit à restaurer hôte ou invité après reconnexion,
et aucun effet de ce lot ne persiste après le règlement du combat. Les mêmes
fonctions sont appelées en combat simple et double.

Après `prepare:local`, l'audit passe de 591 à 574 problèmes globaux. Les problèmes
de talents passent de 165 à 160 ; le registre compte 70 talents supportés, 5
partiels et 180 absents sur 255. Les six nouvelles fonctions pleinement exécutées
font passer les fonctions supportées de 56 à 62 sur 353 ; les problèmes de
mécaniques d'attaque descendent à 368. Les tests couvrent puissance, trace,
critique, cinq frappes, suppression des effets et de l'Orbe Vie, fractions de
contrecoup, chute, Garde Magik, Tête de Roc et présentation des PV.

## Lot de réactions statistiques — 2026-10-20

Neuf talents supplémentaires passent par deux hooks communs. Le premier s'exécute
après chaque impact qui inflige des dégâts : `STAMINA` monte la Défense d'un cran,
`WATERCOMPACTION` la monte de deux après une attaque Eau, `RATTLED` monte la
Vitesse après Insecte, Ténèbres ou Spectre, et `WEAKARMOR` baisse la Défense puis
monte la Vitesse d'un cran après une attaque physique. `STEAMENGINE` monte la
Vitesse de six crans après Eau ou Feu. `BERSERK` monte l'Attaque Spéciale lorsque
les PV passent strictement d'au-dessus à en dessous de la moitié. `ANGERPOINT`
place enfin l'Attaque à +6 après un critique. Les valeurs suivent les scripts de
Z, y compris le +1 Vitesse d'Armure Fragile propre à cette version et les seuils
stricts de Colère.

Le second hook suit toute baisse de statistique réellement appliquée par un
adversaire. `DEFIANT` gagne alors deux crans d'Attaque et `COMPETITIVE` deux crans
d'Attaque Spéciale. Le raccord couvre les effets de capacité, Poisseux et les
entrées d'Intimidation : état initial, changement simple et chaque cible active en
double utilisent la même réaction. Une baisse personnelle ne la déclenche pas.

Autorité et réplication : dégâts, critique, seuil de PV, niveaux de statistique et
événements de talent sont calculés dans `resolveSelectedMoves`, utilisé localement
en solo et par la room en Coop. L'hôte et l'invité n'envoient que leur intention ;
le snapshot autoritaire réplique le résultat au rendu distant. Un test de room
vérifie aussi qu'un niveau gagné par Endurance reste présent après déconnexion et
reconnexion de l'invité. Ces niveaux restent tactiques et ne persistent pas après
le combat.

Après `prepare:local`, l'audit passe de 574 à 565 problèmes globaux et de 160 à
151 problèmes de talents. Le registre passe de 70 à 79 talents supportés, conserve
5 talents partiels et descend à 171 absents sur 255. Les 62 fonctions d'attaque et
les 368 mécaniques d'attaque manquantes ne changent pas dans ce lot centré sur les
talents. Les tests couvrent chaque déclencheur, les limites de crans, le critique,
les seuils stricts, les frappes multiples, Intimidation simple/double, l'entrée par
changement et la reconnexion Coop.
## Arbustes Coupe et Hachuela Endeble — 2026-10-16

Coupe propre à Pokémon Z est raccordée au même noyau d'obstacles destructibles que
les rochers. L'audit de la v2.12 FR trouve 30 arbustes sur 19 cartes, tous liés à
l'événement commun `TenerCorte` (59). Si le joueur ne possède pas de
`HACHAENDEBLE`, cet événement peut fabriquer une hache avec une `MADERA` et une
`VIRUTASFERREAS`. La recette du menu Alchimie est débloquée au niveau 10, mais la
fabrication contextuelle source vérifie la variable 926 au niveau 12 : cette
incohérence du jeu original est conservée et testée, pas corrigée arbitrairement.

Une hache déjà possédée fonctionne sans cette vérification. L'interaction joue
`PRSFX- Cut`, rend l'animation de carte 19 `Corte`, exécute la courte oscillation
de l'arbuste, applique ses récompenses éventuelles puis retire exactement une
hache avec le message de casse source. Vingt-neuf arbustes emploient un
self-switch persistant ; Map046/EV028 emploie `pbEraseThisEvent` et revient au
rechargement de la carte. Les gains possibles restent lus dans chaque événement,
sans table de récompenses codée à la main.

Autorité et Coop : ingrédients, hache et récompenses appartiennent au joueur ; la
mutation du monde partagé reste exécutée par l'hôte. Le self-switch rejoint
l'histoire de l'hôte et la disparition temporaire passe par la liste d'acteurs
autoritaire déjà restaurée par la room. Son, animation et disparition sont publiés
aux joueurs présents ; une excursion personnelle de l'invité réutilise le même
noyau local. Aucun message réseau ni état parallèle propre à Coupe n'a été ajouté.

Tests : fabrication contextuelle complète, recette personnelle au niveau 10,
utilisation d'une hache déjà possédée sous le niveau 12, son/animation source,
récompenses, casse, self-switch et détection Coop de l'effacement temporaire.

## Objets de terrain, amulettes et énigme ETERNO — 2026-10-16

Les 18 amulettes de type de Z utilisent maintenant un état personnel persistant
`typeAmulet`. L'usage depuis le Sac consomme une unité, refuse tout cumul et lance
un compteur de 500 pas ; les déplacements sur glace (terrain 12) ne le réduisent
pas. Le filtre est appliqué dans le noyau commun de tirage, donc aux rencontres de
marche, grotte, pêche et Éclate-Roc. Le Ruby source place l'effet sous un tirage à
50 % : une rencontre sur deux tente de limiter les slots aux espèces du type, puis
revient à la table normale si aucun slot ne correspond. Ce comportement parfois
moins fort que sa description est conservé volontairement.

Cet état, l'objet consommé et le compteur restent privés au joueur en solo, hôte,
invité ou excursion. Seule la rencontre déjà obtenue suit le contrat de combat
Coop existant ; aucune équipe, table filtrée ou amulette n'est publiée à la room.
La migration des anciennes sauvegardes initialise l'effet à `null`.

Le premier registre générique d'objets de terrain sensibles au lieu couvre aussi
`TALISMANMALVO`. Il ne se consomme pas : hors cible il affiche l'échec source ; en
Map190 `(74,25)` il active le switch 412. Sur le monde partagé, cette mutation est
réservée à l'hôte puis publiée avec le monde et les acteurs. Un invité en excursion
utilise le même noyau sur sa progression locale.

La chaîne de la `REGADERAMAGICA` n'est pas un handler du Sac dans Z : elle reste
portée par les fleurs de Map192/Map215. Le lecteur générique résout la possession,
le choix, l'animation 28, l'attente, la consommation, l'obtention du Talisman et le
switch 400. Son obtention en Map191 passe par le self-switch et `grant-item` déjà
communs.

Enfin, la condition Ruby `unown_check` est évaluée génériquement depuis l'équipe
persistante. Elle exige exactement six `UNOWN` dans l'ordre avec les formes
`[4,19,4,17,13,14]` (ETERNO). Les formes étaient déjà transportées par
`PersistentPokemon.metadata.form`; aucun état parallèle n'a été créé.

## Mini-jeu de fouilles — 2026-10-16

`pbMiningGame` est porté comme une vraie scène personnelle et non comme un tirage
d'objet. Le noyau reprend la grille source de 13 × 10 cases, les profondeurs de
roche de 2 à 6, les 61 variantes graphiques pondérées de trésors, les 13 formes de
métal, les règles anti-chevauchement et anti-doublon, ainsi que les 2 à 4 trésors
et 4 à 6 obstacles d'une paroi. Le burin frappe en croix et ajoute une fissure ; le
marteau frappe les neuf cases et en ajoute deux. Une pièce métallique exposée
arrête le coup central. À 49 fissures, la paroi s'effondre avant le verdict de fin.

La scène réutilise les feuilles `Mining/*` et les onze sons source. Elle accepte
clavier, souris et tactile : toucher une case la sélectionne et frappe, tandis que
les boutons de changement d'outil, de frappe et de sortie gardent une cible
tactile. Un compteur indique les trésors dégagés et leur éclat de découverte ne
se rejoue pas lors des coups suivants. Les trésors entièrement dégagés sont remis une seule fois au Sac, y
compris après un abandon ou un effondrement. L'entrée `Test dev > Mini-jeux >
Tester les fouilles` crée une paroi neuve sans exiger Marteau/Ciseau afin de rendre
le lot testable avant d'atteindre la Grotte de Las-Eau.

Le port Ruby transforme génériquement `pbMiningGame` en commande auditée
`open-mining`. Les événements réels de Map024 et Map132 utilisent donc la même
scène une fois leurs conditions source satisfaites. Autorité : plateau, commandes
et récompenses sont personnels en solo, chez l'hôte et chez l'invité ; aucune
mutation narrative ou donnée du Sac n'est publiée. Une séquence source est mise en
pause pendant la scène puis reprend après le règlement, sans seconde
implémentation Coop.

Tests : validité intégrale du catalogue, bornes de génération, absence de
chevauchement, révélation atomique, blocage par le métal, priorité de
l'effondrement et conversion/audit de `pbMiningGame`.

Restent explicitement hors de ce jalon : les interfaces Guide des
personnages/PokéObjectif, Succès et Méga-Évolution.

## Guide des personnages et audit PokéObjectif — 2026-10-16

Le Sac sait maintenant ouvrir le Guide des personnages depuis l'objet
`PERSONAJES`. Le catalogue reprend exactement les 30 entrées de
`guia-personajes.rb`, leurs noms, leurs chemins `infog_*.png` et la variable source
240. La v2.12 ne définit toutefois que deux seuils : Olivier au niveau 0, puis les
29 autres fiches dès le niveau 1. Le moteur conserve le seuil sur chaque entrée
pour accueillir une progression source corrigée sans refaire l'interface.

Les 30 images `Graphics/Pictures/infog_*.png` référencées par le Ruby ne sont pas
présentes dans l'installation française auditée. La vue responsive les charge si
elles deviennent disponibles, puis utilise automatiquement une illustration ou
une pose officielle déjà présente dans les dossiers `Pictures`/`Characters` du
jeu source. Olivier emploie ainsi `olivierPres.png` au lieu d'aboutir sur un
message d'asset absent. Chaque entrée possède une liste ordonnée de replis et la
fiche textuelle n'apparaît que si aucun de ces fichiers n'est disponible. Ne pas
copier ces images dans Git : elles restent servies depuis l'installation locale.
Autorité : catalogue source et variable narrative de
l'hôte dans un monde partagé ; domaine : lecture seule ; persistance : aucune
donnée supplémentaire ; réplication : aucune, chaque client projette la variable
narrative déjà synchronisée. En excursion, la progression locale est utilisée.

`POKEOBJETIVO` est bien déclaré comme objet important à usage terrain, mais aucun
`ItemHandlers`, appel Ruby, événement commun, catalogue d'objectifs ou illustration
associée n'existe dans les scripts, cartes ou assets de la v2.12 FR. Sa roue le
signale donc comme indisponible avec cette cause précise. Ne pas inventer une table
d'étapes à partir de numéros de cartes ou de switches : raccorder le même composant
de lecture lorsque des données source fiables seront fournies.

Restent hors de ce jalon : PokéObjectif faute de données source, Succès et
Méga-Évolution.

## Recherche globale du Sac — 2026-10-16

Le Sac possède une recherche instantanée placée au-dessus des poches. Une requête
non vide parcourt tous les objets possédés, même hors de la poche sélectionnée, et
présente directement les cartes d'objets sans recréer leurs dossiers virtuels. La
recherche est insensible aux accents et accepte plusieurs termes cumulés ; elle
porte sur le nom affiché, la description, l'identifiant interne et le nom français
de la capacité associée à une CT/CS. Les résultats conservent la roue d'actions
normale. Effacer la requête restaure la poche précédente ; choisir explicitement
une poche efface la recherche afin que la navigation reste compréhensible.

Cette fonction est une projection purement locale de l'inventaire personnel : elle
ne modifie aucune sauvegarde, n'envoie aucun message Coop et se comporte de la même
façon en solo, chez l'hôte et chez l'invité.

Le catalogue `Test dev > Gestion du Sac` possède également sa propre recherche
instantanée. Contrairement à celle du Sac, elle parcourt tous les objets du jeu,
y compris ceux que le joueur ne possède pas encore. Elle reprend les mêmes champs
(nom, description, identifiant et capacité de CT/CS), affiche la catégorie de
chaque résultat et sélectionne automatiquement la bonne poche avant le don. Une
recherche sans résultat ne peut jamais déclencher par erreur le don de toute une
catégorie. La quantité choisie reste mémorisée pendant le filtrage.

## Méga-Évolution — catalogue et contrat partagé, lot 1 — 2026-10-16

Le portage de la Méga-Évolution a commencé par les données et la règle métier,
avant toute commande d'interface. `prepare:local` produit désormais
`mega-evolutions.json` directement depuis `Pokemon_MegaEvolution` sans exécuter
le Ruby. L'installation v2.12 FR contient 106 espèces et 114 couples
espèce/Méga-Gemme/forme ; Charizard, Chesnaught, Delphox, Greninja et plusieurs
autres espèces ont plusieurs branches qui ne doivent donc jamais être ramenées à
une table « une espèce = une forme ».

Le même catalogue extrait également le contrat global : le joueur doit posséder
`BRAZALESPIRITUAL`, le switch 34 peut interdire la mécanique, une seule
Méga-Évolution est permise par propriétaire et par combat, les adversaires PNJ
n'ont pas besoin de l'objet d'activation, et Sky Drop bloque l'activation. Le
noyau pur `megaEvolutionEligibility` représente ces décisions sans dépendance au
DOM ou au client ; il est destiné à être appelé aussi bien par l'adaptateur solo
que par la room Coop autoritaire.

Contrairement à l'ancienne note de débogage, aucune capacité à connaître n'est
exigée par le code de Pokémon Z 2.12 : la branche est choisie par l'espèce et la
Méga-Gemme tenue. L'audit signale une anomalie source : `GROUDONITE` est utilisée
par la définition de Groudon mais absente d'`items.txt`. Ne pas inventer cet
objet ; garder cette branche indisponible tant qu'une donnée source corrigée n'est
pas fournie.

## Méga-Évolution — transport et intention de tour, lot 2 — 2026-10-16

Le catalogue `mega-evolutions.json` est maintenant chargé avec chaque carte. La
préparation d'équipe reconnaît une Méga-Gemme compatible, la conserve dans la
sauvegarde personnelle et projette dans le combattant uniquement le couple
`heldItem/form` requis par le combat. Elle ne fait plus passer cette gemme pour
un objet tenu non pris en charge. Le même chemin prépare les équipes locales,
les défis PvP, les participations Coop et les équipes de Dresseurs ; le repli de
compatibilité conserve également les réservistes KO au lieu de les écarter.

Le menu Attaque propose une commande Méga uniquement au porteur d'une gemme
compatible, si le Bracelet Spirituel est présent et si le switch source 34 ne
bloque pas la mécanique. Le choix est attaché à l'action de capacité sous la
forme stricte `megaEvolution: true` et traverse le même contrat de protocole en
solo et en room autoritaire. Les métadonnées de l'équipe et l'intention sont
validées par le protocole ; aucune donnée de sauvegarde privée n'est répliquée.

Ce lot ne transformait pas encore le Pokémon ; cette dette de résolution est
désormais couverte par le lot 3 ci-dessous. Les animations communes restent à
porter séparément.

## Méga-Évolution — résolution autoritaire, lot 3 — 2026-10-17

L'extracteur lit désormais, pour chacune des 114 branches, les statistiques de
base, types et talent déclarés dans `Pokemon_MegaEvolution`. La préparation du
combat recalcule les caractéristiques finales avec le niveau, les IV, les EV et
la nature du Pokémon. Au moment de résoudre le tour, le noyau commun applique la
forme avant le calcul de priorité et de dégâts, conserve les dégâts déjà subis
comme le `calcStats` source, puis produit l'événement autoritaire `megaEvolved`.
La présentation change immédiatement le sprite de forme et affiche le message ;
les animations communes source restent le lot suivant.

L'usage unique n'est pas attaché au camp mais au propriétaire. Le solo utilise
un propriétaire par côté ; le PvP lie chaque camp à son joueur ; une composition
Coop conserve l'identité du propriétaire de chaque Pokémon. Deux partenaires du
même camp peuvent donc chacun Méga-Évoluer une fois, mais un même joueur ne peut
pas transformer deux de ses Pokémon. Cet état est inclus dans le snapshot de
combat, survit aux changements de Pokémon et à une participation Coop tardive.
L'IA des Dresseurs utilise le même noyau et demande automatiquement sa
Méga-Évolution lorsqu'une branche compatible est disponible.

La transformation reste strictement temporaire : le règlement persistant ne
recopie que PV, statut, PP, bonheur et objets pertinents depuis la projection de
combat. Les statistiques, le talent et la forme Méga ne sont jamais inscrits dans
la sauvegarde personnelle.

Audit source : la branche `MAGEARNA:1` demande la forme 1, tandis que ses
remplacements de statistiques et de talent sont conditionnés par `form >= 2`.
Le catalogue signale cette incohérence dans `audit.fallbackCombatData` et reprend
les données de base pour la forme 1, sans corriger arbitrairement le Ruby. La
branche Groudon/GROUDONITE reste parallèlement indisponible faute d'objet source.

Le déroulé visuel et sonore des animations communes est couvert par le lot 4
ci-dessous. La dette restante concerne les effets des talents ou climats spéciaux
qui ne sont pas encore pris en charge par le moteur de combat général.

Correctif de chargement du 2026-10-17 : le premier rendu de l'application précède
volontairement le chargement asynchrone des données source. Le calcul de
disponibilité Méga accepte donc explicitement un catalogue absent et répond
`false` jusqu'à son arrivée. Ne pas réintroduire dans `renderEncounter()` un accès
direct à `importedAssets.megaEvolutions`, sous peine de bloquer l'écran initial et
le chargement du profil actif.

## Méga-Évolution — présentation source, lot 4 — 2026-10-17

La présentation solo et Coop consomme désormais le même événement autoritaire
`megaEvolved` et rejoue l'ordre observé dans `pbMegaEvolve` : message d'activation,
`Common:MegaEvolution` sur l'ancienne forme, changement de sprite et de profil de
combat, `Common:MegaEvolution2`, puis message final. Le lecteur commun restitue les
cellules de l'animation, le fond mobile `ebMegaBg.png`, le flash avant-plan
`PRAS- Flash FG.png`, les deux sons `PRSFX- Mega Evolution1/2` et le cri source
ralenti. La cible d'une animation commune sans cible explicite est correctement
ramenée sur son utilisateur, y compris pour un combattant adverse ou un second
slot de combat double.

L'extracteur conserve maintenant dans chaque timing de combat les coordonnées,
l'opacité, la couleur et la durée des plans avant/arrière. Cette brique est
générique et pourra servir aux autres animations `Common:*`; aucun frame Méga ni
nom de ressource n'est codé dans le moteur de présentation. Les références audio
sans extension sont résolues par le manifeste local afin d'éviter les 404.

Correctif de rendu du 2026-10-18 : plusieurs transitions d'un même plan peuvent
commencer à la même frame et ne modifier qu'une propriété chacune. Le lecteur
doit alors composer leurs effets propriété par propriété, sans réappliquer les
valeurs initiales des propriétés absentes. Ce défaut maintenait notamment
`ebMegaBg.png` transparent : sa transition horizontale annulait à chaque frame
la montée d'opacité du fond bleu ciel de la Méga-Évolution. Le fond mobile, son
fondu et les autres plans de l'animation sont désormais cumulés correctement.

## Cartes de l'équipe — identité et conditions — 2026-10-18

La variante utilisée par l'onglet Équipe du menu regroupe désormais sur une même
ligne le nom, le niveau mis en évidence et les seules icônes de type. Le statut et
l'objet tenu occupent une seconde ligne bornée, avant les PV. Cette structure
empêche ces informations optionnelles de repousser ou recouvrir les quatre cases
de capacités. Le composant partagé conserve sa présentation historique dans le
Ranch, la Pension et les sélections de combat grâce à l'option `teamLayout`.

## Méga-Évolution — audit de fermeture et talents déterministes, lot 5 — 2026-10-18

Le pipeline de combat crée désormais un périmètre ciblable pour chacune des 114
formes, sous la forme `mega:ESPECE:FORME`. `corepack pnpm audit:combat -- --scope
mega:CHARIZARD:1` contrôle donc automatiquement les capacités apprises, leurs
animations et le talent de la forme, avec le même rapport que pour une espèce ou
une équipe de Dresseur. Il n'existe plus de liste manuelle réservée aux Méga.

Le noyau autoritaire commun porte seize talents déterministes utilisés par ces
formes : Adaptabilité, Armurbaston, Œil Composé, Filtre, Poing de Fer,
Méga Blaster, Multiécaille, Neuroforce, Coque Armure, Multi-Coups, Sniper,
Solide Roc, Prognathe, Technicien, Isograisse et Griffe Dure. Les multiplicateurs
de dégâts, immunités aux critiques, précision et nombre de coups sont calculés
dans le même moteur en solo, chez l'hôte, chez l'invité et en PvP. Avec les
talents déjà portés, 40 des 114 formes ont maintenant leur talent intégralement
actif ; 74 formes correspondant à 46 talents distincts restent explicitement
auditées. Ce solde concerne le moteur de combat général (climats, terrains,
immunités, changements de type, réactions au contact ou au K.O.), pas un second
chemin spécifique aux Méga.

`prepare:local` produit aussi `mega-integration-report.json` après l'extraction
des événements. Le rapport relie les 112 Méga-Gemmes distinctes aux événements
qui les mentionnent et vérifie leur présence dans `items.json`, sans inventer de
don ni de boutique. Sur la v2.12 FR auditée, `BRAZALESPIRITUAL` est bien référencé
sur Map252. Trois gemmes n'ont aucune référence d'acquisition dans les événements :
`DURALUDONITA`, `GROUDONITE` et `RAYQUAZITE`; `GROUDONITE` est en plus absente du
catalogue d'objets. Elles doivent rester des anomalies source visibles et ne pas
être distribuées arbitrairement par le moteur.

La fermeture totale de la ligne de roadmap demande encore la résorption des
talents généraux signalés par l'audit et une recette manuelle des variantes de
forme. La transformation, son autorité Coop, sa restauration temporaire, ses
sprites et sa séquence audiovisuelle sont déjà couverts par les lots 1 à 5.

## Méga-Évolution — types, immunités et Sans Limite, lot 6 — 2026-10-18

Le type réellement utilisé par une capacité est maintenant résolu une seule fois
par le noyau partagé. Aéilate, Peau Féérique, Peau Gelée et Hydrata-Son
convertissent les capacités Normal dans l'ordre exact de `pbModifyType`, puis leur
bonus source de 20 % alimente dégâts, STAB, table des types, objets et ciblage.
Particularité confirmée dans Z 2.12 : Hydrata-Son ne vérifie pas le drapeau sonore
et convertit toute capacité Normal ; ne pas le remplacer silencieusement par la
règle des jeux officiels.

Lévitation annule les capacités Sol, Querelleur traverse l'immunité Spectre et
Anti-Bruit bloque les capacités portant le drapeau sonore avant leur jet de
précision. Sans Limite applique son bonus de 30 %, supprime l'effet secondaire et
le recul de l'Orbe Vie conformément au Ruby source. Brise Moule traverse déjà ces
immunités, Peau Sèche, Contraguardia, les immunités aux critiques, Filtre,
Solide Roc, Multiécaille, Isograisse et la combinaison Écran Poudre/Cape Obscure.
Il reste classé `partial`, car son contrat devra automatiquement englober les
prochains talents défensifs ajoutés au moteur.

Après régénération, 59 des 114 formes Méga ont un talent totalement pris en
charge. Les 55 formes restantes dépendent de 38 talents distincts encore absents
ou partiels. L'audit global passe de 628 à 620 problèmes ; les nombreuses lignes
de capacités concernent aussi les attaques apprises par niveau et doivent être
résorbées par lots verticaux, sans inventer de comportement propre aux Méga.

## Lot vertical Route 3 → Bois-en-Tronc — P0 automatisé — 2026-10-19

Le périmètre Maps 023 à 029 est raccordé au pipeline de combat : Rena, Gerard,
Amarna, Fibo, Hector et Zaida, Maya, Asta, les trois variantes de Crisanto et les
rencontres naturelles jusqu'au niveau 18 sont constructibles sans suppression de
capacité. La condition Ruby `$Trainer.ablePokemonCount == 1` possède un parseur
strict et compte uniquement les membres conscients non-Œufs. Elle choisit donc
génériquement le combat simple/double de Route 4 et de la Clairière sans règle de
carte ni d'événement.

Le noyau partagé ajoute les fonctions `008`, `033`, `04C`, `04F`, `0BD`, `0D5`,
`09D` et `0A3`, plus les supports nécessaires aux capacités de bas niveau des
rencontres. Mur Lumière et Lance-Boue résident dans le snapshot tactique et sont
décrémentés en simple comme en double. Battant, Médic Nature, Farceur, Peau
Herbée, Herbivore, Inconscient et Absorb Eau sont actifs dans le même calcul
autoritaire. Le protocole accepte exactement les mêmes fonctions ; aucune voie
locale parallèle n'a été créée.

`pbBossFight` est maintenant porté comme rencontre scénarisée hôte-autoritaire,
y compris la forme dont l'espèce vient d'une liste indexée par `pbGet(variable)`.
Les affectations source de musique/fond sont acceptées comme dette de
présentation, sans exécuter Ruby. Une récompense `pbReceiveItem([...][rand(n)])`
reste tirée par l'autorité à partir du RNG persistant, puis est stockée avec les
switches dans `pendingEncounter` et n'entre dans l'inventaire qu'après victoire.
Une reconnexion avant le combat ne peut donc ni reroll ni accorder la récompense
en avance. L'invité voit le combat via le snapshot partagé mais ne peut déclencher
la narration ni recevoir le Sac de l'hôte.

Les anciennes dettes de mécanique partielle et de deux-contre-un ont été fermées
par les sous-lots suivants. `THIEF` reste seulement dépourvu de mapping visuel
source et emploie son fallback. Les profils de statistiques de boss de la
variable 300 sont portés par la rencontre persistante. La recette Maps 023 à 029,
les deux nids compris, a été validée manuellement avec les assets locaux le
2026-10-19 ; ce parcours peut désormais être annoncé comme fonctionnellement clos.

## Modificateurs narratifs initiaux de rencontre — Exténuation — 2026-10-19

Le retour manuel sur le badge français `EXT` a révélé une séparation incomplète :
le noyau portait bien le statut interne `caduco`, mais les rencontres créaient
toujours un adversaire sain. `prepare:local` extrait désormais
`encounter-modifiers.json` depuis les hooks `Events.onWildPokemonCreate`, sans
exécuter leur Ruby. Les règles conservent leurs conditions de carte, d'espèce et
de switch narratif avec leur provenance source.

Les deux règles de statut présentes dans Z 2.12 FR sont raccordées : tous les
Pokémon sauvages des Maps 138 à 140 commencent exténués, et Couafarel commence
exténué lorsque le switch source 482 arme son combat scénarisé à Nouvelle
Réunion. Le résolveur ne contient ni numéro de carte, ni switch, ni espèce codés
à la main : il applique le catalogue extrait avant de construire l'équipe adverse.
Le statut entre ainsi dans le snapshot tactique autoritaire commun au solo et à
la room Coop, est visible par tous les participants et survit à une reconnexion.
S'il s'agit d'une rencontre capturable, le règlement personnel conserve le statut
du Pokémon comme les autres altérations majeures.

Le nom interne reste `caduco` pour correspondre au Ruby et à l'animation
`Common:Caduco`, mais toutes les surfaces françaises doivent afficher
`Exténuation` ou le badge source `EXT`. Son effet est celui de Z : sous la moitié
des PV, la cible reçoit 50 % de dégâts supplémentaires.

Règle de reprise issue de ce défaut : un combat narratif n'est pas validé par la
seule construction de son espèce et de ses capacités. L'audit vertical doit aussi
contrôler les hooks de création et les préparatifs de l'événement : statut, forme,
PV, niveau, capacités forcées, talent, objet, IV/EV, profils de statistiques,
capture/fuite et effets post-combat.

Extension du même jalon : le catalogue transporte maintenant toutes les mutations
statiques trouvées dans `onWildPokemonCreate` : forme, apprentissages silencieux
dans l'ordre exact de `pbLearnMove`, IV, EV, objet tenu, shiny et surnom. Dix-neuf
règles sont extraites pour Z 2.12 FR. Elles couvrent notamment les préparations de
Hoopa, Noadkoko, Zygarde et les boss armés par le switch 482 (Auretosk, Tortank,
Sulfura, Artikodin, MissingNo, Lugia, Monthracite, M. Mime, Ursaring, Xerneas et
Yveltal). Les statistiques sont recalculées avant projection et l'équipe adverse
déjà modifiée devient l'unique donnée envoyée à la room.

`encounter-modifiers.json.audit.unsupported` conserve deux effets non appliqués :
les shiny conditionnés par des contextes runtime non encore répliqués (switch nommé
de debug et case de Poké Radar). Ces cas ne doivent jamais devenir des règles
globales par défaut. Le niveau dynamique de la Map999 et les profils de statistiques
de boss préparés par la variable source 300 sont maintenant portés avec leur RNG,
leur consommation one-shot et leur snapshot tactique persistants.

## Lot vertical Route 3 → Bois-en-Tronc — fidélité des nids — 2026-10-19

Les deux nids du lot Maps 023 à 029 ont maintenant leur contrat complet de départ.
Une rencontre issue de `pbBossFight` ouvre un vrai combat asymétrique double quand
l'équipe préparée contient au moins deux Pokémon : deux actifs du joueur contre
le seul boss. Le même `TeamBattleState` alimente le contrôleur local et la room
autoritaire. Un invité déjà présent reçoit donc le snapshot et la présentation,
mais ne peut rejoindre un combat qui occupe déjà le format double. L'état tactique,
les PV, les rangs et l'espèce sélectionnée restent restaurables après reconnexion.

Les rangs positifs préparés par `$game_variables[300]` sont appliqués au seul boss
et déclenchent au démarrage le message et l'effet commun de hausse de statistiques.
L'opérande RPG Maker `random` de `change-variables` est exécuté par le RNG persistant
de l'état narratif : la variable 183 du nid insecte est choisie une seule fois par
l'autorité, avant la création de la rencontre. Les récompenses restent différées
jusqu'à la victoire et personnelles à l'hôte.

La commande source `set-event-location` appartient désormais au registre comme
mouvement exécuté. Elle repositionne instantanément l'acteur de scène, annule son
mouvement précédent, puis republie poses et scène aux joueurs de la carte. Cela
débloque notamment la suite narrative de Couafarel sans règle liée à Map024 ou à
un numéro d'événement particulier. L'audit régénéré reconnaît les 317 occurrences
de cette commande dans le jeu source.

Test dev expose `TP nid de Couafarel` (Map024) et `TP nid insecte` (Map028). Ces
raccourcis ne touchent ni aux switches, ni aux variables, ni aux self-switches :
ils exigent une sauvegarde dont la page narrative du nid est encore active. La
recette manuelle solo/hôte/invité de ces raccourcis et du parcours a été validée
avec les assets locaux le 2026-10-19.

### Correctif du nid insecte — Dardargnan et Dard-Venin (`0BE`) — 2026-10-19

La sélection aléatoire de Dardargnan niveau 17 atteignait correctement le moteur,
mais la construction de son équipe échouait sur `TWINEEDLE` (`0BE`). La fonction
est désormais portée dans le noyau partagé : deux impacts exacts et une tentative
d'empoisonnement de 20 % après chaque impact réussi. Sérénité, Sans Limite,
Écran Poudre/Cape Obscure et Corrosion suivent les contrats déjà utilisés par les
autres effets secondaires. Le type, la projection personnelle, le validateur du
protocole Coop et l'audit de l'extracteur reconnaissent tous le même code ; il
n'existe donc pas de contournement propre au nid ou à Dardargnan.

Après `prepare:local`, l'audit `pokemon:BEEDRILL` ne signale plus `TWINEEDLE` et
le set calculé au niveau 17 est constructible. Les autres alertes du périmètre
complet de l'espèce concernent des apprentissages ultérieurs et ne bloquent pas
cette rencontre.

### Correctif de cycle des combats doubles scénarisés — 2026-10-19

Le rapport manuel `local-28-1` a montré qu'un actif K.O. restait sélectionnable :
son sprite pouvait revenir après l'animation et l'interface acceptait encore une
action inopérante pour son ancien slot. Les emplacements visuels restent désormais
stables pendant tout le combat : un K.O. sans réserve laisse un slot vide afin que
son allié ne glisse pas de droite à gauche. Le contrôleur, l'interface et le
validateur du noyau excluent toutefois ce slot des actions attendues. Cette règle
appartient au `TeamBattleState` partagé et couvre donc solo, hôte, invité et
reconnexion.

La présentation respecte aussi les combats asymétriques : chaque camp choisit son
propre placement. Deux Pokémon du joueur utilisent les positions doubles tandis
qu'un boss sauvage unique reste centré sur son support. Les animations de capacité
et de statut reçoivent le slot de leur véritable acteur au lieu de retomber sur le
slot gauche par défaut.

La victoire d'une rencontre lancée depuis une séquence source ne déclenche plus
l'audit d'autorun intermédiaire du contrôleur de combat. La séquence propriétaire
reprend d'abord ses commandes post-combat, consomme la rencontre, puis effectue
elle-même l'audit à sa finalisation. Cela empêche une page nouvellement active de
s'intercaler et de relancer le combat avant les récompenses ou le self-switch.

### Stabilisation Coop des combats doubles scénarisés — 2026-10-19

Un combat source qui est déjà double n'ouvre plus de fenêtre de jonction : ses
deux emplacements tactiques sont déjà occupés par la scène. Il reste masqué à
l'autre joueur, qui poursuit librement son exploration. Celui-ci doit se placer à
côté du meneur et interagir avec lui pour devenir spectateur et recevoir le
snapshot autoritaire ; toute intention de participation reste refusée par le
noyau et par la room.

Pour les combats simples encore rejoignables, une proposition est désormais
bloquée dès qu'une action simple/double ou un remplacement est en attente. La
conversion en double conserve le tour, les effets de terrain et de camp, les
objets de Dresseur et l'utilisation de la Méga-Évolution. Les talents d'entrée des
combattants déjà sur le terrain ne sont pas rejoués ; seuls les nouveaux entrants
peuvent les déclencher.

Le client compare maintenant la structure complète des camps (format, identités
et nombre de slots actifs), y compris lorsqu'elle était déjà double. Il invalide
les actions locales soumises puis rejoue une seule présentation de jonction. Le
rendu des battlers est sérialisé afin qu'un ancien chargement d'image ne puisse
plus terminer après le nouveau snapshot et réafficher une mauvaise composition.
Les remplacements ordinaires à nombre de slots constant restent traités par leur
événement dédié et ne sont pas confondus avec une jonction.

La recette dédiée du vrai combat duo utilise Hector et Zaida sur la Route 4
(Map027, événement 12). Le jeu source les déclare comme `DUOMOSQUETERO` et lance
nativement le format double quand le joueur possède au moins deux Pokémon. Le
raccourci `TP duo Hector et Zaida` place le joueur devant eux sans modifier
l'histoire. En Coop, l'hôte peut appeler l'invité avant le premier tour : le
Pokémon actif de l'invité remplace alors le second actif de l'hôte, qui reste en
réserve, et les deux adversaires du duo demeurent actifs. Le camp reste donc
strictement limité à deux combattants simultanés. Les combats sauvages déjà
doubles, dont le nid insecte, restent non rejoignables et seulement observables.
L'audit de dépendances de ce duo a aussi conduit au port générique de `PROTEAN` :
le Pokémon adopte le type de sa capacité juste avant son exécution, dans le même
noyau autoritaire pour le solo, l'hôte et l'invité.

Le Worker multijoueur possède désormais une frontière d'erreur CORS au niveau de
l'adaptateur HTTP et de chaque Durable Object. Une exception de production ne se
présente donc plus au client comme un faux blocage CORS : elle renvoie
`WORKER_INTERNAL_ERROR` ou `ROOM_INTERNAL_ERROR`, un détail borné affiché dans le
menu Coop, et écrit la trace complète dans l'observabilité Cloudflare.

Correctif quota Durable Objects du 2026-10-19 : le Worker ne persiste plus la
room entière après chaque paquet WebSocket. `moveAvatar` et `setSourceActors`
sont regroupés en un checkpoint 1,5 seconde après la fin d'une rafale, avec un
plafond de 30 secondes pendant un mouvement continu. `emitSourceSound`, `ping`
et `requestSnapshot` ne déclenchent aucune écriture. Les mutations de gameplay,
de narration et de combat restent write-through. Cette frontière conserve la
reconnexion autoritaire tout en supprimant l'écriture SQLite par pas, mouvement
de PNJ ou effet sonore qui épuisait les 100 000 rows written du niveau gratuit.

## Priorité produit — portage fonctionnel des Pokémon — 2026-10-19

Le porteur demande de faire passer le portage complet des Pokémon et de leurs
mécaniques avant les améliorations de qualité de vie UI/UX. Ne pas reprendre le
Multi-EXP, le renommage, le rangement avancé de l'équipe ou une refonte visuelle
tant qu'ils ne bloquent pas une recette fonctionnelle.

La reprise doit continuer par lots verticaux du parcours avec
`battle-integration-report.json` : espèces sauvages et équipes de Dresseurs,
puis capacités, talents, objets tenus, statuts, formes/évolutions et animations
dont elles dépendent. La règle reste générique et partagée par le solo et la room
Coop ; ne jamais créer une implémentation propre à une espèce ou à un Dresseur.
Avant de fermer un lot, relancer `prepare:local`, auditer ses scopes, couvrir les
dépendances signalées et consigner honnêtement tout support partiel.

## Route 3–Route 4 — fermeture des mécaniques partielles — 2026-10-19

Les douze codes encore classés `partial` dans le lot Route 3–Bois-en-Tronc sont
fermés dans le noyau de combat partagé : `021`, `049`, `082`, `083`, `093`,
`098`, `09C`, `0DC`, `0F1`, `0F4`, `0FA` et `110`. Les règles ont été relues
dans `083-81220597-pokebattle-moveeffects.rb` puis portées génériquement : durée
et consommation de Chargeur, nettoyage complet d'Anti-Brume/Tour Rapide,
Assurance après dégât, enchaînement de Chant Canon, paliers exacts de Fléau,
Coup d'Main, drain de Vampigraine vers la position source, vol/consommation
d'objet et recul avec immunités.

Autorité et état : le resolveur local en solo et la room autoritaire en Coop
emploient le même `BattleState`. Les compteurs volatils, effets de camp, terrain,
pièges et provenance positionnelle de Vampigraine font partie du snapshot
tactique minimal et sont donc restaurés après reconnexion. Les événements de
présentation sont adressés aux participants du combat. Les objets personnels ne
sont réglés qu'à la fin : un transfert par Larcin/Implore est annulé contre un
Dresseur et conservé dans un combat sauvage ; ce choix est partagé par les
adaptateurs solo et Coop, sans seconde implémentation métier.

`prepare:local` régénère maintenant un rapport à 81/353 fonctions supportées et
zéro fonction `partial`. Les douze codes ne produisent plus d'issue mécanique.
Toutes leurs animations mappées sont importées ; seule `THIEF` reste sans mapping
dans `move2anim.dat` et utilise donc le fallback, sans animation inventée. Le
catalogue des objets tenus demeure une frontière explicite : Piqûre/Picore sait
consommer les Baies admises par le moteur, et les familles de Baies futures
seront ajoutées avec leur propre lot d'objets.

Validation du porteur le 2026-10-19 : Maps 023 à 029 et les deux nids fonctionnent
avec les assets locaux. Le lot Route 3–Route 4/Bois-en-Tronc est donc clos côté
automatisation, fidélité mécanique et recette manuelle.

## Route 5 — premier sous-lot et audit par carte — 2026-10-19

La reprise suivante est engagée sur Maps 055–056. `audit:combat` accepte le scope
`map:55` ou `map:56`, construit depuis `encounters.json` et les événements extraits.
Il tient compte du niveau réellement rencontré, des capacités explicites des
Dresseurs et de leur index de talent ; il ne remonte donc plus arbitrairement les
attaques de niveau 99 ou les talents cachés d'une espèce de bas niveau.

Six fonctions requises sont terminées dans le noyau commun : `010`, `02D`, `064`,
`06D`, `086` et `0F0`. Elles couvrent peur d'Écrasement, cinq hausses de Pouvoir
Antique, remplacement prudent du talent par Soucigraine, dégâts fixes et immunité
d'Ombre Nocturne, puissance sans objet d'Acrobatie, puis puissance et perte
temporaire d'objet de Sabotage. Les nouveaux événements `abilityChanged` et
`heldItemRemoved`, ainsi que la provenance de l'objet, sont validés par le
protocole et présentés à tous les participants. L'objet personnel est restauré au
règlement ; le noyau et l'état tactique sont identiques en solo et dans la room.

### Route 5 — fermeture automatisée des dépendances — 2026-10-19

Le noyau commun porte maintenant `091`, `095`, `069`, `0B3`, `0D1`, `0D3` et
`0F8` : Taillade/Roulade conservent et réinitialisent leurs compteurs, Ampleur
utilise la distribution source, Brouhaha verrouille l'action et réveille les
Pokémon, Embargo bloque objets tenus et objets de Dresseur, et Morphing copie le
combattant puis restaure l'identité originale au retrait. Force Nature choisit
sa capacité depuis un champ `environment` générique alimenté par les rencontres
terrestres, grottes et pêche ; ce champ voyage avec le snapshot autoritaire.

Les talents de Map055–056 sont actifs dans les chemins simple et double : entrée
(Imposteur, Créa-Herbe, Intimidation), contact (Corps Ardent, Peau Dure, Poisseux),
statut (Vaccin, Feuille Garde, Tempo Perso), vitesse météo (Chlorophylle,
Glissade), Phobique et Fuite. Les remplacements restaurent Morphing et rejouent
les talents d'entrée ; la room Coop emploie ces mêmes fonctions sans logique
cliente parallèle. Le protocole accepte les nouveaux codes et compteurs.

Validation automatique : `prepare:local` réussit, `audit:combat -- --scope map:55`
retourne 0 alerte et `map:56` conserve uniquement `FAINTATTACK · not-mapped`.
Cette dernière absence est présente dans la source `move2anim.dat` et doit rester
signalée avec le fallback visuel, jamais être masquée ou inventée. Les tests et le
build du monorepo passent. Le lot est terminé côté code mais ne doit être coché
comme fermé qu'après validation manuelle des cinq Dresseurs/rencontres en solo,
hôte, invité et après reconnexion.

## Clairière Collinaire — combat narratif de Núbila — 2026-10-19

Le combat de Map046/EV020 atteignait bien `request-trainer-battle`, mais la
construction de l'équipe de `NUBILA1:Núbila:0` était refusée avant l'ouverture du
combat. Deux causes se cumulaient : l'index de talent source suivait la convention
Essentials (slots normaux 0/1, talents cachés à partir de 2), tandis que le pont
runtime décalait les talents cachés selon le nombre réel de talents normaux ; puis
plusieurs dépendances tactiques de l'équipe n'étaient pas encore portées.

Le pont interprète désormais correctement le slot caché `2`, même lorsqu'une
espèce ne possède qu'un seul talent normal. Le noyau partagé porte Acidarmure
(`02F`, Défense +2), Gyroballe (`08D`, puissance issue du rapport des Vitesses),
Ignifugé (`HEATPROOF`, dégâts Feu divisés par deux), Alchimie Vil
(`ALQUIMIAVIL`, dégâts de poison adverses doublés) et la Baie Lichii, avec le
seuil à la moitié des PV sous Gloutonnerie. Ces états et événements utilisent le
même contrat en solo et dans la room autoritaire.

Un test d'intégration reconstruit les trois Pokémon et l'inventaire exacts de
Núbila afin d'empêcher toute régression du déclenchement. Après `prepare:local`,
`audit:combat -- --scope trainer:NUBILA1:Núbila:0` ne conserve que
`LUZDECADENTE · not-mapped` : cette absence vient de `move2anim.dat`, n'empêche
pas le combat et doit employer le fallback visuel existant sans animation
inventée. La reprise narrative doit être validée manuellement sur Map046, puis
en hôte et invité si la scène est jouée en Coop.

## Bois-en-Tronc — sauts scénarisés des PNJ — 2026-10-19

Le retour `Map030 · EV026 crisanto · étape 155/188` correspond à la scène source
de Map029/EV026 : après le remède, l'ancienne (`event 32`, sprite `anciana`)
effectue des sauts horizontaux de 2, 2 puis 4 cases. Le moteur traitait jusque-là
la commande de route `jump` comme un pas au sol, avec la durée fixe d'une case ;
le dernier saut ressemblait donc à une téléportation/glissade et aucun arc
vertical n'était rendu.

Les routes exposent désormais explicitement la nature `jump` du déplacement. Le
contrôleur de PNJ emploie la même interpolation en arc que les autres transitions
aériennes et dimensionne la durée selon la distance réelle, y compris pour un
saut sur place. Le décalage vertical fait partie de la pose de cinématique
répliquée : l'hôte et l'invité voient donc le même arc, sans seconde logique
cliente. Les tests couvrent la commande, un saut scénarisé de quatre cases et la
réception du décalage vertical par un invité Coop. La scène Map029/EV026 reste à
rejouer manuellement depuis une sauvegarde antérieure à la démonstration.

## Talents météo partagés - 2026-10-21

Le noyau commun porte maintenant les quatre talents d'entrée météo `DRIZZLE`,
`DROUGHT`, `SANDSTREAM` et `SNOWWARNING`, ainsi que `ICEBODY`, `RAINDISH`,
`SANDFORCE`, `SANDRUSH`, `SANDVEIL`, `SNOWCLOAK` et `SOLARPOWER`. `DRYSKIN`
est aussi fermé : son absorption Eau et sa vulnérabilité Feu préexistantes sont
complétées par le soin sous pluie et les dégâts sous soleil.

La météo, sa durée et ses effets restent dans `BattleEffects`, donc dans le même
snapshot tactique restauré après reconnexion. En solo l'adaptateur local et en
Coop la room autoritaire appellent le même noyau ; aucune nouvelle intention
cliente n'est nécessaire, car le talent se déclenche à l'entrée autoritaire. Les
événements de changement de météo, soin et dégâts sont présentés aux participants
du combat. Le calcul commun couvre vitesse, esquive, modificateurs Feu/Eau,
Force Sable, Force Soleil et les défenses météo propres au jeu source.

La fidélité Z est volontaire : le sable inflige 1/16 aux cibles non immunisées,
la grêle n'inflige pas de dégâts dans ce projet source, les types Roche gagnent
1,5 en Défense Spéciale sous sable et les types Glace 1,5 en Défense sous grêle.
Les roches de prolongation ne sont pas encore dans le catalogue d'objets tenus ;
les talents posent donc les 5 tours des nouvelles mécaniques.

Après `prepare:local`, le rapport passe de 474 à 462 problèmes globaux et de 122
à 110 problèmes de talents. Le registre compte 123 talents supportés, 1 partiel
(`STURDY`) et 131 absents sur 255. Les fonctions d'attaque restent à 102/353,
sans fonction partielle. Les tests ciblent le simple, le double et l'état
autoritaire partagé ; la suite complète et le build du monorepo doivent être
relancés avant livraison.

## Contrôle météo, grêle et météos extrêmes - 2026-10-21

Le second lot météo ferme `SLUSHRUSH`, `PODERGELIDO`, `OVERCOAT`, `AIRLOCK` et
`CLOUDNINE`. Glissade Neige et Pouvoir Gelé partagent le multiplicateur de
Vitesse sous grêle ; Pouvoir Gelé ajoute aussi le multiplicateur Glace de 1,5.
Envelocape protège du sable et des capacités portant le drapeau poudre `l`, avec
le contournement attendu par Brise Moule. Les types Plante et les Lunettes
Filtre restent protégés indépendamment du talent.

Air Lock et Ciel Gris n'effacent pas `BattleEffects.weather` : ils en neutralisent
les effets tant qu'au moins un porteur conscient est actif. En double, cette
décision est dérivée des quatre emplacements avant l'ordre, les dégâts et les
passifs de fin de tour. L'état sous-jacent continue donc à perdre ses tours et
reste restaurable après reconnexion. Il n'existe ni intention cliente ni chemin
Coop séparé pour cette règle.

Le noyau accepte aussi les trois talents source absents du catalogue de données
actuel : `PRIMORDIALSEA`, `DESOLATELAND` et `DELTASTREAM`. Leur météo est stockée
avec `weatherTurns: -1`, bloque respectivement les attaques Feu ou Eau, ou
neutralise les faiblesses du type Vol. Une météo ordinaire ne peut pas les
remplacer ; elles prennent fin lorsque leur dernier porteur conscient quitte le
terrain. Le snapshot autoritaire et la présentation comprennent cette durée
persistante.

Après `prepare:local`, le rapport passe de 462 à 457 problèmes globaux et de 110
à 105 problèmes de talents. Le registre extrait compte 128 talents supportés,
1 partiel (`STURDY`) et 126 absents sur 255. Les trois talents de météo extrême
sont annoncés par le moteur mais ne gonflent pas artificiellement ce dénominateur,
car ils ne figurent pas dans les 255 définitions extraites. Les fonctions
d'attaque restent à 102/353, sans fonction partielle. Les tests couvrent le solo,
le double, l'hôte autoritaire et la restauration d'un invité après reconnexion.

## Passifs de statut et de fin de tour - 2026-10-21

Le noyau partagé porte maintenant `BADDREAMS`, `EARLYBIRD`, `HYDRATION`,
`POISONHEAL` et `SPEEDBOOST`. Matinal divise immédiatement par deux, avec arrondi
inférieur et minimum un, la durée de tout sommeil appliqué par une capacité, un
talent ou Bâillement. Hydratation soigne le statut avant les dégâts résiduels sous
pluie normale ou pluie extrême ; Air Lock et Ciel Gris la neutralisent comme les
autres effets météorologiques.

Soin Poison remplace les dégâts de poison simple ou grave par un soin de 1/8 des
PV maximaux et conserve l'avancement du compteur toxique. Mauvais Rêve retire
1/6 des PV maximaux à chaque adversaire endormi, respecte Garde Magik et ne se
cumule pas lorsque les deux adversaires le possèdent en combat double. Impulsion
augmente la Vitesse d'un cran à la fin de chaque tour entièrement passé sur le
terrain. Un marqueur volatil répliqué distingue une arrivée volontaire en cours
de tour afin de ne pas déclencher ce gain trop tôt ; il est effacé au terme du
tour et n'affecte pas un remplacement effectué entre deux tours.

Ces règles sont utilisées par le résolveur simple et les quatre emplacements du
résolveur double. En Coop, les intentions restent inchangées : la room applique
les passifs, publie les événements communs et conserve statut, PV, crans et
marqueur temporaire dans son snapshot. Un test de reconnexion vérifie notamment
la restauration du cran accordé par Impulsion.

Après `prepare:local`, le rapport passe de 457 à 452 problèmes globaux et de 105
à 100 problèmes de talents. Le registre extrait compte 133 talents supportés,
1 partiel (`STURDY`) et 121 absents sur 255. Les fonctions d'attaque restent à
102/353, sans fonction partielle.

## Contrôle des PP et des objets par talent - 2026-10-21

Le noyau partagé porte maintenant `PRESSURE`, `UNNERVE` et `KLUTZ`. Pression
ajoute un PP au coût d'une capacité qui cible un porteur adverse. En combat
double, le coût est calculé une seule fois pour l'action et ajoute un PP pour
chaque porteur effectivement ciblé ; une capacité de zone conserve toutes ses
cibles même si ce coût épuise ses derniers PP. Les capacités personnelles ou
alliées ne sont pas surtaxées. L'annonce d'entrée de Pression est produite par le
même noyau que les autres talents d'entrée.

Tension bloque l'activation des baies portées par tous les adversaires actifs,
y compris lorsque le porteur du talent est le partenaire de l'attaquant. La baie
reste équipée et peut donc s'activer dès que le dernier porteur de Tension quitte
le terrain. Maladresse et l'état Embargo passent par le même prédicat générique
d'activité de l'objet : bonus offensifs et défensifs, soins, dégâts, protection,
casque et Lunettes sont neutralisés sans supprimer l'objet. La présence brute de
l'objet reste disponible pour les règles qui l'observent ou le retirent, comme
Sabotage et Picore/Implore ; une baie volée est consommée, mais son effet est
neutralisé si le consommateur possède Maladresse ou subit Embargo.

Ces règles sont partagées par le duel, le combat double et la room autoritaire.
Les intentions réseau ne changent pas : le serveur calcule le coût en PP et les
activations d'objet, puis réplique les combattants résultants. Un test de room
vérifie qu'une capacité utilisée contre Pression coûte deux PP et que cette valeur
est restaurée après reconnexion. Les tests doubles couvrent deux porteurs de
Pression, le dernier PP disponible et le blocage d'une baie par le partenaire
doté de Tension.

Après `prepare:local`, le rapport passe de 452 à 449 problèmes globaux et de 100
à 97 problèmes de talents. Le registre extrait compte 136 talents supportés,
1 partiel (`STURDY`) et 118 absents sur 255. Les fonctions d'attaque restent à
102/353, sans fonction partielle ; les 51 animations de capacité manquantes sont
inchangées.

## Cycle de vie des objets consommés - 2026-10-21

Le noyau partagé porte maintenant `UNBURDEN`, `PICKUP` et `HARVEST`. Toute perte
d'objet active le marqueur temporaire de Délestage ; le multiplicateur de Vitesse
x2 ne s'applique que si le porteur n'a toujours aucun objet et le marqueur est
effacé lorsqu'il quitte le terrain. Les consommations normales enregistrent en
plus l'objet recyclable et un ordre monotone de consommation. Sabotage, Larcin,
Picore/Implore et Pickpocket activent bien Délestage, mais seuls les chemins qui
appellent `pbConsumeItem` avec les options source alimentent Recyclage et
Ramassage.

Ramassage cherche à la fin du tour le dernier objet consommé par un autre
combattant actif. Le comportement est partagé entre duel et double ; en double,
les quatre emplacements participent au même ordre de consommation. Le marqueur
du donneur et son objet recyclable sont retirés lorsque l'objet est ramassé.
Cueillette restaure uniquement une baie normalement consommée, avec 50 % de
chance par tour ou une réussite garantie sous soleil normal ou extrême. Une baie
récupérée est immédiatement réévaluée comme dans `pbBerryCureCheck`, notamment
pour les seuils de PV, Tension et Gloutonnerie.

L'objet recyclable appartient à l'état persistant du Pokémon pendant le combat ;
Délestage et la candidature à Ramassage restent volatils et sont remis à zéro au
switch. Le compteur global est porté par les effets du combat. Ces trois niveaux
sont répliqués par la room autoritaire et acceptés par la validation du protocole.
Un test hôte/invité vérifie qu'une Baie Oran consommée, son état recyclable et le
marqueur Délestage sont restaurés après reconnexion. Les tests doubles couvrent
la sélection du dernier objet parmi deux consommations concurrentes.

Après `prepare:local`, le rapport passe de 449 à 447 problèmes globaux et de 97
à 95 problèmes de talents. `HARVEST` n'est pas encore référencé par les 232
talents candidats du périmètre jouable, mais il améliore bien le registre source
complet : 139 talents supportés, 1 partiel (`STURDY`) et 115 absents sur 255. Les
fonctions d'attaque restent à 102/353 et les 51 animations manquantes sont
inchangées.

## Contrôle des actions et réflexion - 2026-10-21

Le noyau partagé porte maintenant `OBLIVIOUS`, `STENCH`, `CURSEDBODY`,
`INFILTRATOR` et `MAGICBOUNCE`. Benêt empêche Attraction et Provoc lorsqu'elles
sont appliquées sans Brise Moule, puis purge aussi ces deux états si le talent est
acquis ou restauré alors qu'ils sont déjà présents. Puanteur effectue le tirage
source après une capacité offensive, respecte Attention ainsi que la combinaison
Écran Poudre plus Cape Obscure propre à Z, et exclut les codes de fonction qui
possèdent déjà un effet intrinsèque d'apeurement.

Corps Maudit effectue un tirage à 30 % après des dégâts directs et désactive pour
trois tours la capacité qui vient de toucher le porteur. Le marqueur Disable est
le même que celui de la capacité Entrave, donc la sélection, le passage de tour,
le switch et la réplication ne créent pas une seconde implémentation. Infiltration
ignore Mur Lumière et Protection dans le calcul commun des dégâts, ainsi que Rune
Protect lors de l'application d'un statut. Clonage n'étant pas encore une fonction
d'attaque portée, son contournement reste hors du chemin exécutable actuel plutôt
que simulé par une exception.

Miroir Magik ne réfléchit que les capacités marquées par le drapeau `c`
`canMagicCoat?` des données source. Le porteur devient la source de l'effet et
l'utilisateur initial sa cible ; précision, immunités, Benêt et Rune Protect sont
donc réévalués dans ce sens. Brise Moule empêche cette réflexion. La règle passe
par le résolveur partagé utilisé par chaque mini-duel du combat double, ce que
couvre un test sur cible positionnée.

En Coop, l'hôte ou le serveur reste autoritaire sur les tirages, la cible finale
et les états volatils. Les invités ne transmettent que leur intention de capacité.
Un test de room vérifie la présentation de Miroir Magik, l'application de Provoc
sur l'attaquant et la restauration de ses tours restants après reconnexion. Les
états concernés sont temporaires et ne survivent pas à un switch, conformément au
contrat existant des effets volatils.

Après `prepare:local`, le rapport passe de 447 à 442 problèmes globaux et de 95 à
90 problèmes de talents. Le registre source complet compte 144 talents supportés,
1 partiel (`STURDY`) et 110 absents sur 255. Les fonctions d'attaque restent à
102/353 et les 51 animations manquantes sont inchangées.

## Modificateurs offensifs et défensifs partagés - 2026-10-22

Le noyau commun porte maintenant `HUSTLE`, `ANALYTIC`, `CORTANTE`, `FURCOAT` et
`WATERBUBBLE`. Entusiasmo applique l'Attaque physique x1,5 et la précision
physique x0,8. Cálculo Final applique son multiplicateur x1,3 lorsque la cible a
déjà agi ou n'a pas choisi de capacité ; en double, cette décision repose sur la
position effectivement résolue, pas seulement sur la Vitesse théorique. Cortante
emploie le catalogue exact de 21 capacités de coupe du Ruby source. Pelage Recio
divise par deux les dégâts physiques ainsi que la famille Psyko-Choc et reste
contournable par Brise Moule. Pompa double les dégâts Eau, divise par deux les
dégâts Feu reçus et partage le garde générique d'immunité à la brûlure.

Autorité : le calcul appartient au noyau local en solo et à la room en Coop.
Domaine : état tactique partagé. Persistance : aucun nouvel état ; les PV et
statuts résultants sont déjà restaurés depuis le snapshot autoritaire après
reconnexion. Intentions : les joueurs continuent d'envoyer uniquement leur
capacité ou leur action. Audience : participants et observateurs du combat via la
trace, les dégâts et les événements communs. Les mêmes fonctions sont exercées en
duel et dans chaque mini-duel positionné du combat double.

La régénération préalable a réconcilié une documentation en retard avec le
registre courant : la baseline réelle était de 438 problèmes globaux, dont 86
talents du périmètre jouable. Après le lot, `prepare:local` produit 433 problèmes,
dont 81 talents. Le registre extrait compte 153 talents supportés, 1 partiel
(`STURDY`) et 101 absents sur 255. Les fonctions d'attaque restent à 102/353 et
les 51 animations manquantes sont inchangées. Les tests couvrent les
multiplicateurs, la précision, la liste coupe, Psyko-Choc, Brise Moule,
l'immunité à la brûlure, l'ordre double et la restauration Coop.

## Réactions après impact et K.O. - 2026-10-22

Le noyau partagé porte maintenant `JUSTIFIED`, `BRUTALIDAD`, `COLORCHANGE` et
`MOXIE`. Justicier augmente l'Attaque d'un cran après chaque impact Ténèbres qui
laisse le porteur conscient, y compris chaque frappe d'une capacité multiple et
après conversion du type de la capacité. Brutalidad utilise le drapeau de contact
PBS et le tirage source de 50 % pour infliger `HEMORRAGIA` ; le garde de statut
commun conserve l'interdiction sur un type Feu, un Pokémon déjà affecté ou K.O.
Changement Couleur remplace les types du porteur par le type effectif de la
capacité après les dégâts, sauf type pseudo, type déjà possédé, K.O. ou suppression
de l'effet post-impact par Sans Limite. Impudence augmente l'Attaque d'un cran
après chaque cible mise K.O., tant que son porteur est encore conscient.

Autorité : le noyau local résout ces réactions en solo et la room les résout en
Coop. Domaine : crans, statut majeur et types sont un état tactique partagé.
Persistance : ils vivent dans le snapshot de combat et sont restaurés après
reconnexion, sans nouvelle donnée après règlement. Intentions : aucune nouvelle
intention réseau, seule la capacité choisie reste envoyée. Audience : tous les
participants et observateurs reçoivent les événements `abilityActivated`, les
changements de crans et le statut ; les types résultants sont dans le snapshot.
Le résolveur double réutilise le même hook par cible et conserve la réaction sur
l'emplacement exact du porteur.

Après `prepare:local`, le rapport passe de 433 à 430 problèmes globaux et de 81
à 78 problèmes de talents. Le registre extrait compte 157 talents supportés, 1
partiel (`STURDY`) et 97 absents sur 255. `JUSTIFIED` ne figure pas parmi les 232
talents du périmètre jouable actuel, ce qui explique que quatre ajouts au registre
ne retirent que trois problèmes de dépendances. Les fonctions d'attaque restent à
102/353 et les 51 animations manquantes sont inchangées. Les tests couvrent les
frappes multiples, le tirage et l'immunité de l'hémorragie, le remplacement de
type, le K.O. simple et positionné, ainsi que la restauration Coop du type.
Le type d'origine est conservé dans un marqueur volatil répliqué puis restauré
au switch, y compris pour le chemin commun déjà employé par `PROTEAN`.

Lot suivant préparé puis réalisé ci-dessous : étendre les mêmes contrats réactifs à `TERMOCONVERSION`
(Attaque +1 par impact Feu et immunité à la brûlure), `CUERPOHORNEADO` (absorption
Feu et Défense +2), `MUMMY` (remplacement du talent adverse au contact avec les
quatre exclusions source) et `GRIMNEIGH` (Attaque Spéciale +1 après K.O.). Les
tests prévus couvrent les frappes multiples, les limites de crans, le contact en
double, la réplication du talent remplacé et sa restauration après reconnexion.
`AFTERMATH` reste dans un lot séparé avec `DAMP`, car ce dernier doit aussi bloquer
la famille Explosion/Destruction de fonction `0E0`, encore absente du moteur ; il
ne faut pas annoncer Moiteur comme entièrement supporté sur son seul effet global.

## Réactions Feu, Momie et K.O. spécial - 2026-10-22

Le noyau partagé porte maintenant `TERMOCONVERSION`, `CUERPOHORNEADO`, `MUMMY`
et `GRIMNEIGH`. Échange Thermique augmente l'Attaque d'un cran après chaque
impact Feu réellement subi, y compris chaque frappe multiple ; il rejoint aussi
le garde générique qui empêche puis soigne la brûlure. Corps Cuit absorbe toute
capacité Feu et tente Défense +2, même lorsque la limite de cran empêche le gain ;
Brise Moule contourne l'ensemble comme dans le chemin d'absorption commun.

Momie réagit à un contact dommageable même si son porteur tombe K.O., remplace le
talent de l'attaquant et respecte exactement les exclusions source `MULTITYPE`,
`DISGUISE`, `STANCECHANGE` et `MUMMY`. Le talent d'origine est conservé dans le
marqueur volatil répliqué puis restauré au switch. Soucigraine utilise désormais
le même contrat temporaire au lieu de laisser Insomnia attaché au Pokémon retiré ;
Calque reste compatible avec son ancien marqueur de restauration. Sombre Ruade
augmente l'Attaque Spéciale d'un cran après chaque cible mise K.O., via le même
hook que l'Attaque d'Impudence.

Autorité : le noyau local applique les réactions en solo et la room en Coop.
Domaine : crans, talent courant et immunités sont tactiques et partagés.
Persistance : crans et remplacement Momie sont restaurés depuis le snapshot de
reconnexion, puis le talent source revient au switch et au règlement. Intentions :
aucune nouvelle intention réseau. Audience : les participants et observateurs
reçoivent l'activation, le changement de talent et les variations de crans. Les
tests doubles vérifient que Momie ne modifie que l'attaquant positionné concerné.

Après `prepare:local`, le rapport passe de 430 à 426 problèmes globaux et de 78
à 74 problèmes de talents. Le registre extrait compte 161 talents supportés, 1
partiel (`STURDY`) et 93 absents sur 255. Les fonctions d'attaque restent à
102/353 et les 51 animations manquantes sont inchangées. Les tests couvrent les
frappes multiples, immunité et soin de brûlure, absorption Feu, Brise Moule, les
quatre exclusions de Momie, la restauration au switch, l'emplacement double et
la restauration du remplacement après reconnexion invité.

Prochain lot préparé : porter ensemble `AFTERMATH`, `DAMP` et la fonction `0E0`
de `SELFDESTRUCT`/`EXPLOSION`. Le noyau devra appliquer le sacrifice pendant
l'exécution réussie, comme le hook d'animation source placé avant le résultat
final des dégâts, et empêcher entièrement l'action si un porteur actif de Moiteur
est présent sur l'un des quatre emplacements, laisser Brise Moule contourner ce
blocage, puis infliger le quart des PV maximaux de l'attaquant après un K.O. par
contact contre Boom Final sauf Moiteur global, Brise Moule ou Garde Magik. Le
contrat prévu couvre double K.O., remplacements obligatoires, égalité, PP,
présentation distante et restauration de room. `AFTERMATH` n'est pas candidat
dans le périmètre jouable actuel ; `DAMP` l'est dans 13 dépendances.

## Explosion, Moiteur et Boom Final - 2026-10-22

Le noyau partagé porte maintenant `AFTERMATH`, `DAMP` et la fonction `0E0` de
`SELFDESTRUCT`/`EXPLOSION`. Une exécution réussie sacrifie le lanceur après le
calcul des dégâts mais avant leur application et avant les réactions post-impact,
conformément au hook d'animation Ruby. En double, l'adaptateur positionné rejoue
le calcul pour toutes les cibles de zone avec le même état d'attaque, puis ne
publie et ne conserve qu'un seul sacrifice. Un échec de précision ou Protection
ne sacrifie pas le lanceur tant qu'aucune cible n'a été atteinte.

Moiteur est une garde globale : tout porteur actif et conscient sur l'un des
quatre emplacements bloque entièrement `0E0`, après consommation des PP. Brise
Moule du lanceur contourne ce blocage. Boom Final se déclenche après un K.O. par
contact même si son porteur est tombé, retire au lanceur un quart de ses PV
maximaux et est neutralisé par Moiteur global, Brise Moule ou Garde Magik. Les
fins simultanées sans réserve produisent désormais un événement `battleEnded`
avec `winner: null`, un état terminé et le message de présentation « Match nul » ;
les combats avec réserve exigent normalement le remplacement du lanceur.

Autorité : le même résolveur est exécuté localement en solo et par la room en
Coop. Domaine : PV, PP, K.O., résultat et remplacements sont tactiques partagés.
Persistance : aucun nouveau marqueur durable ; le snapshot autoritaire suffit à
restaurer PV nuls, PP et remplacement après reconnexion. Intentions : seule la
capacité choisie est envoyée, la room décide de Moiteur, des cibles et du RNG.
Audience : participants et observateurs reçoivent l'activation, l'échec, les
dégâts, le sacrifice, les K.O. et l'égalité. Les tests couvrent solo, hôte,
invité/reconnexion, quatre emplacements, attaque de zone, PP, Brise Moule, Garde
Magik, remplacement et égalité.

Après `prepare:local`, le rapport passe de 426 à 423 problèmes globaux. Les
mécaniques d'attaque manquantes passent de 301 à 299, les talents candidats
manquants ou partiels de 74 à 73 et les 51 animations manquantes restent
inchangées. Le registre extrait compte 103 fonctions supportées sur 353, puis 163
talents supportés, 1 partiel (`STURDY`) et 91 absents sur 255. `AFTERMATH` reste
hors du périmètre candidat actuel ; `DAMP` en retire une dépendance agrégée dont
les 13 usages sont maintenant couverts.

Prochain lot préparé : porter `ICESCALES`, `FLUFFY`, `MARVELSCALE` et `DEFEATIST`
dans le calculateur commun. La fidélité attendue est celle de Z, pas celle des
jeux récents : Écailles Glacées multiplie la Défense Spéciale effective par 1,5 ;
Écaille Spéciale multiplie la Défense effective par 1,5 sous tout statut majeur ;
Défaitiste divise l'Attaque effective par deux à la moitié des PV ou moins ;
Toison Épaisse double les dégâts Feu et, uniquement hors Feu à cause du `elsif`
source, divise par deux les dégâts de contact. Les trois protections défensives
sont contournées par Brise Moule, contrairement à Défaitiste qui appartient au
lanceur. Le lot devra couvrir catégories physique/spéciale, famille Psyko-Choc,
seuil exact, statut propre à Z, Feu de contact, double positionné et restauration
Coop sans nouvel état persistant.

## Modificateurs défensifs et seuil de Défaitiste - 2026-10-22

Le calculateur partagé porte maintenant `ICESCALES`, `FLUFFY`, `MARVELSCALE` et
`DEFEATIST`. Les comportements suivent les scripts Z 2.12 FR plutôt que les
descriptions canoniques modernes : Écailles Glacées multiplie la défense utilisée
par 1,5 contre une capacité spéciale, y compris lorsque la famille Psyko-Choc
emploie la Défense physique ; Écaille Spéciale applique le même multiplicateur à
la Défense contre une capacité physique sous n'importe quel statut majeur, dont
`CADUCO` et `HEMORRAGIA`.

Toison Épaisse double les dégâts Feu. Le `elsif` source est conservé : une
capacité Feu de contact reste donc doublée et ne reçoit pas simultanément la
réduction de contact ; hors Feu, une capacité de contact est divisée par deux.
Défaitiste divise l'Attaque ou l'Attaque Spéciale effective par deux lorsque les
PV sont inférieurs ou égaux à la moitié des PV maximaux. Brise Moule contourne
Écailles Glacées, Écaille Spéciale et Toison Épaisse, mais pas Défaitiste puisque
ce dernier appartient au lanceur.

Autorité : ces multiplicateurs vivent exclusivement dans le calculateur du noyau,
appelé en solo et par la room Coop. Domaine : seuls les dégâts et PV tactiques
partagés changent. Persistance : aucun nouvel état ; PV, statut et résultat sont
déjà restaurés par le snapshot. Intentions : seule la capacité choisie est
envoyée. Audience : les participants et observateurs reçoivent les dégâts et la
trace autoritaire, qui nomme désormais le talent et son multiplicateur équivalent.
Les tests couvrent catégories physique/spéciale, Psyko-Choc, seuil exact, statut
propre à Z, Feu de contact, Brise Moule, emplacement double et reconnexion invité.

Après `prepare:local`, l'audit passe de 423 à 419 problèmes globaux et de 73 à 69
talents candidats manquants ou partiels. Le registre extrait compte 167 talents
supportés, 1 partiel (`STURDY`) et 87 absents sur 255. Les 299 mécaniques
d'attaque manquantes et 51 animations manquantes restent inchangées ; le registre
conserve 103 fonctions supportées sur 353.

Prochain lot préparé : porter ensemble `WINDRIDER`, `WINDPOWER` et la fonction
`05B` de `TAILWIND`, en introduisant une classification partagée des capacités de
vent fidèle à `isWindMove?` : `AIRCUTTER`, `TWISTER`, `HEATWAVE`, `SANDSTORM`,
`PETALBLIZZARD`, `GUST`, `HURRICANE`, `BLIZZARD`, `TAILWIND`, `FAIRYWIND`,
`ICYWIND`, `SILVERWIND`, `OMINOUSWIND`, `AIRSLASH`, `AEROBLAST` et
`LEAFTORNADO`. Surcavents doit immuniser sa cible et augmenter son Attaque d'un
cran ; Énergie Éolienne doit laisser les dégâts passer puis poser Charge pour la
prochaine capacité Électrik. Vent Arrière dure quatre tours, double la Vitesse du
camp, active les deux talents chez l'utilisateur et son partenaire lors de son
emploi, puis Surcavents doit aussi réagir à l'entrée sous un Vent Arrière déjà
actif. Le lot devra expliciter état de camp, compteur Charge, ordre double,
switch/entrée, non-contournement par Brise Moule dans ce hook source,
présentation et reconnexion Coop.

## Vent Arrière, Surcavents et Énergie Éolienne - 2026-10-22

Le noyau partagé porte maintenant `WINDRIDER`, `WINDPOWER` et la fonction `05B`
de `TAILWIND`. La classification commune reprend exactement les seize capacités
de `isWindMove?` du script Z. Surcavents absorbe une capacité de cette liste et
augmente l'Attaque d'un cran avant la précision ou Protection ; ce hook source
n'est pas contourné par Brise Moule. Énergie Éolienne ne bloque pas la capacité :
elle arme le compteur Charge à 2 avant les dégâts lorsque celui-ci était nul. Le
bonus Électrik et sa consommation continuent d'utiliser le compteur commun déjà
présent dans le moteur.

Vent Arrière pose un état de camp à quatre tours, décrémenté à la fin du tour de
pose, et double la Vitesse effective de chaque allié dans l'ordre partagé. Son
emploi active Surcavents ou Énergie Éolienne chez l'utilisateur et son partenaire
conscient avant de poser l'effet. En double, l'enveloppe positionnée expose les
deux emplacements alliés à la présentation distante. Un Surcavents entrant sous
un Vent Arrière encore actif gagne aussi son cran d'Attaque, en simple comme sur
l'emplacement exact d'un combat double.

Autorité : le noyau local résout l'effet en solo et la room résout le même contrat
en Coop. Domaine : `tailwindTurns` est un état tactique partagé du camp et
`chargeTurns` un volatil partagé du Pokémon. Persistance : les deux compteurs,
les crans et l'ordre résultant vivent dans le snapshot et sont restaurés après
reconnexion ; ils ne survivent pas au règlement. Intentions : seule la capacité
choisie est envoyée, sans nouvelle commande réseau. Audience : participants et
observateurs reçoivent activations, Charge, changement de cran et état de camp.

Après `prepare:local`, l'audit passe de 419 à 416 problèmes globaux. Les
mécaniques d'attaque manquantes passent de 299 à 298, les talents candidats
manquants de 69 à 67 et les 51 animations manquantes restent inchangées. Le
registre extrait compte 104 fonctions supportées sur 353, 169 talents supportés,
1 partiel (`STURDY`) et 85 absents sur 255. Les tests couvrent cible simple,
Brise Moule, dégâts conservés d'Énergie Éolienne, ordre sous Vent Arrière,
utilisateur et partenaire doubles, entrée sous effet et reconnexion invité.

Prochain lot préparé : porter ensemble les talents de partenaire `PLUS`, `MINUS`,
`FRIENDGUARD` et `TELEPATHY`. Plus et Minus doivent multiplier par 1,5 l'Attaque
Spéciale effective uniquement lorsque leur porteur conscient a un partenaire
actif doté de l'un ou l'autre talent. Garde Amie réduit de 25 % les dégâts reçus
par le partenaire, jamais ceux de son propre porteur. Télépathe immunise son
porteur aux capacités offensives d'un allié, notamment les attaques de zone,
sans bloquer les capacités adverses. Le noyau de calcul devra recevoir un contexte
d'allié générique, l'adaptateur double fournir les positions exactes et le simple
conserver les multiplicateurs neutres. Les tests prévus couvrent les couples
Plus/Minus croisés, partenaire K.O. ou remplacé, attaque spéciale/physique,
Garde Amie, Télépathe sur zone, hôte/invité, rendu distant et reconnexion. La
classe Ruby `137` d'Aura Magnétique cible aussi Plus/Minus, mais aucune capacité
`MAGNETICFLUX` n'est présente dans le PBS extrait actuel ; elle reste donc une
dette auditée hors de ce lot de dépendances jouables, sans inventer d'entrée.

## Talents de partenaire actifs - 2026-10-22

Le calculateur partagé porte maintenant `PLUS`, `MINUS`, `FRIENDGUARD` et
`TELEPATHY`. Le contexte de dégâts accepte l'identité des deux partenaires actifs,
mais seul l'adaptateur double l'alimente ; le combat simple conserve donc un
contexte neutre sans chemin métier parallèle. Plus et Minus multiplient par 1,5
l'Attaque Spéciale effective de leur porteur pour une capacité spéciale lorsque
son partenaire actif et conscient possède Plus ou Minus. Le bonus disparaît dès
que ce partenaire tombe K.O. ou quitte l'emplacement.

Garde Amie applique le multiplicateur source de 0,75 aux dégâts reçus par son
partenaire, jamais à son propre porteur. Brise Moule contourne cette protection.
Télépathe intercepte une capacité offensive lancée par un allié avant les dégâts,
notamment une attaque de zone qui continue normalement sur les adversaires ; elle
ne bloque ni les capacités de statut, ni une capacité adverse, ni un allié doté de
Brise Moule. L'événement d'activation conserve le camp réel de la cible dans
l'enveloppe positionnée.

Autorité : le calculateur local et la room autoritaire consomment le même contexte
de partenaire. Domaine : dégâts, PV et K.O. sont tactiques partagés ; aucun nouvel
état durable n'est ajouté. Persistance : talents, emplacements actifs et PV déjà
présents dans le snapshot suffisent à recalculer le contexte après reconnexion.
Intentions : chaque propriétaire continue d'envoyer seulement l'action de son
emplacement. Audience : participants et observateurs reçoivent dégâts, trace des
multiplicateurs et activation de Télépathe ; la room conserve les talents des
emplacements hôte et invité après restauration.

Après `prepare:local`, l'audit passe de 416 à 413 problèmes globaux et les talents
candidats manquants de 67 à 64. Plus, Minus et Télépathe retirent chacun leur
dépendance ; Garde Amie est entièrement supporté mais n'avait aucun usage dans le
périmètre jouable actuel. Le registre extrait compte 173 talents supportés, 1
partiel (`STURDY`) et 81 absents sur 255. Les 104 fonctions supportées sur 353,
298 mécaniques manquantes et 51 animations manquantes restent inchangées. Les
tests couvrent couples Plus/Minus croisés, capacité physique, partenaire absent ou
K.O., Garde Amie, Brise Moule, attaque de zone, Télépathe, hôte/invité et
restauration autoritaire.

Prochain lot préparé : porter les quatre modificateurs de calcul `CAMORRISTA`,
`REALEZA`, `MERCILESS` et `TANGLEDFEET`. Camorrista doit appliquer ×1,2 à la liste
source exacte des coups de pied (`MEGAKICK`, `LOWKICK`, `ROLLINGKICK`, `JUMPKICK`,
`HIJUMPKICK`, `DOUBLEKICK`, `TRIPLEKICK`, `BLAZEKICK`, `TROPKICK`,
`TRIPLEAXEL`). Realeza applique ×1,5 à tous les types offensifs sauf Normal,
indépendamment des types du porteur. Ensañamiento garantit un critique contre une
cible empoisonnée, tandis que Tumbos multiplie l'esquive par 1,2 lorsque son
porteur est confus et reste contourné par Brise Moule. Le lot devra garder ces
règles dans les classifications et calculateurs communs, tracer les
multiplicateurs, puis couvrir solo, double positionné, hôte/invité et reconnexion.

## Coups de pied, Realeza, critiques et esquive confuse - 2026-10-22

Le noyau partagé porte maintenant `CAMORRISTA`, `REALEZA`, `MERCILESS` et
`TANGLEDFEET`. Camorrista applique le multiplicateur final de 1,2 uniquement aux
dix capacités reconnues par `isKickingMove?` dans Z ; cette classification vit
avec les autres propriétés génériques de capacité. Realeza applique 1,5 aux
dix-sept types offensifs explicitement cités par le script, indépendamment des
types du porteur, sans inclure `NORMAL` ni le type interne `QMARKS`.

Ensañamiento garantit un critique contre une cible empoisonnée sans tirage RNG.
L'ordre Ruby est conservé : Armurbaston et Coque Armure bloquent d'abord le
critique, puis Ensañamiento passe avant Chant Canon. Tumbos multiplie l'esquive
effective par 1,2 tant que son porteur est confus ; Identification annule seulement
les crans comme auparavant et Brise Moule contourne le talent. La trace de
précision expose le talent et son multiplicateur, comme la trace de dégâts pour
Camorrista et Realeza.

Autorité : le même calculateur est appelé localement en solo et par la room en
Coop. Domaine : dégâts, précision, PV et K.O. sont tactiques partagés. Persistance :
aucun nouvel état ; talent, statut, confusion et PV sont déjà dans le snapshot et
sont restaurés après reconnexion. Intentions : seule la capacité choisie reste
envoyée, le RNG et les calculs demeurent autoritaires. Audience : participants et
observateurs reçoivent dégâts, critiques, échecs de précision et traces ; les tests
de room couvrent un talent hôte, un talent invité et leur restauration.

Après `prepare:local`, l'audit passe de 413 à 409 problèmes globaux et les talents
candidats manquants de 64 à 60. Le registre extrait compte 177 talents supportés,
1 partiel (`STURDY`) et 77 absents sur 255. Les 104 fonctions supportées sur 353,
298 mécaniques manquantes et 51 animations manquantes restent inchangées. Les
tests couvrent les dix coups de pied et un contre-exemple, les types Feu, Normal et
`QMARKS`, l'ordre critique, Chant Canon, l'immunité aux critiques, Tumbos, Brise
Moule, le double positionné, l'hôte, l'invité et la reconnexion.

Prochain lot préparé : réunir les classifications de capacités encore requises par
`BULLETPROOF`, `PUNKROCK`, `VOZVALQUIRIA` et `PENETRANTE`. Antibalas doit bloquer
les capacités portant le drapeau bombe source `n`, avec contournement par Brise
Moule. Punk Rock doit appliquer 1,3 aux capacités sonores du lanceur et 0,5 aux
dégâts sonores reçus, cette protection défensive étant contournée par Brise Moule.
Voz Valquiria convertit les capacités Normal en Glace sans bonus de puissance et
ajoute la chance source de 30 % d'apeurement aux capacités sonores. Penetrante
ajoute la même chance aux capacités à haut taux critique. Le lot devra partager
les classifications bombe, son et haut critique, conserver l'ordre des immunités
et effets secondaires, puis couvrir solo, double, hôte/invité et reconnexion.

## Bombes, sons et haut taux critique - 2026-10-22

Le noyau partagé porte maintenant `BULLETPROOF`, `PUNKROCK`, `VOZVALQUIRIA` et
`PENETRANTE`. Les propriétés communes exposent les drapeaux source `n` (bombe),
`k` (son) et `h` (haut taux critique), sans maintenir de liste parallèle de
capacités. Antibalas intercepte toute capacité `n` avant précision et dégâts ;
les PP sont consommés et Brise Moule contourne l'immunité. En double, chaque cible
est évaluée séparément afin que les autres cibles d'une capacité de zone restent
atteintes.

Punk Rock multiplie par 1,3 les dégâts sonores du porteur et par 0,5 les dégâts
sonores qu'il reçoit. Seule la branche défensive est contournée par Brise Moule.
Voz Valquiria convertit toute capacité Normal en Glace sans le bonus de puissance
des talents de type Peau, puis donne aux capacités sonores la chance source de
30 % d'apeurement. Penetrante donne la même chance aux capacités portant `h`.
Comme le Ruby utilise `pbRandom(100) <= 30`, le noyau conserve volontairement ce
seuil inclusif. Le drapeau `h` augmente également d'un cran le calcul critique
normal, dette transverse révélée par cette classification.

Autorité : calcul, immunité, tirages et apeurement vivent dans le résolveur commun,
appelé en solo et par la room autoritaire. Domaine : type effectif, dégâts, PV et
volatil d'apeurement sont tactiques partagés. Persistance : aucun nouvel état ;
talents, types source, PV et volatil existants suffisent au snapshot, l'apeurement
étant consommé ou nettoyé pendant le tour. Intentions : seule la capacité choisie
est transmise. Audience : participants et observateurs reçoivent blocage, dégâts,
activation et volatile ; le test de room couvre Voz Valquiria côté hôte, Punk Rock
côté invité et leur restauration après reconnexion.

Après `prepare:local`, l'audit passe de 409 à 405 problèmes globaux et les talents
candidats manquants de 60 à 56. Le registre extrait compte 181 talents supportés,
1 partiel (`STURDY`) et 73 absents sur 255. Les 104 fonctions supportées sur 353,
298 mécaniques manquantes et 51 animations manquantes restent inchangées. Les
tests couvrent PP, Brise Moule, capacité bombe de zone, multiplicateurs offensif
et défensif, conversion sans bonus, efficacité Glace, seuil d'apeurement, haut
critique, Duo Poudre + Cape Obscure, double positionné, hôte, invité et reconnexion.

Prochain lot préparé : centraliser les réactions de `CONTRARY`, `CAPATOXICA`,
`OLORPORCINO` et `PURIFYINGSALT`. Contrary doit inverser tout changement de cran,
y compris les gains personnels, tout en laissant Brise Moule contourner seulement
les changements imposés par l'adversaire ; les limites doivent être testées dans
la direction réellement inversée. Capa Tóxica doit poser une couche de Pics Toxik
sur le camp de l'attaquant après un impact subi, jusqu'au plafond de deux couches.
Olor Porcino doit réduire de deux crans l'esquive d'un attaquant ayant touché par
contact. Purifying Salt doit empêcher puis soigner tous les statuts majeurs de Z
et diviser par deux les dégâts Spectre, avec contournement défensif par Brise Moule.
Le lot devra réutiliser le changeur de crans, les effets de camp et la protection
de statut communs, puis couvrir impacts multiples, limites, contact, double,
hôte/invité et restauration des crans, pièges et statuts après reconnexion.

## Crans inversés, réactions d'impact et Sel Purificateur - 2026-10-22

Le noyau partagé porte maintenant `CONTRARY`, `CAPATOXICA`, `OLORPORCINO` et
`PURIFYINGSALT`. Le changement de cran commun applique Respondón avant Simple et
avant les limites : un gain personnel devient donc une baisse, une baisse adverse
devient un gain, et un cran déjà à la limite échoue dans la direction réellement
inversée. Brise Moule désactive cette inversion uniquement lorsque l'adversaire
impose le changement ; les gains et réactions propres du porteur restent inversés.
Les talents d'entrée, de fin de tour, de vent, de Baie et de réaction aux dégâts
réutilisent ce même contrat, y compris la maximisation de Colérique.

Capa Tóxica pose une couche de Pics Toxik sur le camp de l'attaquant après chaque
impact qui inflige des dégâts, jusqu'au plafond source de deux couches. Olor
Porcino réduit de deux crans l'esquive de l'attaquant après chaque impact de
contact. Les deux hooks conservent la cible positionnée en double et restent
actifs sur un impact mettant leur porteur K.O., comme le callback Ruby appelé
avec le talent de la cible. Sel Purificateur empêche et soigne sommeil, poison,
brûlure, paralysie, gel, Caduco et Hémorragie, puis divise par deux les dégâts
Spectre. Les protections de statut, le sommeil différé de Bâillement et la
réduction Spectre sont contournés par Brise Moule adverse.

Autorité : le résolveur local en solo et la room en Coop appellent exactement les
mêmes changeurs de crans, hooks après impact, effets de camp et protections de
statut. Domaine : crans, statut, PV et couches de Pics Toxik sont tactiques
partagés. Persistance : aucun état durable hors combat ; le snapshot autoritaire
conserve crans, statut, talent, effets de camp et le contexte différé de
Bâillement après reconnexion. Intentions : les propriétaires n'envoient que leur
capacité, leur attente ou leur remplacement ; la room décide des impacts et des
réactions. Audience : participants et observateurs reçoivent activations,
changements de cran, statuts, dégâts et effets de camp positionnés.

Après `prepare:local`, l'audit passe de 405 à 401 problèmes globaux et les talents
candidats manquants de 56 à 52. Le registre extrait compte 185 talents supportés,
1 partiel (`STURDY`) et 69 absents sur 255. Les 104 fonctions supportées sur 353,
298 mécaniques d'attaque manquantes et 51 animations manquantes restent
inchangées. Les tests couvrent gains personnels, baisses adverses, limites,
Brise Moule, impacts multiples, plafond des pièges, contact, sept statuts, dégâts
Spectre, double positionné, hôte, invité et restauration après reconnexion.

Prochain lot préparé : réunir les quatre interactions de type encore candidates
`NORMALIZE`, `STEELWORKER`, `EARTHEATER` et `CANASTO`. Normalize doit convertir
toutes les capacités en Normal et appliquer le multiplicateur source de 1,5,
contrairement aux talents Peau limités aux capacités déjà Normal. Steelworker
applique 1,5 aux dégâts Acier du lanceur. Earth Eater doit absorber les capacités
Sol après précision et avant dégâts puis restaurer un quart des PV maximaux, avec
Brise Moule comme contournement défensif. Canasto réduit à 0,3 les dégâts Vol et
Roche reçus, également sous le contrat Brise Moule. Le lot devra partager type
effectif, absorption et trace de dégâts, puis couvrir immunités Normal/Spectre,
soin plafonné, attaques de zone, double positionné et restauration Coop.

## Conversions, absorption Sol et résistances de type - 2026-10-22

Le noyau partagé porte maintenant `NORMALIZE`, `STEELWORKER`, `EARTHEATER` et
`CANASTO`. La résolution du type effectif applique Normalisation avant les Peaux :
toute capacité devient Normal et reçoit le multiplicateur source de 1,5, même si
elle était déjà Normal. Cette conversion alimente ensuite STAB, immunités et
absorptions sans branche propre à une capacité. Steelworker ajoute son facteur
offensif de 1,5 aux seules capacités Acier. Canasto ajoute le facteur défensif
source de 0,3 aux capacités Vol et Roche ; Brise Moule le contourne.

Earth Eater rejoint le hook générique d'absorption par type. Après le test de
précision, une capacité Sol visant son porteur est bloquée et soigne jusqu'à un
quart des PV maximaux, même si le porteur est déjà à son maximum. Brise Moule
contourne cette défense. Une capacité Sol convertie en Normal par Normalisation
n'est donc pas absorbée. En double, chaque cible d'une capacité de zone est
résolue séparément : Earth Eater protège et soigne son emplacement sans annuler
les dégâts infligés à l'autre adversaire. L'ordre après précision corrige le
cadrage préparatoire précédent et correspond à l'appel Ruby de
`pbTypeModMessages` depuis le calcul des dégâts, après `pbAccuracyCheck`.

Autorité : type effectif, absorption, soin et dégâts sont décidés par le même
résolveur en solo et par la room autoritaire en Coop. Domaine : talent, type,
PV et PP sont tactiques partagés. Persistance : aucun nouvel état durable ; le
snapshot existant conserve talents, PV et PP après reconnexion. Intentions : le
joueur transmet uniquement sa capacité ou son attente. Audience : participants
et observateurs reçoivent la consommation des PP, l'activation, le soin et les
dégâts ; le test de room couvre Normalisation côté hôte, Earth Eater côté invité,
les deux talents de réserve et leur restauration autoritaire.

Après `prepare:local`, l'audit passe de 401 à 397 problèmes globaux et les talents
candidats manquants de 52 à 48. Le registre extrait compte 189 talents supportés,
1 partiel (`STURDY`) et 65 absents sur 255. Les 104 fonctions supportées sur 353,
298 mécaniques d'attaque manquantes et 51 animations manquantes restent
inchangées. Les tests couvrent conversion de types non-Normal et déjà Normal,
immunité Normal/Spectre, multiplicateurs offensifs et défensifs, soin plafonné et
à PV pleins, Brise Moule, interaction Normalize/Earth Eater, attaque de zone,
double positionné, hôte, invité et restauration après reconnexion.

Prochain lot préparé : réunir les auras globales `DARKAURA`, `FAIRYAURA`,
`AURADORADA` et `AURABREAK`. Le Ruby recherche ces talents sur les quatre
combattants actifs : Aura Sombre, Aura Féérique et Aura Dorée multiplient
respectivement par 4/3 les dégâts Ténèbres, Fée et Électrik de n'importe quel
participant. Si au moins un porteur de Brise Aura est actif, le facteur de l'aura
présente devient 2/3 au lieu de 4/3. Plusieurs porteurs d'une même aura ne doivent
pas cumuler le bonus, Brise Aura agit quelle que soit son équipe et Brise Moule
ne contourne pas ces effets globaux. Le lot devra exposer dans le contexte de
dégâts l'ensemble borné des talents actifs, alimenté par les adaptateurs simple
et double, tracer l'aura appliquée, puis couvrir porteur allié/adverse, doubles,
K.O. ou retrait du porteur, hôte, invité et restauration après reconnexion.

## Auras globales actives - 2026-10-22

Le noyau partagé porte maintenant `DARKAURA`, `FAIRYAURA`, `AURADORADA` et
`AURABREAK`. Le contexte générique de dégâts expose l'ensemble borné des talents
de tous les combattants actifs et conscients, sans dépendre du camp du lanceur ni
du format. Aura Sombre, Aura Féérique et Aura Dorée appliquent respectivement le
facteur source de 4/3 aux dégâts Ténèbres, Fée et Électrik de n'importe quel
participant. Un ensemble évite tout cumul si plusieurs porteurs partagent la même
aura. Lorsqu'au moins un Brise Aura est actif, le facteur de l'aura présente est
2/3 au lieu de 4/3 ; Brise Moule ne désactive pas cet effet global.

L'adaptateur simple dérive la liste des deux combattants au moment du calcul.
L'adaptateur double la reconstruit depuis les quatre emplacements avant chaque
cible résolue. Un porteur mis K.O. plus tôt dans le tour ou remplacé avant
l'attaque cesse donc immédiatement de contribuer, sans drapeau volatil ni état
dupliqué. Le calculateur direct conserve un repli sur attaquant et défenseur afin
que ses consommateurs hors adaptateur obtiennent le même comportement en simple.
La trace attribue le facteur 4/3 à l'aura de type et le facteur 2/3 à Brise Aura.

Autorité : la liste active et le multiplicateur sont calculés dans le résolveur
local en solo et dans ce même résolveur appelé par la room autoritaire. Domaine :
talents actifs, dégâts et PV sont tactiques partagés. Persistance : aucun nouvel
état ; équipes, emplacements, talents et PV du snapshot suffisent à reconstruire
les auras après reconnexion. Intentions : capacité, attente ou remplacement
seulement. Audience : participants et observateurs reçoivent la trace et les
dégâts autoritaires ; le test de room couvre Aura Sombre côté hôte, Brise Aura
côté invité, les deux autres auras en réserve et leur restauration.

Après `prepare:local`, l'audit passe de 397 à 393 problèmes globaux et les talents
candidats manquants de 48 à 44. Le registre extrait compte 193 talents supportés,
1 partiel (`STURDY`) et 61 absents sur 255. Les 104 fonctions supportées sur 353,
298 mécaniques d'attaque manquantes et 51 animations manquantes restent
inchangées. Les tests couvrent les trois types, porteur allié ou adverse, absence
de cumul, inversion, absence d'aura à inverser, Brise Moule, double positionné,
K.O. antérieur, remplacement, hôte, invité et reconnexion.

Prochain lot préparé : compléter les conversions Normal propres à Pokémon Z avec
`COLEOPTERO`, `PIELMALDITA`, `PIELELECTRICA` et `TINTINEO`. Les trois premiers
convertissent une capacité Normal en Insecte, Spectre ou Électrik et appliquent le
facteur source de 1,2. Tintineo convertit Normal en Psy mais, bien que le Ruby arme
son indicateur `@powerboost`, il est volontairement absent de la liste qui applique
le facteur 1,2 : aucun bonus ne doit donc être inventé. Son message au premier
tour devra passer par la présentation générique des activations. Le lot réutilisera
`effectiveMoveType`, puis couvrira STAB, immunités et absorptions sur le type
converti, capacités non-Normal inchangées, Brise Moule sans incidence, double,
hôte, invité et restauration après reconnexion.

## Conversions Normal propres à Pokémon Z - 2026-10-22

Le noyau partagé porte maintenant `COLEOPTERO`, `PIELMALDITA`, `PIELELECTRICA`
et `TINTINEO`. Ces quatre talents rejoignent la table générique de type effectif :
une capacité Normal devient respectivement Insecte, Spectre, Électrik ou Psy,
tandis qu'une capacité d'un autre type reste inchangée. Le type converti alimente
ensuite sans branche spéciale STAB, table des types, immunités, redirections et
absorptions. Coleoptero, Peau Maudite et Peau Électrique appliquent le facteur
source de 1,2. Tintineo conserve exactement l'anomalie Ruby : `@powerboost` est
armé, mais ce talent n'apparaît pas dans la liste qui applique 1,2, donc aucun
bonus n'est ajouté.

L'annonce de Tintineo au premier tour passe par l'événement générique
`abilityActivated` avec l'effet `announce`. Le marqueur d'entrée existant évite
de la répéter à chaque tour et la rejoue après une véritable nouvelle entrée.
En double, la conversion est recalculée pour chaque cible ; une capacité Normal
devenue Électrik peut donc être absorbée par Absorb Volt sur un emplacement tout
en touchant l'autre cible de zone.

Autorité : conversion, annonce, absorption et dégâts utilisent le même résolveur
en solo et dans la room autoritaire. Domaine : type effectif, talent, PP et PV
sont tactiques partagés. Persistance : aucun nouvel état durable ; le snapshot
conserve talent, équipe et marqueur volatil d'entrée. Intentions : capacité,
attente ou remplacement seulement. Audience : participants et observateurs
reçoivent annonce, activation d'absorption et dégâts ; le test de room couvre
Tintineo côté hôte, Peau Maudite côté invité, les deux autres talents en réserve
et leur restauration après reconnexion.

Après `prepare:local`, l'audit passe de 393 à 391 problèmes globaux et les talents
candidats manquants de 44 à 42 ; deux talents du lot n'étaient pas requis par le
périmètre de dépendances courant. Le registre extrait compte néanmoins 197 talents
supportés, 1 partiel (`STURDY`) et 57 absents sur 255. Les 104 fonctions supportées
sur 353, 298 mécaniques d'attaque manquantes et 51 animations manquantes restent
inchangées. Les tests couvrent les quatre conversions, bonus exacts, capacités
non-Normal, annonce unique, efficacité de type, absorption par cible, double,
hôte, invité et reconnexion.

Prochain lot préparé : réunir les cinq amplificateurs offensifs de type purs
`ALBINISMO`, `PEDANTE`, `INFLAMABLE`, `TRANSPORTARROCA` et `DRAGONSMAW`. Le Ruby
leur applique sans autre effet un facteur de 1,5 aux dégâts Glace, Psy, Feu, Roche
ou Dragon du porteur. Ils doivent consommer le type effectif après conversion,
ne jamais renforcer les autres types et rester indépendants de Brise Moule.
Le lot réutilisera la trace des multiplicateurs offensifs et couvrira types
convertis, STAB, immunités, double positionné, hôte, invité et restauration après
reconnexion.

## Amplificateurs offensifs de type purs - 2026-10-22

Le noyau partagé porte maintenant `ALBINISMO`, `PEDANTE`, `INFLAMABLE`,
`TRANSPORTARROCA` et `DRAGONSMAW`. Une seule table déclarative associe chaque
talent à son type Glace, Psy, Feu, Roche ou Dragon et au facteur source de 1,5.
Floración et Steelworker ont été migrés dans la même table afin de conserver un
seul contrat pour les sept talents dont l'unique effet est ce renforcement typé.
Le calcul consulte le type effectif de la capacité, puis compose ce facteur avec
STAB, efficacité, climat et autres modificateurs tracés. Un type différent ne
reçoit rien et Brise Moule, talent du lanceur destiné aux défenses adverses, n'a
aucune incidence sur ce bonus offensif.

Autorité : le calculateur commun décide le multiplicateur en solo et dans la room
autoritaire. Domaine : talent, type effectif et dégâts sont tactiques partagés.
Persistance : aucun nouvel état ; talents et équipes du snapshot suffisent après
reconnexion. Intentions : seule la capacité choisie est transmise. Audience :
participants et observateurs reçoivent les dégâts et leur trace ; le test de room
couvre Albino côté hôte, Pedante côté invité, les trois autres talents en réserve
et leur restauration. Une capacité de zone en double reçoit le même bonus pour
chaque cible positionnée.

Après `prepare:local`, l'audit passe de 391 à 388 problèmes globaux et les talents
candidats manquants de 42 à 39 ; deux talents du lot n'étaient pas requis par le
périmètre de dépendances courant. Le registre extrait compte 202 talents supportés,
1 partiel (`STURDY`) et 52 absents sur 255. Les 104 fonctions supportées sur 353,
298 mécaniques d'attaque manquantes et 51 animations manquantes restent
inchangées. Les tests couvrent les cinq types, type incorrect, STAB, Brise Moule,
attaque de zone, double positionné, hôte, invité et reconnexion.

Prochain lot préparé : réunir les modificateurs offensifs à condition ou durée
`FLAREBOOST`, `TOXICBOOST`, `PODERSABIO` et `SLOWSTART`. Flare Boost applique 1,5
aux capacités spéciales lorsque le porteur est brûlé ; Toxic Boost applique 1,5
aux capacités physiques lorsqu'il est empoisonné. Poder Sabio multiplie l'Attaque
Spéciale par 1,5 mais verrouille après la première capacité utilisée comme un
objet Choix, verrou à nettoyer au retrait. Slow Start divise par deux l'Attaque
physique et la Vitesse tant que le compteur source `turncount <= 5` ; la frontière
exacte doit être vérifiée contre l'incrément du compteur partagé. Le lot devra
réutiliser statuts, ordre d'action, volatile de verrouillage et compteur de tours,
puis couvrir catégories incorrectes, guérison, switch aller-retour, limites de
durée, double, hôte, invité et reconnexion.

## Lot élargi de talents simples : statut, terrain et priorité - 2026-10-22

Le noyau partagé porte désormais dix talents supplémentaires. `FLAREBOOST`
multiplie par 1,5 les dégâts spéciaux d'un porteur brûlé et `TOXICBOOST` les
dégâts physiques d'un porteur empoisonné. `SLOWSTART` divise par deux l'Attaque
physique et la Vitesse tant que `activeTurns <= 5` ; le sixième tour actif libère
les deux caractéristiques et un retrait efface le volatile, donc relance la durée
à la rentrée. `SURGESURFER` double la Vitesse sous Champ Électrifié, tandis que
`SILVANO` multiplie Attaque physique et Vitesse par 1,3 sous Champ Herbu.

`MISTYSURGE` et `PSYCHICSURGE` réutilisent le même contrat d'entrée que les deux
champs déjà portés et installent respectivement les Champs Brumeux et Psychique
pour cinq tours. `TERAVOLT` et `TURBOBLAZE` sont des alias complets du prédicat
partagé de Brise Moule : toutes les protections qui consultent ce prédicat sont
donc ignorées sans liste parallèle. Enfin, `GALEWINGS` ajoute un niveau de priorité
à toute capacité Vol, conformément à Pokémon Z sans condition de PV. Le calcul de
priorité a été centralisé afin que le simple et le double positionné ne puissent
pas diverger.

Autorité : ordre, terrains et dégâts sont décidés par le noyau local en solo et
par la room en Coop. Domaine : état tactique partagé. Persistance : aucun nouveau
champ ; terrains, équipes et `activeTurns` existaient déjà dans le snapshot, et le
volatile est remis à zéro par le contrat générique de retrait. Intentions : choix
de capacité ou changement uniquement. Audience : participants et observateurs
reçoivent l'ordre, les dégâts, le terrain et leurs événements ; aucune donnée
personnelle supplémentaire. Les tests couvrent catégories et statuts incorrects,
frontière des cinq tours, retrait/rentrée, vitesse sous les deux terrains, double,
hôte, invité et export/restauration de room avec les dix identités.

Après `prepare:local`, l'audit passe de 388 à 381 problèmes globaux. Les talents
manquants dans le périmètre de dépendances courant passent de 39 à 32 ; trois
talents du lot ne sont pas requis par ce périmètre. Le registre complet compte
maintenant 212 talents supportés, 1 partiel (`STURDY`) et 42 absents sur 255. Les
104 fonctions supportées sur 353, 298 mécaniques d'attaque manquantes et 51
animations manquantes restent inchangées.

`PODERSABIO` n'a pas été inclus artificiellement dans ce lot : son multiplicateur
spécial est indissociable du verrou sur la première capacité utilisée et du
nettoyage au retrait, donc il exige un contrat de choix persistant séparé.

Prochain lot préparé : regrouper les talents de précision et d'ordre d'action
`VICTORYSTAR`, `WONDERSKIN`, `TRIAGE`, `QUEENLYMAJESTY` et `STALL`. Le premier
renforce la précision du porteur et de son partenaire actif, le deuxième plafonne
à 50 la précision des capacités de statut adverses, `TRIAGE` ajoute trois niveaux
aux soins selon le catalogue source, `QUEENLYMAJESTY` protège le camp des capacités
prioritaires adverses et `STALL` agit en dernier dans son niveau de priorité. Le
lot devra centraliser précision, classification des soins et départage d'ordre,
puis couvrir simple, double, partenaire, Brise Moule, hôte, invité et reconnexion.

## Précision et ordre d'action - 2026-10-22

Le noyau partagé porte maintenant `VICTORYSTAR`, `WONDERSKIN`, `TRIAGE`,
`QUEENLYMAJESTY` et `STALL`. Étoile Victoire multiplie par 1,1 la précision de son
porteur et celle de son partenaire actif et conscient ; deux Étoiles Victoire se
composent donc en double. Peau Miracle suit le calcul Ruby exact : contre une
capacité de statut lancée par un adversaire, le multiplicateur de précision est
plafonné à 50 % avant division par l'esquive. Brise Moule, Téra-Voltage et
Turbo-Brasier contournent cette protection ; les capacités alliées ne sont pas
concernées.

Premier Auxilio ajoute trois niveaux de priorité aux quinze familles de fonctions
qui redéfinissent `isHealingMove?` dans la source. Les six exclusions explicites
(`AQUARING`, `GRASSYTERRAIN`, `INGRAIN`, `LEECHSEED`, `PAINSPLIT`, `PRESENT`)
restent sans bonus. Majesté Royale bloque les capacités dont la priorité finale
est positive et reste, conformément à cette version de Z, une protection du
porteur ciblé plutôt qu'une aura de camp ; Brise Moule et ses alias la traversent.
Frein agit après tout combattant non-Frein du même niveau de priorité. Entre deux
porteurs de Frein, le plus lent agit d'abord, indépendamment de Distorsion, tandis
qu'une priorité supérieure continue naturellement de gagner.

Autorité : précision, blocage et ordre sont décidés par le noyau local en solo et
par la room autoritaire en Coop. Domaine : calcul tactique partagé. Persistance :
aucun nouvel état ; talents, partenaires actifs et ordre choisi sont déjà dans le
snapshot. Intentions : seule l'action du joueur est envoyée. Audience : les
participants et observateurs reçoivent ordre, trace de précision, échec et
activation du talent. Les tests couvrent porteur et partenaire, cible alliée,
Brise Moule, exclusions de soin, niveau de priorité supérieur, simple, double,
hôte, invité et export/restauration de room avec les cinq identités.

Après `prepare:local`, l'audit passe de 381 à 378 problèmes globaux. Les talents
manquants dans le périmètre de dépendances courant passent de 32 à 29 ; deux
talents du lot ne sont pas requis par ce périmètre. Le registre complet compte
217 talents supportés, 1 partiel (`STURDY`) et 37 absents sur 255. Les 104
fonctions supportées sur 353, 298 mécaniques d'attaque manquantes et 51 animations
manquantes restent inchangées.

Prochain lot préparé : grouper six talents simples déjà alignés sur les hooks
communs. `SOBRECARGA` renforce de 1,5 les capacités Électrik au tiers de PV ou
moins ; `CORAZAIRA` augmente Attaque et Attaque Spéciale d'un cran au franchissement
de la moitié des PV ; `DINAMO` pose Charge et Défense Spéciale +1 au premier impact
tant que Charge est inactive ; `TOQUEMAGICO` et `RELAMPAGUEO` ajoutent respectivement
20 % de confusion et 30 % de paralysie aux attaques de contact ;
`GRANPESADILLA` retire un quart des PV maximaux aux adversaires endormis en fin de
tour. Le lot réutilisera dégâts conditionnels, réactions par frappe, RNG de talent,
statuts et passifs globaux, avec les mêmes preuves simple/double/room/reconnexion.

## Talents personnalisés simples : seuils, contact et cauchemars - 2026-10-22

Le noyau partagé porte maintenant `SOBRECARGA`, `CORAZAIRA`, `DINAMO`,
`TOQUEMAGICO`, `RELAMPAGUEO` et `GRANPESADILLA`. Sobrecarga rejoint la table
générique des talents au tiers de PV et multiplie par 1,5 les capacités Électrik
au seuil inclus. Coraza Ira réutilise la réaction après chaque impact : lorsque
les PV passent strictement d'au-dessus à en dessous de la moitié, elle augmente
d'un cran l'Attaque Spéciale puis l'Attaque. Atteindre exactement la moitié ne
déclenche pas le talent.

Dinamo réagit à un impact de contact lorsque Charge est inactive : il pose le
compteur commun à 2 et augmente la Défense Spéciale d'un cran. Tant que Charge
reste active, les impacts suivants ne répètent ni le cran ni l'activation ; le
bonus et la consommation des capacités Électrik continuent d'employer le même
volatile que Charge et Énergie Éolienne. Toque Mágico et Relampagueo rejoignent
les réactions offensives de contact avec les tirages source respectifs de 20 %
de confusion et 30 % de paralysie. Les immunités et l'état déjà présent sont
contrôlés avant le tirage, sans RNG artificiel.

Grande Pesadilla rejoint le passif partagé de fin de tour et retire un quart des
PV maximaux à un adversaire endormi. Plusieurs porteurs du même talent ne le
multiplient pas ; en revanche, Mauvais Rêve et Grande Pesadilla sont deux blocs
Ruby distincts et se cumulent une fois chacun lorsqu'ils sont tous deux actifs.
Garde Magik bloque ces dégâts indirects.

Autorité : le résolveur local en solo et la room autoritaire appellent les mêmes
tables et hooks. Domaine : dégâts, PV, crans, statut et compteurs sont tactiques
partagés. Persistance : aucun état durable hors combat ; talents, PV, crans,
statuts et `chargeTurns` vivent dans le snapshot et sont restaurés après
reconnexion. Intentions : seule la capacité, l'attente ou le remplacement est
envoyé ; les tirages restent autoritaires. Audience : participants et
observateurs reçoivent activations, crans, statut, dégâts et trace, avec les
positions réelles fournies par l'adaptateur double.

Après `prepare:local`, l'audit passe de 378 à 373 problèmes globaux et les talents
candidats manquants de 29 à 24 ; un talent du lot n'était pas requis par le
périmètre de dépendances courant. Le registre complet compte 223 talents
supportés, 1 partiel (`STURDY`) et 31 absents sur 255. Les 104 fonctions
supportées sur 353, 298 mécaniques d'attaque manquantes et 51 animations
manquantes restent inchangées. Les tests couvrent seuils exacts, type incorrect,
Charge inactive ou déjà armée, probabilités de contact, confusion, paralysie,
cumul des deux cauchemars, Garde Magik, hôte, invité et restauration autoritaire.

Prochain lot préparé : regrouper `GOODASGOLD`, `WONDERGUARD`, `LIQUIDOOZE`,
`INNARDSOUT` et `MIRRORARMOR`. Good as Gold doit bloquer les capacités de statut
qui ciblent son porteur, avec le contrat Brise Moule. Wonder Guard doit bloquer
les capacités offensives dont l'efficacité finale n'est pas strictement super
efficace, également avec contournement défensif. Liquid Ooze inverse en dégâts le
soin que l'attaquant aurait reçu d'une capacité drainante. Innards Out inflige à
l'attaquant les PV effectivement retirés par l'impact qui met son porteur K.O.
Mirror Armor renvoie vers l'auteur les baisses de crans imposées par l'adversaire,
sans réfléchir les changements personnels. Ce lot devra centraliser le blocage
avant dégâts, la destination des drains et la réflexion du changeur de crans,
puis couvrir capacités de zone, impacts multiples, limites de crans, Brise Moule,
simple, double, hôte, invité et reconnexion.

## Protections, drains et réflexion de crans - 2026-10-22

Le noyau partagé porte maintenant `GOODASGOLD`, `WONDERGUARD`, `LIQUIDOOZE`,
`INNARDSOUT` et `MIRRORARMOR`. Good as Gold bloque toute capacité de statut dont
le porteur est la cible réelle, y compris sa propre capacité personnelle comme
dans le Ruby, sauf si le lanceur possède Brise Moule ou l'un de ses alias.
Wonder Guard consulte le multiplicateur de type effectif partagé après précision
et absorptions : seule une attaque strictement super efficace atteint son porteur,
avec le même contournement Brise Moule. Une capacité de zone est résolue par cible
et continue donc contre les autres emplacements.

Liquid Ooze remplace le soin de la famille drainante `0DD` actuellement supportée
par des dégâts égaux à la moitié arrondie des PV réellement retirés. Il n'est pas
contourné par Brise Moule. Innards Out utilise également les dégâts effectivement
appliqués, cumulés sur tous les impacts, et les renvoie lorsque le dernier impact
met le porteur K.O. ; le double K.O. et son résultat nul restent pris en charge.
Enfin, Mirror Armor renvoie à l'auteur toute baisse adverse de cran, y compris les
baisses d'entrée telles qu'Intimidate. Les baisses personnelles restent locales,
Brise Moule traverse la réflexion, et le renvoi repasse par les contrats communs
de Simple, Contestation, protections de crans et réactions Acharné/Compétitif.

Autorité : blocages, efficacité, drain, dégâts de K.O. et crans sont décidés par
le même résolveur en solo et par la room autoritaire en Coop. Domaine : état de
combat tactique partagé. Persistance : aucun nouvel état durable ; talents, PV,
crans, équipes et volatiles existants suffisent au snapshot et à la reconnexion.
Intentions : capacité, attente ou remplacement seulement ; aucun résultat calculé
par le client. Audience : participants et observateurs reçoivent les activations,
échecs, dégâts, K.O. et changements de crans. Le test de room couvre Good as Gold
côté hôte, Mirror Armor côté invité, les trois autres talents en réserve, puis
l'export et la restauration autoritaires.

Après `prepare:local`, l'audit passe de 373 à 369 problèmes globaux et les talents
candidats manquants de 24 à 20 ; un talent du lot n'était pas requis par le
périmètre de dépendances courant. Le registre complet compte 228 talents
supportés, 1 partiel (`STURDY`) et 26 absents sur 255. Les 104 fonctions
supportées sur 353, 298 mécaniques d'attaque manquantes et 51 animations
manquantes restent inchangées. Les tests couvrent cible adverse et personnelle,
Brise Moule, efficacité neutre ou super efficace, zone par cible, drain, impacts
multiples, double K.O., réflexion de capacité et d'entrée, hôte, invité et
reconnexion.

Prochain lot préparé : réunir `CUTECHARM`, `HEAVYMETAL`, `LIGHTMETAL`, `HEALER`
et `POISONPUPPETEER`. Cute Charm tente à 30 % d'infliger l'attirance à l'auteur
d'un contact si les genres et les protections l'autorisent. Heavy Metal et Light
Metal doublent ou divisent par deux le poids effectif du porteur ; l'effet doit
être centralisé pour les fonctions fondées sur le poids et rester contournable
par Brise Moule lorsque le porteur est la cible. Healer tente à 30 % de soigner
le statut majeur du partenaire actif en double uniquement. Poison Puppeteer
ajoute la confusion lorsqu'un porteur empoisonne directement une autre cible. Le
lot réutilisera les réactions de contact, le volatile d'attirance, les statuts et
la boucle de fin de tour positionnée ; il couvrira RNG autoritaire, genres,
immunités, cible/partenaire par emplacement, simple, double, hôte, invité et
restauration après reconnexion.

## Contact, poids effectif et états liés - 2026-10-22

Le noyau partagé porte maintenant `CUTECHARM`, `HEAVYMETAL`, `LIGHTMETAL`,
`HEALER` et `POISONPUPPETEER`. Cute Charm effectue le tirage source de 30 % après
un contact, puis applique l'attirance seulement si les deux combattants sont
conscients, de genres binaires opposés, si l'auteur n'est pas déjà attiré et si
Benêt ne le protège pas. Le volatile d'attirance et son contrôle d'action
existaient déjà et sont donc réutilisés sans second état parallèle.

Le poids effectif est désormais un calcul commun. Heavy Metal le double, Light
Metal le divise par deux et Brise Moule ignore le talent du défenseur lorsque son
poids est interrogé. `09A` (Balayette/Nœud Herbe) emploie ce calcul au lieu du
poids brut. Le même lot porte `09B` (Tacle Lourd/Heat Crash) : son rapport entre
poids effectifs choisit les puissances source 40/60/80/100/120. Le poids propre
du lanceur conserve naturellement son talent offensif, tandis que Brise Moule ne
neutralise que celui de la cible.

Healer effectue en fin de tour son tirage autoritaire de 30 % et soigne le statut
majeur de l'autre emplacement actif de son camp ; il ne se soigne pas lui-même et
n'a aucune cible en simple. Poison Puppeteer réagit uniquement après qu'un poison
a réellement été appliqué par son porteur à une autre cible, puis ajoute la
confusion avec sa durée tirée par le même RNG. Un échec d'empoisonnement ou Tempo
Perso empêche cette confusion.

Autorité : contact, poids, puissance, tirages, statuts et confusion sont résolus
par le noyau local en solo et par la room autoritaire en Coop. Domaine : état
tactique partagé. Persistance : aucun nouvel état durable ; talents, statuts,
volatiles, poids public et état du RNG font déjà partie des projections ou du
snapshot. Intentions : capacité, attente ou remplacement uniquement. Audience :
participants et observateurs reçoivent activations, statut, confusion et soin ;
en double, l'enveloppe positionnée désigne précisément le partenaire soigné. Le
test de room couvre Poison Puppeteer côté hôte, Cute Charm côté invité, les trois
autres talents en réserve, puis export et reconnexion.

Après `prepare:local`, l'audit passe de 369 à 363 problèmes globaux. Les talents
manquants dans le périmètre courant passent de 20 à 16 ; un talent du lot n'y
était pas requis. Le registre complet compte 233 talents supportés, 1 partiel
(`STURDY`) et 21 absents sur 255. L'ajout de `09B` porte les fonctions supportées
de 104 à 105 sur 353 et réduit les alertes de mécanique d'attaque de 298 à 296 ;
les 51 animations manquantes restent inchangées. Ce résultat illustre le lien du
pipeline : quatre alertes disparaissent grâce aux talents requis et deux grâce à
la fonction d'attaque rendue possible par le même noyau de poids.

Prochain lot préparé : grouper `CABEZAHIELO`, `DESPIERTALLAMA`, `MOODY`, `TRUANT`,
`ARENATRAP`, `MAGNETPULL` et `SHADOWTAG`. Cabeza Hielo possède déjà son exemption
de recul dans le résolveur et demande surtout sa formalisation et ses preuves.
Despiertallama absorbe le type Feu pour augmenter l'Attaque Spéciale ; sa source Z
contient aussi une redirection double atypique déclenchée par les capacités Eau,
qui devra être conservée explicitement. Moody choisit en fin de tour une statistique
éligible à +2 puis une autre à -1. Truant alterne tour d'action et tour d'absence,
avec remise à zéro au retrait et au réveil. Enfin, Arena Trap, Magnet Pull et
Shadow Tag partageront un prédicat de changement volontaire : cible au sol, type
Acier ou adversaire ne possédant pas lui-même Shadow Tag. Le lot couvrira ordre du
RNG, simple, double positionné, switch, retrait/rentrée, hôte, invité et
restauration après reconnexion.

## Recul, absorption, cycles et pièges de changement - 2026-10-22

Le noyau partagé porte maintenant `CABEZAHIELO`, `DESPIERTALLAMA`, `MOODY`,
`TRUANT`, `ARENATRAP`, `MAGNETPULL` et `SHADOWTAG`. Cabeza Hielo bloque le recul
de toute la famille générique `0FA` à `0FE`, et pas seulement le chemin spécial
déjà présent. Despierta Llama absorbe les capacités Feu et augmente l'Attaque
Spéciale d'un cran ; Brise Moule traverse cette immunité. En double, la bizarrerie
de la source Z est conservée : Despierta Llama attire les capacités Eau avant
Lavabo, bien qu'il ne les absorbe pas. Le type effectif de la capacité est utilisé
pour la redirection.

Moody tire en fin de tour une statistique augmentable à +2, puis une autre
statistique réductible à -1. Les deux listes respectent les bornes, la statistique
augmentée est exclue du second tirage et chaque choix est inscrit dans la trace
RNG autoritaire. Truant emploie un volatile partagé `truantLoafing` : il alterne
action et paresse, ne démarre pas son cycle lors d'une entrée en milieu de tour,
se réinitialise au réveil et disparaît au retrait avec les autres volatiles.

Les trois pièges partagent `switchTrapAbility`. Magnet Pull retient les types
Acier, Arena Trap les cibles au sol et Shadow Tag tout adversaire qui ne possède
pas lui-même Shadow Tag. Le type Spectre et `SHEDSHELL` contournent les pièges.
Seuls les changements volontaires passent par ce prédicat : les remplacements
après K.O. restent toujours possibles. Le contrôle est exécuté dans le moteur
simple/double puis dès la réception de l'intention par chaque chemin de room, afin
qu'une action interdite ne soit jamais mise en file ni ne consomme du RNG.

Autorité : dégâts, redirection, tirages de Moody, cycle de Truant et droit de
changer sont calculés par le noyau local en solo et par la room autoritaire en
Coop. Domaine : état tactique partagé. Persistance : seul `truantLoafing` ajoute
un état de combat ; il appartient au snapshot, est restauré à la reconnexion et
au redémarrage de room, puis effacé au retrait. Intentions : capacité, attente ou
indice de remplaçant uniquement. Audience : participants et observateurs reçoivent
activations, crans, action sautée et état résolu ; le refus de changement reste
personnel au demandeur avant réplication.

Après `prepare:local`, l'audit passe de 363 à 358 problèmes globaux et les talents
manquants dans le périmètre courant de 16 à 11 ; deux talents du lot n'étaient pas
requis par ce périmètre. Le registre complet compte 240 talents supportés, 1
partiel (`STURDY`) et 14 absents sur 255. Les 105 fonctions supportées sur 353,
296 mécaniques d'attaque manquantes et 51 animations manquantes restent
inchangées. Les tests couvrent recul, Brise Moule, absorption et redirection,
bornes/RNG de Moody, alternance/retrait de Truant, exemptions des trois pièges,
simple, double, hôte, invité, refus autoritaire et restauration de room.

Prochain lot préparé : `PODERSABIO`, `SUCTIONCUPS`, `PARENTALBOND`,
`EMERGENCYEXIT`, `DISGUISE`, `FLOWERGIFT` et `FORECAST`. Poder Sabio combinera
le multiplicateur spécial ×1,5 avec le verrou de capacité de la source. Suction
Cups centralisera l'immunité aux changements forcés. Parental Bond étendra le
contrat multi-impact à deux frappes, avec seconde frappe réduite et exclusions
source. Emergency Exit conservera la variante Z : une capacité Insecte du
porteur prépare son propre retrait. Disguise demandera le premier impact annulé,
le passage de forme et la perte de 1/8 des PV ; Flower Gift partagera sous soleil
les multiplicateurs physiques offensif et défensif au partenaire ; Forecast
ouvrira le contrat générique de forme/type piloté par le climat. Ce lot devra
expliciter formes publiques, changement forcé, sélection du remplaçant, double,
room et reconnexion avant de déclarer ces talents supportés.

## Verrou, impacts, retrait et formes de talent - 2026-10-22

Le noyau partagé porte maintenant `PODERSABIO`, `SUCTIONCUPS`, `PARENTALBOND`,
`EMERGENCYEXIT`, `DISGUISE`, `FLOWERGIFT` et `FORECAST`. Poder Sabio multiplie
par 1,5 l'Attaque Spéciale effective des capacités spéciales et mémorise la
première capacité employée dans `choiceLockedMove`; ce verrou volatil est repris
par le snapshot puis disparaît au retrait. Suction Cups expose le prédicat commun
qui bloque un changement imposé par l'adversaire, sauf contournement Brise Moule.
Les fonctions source `0EB`/`0EC` restent auditées séparément tant que leurs
capacités de changement forcé ne sont pas portées.

Parental Bond produit deux calculs d'impact indépendants pour une capacité
offensive à cible unique qui n'est ni multi-impact, ni en deux tours, ni dans les
quatre exceptions source. La seconde frappe est réduite de moitié et les effets
secondaires sont tirés pour chaque impact réellement infligé. Le comportement Z
particulier est conservé : si la première frappe est annulée par Disguise, la
séquence s'arrête. Disguise annule ainsi le premier impact offensif reçu par un
Mimikyu en forme 0, publie sa forme 1 et lui retire `floor(PV max/8)`; Brise Moule
le traverse et le retrait restaure la forme 0.

Flower Gift augmente sous soleil l'Attaque des capacités physiques du porteur ou
de son partenaire actif et la Défense Spéciale du défenseur ou de son partenaire.
Le bonus défensif est traversé par Brise Moule. Aucun changement visuel de Cherrim
n'a été inventé : le script de combat source ne déclenche ici que les
multiplicateurs. Forecast utilise le contrat générique `formChanged` pour rendre
publiques les formes/types de Castform : Feu au soleil, Eau sous pluie, Glace sous
grêle, Roche sous tempête de sable, Normal sinon. Air Lock et Ciel Gris neutralisent
ce changement sans supprimer le climat sous-jacent; retrait et rentrée restaurent
puis réconcilient la forme et les types.

Emergency Exit conserve la variante propre à Pokemon Z : après avoir infligé des
dégâts avec une capacité Insecte, le porteur vivant demande son propre retrait si
une réserve existe. L'intention de remplacement n'est jamais choisie côté client
pour un autre propriétaire : `pivotRequired` en simple et
`slotPivotReplacements` en double identifient le camp ou l'emplacement, puis le
protocole autoritaire existant reçoit l'indice choisi. Cet état est répliqué et
restauré à la reconnexion. Dette explicite : le résolveur atomique termine le tour
avant cette sélection, alors que le Ruby suspend la suite des actions juste après
l'attaque à la manière de Demi-Tour. Les marqueurs et l'audience sont prêts; une
future reprise intra-tour devra réutiliser ce contrat plutôt que choisir
automatiquement une réserve privée.

Autorité : dégâts, formes, climat, verrou et demandes de retrait sont décidés par
le même noyau en solo et par la room en Coop. Domaine : état tactique partagé,
avec choix de réserve personnel à son propriétaire. Persistance : formes, types,
verrou et pivot en attente vivent dans le snapshot de combat; rien ne persiste
après sa clôture. Intentions : capacité, attente, changement ou indice de
remplaçant. Audience : les participants et observateurs reçoivent impacts,
activations, `formChanged`, demande puis changement; seuls les contrôleurs
autorisés peuvent répondre au pivot. Les tests couvrent simple, double positionné,
hôte, invité, reconnexion, retrait/rentrée, météo extrême ou neutralisée, exclusions
multi-impact, Déguisement et Brise Moule.

Après `prepare:local`, l'audit passe de 358 à 353 problèmes globaux et les talents
manquants dans le périmètre courant de 11 à 6. Le registre complet compte 247
talents supportés, 1 partiel (`STURDY`) et 7 absents sur 255. Les 105 fonctions
supportées sur 353, 296 mécaniques d'attaque manquantes et 51 animations manquantes
restent inchangées.

Prochain lot préparé : fermer les sept talents encore absents du registre avec
`FORMAILUSORIA`, `HONEYGATHER`, `ILLUSION`, `MULTITYPE`, `NEUTRALIZINGGAS`,
`STANCECHANGE` et `ZENMODE`. Il faudra d'abord séparer les formes pilotées par un
seuil de PV ou une catégorie de capacité des apparences trompeuses, puis définir
la suppression globale et réversible de Neutralizing Gas. Multitype devra dériver
forme et type du support d'objet source sans liste propre aux attaques. Honey
Gather relève du règlement persistant de fin de combat et doit rester personnel
au propriétaire. Le lot devra couvrir entrée/retrait, K.O., changement de talent,
objets, formes publiques, double, hôte, invité, règlement et reconnexion.

## Derniers talents : formes, illusion, suppression globale et règlement - 2026-10-22

Le registre ne contient plus aucun talent inerte. Le noyau partagé porte maintenant
`FORMAILUSORIA`, `HONEYGATHER`, `ILLUSION`, `MULTITYPE`, `NEUTRALIZINGGAS`,
`STANCECHANGE` et `ZENMODE`. Forme Illusoire place Greninja en forme 1 au-dessus
des deux tiers de ses PV, sauf formes Méga 2 à 4, et applique exactement le facteur
d'esquive source de 1,7 au-dessus de 75 %. Zen Mode place Darmanitan à mi-PV ou
moins dans sa forme 1 Feu/Glace décrite par les données locales. Le script local
ne contenait pas de hook de seuil pour ce dernier talent : le seuil canonique est
donc explicite dans le noyau, tandis que types et caractéristiques restent ceux de
la forme réellement fournie par Pokemon Z.

Multitype dérive la forme et le type d'Arceus des seize Plaques source, les rend
inamovibles et applique leur bonus de type de 20 %. Le talent brut conserve cette
protection et cette forme sous Gaz Réactif, conformément aux contrôles directs de
la source. Stance Change transforme Aegislash avant l'action : une capacité
offensive passe en forme Assaut et échange les couples Attaque/Défense et Attaque
Spéciale/Défense Spéciale ; Bouclier Royal restaure la forme Parade. Le retrait
restaure forme, types et caractéristiques d'origine.

Illusion conserve toujours l'identité mécanique de Zoroark. Elle publie seulement
l'espèce, le nom, les types affichés, la forme, le chromatisme et le genre du
dernier Pokémon apte de l'équipe ; sprite, cri et HUD emploient cette identité
publique, y compris pour un joueur distant. Les premiers dégâts directs la lèvent.
Une Illusion qui entre alors que Gaz Réactif est déjà actif n'est pas créée ; une
illusion existante reste masquée tant que son talent est neutralisé, comme dans le
prédicat `hasWorkingAbility` source.

Gaz Réactif neutralise de façon globale et réversible les autres talents actifs en
simple comme en double, sans effacer leur identité persistante. L'entrée, les
formes, la précision, les dégâts, les objets et les réactions de fin de tour passent
par le même état effectif. Lorsque le dernier porteur conscient tombe K.O., les
talents reviennent immédiatement pour les réactions post-impact et les actions
suivantes ; météo et talents de partenaire sont eux aussi recalculés. Honey Gather
est résolu seulement après une victoire : chaque membre non-Œuf, même K.O., sans
objet et porteur du talent reçoit Miel selon `5 + floor((niveau-1)/10) * 5` pour
cent. Le résultat est stocké comme objet tenu persistant.

Autorité : formes, suppression, dégâts et tirages sont calculés par le noyau local
en solo et par la room autoritaire en Coop. Le tirage Honey Gather n'est jamais
refait par un client : la room publie seulement les identifiants des Pokémon ayant
réussi, puis le règlement personnel les applique de façon idempotente. Domaine :
formes et Illusion sont tactiques et publiques ; Honey Gather est personnel et
persistant. Persistance : formes, statistiques restaurables, Illusion et talents
effectifs vivent dans le snapshot de combat ; les identifiants Honey Gather vivent
dans le règlement, et le Miel dans l'équipe sauvegardée. Intentions : aucune
nouvelle intention client. Audience : participants et observateurs voient formes,
apparence trompeuse et activations ; seul le propriétaire reçoit la mutation de son
équipe après victoire. Les chemins solo, hôte, invité, rendu distant et restauration
de room utilisent les mêmes contrats.

Après `prepare:local`, l'audit passe de 353 à 348 problèmes globaux. Il ne reste
qu'une dépendance de talent, `STURDY`, déjà classée partielle ; les sept absences
du registre sont closes. Le registre complet compte 254 talents supportés, 1
partiel et 0 absent sur 255. Les 105 fonctions de capacités supportées sur 353,
296 mécaniques de capacité manquantes et 51 animations manquantes restent
inchangées. Les tests couvrent seuils et restauration de formes, Plaques, rendu et
rupture d'Illusion, suppression/réactivation de Gaz Réactif, simple, double,
autorité hôte/invité, règlement Honey Gather idempotent et reconnexion de room.

Prochain lot préparé : sept fonctions d'attaque très diffusées qui réutilisent
le noyau générique de crans. `026` (Danse Draco) augmente Attaque et Vitesse de 1,
`02C` (Plénitude) Attaque Spéciale et Défense Spéciale de 1, `02E` (Danse-Lames)
augmente l'Attaque de 2 et `032` (Machination) l'Attaque Spéciale de 2. Les fonctions
offensives `03C` (Close Combat et variantes) baissent Défense et Défense Spéciale
de 1 après des dégâts, `03E` baisse la Vitesse de 1 et `03F` l'Attaque Spéciale de
2. Elles représentent plus de mille dépendances dans le rapport courant. Le lot
devra respecter les bornes, Simple, Contestation, les échecs partiels des boosts
combinés, l'application seulement après un impact réel, les événements positionnés
en double et la restauration autoritaire après reconnexion.

## Premier lot de fonctions d'attaque : variations de statistiques - 2026-10-22

Le noyau partagé porte maintenant `026` (Danse Draco), `02C` (Plénitude), `02E`
(Danse-Lames et éventuels effets additionnels offensifs), `032` (Machination),
`03C` (Close Combat et variantes), `03E` (Marteau de Glace, Marto-Poing et
Dérapage) et `03F` (Surchauffe, Tempête Verte, Draco-Météore et variantes).
Les quatre premières familles appliquent respectivement Attaque/Vitesse +1,
Attaque Spéciale/Défense Spéciale +1, Attaque +2 et Attaque Spéciale +2. Une
capacité combinée réussit si au moins un cran peut encore changer ; chaque
caractéristique déjà à sa borne produit son échec ciblé sans annuler les autres.

Les trois familles offensives n'appliquent leur contrecoup qu'après au moins un
point de dégâts réel : Défense et Défense Spéciale -1 pour `03C`, Vitesse -1 pour
`03E`, Attaque Spéciale -2 pour `03F`. Une immunité, une protection ou tout autre
impact nul ne baisse donc rien. Toutes ces variations passent par le résolveur
commun des crans : Simple double l'amplitude, Contestation inverse le signe, les
bornes -6/+6 sont respectées et les baisses personnelles ne déclenchent pas les
protections réservées aux baisses imposées par un adversaire.

Autorité : choix de capacité, dégâts et crans sont résolus par le même noyau en
solo et par la room autoritaire en Coop. Domaine : état tactique partagé.
Persistance : les crans vivent dans le snapshot de combat, sont visibles par les
participants et observateurs, restaurés à la reconnexion ou au redémarrage de la
room, puis remis à zéro lors d'un retrait selon le contrat existant. Intentions :
aucune nouvelle intention réseau. Audience : les événements `statStageChanged`
et `statStageChangeFailed` sont positionnés par l'adaptateur double existant. Les
tests couvrent joueur local, hôte, invité, Simple, Contestation, bornes partielles,
impact nul et restauration autoritaire.

Compteurs après `prepare:local` :

- registre complet des fonctions de capacité : **112 couvertes / 241 non
  couvertes / 353 au total**, soit 31,73 % ;
- audit des contenus réellement utilisés : **280 alertes de mécanique d'attaque**,
  contre 296 avant ce lot ;
- audit global : **336 problèmes**, composés de 280 mécaniques, 55 animations et
  1 talent partiel (`STURDY`).

Ces nombres mesurent deux choses différentes. Le registre compte chaque code de
fonction une seule fois, même s'il n'est utilisé par aucun contenu du périmètre.
Les 336 problèmes globaux correspondent aux dépendances concrètes rencontrées.
Rendre une fonction compatible rend aussi ses animations éligibles : ce lot a
retiré 16 alertes de mécanique, importé automatiquement les animations disponibles
et révélé quatre correspondances d'animation réellement absentes. Le total net
passe ainsi de 348 à 336, et 587 animations sont prêtes.

Prochain lot préparé : poursuivre les variations déterministes avec `024`
(Gonflette : Attaque/Défense +1), `025` (Enroulement : Attaque/Défense/Précision
+1), `029` (Aiguisage : Attaque/Précision +1), `02A` (Force Cosmique et Appel
Défense : Défense/Défense Spéciale +1), `02B` (Papillodanse : Attaque Spéciale,
Défense Spéciale et Vitesse +1), `036` (Chgt Vitesse : Vitesse +2 puis Attaque
+1) et `038` (Cotogarde : Défense +3, y compris comme effet additionnel d'une
capacité offensive). Ce lot réutilisera le même contrat de bornes, Simple,
Contestation, double, room et reconnexion.

## Deuxième lot de fonctions d'attaque : augmentations combinées - 2026-10-22

Le noyau partagé porte désormais `024`, `025`, `029`, `02A`, `02B`, `036` et
`038`. Les huit capacités locales correspondantes sont toutes des capacités de
statut. Une table commune décrit les crans dans l'ordre de la fonction :
Attaque/Défense pour Gonflette, Attaque/Défense/Précision pour Enroulement,
Attaque/Précision pour Aiguisage, Défense/Défense Spéciale pour Force Cosmique et
Appel Défense, Attaque Spéciale/Défense Spéciale/Vitesse pour Papillodanse,
Vitesse +2 puis Attaque +1 pour Chgt Vitesse, Défense +3 pour Cotogarde. Le
résolveur existant applique Simple, Contestation, les bornes et les échecs
individuels. Une capacité combinée réussit dès qu'un de ses crans progresse.
La même fonction accepte un effet additionnel offensif si un futur contenu source
emploie l'un de ces codes avec une puissance et une probabilité d'effet.

Autorité : le noyau de combat local en solo et la room en Coop calculent les
mêmes crans à partir des seules intentions de capacité. Domaine : état tactique
partagé. Persistance : les crans sont dans le snapshot autoritaire et sont
restaurés après reconnexion ou redémarrage de room, puis remis à zéro au retrait.
Audience : joueurs, adversaires et observateurs reçoivent les événements de
variation de cran, positionnés en double. Les tests couvrent les sept fonctions,
Simple, Contestation, bornes partielles ou totales, double positionné via le
résolveur commun, hôte, invité et restauration de room.

Après `prepare:local`, le registre compte **119 fonctions couvertes / 234 non
couvertes / 353 au total**, soit 33,71 %. L'audit du contenu courant compte
**272 alertes de mécanique d'attaque**, 55 animations manquantes et 1 talent
partiel (`STURDY`) : **328 problèmes globaux**. 596 animations sont prêtes.

Prochain lot préparé : `031` (Allègement : Vitesse et poids temporaire), `035`
(Exuviation : défenses -1, Attaque/Attaque Spéciale/Vitesse +2), `039`
(Lumiqueue : Attaque Spéciale +3), `03B` (Surpuissance : Attaque/Défense -1
après impact), `03D` (Coup Victoire : Défense/Défense Spéciale/Vitesse -1 après
impact), `04A` (Chatouille : Attaque/Défense adverses -1) et `04E`
(Séduction : condition de genre puis Attaque Spéciale adverse -2). Vérifier les
conditions exactes de la source, les immunités, l'ordre des événements et la
restauration du poids temporaire avant de classer ces codes comme supportés.

## Troisième lot de fonctions d'attaque : poids et baisses conditionnelles - 2026-10-22

Le noyau partagé porte `031`, `035`, `039`, `03B`, `03D`, `04A` et `04E` d'après
leurs classes Ruby locales. `031` augmente la Vitesse de 2 et retire 100 kg au
poids effectif à chaque usage réussi ; le changement est volatil, cumulatif et
effacé au retrait. Le calcul de poids commun utilise ce changement après les
modificateurs de talent, comme la source. `035` n'agit que si au moins une des
trois hausses est possible ; il baisse Défense et Défense Spéciale avant de monter
Attaque, Attaque Spéciale et Vitesse. `039` monte l'Attaque Spéciale de 3.

`03B` baisse Attaque et Défense après des dégâts réels. `03D` baisse Vitesse,
Défense et Défense Spéciale dans cet ordre ; en double, sa variante Z enlève aussi
`floor(PV max/16)` à l'allié vivant. Le dégât allié est publié comme événement
positionné et peut le mettre K.O. `04A` baisse Attaque et Défense adverses ;
`04E` baisse l'Attaque Spéciale de 2 uniquement face au genre opposé, et Brume
ou Benêt bloquent l'effet selon leurs conditions source. Les baisses
passent par le noyau commun de Simple, Contestation, protections de statistiques
et réactions aux baisses imposées. Une capacité combinée réussit si au moins un
cran est modifié. La source du lot ne contient ni clone offensif de ces deux
dernières fonctions, ni Clonage déjà porté ; leur branche additionnelle reste
soumise au raccord futur de cette mécanique.

Autorité : résolveur local en solo, même résolveur dans la room pour l'hôte et
l'invité. Domaine : poids volatil et crans tactiques partagés. Persistance : le
snapshot autoritaire transporte le poids temporaire et les crans à la
reconnexion ; le retrait efface le poids temporaire et les crans selon le contrat
existant. Intentions : seulement capacité et cible habituelles. Audience : les
participants et observateurs voient événements de crans, dégâts et K.O.
positionnés. Les tests couvrent impact nul, immunité, coût allié en double,
bornes, Simple, Contestation, genre, Benêt, hôte/invité et reprise de room.

Après `prepare:local` : **126 fonctions couvertes / 227 non couvertes / 353 au
total**, soit 35,69 %. L'audit courant compte **266 alertes de mécanique
d'attaque**, 55 animations manquantes et 1 talent partiel (`STURDY`) : **322
problèmes globaux**. 604 animations sont prêtes.

Prochain lot préparé : `037` (Acupression : tirage RNG parmi les crans
augmentables), `03A` (Cognobidon : coût de PV et Attaque maximale), `040`
(Flatterie : Attaque Spéciale +1 puis confusion), `041` (Vantardise : Attaque +2
puis confusion), `050` (Bain de Smog : remettre les crans de la cible à zéro après
impact), `051` (Buée Noire : remettre les crans de tous les combattants à zéro)
et `056` (Brume : protection de camp contre les baisses adverses). Vérifier les
classes Ruby et brancher la protection de Brume sur toutes les baisses hostiles,
pas seulement sur les nouvelles fonctions ; couvrir le tirage autoritaire, les
alliés en double et la reconnexion.

## Quatrième lot de fonctions d'attaque : tirage, confusion et remise à zéro - 2026-10-22

Les sept fonctions `037`, `03A`, `040`, `041`, `050`, `051` et `056` sont dans le
noyau partagé. Acupression construit les sept caractéristiques augmentables dans
l'ordre Ruby, tire une seule fois dans la trace RNG autoritaire et augmente de 2
le porteur ou l'allié ciblé. Cognobidon exige plus de la moitié des PV maximaux,
retire `floor(PV max/2)` et fixe l'Attaque à +6, ou -6 sous Contestation.
Flatterie et Vantardise appliquent leur hausse adverse et la confusion de façon
indépendante : une hausse bloquée n'empêche pas la confusion, ni l'inverse.
Tempo Perso, Rune Protect et Brise Moule suivent les prédicats source déjà partagés.

Bain de Smog remet les sept crans de la cible à zéro seulement après des dégâts
réels. Buée Noire remet à zéro les combattants actifs, y compris les quatre slots
en double. Ce nettoyage direct ne déclenche pas Contestation, Acharné ou Battant.
Brume dure cinq fins de tour source, couvre le camp entier et bloque les baisses
hostiles dans le résolveur générique des crans, puis à l'entrée pour Intimidation
et ses variantes. Infiltrateur contourne Brume selon le contrôle Ruby ; les
baisses personnelles et les augmentations ne sont pas bloquées. L'événement
`statStageChangeFailed` signale désormais la raison `mist` et la présentation
affiche explicitement la protection.

Autorité : RNG, PV, confusion, crans et durée de Brume sont calculés par le
résolveur local en solo ou par la room autoritaire en Coop. Domaine : état
tactique partagé. Persistance : tous ces états figurent dans le snapshot et sont
restaurés à la reconnexion et au redémarrage de room ; les effets volatils
s'effacent selon leur contrat de retrait ou de fin de tour. Intentions : capacité
et cible habituelles seulement. Audience : événements positionnés aux
participants et observateurs. Les tests couvrent tirage filtré et absence de
tirage en échec, PV et Contestation, confusion et Tempo Perso, immunité à Bain de Smog,
quatre combattants de Buée Noire, Brume contre Rugissement et Intimidation,
Infiltrateur, allié double, hôte/invité et restauration de room. Les interactions
avec Clonage et Bouclier Rusé devront être raccordées lorsque leurs états et
fonctions seront portés ; ce lot ne les simule pas isolément.

Après `prepare:local` : **133 fonctions couvertes / 220 non couvertes / 353 au
total**, soit 37,68 %. L'audit courant compte **259 alertes de mécanique
d'attaque**, 55 animations manquantes et 1 talent partiel (`STURDY`) : **315
problèmes globaux**. 613 animations sont prêtes.

Prochain lot préparé : les transformations déterministes de statistiques `052`
(échange Attaque/Attaque Spéciale), `053` (échange Défense/Défense Spéciale),
`054` (échange de tous les crans), `055` (copie des crans adverses), `057`
(échange des statistiques physiques de base du porteur), `058` (moyenne des
Attaques physique/spéciale) et `059` (moyenne des Défenses physique/spéciale).
Vérifier les classes Ruby pour les exceptions de Clonage, la persistance
temporaire au retrait, la cible en double et les événements nécessaires au rendu.

## Cinquième lot de fonctions d'attaque : échanges et moyennes - 2026-10-22

Les sept fonctions `052`, `053`, `054`, `055`, `057`, `058` et `059` suivent les
classes Ruby locales. Les trois échanges et la copie de crans affectent directement
les niveaux concernés, sans passer par Simple, Contestation ni les protections
contre les baisses. Ils réussissent même si les niveaux sont identiques. `057`
échange les valeurs effectives d'Attaque et Défense du porteur à chaque usage ;
`058` et `059` attribuent aux deux combattants la moyenne entière inférieure des
Attaques ou Défenses concernées. Ces valeurs sont distinctes des crans et sont
restaurées au retrait, sans altérer durablement les statistiques de l'équipe.

Autorité : le noyau unique résout l'intention de capacité en solo et dans la room
pour l'hôte et l'invité. Domaine : état tactique partagé ; aucune donnée personnelle
n'est publiée. Persistance : valeurs modifiées, crans et sauvegarde des valeurs
avant modification vivent dans le snapshot autoritaire et survivent à la
reconnexion ou au redémarrage de room. Audience : les événements de crans et de
statistiques effectives sont présentés aux participants ; le résolveur double
conserve la cible positionnée. Les tests couvrent les sept codes, Contestation,
arrondi, bascule de Power Trick, retrait, cible double et restauration Coop.

Dépendances conservées pour le futur : `055` devra consulter Bouclier Rusé quand
son état existera ; `058` et `059` devront respecter Clonage et ses exceptions
quand cette mécanique sera portée. Leur absence n'est pas simulée par un état
inventé. Vérifier aussi l'interaction des statistiques temporaires avec les
changements de forme successifs lorsque ces scénarios seront audités.

Après `prepare:local` : **140 fonctions couvertes / 213 non couvertes / 353 au
total** (39,66 %). L'audit courant compte **252 alertes de mécanique d'attaque**,
55 animations manquantes et 1 talent partiel (`STURDY`) : **308 problèmes
globaux**. 621 animations sont prêtes.

Prochain lot préparé : `05A` (Divide Douleur : moyenne des PV avec plafonds),
`060` (Camouflage : type selon terrain et environnement), `061` (Soak :
changement de type de la cible), `062` (Clonatipo : copie des types), puis `063`,
`065` et `066` (Onda Simple, Imitation, Danse Amiga : remplacement temporaire des
talents). Vérifier dans le Ruby les exclusions exactes, les protections Clonage et
Bouclier Rusé, les réactions d'Illusion/Gaz Réactif, ainsi que la restitution au
retrait. `05C`-`05F` (Mimic, Sketch et conversions) restent à traiter dans un lot
dédié car ils requièrent un contrat durable de capacités et un historique de type.

## Sixième lot de fonctions d'attaque : PV, types et talents - 2026-10-22

Les sept fonctions `05A`, `060`, `061`, `062`, `063`, `065` et `066` utilisent le
noyau partagé. Divide Douleur calcule la moyenne entière inférieure des PV
actuels, plafonnée séparément aux PV maximaux des deux combattants. Camouflage
choisit son type selon l'environnement source et laisse le terrain actif primer ;
Soak remplace les types de la cible par Eau et Clonatipo copie ceux de la cible.
Les protections Multitype et les échecs de type identique suivent les classes Ruby.
Les types initiaux sont conservés dans l'état volatil et restaurés au retrait.

Onda Simple, Imitation et Danse Amiga emploient le remplacement temporaire de
talent existant, avec les listes d'exclusion source et la rupture immédiate
d'Illusion lorsqu'elle est remplacée. Le talent d'origine revient au retrait.
Les changements de PV, de types et de talents sont émis vers les participants ;
la présentation répercute les PV et les types au cours de la séquence. Le
résolveur double conserve la cible choisie, tandis que la room autoritaire
résout les intentions hôte et invité. Les snapshots restaurent types, talents,
PV et provenance des remplacements après reconnexion ou redémarrage de room.

Dépendances à raccorder : les contrôles de Clonage de `05A`, `061`, `063` et
`066`, et Bouclier Rusé de `065` et `066`, attendent ces mécaniques communes.
Les transitions de Gaz Réactif provoquées au milieu d'un tour par changement
de talent demandent un audit complémentaire ; le noyau traite déjà sa suppression
au début du tour, mais ce lot ne prétend pas couvrir toutes les transitions
instantanées. Les interactions complexes avec Transform et les formes restent à
vérifier dans le lot dédié.

Après `prepare:local` : **147 fonctions couvertes / 206 non couvertes / 353 au
total** (41,64 %). L'audit courant compte **245 alertes de mécanique d'attaque**,
55 animations manquantes et 1 talent partiel (`STURDY`) : **301 problèmes
globaux**. 631 animations sont prêtes.

Prochain lot préparé : les dégâts déterministes `06A` (Bomba Sónica : 20 PV),
`06B` (Furia Dragón : 40 PV), `06C` (Superdiente : moitié des PV actuels),
`06E` (Esfuerzo : ramener la cible aux PV du porteur) et `070` (capacités K.O.
en un coup), puis `067` (échange des talents) et `068` (suppression temporaire
du talent). Vérifier les classes Ruby, immunités, Clonage, précision spéciale,
garde-fous de talents, réactions Gaz Réactif et restitution avant de classer le
lot suivant comme terminé. `05C`-`05F` restent planifiées séparément.

## Septième lot de fonctions d'attaque : dégâts fixes et talents - 2026-10-22

Les sept codes `06A`, `06B`, `06C`, `06E`, `070`, `067` et `068` sont raccordés
au noyau commun. Bomba Sónica inflige 20 PV et Furia Dragón 40 PV ; Superdiente
retire au moins un PV et au plus la moitié entière des PV courants ; Esfuerzo
échoue si les PV du porteur ne sont pas strictement inférieurs à ceux de la
cible. Ces dégâts passent par le même pipeline que `06D` et `06F`, avec
immunités de type, protection, Ceinture Force, événements de dégâts et K.O.
Les dégâts fixes ignorent désormais les multiplicateurs de dégâts et le second
coup de Lien Parental. `070` applique la précision source `précision + différence
de niveau`, sans crans de précision/esquive ; un niveau inférieur ou Fermeté
active l'échec avant les dégâts, sauf contournement par Brise Moule.

Échange échange les talents actifs (hors exclusions source) et réexécute les
hooks d'entrée des deux combattants. Bilis supprime le talent effectif jusqu'au
retrait, remet la phase de Truant à zéro et rompt Illusion si nécessaire. Les
deux fonctions utilisent le mécanisme de provenance volatil partagé : les
talents d'origine sont restaurés au switch. Les événements d'échange et de
suppression sont publiés aux participants.

Autorité : intentions habituelles, calcul et RNG du noyau local en solo ou de
la room en Coop. Domaine : état tactique partagé. Persistance : PV, talents
actifs, suppression et provenance sont dans le snapshot, restaurés après
reconnexion et redémarrage de room. Audience : les effets et dégâts sont
présentés à l'hôte, à l'invité et aux observateurs ; le résolveur double garde
la cible positionnée. Les tests couvrent les cinq dégâts, immunités, arrondi,
précision, Fermeté, Brise Moule, Lien Parental, échange, suppression, retrait,
présentation et restauration Coop.

Dépendances à fermer : Clonage pour Bilis et les dégâts fixes, ainsi que les
transitions instantanées de Gaz Réactif lorsqu'un échange crée ou déplace son
porteur en cours de tour. Dans un double, les hooks d'entrée déclenchés par
Échange doivent encore être audités vis-à-vis des deux adversaires ; le noyau
positionné ne reçoit actuellement que la cible de l'action. Les comportements
ordinaires solo/Coop sont communs, mais ces interactions transversales ne sont
pas déclarées validées manuellement.

Après `prepare:local` : **154 fonctions couvertes / 199 non couvertes / 353 au
total** (43,63 %). L'audit courant compte **235 alertes de mécanique d'attaque**,
55 animations manquantes et 1 talent partiel (`STURDY`) : **291 problèmes
globaux**. 643 animations sont prêtes.

Prochain lot préparé : `05C` (Mimic : remplacement temporaire d'une capacité),
`05D` (Sketch : apprentissage durable dans l'équipe), `05E` (Conversion : type
d'une capacité du porteur) et `05F` (Conversion 2 : type résistant à la dernière
capacité adverse). Ce lot doit d'abord préciser la persistance personnelle de
Sketch, l'historique de capacité/type, le tirage RNG autoritaire, les exclusions
source et les tests de reconnexion. Les représailles `071`-`073` formeront le
lot suivant, après ce contrat d'historique.

## Huitième lot de fonctions d'attaque : copies et conversions - 2026-10-22

`05C`-`05F` sont exécutées par le noyau commun. Mimic copie temporairement la
dernière capacité de la cible dans son propre emplacement et retrouve sa capacité
et ses PP après retrait. Sketch enregistre la capacité esquissée dans
`sketchedMoveSlots` hors du volatil de combat : elle demeure après changement de
Pokémon et remplace durablement Sketch dans la sauvegarde personnelle à la
clôture du combat. Les exclusions source (capacités interdites, Ombre, capacité
déjà connue, Transform) sont vérifiées. Conversion retient la première capacité
éligible du porteur selon la mécanique moderne de la source ; Conversion 2 tire
un type résistant ou immunisé à la dernière capacité adverse effectivement
utilisée. Les deux types temporaires reviennent au retrait et leurs tirages
figurent dans la trace RNG.

Autorité : intention `submitAction` de chaque joueur, calcul local en solo et
room autoritaire en Coop. Domaine : historique/type/copie tactiques partagés ;
apprentissage Sketch personnel au propriétaire du Pokémon. Persistance :
historique, types temporaires et remplacement Sketch dans le snapshot de room,
puis seul Sketch dans l'équipe personnelle ; Mimic n'y inscrit jamais la capacité
copiée. Réplication : événements de copie et de type et état minimal du
combattant ; audience : participants, avec règlement de l'équipe réservé au
propriétaire. Tests : solo, hôte, invité, restitution au retrait, règlement
personnel, reconnexion et redémarrage de room.

Le registre des fonctions acceptées par l'adaptateur d'équipe personnelle et
l'audit d'extraction est désormais partagé avec `battle-engine` ; l'ancienne
liste locale rejetait plusieurs fonctions pourtant déjà portées. Après
`prepare:local` : **158 fonctions couvertes / 195 non couvertes / 353 au total**
(44,76 %). L'audit compte **231 alertes de mécanique d'attaque**, 55 animations
manquantes et 1 talent partiel (`STURDY`) : **287 problèmes globaux**. 649
animations sont prêtes.

Dépendances ouvertes : Bouclier Rusé doit encore être raccordé au blocage de
Sketch et Conversion 2, et les interactions avec Clonage/Transform et les
fenêtres d'échec avant lancement d'une capacité restent à auditer. Prochain lot
préparé : `071` Counter, `072` Mirror Coat et `073` Metal Burst. Ces trois
représailles nécessitent un historique des PV réellement perdus par catégorie,
attaquant et tour, puis le ciblage automatique de la source en double ; ne pas
confondre avec le simple `lastMoveUsedType` introduit ici. Vérifier la réponse
à plusieurs coups, l'ordre, la protection et la restauration Coop avant de
marquer le lot terminé.

## Neuvième lot de fonctions d'attaque : représailles - 2026-10-22

Les codes `071` Counter, `072` Mirror Coat et `073` Metal Burst emploient un
historique tactique unique des PV effectivement perdus, avec tour, attaquant et
catégorie. Counter reprend deux fois le dernier coup physique, Mirror Coat deux
fois le dernier coup spécial, Metal Burst une fois et demie le dernier coup
toutes catégories confondues (arrondi inférieur). Comme dans les classes Ruby,
un coup multiple remplace l'enregistrement à chaque impact : la riposte ne
somme pas les impacts. Sans coup admissible dans le tour courant, elle échoue.
Les trois passent par le pipeline commun des dégâts fixes, dont immunités,
protection, Ceinture Force et événements de dégâts. En double, la cible est
l'attaquant enregistré s'il est encore présent, même si une autre cible avait
été choisie manuellement ; sinon le ciblage ordinaire reste le repli source.

Autorité : intention du joueur local en solo, et de l'hôte ou de l'invité dans
la room en Coop ; calcul et ordre autoritaires dans le même noyau. Domaine :
historique tactique partagé sur le combattant, non personnel persistant.
Persistance : historique dans les snapshots de combat pour reconnexion ou
redémarrage de room, mais admissibilité limitée à son numéro de tour ; il
disparaît avec le volatil au retrait. Réplication : dégâts et état des
combattants ; audience : participants. Tests : catégories, échec, expiration,
dernier impact multiple, ciblage en double, usage des deux propriétaires et
restauration Coop. Validation visuelle manuelle encore ouverte.

Après `prepare:local` : **161 fonctions couvertes / 192 non couvertes / 353 au
total** (45,61 %). L'audit compte **227 alertes de mécanique d'attaque**,
56 animations manquantes et 1 talent partiel (`STURDY`) : **284 problèmes
globaux**. 654 animations sont prêtes. L'augmentation d'une animation manquante
est une dépendance désormais visible après promotion d'une fonction, pas une
animation inventée.

Prochain lot préparé : `074` Pirotecnia (dégât collatéral à l'allié de la cible)
et `079`/`07A` Rayo Fusión / Llama Fusión (marqueurs réciproques du tour). Le
premier demande l'audience positionnée en double et la garde Magic Guard ; le
duo Fusion demande un état de terrain partagé, consommation du marqueur et
réinitialisation au tour suivant. `075` Surf et `076` Séisme exigent au préalable
le contrat des états semi-invulnérables Plongée/Creusement et restent planifiés.

## Dixième lot de fonctions d'attaque : collatéral et Fusion - 2026-10-22

`074` Pirotecnia conserve ses dégâts directs ordinaires et, en combat double,
retire à l'allié vivant de la cible 1/16 de ses PV maximaux après un impact
effectif (minimum un PV selon `pbReduceHP`). Garde Magik bloque ce dégât
indirect, sauf si son effet est supprimé par Gaz Réactif. L'événement
`collateralDamage` garde la position de l'allié, de sorte que les participants
voient la bonne barre de PV ; il n'est pas traité comme un nouveau coup direct
pour Counter/Mirror Coat. Les K.O. collatéraux entrent dans le remplacement
normal de fin de tour.

`079` Rayo Fusión et `07A` Llama Fusión écrivent chacun un marqueur de champ
après des dégâts effectifs. Leur pendant consomme ce marqueur et double les
dégâts de son coup dans le même tour. Le champ est commun aux camps et aux
deux emplacements du combat double ; les marqueurs sont remis à zéro à la fin
du tour. Un coup immunisé ou manqué ne les arme pas. Les tests couvrent les
deux ordres, l'absence de persistance au tour suivant, l'enchaînement entre
alliés en double, Garde Magik, le rendu de la cible collatérale et les actions
hôte/invité dans la room.

Autorité : intentions du joueur local en solo, et des propriétaires dans la
room autoritaire en Coop. Domaine : marqueurs Fusion tactiques partagés et PV
collatéraux partagés ; aucun état personnel permanent. Persistance : PV et
état de combat restaurés par snapshot après reconnexion ou redémarrage ; les
marqueurs n'ont d'effet que pendant le tour courant. Réplication : événements
de dégâts et état minimal des combattants ; audience : participants, y compris
observateurs. Validation visuelle manuelle encore ouverte. La combinaison
éventuelle de Pirotecnia et Lien Parental demande un contrôle source dédié.

Après `prepare:local` : **164 fonctions couvertes / 189 non couvertes / 353 au
total** (46,46 %). L'audit compte **224 alertes de mécanique d'attaque**,
57 animations manquantes et 1 talent partiel (`STURDY`) : **282 problèmes
globaux**. 658 animations sont prêtes. L'animation supplémentaire signalée
par l'audit n'est pas remplacée par une animation inventée.

Prochain lot préparé : `07C` Estímulo (paralysie et guérison après coup),
`07D` Espabila (sommeil et réveil), `07E` Imagen (statut du porteur), `07F`
Infortunio (statut de la cible), `080` Salmuera (PV à la moitié) et `081`
Desquite/Alud (coup reçu de la cible ce tour). Réutiliser le noyau de dégâts
et étendre l'historique du neuvième lot pour retenir tous les attaquants du
tour, pas uniquement le dernier. Clonage reste une dépendance transverse pour
les effets de statut conditionnels. `075`/`076` restent prévus avec les états
semi-invulnérables Plongée/Creusement.

## Onzième lot de fonctions d'attaque : statuts, PV et attaquants - 2026-10-23

Les six fonctions `07C`-`081` préparées ci-dessus sont exécutées par le noyau
commun. Estímulo et Espabila doublent leur puissance face à une cible paralysée
ou endormie, puis guérissent ce statut uniquement après des dégâts réels si la
cible reste consciente. Imagen double sa puissance si le porteur est empoisonné,
brûlé ou paralysé ; conformément au calcul Ruby de Z, la fonction `07E` ignore
aussi la réduction offensive ordinaire de la brûlure et du gel. Infortunio double
sa puissance face à tout statut majeur et Salmuera face à une cible à la moitié
de ses PV maximaux ou moins.

Desquite et Alud consultent maintenant la liste de tous les attaquants ayant fait
perdre des PV au porteur pendant le tour. La puissance double seulement si la
cible actuelle figure dans cette liste. Le dernier impact par catégorie reste
conservé séparément pour Counter, Mirror Coat et Metal Burst : étendre l'historique
n'a donc pas changé leur règle de représailles. En double, deux adversaires peuvent
être mémorisés et `081` répond correctement à celui qui a été ciblé, même s'il
n'est pas l'auteur du dernier impact.

Autorité : calcul de puissance, pertes de PV, historique et guérison sont résolus
par le noyau local en solo ou par la room autoritaire en Coop. Domaine : état
tactique partagé, sans mutation personnelle permanente. Persistance : la liste
d'attaquants vit dans le volatil du combattant et dans le snapshot de room pour
reconnexion ou redémarrage ; elle n'est admissible que pour son numéro de tour et
disparaît au retrait. Intentions : capacité et cible habituelles uniquement.
Audience : dégâts et `statusCured` sont présentés aux participants et observateurs.
Les tests couvrent les six fonctions, seuil de PV, statuts, exception de brûlure,
absence de guérison après K.O., deux attaquants en double, action de l'invité,
reconnexion et redémarrage de room.

Dépendance ouverte : les contrôles de Clonage de `07C`, `07D` et `07F` attendent
toujours son état partagé ; ce lot ne simule pas un clone absent. Après
`prepare:local` : **170 fonctions couvertes / 183 non couvertes / 353 au total**
(48,16 %). L'audit compte **217 alertes de mécanique d'attaque**, 58 animations
manquantes et 1 talent partiel (`STURDY`) : **276 problèmes globaux**. 665
animations sont prêtes. Les six fonctions rendent sept capacités concrètes
éligibles ; `SMELLINGSALT` reste sans correspondance dans `move2anim.dat` et
emploie donc le fallback prévu, sans animation inventée.

Prochain lot préparé : poursuivre les puissances déterministes avec `084`
(Vendetta selon l'action de la cible), `085` (Represalia après le K.O. d'un allié
au tour précédent), `087` (Meteorobola : météo, puissance et type), `089`/`08A`
(bonheur), puis `08B`/`08C` (PV du porteur ou de la cible). Vérifier l'ordre des
arrondis Ruby, la suppression de météo, l'état de camp du dernier K.O. et la
restauration Coop avant promotion. `075`/`076` restent liés aux états
semi-invulnérables Plongée/Creusement.

## Douzième lot, première tranche : puissances dépendant du contexte - 2026-10-23

Le noyau commun porte `084` (Vendetta/Payback), `089` (Retour), `08A`
(Frustration), `08B` (Éruption/Giclédo) et `08C` (Presse/Essorage).
`084` double sa puissance si la cible a déjà agi ou n'a choisi aucune capacité ;
il utilise l'ordre d'action déjà calculé par le résolveur. `089` et `08A`
emploient le bonheur du combattant, `08B` ses PV actuels et `08C` ceux de la
cible. Les formules et divisions entières sont celles des classes Ruby, avec
une puissance minimale de 1.

Autorité : ces calculs sont faits par le noyau utilisé en solo et par la room
en Coop. Domaine : bonheur personnel projeté dans le combattant, puis ordre et
PV tactiques partagés. Persistance : bonheur dans l'équipe du propriétaire ;
PV et ordre courant dans le snapshot autoritaire. Intentions et audience : les
intentions de capacité ordinaires suffisent et les dégâts sont présentés aux
participants. Les tests ciblés couvrent formules et ordre d'action. La validation
manuelle solo/hôte/invité et reconnexion de cette tranche reste ouverte ; ne pas
déclarer le douzième lot entier terminé.

Après `prepare:local` : **175 fonctions couvertes / 178 non couvertes sur 353**.
Le rapport compte **209 alertes de mécanique d'attaque**, 59 animations absentes,
1 talent partiel et **269 problèmes globaux** ; 675 animations sont prêtes.
L'animation supplémentaire est une absence source exposée par la promotion des
fonctions et garde son fallback.

La seconde tranche `085`/`087` est décrite ci-dessous ; les valeurs d'audit de
ce paragraphe restent le jalon de la première tranche.

## Douzième lot, seconde tranche : Represalia et Meteorobola - 2026-10-23

`085` (Represalia/Retaliate) double sa puissance si le dernier K.O. d'un membre
du camp a eu lieu au tour précédent, exactement comme `LastRoundFainted` dans
la source. Le numéro du tour est conservé dans les effets de camp et enregistré
après chaque tour simple ou double ; aucun bonus n'est retenu deux tours plus
tard. `087` (Meteorobola/Weather Ball) utilise la météo **effective** pour son
type (Feu, Eau, Roche, Glace ou Normal) et double sa puissance dès qu'une météo
est active, y compris Vents Forts où le type reste Normal. Ciel Gris et Air Lock
suppriment ensemble conversion et bonus. Son override Ruby de `pbModifyType`
court-circuite également Normalize et les talents convertissant le type Normal.

Autorité : le noyau partagé calcule les deux attaques en solo et dans la room
autoritaire. Domaine : dernier K.O. tactique du camp, météo partagée et dégâts
visibles aux participants. Persistance : le numéro du dernier K.O. est dans le
snapshot de combat, restauré lors de la reconnexion et du redémarrage ; la météo
est déjà persistée. Intentions : actions et cibles ordinaires, sans message
supplémentaire. Les tests couvrent l'expiration du bonus, le partenaire K.O. en
double, tous les types météo, sa suppression, puis le jeu hôte/invité avec
reconnexion et redémarrage de room. La recette visuelle manuelle reste ouverte.

Après `prepare:local` : **177 fonctions couvertes / 176 non couvertes sur 353**.
Le rapport compte **207 alertes de mécanique d'attaque**, 59 animations
absentes, 1 talent partiel (`STURDY`) et **267 problèmes globaux** ; 678
animations sont prêtes. Les animations absentes conservent le fallback source.

## Treizième lot, première tranche : boosts positifs de stats - 2026-10-23

`08E` (Force Ajoutée/Stored Power) vaut `20 × (1 + somme des niveaux de stats
positifs du porteur)` ; `08F` (Punition/Punishment) vaut `min(200, 20 × (3 +
somme des niveaux positifs de la cible))`. Les sept stats incluent précision et
esquive ; les niveaux négatifs n'annulent pas les positifs. Le calcul réside
dans le noyau partagé et n'ajoute aucun état : les niveaux sont déjà dans les
combattants autoritaires, projetés en solo, répliqués et persistés par la room.
Intentions : capacités/cibles ordinaires. Audience : dégâts aux participants.
Les tests couvrent les formules, le plafond, l'hôte et l'invité, puis la
reconnexion et le redémarrage. Recette visuelle manuelle ouverte.

Après `prepare:local` : **179 fonctions couvertes / 174 non couvertes sur 353**,
204 alertes de mécanique, 60 animations absentes, 1 talent partiel et **265
problèmes globaux** ; 680 animations prêtes. Les absences source utilisent
toujours le fallback.

## Treizième lot, seconde tranche : Puissance Cachée et Écho - 2026-10-23

`090` (Puissance Cachée/Hidden Power) prend son type des bits de parité des six
IV dans l'ordre source ; la projection d'équipe ne réplique que le type dérivé,
jamais les IV personnels. Avec `USENEWBATTLEMECHANICS = true`, la puissance est
70. Sa catégorie est recalculée à chaque usage : Physique si Attaque brute +
niveau d'Attaque dépasse strictement Attaque Spéciale brute + niveau spécial,
Spéciale sinon. L'override Ruby de type ignore les conversions des talents.
Un combattant externe sans type dérivé échoue explicitement au lieu d'inventer
un type ; toute entrée de combat réelle passe par la projection persistante.

`092` (Écho/Echoed Voice) conserve par camp le compteur (1 à 5) et le dernier
tour d'utilisation. Un second partenaire au même tour n'incrémente pas le
compteur ; un tour sans usage brise la chaîne ; une attaque manquée ne compte
pas. Le calcul est fait dans le noyau commun, sans deuxième implémentation
Coop. Autorité : noyau en solo, room en Coop. Domaine : type dérivé du Pokémon
personnel, compteur tactique partagé par camp. Persistance : type et compteur
dans le snapshot de room ; restauration vérifiée après reconnexion et
redémarrage. Intentions : capacité/cible habituelles. Audience : dégâts et
types effectifs visibles aux participants. Tests : IV extrêmes, confidentialité
des IV, catégorie, plafond, échec, double et hôte/invité. Recette visuelle
manuelle encore ouverte.

Le même passage a raccordé l'absorption des attaques `087` au type de météo
effectif ; la pluie permet maintenant à Absorb Eau d'intercepter Meteorobola.
Après `prepare:local` : **181 fonctions couvertes / 172 non couvertes sur 353**,
202 alertes mécaniques, 60 animations absentes, 1 talent partiel et **263
problèmes globaux** ; 682 animations prêtes.

## Quatorzième lot, première tranche : Présent et As Caché - 2026-10-23

`094` (Présent) tire dans la room/le noyau les dix issues source : quatre
puissances 90, trois puissances 140, une puissance 200 et deux soins de la
cible à hauteur d'un quart de ses PV maximaux. Le soin échoue sur une cible
pleine ou immunisée au type et consomme une Gemme applicable comme le calcul
Ruby ; Lien Parental effectue un second tirage sur huit issues dommageables
seulement. `097` (As Caché) lit les PP **après** dépense, y compris le surcoût
de Pression : 0/1/2/3/4 PP ou plus donnent 200/80/60/50/40 de puissance.

Autorité : tirage, dépense des PP, soin et dégâts passent par le noyau unique
en solo et par la room autoritaire en Coop. Domaine : PV/PP tactiques partagés,
aucun nouvel état personnel. Persistance : PV/PP et graine aléatoire sont dans
le snapshot de room, vérifié à la reconnexion et au redémarrage. Intentions :
capacité/cible ordinaires. Audience : événements de soin/dégât et PP pour les
participants. Tests : chaque tirage, soin et échec, Gemme, Lien Parental,
Pression, double, hôte/invité et reprise. Recette visuelle manuelle ouverte.

Après `prepare:local` : **183 fonctions couvertes / 170 non couvertes sur 353**,
200 alertes mécaniques, 60 animations absentes, 1 talent partiel et **261
problèmes globaux** ; 685 animations prêtes.

`096` (Don Naturel) reste **non portée** : le moteur ne projette actuellement
que trois des nombreuses baies de sa table source, et Champ Magique n'a pas
encore d'état partagé. Il faut porter ensemble la table type/puissance,
l'éligibilité (Embargo, Maladresse, Tension et Champ Magique), la consommation
avec son historique d'objet et les tests solo/double/room. Le hook Ruby
`pbEffectAfterHit` contient `TotalDamage>0>0` : vérifier son comportement
réel avant de figer le moment de consommation ; ne pas corriger silencieusement
le script source. Aucune baie ou animation n'a été inventée dans cette tranche.

## Quatorzième lot, seconde tranche : rapport de vitesses - 2026-10-23

`099` (Boule Élek/Electro Ball) applique la table source 60/80/120/150 selon
le rapport entier des vitesses effectives (seuils 2, 3 et 4). Le calcul utilise
les vitesses au moment de l'impact, incluant crans, statuts, talents, Vent Arrière,
terrain et météo effective. En double, l'adaptateur positionné fournit les
vitesses des vrais combattants et leurs camps, sans perdre le Vent Arrière de
la cible dans le mini-duel. L'autorité reste le noyau en solo et la room en
Coop ; le domaine est tactique partagé, sans nouvel état personnel. Les
intentions et la réplication restent celles des attaques ordinaires. Vitesses,
PV et tour sont restaurés par snapshot ; tests de seuils, simple, double,
hôte/invité, reconnexion et redémarrage ajoutés. Recette visuelle ouverte.

Après `prepare:local` : **184 fonctions couvertes / 169 non couvertes sur 353**,
199 alertes mécaniques, 60 animations absentes, 1 talent partiel et **260
problèmes globaux** ; 687 animations prêtes.

`096` demeure non portée : les 67 noms de sa table source dépassent les trois baies
projetées par le combat actuel. Le hook Ruby de consommation contient toujours
`TotalDamage>0>0`, non validé en exécution ; ni son instant de consommation ni
un remplacement implicite ne sont présumés. Prochain lot : contrat générique
des baies et de Champ Magique, puis `096` ; si ce socle n'est pas fermé, avancer
les fonctions indépendantes sans promouvoir `096`.

## Quinzième lot, première tranche : critiques garantis - 2026-10-23

`0A0` (Souffle Glacé/Yama Arashi) force le coup critique après les gardes
source : Armurbaston/Coque Armure d'abord, puis Conjuro ; il ne tire pas de
RNG critique lorsque le coup est garanti. Le même calcul autoritaire sert le
solo, les deux positions du double et les actions hôte/invité. Domaine : dégâts
tactiques partagés, sans nouvel état personnel ; intentions ordinaires et
événements de dégâts répliqués aux participants. PV, tour et graine RNG sont
restaurés par la room ; les tests couvrent gardes, double, reconnexion et
redémarrage. Validation visuelle manuelle ouverte.

Après `prepare:local` : **185 fonctions couvertes / 168 non couvertes sur 353**,
195 alertes mécaniques, 61 animations absentes, 1 talent partiel et **257
problèmes globaux** ; 691 animations prêtes. La nouvelle animation absente
reste en fallback source, sans correspondance inventée.

`096` n'est toujours pas promue. Pour la suite, séparer dans le contrat
d'objet « baie reconnue comme tenue » et « effet automatique de baie porté » :
le filtre actuel `SUPPORTED_HELD_ITEMS` ne transporte que trois baies et ne
peut être étendu aux 67 noms de la table en prétendant que tous leurs effets automatiques
existent. Champ Magique doit être un état de champ partagé, temporisé et
restauré ; Embargo, Maladresse et Tension doivent être évalués sur les vrais
combattants actifs du double. Enfin le hook Ruby `TotalDamage>0>0` reste à
valider avant la règle de consommation. Le prochain lot doit établir ces
contrats puis traiter `096`. Les données `PBS/items.txt` de la version locale
ne définissent que **64** de ces 67 baies (`itemType=5`) : `ROSELIBERRY`,
`KEEBERRY` et `MARANGABERRY` figurent dans le script mais sont absentes du
catalogue. Ne pas les fabriquer ni les compter comme baies atteignables.

## Quinzième lot, seconde tranche : types selon l'objet tenu - 2026-10-23

`09F` (Jugement/Techno Blast) utilise le type des 17 plaques source ou des
quatre modules selon la capacité. Un objet absent, bloqué par Maladresse ou
Embargo, ou de la mauvaise famille laisse le type Normal. L'override Ruby
court-circuite les conversions de type des talents. Les modules sont maintenant
projetés comme objets tenus depuis l'équipe personnelle ; la table des plaques
est partagée avec leur bonus de dégâts existant, sans liste divergente.

Autorité : noyau partagé en solo et room en Coop. Domaine : objet personnel
projeté dans le combattant et type/dégâts tactiques partagés. Persistance :
objet et PV dans le snapshot ; intentions ordinaires ; audience : participants.
Tests : 21 correspondances, absence/blocage d'objet, simple, double, hôte/invité,
reconnexion et redémarrage. La sélection des variantes d'animation de Techno
Blast (`pbShowAnimation` 0 à 4) et Champ Magique restent des interactions
visuelles/transversales ouvertes ; ne pas inventer de variante manquante.

Après `prepare:local` : **186 fonctions couvertes / 167 non couvertes sur 353**,
193 alertes mécaniques, 61 animations absentes, 1 talent partiel et **255
problèmes globaux** ; 694 animations prêtes. Prochain lot : contrat des 64 baies
réelles, Champ Magique, puis `096`.

## Seizième lot, fondation partielle de Don Naturel - 2026-10-23

`096` possède maintenant une table testée des **64 baies réellement définies**
dans `PBS/items.txt` de Z 2.12 FR : 33 à puissance 80, 16 à 90 et 15 à 100
avec `USENEWBATTLEMECHANICS`. Les trois noms du script sans objet PBS
(`ROSELIBERRY`, `KEEBERRY`, `MARANGABERRY`) ne sont pas inventés. Le même
catalogue sert la classification de baie et le calcul type/puissance.

Le noyau exécute `096` pour les trois baies déjà projetées (`ORANBERRY`,
`LIECHIBERRY`, `PAYAPABERRY`) : échec sans baie, sous Embargo, Maladresse,
Tension adverse ou Champ Magique ; consommation enregistrée après perte
effective de PV, conservation en cas d'immunité. En double, Tension est
cherchée chez les deux adversaires actifs. Le compteur de Champ Magique est
ajouté à l'état de champ, décrémenté et restauré dans les snapshots simple
et double, mais sa commande d'activation `0F9` et sa suppression de **tous**
les effets d'objets ne sont pas encore portées.

Ce jalon est **partiel**, pas une promotion : `096` figure comme `partial`
dans le rapport de support, mais reste absente de `SUPPORTED_MOVE_FUNCTION_CODES`
et n'est donc pas proposée par la projection des capacités source. Le choix
provisoire de consommer seulement après des dégâts positifs correspond à
l'intention du hook `pbEffectAfterHit` ; l'expression Ruby `TotalDamage>0>0`
n'a toujours pas été validée en exécution et ne doit pas être présentée comme
une fidélité démontrée. Les 61 autres baies existent dans la table mais ne
sont pas encore transportées comme objets tenus, afin de ne pas masquer leurs
effets automatiques manquants.

Autorité : noyau commun en solo et room autoritaire en Coop ; l'objet reste
personnel dans l'équipe et son usage est tactique partagé. Les intentions
restent celles d'une capacité normale ; type, dégâts, consommation et PV sont
présentés aux participants. Le snapshot restaure objet consommé, historique
de recyclage/ramassage et compteur de champ. Tests : table 64, trois baies
transportées, blocages, immunité, partenaire Tension, hôte/invité,
reconnexion et redémarrage. Validation visuelle ouverte.

**Compteur inchangé : 186 fonctions terminées sur 353, plus `096` partielle.**
L'audit des usages reste à 193 alertes mécaniques, 61 animations absentes,
1 talent partiel et 255 problèmes globaux ; 695 animations prêtes.

Prochain lot : transport distinct des 61 autres baies, effets automatiques
nécessaires et `0F9` Champ Magique avec suppression globale des objets ;
ensuite valider la consommation Ruby et promouvoir `096` seulement si les
tests solo/double/room restent verts.

## Seizième lot, seconde tranche : transport des baies et Champ Magique partiel - 2026-10-23

Les **64 baies présentes dans le catalogue source** traversent maintenant la
projection de l'équipe personnelle, le snapshot tactique et la room Coop comme
objets tenus. Le type `HeldItem` distingue ce transport de la liste plus étroite
des objets dont les effets passifs sont effectivement portés. Les trois noms
absents des objets source (`ROSELIBERRY`, `KEEBERRY`, `MARANGABERRY`) restent
rejetés. `096` peut donc utiliser la table type/puissance sur ces 64 baies dans
le noyau, mais demeure non proposée par le registre source : la prise en charge
des effets automatiques des 61 baies nouvellement transportées est incomplète.

`0F9` active ou annule le compteur partagé de Champ Magique (cinq tours à
l'activation, décrément en fin de tour). Les premiers chemins communs suppriment
les objets actifs dans le calcul des dégâts et du type, la précision, les effets
additionnels, les baies déjà gérées, la météo, les objets de Dresseur et la
Coquille Mue face aux talents-pièges. Le même état et les mêmes règles passent
par le résolveur solo et la room hôte/invité ; le snapshot les restaure après
reconnexion et redémarrage. L'événement du champ est présenté aux participants.
Tests ciblés : activation et annulation en simple/double, baies transportées,
projection personnelle, hôte/invité et restauration de room. Recette visuelle
manuelle toujours ouverte.

`0F9` est **partielle dans l'audit, non promue** dans le registre de capacités.
Il reste à vérifier systématiquement toutes les interactions avec les objets
(notamment changements de forme, vols/transferts et les effets automatiques des
baies) avant promotion. `096` reste également partielle : l'ambiguïté Ruby
`TotalDamage>0>0` de sa consommation n'est pas résolue. Ne pas confondre
« baie tenue et transportée » avec « baie dont l'effet automatique est porté ».
**Compteur inchangé : 186 fonctions terminées sur 353, plus `096` et `0F9`
partielles.** Après `prepare:local` : 193 alertes mécaniques, 61 animations
absentes, 1 talent partiel, 255 problèmes globaux et 696 animations prêtes.

Prochain lot : auditer et porter les effets automatiques des baies atteignables
et les dernières interactions d'objets sous Champ Magique ; vérifier le hook
Ruby de consommation, puis seulement promouvoir `0F9`/`096` si les matrices
solo, double et Coop sont closes. Une fonction indépendante peut avancer si
cette validation source bloque la clôture.

## Seizième lot, troisième tranche : Sitrus et baies de stats - 2026-10-23

Le hook d'objets commun gère maintenant `SITRUSBERRY` (soin de 1/4 des PV
maximaux au seuil de 1/2) et les cinq baies de stats `LIECHIBERRY`,
`GANLONBERRY`, `SALACBERRY`, `PETAYABERRY`, `APICOTBERRY` (un cran au seuil
de 1/4, ou 1/2 avec Gloutonnerie). Un cran déjà au maximum ne consomme pas
la baie. Ces effets respectent Tension adverse, Maladresse, Embargo et Champ
Magique via le prédicat d'objet actif ; la consommation conserve l'historique
pour Recyclage/Ramassage et déclenche Bajoues. Le calcul est dans le noyau
unique, utilisé par le solo et la room autoritaire. Aucun nouvel état ni
intention réseau : les baies sont des objets personnels projetés, les PV,
crans et consommations sont tactiques et présentés aux participants. Les
snapshots restaurent les baies consommées et les crans ; tests simple, double,
hôte/invité, reconnexion et redémarrage ajoutés. Le type de Jugement sous Champ
Magique a aussi une preuve ciblée : la plaque reste tenue mais devient inactive.

La vérification de l'expression Ruby `TotalDamage>0>0` n'a pas pu être faite
dans le runtime source (Ruby non disponible dans cet environnement). La règle
provisoire de `096` reste donc explicitement partielle. Les baies de statut,
PP, confusion, soin à seuils particuliers et réaction après impact ne sont pas
encore fermées. Le déclenchement des nouvelles baies est actuellement au hook
passif de fin de tour ; contrôler son instant exact contre `pbBerryCureCheck`
avant promotion. `0F9` reste partielle tant que toutes ses interactions d'objets
ne sont pas couvertes ; la forme d'Arceus lit l'objet brut dans le script source
et n'est pas censée retomber en forme normale pendant Champ Magique.

**Compteur inchangé : 186 fonctions terminées sur 353, plus `096` et `0F9`
partielles.** Prochain lot : baies de statut/PP et déclenchement réactif après
impact, puis audit final des objets sous Champ Magique ; si le hook Ruby demeure
invérifiable, avancer une fonction indépendante sans promouvoir `096`.

## Seizième lot, quatrième tranche : baies de statut, confusion et PP - 2026-10-23

Le noyau commun consomme maintenant `CHESTOBERRY`, `PECHABERRY`,
`RAWSTBERRY`, `CHERIBERRY`, `ASPEARBERRY`, `PERSIMBERRY`, `LUMBERRY` et
`LEPPABERRY` selon `pbActivateBerryEffect` : guérison du statut correspondant,
de la confusion ou des deux pour Lum ; Leppa restaure jusqu'à 10 PP sur la
première capacité épuisée, plafonnés au `BattleMove.pp` actuellement projeté
(le supplément de PP éventuel n'a pas de champ de maximum distinct dans
`MoveSlot`). Aucune baie n'est consommée si son effet ne peut
pas s'appliquer. Tension adverse, Maladresse, Embargo et Champ Magique
continuent de suspendre l'effet sans supprimer l'objet. La consommation
réutilise l'historique Recyclage/Ramassage et Bajoues.

La lecture de `pbBerryCureCheck` et de ses appels Ruby fixe l'ordre : les
baies de statut/PP et celles de stats sont revérifiées après les coups, tandis
qu'Oran et Sitrus ne se déclenchent qu'avec `hpcure=true`, notamment au hook
de fin de tour. Le moteur vérifie les baies réactives entre deux actions et
après la dernière ; il ne distingue pas encore chaque impact d'une capacité
multi-coups. Ce point reste une dette précise avant fermeture de `096` et
`0F9`, avec les autres baies automatiques et les transferts d'objets.

Autorité : noyau appelé par le solo et la room, sans nouvel intent client.
État : objet et PP personnels projetés dans l'état de combat ; consommation,
statut et confusion visibles aux participants. Les snapshots de room
restaurent PP, statut, objet consommé et historique ; tests de noyau simple,
double, hôte/invité, reconnexion et redémarrage ajoutés. Les présentations
solo et sandbox distinguent désormais une activation sans effet PV d'un soin
ou d'un dégât, au lieu d'annoncer « -0 PV ». La recette manuelle
reste différée tant que `096`/`0F9` sont partielles.

**Compteur inchangé : 186/353 couvertes, 167 non closes, plus `096` et `0F9`
partielles.** Prochain lot : faire le tour des autres baies atteignables
(baies de soin/confusion à seuil, Lansat, Micle, Starf et baies défensives),
puis affiner le hook multi-coups et auditer vols/transferts sous Champ Magique.
Ne promouvoir `096`/`0F9` qu'après ces contrôles et la validation du test Ruby
`TotalDamage>0>0` ; si Ruby reste indisponible, avancer une fonction
indépendante plutôt que déclarer ces deux codes terminés.

## Seizième lot, clôture : Don Naturel `096` et Champ Magique `0F9` - 2026-10-23

Les deux codes sont maintenant inscrits au registre commun d'exécution et
éligibles à l'intégration des capacités source. Les **64 baies réellement
définies** ont un test d'intégration de `096` (attaque avec dégâts, type et
puissance de la table source, puis consommation) ; aucune des trois baies
absentes du PBS n'est inventée. Don Naturel échoue sans baie active, sous
Maladresse, Embargo, Tension adverse ou Champ Magique ; une immunité ou une
attaque sans dégâts conserve la baie. L'expression source
`TotalDamage>0>0` compare en chaîne un booléen à 0 : il s'agit d'une erreur
de script, pas d'une condition exécutable fiable. Le port applique son
intention explicite (`TotalDamage > 0`) et documente ce correctif de source.

Le socle des baies portées comprend à présent les cinq baies de soin/saveur
(confusion si la saveur est détestée), Lansat, Micle, Starf, Custap, les
**17 baies de résistance présentes** (dont Chilan à efficacité neutre),
Enigma, Jaboca et Rowap, en plus des soins, stats, statuts et PP précédents.
Les autres baies du catalogue n'ont pas d'effet automatique de combat dans
`pbBerryCureCheck` : elles restent néanmoins utilisables par Don Naturel.
La saveur détestée est dérivée de la nature personnelle à la projection ;
seule cette information tactique minimale traverse la room. Rectification
de la tranche précédente : `BattleMove.pp` est déjà projeté depuis le
`maxPp` persistant, y compris PP Plus ; Leppa retrouve donc le bon plafond.

Champ Magique supprime les effets des objets portés et l'usage d'objets de
Dresseur durant son compteur partagé, sans enlever l'objet ni sa forme
Arceus fondée sur l'objet brut. Le transfert par Larcin fonctionne pendant
le champ ; l'effet de la baie transférée reste suspendu et reprend après
expiration. Le script exécutable de Désarmement retire toujours l'objet
pendant le champ, malgré le commentaire général disant « ne pas jeter » :
le port conserve la branche exécutable. Les tests couvrent simple, double,
room hôte/invité, reconnexion/redémarrage et présentation sans faux dégâts
« -0 PV ». Autorité : noyau partagé en solo et room en Coop ; états PV,
PP, baies, effets volatils et compteur de champ répliqués et restaurés,
aucune nouvelle intention client. Audience : participants du combat.

**Après `prepare:local` : 188/353 fonctions couvertes, 165 non couvertes ;
192 alertes de mécanique, 61 animations absentes, 1 talent partiel et 254
problèmes globaux ; 696 animations prêtes.** `096` et `0F9` ne sont plus
partielles dans le registre. La validation visuelle manuelle est préparée
dans `VALIDATION_MANUELLE_COMBAT.md` et reste à exécuter par le porteur.

Dette transverse hors contrat propre de ces deux fonctions : la vérification
des baies entre les impacts d'une même capacité multi-coups reste plus
grossière que le hook Ruby, et `0F4` (Picotement/Picore) ne reproduit pas
encore tous les effets de baies avalées. Ne pas confondre cette dette avec
une incapacité de `096` ou `0F9` à résoudre leurs propres actions. Prochain
lot conséquent : la famille d'objets `0F2`, `0F3`, `0F5`, `0F6`, `0F7` et
la généralisation de `0F4`, avec le hook multi-coups et les tests de
transferts/consommation solo, double, hôte/invité et reconnexion.

### Suivi des fonctions d'attaque à reprendre

Ce tableau est le point de contrôle avant chaque nouvelle promotion dans
`move-function-support.ts`. Le rapport automatique classe une fonction par code ;
il ne détecte pas encore toutes les interactions transversales ci-dessous. Une
fonction annoncée « couverte » peut donc conserver une dette précise à fermer et
à tester, sans que l'audit global la compte comme fonction partielle.

| État | Codes | Travail restant |
| --- | --- | --- |
| Fermées dans le douzième lot | `085`, `087` | Historique de K.O. et météo effective portés et testés en solo, double et room ; recette visuelle manuelle encore ouverte. |
| Fermées dans le treizième lot | `090`, `092` | Type dérivé sans IV bruts, catégorie dynamique et compteur de camp restaurable ; recette visuelle manuelle ouverte. |
| Fermées dans le quatorzième lot | `094`, `097` | Présent : tirages/soin/Gemme/Lien Parental ; As Caché : PP après dépense/Pression. Recette visuelle manuelle ouverte. |
| Fermées dans le seizième lot | `096`, `0F9` | 64 baies réelles, condition de consommation corrigée, suppressions et compteur partagés ; recette visuelle manuelle ouverte. La précision inter-impact des baies et `0F4` restent des dettes transverses distinctes. |
| Fermée dans le quatorzième lot | `099` | Rapport des vitesses effectives raccordé en simple et double ; restauration room testée, recette visuelle ouverte. |
| Fermée dans le quinzième lot | `0A0` | Critique garanti après gardes de critique/Conjuro ; simple, double et room restaurée testés, recette visuelle ouverte. |
| Couverte avec interaction visuelle ouverte | `09F` | Types des plaques/modules et blocages portés ; variante d'animation Techno Blast et suppression par Champ Magique à raccorder. |
| Couvertes avec interaction Clonage ouverte | `055`, `058`, `059`, `05A`, `061`, `063`, `066`, `068`, `06A`–`070`, `07C`, `07D`, `07F` | Raccorder leurs contrôles Ruby quand l'état de Clonage sera partagé ; vérifier individuellement les exceptions. |
| Couvertes avec interaction Bouclier Rusé ouverte | `055`, `065`, `066`, `05D`, `05F` | Brancher le prédicat commun de protection, puis tester la cible en double. |
| Couvertes avec autres interactions à auditer | `067`, `074`, `05C`–`05F` | Transitions immédiates de Gaz Réactif et hooks d'Échange en double ; Pirotecnia avec Lien Parental ; cas Transform et fenêtres d'échec des copies. |

Ne pas confondre ces dettes documentées avec le seul talent formellement
`partial` de l'audit actuel (`STURDY`). À chaque fermeture, retirer la ligne ou
le code correspondant seulement après tests du noyau et de la room, mettre à
jour cette section et la roadmap, puis relancer `prepare:local`.

## Dix-septième lot : famille des objets `0F2`–`0F7` - 2026-10-23

`0F2` échange les deux objets (Trick/Switcheroo), `0F3` donne le sien
(Bestow), `0F5` détruit baie ou Gemme après impact (Incinerate), `0F6`
restaure l'objet réellement consommé (Recycle), et `0F7` utilise la classe
de puissance de l'objet lancé (Fling), son effet secondaire source puis le
consomme. Le catalogue des objets lançables provient des classes du script
Ruby, y compris les objets à 10/20/30 et les exceptions à 40–130 ; un objet
inconnu ne valide pas la capacité. `0F4` mange désormais toute baie du
catalogue source via un activateur commun : soin, saveur/confusion,
statistiques, statut, PP, Lansat/Micle/Starf, Enigma et Cheek Pouch. Le vol
n'accorde jamais un objet recyclable à la cible dépossédée. Les contrôles
Sticky Hold, Mold Breaker, Klutz, Embargo, Magic Room et Unnerve sont
raccordés aux branches pertinentes. Les baies de soin, de statistique et de
réaction sont maintenant contrôlées entre les impacts multi-coups ; les
dégâts ultérieurs sont recalculés après un boost Défense (Ganlon).

Autorité : le même noyau pur résout l'action en solo et dans la room
autoritaire. Domaine : objets tenus, dernier objet consommé, propriétaire
initial et PV/stages de combat ; seul le contrat d'objets du Pokémon est
persistant après combat selon le type de rencontre. Aucune nouvelle
intention réseau : les actions de capacité existantes suffisent. La room
réplique les événements et son état minimal aux deux participants ; les
échanges et la récupération sont rendus dans la séquence de présentation.
Tests : simple, refus d'activation, double positionné, hôte/invité,
reconnexion et redémarrage de room, présentation des échanges/récupérations,
et baie entre deux coups. La recette visuelle reste à faire par le porteur.

**Après `prepare:local` : 193/353 fonctions couvertes, 160 non couvertes ;
187 alertes de mécanique, 61 animations absentes, 1 talent partiel et 249
problèmes globaux ; 703 animations prêtes.**

Dettes précises : Clonage n'a pas encore son état partagé, donc les gardes
anti-Clonage de Trick/Bestow/Bug Bite/Incinerate/Fling restent à raccorder.
Le don Symbiosis après Bug Bite n'a pas de contrat d'objet du partenaire en
double ; il ne faut pas inventer une seconde version locale. Mental Herb
lancé ne peut pas encore retirer Torment/Heal Block, états absents du noyau.
Le catalogue complet `pbIsUnlosableItem` (courrier et couples espèce/objet)
n'est pas encore projeté ; le noyau protège déjà les plaques de Multitype,
mais les autres interdictions source restent à auditer comme capacité
générique des objets. L'ingestion de baies par `0F4`/`0F7` ne persiste pas
encore le drapeau Belch du script source.
Ces dettes transverses n'empêchent pas les branches usuelles d'exécuter leurs
fonctions et restent ouvertes dans la roadmap.

Prochain lot proposé, conséquent : `0E1`–`0E7` et `0E9`–`0EF`
(Memento/Healing Wish/Lunar Dance, Perish Song/Grudge/Destiny Bond,
False Swipe, Teleport et changements forcés/Baton Pass/U-turn).
`0E8` Endure est déjà couvert. Traiter en premier les états de fin de tour et
de remplacement partagés pour que toutes les capacités du lot empruntent le
même contrat solo/double/Coop, puis tester les deux rôles, le rendu distant
et la reconnexion.

## Reprise du lot `0E1`–`0EF` — 2026-10-23

Onze fonctions promues : `0E1`–`0E7`, `0E9`, `0ED`–`0EF`.
Le noyau commun gère le sacrifice à dégâts fixes, Memento, les soins et PP
du remplaçant, le compte à rebours de Requiem, Grudge/Destiny Bond,
Faux-Chage, Relais, le pivot après attaque et le piège de Regard Noir.
Le contrat de remplacement est partagé par le combat simple et double :
les boosts/états transmissibles de Relais et les vœux de guérison passent
par `switch-inheritance.ts`. Le piège est levé lorsque sa source quitte
le terrain. Tests ciblés : 13 scénarios verts, dont un double.

Autorité : le noyau déterministe tranche le tour ; en solo l'adaptateur local
l'appelle, en Coop la room hôte autoritaire l'appelle. Domaine : volatiles,
PP, PV et statistiques de combat, puis seuls les PV/statuts/PP projetés
reviennent à l'équipe persistante. Intentions réseau inchangées : capacité
sélectionnée, puis choix de remplacement. L'état de combat actif, y compris
les compteurs et souhaits, est sauvegardé par la room pour reconnexion ;
les événements vont aux participants et le remplacement est rendu des deux
côtés. La recette visuelle hôte/invité/reconnexion reste à effectuer.

Après `prepare:local` : **204/353 fonctions couvertes, 149 non couvertes ;
172 alertes mécaniques, 62 animations absentes, 1 talent partiel et 235
problèmes globaux ; 721 animations prêtes.** L'augmentation d'une animation
absente provient d'une capacité devenue éligible à l'audit, pas d'une
animation inventée.

Restent ouverts dans ce même groupe : `0EA` (Téléport, absent des capacités
actuellement utilisées dans le rapport), `0EB` (Hurlement/Cyclone) et `0EC`
(Projection/Draco-Queue). Leurs effets de renvoi contre Dresseur sont amorcés,
mais la sortie d'une rencontre sauvage n'est pas encore reliée au règlement
local et Coop ; ils ne figurent donc pas au registre des fonctions couvertes.
Le timing de remplacement en double reste celui du flux existant (choix après
le tour), et doit être rapproché de la source pour les pivots forcés.
Prochain lot conseillé : terminer ces trois fonctions puis traiter les codes
restants `0D0`–`0DF` (environ dix fonctions), avec tests de fuite et renvoi
solo, hôte, invité, rendu distant et reconnexion.

## Dix-neuvième lot : fuite sauvage et famille `0D` — 2026-10-23

Les trois fonctions `0EA`–`0EC` sont raccordées : Téléport n'agit que dans
une rencontre sauvage où la fuite est autorisée ; Hurlement/Cyclone et
Projection/Draco-Queue provoquent la sortie sauvage si le niveau le permet,
ou demandent un remplacement adverse contre Dresseur. Suction Cups et
Enracinement bloquent le renvoi. Le noyau émet `battleEscaped`, identique
en simple et en double ; l'adaptateur local termine la rencontre sans gain
ni perte, la room autoritaire utilise le règlement de fuite, le réplique
aux participants et conserve l'état de sortie après redémarrage. Tests
locaux, room hôte seul, invité actif et restauration passent.

Les dix codes auparavant ouverts de `0D0`–`0DF` sont promus : Tourbillon
(`0D0`), Colère (`0D2`), Patience (`0D4`), Atterrissage (`0D6`), Vœu
(`0D7`), Repos (`0D9`), Anneau Hydro (`0DA`), Enracinement (`0DB`),
Dévorêve (`0DE`) et Vibra Soin (`0DF`). Les états de compte à rebours,
soin différé, dégâts cumulés, type temporaire et piège sont des volatiles
de combat du noyau partagé. Le Vœu suit la position lors d'un remplacement
solo/double ; Colère et Patience restent verrouillées même si le PP du
premier tour atteint zéro. Patience retient le dernier attaquant en double.

Contrat : le noyau pur porte les règles et les états ; le client solo et
la room Coop ne font que soumettre l'action et appliquer les mêmes
événements. Autorité locale en solo, room en Coop. PV/statut/PP ont leur
projection persistante habituelle, les volatiles ne durent que le combat
mais sont inclus dans le snapshot de room restaurable. Intentions réseau
inchangées ; audience de présentation : participants du combat, chacun
voyant le même état minimal et les remplacements. Recette visuelle réelle
hôte/invité encore à effectuer ; voir `VALIDATION_MANUELLE_COMBAT.md`.

Après `prepare:local` : **217/353 fonctions couvertes, 136 restantes ;
155 alertes mécaniques, 63 animations absentes, 1 talent partiel et 219
problèmes globaux ; 743 animations prêtes.** Les animations absentes
restent au fallback, jamais inventées. `0EA` n'a aucune capacité utilisée
dans le rapport courant, mais la fonction est testée et enregistrée.

Dettes de fidélité à surveiller : le doublement de puissance de Tourbillon
sur une cible en Plongée attend le portage du mécanisme générique des
capacités à deux tours (`0C1`–`0CE`). Clonage n'a toujours pas son état
partagé pour les protections pertinentes. La cadence de remplacement forcé
en double reste le choix après le tour du flux existant. Ces dettes ne
doivent pas être masquées par le compteur de fonctions.

Prochain lot conséquent proposé : `0C1`–`0CE` (14 codes de charge,
semi-invulnérabilité, Power Herb et Sky Drop), à construire autour d'un
seul contrat d'état actif en solo/double/Coop et à valider par l'audit,
les deux rôles et la reconnexion.

## Vingtième lot : première tranche des attaques à deux tours — 2026-10-23

`0C2`–`0C8` sont maintenant couverts dans le noyau de combat partagé :
recharge après dégâts pour `0C2`, charge/verrouillage/PP unique pour
`0C3`–`0C8`, Soleil immédiat et malus météo pour `0C4`, consommation de
Power Herb, effets secondaires de `0C5`–`0C7` et Défense initiale de
`0C8`. Autorité : joueur local en solo, room en Coop ; domaine : état
éphémère du combat pour charge/recharge, PP et objet personnel répliqués
par le snapshot autoritaire. Les intentions réseau ne changent pas : le
second tour est verrouillé dans le même noyau, même après épuisement des
PP. Participants du combat reçoivent événements et état ; reconnexion
restaure le snapshot. Tests automatisés simple/double et sérialisation
passent ; recette visuelle réelle hôte/invité/rendu distant encore à faire.

Après `prepare:local` : **224/353 fonctions enregistrées, 129
restantes**, 147 capacités avec mécanique absente, 65 animations absentes,
1 talent partiel, 213 problèmes globaux, 761 animations prêtes. Ce compteur
est calculé directement depuis le registre (alias `00` inclus, comme au
jalon précédent). Les trois codes `0C3`, `0C5`, `0C6` n'apparaissent pas dans les
707 capacités du rapport local, mais leurs fonctions sont testées.

Le lot `0C1`–`0CE` n'est **pas terminé** : `0C1` (participants Beat Up) et
`0C9`–`0CE` (semi-invulnérabilité, exceptions de coups et Sky Drop)
restent hors registre. Prochaine tranche : ces sept codes, avec un contrat
commun de cible et de portage en double, interruption, libération,
restauration/rendu distant, puis audit. Tourbillon contre Plongée et les
autres interactions d'attaques semi-invulnérables restent ouverts. Aucune
animation absente n'a été inventée.

## Vingtième lot, clôture : Beat Up et semi-invulnérabilité — 2026-10-23

Les sept codes restants `0C1`, `0C9`–`0CE` sont enregistrés et exécutés par
le noyau commun. `0C1` prend les participants vivants et sans statut dans
l'ordre de l'équipe, ajoute toujours l'utilisateur actif, puis calcule
chaque puissance à partir de l'Attaque **de base de l'espèce** (valeur
publique projetée dans le combat, pas IV/EV ni statistique personnelle).
`0C9`–`0CD` partagent le verrou du second tour, Power Herb, l'état de
semi-invulnérabilité et les exceptions exactes de la source : air,
Creusement, Plongée et disparition. Rafale/Vent Violent, Surf/Tourbillon,
Magnitude, etc. bénéficient des multiplicateurs liés à ces états quand
leur fonction est portée. `0CD` traverse Protection. `0CE` conserve
l'identité de sa cible portée, l'empêche d'agir pendant les deux tours,
la libère au retour, à l'interruption ou au K.O., échoue contre les cibles
trop lourdes et ne blesse pas les types Vol ou Lévitation. Le champ de
Gravité est prêt et bloque/annule les attaques aériennes ; sa capacité
qui le crée n'est pas encore portée.

Autorité : résolution locale en solo, room autoritaire en Coop, mêmes
fonctions et tirages ; aucune nouvelle intention réseau. Domaine : PP,
objet, PV et Attaque de base publique minimisée ; charge, cible portée et
verrou du tour sont volatils du combat. Les ressources du propriétaire
suivent la persistance existante ; la room restaure ces volatils depuis
son snapshot après reconnexion/redémarrage. Audience : participants du
combat, avec événements de charge, libération, esquive et action bloquée ;
les services personnels et IV restent privés. Le protocole d'entrée ne
maintient plus une ancienne liste indépendante de fonctions et valide
désormais le registre unique du moteur : les capacités déjà portées ne
sont plus rejetées sur les équipes invitées. Tests simple, double,
protocole, room hôte/invité et restauration passent. Recette visuelle
réelle encore à exécuter par le porteur.

Après `prepare:local` : **231/353 fonctions couvertes, 122 restantes** ;
140 capacités à mécanique absente, 65 animations absentes, 1 talent
partiel, 206 problèmes globaux et 770 animations prêtes. `0CE` ne figure
pas parmi les 707 capacités du rapport local, mais son contrat est testé.
Aucune animation manquante n'a été inventée.

Dettes transverses explicites : Clonage n'a pas encore d'état partagé,
donc le garde anti-Clonage de Sky Drop attend ce chantier ; les fonctions
`075`, `076` et `078` restent hors registre malgré leurs exceptions déjà
préparées contre Plongée/Creusement/vol. La validation visuelle réelle
hôte, invité, rendu distant et reconnexion demeure ouverte dans
`VALIDATION_MANUELLE_COMBAT.md`. Prochain lot conséquent proposé :
`075`, `076`, `078`, puis `0A4`, `0A6`, `0A8`, `0A9`, `0AB`, `0AC`,
`0AE` (dix codes : interactions de semi-invulnérabilité, environnement,
précision, gardes d'équipe et copie). Clonage reste un chantier générique
séparé, prioritaire pour fermer ses interactions transverses.

## Vingt et unième lot : terrain, ciblage, gardes et copie — 2026-10-23

Les dix codes annoncés `075`, `076`, `078`, `0A4`, `0A6`, `0A8`, `0A9`,
`0AB`, `0AC`, `0AE` sont enregistrés. Surf, Séisme et Twister exploitent
les exceptions de semi-invulnérabilité du lot précédent ; Séisme perd
également la moitié de sa puissance sur Champ Herbu et `078` peut apeurer.
Secret Power (`0A4`) applique l'effet de terrain/environnement ; Lock-On
conserve l'identité du lanceur jusqu'au prochain tour ; Miracle Eye
distingue l'immunité Ténèbres du type Spectre ; `0A9` ignore Défense,
Défense Spéciale et esquive augmentées. Quick Guard et Wide Guard sont
des états d'équipe d'un seul tour ; ils protègent l'allié en double et
sont effacés en fin de tour. Mirror Move copie la dernière capacité de
la cible marquée `e`, conserve son ciblage de zone et son coût PP propre ;
une attaque copiée à deux tours est mémorisée pendant la charge.

Contrat : noyau déterministe partagé, autorité locale en solo et room
autoritaire en Coop ; intentions réseau inchangées. Les états de
Lock-On, Miracle Eye, gardes et capacité appelée sont des volatils de
combat, répliqués aux participants et inclus dans le snapshot room.
PV, PP et statuts conservent leur persistance propriétaire habituelle.
Tests simple/double, hôte/invité et redémarrage de room passent ; rendu
distant réel et reconnexion visuelle sont à valider manuellement selon
`VALIDATION_MANUELLE_COMBAT.md`.

Après `prepare:local` : **241 fonctions couvertes / 112 restantes sur
353** ; 126 capacités à mécanique absente, 67 animations absentes,
1 talent partiel, 194 problèmes globaux et 788 animations prêtes.
Les animations absentes restent au fallback. Les variantes visuelles
par environnement de Secret Power et les interactions avec Clonage et
Bouclier Rusé attendent une recette ou un état partagé ; ne pas les
confondre avec la mécanique enregistrée.

Prochain lot conséquent proposé : `0AF`–`0B2`, `0B4`–`0B8` et `0BB`
(dix codes : appel/copie, renvoi et vol de capacités, puis contraintes
de choix). La capacité copiée et la liste de cibles doivent continuer
à dépendre du même noyau solo/Coop ; Clonage reste une dette transverse.

## Vingt-deuxième lot, première tranche : contraintes et renvoi — 2026-10-23

Quatre des dix codes annoncés sont portés : `0B1` Magic Coat, `0B7`
Torment, `0B8` Imprison et `0BB` Heal Block. Magic Coat renvoie les
capacités de statut marquées réfléchissables pendant le tour courant ;
Torment interdit de répéter une capacité (sans interrompre sa charge) ;
Imprison interdit aux adversaires les capacités connues de son lanceur,
y compris aux deux adversaires en double ; Heal Block empêche les
capacités de soin marquées dans la source, Anneau Hydro, Racines,
Vœu, Vampigraine et Soin Poison pendant cinq tours source. Les PP
restent inchangés lorsqu'une capacité est interdite. Les états sont
inclus dans le snapshot de combat et les messages sont présentés aux
participants.

Autorité : même noyau déterministe en solo et dans la room hôte/invité ;
intentions Coop inchangées. Domaine : volatils de combat partagés avec
les participants, non persistés dans l'équipe propriétaire après le
combat ; la room les restaure sur reconnexion. Tests simple et double,
restauration JSON, suite room et build passent ; rendu distant réel et
reconnexion visuelle restent dans la recette manuelle.

Après `prepare:local` : **245/353 fonctions couvertes, 108 restantes** ;
122 capacités à mécanique absente, 67 animations absentes, 1 talent
partiel, 190 problèmes globaux et 793 animations prêtes. Aucun fichier
source ni animation de substitution n'a été ajouté à Git.

Le lot de dix n'est **pas clos** : `0AF` Copycat, `0B0` Me First, `0B2`
Snatch, `0B4` Sleep Talk, `0B5` Assist et `0B6` Metronome restent à
porter. Ils appellent d'autres capacités et exigent un contrat partagé
pour le dernier coup global, les choix avant action, l'équipe disponible
et le catalogue complet de Metronome dans la room ; ne pas les déclarer
supportés sur la seule base d'un appel local ou d'un catalogue partiel.
Prochain travail : finir ces six codes comme seconde tranche du même
lot, puis reprendre la sélection du lot suivant dans l'audit.

## Vingt-deuxième lot, deuxième tranche : capacités appelées — 2026-10-23

Cinq codes supplémentaires sont portés : `0AF` Copycat, `0B0` Me First,
`0B2` Snatch, `0B4` Sleep Talk et `0B5` Assist. Le noyau partage le
dernier coup global dans l'état du combat, restauré par la room ; Me
First consulte l'action adverse prévue et majore la puissance de la
capacité copiée ; Snatch détourne vers son lanceur une capacité de
statut marquée `d` puis se consomme ; Sleep Talk choisit parmi les
capacités utilisables du dormeur ; Assist choisit parmi celles des
autres membres de son équipe, même K.O. Le PP payé reste celui de la
capacité déclencheuse. La sélection aléatoire est tracée et déterministe.
En double, la capacité appelée conserve son ciblage de zone et Snatch
choisit un adversaire actif guetteur ; l'état de charge copié de Me
First est inclus dans le snapshot.

Contrat : autorité locale en solo, room hôte en Coop, même noyau pour
invité et joueur local. Domaine : dernier coup global et états d'appel
volatils du combat ; PP/PV propriétaires persistent selon le contrat
existant. Les intentions sont celles des capacités choisies, sans
nouvelle intention réseau. Audience : participants et rendu distant
via événements de capacité utilisée ou volée. Tests simple/double,
source globale après sérialisation, room hôte/invité reconnectée puis
redémarrée passent ; la recette visuelle réelle reste ouverte.

Après `prepare:local` : **250/353 fonctions couvertes, 103 restantes** ;
118 capacités à mécanique absente, 67 animations absentes, 1 talent
partiel, 186 problèmes globaux et 797 animations prêtes. Le lot initial
de dix reste **ouvert pour `0B6` Metronome seulement**. Cette fonction
tire dans le catalogue complet, pas dans les seules quatre capacités
présentes au combat : la room ne reçoit pas encore ce catalogue et
plusieurs résultats du tirage portent une fonction non implémentée.
Ne pas enregistrer `0B6` avant un transport/persistance du catalogue
autoritaire et un traitement explicite des résultats non portés ; un
tirage artificiellement restreint fausserait les probabilités source.

Prochain lot de mécanique proposé en parallèle de cette dette :
`0BF`, `10A`, `122`, `144`, `019`, `112`, `114`, `140` (huit codes,
attaques multi-coups et défensives, soins/stockage et dégâts spéciaux).
Auditer les variantes source propres à chaque code avant de les déclarer
supportées. `0B6` reste séparé jusqu'au raccord du catalogue complet.

## Vingt-troisième lot : multi-coups, écrans, réserves et stockage — 2026-10-23

Neuf codes supplémentaires sont enregistrés dans le noyau partagé : `0BF`
(Triple Pied, précision propre à chaque frappe et puissance croissante),
`10A` (Casse-Brique ignore puis détruit Protection/Mur Lumière), `122`
(attaque spéciale sur Défense physique), `144` (Flying Press cumule les
efficacités Combat/Vol et profite de Lilliput), `112`/`113`/`114`
(Stockpile/Relâche/Avale, compte et bonus défensifs restitués), `019`
(Aromathérapie/Glas de Soin jusqu'aux réserves) et `140`. Ce dernier code
est partagé par les données locales entre le Dernier Recours physique et
Venom Drench statut : la catégorie discrimine les deux règles ; Dernier
Recours exige l'essai préalable de chaque autre capacité connue, Venom
Drench abaisse Attaque/Attaque Spéciale/Vitesse des cibles empoisonnées,
y compris les deux adversaires en Duo.

Contrat : même résolution déterministe pour solo et room hôte ; PP, PV,
statuts, compteurs Stockpile, historique d'utilisation et stades sont
autoritaires dans le snapshot. Les soins de réserve utilisent un seul
réducteur commun aux adaptateurs simple et Duo. Aucun message d'intention
réseau nouveau : seule la capacité choisie est transmise. Les événements
du combat et les snapshots répliquent les changements aux deux participants
et au rendu distant ; la reconnexion et le redémarrage de room restaurent
les statuts. Tests noyau simple/Duo, y compris partenaire actif Herbivore
qui ignore Aromathérapie, et room hôte/invité passés ; recette visuelle
réelle encore à effectuer (check-list ci-dessous).

Après `prepare:local` : **259/353 fonctions couvertes, 94 restantes** ;
99 capacités à mécanique absente, 71 animations absentes, 1 talent partiel,
171 problèmes globaux et 818 animations prêtes. Les animations non importées
restent en fallback et ne sont pas inventées. `0B6` Metronome demeure ouvert.

Prochain lot conséquent proposé : les dix codes `002`, `00B`, `00D`,
`00E`, `011`, `014`, `015`, `018`, `01A`, `01B` (Lutte, variantes de morsure
et de météo, Ronflement/Babil, soin et garde/transfert de statut). Auditer
les données source et les interactions de statut avant d'enregistrer chaque
code ; si une dépendance transversale bloque l'un d'eux, la signaler et
poursuivre les autres sans déclarer le code couvert.

## Vingt-quatrième lot : fonctions précoces de statut et météo — 2026-10-24

Les dix codes prévus sont portés dans le noyau partagé. `002` Lutte est
sans type, utilisable à zéro PP et inflige un recul d'un quart des PV
maximum après impact. `00B`/`00E` Crocs de Feu/Glace tirent séparément
statut et apeurement. `00D` Blizzard touche sans tirage sous grêle ; `015`
Vent Violent touche sans tirage sous pluie et passe à 50 % sous soleil.
`011` Ronflement n'agit que pendant le sommeil et peut apeurer ; `014`
Babil confond après impact selon les nouvelles mécaniques source. `018`
Refresh guérit brûlure, poison ou paralysie. `01A` Voile Sacré
protège le camp cinq tours et échoue s'il est déjà actif. `01B`
Psycho Shift transmet uniquement un statut compatible, puis guérit le
lanceur ; si la cible résiste, le statut du lanceur reste inchangé.

Contrat : solo local et room hôte utilisent le même calcul, avec les
intentions de capacité déjà existantes. Statuts personnels, compteurs
de camp et PV/PP sont autoritaires et persistés dans le snapshot ;
événements de combat destinés aux participants et au rendu distant.
Tests noyau simple/Duo et room hôte/invité avec reconnexion/redémarrage
pour Voile Sacré passent ; recette visuelle réelle non effectuée et
documentée dans `VALIDATION_MANUELLE_COMBAT.md`.

Après `prepare:local` : **269/353 fonctions couvertes, 84 restantes** ;
90 capacités à mécanique absente, 72 animations absentes, 1 talent
partiel, 163 problèmes globaux et 828 animations prêtes. `0B6`
Metronome demeure ouvert pour son catalogue complet autoritaire.

Prochain lot conséquent proposé : `0FF`–`105` (quatre climats et trois
pièges d'entrée) puis `118`, `119`, `11F` (Gravité, Vol Magnétik,
Distorsion) : dix codes de terrain liés à l'état partagé et à la
reconnexion. Réutiliser les effets météo/pièges existants ; auditer les
durées source et les interactions Duo avant de les déclarer couverts.

## Vingt-cinquième lot : climats, pièges et terrain — 2026-10-24

Les dix codes `0FF`–`105`, `118`, `119`, `11F` sont portés dans le noyau
commun. Soleil, pluie, sable et grêle durent cinq tours, ou huit avec la
roche dédiée ; les climats extrêmes bloquent leur remplacement. Picots
(trois couches), Pics Toxik (deux) et Piège de Roc agissent à l'entrée
selon l'ancrage, les types, les immunités et les Grosses Bottes ; un
entrant Poison au sol retire les Pics Toxik. Gravité dure cinq tours,
ramène au sol les combattants actifs, interrompt les états aériens et
augmente la précision ; Vol Magnétik dure cinq tours et immunise au Sol
hors Gravité. Distorsion inverse l'ordre de Vitesse et se désactive au
second emploi. Les KO sur piège redemandent un remplaçant en simple et
en Duo ; les pièges renvoyables sont pris en compte en Duo.

Autorité : le noyau déterministe est utilisé par le solo et la room hôte ;
l'invité transmet l'intention de capacité/changement existante. Climat,
terrain, pièges et comptes volatils appartiennent au snapshot autoritaire,
répliqué aux participants et restauré après reconnexion/redémarrage.
L'audience des événements et PV est celle des participants du combat ;
les tests couvrent simple, Duo et room hôte/invité restaurée. Dette
précise : `replaceFaintedDoublePokemon` expose seulement le nouvel état ;
un KO par piège pendant ce remplacement imposé est bien restauré et le
slot reste demandé, mais son événement de dégâts n'est pas encore envoyé
pour la narration/animation à cet instant. La recette visuelle réelle,
y compris ce cas, demeure ouverte dans `VALIDATION_MANUELLE_COMBAT.md`.

Après `prepare:local` : **279/353 fonctions couvertes, 74 restantes** ;
80 capacités à mécanique absente, 72 animations absentes, 1 talent
partiel, 153 problèmes globaux et 841 animations prêtes. `0B6`
Metronome reste ouvert.

Prochain lot conséquent proposé : dix codes de terrain et de placement,
`11A`–`11C` (Télékinésie, Uppercut, Anti-Air), `124` (Zone Étrange),
`153` (Toile Gluante), `154`–`156` (trois champs), `905` (Champ Psychique)
et `927` (Voile Aurore). Auditer d'abord les données source et les
interactions avec Gravité, les pièges et les immunités avant couverture.

## Vingt-sixième lot : terrain et placement — 2026-10-24

Les dix codes prévus sont portés dans le noyau partagé. `11A` Télékinésie
élève sa cible trois tours, garantit la précision contre elle et cesse
sous Gravité ; `11B` Uppercut touche les cibles en Vol/Bond/Caída Libre ;
`11C` Anti-Air/Mille Flèches touche les cibles aériennes, double sa
puissance contre une cible en charge aérienne et l'ancre après impact.
`124` Zone Étrange échange les Défenses de base cinq tours et se coupe
au second emploi. `153` Toile Gluante baisse la Vitesse des entrants au
sol avec les réactions de talent usuelles. `154`–`156` et `905` posent
respectivement les champs Électrik, Herbu, Brumeux et Psychique cinq
tours, se remplacent mutuellement et appliquent leurs effets de dégâts,
soin, statut et priorité aux seuls combattants concernés. `927` Voile
Aurore pose les deux écrans sous grêle, selon la durée et la condition
réellement codées dans la source.

Autorité : les intentions de capacité/changement existantes vont à la
room hôte ; elle emploie le même calcul que le solo. États de camp,
terrain et comptes volatils sont répliqués aux participants et restaurés
après reconnexion/redémarrage ; aucun état de terrain personnel nouveau
n'est transmis. Les tests couvrent simple, Duo et room hôte/invité,
mais pas encore la recette visuelle réelle. La dette d'événement lors
d'un remplacement imposé en Duo tombant sur un piège, signalée au lot
précédent, reste ouverte.

Après `prepare:local` : **289/353 fonctions couvertes, 64 restantes** ;
69 capacités à mécanique absente, 73 animations absentes, 1 talent
partiel, 143 problèmes globaux et 854 animations prêtes. Les animations
absentes restent en fallback ; `0B6` Metronome demeure ouvert.

Prochain lot conséquent proposé : dix codes de calcul et d'altération,
`121` Foul Play, `123` Synchronoise, `135` Freeze-Dry, `13A` Noble Roar,
`13C` Confide, `13D` Eerie Impulse, `142` Trick-or-Treat,
`143` Forest's Curse, `902` Strength Sap et `904` Magic Powder.
Auditer les interactions de types, stats, talents et formes avant
d'enregistrer ces codes ; conserver les tests room restaurée.

## Vingt-septième lot : dégâts, statistiques et types — 2026-10-24

Les dix codes `121`, `123`, `135`, `13A`, `13C`, `13D`, `142`, `143`,
`902` et `904` sont portés dans le noyau commun. Jeu Déloyal utilise
l'Attaque et les stades de la cible ; Synchronoise vérifie chaque cible
partageant un type, y compris en Duo ; Liofilisation est super efficace
sur Eau et peut geler. Rugissement de Guerre, Confidence et Onde
Anormale abaissent les bonnes statistiques avec les protections et
réactions de talent partagées. Halloween et Malédiction Sylvestre posent
ou remplacent un troisième type temporaire ; Poudre Magique change
la cible en type Psy, conformément au **code source** malgré son
commentaire source contradictoire. Les types d'origine sont restaurés
à la sortie du terrain. Absorbeforce soigne selon l'Attaque de la cible
avant sa baisse, respecte Grosse Racine/Bloc Soin et inflige des dégâts
au lanceur contre Suintement.

Contrat : mêmes calculs dans le solo et la room hôte, intention de
capacité existante depuis l'invité, statistiques/PV/types et origine
temporaire répliqués aux participants dans le snapshot autoritaire.
Tests simple, Duo et room hôte/invité avec reconnexion/redémarrage pour
Poudre Magique et Absorbeforce passent. Les événements déjà typés de
types, stades, soins et dégâts alimentent le rendu distant. Recette
visuelle réelle non effectuée ; voir `VALIDATION_MANUELLE_COMBAT.md`.
La dette antérieure de narration du KO par piège au remplacement Duo
reste ouverte.

Après `prepare:local` : **299/353 fonctions couvertes, 54 restantes** ;
59 capacités à mécanique absente, 74 animations absentes, 1 talent
partiel, 134 problèmes globaux et 867 animations prêtes. `0B6`
Metronome reste ouvert ; aucun fallback d'animation n'est inventé.

Prochain lot conséquent proposé : dix variantes offensives `175`
(Body Press), `1B9` (Toxic Thread), `201` (Rising Voltage), `207`
(Expanding Force), `211` (Grassy Glide), `303` (Bolt Beak/Fishious Rend),
`304` (Steel Beam/Chloroblast), `911` (Dire Claw), `931` (Make It Rain)
et `942` (Surging Strikes). Auditer les variantes source, les cibles Duo
et le calcul multi-impact avant d'enregistrer chaque code.
