# Intégration et distribution des ressources Pokémon Z

## Principe

Ce document fixe les décisions pour les images, sons et données du jeu source.
Il distingue **utilité dans le jeu**, **lieu de livraison** et **publication**.
Une ressource absente du portage actuel n'est pas inutile : narration, cartes,
événements et combats ne couvrent pas encore tout le jeu. Jusqu'à preuve
complète, les ressources restent disponibles. Les packs visent d'abord à éviter
de retélécharger les mêmes octets à chaque APK, sans supprimer de contenu.

Ne jamais ajouter les fichiers source, les packs construits, `.pokemon-z/` ou
les secrets R2 à Git. Ce registre ne contient que chemins relatifs et métadonnées.

## Décisions indépendantes par ressource

| Axe | Valeurs | Règle |
| --- | --- | --- |
| Utilité | `confirmée`, `possible`, `exclusion prouvée` | `possible` reste la valeur prudente tant que les références source ne sont pas auditées. |
| Livraison | `APK de démarrage`, `pack local obligatoire`, `pack à la demande`, `hors distribution` | Un pack doit être disponible avant la scène qui l'utilise, puis rester utilisable hors ligne. |
| Publication | `candidate privée`, `publiée privée`, `interdite` | `candidate` ne signifie pas que l'objet existe sur R2. `interdite` exige une preuve ; « pas encore portée » n'en est pas une. |

Chaque décision désigne une version du fichier par son chemin relatif, sa taille
et son SHA-256. Un changement de fichier invalide les métadonnées et la recette
associées. `Hors distribution` ou `interdite` ne supprime jamais le fichier du
dossier personnel du jeu source.

## Chaîne d'intégration

1. **Inventaire.** Comparer `asset-manifest.json` aux fichiers réels de `Graphics`
   et `Audio`, dimensions, taille et SHA-256. Relancer `corepack pnpm prepare:local`
   après toute modification de ressource.
2. **Dépendances.** Lire cartes, événements, événements communs, commandes et
   scripts narratifs, musiques, métadonnées de combat, Dresseurs, espèces/formes,
   résolveurs dynamiques, menus et animations. Une référence inconnue ou
   construite à l'exécution impose la conservation. Une partie jouée ne prouve
   jamais à elle seule qu'un fichier est inutile.
3. **Livraison.** Garder dans l'APK les éléments nécessaires au lancement et au
   premier jeu hors ligne. Livrer le reste en packs immuables, versionnés et
   privés sur R2. Télécharger et vérifier les packs obligatoires **avant** de
   retirer leurs fichiers d'une APK existante.
4. **Activation.** Télécharger avec reprise, vérifier taille et SHA-256, installer
   de façon atomique et garder le pack précédent en cas d'échec. Les sauvegardes
   locales et cloud restent indépendantes. Un pack ne contient aucun code
   exécutable ; une correction du moteur reste une APK signée.
5. **Recette.** Tester première installation, migration depuis l'APK actuelle,
   manque d'espace, téléchargement interrompu, jeu hors ligne, solo, hôte,
   invité et reconnexion. Publier les objets R2 avant le manifeste qui les
   annonce. Mesurer les octets téléchargés pour un patch moteur seul et pour
   le remplacement d'un pack unique.

La version des packs est un état local de l'installation Android. Les ressources
ne changent ni les règles de jeu, ni l'état personnel, narratif ou partagé ; la
room Coop reste autoritaire. Chaque participant résout ses propres ressources.
L'absence d'un pack ne doit jamais changer une décision serveur ou corrompre une
sauvegarde.

## Registre initial des décisions

État au 2026-10-29. Une décision candidate ne vaut pas déploiement.

