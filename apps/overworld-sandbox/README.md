# Overworld Sandbox

Prototype Canvas des phases 7 à 9. Le mode de démonstration utilise le même moteur
de grille en local et côté serveur. Le mode **Bourg Canvas** charge automatiquement
la première vraie carte, son tileset, ses autotiles animés et ses collisions depuis
la copie locale de Pokémon Z ; aucun de ces fichiers n'est ajouté au dépôt.

## Test local

```powershell
corepack pnpm prepare:local
corepack pnpm sandbox:overworld
```

Ouvrez `http://127.0.0.1:5174`. Bourg Canvas est sélectionnée automatiquement si
les données locales sont prêtes. Les flèches ou ZQSD contrôlent le joueur 1 ;
IJKL contrôle le joueur 2. Espace fait interagir le joueur 1 et O le joueur 2.

Dans Bourg Canvas, seul le joueur 1 est actif. Son sprite et les personnages visibles
proviennent du jeu source ; leurs cases bloquent le passage. La position initiale
fait face à un PNJ : appuyez sur **Espace** pour parcourir son dialogue importé.
Les textes espagnols sont recomposés si nécessaire puis traduits avec la table
française extraite de `Data/french.dat`. Les dialogues et transferts directs de la
page active sont exécutés. Les conditions simples de page (interrupteurs, variables
et self-switches) sont évaluées ; leurs mutations sûres sont mémorisées dans le
navigateur à la fermeture du dialogue. Les choix, y compris imbriqués, affichent
uniquement la branche sélectionnée. Un script ou une commande de gameplay arrête
encore volontairement l'événement sans enregistrer d'état partiel. Les contours jaunes
signalent les origines de transfert. Les onglets
**Prairie** et **Bosquet** conservent toute la recette coop/multijoueur existante.

Les portes directes sont actives. Depuis la position initiale, avancez de six cases
vers la droite, d'une case vers le haut, puis encore vers le haut contre la porte :
le Laboratoire Flare (`Map005`) est chargé avec son propre décor, ses événements et
ses traductions. Redescendez sur la sortie pour revenir à Bourg Canvas.

Les grandes sorties nommées `size(w,h)` sont également actives lorsque leur page
est sans condition. Comme dans le script source, l'événement est ancré en bas à
gauche : la zone s'étend de `x` à `x+w-1` et de `y-h+1` à `y`. Toutes ses cases
sont désormais encadrées en jaune, au lieu de la seule ancre.

Le PNJ placé directement devant la position initiale permet de tester les choix :
parcourez son introduction, puis sélectionnez **Oui** ou **Non** avec la souris ou
les touches numériques. La branche « Non » se termine normalement. La branche
« Oui » ouvre son second choix, puis s'interrompt proprement si elle atteint le
script spécifique du défi Monotype, qui n'est pas encore porté.

Le premier lot de gameplay d'inventaire est également actif. Les appels source
qui donnent, stockent ou retirent un objet sont convertis en actions déclaratives
personnelles, sans exécuter Ruby. L'inventaire apparaît avec les noms français
dans le panneau moteur. Par exemple, l'événement 14 de Bourg Canvas en `(46,26)`
donne une **Baie Oran** puis passe sur sa page de dialogue suivante ; les événements
21 et 38 donnent respectivement une **Potion** et un **Repoussenlit**.

L'infirmière de Bourg Canvas en `(48,13)` enregistre maintenant un point de reprise
personnel dès l'interaction. Sa carte, la position et la direction sont conservées
dans le navigateur. Le bouton devient alors **Revenir au point de reprise**. Les
deux réponses de son dialogue fonctionnent ; l'intention de soin est reconnue,
et restaure réellement PV, statut et PP dès que l'équipe contient un Pokémon.

