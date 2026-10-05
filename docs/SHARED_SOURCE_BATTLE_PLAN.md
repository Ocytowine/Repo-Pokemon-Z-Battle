# Plan global d'integration des combats source partages

Date de decision : 2026-10-04.

Etat au 2026-10-05 : les lots 0 a 4 sont termines dans le code. Le noyau couvre le
journal exact par K.O., le cycle de session, le contexte source public et la
jonction autoritaire avec observation, composition et boucle tactique. La recette
locale a deux navigateurs, l'application idempotente et la reprise narrative
restent a effectuer.

Ce document decrit le raccord complet entre les combats issus de Pokemon Z, le
moteur de combat commun et la Coop. Il complete `AI_HANDOFF.md`, la roadmap et
`COOP_ARCHITECTURE.md`. Une meme session doit fonctionner avec une autorite locale
en solo et avec la room autoritaire en Coop.

## Resultat vise

- Les rencontres sauvages aleatoires ou scriptées et les combats de Dresseurs
  s'ouvrent depuis le parcours source en solo ou dans le monde partage.
- En Coop, l'invite peut observer, rejoindre l'hote ou rejoindre l'adversaire avant
  le premier tour.
- Le combat reste simple : un actif, six Pokemon et deux Dresseurs au maximum par
  camp. Un combat deja double refuse la jonction.
- Le proprietaire de l'actif choisit son action. La room tranche tours,
  remplacements, K.O., RNG et resultat.
- PV, statuts, PP, EXP et actif reviennent uniquement dans la sauvegarde du
  proprietaire. Histoire et recompenses uniques restent celles de l'hote.
- Une reconnexion ne perd ni le combat ni son reglement et ne peut appliquer deux
  fois une recompense.
- La mise en scene existante reste commune au solo, au duel et au combat partage.

## Contraintes structurantes

Le Worker ne possede pas les fichiers locaux de Pokemon Z. L'hote construit donc
l'etat initial depuis ses catalogues extraits et envoie un contrat borne et valide.
Des son acceptation, la room devient l'unique autorite. Elle ne recoit jamais de
chemin local, script Ruby, inventaire complet, Ranch, IV/EV ou identite privee.

Une room ne contient actuellement que deux joueurs. Le premier perimetre couvre
donc l'hote et un invite. Le modele garde deux Dresseurs par camp pour une future
extension, mais les combats doubles, rooms plus grandes et controle du Pokemon
d'autrui restent hors perimetre.

## Contrat d'autorite

| Sujet | Autorite | Domaine | Persistance | Audience |
| --- | --- | --- | --- | --- |
| Creation depuis Z | hote, puis validation room | narratif hote | contexte dans la room | participants |
| Composition et proprietaires | noyau commun, arbitre room | partage | snapshot/room | participants |
| Actions, RNG, K.O., remplacements | room ou adaptateur solo | combat partage | etat et journal | participants |
| PV, statuts, PP, actif final | joueur proprietaire | personnel | `SourceEventState.party` | joueur concerne |
| EXP, niveaux, capacites | joueur proprietaire depuis le reglement | personnel | sauvegarde et journal idempotent | joueur concerne |
| Switches, variables, suite de sequence | hote | narratif hote | sauvegarde source | selon politique narrative |
| Gains ordinaires exportables | politique du contexte | personnel | delta idempotent | joueur concerne |
| Objets rares/cles/uniques | hote | narratif hote | sauvegarde hote | hote |
| Animations, musique, HUD | chaque client | visuel | reprise du snapshot | participants |

## Contrats a introduire

Le protocole distingue l'origine du combat de son etat tactique :

```ts
type SharedBattleOrigin = "source-wild" | "source-trainer" | "player-duel" | "room-encounter";

interface SourceBattleContext {
  origin: "source-wild" | "source-trainer";
  format: "single" | "double";
  escapable: boolean;
  narrativeOwnerId: string;
  presentation: {
    battlebackId: string;
    battleMusicId: string | null;
    victoryMusicId: string | null;
    opponentTrainer: { id: number; name: string } | null;
  };
  rewards: SourceBattleRewardManifest;
  continuation: "pending-encounter" | "trainer-sequence";
}
```

Les identifiants de presentation sont logiques et resolus localement. Le manifeste
de recompense ne contient que les faits immuables necessaires : especes, niveaux,
experience de base, classe/baseMoney et gains declaratifs de la sequence. Tous les
champs sont bornes et valides.

