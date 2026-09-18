# Architecture overworld

## Decision de la phase 7.1

Le prototype separe deux couches :

- `@pokemon-z-battle/overworld-engine` porte les cartes sur grille, avatars,
  intentions, collisions et transitions sans DOM ni moteur graphique ;
- `@pokemon-z-battle/overworld-sandbox` traduit clavier et boutons en intentions,
  puis dessine l'etat retourne sur un Canvas HTML.

Le Canvas natif est volontaire pour le premier increment. Phaser ajouterait une
dependance et ses propres conventions avant validation du modele de monde. Si les
increments suivants confirment le besoin de camera, tilemaps, animations et
interpolation avancees, Phaser pourra remplacer uniquement le renderer : le noyau
et le protocole conserveront les memes types.

## Modele valide

Une carte possede un identifiant, des dimensions, des cases bloquees et des
transitions explicites. Une intention contient seulement le joueur et une direction.
Le moteur avance au plus d'une case, refuse les limites, collisions et cases deja
occupees, puis emet des evenements structures. Entrer sur une transition change la
carte et la position d'arrivee dans la meme resolution.

Les deux cartes de demonstration sont originales et ne dependent d'aucun fichier
Pokemon Z. L'import de `RPG::Map`, tilesets et evenements reste reserve a la phase 9.

## Synchronisation validee en 7.2

Le client envoie uniquement une direction et un numero de sequence. La room
applique cette intention avec le meme moteur de grille que le prototype local,
persiste l'etat obtenu et le diffuse aux deux sockets. Elle ignore une sequence
ancienne et ne fait jamais confiance a une position envoyee par le navigateur.

Le sandbox borne les commandes a un envoi toutes les 120 ms. Chaque diffusion
autoritaire remplace l'etat local et les avatars sont interpoles pendant 110 ms ;
une divergence visuelle est donc corrigee sans dupliquer les regles cote renderer.
Les changements de carte font deja partie de l'etat diffuse et persiste.

## Reconnexion validee en 7.3

Le ticket de room est conserve dans le `sessionStorage` de la page. Un rechargement
reconstruit donc le WebSocket avec la meme identite et la meme place. Une fermeture
inattendue lance une reconnexion exponentielle de 500 ms a 8 s ; le bouton de retour
au mode local annule explicitement cette boucle et supprime le ticket.

Le snapshot inclut le dernier numero de mouvement accepte pour chaque joueur. A la
reconnexion, le client reprend au numero suivant au lieu de produire une intention
perimee. Carte, position et direction restent dans l'etat de monde persiste par la
room. La recette E2E confirme une transition prairie vers bosquet, la restauration
apres reconnexion, puis un nouveau changement de zone.

La phase 8 peut maintenant ajouter interactions, PNJ et declencheurs sans modifier
la responsabilite du renderer ou faire confiance aux coordonnees du client.
