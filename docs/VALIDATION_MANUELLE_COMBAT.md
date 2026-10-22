# Validation manuelle des fonctions de combat

État au 2026-10-22 : **à exécuter par le porteur du projet**. Les tests automatisés et
le build passent, mais ils ne remplacent pas la vérification visuelle en jeu.
Cette fiche couvre les fonctions récemment portées `05C`-`05F`, `071`-`074`,
`079` et `07A`. Ajouter ici les prochains lots avant de demander une validation
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
de `move2anim.dat` utilisent un fallback explicite, jamais une animation inventée.
