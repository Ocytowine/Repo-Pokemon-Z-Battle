# Overworld Sandbox

Prototype Canvas des phases 7 et 8. Il utilise le même moteur de grille en
mode local et côté serveur, sans importer de carte ou de tileset de Pokémon Z.

## Test local

```powershell
corepack pnpm sandbox:overworld
```

Ouvrez `http://127.0.0.1:5174`. Les flèches ou ZQSD contrôlent le joueur 1 ;
IJKL contrôle le joueur 2. Espace fait interagir le joueur 1 et O le joueur 2.

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
