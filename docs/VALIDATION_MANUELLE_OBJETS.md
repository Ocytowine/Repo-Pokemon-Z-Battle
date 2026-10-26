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

## Ballon et réactions élémentaires aux coups

- [ ] Donner `AIRBALLOON` à une cible : une attaque Sol doit échouer tant que
  le ballon est actif. Une autre attaque qui retire des PV doit l'éclater ;
  l'attaque Sol suivante doit alors toucher. Un coup absorbé par un clone ne
  doit pas éclater le ballon. Vérifier aussi le bris de Déguisement de Mimiqui.
- [ ] Avec `ABSORBBULB` ou `LUMINOUSMOSS`, subir un coup Eau ; avec
  `CELLBATTERY` un coup Électrik ; avec `SNOWBALL` un coup Glace. Vérifier la
  hausse de statistique et la disparition de l'objet. Au stade +6 ou sous
  Champ Magique, l'objet doit rester tenu.
- [ ] Refaire Ballon et un objet élémentaire en solo, côté hôte et côté invité
  Coop. Comparer les messages, objets et statistiques sur les deux écrans ;
  reconnecter l'invité après activation et vérifier le snapshot restauré.
- [ ] Avec `WEAKNESSPOLICY`, subir un coup super efficace qui retire des PV :
  vérifier +2 en Attaque et Attaque Spéciale et la disparition de l'objet.
  Un coup neutre, un clone ou deux statistiques déjà à +6 doivent laisser
  l'objet en place. Refaire en Duo sur la cible de droite pour vérifier que
  l'autre cible ne change pas.
- [ ] Avec `KEEBERRY` puis `MARANGABERRY`, subir respectivement un coup
  physique puis spécial. La bonne baie doit augmenter Défense ou Défense
  Spéciale ; un coup de l'autre catégorie ne doit rien déclencher.

## Roches météo et talents d'entrée

- [ ] Faire entrer un Pokémon avec Llovizna et `DAMPROCK`, Sécheresse et
  `HEATROCK`, Sable Volant et `SMOOTHROCK`, puis Alerte Neige et `ICYROCK`.
  Chaque météo doit durer huit tours au lieu de cinq. Sous Embargo ou Champ
  Magique, vérifier le retour à cinq tours sans retirer la roche.
- [ ] Refaire au moins Llovizna avec la roche en solo, côté hôte et côté
  invité Coop. Vérifier la durée affichée et reconnecter l'invité avant la
  fin de la météo : le nombre de tours restants doit rester identique.

## Gant de Boxe

- [ ] Donner `PUNCHINGGLOVE` à un Pokémon qui connaît un coup de poing de
  contact. Comparer ses dégâts avec et sans objet : l'attaque doit gagner
  15 %. Sur un Pokémon portant Casque Brut, le porteur du gant ne doit pas
  subir le recul. Vérifier aussi un coup bloqué par Bouclier Royal et
  Barrage Épineux : leurs pénalités de contact ne doivent pas s'appliquer.
- [ ] Sous Embargo ou Champ Magique, refaire le même coup : le bonus de
  dégâts doit disparaître et la réaction de contact doit revenir. Répéter
  en solo, côté hôte et côté invité Coop ; reconnecter l'invité entre deux
  tours et vérifier que l'objet tenu est conservé.
- [ ] Avec `NUDILLOPUAS`, toucher au contact une cible sans statut :
  Hémorragie doit pouvoir apparaître sans consommer l'objet. Une cible Feu,
  un clone ou un coup sans contact ne doivent pas déclencher l'effet.
  Refaire côté hôte et invité Coop puis reconnecter l'invité après
  l'application du statut pour vérifier sa restauration.

## Cible

- [ ] Donner `RINGTARGET` à un Spectre : une attaque Normal doit désormais
  le toucher. Avec un double type Spectre/Roche, la résistance Roche doit
  rester visible dans les dégâts. Tester aussi Sol contre Vol et contre
  Lévitation : l'immunité doit être levée sans donner les bonus de terrain
  réservés aux Pokémon au sol.
- [ ] Avec une Cible active, vérifier Poison sur Acier, brûlure sur Feu,
  paralysie sur Électrik et gel sur Glace. Champ Magique ou Embargo doit
  rétablir les immunités sans retirer l'objet. Un type Poison doit toujours
  absorber les Pics Toxik selon le script source.
