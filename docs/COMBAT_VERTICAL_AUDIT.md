# Audit des lots verticaux de combat

Ce document borne les rencontres utilisées pour étendre la fidélité du moteur. Il
ne remplace ni `AI_HANDOFF.md` ni la roadmap : il évite de réauditer tout le jeu à
chaque lot et distingue une donnée importée d'une mécanique réellement exécutée.

## Contrat commun

- Autorité : noyau de combat local en solo, même noyau exécuté par la room en Coop.
- État : PV, PP, crans et effets temporaires appartiennent au snapshot tactique ;
  équipe, inventaire, capture et progression restent personnels.
- Réseau : le client n'envoie que son intention. La room choisit les cibles, tire
  le RNG, applique les effets et réplique événements et snapshot aux participants.
- Persistance : une reconnexion restaure le snapshot autoritaire ; les effets
  temporaires ne sont jamais écrits dans la sauvegarde personnelle et disparaissent
  lorsqu'un Pokémon quitte le terrain.
- Audience : événements tactiques pour les participants et observateurs du combat ;
  règlement personnel uniquement pour son propriétaire.

## Lot 1 — Route 2

Frontière : Jean et les trois variantes de Melia. Agilité (`030`) et Floraison ont
été portées. Bajoues s'active par le hook commun lorsqu'une Baie est effectivement
consommée ; l'équipe de Jean n'en porte simplement aucune.

## Lot 2 — premières captures terrestres et Vin

Frontière validée dans les données locales le 2026-10-12 :

- Route 1 / Map007 : Keunotor, Passerouge, Ceribou, Wattouat, Lépidonille ;
- Bordevin / Map009 : Sapereau, Abo, Granivol, Férosinge, Medhyèna ;
- Route 2 / Map014 : Cabriolaine, Hélionceau, Nidoran femelle et mâle, Roucool,
  Lépidonille ;
- Grotte Navarre / Map016 : Nosferapti, Nodulithe, Onix, Mélofée, Charbi ;
- Dresseuse suivante : Vin (`LADRONA`, version 0), avec Zigzaton, Nodulithe et
  Mimitoss.

Les 21 espèces terrestres se projettent maintenant intégralement au niveau maximal
de leur table sans retirer de capacité. Un passage local a résolu séparément les
69 capacités ainsi obtenues, équipe de Vin comprise. Les fonctions ajoutées sont : peur `00F`,
confusion `013`, concentration critique `023`, Rengorgement `027`, Croissance
`028`, Tornade `077`, Balayette dépendante du poids `09A`, Clairvoyance `0A7`,
Entrave `0B9`, Encore `0BC`, ligotage `0CF`, Malédiction `10D` et Tour Rapide
`110`. Les effets temporaires sont bornés, répliqués par le protocole existant et
effacés au changement de Pokémon. Tour Rapide couvre la Vitesse et le ligotage ;
les pièges de terrain seront complétés avec leur futur lot puisqu'aucun n'existe
dans cette frontière.

Correctif du 2026-10-13 : le rapport d'un combat contre Hélionceau a montré que
`RIVALRY` était importé mais inerte. Le calculateur commun reproduit maintenant le
Ruby de Z : ×1,25 contre un Pokémon du même genre et neutre dans les autres cas.
Le malus ×0,75 existe dans l'estimation de son IA, mais pas dans le calcul réel du
combat source. Le multiplicateur est exposé dans la trace de dégâts et couvert par
le même noyau en simple, double et Coop.

Extension talents du 2026-10-20 : Œil Composé applique maintenant le multiplicateur
de précision ×1,3 du script source et Lentiteintée double les dégâts lorsque
l'efficacité est inférieure à la neutralité. Fermeté partage le garde-fou de survie
à 1 PV du noyau commun lorsqu'un Pokémon à pleine vie reçoit un coup fatal. Les
trois hooks vivent dans le calculateur autoritaire utilisé en solo, simple, double
et Coop. Œil Composé reste partiel jusqu'au tirage des objets sauvages 50/30/20 ;
Fermeté reste partiel jusqu'aux capacités K.O. en un coup. Le talent observé sur
un Pokémon sauvage est désormais conservé lors d'une capture locale ou partagée,
au lieu d'être relancé avec l'identité du nouveau propriétaire.

Hors frontière volontaire : pêche, Surf et autres méthodes de rencontre ne sont
pas encore déclenchables par l'overworld ; les espèces correspondantes ne sont donc
pas annoncées comme jouables. Les rencontres de Navarroc / Map017 et la Forteresse
(Alexandre, Micael, María, Canola) forment le prochain lot. Celui-ci devra aussi
porter les objets tenus des équipes source, notamment Baies, Gemmes et Évoluroc.

## Lot 3 — Navarroc et Forteresse

Frontière portée le 2026-10-12 :