| Ressource relative à la source | Rôle et dépendances | Décision | Preuve ou action restante |
| --- | --- | --- | --- |
| `Graphics/Battlebacks/battlebgBosqueZ.png` | Fond large de test, variante `BosqueZ`. | Utilité confirmée pour le pilote ; **candidate privée** au premier pack de fonds. | Fichier local **2400 × 1080**, **2 318 047 octets**, SHA-256 `56b106ec0ed2df7fd86ac3fe31a25cb57d27cced28f55d98fb6f7043b46a1f66`. Manifeste local régénéré ; rendu Android réel à valider. |
| `Graphics/Battlebacks/battlebgPraderaZ.png` | Fond large de `Pradera`, variante sélectionnée par le même contrat. | Utilité confirmée pour le pilote ; **candidate privée** au premier pack de fonds. | Fichier local **2400 × 1080**, **2 472 933 octets**, SHA-256 `ac7cb98019ff31b31dc49861b5dd4ff9bfd703b9ac74022c8175a96963dfab4d`. Manifeste local régénéré le 2026-10-29 ; rendu navigateur et Android réels à valider. |
| `Graphics/Battlebacks/playerbaseBosque.png` et `enemybaseBosque.png` | Socles de `Bosque`, candidats à la composition de `BosqueZ`. | Conserver ; lieu de livraison à décider. | Vérifier leur association et leurs positions ; aucun socle `*BosqueZ` trouvé dans la source locale. |
| `Graphics/Battlebacks/battlebgBosque.png` | Fond 4:3 de `Bosque`, toujours demandé par des cartes. | Conserver. | Le fond large ne prouve pas que l'ancien peut être exclu. |
| `Graphics/Battlebacks/battlebgPradera.png`, `playerbasePradera.png` et `enemybasePradera.png` | Scène complète demandée par plusieurs cartes. | Conserver ; lieu de livraison à décider. | Le fond large reprend les deux socles de cette scène ; aucune exclusion de l'ancien fond n'est autorisée. |

### Ressources interdites à la publication

**Aucune entrée validée.** Une future entrée devra noter chemin et SHA-256,
motif exact, références source examinées, couverture du portage, tests solo/Coop
et repli. Une ressource seulement non utilisée **aujourd'hui** reste `possible`.

## Premier essai : `battlebgBosqueZ.png`

Le fichier source local et sa copie préparée pour Android ont la même empreinte.
Le manifeste extrait décrivait l'ancienne image **1870 × 841** ;
`prepare:local` a été relancé le 2026-10-29 et indique maintenant les dimensions,
la taille et le SHA-256 du fichier actuel.
Le moteur associe actuellement fond, `playerbase` et `enemybase` par suffixe
identique. `BosqueZ` n'a pas de socles correspondants ; les cartes consultées
demandent `Bosque`, pas `BosqueZ`. Lancer simplement un combat sur ces cartes ne
teste donc pas la nouvelle image.

Le pilote résout maintenant par convention la variante large
`battlebg<scène>Z` quand elle existe avec un ratio d'au moins 1,8, et conserve
les socles de la scène complète `Bosque`. La résolution est commune aux rendus
solo et Coop, sans numéro de carte ou d'événement. Le fond occupe le viewport
utile sans étirement ; le plan logique 4:3 des Pokémon, socles, Poké Balls et
effets conserve ses coordonnées. Les HUD et le message sortent de ce plan.
Un contrôle visuel isolé à **800 × 360** et **640 × 320** sous Chrome a montré
le fond, les socles et les HUD dans leur nouvelle disposition. Il reste à
vérifier le vrai combat Android, combat simple et Duo, capture, animations,
solo, hôte et invité.

Une APK **debug locale** a ensuite été construite. Son fond et son
`asset-manifest.json` embarqués portent tous deux le SHA-256 ci-dessus et les
dimensions 2400 × 1080. Aucun appareil n'était connecté en ADB pour la recette.
Cette APK de test n'est pas une publication et conserve encore toutes les
ressources dans le paquet.

Le second fond `battlebgPraderaZ.png` a été ajouté au dossier source après le
premier inventaire. Tant que `prepare:local` n'était pas relancé, le jeu local
ne pouvait pas le sélectionner. Le manifeste a été régénéré et le test du
sélecteur couvre désormais `Pradera` → `PraderaZ`. La mise en page large est
également active dans Chrome, où l'ancien style la réservait à Android.