- [ ] Refaire une immunité de type et un statut en solo, côté hôte et côté
  invité Coop ; reconnecter l'invité puis vérifier les PV, le statut et
  l'objet dans le combat restauré.

## Précision, critiques et Cinta Focus

- [ ] Avec `BRIGHTPOWDER` puis `LAXINCENSE` sur la cible, répéter une attaque
  de précision imparfaite et comparer les touches à une cible sans objet.
  Sous Champ Magique ou Embargo, l'esquive supplémentaire doit disparaître.
- [ ] Donner `ZOOMLENS` à un Pokémon lent et attaquer après la cible : la
  précision doit augmenter. Refaire si la cible utilise un objet ou attend,
  puis avec un porteur plus rapide dont la cible n'a pas encore agi : le
  bonus ne doit pas s'appliquer dans ce dernier cas.
- [ ] Comparer les coups critiques avec `RAZORCLAW`, `STICK` sur Canarticho
  ou Palarticho, et `LUCKYPUNCH` sur Leveinard. Changer d'espèce pour les
  deux derniers objets : leur bonus doit disparaître.
- [ ] À pleine santé, subir plusieurs coups normalement fatals avec
  `FOCUSBAND` : l'objet doit parfois laisser 1 PV et rester tenu. Répéter
  après avoir perdu des PV et sous Champ Magique : il ne doit plus sauver.
- [ ] Refaire un essai de précision et un déclenchement de Cinta Focus en
  solo, comme hôte et comme invité Coop. Vérifier les PV, les messages et
  l'objet des deux côtés, puis reconnecter l'invité avant le tour suivant.

## Gemmes de type

- [ ] Faire utiliser une attaque Feu avec `FIREGEM`, puis sans Gemme : les
  dégâts doivent augmenter de 30 % avant les arrondis et la Gemme doit être
  consommée après le coup. Refaire avec un autre type, par exemple
  `WATERGEM` et une attaque Eau.
- [ ] Avec une Gemme de type différent de l'attaque, puis sous Maladresse,
  Embargo ou Champ Magique, vérifier que l'objet reste tenu et que les
  dégâts ne reçoivent pas le bonus.
- [ ] En Duo, faire attaquer un seul porteur de Gemme : l'objet de son
  partenaire doit rester. Refaire comme hôte et comme invité Coop ; comparer
  les dégâts et les objets sur les deux écrans, puis reconnecter l'invité.

## Durées et répétitions

- [ ] Avec `LIGHTCLAY`, lancer Reflet puis Mur Lumière : chaque écran doit
  durer huit tours au lieu de cinq. Sous Champ Magique ou Embargo, vérifier
  le retour à cinq tours. Avec Voile Aurore, vérifier séparément les cinq
  tours du script source malgré l'objet ; signaler tout écart observé.
- [ ] Avec `GRIPCLAW`, poser un piège à dégâts : il doit durer huit tours
  avant la décrémentation de fin de tour. Comparer avec cinq ou six tours
  sans objet ; reconnecter pendant le piège et vérifier la durée restante.
- [ ] Avec `LOADEDDICE`, utiliser une attaque de 2 à 5 coups : elle doit
  toujours donner cinq coups si la cible survit. Vérifier aussi Triple Pied
  avec Multi-Coups : les deux derniers coups ne doivent plus refaire de
  test de précision lorsque les deux conditions sont actives.
- [ ] Avec `METRONOME`, répéter six fois la même capacité : les dégâts
  doivent monter par paliers de 20 % jusqu'à +100 %, puis se stabiliser.
  Changer de capacité ou de Pokémon remet la série à zéro. Refaire côté
  hôte et invité Coop, puis reconnecter l'invité pendant la série.

## Objets liés à l'espèce et encens

- [ ] Avec Dialga + `ADAMANTORB`, Palkia + `LUSTROUSORB` et Giratina +
  `GRISEOUSORB`, comparer une attaque du type couvert et une autre attaque
  avec/sans objet. Seul le type couvert doit gagner 20 % de dégâts.
- [ ] Donner `DEEPSEATOOTH` puis `DEEPSEASCALE` à Coquiperl : comparer
  dégâts spéciaux sortants et dégâts physiques entrants. Dans le Ruby Z,
  l'Écaille Océan protège le physique ; une attaque spéciale reçue ne doit
  pas profiter de ce bonus.
