Titre : l'UX du ranch
Description : Il faut séparer l'interface pour qu'il y'ai d'un coté les pokemon de l'équipe et de l'autre les pokemon du ranch. il est trés difficile de gérer les deux types de pokemon dans la même interface.
Étapes pour reproduire :
1. Ouvrir l'interface du ranch.
2. Observer la disposition des Pokémon de l'équipe et des Pokémon du ranch.
Résultat attendu : Les Pokémon de l'équipe et les Pokémon du ranch devraient être clairement séparés dans l'interface.
Résultat réel : Les Pokémon de l'équipe et les Pokémon du ranch sont mélangés dans la même interface, rendant la gestion difficile.

Statut : corrigé le 2026-10-14.

Résolution : la mention `PC de Léo` a été retirée. L'équipe dispose maintenant
d'un tiroir dédié à six emplacements, repliable depuis une commande qui reste
visible et indépendante du stockage. Une carte déposée au Ranch ne disparaît donc
plus quand l'équipe est repliée. La grille paginée utilise 3 colonnes × 3 lignes
avec l'équipe ouverte, puis 4 colonnes × 4 lignes une fois celle-ci repliée.

Filtre et tri possèdent leurs propres panneaux, cachés par défaut, et le tri
numérique reste le choix initial. Les cartes compactes conservent le nom, le
niveau, le statut, les badges de types et les quatre capacités sur deux lignes,
ainsi que l'objet tenu et son nom français. Les PV restent visibles dans l'Équipe,
mais sont retirés des cartes du stockage. L'écran adopte une palette verte et
utilise le décor animé `Graphics/Ranch.png`.

La ligne visuelle `numéro · Équipe/Ranch`, redondante dans cette vue, a ensuite été
retirée des cartes compactes. Le tiroir Équipe utilise exactement 25 % de la largeur,
ce qui conserve la taille des cartes du Ranch entre les grilles 3 × 3 et 4 × 4.
Le sprite couvre les deux rangées de gauche ; les types apparaissent sous le nom
sous forme d'icônes et les capacités restent en 2 × 2 sans dépasser des cartes.

Correctif complémentaire : le stockage est explicitement ancré à la zone CSS
`storage`. Masquer le panneau Équipe ne peut donc plus déplacer le stockage dans
la colonne repliée de l'équipe et faire disparaître visuellement ses cartes.

Finition visuelle : lorsque l'équipe est repliée, la grille ne conserve plus de
colonne fantôme à zéro pixel. Le fond animé est attaché à la racine stable du Ranch
et ne redémarre plus lors de l'ouverture des filtres, du tri ou du repli de l'équipe.
Le dégradé vertical du voile a aussi été remplacé par une teinte uniforme afin de
supprimer la bande sombre visible en bas du décor lorsque le Ranch contient une carte.

Correctif de remplissage : la barre d'outils, le tiroir de filtres et le contenu
occupent des zones verticales nommees. Quand le tiroir est ferme, le contenu reste
donc dans la ligne extensible et couvre toute la hauteur au lieu de laisser une
zone de decor assombrie en bas. Le bandeau redondant des resultats a ete retire et
les boutons de pagination restent fixes au pied du stockage.

Raccord des actions : la roue est maintenant centree dans le panneau du jeu plutot
que dans le viewport du navigateur. Un Pokemon stocke peut etre relache apres une
confirmation explicite ; son objet tenu retourne au Sac et l'historique Pokedex est
mis a jour. Le gestionnaire d'objet propose tous les objets ordinaires du Sac,
independamment de la disponibilite actuelle de leur effet en combat.

Le choix d'un objet tenu passe maintenant par une roue reprenant les huit
categories et icones du Sac. Chaque categorie ouvre une modale de six objets par
page ; les dossiers de rangement automatiques du Sac y sont conserves, avec retour
au dossier parent, page precedente et page suivante.
