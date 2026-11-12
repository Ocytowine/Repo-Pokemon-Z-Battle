# Audit narratif carte par carte

## État du 12 novembre 2026

Un premier balayage statique des données locales couvre **507 cartes, 12 070
événements et 18 737 pages**. La feuille
[`NARRATIVE_MAP_AUDIT.csv`](NARRATIVE_MAP_AUDIT.csv) donne une ligne par carte :
nombre d'événements, de pages avec dialogue, d'automatismes, de parallèles,
de commandes par famille (état, mouvement, audio, visuel, gameplay),
de transferts, puis candidats bloquants. Ces compteurs incluent les événements
communs une fois dépliés sur chaque page qui les appelle. Le détail par événement, page,
coordonnées et commande reste dans `.pokemon-z/data/narrative-audit.json`,
ignoré par Git. Régénérer les deux rapports avec `corepack pnpm audit:narrative`
après `corepack pnpm prepare:local` si les données source changent.

**Ce rapport repère des risques, pas 5 069 bugs confirmés.** Il inspecte toutes
les pages, y compris des branches inaccessibles selon la progression, et déplie
les événements communs. Une commande peut aussi être absorbée par un service
spécialisé. La validation d'une carte exige ensuite une trace d'exécution et
des essais sur la première visite, au retour et après reprise de sauvegarde.

| Résultat statique | Occurrences | Formes distinctes / portée |
| --- | ---: | --- |
| Scripts Ruby sans conversion générique | 3 221 | 477 textes distincts, dont 751 occurrences dans des pages automatiques |
| Conditions Ruby sans évaluation connue | 809 | 133 textes distincts, dont 357 occurrences dans des pages automatiques |
| Commandes source hors registre/flux exécuté | 1 034 | `change-transparency` 598, `exit-event` 333, commentaires 99, `change-menu-access` 2, `number-input` 2 |
| Routes signalées non exécutables | 4 | Map069 : EV017, EV018, EV032 et EV033 ; vérifier les pas précis |
| Cible de route absente | 1 | Map101 EV004 vise EV009 ; inspecter la référence source |

**307 cartes P0** contiennent au moins une de ces anomalies candidates dans
une page automatique, parallèle ou avec dialogue ; **8 P1** contiennent des
candidats dans d'autres pages ; **192 P2** n'en montrent pas avec ces règles.
Ce classement ordonne l'enquête, sans juger une carte P2 entièrement fidèle.
Les nombres de l'extraction (`converted` 90,51 %) mesurent la normalisation des
commandes, pas leur exécution : `ruby-script` reste `reference-only` à ce stade.

## Piste sur les dialogues tardifs et les positions erronées

`resolveEventFlow` prépare le parcours de la page avant le début de la scène.
Si une condition ou une commande du parcours n'est pas portée, il refuse le
départ de **toute la séquence**, même lorsqu'un dialogue précède le point
bloquant. `beginSourceSequence` affiche alors un avis de blocage. À l'entrée
d'une carte, `beginPendingSourceMapEntryAutorun` efface en outre l'attente
avant de tenter l'automatisme ; un départ refusé n'est pas remis en attente.
Une visite ultérieure réévalue la page, cette fois avec un autre état ou depuis
une autre case. Cette combinaison est une **explication plausible** du retour
signalé ; il faut la relier à une carte et une sauvegarde précises avant de
conclure à une cause unique.

Exemple source vérifié : **Map003, Bourg Canvas, EV008 à EV011**. Leur page
automatique conditionnée par le switch 127 teste
`get_character(0).onEvent?`, change deux fois la transparence du joueur,
déplace les acteurs et appelle `setTempSwitchOn("A")`. Les trois familles
non reconnues apparaissent ensemble dans le rapport. Le même motif existe
sur d'autres seuils. Il doit être porté comme comportement générique de
position/contact, visibilité et interrupteur temporaire ; aucun correctif
ne doit cibler les quatre numéros d'événement.

