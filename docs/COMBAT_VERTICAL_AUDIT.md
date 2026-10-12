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
été portées. Bajoues reste inerte tant qu'aucune Baie n'est tenue dans ce combat.

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

Validation locale : 19 instances issues de la frontière ont été projetées, puis
leurs 74 emplacements de capacités ont été résolus séparément contre les catalogues
2.12 FR, sans retrait de capacité. Les tests couvrent aussi les objets à usage
unique et leur hook partagé en combat double.

Limites explicites qui ne sont pas maquillées en fidélité complète : la Super
Potion de l'inventaire de Canola n'est pas encore pilotée par l'IA de Dresseur ;
Poursuite reçoit son multiplicateur quand le contexte de changement est fourni,
mais l'interception exacte du Pokémon sortant reste à raccorder dans l'ordonnanceur
d'équipe ; les frappes multiples produisent encore un impact agrégé dans la
présentation et la probabilité décroissante des protections successives n'est pas
encore simulée. Ces points restent P0 avant de déclarer le combat de Canola fidèle
de bout en bout. La pêche de Map017 reste hors frontière comme au lot précédent.
