# Backlog produit et technique

Derniere mise a jour : 2026-10-05.

Ce document transforme `docs/note importantes.md` en lots exploitables par une IA
de code. La note d'origine reste la source des constats du porteur ; ce backlog
normalise les priorites, dependances et contrats solo/Coop sans la remplacer.

## Ordre de lecture pour une reprise

1. `AGENTS.md` ;
2. `docs/AI_HANDOFF.md` ;
3. section 9.7 de `docs/ROADMAP.md` ;
4. `docs/COOP_ARCHITECTURE.md` pour toute mecanique visible ou persistante ;
5. ce document, uniquement pour choisir et cadrer le prochain lot.

Ne pas re-auditer toute l'application avant chaque lot. Verifier d'abord le
constat cible, ses tests existants et les fichiers cites par recherche textuelle.

## Convention de suivi

- `P0` : bloque un parcours ou produit une divergence de simulation ;
- `P1` : fonctionnalite importante incomplete ou presentation trompeuse ;
- `P2` : extension produit sans blocage immediat ;
- `P3` : amelioration de confort ou finition ;
- `A qualifier` : idee validee, mais contrat ou donnees encore insuffisants ;
- `Pret` : contrat assez precis pour commencer ;
- `En cours` et `Termine` ne sont utilises qu'avec preuves et tests.

Un lot n'est termine qu'apres validation solo, hote, invite, rendu distant et
reconnexion lorsque l'etat persiste. Toute dette volontaire doit etre reportee
ici, dans `AI_HANDOFF.md` et dans la roadmap.

## Ordre de travail recommande

1. Stabiliser le cycle de vie reseau et les collisions partagees.
2. Synchroniser les PNJ mobiles et leur occupation.
3. Fiabiliser la file de presentation des combats et l'audio.
4. Terminer les briques solo dont dependent les ajouts Coop : objets, capture,
   evolution et Pokedex.
5. Ajouter les extensions Coop, puis les services de plateforme.
6. Terminer l'ergonomie responsive et les interfaces secondaires.

## Audit cible du jeu source — 2026-10-05

Cet inventaire est derive des rapports locaux de la distribution v2.12 FR et des
262 scripts Ruby extraits. Il mesure le support reel du moteur, pas seulement la
presence des donnees dans les JSON :

- les 19 interactions de types sont supportees ;
- seulement 23 codes de fonction d'attaque sur 353 sont portes ;
- seulement 13 talents sur 255 ont un effet execute ;
- aucune des six familles d'objets n'est completement supportee ; la famille
  generique est seulement partielle ;
- aucune des 18 methodes d'evolution rencontrees n'est executee ;
- 170 199 commandes d'evenement sur 188 037 sont converties, mais 15 649 lignes
  Ruby et 2 177 conditions Ruby restent des references a classifier et porter ;
- le monde extrait est complet structurellement : 507 cartes, 2 613 transferts
  simples, aucune cible de transfert invalide et aucun fichier de carte absent.

Conclusion : la priorite produit apres stabilisation n'est pas de reimporter les
cartes. Elle est de porter les noyaux de regles (attaques, talents, objets,
evolutions), puis les hooks Ruby par famille et par parcours vertical.

Systemes de Z confirmes mais auparavant sous-representes dans le backlog :

- Pokévial rechargeable, avec un nombre personnel de soins d'equipe ;
- Incubateur personnel de six oeufs, en plus de la Pension et de l'eclosion ;
- DexNav, rencontres par peche et rencontres Eclate-Roc ;
- Maître des capacites et oubli/apprentissage interactif ;
- regles effectives des modes Nuzlocke et Monotype ;
- Échange Miracle simule par tranche de puissance, avec listes d'exclusion ;
- drops, fabrication, recettes et outils narratifs associes ;
- Tour de Combat et ses equipes configurees ;
- formes et Mega-Evolutions dont une partie des regles vit uniquement en Ruby.

Les statuts propres a Z `CADUCO` et `HEMORRAGIA` ne sont pas manquants : ils sont
deja representes, calcules, persistés et testes. Les choix de nouveau jeu
Nuzlocke/Monotype, eux, ne constituent pas encore leurs regles de gameplay.

## Lots de stabilisation

### STAB-NET-1 — Cycle de vie des defis PvP

