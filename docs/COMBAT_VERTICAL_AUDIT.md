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
reconnexion. Le second lot météo du 2026-10-21 ajoute `SLUSHRUSH`,
`PODERGELIDO`, `OVERCOAT`, `AIRLOCK` et `CLOUDNINE`. Les suppressions de météo
sont dérivées de tous les combattants actifs, y compris en double, sans effacer
la météo autoritaire. Les trois météos extrêmes source (`PRIMORDIALSEA`,
`DESOLATELAND`, `DELTASTREAM`) sont aussi gérées avec leur durée persistante,
leurs blocages de types et leur extinction lorsque le dernier porteur quitte le
terrain. Le lot de passifs du 2026-10-21 ferme aussi `BADDREAMS`, `EARLYBIRD`,
`HYDRATION`, `POISONHEAL` et `SPEEDBOOST` dans le noyau commun. Il respecte les
valeurs source de 1/6 pour Mauvais Rêve et 1/8 pour Soin Poison, la pluie extrême
pour Hydratation et l'absence de gain d'Impulsion lors d'une arrivée en cours de
tour. Le lot de contrôle des PP et objets du même jour porte `PRESSURE`,
`UNNERVE` et `KLUTZ` : Pression facture chaque porteur adverse ciblé, Tension
bloque les baies de toute l'équipe opposée active et Maladresse conserve l'objet
tout en neutralisant ses effets. L'audit local atteint désormais 449 problèmes,
dont 97 talents. Le lot suivant porte `UNBURDEN`, `PICKUP` et `HARVEST` autour
d'un historique commun des objets perdus ou consommés, persistant dans les
snapshots autoritaires. L'audit atteint ainsi 447 problèmes, dont 95 talents.
Le lot de contrôle des actions porte ensuite `OBLIVIOUS`, `STENCH`,
`CURSEDBODY`, `INFILTRATOR` et `MAGICBOUNCE`, avec les mêmes règles en duel et
en double. Le lot de modificateurs du 2026-10-22 porte ensuite `HUSTLE`,
`ANALYTIC`, `CORTANTE`, `FURCOAT` et `WATERBUBBLE`, y compris l'ordre positionné
en double, la famille Psyko-Choc et l'immunité à la brûlure. Après régénération,
l'audit atteint 433 problèmes, dont 81 talents ; le registre extrait compte 153
talents pleinement supportés, 1 partiel et 101 absents. Le lot réactif suivant
porte `JUSTIFIED`, `BRUTALIDAD`, `COLORCHANGE` et `MOXIE` sur les hooks communs
d'impact, de contact et de K.O. L'audit descend à 430 problèmes, dont 78 talents ;
le registre extrait atteint 157 talents pleinement supportés, 1 partiel et 97
absents. `JUSTIFIED` est bien couvert par le registre complet mais ne retire pas
de problème du périmètre jouable actuel, qui ne le référence pas encore.
Le lot réactif suivant porte `TERMOCONVERSION`, `CUERPOHORNEADO`, `MUMMY` et
`GRIMNEIGH`. Les réactions Feu, le remplacement temporaire du talent au contact
et les bonus après K.O. utilisent les mêmes hooks par impact et par emplacement.
L'audit atteint 426 problèmes, dont 74 talents ; le registre extrait compte 161
talents pleinement supportés, 1 partiel et 93 absents.
Le lot Explosion porte ensuite `AFTERMATH`, `DAMP` et la fonction `0E0` de
`SELFDESTRUCT`/`EXPLOSION`. Le sacrifice intervient pendant l'exécution réussie,
avant les réactions post-impact ; le résolveur positionné conserve néanmoins
toutes les cibles d'une attaque de zone et ne publie qu'un seul K.O. du lanceur.
Moiteur inspecte les quatre emplacements actifs, bloque l'action après dépense des
PP et neutralise aussi Boom Final ; Brise Moule contourne ces deux protections.
Boom Final retire un quart des PV maximaux après un K.O. de contact, sauf Garde
Magik. Les doubles K.O. produisent désormais une égalité explicite. Après
régénération, l'audit atteint 423 problèmes, dont 73 talents ; le registre compte
163 talents pleinement supportés, 1 partiel et 91 absents, ainsi que 103 fonctions
d'attaque supportées sur 353.
Le lot défensif suivant porte `ICESCALES`, `FLUFFY`, `MARVELSCALE` et
`DEFEATIST` dans le calculateur commun. Il conserve les multiplicateurs exacts de
Z, y compris Défense Spéciale ×1,5 pour Écailles Glacées, la priorité de la
faiblesse Feu de Toison Épaisse sur sa réduction de contact et le seuil inclusif
de Défaitiste. Écaille Spéciale reconnaît aussi les statuts propres à Z ; Brise
Moule contourne les trois protections adverses. L'audit atteint 419 problèmes,
dont 69 talents ; le registre extrait compte 167 talents pleinement supportés, 1
partiel et 87 absents. Les 103 fonctions d'attaque et 51 animations manquantes ne
changent pas dans ce lot.
Le lot vent porte ensuite `WINDRIDER`, `WINDPOWER` et `05B` (`TAILWIND`). La
classification des seize capacités de vent est partagée ; Surcavents absorbe et
augmente l'Attaque, Énergie Éolienne arme Charge sans absorber, et Vent Arrière
double la Vitesse du camp tout en activant ces talents chez les deux alliés. Le
switch sous Vent Arrière et les snapshots Coop utilisent le même état de camp.
Après régénération, l'audit atteint 416 problèmes, dont 67 talents et 298
fonctions manquantes ; le registre extrait compte 169 talents pleinement
supportés, 1 partiel et 85 absents, ainsi que 104 fonctions supportées sur 353.
Les 51 animations manquantes restent inchangées.
Le lot partenaire porte ensuite `PLUS`, `MINUS`, `FRIENDGUARD` et `TELEPATHY`
avec un contexte d'allié fourni par les emplacements doubles au calculateur
commun. Plus et Minus renforcent les capacités spéciales uniquement avec un
partenaire compatible conscient ; Garde Amie protège seulement ce partenaire et
Télépathe absorbe seulement les capacités offensives alliées. Brise Moule
contourne les deux protections défensives. L'audit atteint 413 problèmes, dont 64
talents ; le registre extrait compte 173 talents pleinement supportés, 1 partiel
et 81 absents. Fonctions et animations restent respectivement à 104 supportées,
298 manquantes et 51 manquantes.
Le lot de calcul suivant porte `CAMORRISTA`, `REALEZA`, `MERCILESS` et
`TANGLEDFEET`. Camorrista s'appuie sur la liste source exacte des dix coups de
pied ; Realeza renforce les dix-sept types offensifs non-Normal sans dépendre des
types du porteur ; Ensañamiento garantit le critique contre une cible empoisonnée
dans l'ordre source des immunités et de Chant Canon ; Tumbos multiplie l'esquive
d'un porteur confus et reste contourné par Brise Moule. Les multiplicateurs sont
tracés par le calculateur commun et le seuil de précision nomme également Tumbos.
Après régénération locale, l'audit atteint 409 problèmes, dont 60 talents ; le
registre compte 177 talents pleinement supportés, 1 partiel et 77 absents. Les
104 fonctions supportées, 298 fonctions manquantes et 51 animations manquantes
restent inchangées.
Le lot de classifications porte ensuite `BULLETPROOF`, `PUNKROCK`,
`VOZVALQUIRIA` et `PENETRANTE`. Les drapeaux source `n`, `k` et `h` alimentent
respectivement les bombes, les capacités sonores et le haut taux critique.
Antibalas bloque chaque cible concernée, Punk Rock renforce les sons infligés et
réduit ceux reçus, Voz Valquiria convertit Normal en Glace sans bonus et peut
apeurer avec un son, tandis que Penetrante peut apeurer avec une capacité `h`.
Le drapeau `h` augmente aussi désormais le cran critique général comme dans Z.
L'audit atteint 405 problèmes, dont 56 talents ; le registre extrait compte 181
talents pleinement supportés, 1 partiel et 73 absents. Fonctions et animations
restent à 104 supportées, 298 mécaniques manquantes et 51 animations manquantes.