La **Map018, Centre Pokémon**, présente notamment un automatisme EV010 avec
plusieurs scripts Ruby non portés ; les services EV022 et EV023 comportent
aussi des scripts et conditions spécialisés. Le vieux rapport
[`Bug narration.md`](Débug/Bug/Bug%20narration.md) mentionne EV014 et une
séquence Team Azoth, mais l'EV014 de l'extraction actuelle ne contient que
deux textes puis `end`. Il faut donc retrouver la carte et la sauvegarde de
cette observation avant de lui attribuer un défaut du moteur.

La **Map024, Nouvelle Réunion** compte 63 appels Ruby non convertis, 60
conditions Ruby non reconnues et 17 commandes hors registre dans l'ensemble
de ses pages. Plusieurs parcours de succès ont déjà été portés séparément ;
les chiffres doivent être confrontés aux pages effectivement actives.

### Cas signalé par le porteur : Map283, La Frescale

Le porteur confirme que le dialogue tardif est la scène **Mélia et Crisanto**.
La carte contient 50 événements et 95 pages. EV032 (27,46) lance le premier
grand dialogue lorsque la variable 194 vaut au moins 3, mais sa seconde page
neutre prend le relais à partir de 5 : la fenêtre d'activation est donc 3–4.
EV037 (26,24) lance une autre scène à partir de 10, jusqu'au switch 516.
Les deux pages contiennent de longues routes ; EV032 déplace ensuite le joueur
vers (31,45), EV037 vers (22,31). Un démarrage en retard change le sens de ces
routes et du cadrage. Leurs appels `$GameSpeed = 0`, gestion du suiveur et cri
de Floette sont reconnus par le port actuel : l'audit statique ne relève pas
de commande inconnue dans ces deux scènes elles-mêmes.

La carte a toutefois un automatisme d'ambiance EV006, puis cinq automatismes
de porte EV011–EV015 avant EV032 et EV037 dans l'ordre des identifiants. Leur
page haute est active si le switch 127 est vrai ; elle commence par
`get_character(0).onEvent?`, une condition non portée. Elle comporte ensuite
`change-transparency` et `setTempSwitchOn("A")`, également absents du flux.
`findSourceMapEntryAutorun` choisit le **premier** automatisme actif. Après
l'effacement temporaire d'EV006, une de ces portes peut donc être sélectionnée
avant la scène Mélia/Crisanto. `resolveEventFlow` refuse son départ, puis
`beginPendingSourceMapEntryAutorun` a déjà effacé l'attente. **Cette chaîne
explique le symptôme si le switch 127 était actif** au moment de l'entrée ;
la valeur réelle de ce switch dans la sauvegarde du porteur reste à vérifier.
Il faut aussi confirmer si l'épisode observé correspond à EV032 ou EV037.

Premier correctif moteur du 2026-11-12 : l'entrée Map285/EV026 fixe la variable
194 à 4 puis transfère vers Map283 (32,45), ce qui rend EV032 éligible dès
l'arrivée. La demande de lancement est maintenant reprise par la boucle de
l'overworld lorsque le mouvement, le dialogue ou la transition libère la scène.
Elle est évaluée avant de reprendre un déplacement maintenu. Le test reproduit
une demande d'entrée reçue pendant que la scène est occupée, suivie du départ
d'EV032 lorsque celle-ci devient libre. Cela corrige une famille de départs
manqués, sans encore prouver que c'était la seule cause du cas du porteur.
Le switch 127 est un switch ordinaire « NO TOCAR » dans System.rxdata ; sa
valeur dans la sauvegarde concernée n'est pas connue. Les portes restent un
risque distinct si ce switch est actif. La recette du premier passage réel
sur téléphone, du retour et de la Coop reste ouverte.