- Priorite/statut : `P0` / `Termine` (recette manuelle validee le 2026-10-05).
- Constat : la demande ou la fenetre PvP peut rester visible apres refus, debut,
  fin ou fermeture du combat.
- Autorite : room.
- Etat : `SESSION_STATE`, transitoire et non narratif.
- Persistance : seulement pour reconnexion tant que le defi ou combat est actif ;
  suppression atomique a chaque etat terminal.
- Intentions : creer, accepter, refuser/annuler, commencer, quitter.
- Replication minimale : challenger, cible, statut, identifiant de combat eventuel.
- Audience : les deux participants.
- Validation : refus dans les deux sens, annulation, acceptation, fin normale,
  deconnexion, reconnexion et absence de fenetre orpheline.
- Preuves automatiques : le payload de l'equipe reelle respecte le schema strict ;
  refus par la cible, annulation par le demandeur, deconnexion de chaque cote,
  acceptation, fin puis fermeture du combat effacent l'etat transitoire. La vue
  vide aussi son contenu, le HUD retire son attente obsolete et la fenetre reste
  masquee des qu'un combat est actif.
- Validation manuelle : le porteur confirme le cycle PvP fonctionnel dans deux
  navigateurs le 2026-10-05.

### STAB-NET-2 — Depart et retour d'un participant

- Priorite/statut : `P0` / `En validation`.
- Constat : l'hote ne recoit pas de notification et le sprite distant peut rester
  affiche apres le depart de l'invite.
- Autorite : room a partir de l'etat de connexion du socket.
- Etat : presence de session ; aucune mutation de sauvegarde personnelle.
- Persistance : delai de grace borne pour reconnexion, puis absence confirmee.
- Replication minimale : joueur, etat `connected/reconnecting/left` et echeance.
- Audience : participants presents.
- Validation : fermeture propre, coupure brutale, reconnexion avant/apres delai,
  retrait du sprite, du suiveur et des collisions, notification unique.
- Implementation : l'etat autoritaire replique `connected`, `reconnecting` ou
  `left` avec une echeance de 15 secondes. Une fermeture volontaire envoie
  `leaveRoom`; une coupure entre en grace puis une alarme Durable Object confirme
  le depart. Avatar et suiveur sortent immediatement du rendu et des collisions.
- Restauration : une reconnexion conserve profil, avatar et suiveur ; si l'ancienne
  case a ete occupee, la room choisit une case voisine praticable. Les transitions
  de presence produisent au plus une notification HUD par changement d'etat.
- Reprise manuelle : un depart explicite ou une grace expiree libere la place
  invitee pour une nouvelle identite et revoque l'ancien ticket. La place reste
  reservee pendant `reconnecting`, ainsi que pendant un combat actif ou tant qu'un
  reglement personnel attend son proprietaire.
- Reste avant `Termine` : recette deux navigateurs pour fermeture volontaire,
  coupure brutale, retour avant/apres 15 secondes et occupation de l'ancienne case.

### STAB-WORLD-1 — Collisions narratives identiques

- Priorite/statut : `P0` / `En validation`.
- Constat : l'invite peut parfois franchir un blocage PNJ qui arrete l'hote.
- Autorite : room, depuis l'histoire de l'hote et les pages actives.
- Etat : `NARRATIVE_SHARED` en lecture seule pour l'invite.
- Persistance : derivee du snapshot narratif de l'hote.
- Intention : mouvement seulement ; le client ne choisit pas les obstacles.
- Replication minimale : occupation bloquante active, revision de carte.
- Audience : joueurs presents sur la carte partagee.
- Validation : avant/apres changement de page, switch et self-switch ; solo, hote,
  invite et reconnexion donnent la meme case finale.
- Implementation : toute page active non traversable et visible contribue a
  l'occupation, ainsi que les zones invisibles de contact `trigger 1/2`. Cela
  couvre les zones que l'hote declenche avant son pas mais que l'invite, sans
  autorite sur l'histoire, doit seulement voir comme un obstacle. Une page vide
  d'action/autorun reste traversable comme dans RPG Maker. Les points calcules depuis
  l'histoire de l'hote sont publies avec le snapshot de room ; le resolveur commun
  les applique au solo, a l'hote et a l'invite.
- Preuves automatiques : activation/desactivation d'une zone de contact par switch
  et self-switch, refus autoritaire du pas invite, ouverture ulterieure de la case
  et restauration des obstacles apres persistence de la room.