## Jalons

Le 2026-10-30, les **51** nouveaux `battlebg*Z.png` présents à la racine de
`Graphics/Battlebacks` ont été inventoriés après `prepare:local` : tous mesurent
**2400 × 1080**, pour **127 879 642 octets** au total. L'APK signée locale
précédente mesure **970 770 958 octets** ; sa copie intégrale de `Graphics` et
`Audio` reste le principal poste de distribution. Les anciens `battlebg*.png`
ont été déplacés par le porteur dans `Graphics/Battlebacks/OLD`, tandis que les
socles restent à la racine. Ils ne sont pas déclarés inutiles ni supprimés.

Le résolveur de scènes accepte désormais un fond `Z` seul avec les socles de
même suffixe, sans exiger le fond 4:3 à la racine. Sur le manifeste local, les
51 fonds sont sélectionnables ; **49** ont les deux socles correspondants.
`MirraZ` et `NocturnoZ` ont été ajoutés puis intégrés par la régénération du
manifeste. `NightSkyZ` n'est plus présent. Les deux cas encore incomplets
concernent les **socles**, pas les images de fond : `CaveBrownZ` n'a aucun
`playerbaseCaveBrown`/`enemybaseCaveBrown` et est identique à `CuevaZ`, qui
possède ses socles ; aucune carte extraite ne demande directement `CaveBrown`.
`MolinoZ` a `playerbaseMolino.png` mais pas `enemybaseMolino.png`, alors qu'une
carte source demande `Molino`. Vérifier le rendu de cette carte et la fonction
attendue du socle absent avant toute substitution. Les fonds anciens restent
dans `OLD` comme replis si un futur manifeste manque une variante large.

`corepack pnpm resources:manifest` produit uniquement sous
`.pokemon-z/packs/battlebacks-wide.json` un index local des 51 chemins, tailles,
SHA-256 et clés d'objets immuables. Son identifiant de version est
`d2b48f82764d5a8c0c2efb8198e7b558a9efb7293b5f4eb6582140547deefc8d`.
Les contenus identiques partagent une clé : **50 objets distincts**, soit
**125 263 409 octets** à publier une seule fois. Ce manifeste est une
préparation ; aucun objet ni manifeste n'a été publié, et l'APK continue
d'embarquer tous les fichiers. Le lecteur Android est maintenant codé en pilote ;
une APK qui cesse d'embarquer les octets couverts attend sa recette et la
migration validée.
Un objet modifié doit produire une nouvelle clé ; les autres ne sont pas
retéléchargés.

### Pilote du lecteur Android — 2026-10-30

Le lecteur natif `ResourcePackStore` intercepte uniquement les URL locales
`/__pokemon-z/source/Graphics/Battlebacks/battlebg*Z.png` décrites par un
manifeste activé. Il sert l'objet privé après contrôle de sa taille et de son
SHA-256 ; sinon Capacitor lit la copie embarquée dans l'APK. Le plugin
`ResourcePack` installe chaque objet sous sa clé de contenu, vérifie toutes
les entrées avant activation, puis remplace le manifeste actif par renommage
atomique. Un échec conserve le manifeste précédent et toutes les sauvegardes.
Les objets déjà présents sont réutilisés ; une interruption reprend au fichier
manquant lors du prochain essai. La reprise à l'intérieur d'un PNG n'est pas
encore portée (chaque PNG fait moins de 8 Mo).

Une route privée `/api/resources/` a été préparée dans le Worker existant,
derrière Cloudflare Access. Elle expose uniquement le manifeste
`battlebacks-wide` et les objets PNG adressés par SHA-256. Le bouton Options →
Fonds de combat larges vérifie la disponibilité, télécharge les seuls objets
manquants avec l'authentification de l'appareil et active le pack. En solo,
hôte et invité, il s'agit du même stockage personnel Android, sans état de
jeu, persistance narrative ou réplication Coop supplémentaire.

