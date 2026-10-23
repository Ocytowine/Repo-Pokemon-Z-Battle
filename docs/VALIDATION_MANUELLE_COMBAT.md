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

`096` (Don Naturel) et `0F9` (Champ Magique) ne sont pas encore à cocher
manuellement : les 64 baies source sont transportées et le champ fonctionne
dans les tests du noyau/room, mais les deux fonctions restent `partial` et ne
sont pas proposées aux équipes source. Attendre la fermeture des effets
automatiques des baies, des interactions d'objets et de la consommation Ruby
avant d'ajouter leur recette en jeu.

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

## Observations à reporter

Pour chaque case testée, noter : date, solo/hôte/invité, combat et Pokémon
utilisés, capacité, tour, résultat **OK / KO / bloqué / non concluant**,
résultat attendu vs observé, et si possible capture d'écran ou court extrait
de journal. Ne pas inclure `.pokemon-z/`, les fichiers du jeu source ou une
sauvegarde personnelle dans Git. Un défaut visuel ou de synchronisation doit
rester ouvert même si le calcul des dégâts est correct.

Limites déjà connues, à ne pas confondre avec un nouveau défaut : Clonage et
Bouclier Rusé n'ont pas encore tous leurs raccords transverses ; l'interaction
Pirotecnia/Lien Parental requiert un audit source dédié ; les animations absentes
de `move2anim.dat`, dont `SMELLINGSALT`, utilisent un fallback explicite, jamais
une animation inventée.