- Correctif de validation du 2026-10-06 : sur la carte partagee, une sequence de
  l'invite contenant un combat, une rencontre ou une mutation narrative est
  bloquee en entier, meme si elle contient aussi un soin ou un transfert. Seuls
  les services strictement personnels et les sorties de carte restent locaux.
  En excursion `away`, l'invite retrouve ses evenements personnels complets.
- Les switches et variables techniques d'une page de Centre ne bloquent plus le
  soin de l'invite : la page reste personnelle, puis seules les commandes
  `heal-party` et `set-checkpoint` sont appliquees. Les autres mutations d'etat
  sont filtrees et ne touchent jamais l'histoire de l'hote.
- Invariant combat associe : la projection d'equipe choisit le premier Pokemon
  conscient si l'actif est K.O. et refuse une equipe entierement K.O. ; une
  composition Coop sans Pokemon apte est egalement refusee.
- Isolation d'excursion : un combat local de l'invite `away` reste personnel et
  n'est pas remplace par un combat source simultane de l'hote. Le rattachement
  attend un `setSourcePresence` valide et les PNJ ne sont publies qu'apres
  confirmation autoritaire du nouveau `mapId`.
- Si l'invite atteint la carte de l'hote pendant un combat deja actif, il reste
  `away` et ne devient pas spectateur. Le client et la room bloquent le
  rattachement jusqu'au snapshot de fermeture, puis le retentent automatiquement.
- Les snapshots de cinematique et de PNJ de l'hote attendent tous deux la
  confirmation du `mapId` par la room ; une publication differee reste eligible
  apres la transition et ne produit plus d'erreur HUD.
- Reste avant `Termine` : recette deux navigateurs sur une zone narrative invisible
  avant puis apres sa progression, avec reconnexion de l'invite.

### STAB-WORLD-2 — PNJ mobiles autoritaires

- Priorite/statut : `P0` / `Termine`.
- Constat : mouvement et collision des PNJ sont actuellement calcules localement,
  ce qui permet une divergence entre navigateurs.
- Autorite : room pour position logique et occupation ; clients pour interpolation.
- Etat : `WORLD_STATE`, sans progression personnelle.
- Persistance : poses/positions necessaires aux scenes actives et a la reconnexion.
- Intentions : publication bornee de la position logique par l'hote ; l'invite ne
  peut jamais choisir ni publier une position de PNJ.
- Replication minimale : eventId, carte, position, direction, action, revision.
- Audience : joueurs presents sur la carte.
- Implementation : l'hote execute le noyau existant des routes autonomes et
  publie seulement `eventId`, position logique, direction, vitesse, occupation et
  action `idle/step`. La room verifie l'hote, la carte, les bornes et les identifiants,
  conserve une revision separee, utilise les acteurs bloquants dans les collisions,
  les spawns et les reconnexions, puis diffuse le resultat. Les clients interpolent
  sans recalculer la route. Les zones narratives invisibles de `STAB-WORLD-1`
  restent dans `blockedPoints`; les PNJ visibles vivent uniquement dans `actors`,
  ce qui supprime les obstacles fantomes a leur ancienne case.
- Preuves automatiques : schema strict et deduplication, refus de publication par
  l'invite, collision avant/apres un pas de PNJ, persistence de room, projection
  des pages actives, interpolation distante et restauration sans rejouer un pas.
- Validation manuelle : le porteur juge le comportement acceptable dans deux
  navigateurs le 2026-10-06.

### STAB-BATTLE-1 — Sequenceur visuel de combat

- Priorite/statut : `P0` / `Pret`.
- Constat : transitions grise/noire, textes trop rapides, PV non visibles avant le
  KO, disparition acceleree et musique declenchee au mauvais moment.
- Autorite : moteur de combat pour le resultat ; sequenceur de presentation local
  pour la lecture, sans recalcul de regle.
- Etat : file visuelle transitoire derivee des `TeamBattleEvent`.
- Persistance : curseur minimal uniquement si une reconnexion doit reprendre une
  presentation ; l'etat de combat autoritaire prime toujours.
- Replication minimale : evenements ordonnes et snapshot final du tour.
- Audience : participants et observateurs du combat.
- Ordre minimal : transition, entrees, action, impact, PV, texte d'efficacite ou
  echec, statut, KO, remplacement, EXP/recompenses, musique de victoire, sortie.
