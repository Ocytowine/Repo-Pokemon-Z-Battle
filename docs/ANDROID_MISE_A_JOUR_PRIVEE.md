# APK Android privée et mises à jour

## Ce qui fonctionne

L'application compare son `versionCode` à un manifeste hébergé par le Worker
`pokemon-z-battle-cloud-save`, derrière Cloudflare Access. Elle vérifie au
démarrage et depuis Menu → Options → Mises à jour Android. Une nouvelle version
affiche une proposition de téléchargement ; le navigateur ouvre la page protégée
par Access, puis Android demande au joueur de confirmer l'installation. Une
connexion Access est nécessaire pour voir et télécharger une version privée.
La vérification ne bloque jamais le jeu hors ligne.

Pour une première installation, partager le lien permanent suivant avec une
adresse autorisée dans la stratégie Cloudflare Access du Worker :
`https://pokemon-z-battle-cloud-save.mimidu33-eb.workers.dev/api/updates/download/latest`.
Il télécharge toujours l'APK indiquée par le manifeste courant. Les liens avec
un numéro de version restent réservés au bouton de mise à jour du jeu. Pour
inviter un nouveau joueur, ajouter son adresse exacte à la stratégie Access ;
il recevra un code par courriel à la connexion. Chaque compte garde ses propres
sauvegardes cloud.