Le lot de réactions partagées porte `CONTRARY`, `CAPATOXICA`, `OLORPORCINO` et
`PURIFYINGSALT`. Le changeur de crans inverse désormais les gains comme les
baisses dans leur direction réelle, en conservant le contournement adverse par
Brise Moule. Les impacts alimentent les Pics Toxik ou la baisse d'esquive selon
le talent et l'emplacement exact ; Sel Purificateur couvre les sept statuts de Z
et réduit les dégâts Spectre. L'audit atteint 401 problèmes, dont 52 talents ;
le registre extrait compte 185 talents pleinement supportés, 1 partiel et 69
absents. Les compteurs restent à 104 fonctions supportées, 298 mécaniques
manquantes et 51 animations manquantes.

Le lot d'interactions de type porte `NORMALIZE`, `STEELWORKER`, `EARTHEATER` et
`CANASTO`. Normalisation convertit toute capacité en Normal avant les autres
conversions et applique le multiplicateur source de 1,5, y compris à une capacité
déjà Normal. Steelworker renforce de 1,5 les dégâts Acier. Earth Eater absorbe
les capacités Sol après leur test de précision, bloque leurs effets et restaure
jusqu'à un quart des PV maximaux. Canasto multiplie par 0,3 les dégâts Vol et
Roche reçus. Brise Moule contourne les deux talents défensifs, mais pas les bonus
offensifs. L'audit atteint 397 problèmes, dont 48 talents ; le registre extrait
compte 189 talents pleinement supportés, 1 partiel et 65 absents. Les compteurs
restent à 104 fonctions supportées, 298 mécaniques manquantes et 51 animations
manquantes.