- Map017 terrestre : Flabébé, Tarsal, Couaneton, Coxy, Snubbull et Insolourdo ;
- Forteresse : Alexandre versions 0/1, Micael versions 0/1, María versions 0/1,
  puis Canola version 0 ;
- données complètes des membres source : capacités explicites, objet tenu et index
  de talent forcé. Le Croagunk de Canola reçoit donc bien `DRYSKIN`, pas le premier
  talent de son espèce par défaut.

Les fonctions ajoutées au noyau commun sont `009`, `012`, `01E`, `022`, `049`,
`04B`, `04D`, `07B`, `088`, `093`, `09E`, `0A1`, `0A2`, `0AA`, `0AD`, `0BA`,
`0C0`, `0E8`, `0F4`, `10E` et `116`. Elles couvrent notamment Bluff, Coup Bas,
Choc Venin, Reflet, Air Veinard, Tourniquet, Anti-Brume, Provoc, Dépit,
Détection/Ténacité, poursuite conditionnelle, attaques multiples et consommation
de Baie par Piqûre. Le code source anormalement court `00` de Vent Féérique est
normalisé génériquement en `000`, sans règle liée à l'espèce.

Les Gemmes Combat/Insecte, l'Évoluroc, la Baie Aranja et la Baie Payapa sont des
objets tenus exécutables et consommables. Leur état est dans le snapshot tactique ;
la consommation d'un objet personnel revient dans le règlement du propriétaire.
Le hook commun de Baie active aussi Bajoues. Les effets de camp Reflet/Air Veinard
et l'effet de terrain Tourniquet sont répliqués et décrémentés par le même moteur
en simple et en double. Les talents nécessaires à cette frontière ont reçu leurs
hooks génériques, dont Peau Sèche, Contraguardia, Impassible, Regard Vif,
Sérénité, Mue, Essaim, Synchro, Intimidation et Régé-Force lorsque leur condition
peut se produire.

Complément du 2026-10-13 : la condition répétée dans les scripts Ruby de Z pour
`SHIELDDUST` est volontairement conservée. Le talent ne bloque les effets
secondaires que si son porteur tient également `COVERTCLOAK` (Cape Obscure) ; ni
le talent ni l'objet ne suffisent seuls. Cette combinaison couvre aussi le recul
additionnel de Crocs Éclair et utilise le même objet tenu en solo et en Coop.

Validation locale : 19 instances issues de la frontière ont été projetées, puis
leurs 74 emplacements de capacités ont été résolus séparément contre les catalogues
2.12 FR, sans retrait de capacité. Les tests couvrent aussi les objets à usage
unique et leur hook partagé en combat double.

Fermeture P0 du 2026-10-13 : les objets du Dresseur sont conservés dans son camp
autoritaire. L'IA source utilise un soin garanti sous un quart des PV et avec le
tirage 30 % de Z sous la moitié, puis l'objet disparaît du snapshot et reste
consommé après reconnexion. Poursuite intercepte maintenant le Pokémon sortant
avant le changement en simple et en double. `ProtectRate` est répliqué, double
après chaque Protection/Détection/Ténacité réussie et revient à 1 après un échec
ou une action non protectrice. Enfin, chaque frappe de `0C0` produit son propre
dégât, impact et palier de PV au lieu d'un total agrégé. Les fonctions `088`,
`0AA` et `0C0` passent de partielles à supportées dans le rapport moteur.

La frontière Forteresse n'a plus de dette P0 automatisable connue. Sa recette
manuelle solo/hôte/invité reste requise avant de fermer `STAB-BATTLE-1`. La pêche
de Map017 reste hors frontière comme au lot précédent. L'amélioration générale du
choix tactique de l'IA constitue un lot distinct ; ce jalon ne porte que la
décision d'objet observée dans les scripts source.

Extension du 2026-10-13 : la fonction `048` de `SWEETSCENT` est supportee dans le
noyau commun. Elle retire deux crans d'Esquive avec les nouvelles mecaniques de Z
et son ciblage `04` atteint tous les adversaires actifs en double. Projection,
protocole Coop et rapport moteur acceptent le meme identifiant. L'effet de terrain
de Doux Parfum, qui tente une rencontre hors combat, reste hors de cet audit de
combat et devra etre raccorde au module de rencontres.

Correction issue du rapport `local-52-1` : le reglement d'un Dresseur solo ne
reutilise plus la formule sauvage historique. Le ledger commun suit les Pokemon
engages, exclut les participants K.O. au moment du credit et transmet les credits
au calculateur `pokemon-z-participant` deja utilise en Coop. Bonus Dresseur,
partage, gains multiples et details d'arrondi sont couverts par les tests. Le cas
Remi/Fluvetin passe ainsi de 143 EXP sauvages a 142 EXP Dresseur pour Feunnec.