Le snapshot porte aussi un cycle explicite :

```text
join-window -> active -> settling -> closed
```

- `join-window` autorise une proposition et bloque le premier tour ; commencer une
  action ferme definitivement cette fenetre.
- `active` accepte uniquement l'intention du proprietaire de chaque actif.
- `settling` conserve resultat, participation, journal et reglements par joueur.
- `closed` retire la scene sans effacer un reglement du a un joueur deconnecte.

Intentions minimales : `openSourceBattle`, `closeJoinWindow`, actions et
remplacements existants, `ackBattleSettlement`, `closeSourceBattle`. Les intentions
de proposition et d'accord deja presentes sont reutilisees.

## Ordre d'implementation

### Lot 0 - Stabiliser la fondation

- Conserver le lot non commite : participation, proposition, vue de jonction,
  restitution filtree et `SharedBattleLedger`.
- Ajouter les invariants purs : identifiants uniques entre camps, actif present,
  proprietaire coherent et aucune action pendant une proposition.
- Figer par tests le duel et les rencontres generiques avant de changer leur fin.

Sortie : la base actuelle reste verte et les regressions futures sont localisables.

Etat : termine le 2026-10-05. Les identifiants de Pokemon sont uniques entre les
camps, un Dresseur ne peut appartenir aux deux camps, chaque proprietaire doit etre
declare dans son camp et l'actif doit appartenir a sa composition. Une proposition
alteree ou devenue obsolete est refusee. Refuser une jonction ne supprime plus le
journal du combat en cours.

### Lot 1 - Unifier session et reglement

- Ajouter origine, contexte, cycle de vie et identifiant stable de reglement.
- Extraire du controleur source les regles pures de fin : ressources, defaite,
  fuite et recompenses. Un adaptateur local les utilise en solo ; la room emploie
  les memes transitions.
- Remplacer le journal global par des credits exacts par K.O. : adversaire vaincu,
  actifs eligibles a cet instant, proprietaires, tour et raison. La liste de tous
  les Pokemon engages est insuffisante si l'un d'eux arrive apres un K.O.
- Reverifier dans les scripts de Z formule d'EXP, partage, cas sauvage/Dresseur et
  effets avant de figer le calculateur.

Sortie : une fonction pure produit les `BattleSettlement` individuels depuis
l'etat final, la participation, les credits et le contexte.

Etat : en cours. `SharedBattleLedger` conserve desormais les engagements contre
chaque adversaire et fige, au moment du K.O., les participants encore conscients.
Les changements volontaires et les remplacements forces passent par le meme
enregistreur. `sharedBattleOwnerSettlement` filtre ensuite ressources et credits
pour un seul proprietaire. Les anciens journaux du protocole v9 sont migres a la
restauration. Le calcul d'EXP utilise maintenant le nombre total de participants
du camp, puis `applySharedBattleExperience` ne modifie que l'equipe du proprietaire
vise. Il reproduit les troncatures de l'override final, le bonus Dresseur, les
coefficients de niveau propres a Z, les switches 661/252/624, l'Oeuf Chance et le
plafond lie aux badges. Le Partage Exp et l'Exp Tous concernent des
non-participants et restent reportes avec le futur noyau d'objets.

`SharedBattleSession` formalise `join-window -> active -> settling -> closed` et
conserve un identifiant de reglement stable jusque dans l'etat ferme. Les
transitions refusent un reglement avant le resultat tactique. Ce contrat est encore
pur : sa publication dans le protocole et sa consommation par la room appartiennent
au lot 2, afin de ne pas creer un second cycle propre au reseau.

### Lot 2 - Publier les combats Pokemon Z

- Ajouter et valider strictement `openSourceBattle`.
- Seul l'hote, present dans le monde partage et sans scene incompatible, ouvre le
  combat.
- `SourceBattleController` produit un brouillon canonique sans lancer en parallele
  sa resolution locale. Sans room, ce brouillon part vers l'adaptateur solo.
- Le controleur conserve la continuation en attente ; le snapshot reseau pilote la
  scene et les commandes.
- Initialiser participation, journal, RNG, contexte et fenetre de jonction dans une
  seule mutation persistable de room.

