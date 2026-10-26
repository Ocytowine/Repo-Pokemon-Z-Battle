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

`corepack pnpm audit:items` donne les compteurs reproductibles des trois
familles utilisables et des 18 objets tenus renforçant un type. Les 27 outils
de terrain sont inventoriés par handler source ; leur couverture d'exécution
reste à auditer. Les autres objets tenus, Balls et CT/CS ne font pas partie
de ces compteurs.
