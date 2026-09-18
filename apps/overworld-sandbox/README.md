# Overworld Sandbox

Prototype Canvas de la phase 7. Il utilise le même moteur de grille en
mode local et côté serveur, sans importer de carte ou de tileset de Pokémon Z.

## Test local

```powershell
corepack pnpm sandbox:overworld
```

Ouvrez `http://127.0.0.1:5174`. Les flèches ou ZQSD contrôlent le joueur 1 ;
IJKL contrôle le joueur 2.

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
