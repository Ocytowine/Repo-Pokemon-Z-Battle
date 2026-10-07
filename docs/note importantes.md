Probleme constaté :
- durant les combats : 
    - probleme au niveau de la transition de départ, fond gris puis noir... à revoir) et animation du passage overworld et combat non jouée.
    - les récaps d'effet attaques vont trop vite voir des fois n'existe pas (ca n'affecte pas, rate son attaque, trés efficaces...) dans le jeu original, les différents textes ne passe pas automatiquement, la ca va trop vite.
    - Quand un des pokemon est ko, l'effet de disparition vont trop vite, la barre de pv ne ce met pas à jour (on ne vois pas que les pv sont changé, elle reste dans l'état d'avant l'attaque.). la musique ne se déclenche pas au bon moment.

    - lors des combat pvp, la requete de demande n'est pas mise à jour, elle reste visible alors que le match et déja fini.

- durant l'exploration, les zones que l'hote ne peux pas visité (par blocage de pnj) l'invité lui peut passer.

- en réseau, les pnj ne sont pas synchronisés, du coups il y'a des petit bug de colision d'un coté seulement.

- durant l'exploration, les musiques des lieux ne sont pas lancées.

- en co-op, quand un joueur quitte, l'hote ne recois pas de notification, et le sprite reste en place. il faudrait faire ca proprement.

Ajout propre à la co-op : 
    -  l'invité peut lancé des captures de pokemon, et peut décider d'offrir le pokemon capturé à l'hôte.
    - l'hote peut autoriser l'invité à prendre les objets dans l'underworld, pour le compte de l'hote. et si il veut, il peut aussi lui laisser (hors objet rare).
    - l'invité et l'hote peuvent consulter le ranch et interagir (consulter les détails seulement)avec les pokemons qui s'y trouvent.
    - un systeme de chat permettant à l'hote et à l'invité de communiquer en temps réel.

Ajout des sauvegarde en cloud pour permettre de synchroniser les sauvegardes entre différents appareils.

Ajout des transfert de sauvegardes de la version d'origine (pokemon Z en emmulateur).
    prenant en compte les pokemonS, badges, avancer narrative, objets...

Ajout manquant (importante mécanique solo).
    Pokodex : à rendre plus simple et plus intuitif pour le joueur.
    Utilisation des objets : pendant et en dehors des combats.
    Capture : toute la mécanique, intégrer aussi les shiny.
    Evolution : controle des mécaniques
    Mega evolution : Toute la mécanique
    Pention : Toute la mécanique
    Carte : Toute la mécanique
    Succés : Toute la mécanique
    Alchimie : Toute la mécanique
    Boussole : Toute la mécanique
    Boutons de jeux en mode android : Toute la mécanique
    Narration : continuer l'intégration, map, effet, interupteurs

Améliorations :
    UI : le format du canva n'est pas correctement exploité. la fenetre de l'overwolrd est bonne (il faut rendre un canva en paysage pour la version android afin d'integrer les boutons de controle), des l'ouverture du menu, le canva "Menu" doit utiliser toute la place disponible. et mettre à jour la dispostion et la mise à l'echelle des éléments en conséquence.

    UI sac : améliorer le rangements, créer des sous catégories pour les baies, pierre evolutives, famille d'objets, pouvoir trier les CT et CS par types, effets, puissances...

    Les sprites du fangames sont un peu trops grosses, il faudrait les redimensionner pour qu'ils s'intègrent mieux à l'interface et à l'écran de jeu.

Installation VS code:

    Node JS : https://nodejs.org/en/download/ version 22
    GIT : https://git-scm.com/downloads
    Extension VS code : 
        - French Language Pack for Visual Studio Code
    
Github : du côté de l'hote, il faut créer un compte github et créer un repository public pour le fangame. ensuite, il faut cloner le repository sur ton pc (dans le dossier de ton choix) et y copier les fichiers du fangame. ensuite, tu peux faire un commit et push pour envoyer les fichiers sur github.

Avant de lancer : (met à jour la cible de la ou tu extrait le fangame)

corepack pnpm install
corepack pnpm prepare:local --source "C:\Users\Ebaluteau\Desktop\Pokémon Z V2.12 - Français" --output ".pokemon-z\data"
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build

Le solo :

corepack pnpm sandbox:overworld

Le multi : 

	en 1er : 
    corepack pnpm multiplayer:dev
    
	puis : 
    corepack pnpm sandbox:overworld