- UX : les textes importants attendent une validation ou un delai accessible ;
  `prefers-reduced-motion` raccourcit les animations sans supprimer les messages.
- Validation : rate, immunite, peu/tres efficace, critique, statut, soin, KO avec
  et sans reserve, victoire, defaite et fuite en solo/PvP/Coop.

### STAB-AUDIO-1 — Musique des lieux

- Priorite/statut : `P1` / `A qualifier`.
- Constat : les BGM de carte ne commencent pas pendant l'exploration.
- Autorite : monde de l'hote pour l'ambiance partagee ; volume/mute personnels.
- Etat : `AMBIENT_SHARED`, visuel/audio seulement.
- Persistance : identifiant de piste courante et position optionnelle, jamais le
  fichier audio dans un snapshot.
- Validation : entree de carte, transfert, reprise apres combat, remplacement de
  piste, silence explicite, volume et reconnexion.

## Nouvelles fonctionnalites Coop

### COOP-CAPTURE-1 — Capture invitee et don volontaire

- Priorite/statut : `P1` / bloque par `SOLO-CAPTURE-1`.
- Proprietaire initial : joueur ayant consomme la Ball et reussi la capture.
- Autorite : room pour le tirage et le journal idempotent ; sauvegarde personnelle
  pour l'ajout final.
- Don a l'hote : transaction distincte, explicite et acceptee ; aucun transfert
  automatique en cas de deconnexion.
- Validation : equipe pleine, Ranch plein ou indisponible, refus du don, doublon de
  reglement, reconnexion et shiny/formes/genre conserves.

### COOP-LOOT-1 — Ramassage delegue

- Priorite/statut : `P1` / `A qualifier`.
- Autorite : permission explicite de l'hote et resolution room.
- Etat : permission de session + consommation narrative hote + recompense cible.
- Regle : objets cles, uniques et rares non cedables. Pour un objet ordinaire,
  l'hote choisit `pour l'hote` ou `laisser a l'invite`.
- Donnees requises : classification extraite et stable des objets non delegables.
- Validation : concurrence, inventaire plein, annulation de permission,
  reconnexion et application exactement une fois.

### COOP-RANCH-1 — Consultation partagee en lecture seule

- Priorite/statut : `P2` / `A qualifier`.
- Autorite : proprietaire du Ranch.
- Etat : vue publique bornee, sans mutation et sans metadata privee inutile.
- Audience : participant explicitement autorise dans la room.
- Interactions : liste, filtres et fiche detaillee seulement ; depot, retrait,
  objet tenu et reorganisation restent interdits.
- Decision restante : consentement par session ou par ouverture de l'ecran.

### COOP-CHAT-1 — Chat de room

- Priorite/statut : `P2` / `A qualifier`.
- Autorite : room pour ordre, taille et debit.
- Etat : messages transitoires bornes ; pas d'ecriture dans la sauvegarde.
- Audience : participants de la room uniquement.
- Prerequis produit : longueur, historique, filtrage minimal, blocage/muet et
  comportement apres reconnexion.

## Mecanismes solo structurants

### CORE-BATTLE-RULES-1 — Fidelite des regles de combat

- Priorite/statut : `P0` continu / `A planifier par lots verticaux`.
- Constat source : 23/353 fonctions d'attaque et 13/255 talents sont executes.
  Une attaque extraite avec nom, puissance et animation n'est donc pas forcement
  fidele a Z ; meme constat pour un talent seulement affiche.
- Strategie : registres explicites et lots bornes par rencontres/dresseurs du
  prochain parcours, avec fallback signale plutot qu'un effet invente.
- Autorite : noyau de combat partage ; RNG locale en solo, room en multijoueur.
- Replication : intentions seulement, puis evenements et snapshot autoritaires.
- Dependances : objets tenus, meteo/terrains, formes, Mega-Evolution et IA.

### SOLO-ITEMS-1 — Utilisation des objets

- Priorite/statut : `P0` / `Pret` apres audit cible des poches deja importees.
- Couvre : soins hors combat, soins en combat, Balls, objets de combat, objets
  tenus, pierres, CT/CS et consommation atomique.
- Noyau commun obligatoire : validation de cible, effet, consommation et resultat.
- Dependances aval : capture, evolution, Mega-Evolution, Sac avance et Coop loot.