Le code Worker et l'APK debug compilent localement ; les tests du manifeste,
des routes privées et du moteur passent. Aucun objet, manifeste ou Worker de
ce pilote n'a été publié. L'appareil n'était pas connecté en ADB : la lecture
native, l'installation interrompue, le manque d'espace et le jeu hors ligne
restent à valider sur téléphone. L'APK locale conserve toujours l'intégralité
des ressources et sa taille n'a donc pas encore diminué. Avant une APK allégée,
publier d'abord les objets puis le manifeste privé, valider la migration de
l'APK intégrale et le premier démarrage hors ligne, et établir le traitement
du cas où aucun pack n'est disponible sur une installation neuve.

`corepack pnpm resources:publish` contrôle en lecture seule les 51 fichiers et
leurs empreintes ; son essai local a validé 50 objets uniques, soit
125 263 409 octets. Le mode explicite `--publish` est préparé pour téléverser
les objets vers le bucket R2 privé, puis le manifeste en dernier. Le mode complet
n'a pas été exécuté. L'énumération des buckets à la racine du remote R2 est refusée
par le jeton limité au bucket ; l'accès direct au chemin du bucket fonctionne.

Publication privée autorisée par le porteur : les 50 objets ont ensuite été
envoyés via le mode `--publish --objects-only`. Le contrôle distant retrouve
**50 objets sur 50**, chacun à la taille attendue, pour **125 263 409 octets**.
Le manifeste `latest.json` n'est pas encore présent. Le déploiement Worker a
échoué avant écriture faute de session Wrangler sur ce PC ; une tentative
d'authentification OAuth a été lancée dans le navigateur.
Après déploiement réussi, contrôler la route privée, puis publier le manifeste
en dernier. Aucun APK allégé n'a été construit ni publié.

La tentative OAuth a expiré sans code d'autorisation. Relancer
`wrangler login` avec le porteur présent sur ce PC, puis reprendre dans l'ordre
Worker → lecture privée → manifeste. Les 50 objets sont déjà en place ; ne pas
les retéléverser inutilement.

La seconde autorisation OAuth a réussi. Le Worker privé a été déployé
(version `274b89af-9c7e-4b21-993c-6ee06f3b735b`). Un accès HTTP sans
session à la route du pack renvoie `302` vers Cloudflare Access. Après une
nouvelle vérification des 50 objets distants, le manifeste a été publié en
dernier : la copie R2 annonce la version
`d2b48f82764d5a8c0c2efb8198e7b558a9efb7293b5f4eb6582140547deefc8d`,
51 fichiers et 127 879 642 octets logiques, identiques au manifeste local.
Le téléchargement authentifié depuis l'app et l'installation native restent
à vérifier sur téléphone ; aucun appareil ADB n'était connecté. Aucune APK
allégée ou nouvelle APK de diffusion n'a été publiée.

Le 2026-10-30, une APK locale signée a été reconstruite et installée par USB
pour tester l'import de sauvegarde, puis une nouvelle fois pour corriger la
recherche des fichiers source. La copie Android conserve `Graphics`,
`Audio` et les données extraites dans leur intégralité ; aucune nouvelle
exclusion ni décision de publication de ressource n'a été faite. Aucun pack
ni APK n'a été publié sur R2 pour cet essai.

Le même jour, l'APK locale a été reconstruite pour vérifier l'onglet `Import`
et le choix différé du slot. La copie Android garde toujours l'intégralité de
`Graphics` et `Audio` ; aucune exclusion de ressource n'a été ajoutée.

Une APK locale supplémentaire a été reconstruite et installée pour contrôler
le bouton de suppression des slots. La copie intégrale des ressources Android
a été conservée ; aucun pack ni APK n'a été publié sur R2.

Une APK locale signée supplémentaire a été reconstruite et installée par USB
pour contrôler le HUD des dialogues. `Graphics`, `Audio` et les données extraites
restent copiés intégralement ; aucune exclusion ni publication R2.