- [ ] Avec Latias/Latios + `SOULDEW`, comparer attaque spéciale et défense
  spéciale avec/sans objet. La règle `souldewclause`, lorsqu'elle est
  activée dans un combat prévu pour elle, doit supprimer les deux bonus.
- [ ] Donner `METALPOWDER` à Métamorph avant puis après Morphing : la
  protection x1,5 doit disparaître après transformation. Vérifier une
  attaque physique et une spéciale.
- [ ] Vérifier le bonus physique de `LAGGINGTAIL` sur Osselait/Ossatueur
  et les bonus de `LIGHTBALL` sur Pikachu/Raichu. Tester séparément
  `THICKCLUB` dans le jeu source : le script de dégâts ne lui donne aucun
  bonus, malgré sa présence dans les données.
- [ ] Avec `ROCKINCENSE`, `ROSEINCENSE`, `SEAINCENSE`, `WAVEINCENSE` puis
  `ODDINCENSE`, attaquer avec Roche, Plante, Eau, Eau puis Psy : chaque
  encens doit donner +20 % avant arrondis, sans bonus sur un autre type.
  Embargo et Champ Magique doivent suspendre le bonus.
- [ ] Refaire un orbe et un encens en solo, comme hôte et comme invité
  Coop. Comparer les PV et objets tenus sur les deux écrans, reconnecter
  l'invité puis vérifier la reprise du combat.

## Objets propres à Z : dégâts, critiques et statuts

- [ ] Comparer les dégâts critiques avec/sans `ANILLODESANGRE`, puis
  donner `ANTICRITICO` à la cible : les critiques doivent disparaître,
  sauf si l'attaquant utilise Brise Moule.
- [ ] Avec `ARMAZONDEFAUCES`, lancer une morsure : vérifier +20 % de
  dégâts, un niveau de critique et la chance d'apeurer lorsque la capacité
  porte aussi le drapeau source `f`. Vérifier que Roche Royale et Croc
  Rasoir suivent la même chance d'apeurer sur une capacité admissible.
- [ ] Comparer avec/sans `CANONDEMANO` sur une onde, `FUELLENEUMATICO`
  sur une attaque de vent et `ESPADAVALIENTE` sur une coupe. Refaire ce
  dernier essai avec Mélokrik pour distinguer +50 % de +30 %.
- [ ] Avec `CORAZAASALTO`, subir une attaque spéciale puis tenter une
  capacité de statut : la défense doit augmenter de 40 % et la capacité
  de statut doit être bloquée. Champ Magique doit suspendre les deux effets.
- [ ] Avec `MASCARACRUEL`, attaquer une cible empoisonnée ou brûlée :
  vérifier +30 % de dégâts. Une cible saine ou sous Exténuation ne doit
  pas recevoir ce bonus.
- [ ] Avec `PUNZASFERA`, attendre un tour : le porteur susceptible doit
  recevoir Hémorragie et garder l'objet. Un type Feu, un porteur déjà
  affecté ou un objet suspendu par Champ Magique ne doit pas l'activer.
  Refaire avec Orbe Flamme et Orbe Toxique pour vérifier leurs statuts.
- [ ] Avec `ROSELIBERRY`, subir une attaque Fée super efficace : les
  dégâts doivent être divisés par deux et la baie consommée. Un coup Fée
  neutre doit laisser la baie tenue.
- [ ] Refaire au moins Punzasfera et un objet de dégâts en solo, côté
  hôte et côté invité Coop. Comparer statuts, PV et objets sur les deux
  écrans, puis reconnecter l'invité avant le tour suivant.

## Lazo Destino et Bola Humo

- [ ] Avec Lazo Destino tenu par la cible, utiliser Attraction entre deux
  Pokémon de sexes compatibles : les deux doivent être amoureux. Faire
  sortir l'auteur de chaque Attraction : le lien correspondant doit cesser.
- [ ] Faire déclencher Joli Sourire par contact contre un porteur de Lazo
  Destino : vérifier le rebond. Refaire avec Maladresse ou Champ Magique :
  le rebond ne doit pas se produire.
- [ ] En rencontre sauvage fuible, donner Bola Humo au combattant actif
  et utiliser Fuite : elle doit réussir, même contre un adversaire rapide.
  Refaire avec Maladresse et dans un combat où la fuite est interdite.
