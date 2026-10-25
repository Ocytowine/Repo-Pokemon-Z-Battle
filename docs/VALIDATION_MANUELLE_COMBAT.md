# Validation manuelle des fonctions de combat

État au 2026-10-23 : **à exécuter par le porteur du projet**. Les tests automatisés et
le build passent, mais ils ne remplacent pas la vérification visuelle en jeu.
Cette fiche couvre les fonctions récemment portées `05C`-`05F`, `071`-`074`,
`079`, `07A`, `07C`-`081`, `084` et `089`-`08C`. Ajouter ici les prochains lots avant de demander une validation
manuelle. La mécanique et les limites connues sont détaillées dans
[AI_HANDOFF.md](AI_HANDOFF.md) ; le suivi général est dans [ROADMAP.md](ROADMAP.md).

## Préparation sans toucher à la sauvegarde principale

1. Utiliser une sauvegarde de test ou une copie de la sauvegarde personnelle.
   **Sketch modifie durablement la capacité du Pokémon** ; le menu « Test dev »
   ajoute aussi réellement les Pokémon et objets obtenus.
2. Dans ce dépôt, lancer `corepack pnpm prepare:local` si les données locales
   manquent, puis `corepack pnpm sandbox:overworld`. Pour la Coop, lancer dans
   un autre terminal `corepack pnpm multiplayer:dev`, ouvrir deux fenêtres ou
   profils de navigateur distincts, créer une room et la rejoindre. Le serveur
   Worker local et l'URL de l'Overworld sont affichés par les terminaux.
3. Dans **Menu → Test dev → Donner un Pokémon**, choisir si besoin les exemples
   ci-dessous. Vérifier ses quatre capacités dans **Équipe** avant le combat :
   à un niveau donné, le jeu ne conserve que les quatre dernières capacités
   apprises. Si une capacité manque, noter « bloqué par la préparation » plutôt
   que de conclure à un bug de combat.

| Fonction | Pokémon de test issu des données locales | Capacité attendue |
| --- | --- | --- |
| `05C` Mimic | M. Mime niveau 15 | Mimético |
| `05D` Sketch | Queulorior niveau 1 | Esquema |
| `05E`/`05F` Conversions | Porygon-Z niveau 1 | Conversión, Conversión2 et Maquinación (type Ténèbres) |
| `071`/`072` Représailles | Qulbutoké niveau 1 | Contrataque, Manto Espejo |
| `073` Metal Burst | Dinoclier niveau 37 | Repr. Metal |
| `074` Flame Burst | Chamallot niveau 15 | Pirotecnia |
| `079`/`07A` Fusion | Zekrom et Reshiram niveau 50 | Rayo Fusión, Llama Fusión |
| `07C`/`07D` Statut guéri | Makuhita niveau 34 | Estímulo, Espabila |
| `07E`/`07F` Statut et puissance | Sapereau niveau 47, Branette niveau 26 | Imagen, Infortunio |
| `080` PV de la cible | Mamanbo niveau 41 | Salmuera |
| `081` Attaquant du tour | Grelaçon niveau 39, Cradopaud niveau 22 | Alud, Desquite |

Les noms affichés peuvent dépendre de la traduction chargée ; les codes et noms
internes (`MIMIC`, `SKETCH`, `CONVERSION`, `CONVERSION2`, `COUNTER`,
`MIRRORCOAT`, `METALBURST`, `FLAMEBURST`, `FUSIONBOLT`, `FUSIONFLARE`) sont les
repères fiables. Le Battle Sandbox autonome utilise un catalogue minimal : ne
pas l'employer comme preuve d'absence de ces capacités dans l'Overworld.

## Parcours prioritaire (environ quelques combats)

Cocher seulement après observation. Si un scénario ne peut pas être préparé
sans modifier lourdement la partie, écrire « bloqué » ou « non concluant » et
passer au suivant. Les tests automatiques protègent déjà les valeurs exactes ;
ici, vérifier surtout sélection, messages, animation, barres de PV, audience
Coop et sauvegarde.

- [ ] **Solo — copie temporaire (`05C`)** : laisser l'adversaire employer une
  capacité que M. Mime ne connaît pas, puis utiliser Mimético. La capacité
  copiée remplace Mimético pendant sa présence sur le terrain. Changer de
  Pokémon : Mimético revient, avec ses PP dépensés, et la capacité copiée
  n'apparaît pas durablement dans Équipe après le combat.
- [ ] **Solo — apprentissage durable (`05D`)** : faire jouer une capacité à
  l'adversaire, puis utiliser Esquema avec Queulorior. Vérifier le nom affiché
  de la capacité apprise, changer de Pokémon et terminer le combat. Dans
  Équipe, Esquema doit être remplacé par cette capacité ; sauvegarder/recharger
  la sauvegarde de test et vérifier que l'apprentissage reste présent.
- [ ] **Solo — types (`05E`/`05F`)** : avec Porygon-Z, utiliser Conversión ; son
  type doit devenir celui d'une autre de ses capacités éligibles. Pour
  Conversión2, laisser d'abord l'adversaire attaquer, puis vérifier un type
  résistant ou immunisé au type de ce dernier coup. Après retrait, le type
  d'origine doit revenir. Sans attaque adverse préalable, Conversión2 doit
  échouer clairement, sans changement de type.