Recette du pack privé sur téléphone le 2026-10-30 : l'APK locale signée
`0.1.4` (code 5, 996 007 535 octets) a été installée en conservant les deux
slots. Les 51 fonds larges restent embarqués et leurs empreintes contrôlées.
Un défaut de conversion `sizeBytes` dans le pont Capacitor a été corrigé
(`getInt` pour les objets de moins de 8 Mo). Le téléphone a ensuite téléchargé
et vérifié les 50 objets distincts, activé le pack, retrouvé ce pack après
redémarrage et répondu « déjà à jour » à la seconde vérification. En mode avion,
l'application relancée a encore affiché le pack local comme disponible hors
ligne ; la connectivité du téléphone a été rétablie. Le porteur confirme que
son essai visuel en direct sur ce téléphone fonctionne. La provenance exacte
du fond (pack ou repli APK identique), la panne de téléchargement et le premier
lancement sans réseau restent à vérifier. Il n'y a aucune exclusion de ressource ni nouvelle
publication APK ; cette APK de transition conserve le repli intégral.

### Première APK locale allégée — 2026-10-30

Le build `android:release:slim` contrôle les 51 chemins, tailles et SHA-256 du
manifeste privé avant de copier les ressources Android. Les **49** fonds larges
ayant un ancien fond 4:3 dans `Graphics/Battlebacks/OLD` sont livrés par le pack
privé déjà publié et omis uniquement de cette copie APK. Les deux fonds sans
ancien équivalent (`CaveBrownZ`, `CorazonArmaZ`) restent dans l'APK de démarrage.
Tous les fichiers demeurent dans la source locale et dans le pack publié : il
s'agit d'un changement de lieu de livraison, pas d'une exclusion d'utilité.
Les anciens fonds 4:3 restent embarqués pour un premier jeu hors réseau.

Le moteur lit la disposition locale de l'APK : il sélectionne un fond large si
celui-ci est embarqué ou si la version exacte du pack est activée ; sinon il
utilise le fond 4:3 archivé et ses socles. La même sélection sert en solo et en
Coop, sans modifier les règles de combat ou les sauvegardes.

L'APK signée complète mesurait **996 007 535 octets** ; la version locale
allégée mesure **872 454 607 octets**, soit **123 552 928 octets (12,4 %) de
moins**. Son contenu ZIP a été contrôlé : 2 fonds larges et 49 anciens fonds
archivés sont présents, les 49 autres fonds larges sont absents. Le certificat
de diffusion est inchangé. Installée par `adb install -r` sur le Samsung
SM-S911U1, elle démarre ; les deux slots et le pack actif restent présents.
Le porteur confirme que le combat démarre sur cette APK allégée, affichée en
`0.1.4 (5)` ; la scène précise et la provenance du fond n'étaient pas encore renseignées à ce stade.
Le porteur a ensuite vérifié `battlebgSnowZ.png` en combat réel sur téléphone ;
ce fichier est absent du ZIP de l'APK allégée et l'ancien fond `OLD/battlebgSnow.png`
y est présent. Ce rendu large prouve l'utilisation du pack pour `Snow`.
L'installation neuve sans pack, l'interruption/le manque d'espace et la reconnexion Coop restent à
contrôler avant publication. Une nouvelle diffusion exige un code de version
supérieur à 5. Aucun nouvel APK distant n'a été annoncé.

Complément de recette : `SnowZ`, absent de l'APK allégée, a été vu en combat
sur le téléphone par le porteur ; ce fond large vient donc du pack privé.
L'APK candidate `0.1.5` (code 6) est signée et installée par USB sans perte des
deux slots. Une copie de test séparée, à identifiant `.freshprobe`, a permis
une première installation sans pack en mode avion : titre, slots vides et
prologue d'une nouvelle aventure s'ouvrent. Cette copie a été désinstallée,
le réseau rétabli et l'APK principale restaurée dans le dossier de sortie avec
un SHA-256 conforme à `latest.json`. Le premier combat sans pack et les cas
de transfert interrompu/espace insuffisant restent ouverts. Aucun nouvel APK
ni manifeste distant n'a été publié.

