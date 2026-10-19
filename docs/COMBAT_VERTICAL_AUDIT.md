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

Dettes explicites : `BUGBITE`, `RAPIDSPIN`, `COVET`/`THIEF`, `LEECHSEED`,
`CHARGE`, `ASSURANCE`, `ROUND`, `FLAIL`, `HELPINGHAND` et `TAKEDOWN` restent
classées partielles lorsque leur effet complet exige pièges, transfert persistant
d'objet, drain positionnel double, combo d'allié ou recul. L'absence de mapping
source de l'animation de `THIEF` conserve le fallback. La validation manuelle du
parcours et des deux nids reste requise avec les assets locaux.