L'équipe persistante est reliée à l'overworld et commence volontairement vide.
Pour tester son attribution, cliquez sur **Tester les starters** : le sandbox charge
`Map002` devant le socle de Marisson. Appuyez sur **Espace**, choisissez **Sí**
(affiché **Oui** grâce aux données françaises) et terminez le
dialogue. Marisson niveau 5 apparaît alors dans le panneau avec ses capacités ;
les interrupteurs narratifs sont enregistrés et le combat source contre Keunotor
niveau 2 apparaît comme rencontre en attente. Les socles voisins attribuent de la
même façon Feunnec et Grenousse. Le combat n'est pas encore ouvert à l'écran : ce
prochain raccordement devra convertir les deux équipes pour le moteur, exécuter la
rencontre, puis réinjecter PV, statuts et PP dans la sauvegarde.

Au départ, le joueur 1 regarde une baie `PERSONAL` : appuyez sur Espace pour
l'ajouter uniquement à son inventaire. Le joueur 2 regarde le guide `SHARED` :
appuyez sur O pour afficher son dialogue une seule fois pour la session. Les
inventaires et drapeaux apparaissent au-dessus du journal d'événements.

## Test à deux navigateurs

Lancez d'abord le serveur dans un autre terminal :

```powershell
corepack pnpm multiplayer:dev
```

Dans une première page, gardez `http://127.0.0.1:8787` et cliquez sur **Créer**.
Copiez le code affiché dans une seconde page, puis cliquez sur **Rejoindre**.
Chaque page ne peut contrôler que l'avatar attribué. Les collisions, occupations
et transitions sont résolues par le serveur puis diffusées aux deux pages.

## Recette zones et reconnexion

1. Dans la seconde page, déplacez le joueur 2 vers le haut pour libérer le passage.
2. Dans la première page, avancez neuf fois vers la droite : le joueur 1 arrive
   dans le Bosquet Azur.
3. Rechargez cette première page. Le ticket, la place et le Bosquet doivent être
   restaurés automatiquement.
4. Arrêtez puis relancez `pnpm multiplayer:dev`. La page affiche les tentatives de
   reconnexion puis retrouve la room et les positions persistées.
5. Déplacez le joueur 1 vers la gauche : il doit revenir dans la prairie, preuve
   que le compteur de mouvements a lui aussi été restauré.

La reconnexion attend successivement 500 ms, 1 s, 2 s, 4 s puis au maximum 8 s.
Le bouton **Revenir au test local** annule les tentatives et supprime le ticket
mémorisé pour cet onglet.

## Recette combat depuis l'overworld

Cette recette nécessite le Worker et deux pages connectées à la même room.

1. Dans la page du joueur 1, déplacez-vous une fois vers la gauche.
2. Appuyez sur Espace : les herbes situées devant l'avatar déclenchent un Roucool
   sauvage et le panneau de combat apparaît.
3. Essayez de déplacer le joueur 2 : le serveur refuse le mouvement pendant la
   rencontre et sa page reste en observation.
4. Dans la page du joueur 1, choisissez les capacités jusqu'à la fin du combat.
5. Le panneau disparaît, les déplacements redeviennent disponibles et le dernier
   résultat apparaît dans la section `Combat` du journal moteur.

Une dresseuse originale est également placée dans le Bosquet Azur. Ces rencontres
de démonstration n'utilisent encore ni carte ni événement du fangame.

## Guide des politiques coop

Le panneau **Parcours coop** affiche chaque interaction avec sa politique, sa zone
et son état courant : disponible, terminée, progression personnelle ou joueurs en
attente. La stèle du Bosquet est `SYNCED` : placez un avatar en `(4,4)` face à
droite et l'autre en `(6,4)` face à gauche, puis interagissez depuis les deux pages.
Après le premier joueur, le panneau indique `1/2 en attente`. Cet état est conservé
si sa page est rechargée avant l'interaction du second joueur.

Le levier de la prairie est `HOST_ONLY` : seul le joueur 1 peut activer son drapeau.
La baie est `PERSONAL` et reste récupérable séparément par les deux joueurs, tandis
que le guide est `SHARED` et ne peut être terminé qu'une fois dans la room.