Le lot d'auras globales porte `DARKAURA`, `FAIRYAURA`, `AURADORADA` et
`AURABREAK`. Le calcul commun reçoit désormais la liste bornée des talents de
tous les combattants actifs et conscients. Aura Sombre, Aura Féérique et Aura
Dorée multiplient respectivement par 4/3 les dégâts Ténèbres, Fée et Électrik de
n'importe quel camp, sans cumul entre plusieurs porteurs. La présence de Brise
Aura remplace ce facteur par 2/3 ; Brise Moule ne le contourne pas. La liste est
recalculée après chaque K.O. ou remplacement et par cible en double. L'audit
atteint 393 problèmes, dont 44 talents ; le registre extrait compte 193 talents
pleinement supportés, 1 partiel et 61 absents. Les compteurs restent à 104
fonctions supportées, 298 mécaniques manquantes et 51 animations manquantes.

Le lot de conversions propres à Z porte `COLEOPTERO`, `PIELMALDITA`,
`PIELELECTRICA` et `TINTINEO`. Le résolveur commun convertit les seules capacités
Normal en Insecte, Spectre, Électrik ou Psy avant STAB, immunités et absorptions.
Les trois premiers talents appliquent le facteur source de 1,2 ; Tintineo n'en
applique aucun malgré son indicateur Ruby, absent de la liste source des bonus,
et publie une annonce générique lors de son entrée. L'audit atteint 391 problèmes,
dont 42 talents ; le registre extrait compte 197 talents pleinement supportés,
1 partiel et 57 absents. Les compteurs restent à 104 fonctions supportées,
298 mécaniques manquantes et 51 animations manquantes.

Le lot d'amplificateurs typés porte `ALBINISMO`, `PEDANTE`, `INFLAMABLE`,
`TRANSPORTARROCA` et `DRAGONSMAW`. Une table déclarative commune, partagée avec
Floración et Steelworker, applique le facteur source de 1,5 aux seuls dégâts
Glace, Psy, Feu, Roche ou Dragon du porteur. Le multiplicateur suit STAB et le
type effectif, s'applique à chaque cible de zone et reste indépendant de Brise
Moule. L'audit atteint 388 problèmes, dont 39 talents ; le registre extrait
compte 202 talents pleinement supportés, 1 partiel et 52 absents. Les compteurs
restent à 104 fonctions supportées, 298 mécaniques manquantes et 51 animations
manquantes.

## Lot 4 — Route 3, Nouvelle Réunion, Route 4 et Bois-en-Tronc

Frontière automatisée le 2026-10-19 : Maps 023 à 029, soit Rena, Gerard,
Amarna, Fibo, Hector et Zaida, Maya, Asta et les trois variantes de Crisanto,
ainsi que les rencontres terrestres et de pêche déclarées jusqu'au niveau 18.
Le prédicat source `$Trainer.ablePokemonCount == 1` est évalué depuis l'équipe
personnelle consciente et non depuis un numéro d'événement. Il choisit le combat
simple ou double avant que l'hôte n'ouvre le combat autoritaire ; l'invité reçoit
le snapshot et la présentation habituels.

