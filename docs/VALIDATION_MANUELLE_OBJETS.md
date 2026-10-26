# Validation manuelle des objets

État au 2026-10-26 : à exécuter sur une sauvegarde de test. Employer les noms
français affichés par le jeu ; les identifiants entre parenthèses permettent de
retrouver une entrée ambiguë dans le rapport local.

## Objets utilisables uniquement en combat

- [ ] Utiliser Muscle + (`DIREHIT`), puis Muscle + (`DIREHIT2`) et Muscle 3
  (`DIREHIT3`) sur un Pokémon actif. Vérifier que le niveau de concentration
  augmente sans s'additionner au-delà de la valeur de l'objet ; un objet
  identique ou inférieur ne doit pas être consommé sans effet.
- [ ] Utiliser Garde-Stats (`GUARDSPEC`) : les baisses de statistiques venant
  de l'adversaire sont bloquées pendant l'effet. Vérifier l'expiration, le refus
  d'un second Garde-Stats actif et le ciblage d'un Pokémon de réserve.
- [ ] Appliquer confusion puis utiliser Flûte Jaune (`YELLOWFLUTE`) ; appliquer
  attraction puis utiliser Flûte Rouge (`REDFLUTE`). Chaque flûte doit retirer
  uniquement son effet et rester dans le Sac si elle n'a rien à guérir.
- [ ] Dans un combat sauvage, utiliser Poké Poupée, Queue Skitty puis Poké
  Plumet sur trois essais : fuite garantie, objet consommé par son propriétaire,
  aucune attaque adverse supplémentaire. Dans un combat de Dresseur, l'objet
  doit être refusé sans consommation.

## Soins et confusion

- [ ] Sur un Pokémon confus sans statut majeur, utiliser Poudre Soin, Total
  Soin puis Guérison sur trois essais. La confusion doit disparaître ; Poudre
  Soin réduit aussi le bonheur selon la règle du jeu. Sur un Pokémon déjà sain,
  aucun de ces objets ne doit être consommé.
- [ ] Répéter un effet de chaque groupe en solo, avec l'hôte, puis avec
  l'invité. Contrôler le message et l'état chez les deux participants,
  reconnecter l'invité et redémarrer la room pendant Garde-Stats. Les objets
  consommés et le Sac doivent rester propres à leur propriétaire.

Pour chaque essai, noter date, Pokémon, objet, solo/hôte/invité, résultat
**OK / KO / bloqué / non concluant**, résultat attendu et observé, et une
capture ou un journal si un écart apparaît. Ne pas ajouter `.pokemon-z/` ni
de sauvegarde personnelle à Git.

## Objets tenus renforçant un type

- [ ] Avec Charbon (`CHARCOAL`), comparer les dégâts d'une même attaque Feu
  sans objet puis avec l'objet ; refaire avec une attaque Eau, qui ne doit pas
  être renforcée. L'objet reste tenu après l'attaque.
- [ ] Vérifier Tissu Magique (`Tela`) avec une attaque Fée et Lunettes Noires
  (`BLACKGLASSES`) avec une attaque Ténèbres. Sous Maladresse, Embargo ou Champ
  Magique, l'effet cesse temporairement sans retirer l'objet.
- [ ] Répéter avec l'hôte puis l'invité comme attaquant. Les deux écrans doivent
  montrer les mêmes PV après le coup ; reconnecter l'invité puis redémarrer
  la room pour vérifier que l'objet et les PV sont restaurés.

`corepack pnpm audit:items` donne les compteurs reproductibles de cinq
familles, soit 95/95 effets source couverts. Les 27 outils
de terrain sont inventoriés par handler source ; leur couverture d'exécution
reste à auditer. Les autres objets tenus, Balls et CT/CS ne font pas partie
de ces compteurs.

## Outils de terrain personnels

- [ ] Utiliser Repoussenlit (`REPEL`), Superepoussenlit (`SUPERREPEL`) et
  Repoussenlit Max (`MAXREPEL`) sur trois sauvegardes de test. Vérifier les
  durées 100/200/400 pas, le refus d'un second objet actif, l'absence de
  décrément sur glace et le blocage d'une rencontre de niveau inférieur ou
  égal au premier Pokémon apte. Un niveau supérieur doit rester possible.