- [ ] Comparer les états d'Attraction en solo, hôte et invité Coop, puis
  reconnecter l'invité et vérifier que les liens restent identiques.

## Défense et soins complémentaires

- [ ] Comparer les dégâts physiques et spéciaux subis avec et sans Armure
  Pure : les deux doivent diminuer. Avec Balle Fer, seuls les dégâts
  physiques doivent diminuer. Refaire sous Champ Magique : les bonus
  d'objet doivent disparaître.
- [ ] Donner Zumo de Baya à un Pokémon sous la moitié de ses PV et attendre
  la fin du tour : il doit récupérer 20 PV et consommer l'objet, même face
  à Tension. Vérifier le même résultat chez l'hôte et l'invité Coop.
- [ ] Avec Raíz Ancestral, utiliser une capacité de drain `14F` telle que
  Baiser Drain : le porteur doit récupérer un quart de ses PV maximum.
- [ ] Faire subir deux baisses de statistiques à un porteur d'Herbe Blanche :
  les deux statistiques doivent revenir à zéro et l'herbe être consommée.
  Faire subir Provoc et Attraction à un porteur d'Herbe Mentale : ces effets
  doivent cesser et l'herbe être consommée. Refaire côté invité Coop puis
  reconnecter l'invité pour vérifier le même état.
- [ ] Si une capacité utilisant `14D` ou `14E` entre dans le périmètre PBS,
  vérifier sa charge avec et sans Herbe Pouvoir. Pour `14D`, vérifier aussi
  Protection et Lilliput ; pour `14E`, vérifier les trois hausses de deux
  niveaux. Aucun mouvement actuel du rapport d'intégration n'utilise ces
  codes : ces scénarios restent conditionnels.

## Réactions de contact et dégâts résiduels

- [ ] Attaquer un porteur de Casque Brut avec une capacité de contact à
  plusieurs coups : vérifier un recul par coup touchant les PV. Refaire
  derrière un clone, avec Garde Magik puis avec Gant de Boxe sur un coup
  de poing : aucun recul ne doit survenir dans ces cas protégés.
- [ ] Attaquer un porteur de Barbule avec un Pokémon sans objet : la
  Barbule doit passer dès le premier coup de contact atteignant les PV,
  puis blesser son nouveau porteur en fin de tour. Refaire derrière un
  clone et sous Champ Magique : aucun transfert.
- [ ] Comparer les dégâts avec et sans Orbe Vie ; vérifier son recul une
  fois après une attaque de zone même si la dernière cible est immunisée.
  Refaire sous Garde Magik et Sans Limite : le bonus subsiste sans recul.
- [ ] Piéger un Pokémon avec Bande Étreinte : les dégâts résiduels passent
  de 1/8 à 1/6. Pour Salaison sur un type Eau ou Acier, vérifier 1/4 avec
  et sans la Bande. Refaire sous Embargo ou Champ Magique.
- [ ] Refaire un cas de chaque objet avec le porteur hôte puis invité en
  Coop ; comparer les PV, objets et transferts sur les deux écrans et
  après reconnexion.

## Cible Anneau et objets de soin tenus

- [ ] Faire viser un Pokémon Spectre portant Cible Anneau par une attaque
  Normal, puis tenter Toxic sur un Pokémon Acier qui porte le même objet :
  les deux doivent fonctionner. Refaire sous Maladresse, Embargo et Champ
  Magique : les immunités doivent revenir. En Duo, vérifier que seul le
  slot porteur perd son immunité.
- [ ] Placer Racine Grande sur le bénéficiaire de Drenadoras et Suintement
  sur la cible : le bénéficiaire doit perdre les PV drainés sans bonus de
  Racine Grande. Refaire sous Soin Bloqué, en simple et en Duo, puis avec
  l'hôte et l'invité ; comparer les PV après reconnexion.
- [ ] Sous Soin Bloqué, Restes et Boue Noire ne doivent pas soigner.
  Boue Noire tenue par un Pokémon Poison ne doit pas lui infliger de
  dégâts ; sur un autre type, elle doit toujours lui retirer des PV.
- [ ] Donner Grelot Coque à l'attaquant et utiliser une capacité touchant
  deux adversaires en Duo : le soin doit apparaître une fois, calculé sur
  le total des dégâts. Refaire avec la seconde cible immunisée, puis avec
  une capacité à plusieurs coups. Vérifier que Soin Bloqué empêche le soin
  et que Sans Limite le supprime quand le mouvement a un effet additionnel.