### SOLO-CAPTURE-1 — Capture complete

- Priorite/statut : `P0` / bloque par SOLO-ITEMS-1.
- Couvre : eligibilite, choix/consommation de Ball, formule, animation, surnom,
  equipe ou Ranch, shiny, forme, genre, origine et echec.
- Autorite : adaptateur local en solo, room pour un combat partage.
- Le shiny est une propriete generee/persistee du Pokemon, jamais un simple filtre.

### SOLO-EVOLUTION-1 — Evolutions

- Priorite/statut : `P1` / bloque par objets et progression de combat.
- Couvre : niveau, objet, echange, bonheur, lieu/heure/genre si presents dans Z,
  annulation, apprentissage et evolution en Coop sur valeurs reelles.

### SOLO-POKEDEX-1 — Pokedex

- Priorite/statut : `P1` / etat narratif deja present, interface a concevoir.
- Objectif : recherche, filtres, vus/captures, formes et acces rapide aux fiches,
  avec navigation plus simple que l'interface source.

### SOLO-MEGA-1 — Mega-Evolution

- Priorite/statut : `P1` / bloque par objets tenus, inventaire et combats.
- Doit verifier les regles exactes de Pokemon Z avant conception du contrat.

### SOLO-PENSION-1 — Pension

- Priorite/statut : `P2` / `A qualifier`.
- Donnees a verifier : depots, progression par pas, cout, reproduction, oeufs et
  scripts particuliers du fangame.

### SOLO-EGGS-1 — Oeufs et Incubateur

- Priorite/statut : `P2` / `A qualifier`, lie a la Pension.
- Z possede un Incubateur personnel de six emplacements distinct de l'equipe.
- Couvre : depot/retrait atomique, pas d'eclosion, capacite disponible, restauration
  et presentation. Les oeufs et leur progression restent `PLAYER_STATE` ; seuls
  les effets visuels utiles sont visibles aux joueurs proches.

### SOLO-FIELD-ENCOUNTERS-1 — Peche, Eclate-Roc et DexNav

- Priorite/statut : `P1` / `A qualifier` apres capture.
- Couvre les tables et conditions autres que la marche terrestre, puis le DexNav
  comme interface personnelle de consultation/selection des rencontres connues.
- L'autorite du tirage suit le combat : adaptateur local en solo, room en Coop.

### SOLO-MOVE-SERVICES-1 — Apprentissage et Maître des capacites

- Priorite/statut : `P1` / `A qualifier`.
- Couvre choix lors d'une montee de niveau avec quatre attaques, oubli, rappel,
  cout/conditions de Z et annulation. La mutation appartient au proprietaire du
  Pokemon et doit etre suspendue proprement pendant un combat partage.

### SOLO-POKEVIAL-1 — Pokévial rechargeable

- Priorite/statut : `P2` / bloque par `SOLO-ITEMS-1`.
- Etat personnel confirme : nombre d'utilisations courant/maximal ; soigne toute
  l'equipe et consomme une charge, rechargee par les services prevus par Z.
- En Coop, le dialogue et le soin ne sont visibles que par le joueur concerne.

### SOLO-CHALLENGE-MODES-1 — Nuzlocke et Monotype

- Priorite/statut : `P2` / `A qualifier`.
- Le choix Nuzlocke est persiste mais ses regles ne sont pas appliquees. Monotype
  possede ses types autorises, starters et validations propres dans le Ruby.
- Couvre les contraintes de capture/equipe/evolution et leur restitution apres
  reconnexion ; aucune regle ne doit etre deduite du seul libelle du mode.

### SOLO-WONDER-TRADE-1 — Échange Miracle de Z

- Priorite/statut : `P3` / `A qualifier`.
- Le jeu source simule localement un echange selon la puissance de base et des
  listes d'exclusion. Ne pas le confondre avec un echange reseau entre joueurs.
- Transaction personnelle atomique, compatible equipe/Ranch et preservation des
  donnees d'origine du Pokemon recu.

### SOLO-ENDGAME-1 — Tour de Combat

- Priorite/statut : `P3` / bloque par la fidelite du combat.
- Couvre les equipes configurees, suites de combats, reglements, recompenses et
  reprise. Le PvP et la Tour utilisent le meme moteur, mais pas le meme etat.

### SOLO-MAP-1 — Carte et boussole

