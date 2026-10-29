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

- [x] Régénérer l'inventaire local et confirmer les métadonnées du fond pilote.
- [ ] Définir le manifeste de packs et le résolveur commun APK / stockage local.
- [ ] Réaliser le pilote `BosqueZ` avec fond large, socles et effets alignés.
- [ ] Livrer tous les assets source en packs sans exclusion, puis vérifier hors ligne et mise à jour d'un seul pack.
- [ ] Auditer progressivement narration, cartes et combats avant toute première exclusion prouvée.