Une seconde copie fraîche sans pack a ensuite atteint un combat enneigé ; le
fond 4:3 de repli est visible avec les Pokémon et le HUD, ce que le porteur a
confirmé en direct. À sa demande, le test de coupure du téléchargement a été
écourté sans résultat : la reprise reste une limite connue de la recette, pas
une validation implicite. La copie de test a été supprimée et le candidat
principal `0.1.5 (6)` restauré ; aucune donnée de ses deux slots n'a été effacée.

Publication privée autorisée après cette validation :
`updates/android/pokemon-z-battle-6.apk` a été téléversé sur R2, puis contrôlé
à **872 454 603 octets**. Le manifeste `updates/android/latest.json` a été
publié en dernier et relu avec la version 0.1.5, le code 6 et le SHA-256 du
candidat signé. Le gain par rapport à l'APK **0.1.4 publiée** (914 063 736
octets) est **41 609 133 octets**, distinct des 123 552 928 octets gagnés par
rapport à l'APK locale complète non publiée. Le pack privé de 50 objets reste
inchangé ; aucune ressource source n'a été exclue. La coupure en cours de
téléchargement et le manque d'espace restent non testés sur appareil.

### Candidat suivant : musiques BGM — 2026-10-30

L'APK 0.1.5 embarque encore `Audio/BGM` : **165 fichiers** (162 OGG, 3 MP3),
**487 582 775 octets** dans la source locale. Le plus gros fait 12 706 027
octets, au-delà de la limite de 8 Mo du pilote PNG. Le prochain pack doit
transférer les fichiers par morceaux, vérifier chaque SHA-256 et reprendre aux
fichiers manquants. Il couvre d'abord tous les BGM : aucune piste n'est classée
inutile sur la seule base du portage actuel. Avant de les retirer d'une APK,
contrôler les appels du titre, des cartes, des événements et des combats, puis
définir la musique embarquée pour le premier jeu hors réseau. L'autorité de ce
stockage est l'appareil local ; solo, hôte et invité résolvent leurs propres
fichiers sans réplication d'état ou changement de sauvegarde.

Recette du pilote musical sur le téléphone `RFCW31LWKBY` : l'APK locale signée
0.1.5 (6), réinstallée avec `adb install -r`, conserve les deux slots. Options
a téléchargé et vérifié les 164 objets ; un second appui a répondu « déjà à
jour » sans transfert. Après arrêt forcé et redémarrage en mode avion, Options
retrouve le pack local. Le mode avion a été désactivé ensuite. Le porteur
confirme que les musiques sont lues depuis le pack. Le lancement hors ligne
doit conserver une musique ; le choix de la piste embarquée dépend de la
finalisation de l'écran d'accueil. La réduction d'APK reste à réaliser avant
de retirer les BGM embarqués ; aucune exclusion de piste.

Correctif local après retour du porteur : l'activation du pack rendait les
musiques silencieuses. Le lecteur natif découpait une plage HTTP que le WebView
Android découpait une seconde fois, ce qui provoquait `PIPELINE_ERROR_READ`.
`BgmPackStore` fournit maintenant le fichier entier au WebView pour ses
requêtes de plage. L'APK locale 0.1.5 (6) a été réinstallée sans effacer les
slots ; le bouton du titre démarre la lecture, le journal n'affiche plus cette
erreur et le porteur confirme que la musique est revenue. Aucun objet R2,
manifeste de pack ou APK publique n'a été modifié par ce correctif.

Publication du correctif le 2026-10-30 : APK signée `0.1.6 (7)` installée
par-dessus la précédente sur le téléphone, avec les deux slots conservés et
le titre musical fonctionnel. L'objet privé `pokemon-z-battle-7.apk` pèse
872 460 135 octets sur R2, identiques au candidat local. Son SHA-256 est
`40041a5a4af9950857860c347f5da3e1361ca75bdfe7086c9ecba6b5159fe62d`.
Le manifeste Android `latest.json` a été publié en dernier et relu. Les
objets du pack BGM restent inchangés ; l'APK embarque encore leurs pistes.