Sortie : Keunotor, une rencontre d'herbe et un Dresseur s'affichent dans les deux
navigateurs, avant distribution des gains.

Etat code au 2026-10-05 : implemente, recette locale a deux navigateurs encore a
effectuer. Le protocole v10 expose `SourceBattleContext`, `openSourceBattle`, le
cycle et le contexte dans le snapshot. Le contexte borne la carte, l'origine, la
presentation logique, les adversaires/recompenses, la politique d'EXP et la
continuation sans publier de sauvegarde privee. `SourceBattleController` construit
le meme brouillon pour le solo et la Coop ; en presence d'une room valide, il le
cede sans lancer une resolution locale concurrente. La room reserve cette ouverture
a l'hote, verifie le manifeste face a l'equipe adverse, cree tactique,
participation, journal et session atomiquement, puis conserve le resultat en
`settling` a travers export/restauration. Le solo traverse le meme cycle pur,
y compris lors d'une fuite sauvage.

Dette volontaire : le reglement personnel, les accuses idempotents, la fermeture
du combat source et la reprise de sa continuation appartiennent aux lots 5 et 6.
La fuite reseau et l'IA autre que la premiere capacite appartiennent au lot 4.

### Lot 3 - Finaliser jonction et composition

- Proposer `Observer`, `Rejoindre l'hote` et `Rejoindre l'adversaire` uniquement en
  `join-window` et si l'invite est present sur la carte partagee.
- Cote allie, faire accepter la composition finale commune. Cote adverse, borner la
  contribution a six membres pour le camp final.
- Afficher proprietaires, actif, membres conserves et raison des refus.
- Fermer la fenetre au premier tour ou explicitement par l'hote ; traiter d'abord
  toute proposition en cours.
- Revalider les equipes dans la room sans faire confiance aux totaux de l'UI.

Sortie : les trois choix fonctionnent sur tout combat source simple ; les combats
doubles et compositions invalides sont refuses proprement.

Etat code au 2026-10-05 : implemente, validation manuelle encore ouverte. Le
protocole v11 ajoute `observeBattle` et `closeBattleJoinWindow`; le choix
d'observer est persiste dans la room. L'invite ne peut proposer une equipe que
depuis la carte partagee et avant le premier tour. Les deux camps sont composes
dans la limite de six, avec au moins un Pokemon de chaque joueur pour une jonction
alliee ; les identifiants sont revalides entre camps. L'interface indique camp,
proprietaire, actif et membres retenus. Seul l'hote ferme explicitement la fenetre,
et il doit d'abord accepter ou refuser toute proposition. Une action invalide d'un
observateur ne peut plus fermer la fenetre. Le motif d'un refus est conserve et
presente au joueur concerne.

### Lot 4 - Boucle tactique autoritaire complete

- Router attaque, changement volontaire et remplacement force vers le proprietaire
  concerne.
- Jouer un adversaire sans proprietaire par l'IA source et la RNG de room, au lieu
  d'imposer la capacite d'index zero.
- Suspendre si le proprietaire de l'actif est deconnecte et reprendre au meme tour.
  Aucun pilote automatique implicite de son Pokemon.
- Reserver la fuite globale au proprietaire narratif : l'invite ne peut pas faire
  echouer seul la sequence de l'hote.
- Preparer la regle future des Balls : uniquement un sauvage sans proprietaire,
  jamais le Pokemon d'un invite.
- Conserver le duel direct sans jonction ni recompense source, avec la meme
  presentation et, si utile, le meme cycle actif/fin.

Sortie : changements, K.O., remplacement et reconnexion ne divergent jamais entre
clients.

Etat code au 2026-10-05 : implemente, recette locale a deux navigateurs encore a
effectuer. Le protocole v12 ajoute l'intention `attemptBattleEscape` et publie le
resultat de fuite ainsi que son compteur persistable. L'IA source, sa selection de
capacite, les remplacements sans proprietaire et la formule de fuite vivent dans
le noyau commun utilise par le solo et la room. Une action, un changement ou un
remplacement est accepte uniquement du proprietaire concerne ; un changement ne
peut pas envoyer le Pokemon d'un autre joueur. La deconnexion retire l'intention
du proprietaire et suspend le tour jusqu'a sa reconnexion, sans pilote automatique.
La fuite globale est reservee au proprietaire narratif. La future capture est
bornee a un adversaire sauvage sans proprietaire et refuse donc un Pokemon invite.
Le duel direct conserve son chemin a deux intentions sans IA source.