- [ ] **Solo — représailles (`071`-`073`)** : avec Qulbutoké ou Dinoclier,
  laisser l'adversaire frapper avant la riposte. Contrataque répond à un coup
  physique, Manto Espejo à un coup spécial ; Repr. Metal répond au dernier
  coup dommageable. Sans coup admissible dans ce tour, l'action échoue. Vérifier
  que la barre de PV et le message d'échec correspondent à l'action réellement
  choisie ; ne pas comparer des dégâts bruts entre combats de niveaux différents.
- [ ] **Solo/Coop — Fusion (`079`/`07A`)** : dans un combat où Zekrom et
  Reshiram peuvent agir au même tour (par exemple un duel PvP préparé), faire
  toucher une cible avec Rayo Fusión, puis utiliser Llama Fusión dans ce même
  tour ; refaire dans l'ordre inverse si possible. La deuxième attaque doit
  profiter du bonus. Au tour suivant, un coup isolé ne doit pas conserver ce
  bonus. Une immunité ou un échec du premier coup ne doit pas l'amorcer.
  Les tirages aléatoires et les types empêchent d'exiger exactement « deux fois
  moins de PV » à l'écran : noter l'ordre, la cible et les PV observés.
- [ ] **Double — Pirotecnia (`074`)** : dans **Test dev → Combats narratifs →
  TP duo Hector et Zaida**, engager le combat double avec Chamallot. Quand
  Pirotecnia touche l'un des adversaires, son partenaire encore vivant perd
  aussi des PV (environ 1/16 de ses PV maximaux) et c'est **sa** barre qui
  s'anime. Un coup raté ou immunisé ne doit pas infliger ces dégâts annexes.
  Si le partenaire a Garde Magik actif, aucun dégât annexe ne doit être appliqué
  (cas avancé : ne pas bloquer le reste si cette équipe n'est pas disponible).
- [ ] **Solo — statuts et seuil de PV (`07C`-`080`)** : comparer Estímulo face
  à une cible paralysée et saine, puis Espabila face à une cible endormie et
  éveillée. Après un impact non fatal, le statut concerné doit disparaître et le
  message de guérison doit viser la cible. Vérifier aussi le bonus d'Imagen avec
  un porteur empoisonné/brûlé/paralysé, d'Infortunio face à une cible affectée et
  de Salmuera à la moitié des PV ou moins. Un K.O. par Estímulo/Espabila ne doit
  pas afficher ensuite une guérison du statut.
- [ ] **Double/Coop — attaquants du tour (`081`)** : faire subir au porteur de
  Desquite ou Alud des dégâts provenant des deux adversaires pendant le même tour,
  puis cibler celui qui n'a pas infligé le dernier impact. Le bonus doit quand
  même s'appliquer à cette cible. Au tour suivant sans nouveau dégât de sa part,
  le bonus ne doit pas être conservé. Recharger l'invité avant la réponse et
  vérifier que l'historique autoritaire n'est ni perdu ni rejoué.
- [ ] **Solo/Coop — puissance variable (`084`, `089`-`08C`)** : vérifier
  Vendetta après une action adverse puis avant celle-ci, Retour/Frustration avec
  des bonheurs distincts, Éruption/Giclédo avec PV pleins puis réduits et
  Presse/Essorage sur une cible saine puis blessée. Répéter une attaque comme
  hôte et une comme invité, puis reconnecter pendant le combat pour comparer
  les mêmes PV et le même ordre d'action.
- [ ] **Solo/Coop — Represalia et Meteorobola (`085`, `087`)** : après le K.O.
  d'un allié, vérifier que Represalia est renforcée uniquement au tour suivant,
  y compris en double et après reconnexion. Tester Meteorobola sous soleil,
  pluie, sable, grêle et Vents Forts, puis avec Ciel Gris ou Air Lock ; comparer
  type, puissance, messages et PV sur les écrans hôte et invité.
- [ ] **Solo/Coop — Force Ajoutée et Punition (`08E`, `08F`)** : cumuler des
  boosts positifs, dont précision/esquive, avec un malus indépendant ; comparer
  les dégâts avant/après, puis vérifier le plafond de Punition. Répéter une
  action hôte et une invitée et recharger chaque écran pendant le combat.
- [ ] **Solo/Coop — Puissance Cachée et Écho (`090`, `092`)** : tester deux
  Pokémon aux IV de parité différente, puis inverser Attaque/Attaque Spéciale
  autour de l'égalité pour vérifier la catégorie. Jouer Écho deux tours de
  suite, deux fois au même tour en double, puis laisser un tour vide ; vérifier
  le plafond et la remise à un. Reconnecter hôte et invité avant la reprise.
- [ ] **Solo/Coop — Présent et As Caché (`094`, `097`)** : provoquer les trois
  puissances et le soin de Présent sur une cible blessée, puis son échec sur
  cible pleine ; vérifier la Gemme et Lien Parental. Pour As Caché, comparer
  plusieurs PP restants dont zéro après dépense et le surcoût de Pression.
  Refaire en double, côté hôte et invité, puis après reconnexion.
- [ ] **Solo/Coop — Boule Élek (`099`)** : comparer les dégâts sous les seuils
  de rapport de vitesses 2, 3 et 4, puis avec Vent Arrière sur chaque camp,
  un cran de Vitesse et une météo modifiant la Vitesse. Refaire en double
  lorsque la cible bénéficie de Vent Arrière ; vérifier la même cible et les
  mêmes PV chez l'hôte et l'invité, puis après reconnexion.
- [ ] **Solo/Coop — critiques garantis (`0A0`)** : utiliser Souffle Glacé ou
  Yama Arashi contre une cible ordinaire, puis sous Conjuro et avec
  Armurbaston/Coque Armure ; vérifier l'indicateur de critique et les PV.
  Refaire en double avec une action de l'hôte et une de l'invité, puis recharger.
- [ ] **Solo/Coop — Jugement et Techno Blast (`09F`)** : comparer une plaque,
  chacun des quatre modules, un objet non correspondant et aucun objet ; vérifier
  type, efficacité, animation et PV. Répéter sous Embargo/Maladresse, en double
  avec hôte et invité, puis après reconnexion. Noter séparément toute variante
  d'animation source absente ou incorrecte ; ne pas en inventer une.

`096` (Don Naturel) et `0F9` (Champ Magique) sont maintenant à valider
visuellement si les capacités et baies nécessaires sont disponibles :

- [ ] **Solo — Don Naturel (`096`)** : utiliser successivement une baie de
  type/puissance 80, 90 et 100 du catalogue ; comparer type, efficacité,
  dégâts, animation et consommation après impact. Vérifier qu'une immunité
  garde la baie, et que l'attaque échoue sans baie ou sous Tension.
- [ ] **Solo — Champ Magique (`0F9`)** : lancer le champ avec une baie Sitrus
  et un objet de type plaque/module, puis contrôler que leurs effets sont
  suspendus sans perdre les objets. Vérifier l'interdiction d'un objet de
  Dresseur, l'expiration après cinq fins de tour et l'annulation par un second
  lancement. Après expiration, la baie doit pouvoir s'activer de nouveau.
- [ ] **Coop/double — `096`/`0F9`** : faire lancer chaque capacité par l'hôte
  puis l'invité ; comparer cible, type, dégâts, consommation et compteur chez
  les deux participants. En double, placer Tension sur le second adversaire,
  puis tester une baie défensive sous le champ. Recharger l'invité pendant le
  champ : objet tenu et nombre de tours restants doivent être identiques.

Le script source de Don Naturel contient la condition erronée
`TotalDamage>0>0` ; le port consomme la baie après des dégâts réellement
infligés. Noter séparément tout comportement observé qui contredit cette
réparation explicite.

Les effets de baies déjà portés peuvent être observés dans un combat existant,
sans utiliser `096` ni `0F9` :

- [ ] **Baies de statut** : empoisonner un porteur de Baie Pecha, endormir un
  porteur de Baie Chesto, puis répéter avec Baie Lum ; vérifier la disparition
  du statut et de l'objet, une seule fois, chez l'hôte et l'invité.
- [ ] **Confusion et PP** : déclencher Baie Persim sous confusion et épuiser une
  capacité du porteur de Baie Leppa ; vérifier la confusion retirée et les PP
  restaurés (10 au maximum), puis recharger l'invité avant l'action suivante.
- [ ] **Seuils après impact** : faire passer un porteur de Baie Salac sous 1/4
  des PV après un coup ; vérifier le cran de Vitesse avant la prochaine action.
  Comparer Oran/Sitrus, désormais vérifiées après chaque impact. Répéter en
  double si ces objets sont disponibles dans une équipe de test.

Si une baie ou un combat de test n'est pas disponible, noter « bloqué » ; ne
pas modifier une sauvegarde personnelle pour fabriquer ce scénario.

## Recette du lot objets `0F2`–`0F7` (à exécuter)

- [ ] **Solo, transfert** : échanger deux objets différents avec Trick ou
  Switcheroo, puis donner un objet avec Bestow. Vérifier les deux icônes et
  messages, l'échec sur cible déjà équipée pour Bestow et le blocage par
  Sticky Hold. Après combat, contrôler la restitution ou conservation selon
  le type de rencontre.
- [ ] **Solo, consommation** : brûler une baie puis une Gemme avec Incinerate,
  voler une baie Sitrus ou Ganlon avec Bug Bite/Pluck, consommer un objet puis
  utiliser Recycle. Vérifier PV/stages, disparition du bon objet et absence
  de récupération d'une baie détruite ou volée.
- [ ] **Solo, Lancement** : lancer un objet lourd (Pierre Dure ou Boule Fer),
  une baie, puis Orbe Flamme. Comparer puissance, effet de baie/statut et
  consommation. Refaire avec Klutz, Champ Magique et sans objet : la capacité
  doit échouer sans lancer l'objet.
- [ ] **Multi-coups** : placer Oran/Sitrus ou Ganlon sur la cible d'un coup
  double. Vérifier l'activation entre les deux impacts et la baisse des
  dégâts du second coup après Ganlon.
- [ ] **Double et Coop** : échanger/donner/lancer successivement depuis le
  slot de l'hôte puis celui de l'invité, vérifier le bon destinataire et le
  même inventaire tenu sur les deux écrans. Reconnecter l'invité juste après
  un échange, puis vérifier les objets et leur propriétaire après règlement.

Clonage, Symbiosis après Bug Bite et les états Torment/Heal Block de Mental
Herb lancé restent des interactions transverses à signaler séparément ; ne
pas les valider comme closes par les tests ci-dessus.

## Matrice Coop à répéter sur un ou deux cas représentatifs

- [ ] **Hôte** : l'hôte joue une capacité du lot dans un combat partagé ;
  l'invité voit le même Pokémon ciblé, le même message et les mêmes PV.
- [ ] **Invité** : l'invité joue à son tour une capacité du lot ; l'hôte voit
  son action sans lancer localement une seconde résolution. Pour Sketch, seul
  le propriétaire du Queulorior conserve la nouvelle capacité dans son Équipe.
- [ ] **Double et rendu distant** : si les deux joueurs participent au duo,
  vérifier que Pirotecnia touche la barre du bon partenaire adverse chez les
  deux joueurs, sans abîmer le partenaire allié.
- [ ] **Reconnexion** : après une action du lot et avant de quitter le combat,
  recharger l'onglet de l'invité puis, si possible, celui de l'hôte. Les PV,
  types, capacités et tour courant doivent être cohérents ; aucun tour ne doit
  être rejoué. Après le règlement, vérifier à nouveau l'Équipe propriétaire
  (Sketch durable ; Mimic temporaire).

### Lot sacrifice, Requiem et remplacement (`0E1`–`0EF`, 2026-10-23)

À exécuter en solo, puis en Coop côté hôte et invité ; pour chaque combat,
observer aussi l'écran distant et recharger un client avant le remplacement
ou avant l'échéance de Requiem. Ne pas considérer les codes `0EA`/`0EB`/`0EC`
comme terminés tant que la fuite sauvage n'est pas raccordée.

- [ ] Sacrifice/Final Gambit : dégâts égaux aux PV courants, utilisateur K.O.,
  remplacement proposé ; vérifier aussi une immunité de type.
- [ ] Souvenir/Memento : Attaque et Attaque Spéciale -2, utilisateur K.O. ;
  vérifier un cas de protection aux baisses de statistiques.
- [ ] Vœu Soin puis Danse-Lune : remplaçant soigné des PV et du statut ;
  Danse-Lune restaure aussi les PP, Vœu Soin ne les restaure pas.
- [ ] Requiem : décompte visible sur tous les actifs éligibles, abri de
  Soundproof et K.O. simultanés ; refaire en double puis après reconnexion.
- [ ] Grudge/Prélèvement Destin : un coup adverse mettant K.O. le lanceur
  vide les PP du coup ou met K.O. l'attaquant, respectivement.
- [ ] Faux-Chage : laisser exactement 1 PV ; vérifier l'affichage des deux
  joueurs. Regard Noir : interdire le remplacement volontaire de la cible,
  puis autoriser après le retrait du lanceur.
- [ ] Relais puis Demi-Tour/Change Éclair : transfert des boosts, choix du
  remplaçant, rendu du Pokémon entrant chez l'hôte et l'invité ; contrôler
  l'état après reconnexion. En double, noter tout écart de cadence avec le
  jeu source (le choix actuel est présenté après le tour).

### Lot fuite sauvage et famille `0D` (2026-10-23)

À faire avec une rencontre sauvage puis un combat de Dresseur en solo,
et les mêmes essais en Coop avec hôte et invité inversés. Pour chaque
essai, observer le client distant et reconnecter un participant avant le
tour de résolution ou avant le soin différé. Noter toute différence de
cadence du remplacement forcé en double.

- [ ] Téléport dans une rencontre sauvage autorisant la fuite : retour
  à la carte, sans EXP ni perte d'argent ; vérifier les deux clients et
  l'état après reconnexion. Vérifier son échec contre Dresseur et quand
  la rencontre interdit la fuite.
- [ ] Hurlement/Cyclone puis Projection/Draco-Queue : fuite de cible
  sauvage de niveau inférieur/égal, échec si niveau supérieur ; contre
  Dresseur, choix de remplaçant adverse. Vérifier Suction Cups et
  Enracinement, puis un cas double avec la bonne cible distante.
- [ ] Tourbillon : dégâts, piège de 5–6 tours, retrait des PV et blocage
  du changement volontaire ; l'interaction avec Plongée restera à
  reprendre avec le lot `0C1`–`0CE`.
- [ ] Colère : 2–3 usages verrouillés, confusion à la fin ; Patience :
  accumulation de deux tours de dégâts directs, riposte doublée sur le
  dernier attaquant. Reconnecter pendant le verrouillage.
- [ ] Atterrissage : soin et retrait temporaire du type Vol en combat,
  type rétabli au tour suivant. Repos : sommeil et soin complet, refus si
  l'endormissement est interdit.
- [ ] Vœu : soin à la fin du tour suivant, y compris sur le remplaçant
  de la même position ; Anneau Hydro et Enracinement : soin répété,
  ce dernier interdit le changement volontaire et le renvoi.
- [ ] Dévorêve : échec sur cible éveillée, dégâts et soin sur cible
  endormie ; Vibra Soin : soin de la cible, y compris un allié en double.

### Charge et recharge `0C2`–`0C8` (à exécuter)

- [ ] En solo, Hiperrayo ou Giga Impacto qui touche impose un tour de
  recharge sans nouveau PP ; vérifier qu'un échec ou une immunité ne
  déclenche pas la recharge.
- [ ] Tester Rayo Solar/Cuchilla Solar sous soleil (immédiat, Power Herb
  conservée), puis sous autre météo (charge et puissance réduite).
- [ ] Tester Cabezazo : Défense +1 pendant la charge, une seule fois ;
  vérifier qu'une Power Herb permet charge et attaque dans le même tour.
- [ ] Tester les effets secondaires de `0C5`/`0C6`/`0C7` si ces attaques
  sont accessibles dans la sauvegarde de test ; sinon noter « bloqué ».
- [ ] Refaire charge/recharge en Coop hôte puis invité, avec observation
  distante, et reconnecter le participant entre les deux tours : même
  verrouillage, même PP, même objet consommé et même résultat.

### Beat Up, semi-invulnérabilité et Sky Drop `0C1`, `0C9`–`0CE` (à exécuter)

- [ ] Beat Up : comparer nombre de coups et puissance avec équipiers
  indemnes, empoisonnés et K.O. ; refaire avec un allié actif en double.
- [ ] Vol, Creusement, Plongée, Rebond et Shadow Force : premier tour de
  charge sans dégâts, esquive d'une attaque ordinaire, second tour forcé
  sans nouveau PP ; essayer Power Herb, sommeil/interruption et reconnexion.
- [ ] Vérifier les exceptions source : Rafale sur une cible en vol,
  Tourbillon sur Plongée, Magnitude sur Creusement ; vérifier le
  doublement de puissance, et Shadow Force à travers Protection.
- [ ] Sky Drop : la cible ne joue ni pendant l'enlèvement ni après sa
  libération au second tour ; tester type Vol/Lévitation, cible lourde,
  K.O. du porteur et une cible positionnée en double. Reconnecter les
  deux clients entre enlèvement et libération et comparer le rendu distant.
- [ ] Refaire une charge aérienne avec Gravité déjà active si une capacité
  de Gravité est disponible ; sinon marquer « bloqué » (pose de Gravité
  non encore portée dans le moteur).

### Terrain, ciblage et gardes `075`, `076`, `078`, `0A4`, `0A6`, `0A8`, `0A9`, `0AB`, `0AC`, `0AE` (à exécuter)

- [ ] En solo, vérifier Surf sur Plongée, Séisme sur Creusement et Twister
  sur Vol/Rebond : coup malgré la semi-invulnérabilité et dégâts accrus.
  Refaire Séisme sous Champ Herbu : dégâts réduits.
- [ ] Tester Secret Power sur plusieurs terrains (électrique, herbu,
  brumeux) et environnements accessibles : effet secondaire, message,
  animation et fallback si l'animation spécifique manque.
- [ ] Verrouiller une cible avec Lock-On, puis employer une attaque peu
  précise au tour suivant ; reconnecter entre les deux tours. Vérifier
  Miracle Eye sur Ténèbres et `0A9` face aux hausses de Défense/esquive.
- [ ] En double, Quick Guard doit protéger le partenaire d'une attaque
  prioritaire, Wide Guard d'une attaque de zone, puis expirer au tour
  suivant. Refaire en hôte puis invité, observer le rendu distant.
- [ ] Mirror Move : copier une capacité admissible, refuser une capacité
  non copiable, vérifier PP propre, cibles multiples et attaque à deux
  tours copiée. Reconnecter pendant la charge et comparer les deux vues.

## Contraintes et renvoi `0B1`, `0B7`, `0B8`, `0BB` (à exécuter)

- [ ] En solo, utiliser Magic Coat avant une capacité de statut réfléchissable :
  elle doit revenir au lanceur et ne pas être réfléchie en boucle. Refaire
  avec une capacité non réfléchissable, puis au tour suivant.
- [ ] Appliquer Torment : la dernière capacité ne doit pas être répétable,
  une autre reste possible ; une capacité à deux tours ne doit pas être
  interrompue entre sa charge et son impact.
- [ ] En double, Imprison doit verrouiller une capacité commune chez les
  deux adversaires, mais non chez son partenaire ; vérifier la fin au switch.
- [ ] Appliquer Heal Block avant un soin direct, Anneau Hydro, Racines et
  Vœu ; aucun soin ne doit passer avant expiration. Vérifier le retour du
  soin et le compteur de tours après reconnexion.
- [ ] Refaire ces cas comme hôte puis invité, comparer le rendu distant
  et reconnecter chaque client pendant l'effet actif. Consigner tout KO,
  animation absente ou message incohérent ci-dessous.

## Capacités appelées `0AF`, `0B0`, `0B2`, `0B4`, `0B5` (à exécuter)

- [ ] Copycat après une capacité adverse, puis après une capacité alliée :
  vérifier la dernière capacité globale, les PP et le ciblage en double.
  Reconnecter avant le tour de Copycat.
- [ ] Me First avant et après la cible : copie seulement si la cible n'a
  pas agi, dégâts majorés ; vérifier une attaque copiée à deux tours
  après reconnexion entre charge et impact.
- [ ] Snatch avant une hausse de statistiques, un soin et une garde
  d'équipe marqués `d` : effet reçu par le guetteur, pas l'utilisateur.
  Vérifier deux guetteurs adverses en double et l'expiration en fin de tour.
- [ ] Sleep Talk endormi puis réveillé : tirage admissible, PP correct,
  message et animation ; Assist avec un partenaire actif puis un membre
  de réserve K.O. Faire chaque cas comme hôte puis invité et comparer
  le rendu distant après reconnexion.
- [ ] Metronome `0B6` : **ne pas encore valider** ; la mécanique reste
  non portée tant que le catalogue complet n'est pas autoritaire en Coop.

## Fonctions `0BF`, `10A`, `122`, `144`, `019`, `112`–`114`, `140` (à exécuter)

- [ ] Triple Pied : vérifier trois impacts croissants et l'arrêt à la première
  frappe manquée ; Casse-Brique : dégâts identiques avec/sans écrans et
  disparition de Protection/Mur Lumière après impact.
- [ ] Choc Psy : comparer un adversaire à Défense faible et Défense Spéciale
  forte ; Flying Press : tester une cible Plante, puis une cible après
  Lilliput (précision et dégâts).
- [ ] Stockpile trois fois, puis Avale à PV entamés ; recommencer avec
  Relâche. Vérifier compteurs, défenses et leur retour à zéro après
  utilisation et après reconnexion.
- [ ] Aromathérapie/Glas de Soin : empoisonner le lanceur, son partenaire
  actif en Duo et une réserve ; vérifier chaque guérison en solo, côté
  hôte, côté invité, puis après reconnexion. Essayer un partenaire dont le
  talent immunise au type Plante et signaler tout écart.
- [ ] Dernier Recours : échoue avant les autres capacités connues puis
  touche après leur usage ; Venom Drench : seul l'adversaire empoisonné
  perd Attaque, Attaque Spéciale et Vitesse, y compris en Duo.
- [ ] Pour chaque cas, comparer les deux clients Coop, le rendu du joueur
  distant, puis restaurer la room et constater le même état.

## Fonctions `002`, `00B`, `00D`, `00E`, `011`, `014`, `015`, `018`, `01A`, `01B` (à exécuter)

- [ ] À zéro PP, Lutte doit pouvoir toucher un Spectre, sans bonus de type,
  puis retirer un quart des PV maximum du lanceur après impact.
- [ ] Crocs de Feu/Glace : vérifier séparément brûlure/gel et apeurement ;
  tester un adversaire immunisé au statut puis un talent empêchant
  l'apeurement.
- [ ] Blizzard sous grêle ; Vent Violent sous pluie puis soleil : comparer
  précision et confusion. Ronflement doit échouer éveillé, attaquer
  endormi ; Babil doit pouvoir confondre après son impact.
- [ ] Refresh guérit brûlure, poison ou paralysie et échoue sans statut
  compatible. Voile Sacré protège le camp, refuse un second lancement
  et expire après cinq tours. Psycho Shift transfère un statut valide,
  mais le conserve si la cible est immunisée ou déjà affectée.
- [ ] Répéter en solo, comme hôte puis invité Coop ; comparer le rendu
  distant, reconnecter chaque client puis restaurer la room pendant
  Voile Sacré. Consigner les écarts visuels et les animations fallback.

## Fonctions `0FF`–`105`, `118`, `119`, `11F` (à exécuter)

- [ ] Poser soleil/pluie/sable/grêle, vérifier cinq tours puis huit avec
  la roche dédiée ; vérifier qu'un climat extrême refuse le remplacement.
- [ ] Empiler trois couches de Picots et deux de Pics Toxik, puis changer
  vers un Pokémon au sol, volant, avec Grosses Bottes et de type Poison.
  Vérifier les dégâts, l'empoisonnement et l'absorption. Tester Piège de
  Roc sur plusieurs sensibilités au type Roche et un KO à l'entrée.
- [ ] En Duo, renvoyer des pièges avec Miroir Magik sur le second
  adversaire ; vérifier les deux emplacements et un remplacement imposé
  qui tombe aussitôt sur les pièges. La demande du slot doit persister ;
  noter explicitement l'absence connue d'événement narratif de dégâts
  pendant ce remplacement imposé.
- [ ] Activer Vol Magnétik puis une attaque Sol ; activer Gravité, vérifier
  l'atterrissage, la nouvelle précision et l'attaque Sol. Activer puis
  désactiver Distorsion et comparer l'ordre de deux Vitesse distinctes.
- [ ] Répéter solo, hôte et invité ; comparer les PV/effets affichés aux
  deux clients, déconnecter/reconnecter puis redémarrer la room pendant
  un piège ou un effet de terrain. Noter les animations en fallback.

## Fonctions `11A`–`11C`, `124`, `153`–`156`, `905`, `927` (à exécuter)

- [ ] Télékinésie sur une cible au sol : vérifier trois tours, précision
  garantie et immunité au Sol ; activer Gravité puis vérifier la chute.
  Uppercut doit toucher un adversaire en Vol/Bond ; Anti-Air ou Mille
  Flèches doit l'atteindre puis le rendre vulnérable au Sol.
- [ ] Zone Étrange : comparer une attaque physique sur une cible à
  Défense et Défense Spéciale différentes, puis couper l'effet au second
  lancement. Vérifier son expiration après cinq tours.
- [ ] Toile Gluante : entrant au sol, volant, avec Grosses Bottes et
  talent Contestation/Clear Body ; vérifier Vitesse et annonces en Duo.
- [ ] Poser successivement les quatre champs, vérifier leur remplacement
  et expiration. Tester soin sous Champ Herbu, sommeil/statut sous champs
  Électrik/Brumeux, puis une attaque prioritaire sous Champ Psychique.
- [ ] Voile Aurore : échec sans grêle, deux écrans actifs sous grêle ;
  comparer les dégâts physiques/spéciaux et le compte de tours.
- [ ] Répéter les cas pertinents en solo, comme hôte puis invité Coop ;
  comparer le rendu distant, reconnecter les deux clients et redémarrer
  la room pendant un effet actif. Noter toute animation en fallback.

## Fonctions `121`, `123`, `135`, `13A`, `13C`, `13D`, `142`, `143`, `902`, `904` (à exécuter)

- [ ] Jeu Déloyal : comparer deux adversaires de même Défense mais
  d'Attaque faible/forte, puis modifier leurs stades d'Attaque.
  Synchronoise : attaquer en simple et Duo des cibles qui partagent ou
  non un type avec le lanceur ; vérifier chaque cible séparément.
- [ ] Liofilisation : comparer une cible Eau et une cible neutre,
  puis vérifier le gel éventuel et les immunités au statut.
- [ ] Rugissement de Guerre, Confidence, Onde Anormale : comparer les
  stades d'Attaque/Attaque Spéciale, les protections, Anti-Bruit et
  une immunité Électrik sur Onde Anormale.
- [ ] Halloween puis Malédiction Sylvestre : vérifier l'ajout puis le
  remplacement du troisième type et le retour aux types initiaux au
  changement. Poudre Magique doit rendre la cible **Psy** et échouer
  sur un Pokémon déjà exclusivement Psy.
- [ ] Absorbeforce : vérifier soin avant baisse de l'Attaque adverse,
  bonus Grosse Racine, Bloc Soin et dégâts sous Suintement.
- [ ] Répéter comme hôte puis invité, comparer le rendu distant et
  les événements de type/stade/PV ; reconnecter et redémarrer la room
  avec un type temporaire et une baisse d'Attaque encore actifs.

## Lot offensif `175`–`942` — à exécuter

- [ ] En solo, comparer Corps Perdu avec Défense faible/forte ; Fil Toxique
  contre une cible immunisée au poison puis non immunisée ; Bolt Beak
  avant/après l'action adverse ; Garra Nociva sur plusieurs essais.
- [ ] En solo, activer Champ Électrifié/Psychique/Herbu : contrôler la
  puissance de Rising Voltage/Expanding Force et la priorité de Grassy
  Glide. Vérifier le coût de Metaláser avec/sans Garde Magik, puis les
  trois impacts critiques d'Azote Torrencial à travers Abri.
- [ ] En Duo, confirmer que Vaste Force touche les deux adversaires
  seulement sous Champ Psychique et que Make It Rain baisse l'Attaque
  Spéciale et produit des pièces pour chaque cible effectivement touchée.
- [ ] Gagner puis perdre un combat avec Pay Day/Make It Rain : contrôler
  la somme d'argent, son plafond et l'absence de gain à la défaite.
  Répéter comme hôte puis invité ; vérifier le règlement privé, le rendu
  distant et la même récompense après reconnexion et redémarrage de room.

## Lot offensif `204`–`938` — à exécuter

- [ ] En solo, faire échouer Poltergeist sans objet, sous Embargo, sous
  Champ Magique et avec Maladresse, puis vérifier qu'il touche une cible
  portant un objet actif.
- [ ] Comparer la priorité de Bruma Explosiva sur Champ Brumeux et sur
  les autres champs. Avec Pirueta Helada, contrôler la disparition du
  champ seulement après un coup réussi.
- [ ] Comparer les dégâts de Sable Ardiente sur cible normale/brûlée/
  paralysée, puis Infernal Parade et Barb Barrage avec/sans le statut
  requis ; vérifier brûlure/poison secondaires et leurs immunités.
- [ ] En Duo, faire poser Piège de Roc par Stone Axe puis changer un
  Pokémon adverse ; vérifier le camp touché, un seul piège actif et les
  événements reçus par les deux joueurs.
- [ ] Tester Triple Arrows sur plusieurs coups : baisse de Défense et
  peur peuvent se produire séparément. Tester Fickle Beam sur plusieurs
  coups pour voir les deux puissances ; comparer la trace de l'hôte.
- [ ] Avec Jaw Lock, tenter un changement volontaire des deux côtés,
  puis essayer une cible Spectre et un piège déjà actif. Refaire comme
  hôte et invité ; reconnecter et redémarrer la room pendant que le
  piège ou les rocs sont encore actifs, puis vérifier le rendu distant.

## Lot `10F`–`CF14` — à exécuter

- [ ] Endormir une cible, appliquer Nightmare, vérifier la perte d'un
  quart des PV en fin de tour, son arrêt au réveil/retrait et Garde
  Magik. Refaire comme invité ; comparer le texte et les PV chez l'hôte,
  puis après reconnexion et redémarrage de la room.
- [ ] Faire achever une cible par Fell Stinger puis comparer l'Attaque
  gagnée au cas où la cible survit. Tester Escaramuza à l'entrée, après
  un autre mouvement et après un changement normal sans action préalable.
- [ ] Tester Parting Shot avec et sans remplaçant, sous Anti-Bruit et
  Miroir Magik ; vérifier les deux baisses et le choix de remplacement
  personnel en solo, hôte et invité.
- [ ] Vérifier que CargaGresion augmente la Défense Spéciale et que le
  prochain coup Électrik profite de Charge. Atrapamoscas et Disparo
  Espina doivent infliger leurs seuls dégâts standard.
- [ ] En simple et Duo, poser Ceaseless Edge/Georrafaga jusqu'à trois
  couches de Picots, puis utiliser Mortal Spin sur une ou deux cibles.
  Vérifier poison, retrait des pièges/Vampigraine/entrave de son propre
  camp et nettoyage même si la cible tombe K.O.
- [ ] Tearful Look doit baisser Attaque et Attaque Spéciale malgré une
  esquive adverse élevée ; contrôler le rendu des deux changements de
  cran chez les participants.

## Lot `115`–`937` — à exécuter

- [ ] En simple, vérifier que Focus Punch échoue après avoir reçu des
  dégâts dans le tour et réussit sans dégâts. Comparer la perte de PP.
- [ ] En Duo, cibler l'allié derrière Follow Me puis Rage Powder ;
  vérifier la redirection, l'immunité Plante/Overcoat/Safety Goggles au
  pollen et la dernière activation lorsque les deux alliés l'utilisent.
- [ ] En Duo, faire agir After You sur un allié lent, puis Quash sur un
  adversaire rapide ; vérifier l'ordre visible chez hôte et invité.
  Tester Ally Switch avant une attaque ciblée et après reconnexion.
- [ ] Comparer Dragon Darts en simple et Duo : deux coups au total, un
  sur chaque adversaire vivant en Duo, dégâts et animations cohérents.
- [ ] Bloquer une attaque de contact avec Baneful Bunker : aucun dégât
  reçu, attaquant empoisonné si vulnérable. Vérifier l'échec si personne
  ne peut encore agir et les usages consécutifs.
- [ ] Tester Meteor Beam, Lanza Relampago et Electro Shot sans objet,
  avec Power Herb et Electro Shot sous pluie : statistique gagnée une
  seule fois, PP consommé une seule fois, dégâts au bon tour. Refaire
  comme hôte et invité ; reconnecter/redémarrer la room pendant la
  charge et comparer l'état et le rendu distant.

## Lot Pledge, boucliers et Truco Huevo — à exécuter

- [ ] En simple, vérifier Dragon Hammer, les trois Pledge isolés et
  Belch (`162`) ; vérifier séparément que Dulce Festín (`158`) échoue
  avant une baie mangée et réussit après, sans perdre le drapeau lors
  d'une reconnexion. Noter l'écart de codes entre PBS et script Ruby.
- [ ] En Duo, jouer les trois paires de Pledge dans les deux ordres.
  Vérifier la file d'actions, les PP, le type et les dégâts du coup
  combiné, puis Mer de flammes, Marécage et Arc-en-ciel sur plusieurs
  tours chez l'hôte et l'invité, y compris après reconnexion.
- [ ] Vérifier King's Shield contre attaque de contact et capacité de
  statut, puis Spiky Shield contre contact et attaquant Garde Magik.
  Répéter les protections plusieurs tours pour contrôler le taux de
  réussite et le rendu distant.
- [ ] Utiliser Truco Huevo plusieurs fois pour voir ses mouvements
  appelés, notamment Agilité, Burbuja en Duo, Viraje et Future Sight.
  Vérifier l'absence de PP supplémentaire et l'animation correspondant
  au tirage réel ; pour Future Sight, changer la cible de place puis
  reconnecter/redémarrer la room avant le coup différé.

## Lot des sept dernières fonctions — à exécuter

- [ ] Utiliser Metronome plusieurs fois en solo, puis comme hôte et
  invité Coop. Comparer mouvement tiré, PP consommés, cible et animation
  affichée. Vérifier un mouvement appelé à charge, puis reconnecter la
  room entre les deux tours.
- [ ] Créer un Substitute avec plus d'un quart des PV, puis tenter une
  attaque, un statut, un mouvement sonore, Infiltrator et une capacité à
  plusieurs coups. Vérifier les PV du bouclier, sa disparition, Relais,
  puis reconnexion/redémarrage côté hôte et invité.
- [ ] Vérifier Burn Up/Electropalmas/Baguetazo avec et sans type requis :
  dégâts, retrait du type même sur esquive, refus du second usage et
  forme de Sirfetch'd après Baguetazo. Contrôler retrait/remplacement,
  sauvegarde et rendu distant.
- [ ] Vérifier Condena de Mago sur cible ordinaire, Feu pur, Multitype
  et Substitute ; comparer type, messages et rendu chez les participants.
- [ ] Comparer Petromazazo contre une cible faible et résistante au type
  Plante à efficacité Roche équivalente ; vérifier le multiplicateur.
- [ ] Utiliser Eclipse avec Attaque supérieure, puis Attaque Spéciale
  supérieure ; vérifier catégorie, dégâts, alternance de forme et
  statistiques de Constellar, sauvegarde et reconnexion Coop.
- [ ] Tenter Corazón Roto au-dessus puis au-dessous d'un quart des PV,
  contre cible de niveau supérieur, Fermeté, puis Brise Moule. Vérifier
  précision, K.O. et état distant.

## Observations à reporter


Pour chaque case testée, noter : date, solo/hôte/invité, combat et Pokémon
utilisés, capacité, tour, résultat **OK / KO / bloqué / non concluant**,
résultat attendu vs observé, et si possible capture d'écran ou court extrait
de journal. Ne pas inclure `.pokemon-z/`, les fichiers du jeu source ou une
sauvegarde personnelle dans Git. Un défaut visuel ou de synchronisation doit
rester ouvert même si le calcul des dégâts est correct.

Limites déjà connues, à ne pas confondre avec un nouveau défaut : les
interactions visuelles de Clonage restent à valider en jeu ; Bouclier Rusé
garde des raccords transverses ouverts ; l'interaction
Pirotecnia/Lien Parental requiert un audit source dédié ; les animations absentes
de `move2anim.dat`, dont `SMELLINGSALT`, utilisent un fallback explicite, jamais
une animation inventée.