- Priorite/statut : `P2` / `A qualifier`.
- Carte : lieux connus, position, destinations et navigation.
- Boussole : analyser d'abord la mecanique exacte de Z ; ne pas l'assimiler a une
  simple mini-carte sans preuve source.

### SOLO-ALCHEMY-1 — Alchimie

- Priorite/statut : `P2` / `A qualifier`.
- Necessite l'audit cible des recettes, ingredients, conditions narratives et de
  l'evenement commun 59 deja signale dans le handoff.

### SOLO-ACHIEVEMENTS-1 — Succes

- Priorite/statut : `P3` / `A qualifier`.
- Les compteurs doivent ecouter des evenements metier stables, pas inspecter le DOM
  ni dupliquer les mutations de gameplay.

### SOLO-NARRATIVE-1 — Poursuite du portage

- Priorite/statut : `P0` continu / en cours dans la phase 9.
- Continuer par parcours verticaux et familles de commandes generiques : cartes,
  effets, interrupteurs, evenements communs et validations manuelles.

## Plateforme et migration

### PLATFORM-CLOUD-1 — Sauvegardes cloud

- Priorite/statut : `P2` / bloque par decisions produit et securite.
- Prerequis : fournisseur, authentification, identite stable, chiffrement,
  versionnement, quotas, sauvegarde/restauration et politique de conflit.
- Mode recommande : revisions immuables + pointeur courant + comparaison de
  version ; ne jamais fusionner aveuglement deux progressions narratives.
- La room Coop n'est pas le stockage cloud de la sauvegarde.

### PLATFORM-IMPORT-1 — Import de sauvegarde Pokemon Z

- Priorite/statut : `P2` / bloque par echantillons.
- Entree requise : plusieurs sauvegardes v2.12 FR provenant de l'emulateur, avec
  debut, milieu, fin, Ranch/equipe, objets et badges varies.
- Processus : lecture hors ligne, detection de version, apercu, rapport des champs
  incompatibles, conversion vers une nouvelle sauvegarde et conservation intacte
  de l'original.
- Ne pas promettre Pokemon, badges, narration et objets avant identification du
  format RGSS/Marshal exact et de ses variantes.

## UI, responsive et accessibilite

### UI-LAYOUT-1 — Menus plein canvas

- Priorite/statut : `P1` / `Pret` apres stabilisation.
- L'overworld conserve son cadrage desktop ; les menus superposes exploitent toute
  la surface disponible et adaptent grilles, textes et fiches sans modifier le
  noyau metier.

### UI-BAG-1 — Classement avance du Sac

- Priorite/statut : `P1` / partiellement pret.
- Reutiliser les poches source, puis ajouter familles, baies, pierres, CT/CS et
  tris par type, effet et puissance. Les filtres ne modifient pas l'inventaire.

### UI-ANDROID-1 — Controles tactiles paysage

- Priorite/statut : `P2` / bloque par maquette et matrice d'appareils.
- Les boutons emettent les memes intentions que le clavier. Aucun moteur de
  mouvement tactile parallele.
- Prevoir zones sures, orientation paysage, redimensionnement et accessibilite.

### UI-SPRITES-1 — Echelles contextuelles

- Priorite/statut : `P2` / `A qualifier`.
- Ne pas appliquer un facteur global : mesurer battlers, icones, portraits,
  characters et objets separement, conserver les ancrages et tester les variantes
  de dimensions du fangame.

## Decisions et donnees encore necessaires

- definition produit des objets `rares/non delegables` ;
- consentement de partage du Ranch ;
- regles et moderation du chat ;
- fournisseur et authentification des sauvegardes cloud ;
- sauvegardes originales representatives pour l'import ;
- mecanique source exacte de la Boussole, de l'Alchimie, de la Pension et de la
  Mega-Evolution ;
- maquette ou contraintes minimales pour les commandes Android.

## Recette minimale avant cloture d'un lot

- tests unitaires du noyau et du schema ;
- test d'integration de l'adaptateur local ;
- test room des intentions invalides, concurrence et idempotence ;
- recette deux navigateurs : hote, invite, rendu distant ;
- deconnexion/reconnexion si l'etat survit au socket ;
- `corepack pnpm test` et `corepack pnpm build` ;
- mise a jour de `docs/AI_HANDOFF.md`, de ce backlog et de la roadmap.
