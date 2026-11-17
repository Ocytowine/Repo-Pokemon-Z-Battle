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
5. Dès qu'une version **déjà publiée** contient le lecteur de patch, créer le
   différentiel avec l'APK publiée exacte :
   `corepack pnpm --filter @pokemon-z-battle/overworld-sandbox run android:delta <chemin-APK-précédente> <ancien-versionCode>`.
   Le script refuse un patch trop grand et ajoute ses empreintes à `latest.json`.
   Ne pas utiliser une APK locale reconstruite comme base de la version publique.

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
que sa taille correspond au manifeste. Pour un patch, déposer l'objet
`updates/android/pokemon-z-battle-<ancien>-to-<nouveau>.pzb.gz` et vérifier sa
taille. Déposer **l'APK d'abord**, puis les patchs, vérifier leurs tailles et
empreintes, puis déposer `latest.json` en dernier. L'ancien manifeste reste actif
jusqu'à cette dernière étape. Le Worker sert le téléchargement en flux et accepte
les reprises partielles.

Le téléphone accepte un patch seulement si l'APK installée correspond exactement
à la version et à l'empreinte de base. Il reconstruit dans son cache la nouvelle
APK, en contrôle l'empreinte, puis l'envoie à l'installateur Android habituel.
Une base différente utilise le téléchargement complet. Une installation vierge
reste toujours servie par l'APK complète. **La première version qui ajoute ce
lecteur de patch doit encore être téléchargée intégralement** ; tester ensuite
une seconde version avec patch avant de publier ce canal. Prévoir l'espace
temporaire nécessaire à une APK complète reconstruite, même si le transfert
réseau est petit. Le patch n'est ni un pack de ressources ni du code exécuté
indépendamment de l'APK signée.

L'APK publique 0.1.11 (12) fait environ **393 Mo**. Le transfert des gros APK
utilise le protocole S3 compatible
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

## Patch 0.1.4 — 2026-10-29

Après confirmation du porteur, l'APK `versionCode 5` / `versionName 0.1.4` a
été publiée sous `updates/android/pokemon-z-battle-5.apk`. Sa taille distante
est de 914 063 736 octets. Le manifeste `latest.json` a été envoyé en dernier,
par le remote R2 local car la session Wrangler avait expiré. Sa relecture dans
R2 confirme la version, la taille et le SHA-256
`95bff4af9aab87a2754be3a0bad6c2ed885d7c3a776de3655df30a01dc49207a` ;
son type est `application/json`. Le certificat de diffusion est identique aux
versions précédentes. L'installation sur téléphone, les sauvegardes et les
combats solo/Duo/Coop restent à tester par le porteur.

## Patch 0.1.9 — 2026-11-10

L'APK `versionCode 10` est signée avec le certificat de diffusion existant.
Elle a été installée par-dessus la 0.1.8 sur le Samsung sans changer la date
de première installation. L'objet privé
`updates/android/pokemon-z-battle-10.apk` mesure 392 688 590 octets ; son
SHA-256 local et retéléchargé est
`0afd9d64c7ba2dff624626502a9b79cb84e20ab74e651cd4327df1f0a5364eb1`.
Le manifeste `latest.json` a été envoyé ensuite et relu dans R2 ; il annonce
0.1.9 (10) avec les mêmes taille, empreinte et notes. Le lien permanent reste
protégé par Cloudflare Access et redirige vers sa connexion sans session.

## Patch 0.1.10 — 2026-11-10

L'icône native utilise le logo 512 × 512 sans marge ajoutée. L'APK signée
`versionCode 11` a été installée sur le Samsung par-dessus la version 10,
sans changement de la date de première installation. L'objet
`updates/android/pokemon-z-battle-11.apk` mesure 392 718 010 octets ; son
SHA-256 vérifié après retéléchargement est
`8b21a3a1bc3dc12d7c99cababb717c044bdc244afc68abfa2b8a6b148edcf600`.
Le manifeste `latest.json` a été publié après l'APK et relu avec les mêmes
version, taille, hash et notes. Le lien permanent reste protégé par Access.

## Patch 0.1.11 — 2026-11-12