Une mise à jour Android conserve les données locales seulement si l'identifiant
de l'application et le certificat sont identiques et si le nouveau `versionCode`
est accepté. Chaque version diffusée doit être construite avec la clé dédiée
créée sur ce PC. [Règles Android](https://developer.android.com/google/play/app-updates),
[signature](https://developer.android.com/studio/publish/app-signing).

## Première migration depuis l'APK debug

La première APK de diffusion possède une **autre signature** que l'ancienne
APK de débogage. La migration a été réalisée sur le Samsung le 28/10/2026 :
copie des deux fichiers de signature hors du PC, vérification des sauvegardes
cloud, désinstallation de la debug, installation de la diffusion, connexion
Cloudflare et récupération des sauvegardes. La désinstallation a effacé les
données locales de la debug, puis la manuelle (Pension Pokémon, Route 5) et
l'automatique (Route 5) ont été récupérées. Les versions diffusées suivantes
utilisent le même certificat et peuvent s'installer par-dessus sans effacer les
données, avec un `versionCode` supérieur.

Le certificat public de diffusion attendu est SHA-256 :
`dda2b8b1d3e930846ad5ff266125402cede1a7e4cb78febedbaacc33930eab4d`.
La clé privée et son mot de passe ne doivent jamais entrer dans Git ou dans une
conversation. Ils sont conservés sur ce PC dans
`C:\Users\Ebaluteau\.pokemon-z-battle\android-signing\release.p12` et
`release-credentials.json`. **Sauvegarder les deux fichiers hors de ce PC avant
toute publication.** Sans eux, les futurs APK ne pourront plus mettre à jour
ceux déjà installés.

Sur un nouveau PC, copier les deux fichiers ensemble dans le dossier
`<profil utilisateur>\.pokemon-z-battle\android-signing\`. Le script de build
retrouve `release.p12` à côté du fichier d'accès ; il n'est pas nécessaire de
modifier un chemin lié à l'ancien PC. Installer le dépôt, Node/pnpm, Android
Studio et le SDK, puis construire avec `android:release`. Vérifier que le
certificat imprimé correspond au SHA-256 ci-dessus avant toute publication.

## Construire une version

1. Modifier `apps/overworld-sandbox/android-version.json` : augmenter
   `versionCode` à chaque nouvelle diffusion, puis choisir `versionName`.
   Conserver `signingCertificateSha256` inchangé.
2. Mettre les notes destinées au joueur dans
   `apps/overworld-sandbox/android-release-notes.md`.
3. Lancer `corepack pnpm test`, `corepack pnpm build`, puis
   `corepack pnpm --filter @pokemon-z-battle/overworld-sandbox run android:release`.
4. Lancer `corepack pnpm --filter @pokemon-z-battle/overworld-sandbox run android:manifest`.
   Cette commande contrôle l'identifiant, le numéro de version et le certificat,
   puis calcule la taille et le SHA-256 du paquet.

L'APK signée se trouve dans
`apps/overworld-sandbox/android/app/build/outputs/apk/release/app-release.apk`.
Le manifeste se trouve à côté dans `latest.json`. Ces fichiers sont ignorés par
Git. La clé ne sert que sur le PC qui construit la version ; un collègue doit
recevoir une copie sûre des deux fichiers de signature pour produire un APK
compatible.

## Publier en privé sur R2

Le Worker lit, dans le bucket R2 privé `pokemon-z-battle-saves-private`, l'APK à
`updates/android/pokemon-z-battle-<versionCode>.apk` et le manifeste à
`updates/android/latest.json`. Il n'annonce une version que si l'APK existe et
que sa taille correspond au manifeste. Déposer **l'APK d'abord**, vérifier sa
taille, puis déposer `latest.json` en dernier. L'ancien manifeste reste actif
jusqu'à cette dernière étape. Le Worker sert le téléchargement en flux et accepte
les reprises partielles.

L'APK actuelle fait environ **823 Mio**. Wrangler ne téléverse pas un objet de
cette taille : sa limite annoncée est 315 Mo. Utiliser le transfert S3 compatible
de R2, par exemple `rclone`, avec un jeton R2 **Object Read & Write** limité
au seul bucket. `rclone` 1.75.1 a été installé sur ce PC. Dans Cloudflare R2 →
Vue d'ensemble → Détails du compte → API Tokens → Gérer, créer un jeton R2
utilisateur (ou compte) avec cette permission et ce bucket. `rclone config`
demande le fournisseur S3 « Cloudflare R2 », l'Access Key ID, le Secret Access
Key et l'endpoint UE :
`https://0212355729bc507e7f5a1720bfe3c100.eu.r2.cloudflarestorage.com`.
Pour ce jeton limité aux objets, activer `no_check_bucket = true` dans la
configuration rclone si la vérification du bucket renvoie une erreur. Ne jamais
copier le secret dans le dépôt ou dans le chat ; Cloudflare ne le réaffiche pas.
Exemple après configuration du remote `r2-prive` :

```powershell
$version = (Get-Content -Raw -Encoding UTF8 "apps/overworld-sandbox/android-version.json" | ConvertFrom-Json).versionCode
$releaseDir = (Resolve-Path "apps/overworld-sandbox/android/app/build/outputs/apk/release").Path
$apkKey = "r2-prive:pokemon-z-battle-saves-private/updates/android/pokemon-z-battle-$version.apk"
rclone copyto "$releaseDir/app-release.apk" $apkKey --progress
rclone lsjson $apkKey --stat
corepack pnpm --filter @pokemon-z-battle/cloud-save-worker exec wrangler r2 object put pokemon-z-battle-saves-private/updates/android/latest.json --file "$releaseDir/latest.json" --content-type application/json --remote --jurisdiction eu
```

Comparer la taille distante à `sizeBytes` dans `latest.json` avant la dernière
commande. Le chemin absolu de `--file` est nécessaire ici, car la commande
`pnpm --filter` s'exécute dans le dossier du Worker. Vérifier ensuite
l'annonce dans le jeu avec un compte Access autorisé et essayer le téléchargement
sur un appareil de test. Le Worker Coop reste distinct et inchangé.

R2 : [téléversement d'objets](https://developers.cloudflare.com/r2/objects/upload-objects/),
[lecture en flux et plages](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).

## État au 2026-10-28

La clé et son fichier d'accès ont été sauvegardés hors du PC. La migration
initiale vers l'APK signée `versionCode 1` a été réalisée sur le Samsung ; les
sauvegardes manuelle et automatique de la Partie 1 ont été récupérées depuis le
cloud et vérifiées sur Route 5, avec six Pokémon et Dardargnan N.21.

Le jeton R2 limité au bucket est configuré localement, sans clé dans le dépôt.
Les APK signées `versionCode 1` et `2` ainsi que le manifeste de la version 2
sont publiés dans R2. Le Samsung, alors en version 1, a affiché « Version 0.1.1
disponible » dans Options. Le téléchargement privé via Chrome et Cloudflare
Access a produit un fichier dont la taille et le SHA-256 correspondent au
manifeste. Android a installé la version 2 par-dessus la version 1 : le
`firstInstallTime` est resté identique et `lastUpdateTime` a progressé. Le jeu
s'ouvre en 0.1.1 (2) et indique que cette version est à jour. Le menu Sauvegarde
montre la Partie 1 manuelle et automatique, chacune avec Dardargnan N.21,
l'équipe 6/6 et le statut cloud « À jour ». Le Worker Coop n'a pas été modifié.

Sur ce Samsung, Chrome a demandé une connexion Access propre au navigateur,
puis l'autorisation Android « Autoriser depuis cette source » avant la première
installation téléchargée. Les prochaines versions devront encore incrémenter
`versionCode`, garder la même clé et être publiées avec l'APK avant le manifeste.

Le 28/10/2026, le Worker `cd4cb405-4708-407c-ad58-f46300fea76f` a ajouté le
lien permanent `/api/updates/download/latest`. Il résout le manifeste actuel et
sert l'APK en flux avec le nom de fichier de sa version. Le test automatisé
vérifie le contenu servi et l'exigence d'une identité Access ; un appel sans
session au lien en ligne renvoie vers la connexion Cloudflare Access.

## Patch 0.1.2 publié depuis le nouveau PC — 2026-10-29

Le `versionCode 3` est construit et signé avec le certificat de diffusion
existant. Son APK et son manifeste sont dans
`apps/overworld-sandbox/android/app/build/outputs/apk/release/` :
870 494 872 octets, SHA-256
`5dba069157d62238b171a34053ffbc47fe8919790621888fb128dbd5c04cfc50`.
Pour compiler sur ce PC, utiliser un JDK 21 dans `JAVA_HOME` ; le JBR 25
d'Android Studio ne satisfait pas le module Capacitor qui demande Java 21.
Le JDK 21 portable local se trouve dans
`%LOCALAPPDATA%\Programs\Temurin21\jdk-21.0.12.1+1`.

Le nouveau jeton R2 est configuré dans
`%APPDATA%\rclone\rclone.conf`, hors dépôt. `pokemon-z-battle-3.apk` a été
envoyé dans le bucket privé et sa taille distante (870 494 872 octets) a été
contrôlée avant l'envoi de `latest.json`. Une lecture R2 après publication
confirme `versionCode 3`, la taille et le SHA-256 du manifeste. Aucun téléphone
n'est connecté en ADB pour vérifier l'installation par-dessus 0.1.1 et la
conservation des sauvegardes. Cette recette reste ouverte.

## Patch 0.1.3 — 2026-10-29

La préparation de l'aventure est découpée en quatre étapes et chaque partie vide
conserve son brouillon local. L'APK `versionCode 4` est signée avec le certificat
de diffusion existant et publiée sur R2 sous
`updates/android/pokemon-z-battle-4.apk`. Sa taille distante contrôlée est de
870 496 552 octets ; le SHA-256 du manifeste est
`03cc515b9f8462b0c304e55c044990521d99d2359338bca16b43bd8609ccd0a7`.
`latest.json` a été envoyé en dernier puis relu depuis R2 : il annonce 0.1.3
avec la taille et l'empreinte attendues. Le téléphone n'était pas connecté en
ADB. Tester l'installation par-dessus 0.1.2, les sauvegardes et le parcours
complet sur Android avant de clore le lot.
