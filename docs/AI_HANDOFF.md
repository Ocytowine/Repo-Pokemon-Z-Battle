# Reprise du developpement par une IA

Derniere mise a jour : 2026-09-30.

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
le dix-septieme noyau 9.7 non commite : contact joueur, combat de Dresseur source
contre Crisanto, reprise de la scene apres combat, tests et documentation.

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
- contact joueur/evenement : pris en charge quand le joueur atteint la zone de
  l'evenement, pour les transferts comme pour une sequence ; le contact initie par
  un evenement autonome reste a completer ;
- premier autorun actif apres un transfert de carte : pris en charge ;
- evenements paralleles : a faire ;
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
lit son cri extrait. `play-jingle` lit maintenant les fichiers de `Audio/ME`.
`play-background-sound` reste accepte mais non rendu.

La scene d'entree du laboratoire, Map005 evenement `crisanto`, est un jalon
vertical valide par les donnees locales : 302 commandes resolues, 30
dialogues, 182 commandes de mouvement et aucun rendu en attente. Les scripts Ruby
fractionnes sur plusieurs commandes sont reunis avant portage. Les appels
`dependentEvents.remove_sprite(true)` et `refresh_sprite`, propres au compagnon du
moteur original qui n'est pas encore rendu sur le web, sont absorbes explicitement
comme presentation sans effet ; ils ne bloquent plus la progression.

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

Une commande implementee doit passer de `accepted` a `rendered` ou `executed`. Elle
disparait alors automatiquement de la liste `rendu en attente`.

## Strategie de tests

Ne pas creer un gros test propre a chaque cinematique. Privilegier :

- tests tabulaires du registre pour les familles et niveaux de support ;
- tests purs du compilateur et de l'interpreteur de routes ;
- une trace courte d'ordonnancement pour concurrence et barrieres ;
- quelques recettes fonctionnelles representatives, dont `EV017` ;
- audit automatique pour detecter une commande, une cible ou un asset oublie.

Au moment de cette note, la suite complete contient 240 tests et passe avec le build.

## Commandes utiles

```powershell
corepack pnpm sandbox:overworld
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
- `main.ts` reste proche de 1 000 lignes. Le gestionnaire de scenes doit continuer
  l'extraction progressive, sans refonte monolithique.
- Apres une modification de progression, une ancienne sauvegarde locale peut masquer
  le nouveau declenchement. Rejouer la recette avec un etat vierge.