Le registre commun porte désormais les fonctions nécessaires à l'ouverture de
ces équipes et rencontres : Paralysie garantie (`008`), Amnésie (`033`),
Grincement (`04C`), Croco Larme (`04F`), Double Pied (`0BD`), Soin (`0D5`),
Lance-Boue (`09D`) et Mur Lumière (`0A3`). Les capacités de bas niveau
Bâillement, Attraction, Chargeur, Lilliput, Fléau, Assistance et les attaques
dont l'effet secondaire reste incomplet sont acceptées par le même protocole.
Les talents déterministes Battant, Médic Nature, Farceur, Peau Herbée,
Herbivore, Inconscient et Absorb Eau sont exécutés par le noyau partagé.

Les combats de nid `pbBossFight` sont convertis en rencontres scénarisées
incontournables. Une liste d'espèces indexée par une variable narrative est
résolue par l'hôte, jamais par le client. Les récompenses aléatoires sont tirées
avec l'état RNG persistant puis stockées dans la rencontre en attente ; objets et
switches ne sont validés qu'après la victoire. Ce contrat couvre solo, hôte,
invité observateur et reconnexion sans dupliquer la règle métier.

Correction narrative du 2026-10-19 : le Couafarel du nid est créé pendant que le
switch source 482 est actif. Le hook `onWildPokemonCreate` lui applique alors
`CADUCO`, nommé `Exténuation` (`EXT`) dans la version française. Cette condition
est maintenant extraite dans `encounter-modifiers.json` et appliquée avant
l'ouverture du snapshot autoritaire. Le même mécanisme couvre les statuts de zone
des Maps 138 à 140 sans règle propre à cet événement. Formes, capacités forcées,
objets, IV/EV, shiny et surnoms des autres branches statiques du hook utilisent
désormais ce même catalogue. Les deux conditions shiny dépendant d'un contexte
dynamique non porté restent listées dans son audit. Le niveau aléatoire de Map999
et les profils de statistiques de boss de la variable 300 sont portés et persistés
avant l'ouverture du snapshot autoritaire.

Fermeture P0 du 2026-10-19 : `pbBossFight` reproduit maintenant le format source
asymétrique deux contre un lorsque l'équipe préparée contient au moins deux
Pokémon. Le boss reste seul sur son camp et l'hôte commande ses deux emplacements.
Comme le combat est déjà double, un invité Coop reste observateur et ne peut pas
s'ajouter au terrain. Le profil de rangs préparé par la variable 300 est appliqué
au combattant adverse, annoncé par la présentation commune, persisté dans la
rencontre et restauré sans reroll après reconnexion.

Le nid insecte de Map028 utilise également l'opérande aléatoire natif de RPG Maker
pour la variable 183. Le tirage est fait une fois par le RNG autoritaire persistant ;
l'espèce et la récompense restent donc stables pendant toute la séquence. La scène
post-combat de Couafarel peut repositionner ses acteurs grâce à la commande
générique `set-event-location`, publiée comme les autres poses de PNJ aux joueurs
présents. Deux téléportations neutres sont disponibles dans Test dev pour la
recette des nids de Map024 et Map028 ; elles ne modifient aucun switch narratif.
Le tirage Dardargnan niveau 17 est maintenant constructible : `TWINEEDLE` (`0BE`)
résout ses deux impacts et sa chance d'empoisonnement par impact dans le noyau
commun, et traverse le même validateur en solo et dans la room Coop.

Fermeture des mécaniques partielles du 2026-10-19 : `CHARGE`, `DEFOG`,
`ASSURANCE`, `ROUND`, `RAGE`, `FLAIL`/`REVERSAL`, `HELPINGHAND`, `LEECHSEED`,
`COVET`/`THIEF`, `BUGBITE`/`PLUCK`, la famille `TAKEDOWN` et `RAPIDSPIN` sont
désormais exécutées complètement par le noyau commun simple/double. Cela couvre
les seuils exacts de Fléau, les combos de tour et d'allié, le drain lié à la
position en double, le recul et ses immunités, ainsi que le nettoyage des écrans,
terrains, pièges et graines. Le transfert d'objet est temporaire contre un
Dresseur et conservé après un combat sauvage, y compris au règlement Coop.

