Titre : Pokedex incomplet
Description : il y'a un manque au niveau des méthode d'évolution. et un probleme sur le volet "zone de capture", la partie de gauche la ou il y'ai sencé avoir le sprite du pokemon doit etre supprimée (seulement sur ce volet) pour pouvoir avoir une carte plus grande. la partie textuel à droite de la carte ou il y'a de noté 
" ZONES DE CAPTURE
Kalos
1 zone répertoriée. Les carrés rouges reprennent toutes les méthodes de rencontre du jeu source." 
doit passer en dessous de la carte. et au lieu d'avoir ce texte, il faudrait plutot le nom des lieux ou la capture est possible.

Statut : corrigé le 2026-10-15.

- La fiche affiche désormais, pour chaque évolution, la cible et la condition
  française issue de la méthode source : niveau, objet, bonheur, heure, sexe,
  capacité connue, Pokémon présent dans l'équipe, statistique dominante et cas
  particuliers de Chenipotte/Ningale/Munja.
- Le volet Zones de capture masque uniquement la colonne d'identité et de sprite.
  La carte utilise ainsi toute la largeur disponible.
- Les véritables noms de cartes issus de `map-infos.json` sont dédupliqués et
  ancrés directement aux zones rouges, sans bandeau textuel supplémentaire.
- Ce volet reste une présentation personnelle déterministe : aucun nouvel état
  persistant ou réseau Coop n'est nécessaire.
- Finition d'affichage : la fiche générale emploie des espacements et cartes plus
  compacts afin de tenir sans défilement. La carte d'habitat conserve son ratio,
  n'utilise plus une taille fixe et occupe toute la hauteur disponible en
  conservant son ratio. Le corps du volet est borné au-dessus de la navigation
  afin qu'il ne puisse plus passer sous les boutons Précédent/Suivant, même lorsque
  tout le canvas est agrandi.
  Le nom du ou des lieux est également ancré directement à chaque zone rouge.