- [x] Régénérer l'inventaire local et confirmer les métadonnées du fond pilote.
- [x] Inventorier les 51 fonds larges et corriger la sélection après déplacement
  des anciens fonds vers `OLD`, sans retirer de fichier du paquet Android.
- [x] Générer localement un premier index immuable par fichier et par SHA-256.
- [ ] Définir le manifeste de packs et le résolveur commun APK / stockage local.
- [x] Préparer le premier lecteur Android avec contrôle d'intégrité, activation
  atomique, repli sur l'APK et téléchargement privé fichier par fichier.
- [x] Publier les objets privés, déployer le Worker, puis publier le manifeste
  après vérification des tailles distantes et du contrôle Access.
- [ ] Terminer la recette sur appareil : téléchargement et migration depuis
  l'APK intégrale validés ; persistance du pack vérifiée hors réseau et rendu
  visuel validé par le porteur. Contrôler encore la provenance du fond affiché,
  l'échec réseau/espace et le premier lancement.
- [ ] Réaliser le pilote `BosqueZ` avec fond large, socles et effets alignés.
- [ ] Livrer tous les assets source en packs sans exclusion, puis vérifier hors ligne et mise à jour d'un seul pack.
- [ ] Auditer progressivement narration, cartes et combats avant toute première exclusion prouvée.

### APK 0.1.7 (8) — 2026-10-30

Cette diffusion de code réutilise la décision de la 0.1.6 : 49 fonds larges
déjà présents dans le pack privé restent omis de l'APK, tandis que le repli
et les autres ressources sont conservés. `android:release:slim` a vérifié les
51 entrées du manifeste local avant la copie ; les packs R2 de fonds et BGM
n'ont pas changé. Aucune ressource nouvelle n'est exclue ou bannie. Seuls
l'APK signée `0.1.7 (8)` et son manifeste de mise à jour ont été publiés.

### Contrôle de la scène Molino — travail local du 2026-11-02

La carte source 286 demande le décor `Molino` et son événement de boss demande
`CombateNido`. Le fond large `battlebgMolinoZ.png`, le repli 4:3 et
`playerbaseMolino.png` gardent leur décision de livraison actuelle ; aucun
fichier n'est copié, exclu, remplacé ou republié. L'absence d'un
`enemybaseMolino.png` homonyme ne doit plus déclencher le décor de secours
par-dessus le fond existant. Le plan adverse reste sans ce socle tant qu'une
preuve source ne définit pas son remplacement. Recette visuelle et audio sur
Android, puis comparaison avec d'autres scènes incomplètes, encore ouvertes.

### Socle adverse Molino — ajout local du 2026-11-02

À la demande du porteur, une variante visuelle du socle joueur a été créée
pour le plan adverse : `Graphics/Battlebacks/enemybaseMolino.png` (PNG transparent,
1 868 × 842, 588 751 octets, SHA-256
`ed15faf6d5ae47c7bd9ecd40249d5d32c944ad602bbd128b9b5b590204e91070`).
Elle est placée uniquement dans les ressources du jeu source local, hors Git ;
`prepare:local` l'a détectée et la copie Android locale l'inclut dans l'APK de
recette. Le fond large `MolinoZ` garde sa distribution par pack et son repli.
Aucun pack ni manifeste distant n'est modifié pour cet essai. La décision
précédente d'afficher le décor sans socle manquant reste valable pour les
autres scènes incomplètes. Le rendu sur téléphone doit être confirmé.

L'APK locale `0.1.7 (8)` du 2026-11-02 a été reconstruite avec
`android:release:slim` puis installée par USB pour cette recette. Elle reprend
la même répartition que l'APK déjà diffusée : 49 fonds larges fournis par le
pack privé et repli 4:3 conservé. Aucun objet de pack ni manifeste R2 n'a été
modifié ; seule la logique de rendu et de combat de la copie locale a changé.