Le catalogue des objets tenus continue d'être étendu par lots : Picore/Piqûre
appliquent l'effet des Baies déjà admises par ce contrat, sans inventer l'effet
d'une Baie encore absente du moteur. L'absence de mapping source de l'animation
de `THIEF` conserve le fallback prévu par l'audit.

Validation manuelle du 2026-10-19 : le porteur a validé avec ses assets locaux
le parcours complet Maps 023 à 029 ainsi que les nids de Couafarel et insecte.
La recette couvre le déclenchement, les combats, leurs fins et les suites de
scène ; ce lot vertical est donc fermé fonctionnellement.

## Lot 5 — Route 5, Maps 055–056 — portage automatisé terminé, recette manuelle attendue

Le pipeline accepte désormais un périmètre `map:ID`. Il réunit les rencontres de
la carte, les combats de Dresseurs et les combats sauvages scénarisés extraits de
ses événements. Les capacités par niveau sont arrêtées au niveau réel de chaque
Pokémon et un Dresseur sans index de talent forcé utilise son premier talent
normal, comme la construction runtime. Ce périmètre évite de bloquer une zone sur
des apprentissages futurs ou des talents cachés qu'elle ne peut pas rencontrer.

Premier sous-lot porté dans le noyau partagé : Écrasement (`010`), Pouvoir Antique
(`02D`), Soucigraine (`064`), Ombre Nocturne (`06D`), Acrobatie (`086`) et Sabotage
(`0F0`). Les dégâts fixes respectent les immunités de type ; Soucigraine conserve
la liste de talents non remplaçables de Z ; Sabotage applique son multiplicateur,
Viscosité et la restitution de l'objet après le combat. Les événements tactiques
de changement de talent et de perte d'objet traversent le même snapshot validé et
la même présentation en solo et en Coop.

Le second sous-lot ferme Taillade (`091`), Ampleur (`095`), Force Nature (`0B3`),
Roulade (`0D3`), Morphing (`069`), Brouhaha (`0D1`) et Embargo (`0F8`). Les
compteurs de verrouillage, leur remise à zéro, les PP, le réveil et le blocage des
objets font partie du snapshot tactique partagé. Force Nature reçoit un contexte
générique d'environnement (`grass`, `cave`, eau, sable, neige, etc.) depuis la
rencontre, sans condition liée à une carte.

Les talents requis sont raccordés au même noyau simple/double : Chlorophylle,
Glissade, Corps Ardent, Gloutonnerie pour les Baies actuellement supportées,
Poisseux, Créa-Herbe, Vaccin, Imposteur, Feuille Garde, Brise Moule, Tempo Perso,
Phobique, Peau Dure et Fuite. Intimidation est également sortie du statut partiel.
Morphing conserve l'identité originale et la restaure au retrait ; Imposteur et
Créa-Herbe s'appliquent à l'entrée, y compris après remplacement. Les effets
persistants sont communs au solo, à l'hôte et à la room autoritaire, donc restaurés
depuis le snapshot après reconnexion.

Après `prepare:local` du 2026-10-19, `map:55` ne remonte plus aucune alerte et
`map:56` ne remonte que l'animation `FAINTATTACK`. Cette capacité n'a réellement
aucune correspondance dans `move2anim.dat` : le fallback reste volontairement
actif conformément à la règle d'import, sans animation inventée. Le code du lot
est terminé ; la fermeture fonctionnelle attend encore la recette manuelle des
cinq Dresseurs et rencontres en solo, hôte, invité puis après reconnexion.

## Correctif transversal — Clairière Collinaire, Map046

Le combat narratif contre `NUBILA1:Núbila:0` dispose maintenant de toutes ses
dépendances bloquantes : convention Essentials des index de talents, Acidarmure,
Gyroballe, Ignifugé, Alchimie Vil et Baie Lichii/Gloutonnerie. Le test du pont
source reconstruit l'équipe réelle de trois Pokémon. Son audit ciblé ne conserve
que l'animation de `LUZDECADENTE`, absente de la table source et donc rendue par
le fallback. Une recette manuelle du déclenchement et de la reprise de scène sur
Map046 reste requise.