### Lot 5 - Resultats et recompenses par proprietaire

- Produire un reglement immuable par joueur : ressources de ses Pokemon, EXP,
  niveaux, capacites, argent et objets autorises.
- Reutiliser `storeOwnedBattleResults` puis le calculateur EXP de `player-state`.
  Ne jamais reconstruire un Pokemon depuis sa copie reseau.
- Ajouter a la sauvegarde personnelle un journal compact des reglements appliques.
  Application et accuse de reception deviennent idempotents.
- Garder dans la room les reglements non accuses. L'hote reprend apres son propre
  enregistrement ; l'invite deconnecte recupere le sien sans bloquer l'histoire.
- Appliquer la politique : narration et raretes a l'hote ; EXP/ressources a leur
  proprietaire ; gains `PERSONAL_EACH` a chaque participant eligible.
- Etendre la presentation actuelle d'une EXP unique a une liste par Pokemon.

Sortie : chaque sauvegarde conserve uniquement ses changements, meme apres
rechargement ou message repete.

### Lot 6 - Reprise de l'histoire et presentation

- Construire l'introduction depuis le contexte : fond, musique, Dresseur, envois
  et profils personnalises.
- Serialiser les tours dans la file d'animations ; aucun snapshot ne doit recouvrir
  une animation en cours.
- A `settling`, jouer K.O., fin, EXP de chaque proprietaire, argent visible par le
  joueur concerne, fondu et arret audio.
- Apres le reglement de l'hote, appeler une seule fois la continuation gardee par
  `SourceBattleController`. Victoire, defaite et fuite suivent les branches solo.
- Publier ensuite les mutations narratives de l'hote. Les gains personnels de
  l'invite n'entrent jamais dans `SourceSceneSnapshot`.

Sortie : post-Keunotor et combats de Dresseurs reprennent au bon curseur ; l'invite
revient sur la carte avec sa propre equipe mise a jour.

### Lot 7 - Robustesse et validation

Tests purs/protocole : contexte, cycle, droits, tailles, credits multi-K.O., deux
proprietaires, recompenses, idempotence, double combat, joueur `away`, mauvais
proprietaire et tour perime.

Tests de room : ouverture, observation, jonction des deux cotes, accords, IA,
remplacements, export/restauration pendant proposition/tour/reglement, deconnexion
de l'actif et reglement invite differe.

E2E deux navigateurs : sauvage source avec invite allie ; Dresseur avec invite
adverse ; changements, K.O., EXP et retour overworld ; reconnexion avant le premier
tour et apres le dernier ; aucune fuite de switch, objet rare ou Pokemon entre les
sauvegardes.

Recette locale : Keunotor de Map002, herbes de Map007 et Crisanto, puis parcours
Map002 -> Map003 -> Map007 -> Map009.

## Repartition probable du code

- `battle-engine` : cycle, participation, credits et reglement tactique pur.
- `player-state` : application personnelle idempotente, EXP et journal.
- `multiplayer-protocol` : contexte, intentions, snapshot et validation publique.
- `room-server-core` : autorite, RNG, IA, persistance et reglements en attente.
- `source-battle-controller.ts` : brouillon, adaptateur solo, continuation narrative.
- `network-session.ts` : transport, reprise et accuses de reglement.
- vues de combat : jonction, proprietaires, observation et presentation, sans
  mutation metier dans le DOM.

## Definition de termine

Le raccord est termine lorsque `solo`, `hote`, `invite`, `rendu distant` et
`reconnexion` utilisent les memes regles. Un combat source reel doit fonctionner
de bout en bout dans deux navigateurs, chaque equipe doit etre correcte et la
sequence hote reprendre une fois. `corepack pnpm test`, `corepack pnpm build` et
`corepack pnpm test:multiplayer:e2e` doivent passer.

## Extensions reportees

- combats doubles rejoints, rooms de trois joueurs ou plus, spectateurs externes ;
- niveaux adaptatifs ;
- capture, soins et objets de combat, via leur futur noyau partage ;
- oubli interactif de capacite, evolutions et echanges ;
- zone Coop speciale ;
- Map001 et introduction de creation du personnage.

Ces reports ne modifient pas les contrats de proprietaire, reglement et audience.