- [ ] Utiliser Flûte Noire (`BLACKFLUTE`) puis Flûte Blanche (`WHITEFLUTE`).
  Elles ne sont pas consommées ; les niveaux sauvages montent puis baissent
  de 1 à 3, sans sortir des bornes 1–100.
- [ ] Utiliser Miel (`HONEY`) dans l'herbe, une grotte et un lieu sans table
  de rencontre. Il doit être consommé dans les trois cas ; les deux premiers
  déclenchent une rencontre si la table existe, le dernier affiche l'échec.
- [ ] Entrer dans une grotte puis utiliser Corde Sortie (`ESCAPEROPE`) : retour
  un pas derrière l'entrée, objet consommé et point de sortie effacé. Hors
  d'une grotte, l'objet reste dans le Sac.
- [ ] Utiliser Potion Brillante (`SHINYZADOR`), vérifier le refus d'une seconde
  tant que l'effet est actif, puis l'apparence chromatique de la prochaine
  rencontre sauvage. L'effet doit disparaître après victoire, fuite,
  capture ou défaite.
- [ ] Pour chaque effet persistant, répéter en solo, comme hôte et comme
  invité ; sauvegarder/recharger et reconnecter l'invité avant son déclenchement.
  Au combat, les deux écrans doivent montrer le même niveau et la même
  apparence du Pokémon sauvage, tandis que le Sac reste personnel.

## Objets tenus d'ordre d'action

- [ ] Avec Vive Griffe (`QUICKCLAW`) sur un Pokémon lent, répéter plusieurs
  tours : l'activation doit parfois le faire agir avant un adversaire plus
  rapide sans consommer l'objet. Vérifier qu'une capacité de priorité plus
  élevée garde l'avantage.
- [ ] Avec Ralentiqueue (`LAGGINGTAIL`) puis Encens Plein (`FULLINCENSE`) sur
  un Pokémon rapide, vérifier qu'il agit après un adversaire plus lent de
  même priorité, y compris sous Distorsion. Sous Maladresse, Embargo ou Champ
  Magique, l'effet de l'objet doit cesser sans le retirer.
- [ ] Avec Baie Chérim (`CUSTAPBERRY`) à bas PV, vérifier qu'elle passe avant
  les porteurs de Ralentiqueue/Encens Plein, puis qu'elle est consommée.
- [ ] Refaire un cas en solo, avec l'hôte, puis l'invité ; comparer l'ordre et
  le message sur les deux écrans. Reconnecter l'invité et redémarrer la room
  pour vérifier l'objet tenu et l'état du combat.

## Objets Choix

- [ ] Avec Bandeau Choix, comparer les dégâts d'une capacité physique, puis
  spéciale, avec et sans objet. Seule la capacité physique doit augmenter.
- [ ] Avec Lunettes Choix, refaire la comparaison : seule la capacité spéciale
  doit augmenter. Utiliser deux capacités connues : après la première action,
  demander l'autre doit rejouer la première. Échanger ou retirer l'objet, puis
  changer de Pokémon et le faire revenir pour vérifier la libération du verrou.
- [ ] Avec Mouchoir Choix sur un Pokémon plus lent, vérifier qu'il passe devant
  un adversaire de même priorité si son gain de 50 % suffit. Vérifier aussi
  son verrouillage de capacité en combat Duo.
- [ ] Tester Maladresse, Embargo et Champ Magique : bonus et verrou doivent
  cesser pendant la suppression, puis revenir si l'objet et son verrou sont
  toujours présents. Vérifier en solo, côté hôte puis côté invité Coop ; les
  deux écrans doivent montrer le même ordre et les mêmes dégâts. Reconnecter
  l'invité au milieu du combat et vérifier l'objet et la capacité verrouillée.

## Objets tenus de Vitesse et de poids

- [ ] Avec chacun des sept objets `MACHOBRACE`, `POWERWEIGHT`, `POWERBRACER`,
  `POWERBELT`, `POWERANKLET`, `POWERLENS` et `POWERBAND`, comparer l'ordre
  d'action face à un Pokémon un peu plus lent sans objet. Le porteur doit
  passer après lui. Sous Champ Magique, l'ordre normal revient.