- [ ] Refaire Grelot Coque avec l'objet tenu par l'hôte puis par l'invité
  Coop ; comparer les PV sur les deux écrans et après reconnexion.

## Plaques et Table Neutre

- [ ] Faire utiliser une attaque d'un type donné avec la Plaque correspondante,
  puis sans objet, à statistiques et conditions égales : les dégâts doivent
  suivre le bonus source de 25 %. Répéter avec une Plaque d'un autre type :
  elle ne doit pas augmenter les dégâts. La Table Neutre couvre le type Normal.
- [ ] Faire utiliser Jugement par Arceus avec une Plaque active : vérifier
  le type de la capacité, la forme et le bonus de dégâts. Refaire sous
  Maladresse, Embargo et Champ Magique pour contrôler la suspension du
  type de Jugement et du bonus de dégâts. La forme d'Arceus reste liée à
  son objet brut dans le jeu source et ne doit pas changer ici.
- [ ] Refaire un cas en Duo, puis avec la Plaque tenue par l'hôte et par
  l'invité Coop. Vérifier les dégâts et la forme sur les deux écrans,
  après reconnexion de l'invité et après redémarrage de la room.

## Carte Rouge et Bouton Fuite

- [ ] Donner Carte Rouge au défenseur, attaquer avec un Pokémon qui possède
  deux réserves vivantes : après les dégâts, vérifier que la Carte Rouge est
  consommée et qu'une réserve de l'attaquant arrive avant la prochaine action.
  Refaire avec le porteur mis K.O., sans réserve, sous Maladresse et sous
  Champ Magique : la Carte Rouge doit rester tenue et aucun remplacement ne
  doit se produire.
- [ ] En Duo, faire frapper le porteur de Carte Rouge par le slot 1 : seul ce
  slot doit changer, son partenaire doit rester en place. Vérifier les dégâts
  de pièges et les talents d'entrée du remplaçant.
- [ ] Refaire les scénarios avec Carte Rouge tenue par l'hôte puis par
  l'invité Coop ; comparer l'objet consommé et l'équipe active sur les deux
  écrans, reconnecter l'invité et reprendre le tour suivant.
- [ ] Donner Bouton Fuite à un défenseur avec deux réserves vivantes.
  Après un coup qui lui retire des PV sans le mettre K.O., choisir sa
  réserve : l'objet doit être consommé, le Pokémon choisi doit entrer
  avant l'action suivante, et les tirages du tour doivent rester stables.
  Refaire sans réserve, avec K.O. du porteur, sous Maladresse, Embargo et
  Champ Magique : aucun changement et aucune consommation.
- [ ] Refaire avec le porteur dans le slot 1 en Duo : seul ce slot change ;
  le partenaire garde sa position et son action. Vérifier les pièges et
  les talents d'entrée du remplaçant.
- [ ] Refaire avec Bouton Fuite tenu par l'hôte puis par l'invité Coop.
  Pendant le choix, reconnecter le propriétaire puis redémarrer la room :
  le même choix doit encore être demandé. Après validation, comparer
  l'objet, les PV et l'équipe active sur les deux écrans.

## Casque de Brute (`CASCOPROTECTOR`)

- [ ] Donner le Casque de Brute à un Pokémon et tenter une capacité de statut :
  elle doit être refusée sans perdre de PP. Refaire sous Maladresse, Embargo
  et Champ Magique : la capacité doit redevenir utilisable.
- [ ] Comparer avec et sans Casque de Brute le recul de Bélier (`0FA`),
  Damoclès (`0FB`), Fracass'Tête (`0FC`), Électacle (`0FD`) et Boutefeu
  (`0FE`). L'objet actif doit empêcher le recul sans supprimer les dégâts
  infligés ni l'effet additionnel de la capacité.
- [ ] Refaire un recul en Duo, puis avec l'objet tenu par l'hôte et l'invité
  Coop. Vérifier les PV sur les deux écrans et après reconnexion.
- [ ] En Duo, placer Poudre Fureur face à un attaquant portant les Lunettes
  Filtre : son coup doit garder la cible choisie. Refaire sous Maladresse,
  Embargo et Champ Magique : le coup doit être redirigé vers Poudre Fureur.