Extension Pickpocket du 2026-10-20 : après une attaque de contact qui inflige des
dégâts, un porteur sans objet vole l'objet tenu de l'attaquant. Le transfert, son
talent et sa provenance font partie du snapshot tactique commun. La room applique
la règle source qui interdit à un adversaire sauvage de voler l'objet personnel
du joueur ; un Pickpocket du joueur peut en revanche prendre l'objet du sauvage.
En combat de Dresseur, le transfert est visible pendant le combat mais le
règlement local ou Coop restaure les objets de leurs propriétaires initiaux. Une
consommation sans transfert reste persistante. L'audit de Vin ne signale donc plus
`PICKPOCKET` et conserve seulement les dettes partielles `STURDY` et
`COMPOUNDEYES`.

Lot groupé dégâts du 2026-10-20 : Adaptabilité, Poing de Fer, Prognathe, Griffe
Dure, Technicien, Sniper, Isograisse, Filtre, Solide Roc et Multiécaille utilisent
désormais le même pipeline de dégâts. Les drapeaux contact, poing et morsure sont
lus depuis les capacités extraites ; les autres conditions reposent sur la
puissance, le STAB, le critique, le type, l'efficacité ou les PV pleins. Les
modificateurs offensifs et défensifs se composent dans une liste de trace unique,
en simple, double, solo et Coop.

Lot groupé contact du 2026-10-20 : Corps Ardent, Point Poison, Effet Spore, Peau
Dure, Épine de Fer, Poisseux et Toucher Toxique partagent désormais le même hook
post-dégâts. Les probabilités 30 %, le tirage des trois statuts d'Effet Spore, les
immunités poudre, les dégâts de 1/8 des PV maximaux et la baisse de Vitesse suivent
les scripts Z. Les changements utilisent le snapshot et les événements communs ;
les dégâts de talent possèdent aussi leur propre palier de présentation.

Lot groupé immunités du 2026-10-20 : Absorb Eau, Absorb Volt, Herbivore,
Collecteur, Paratonnerre, Motorisé, Torche et Lévitation utilisent un hook commun
avant l'effet de la capacité. Les soins d'un quart des PV maximaux, les hausses de
statistique, l'immunité Sol et l'armement de Torche suivent les scripts Z. Torche
renforce ensuite les attaques Feu de 50 %. En double, Collecteur et Paratonnerre
redirigent aussi les attaques mono-cible vers leur porteur, allié ou adversaire,
et garantissent leur réussite comme dans le contrôle de précision source. Peau
Sèche partage l'absorption Eau, mais reste partielle tant que ses effets météo ne
sont pas portés.

Lot groupé protections passives du 2026-10-20 : Corps Sain, Fumée Blanche et
Hyper Cutter rejoignent le hook commun qui protège déjà les baisses de Défense et
de Précision. Armurbaston et Coque Armure coupent le tirage critique en amont.
Immunité, Échauffement, Insomnia, Esprit Vital, Ignifu-Voile et Armumagma
empêchent leur statut associé et soignent aussi un état incompatible présent à
l'entrée. Tempo Perso bloque et nettoie la confusion. Ces protections s'appliquent
également à Intimidation et aux effets de contact en simple ou en double.

Lot offensif contrecoup du 2026-10-20 : Sans Limite, Téméraire, Tête de Roc,
Multi-Coups et Chanceux sont exécutés par le noyau partagé. Sans Limite compose
son bonus avec les autres modificateurs, coupe tous les effets additionnels et le
recul de l'Orbe Vie. Téméraire reconnaît génériquement les fonctions `0FA` à
`0FE` et `10B`. Tête de Roc bloque seulement le contrecoup des cinq premières,
conformément aux scripts ; Garde Magik couvre aussi la chute. Multi-Coups impose
cinq impacts distincts à `0C0` et Chanceux avance le niveau critique. Les PV de
contrecoup et de chute sont répliqués dans un événement de présentation commun.
L'audit local atteint 574 problèmes, dont 160 talents et 368 mécaniques d'attaque
encore manquants ; le registre compte 70 talents et 62 fonctions pleinement
supportés, avec respectivement 5 et 4 entrées partielles.

Lot réactions statistiques du 2026-10-20 : `STAMINA`, `WATERCOMPACTION`,
`RATTLED`, `WEAKARMOR`, `STEAMENGINE`, `BERSERK` et `ANGERPOINT` partagent un hook
par impact réellement subi. Il conserve les valeurs particulières de Z : Défense
+1 ou +2, Vitesse +1 ou +6, passage strict sous la moitié des PV et Attaque placée
à +6 sur critique. `DEFIANT` et `COMPETITIVE` partagent le hook de baisse causée
par l'adversaire, y compris Intimidation à la création, au changement et sur les
deux emplacements d'un combat double. Le snapshot de room conserve les crans après
reconnexion. L'audit local atteint désormais 565 problèmes, dont 151 talents ; le
registre compte 79 talents pleinement supportés, 5 partiels et 171 absents.