- [ ] Donner `QUICKPOWDER` à Métamorph : il doit dépasser un adversaire dont
  la Vitesse est entre sa valeur normale et son double. Après Morphing ou
  Imposteur, le bonus disparaît. Un autre Pokémon n'en profite jamais.
- [ ] Avec `FLOATSTONE`, vérifier le gain de 25 % de Vitesse, puis comparer
  les dégâts d'une capacité fondée sur le poids avec et sans la pierre.
  Champ Magique doit annuler les deux effets.
- [ ] Avec `IRONBALL` sur un Pokémon Vol ou Lévitation, vérifier la perte
  d'immunité Sol et la Vitesse divisée par deux. Sous Champ Magique, le
  porteur retrouve son immunité Sol ; la pénalité de Vitesse reste appliquée
  dans le Ruby de Pokemon Z.
- [ ] Refaire un ordre de Vitesse en solo, comme hôte puis comme invité Coop.
  Les deux écrans doivent afficher le même premier acteur. Reconnecter
  l'invité et redémarrer la room avant le tour suivant pour vérifier que
  l'objet tenu et l'ordre sont conservés.

## Objets propres à Z : Super Évoluroc et Tabla Esqui

- [ ] Avec `SUPEREVIOLITE`, comparer Vitesse, dégâts infligés et dégâts
  reçus par un Pokémon au début d'une chaîne de trois espèces (par exemple
  un premier stade). Les trois écarts doivent correspondre à 50 % sur les
  statistiques concernées. Refaire avec une espèce n'ayant qu'une évolution
  et une espèce finale : aucun bonus ne doit s'appliquer.
- [ ] Avec `TABLAESQUI`, vérifier sur Bibarel la Vitesse augmentée de 50 %
  et les dégâts augmentés de 30 %. Sur une autre espèce, l'objet ne doit
  donner aucun bonus.
- [ ] Pour les deux objets, tester Maladresse, Embargo et Champ Magique :
  les bonus doivent être suspendus sans retirer l'objet. Refaire un combat
  simple et Duo, côté hôte puis invité Coop, comparer ordre et dégâts sur
  les deux écrans, puis reconnecter l'invité avant le tour suivant.

## Objets de soin et de réaction aux dégâts

- [ ] Avec `SHELLBELL` et des PV manquants, frapper une cible : le soin doit
  valoir un cinquième des dégâts réellement infligés. Refaire avec une
  capacité à plusieurs coups et une capacité touchant deux cibles en Duo.
  Antisoin ou Champ Magique doit empêcher le soin.
- [ ] Avec `STICKYBARB`, attendre un tour pour vérifier la perte de 1/8 des
  PV maximum. Faire toucher son porteur par une attaque de contact d'un
  Pokémon sans objet : l'objet doit passer à l'attaquant, qui subira ensuite
  ses dégâts résiduels. Avec un attaquant déjà équipé ou un clone, aucun
  transfert ne doit se produire.
- [ ] Avec `BINDINGBAND`, comparer les dégâts résiduels d'une capacité
  piégeante : 1/6 des PV maximum avec l'objet actif contre 1/8 sans lui.
  Retirer l'objet ou activer Champ Magique pendant le piège doit ramener
  les dégâts à 1/8. Refaire en Duo avec deux cibles distinctes.
- [ ] Avec `BIGROOT`, vérifier le gain de 30 % de soin sur une attaque
  drainante, Vol-Force, Vampigraine, Anneau Hydro et Enracinement.
  `RAIZANCESTRAL` doit soigner un quart des PV maximum sur une attaque
  drainante, même si elle inflige peu de dégâts. Antisoin doit bloquer
  ces soins.
- [ ] Refaire au moins Grelot Coque et Bande Étreinte en solo, côté hôte
  puis invité Coop. Comparer PV, message et objet tenu sur les deux écrans,
  puis reconnecter l'invité pendant un piège actif et vérifier que la
  bonne source garde son bonus après le tour suivant.