L'APK signée `versionCode 12` a été publiée sous
`updates/android/pokemon-z-battle-12.apk`. L'objet mesure 392 729 346 octets ;
son SHA-256, vérifié après retéléchargement depuis R2, est
`be993581f832145fc3074ef1bf89fd4e0292db8b41946e0d3e234fb05406e567`.
Le manifeste `latest.json` a été publié après l'APK et relu avec la version,
les notes, la taille et l'empreinte attendues. Le lien permanent reste protégé
par Cloudflare Access. Les packs de ressources et le Worker sont inchangés.
Le porteur confirme que le téléchargement et l'installation depuis le jeu ont
réussi sur son téléphone.

## Correctifs privés du code web — BZ-041, préparés le 2026-11-13

**Distribution du 2026-11-17 :** la première APK équipée du chargeur est
publiée en 0.1.12 (`versionCode 13`). Elle doit être installée intégralement
depuis la 0.1.11. Le Worker mobile est déployé, mais aucun manifeste de
correctif web n'est encore publié : la recette d'un vrai petit patch et de
son repli reste à faire après validation de cette APK sur téléphone.

**Incident de migration :** la 0.1.11 (12) affiche « Manifeste APK invalide »
en lançant l'installation intégrée de la 0.1.12 (13). `PluginCall.getLong`
renvoie `null` pour `sizeBytes` reçu comme `Integer` du JSON Capacitor ; le
manifeste R2 est valide. Son pointeur public a été remis à 12. Le correctif
natif est dans la candidate 0.1.13 (14), installée par ADB sur le téléphone
avec données conservées ; il faut encore valider la partie et les packs avant
de publier le manifeste 14. Ce premier passage ne peut pas utiliser le
téléchargeur défectueux de l'APK 12.

Le prochain APK équipé du chargeur de code doit être installé intégralement une
fois. Ensuite, un correctif qui ne change que le JavaScript ou le CSS peut être
téléchargé dans Options → Mises à jour Android → Code du jeu. Il est activé au
prochain démarrage, sans ouvrir l'installateur Android. L'APK fournit un repli
local en cas d'échec ; « Version précédente » permet aussi un retour manuel.
Les modifications Java natives, les données de jeu embarquées ou la disposition
des ressources demandent toujours une nouvelle APK. Le canal de patch binaire
APK demeure prévu pour ces changements.

Préparation locale, sans publication :

```powershell
corepack pnpm --filter @pokemon-z-battle/overworld-sandbox webcode:prepare
corepack pnpm --filter @pokemon-z-battle/overworld-sandbox webcode:publish
```

La première commande construit `dist/assets`, signe le manifeste et place les
objets dans `.pokemon-z/updates/`. La seconde vérifie la signature et tous les
objets sans envoyer quoi que ce soit. Après test de l'APK et déploiement du
Worker qui expose `/api/updates/web/`, ajouter `-- --publish --objects-only`
pour envoyer seulement les objets, contrôler leur présence, puis `-- --publish`
pour publier le manifeste **en dernier**. La publication du manifeste rend le
correctif visible aux appareils connectés. Les fichiers de jeu source ne
doivent jamais être ajoutés au dépôt ni à ce pack.

La clé privée du code se trouve hors dépôt dans
`%USERPROFILE%\.pokemon-z-battle\web-code-signing\private.pem` ; sa clé
publique est embarquée dans l'APK. Sauvegarder la clé privée en lieu sûr avant
la première diffusion. Si elle est perdue, l'APK déployée ne pourra pas valider
les nouveaux correctifs web signés avec une autre clé ; il faudra diffuser une
nouvelle APK. La clé privée ne doit jamais être publiée ou partagée dans une
conversation. Le canal et son Worker n'ont pas encore été publiés ni validés
sur téléphone au 2026-11-13.

## Connexion persistante Android (BZ-034, 2026-11-12)

À partir de la prochaine APK publiée, une connexion par code courriel est
convertie en session personnelle de l'appareil. Elle reste active après
fermeture ou redémarrage jusqu'au bouton « Déconnecter le compte cloud ».
Sauvegardes, packs et recherche/téléchargement d'APK utilisent la même session.
Le téléchargement de l'APK s'effectue dans l'app, avec contrôle de taille,
SHA-256, paquet et version avant ouverture de l'installateur Android. L'ancienne
version 0.1.11 (12) publiée garde son flux Access/Chrome ; le nouveau flux est
installé seulement sur l'APK locale de test pour le moment. Le Worker mobile et
la migration D1 sont déjà en ligne. Une recette d'installation complète demande
une version supérieure à 12 ; ne pas déclarer cette partie validée avant ce test.