Précision du porteur lors d'une tentative de reproduction : après l'entrée au
moulin et le combat contre Tyrazilla, la séquence conduit dans la salle
principale ; une avance du joueur déclenche des dialogues et déplacements
dirigés avec Mélia, Christian/Crisanto et Aster. Le contrôle revient ensuite
au joueur, qui doit gagner le toit du moulin. Lors de cette tentative, tous
les dialogues et mouvements se sont déroulés normalement. Le défaut initial
est donc intermittent ou dépend d'un état/tempo non encore identifié ; cette
réussite ne valide pas le correctif non installé sur cette version. Les données
source montrent la sortie de Map285/EV026 vers Map283 (32,45), puis la page
EV032, avant les accès au moulin Map286. Pour la prochaine reproduction,
contrôler la valeur 194 et le premier autorun sélectionné à l'arrivée, puis
noter la case où le contrôle revient au joueur.

Recette sur l'APK locale corrigée : le porteur confirme que tout le parcours
après Tyrazilla se déroule correctement, avec dialogues, déplacements et
positions des personnages. La traversée solo observée est validée. Ce retour
ne démontre pas la cause de l'échec initial intermittent ; la branche des
portes, le rechargement et la Coop restent à vérifier.

Statut actuel du cas Map283/EV032 : **clos pour le parcours solo signalé**.
Le porteur a répété les essais sur l'APK locale corrigée sans retrouver le
défaut ; l'enchaînement, les mouvements et les positions sont corrects.
Cette clôture porte sur l'observation fonctionnelle et n'attribue pas avec
certitude la cause initiale à un seul mécanisme. Les portes conditionnelles,
les autres cartes et les parcours Coop restent des sujets de BZ-035.

La correction envisagée est générique : évaluer la position de l'événement
dans la condition, porter la transparence et le switch temporaire, puis
faire poursuivre l'ordonnanceur vers l'automatisme suivant lorsque la page
active est sans effet pour la position actuelle. La scène doit démarrer avant
que le joueur puisse quitter la case d'entrée, avec le même ordre en solo et
pour l'hôte Coop ; l'invité ne reçoit que la présentation de la narration.

## Ordre de contrôle fonctionnel

1. **Trace générique de décision** : noter carte, position du joueur, event et
   page active, déclencheur, conditions vraies/fausses, motif de refus, route
   programmée, position finale et mutations de switches. Une tentative
   d'automatisme refusée doit rester visible dans la trace après changement
   d'état et transfert ; aucun dialogue ne doit apparaître hors de son contexte.
2. **Contrat des commandes récurrentes** : reproduire les seuils et porter les
   familles `get_character(0).onEvent?`, transparence, switch temporaire et
   `exit-event` dans le moteur et le registre. Chaque famille doit passer par
   l'audit de scène et servir au solo, à l'hôte et à l'invité selon son audience.
3. **Premier parcours narratif** : contrôler carte par carte les Maps 001 à 030
   selon le chemin réel du joueur, pas seulement leur numéro. Pour chaque
   transfert, comparer la case d'arrivée et l'automatisme activé, puis refaire
   le trajet après sauvegarde, sortie et retour.
4. **Grands nœuds et motifs répétés** : Map024 et ses services/succès ; Map069
   pour les quatre routes ; Map101 pour sa cible ; puis les mêmes familles sur
   les autres cartes. La Map321 concentre 1 482 scripts non convertis, souvent
   répétés : regrouper par signature avant toute estimation du travail.
5. **Validation globale** : première visite, visite répétée, carte rechargée,
   hôte, invité présent, invité en excursion, rendu distant et reconnexion.
   Une carte n'est cochée que lorsque ses pages atteignables et ses effets
   narratifs, visuels et sonores ont été vus dans ces situations pertinentes.

Pour chaque anomalie, garder l'identifiant `MapXXX/EVYYY/page N`, la case
d'entrée, la sauvegarde utilisée, le résultat attendu dans le jeu d'origine,
le résultat observé dans l'app et une trace courte. Le portage doit résoudre
la famille de commandes avant de cocher les cartes qui l'emploient.
