# Générer l’APK Android sur un autre PC (Windows)

Cette procédure part d’un **clone neuf du dépôt**. Elle produit l’APK de test
actuel du jeu. Android Studio sert à installer le SDK et à ouvrir le projet Android
déjà présent ; il ne faut créer aucun nouveau projet Android.

## 1. Installer les outils sur le PC

1. Installer [Git](https://git-scm.com/downloads) et
   [Node.js 22 ou plus récent](https://nodejs.org/en/download) ; ouvrir ensuite
   un **nouveau** terminal PowerShell.
2. Installer la version stable actuelle d’
   [Android Studio](https://developer.android.com/studio/install). Capacitor 8
   demande au minimum Android Studio 2025.2.1. Laisser l’assistant installer le
   SDK et le JDK inclus. Il n’est pas nécessaire de lancer Android Studio en
   administrateur.
3. Vérifier les outils dans PowerShell :

   ```powershell
   git --version
   node --version
   corepack --version
   ```

Le dépôt fixe pnpm à la version 10.16.0 ; les commandes `corepack pnpm` utilisent
cette version sans installation manuelle de pnpm.

## 2. Régler le SDK dans Android Studio

Depuis l’écran d’accueil d’Android Studio, ouvrir **More Actions > SDK Manager**.
Si un projet est déjà ouvert, utiliser **Tools > SDK Manager**. Le chemin affiché
sous **Android SDK Location** est propre au PC ; sur Windows il ressemble à
`C:\Users\<utilisateur>\AppData\Local\Android\Sdk`.

- Dans **SDK Platforms**, installer **Android 16.0 (API 36)**, version stable.
  Les lignes Canary, DEV ou Preview ne remplacent pas cette plateforme.
- Dans **SDK Tools**, installer **Android SDK Build-Tools 36.0.0**,
  **Android SDK Platform-Tools** et **Android SDK Command-line Tools (latest)**.
  Cocher **Show Package Details** si la version 36.0.0 des Build-Tools n’apparaît
  pas directement.
- Valider avec **Apply** ou **OK**, puis accepter les licences proposées.

Ces éléments correspondent à la configuration Android de ce dépôt :
`compileSdkVersion = 36`, `targetSdkVersion = 36` et `minSdkVersion = 24`.
L’émulateur, le NDK et CMake ne sont pas nécessaires pour produire cet APK.

## 3. Cloner le dépôt et préparer les fichiers du jeu

Le collègue doit disposer **séparément** de sa copie locale de
**Pokémon Z v2.12 FR**. Le dossier doit contenir notamment `Data`, `PBS`,
`Graphics` et `Audio`. Ne pas copier ce dossier dans le dépôt Git et ne pas
l’ajouter à un commit.

Dans PowerShell, se placer dans un dossier de travail, puis :

```powershell
git clone "https://github.com/Ocytowine/Repo-Pokemon-Z-Battle.git"
cd Repo-Pokemon-Z-Battle
corepack pnpm install
corepack pnpm prepare:local --source "C:\chemin\vers\Pokémon Z V2.12 - Français" --output ".pokemon-z\data"
```

Remplacer le chemin source par celui du collègue. La première extraction
peut prendre du temps. Elle crée `.pokemon-z/local-test.json` et
`.pokemon-z/data/` **sur ce PC uniquement**. Les chemins enregistrés dans
`local-test.json` sont personnels : ne pas recopier ce fichier depuis un autre PC.
Après une mise à jour des données ou de l’extracteur, `corepack pnpm prepare:local`
réutilise ces chemins.

## 4. Ouvrir le bon projet dans Android Studio

Dans Android Studio, cliquer sur **Open** et sélectionner le dossier :

```text
Repo-Pokemon-Z-Battle\apps\overworld-sandbox\android
```

Attendre la fin de la synchronisation Gradle et accepter l’installation d’un
composant du SDK si Android Studio le demande. Le fichier local
`apps/overworld-sandbox/android/local.properties` doit alors pointer vers le SDK
de ce PC. Ce fichier est ignoré par Git. Fermer Android Studio après cette étape
est possible : la génération normale se fait dans PowerShell.

Si le projet existe déjà dans le clone, **ne pas** cliquer sur **New Project**,
**Clone Repository** ou lancer `cap add android` depuis Android Studio.

## 5. Générer l’APK

Depuis la **racine du dépôt** dans PowerShell :

```powershell
corepack pnpm android:apk
```

La commande construit l’application Web, copie les données extraites ainsi que
`Graphics` et `Audio`, synchronise Capacitor avec Android, puis lance
`assembleDebug` avec le Gradle Wrapper du dépôt. Il n’y a pas de bouton
**Build APK** à utiliser dans Android Studio pour ce parcours.

Le succès se termine par `BUILD SUCCESSFUL` et `APK debug prêt`. Le fichier est :

```text
apps\overworld-sandbox\android\app\build\outputs\apk\debug\app-debug.apk
```

Pour le retrouver ou en faire une copie hors du dépôt :

```powershell
Get-Item '.\apps\overworld-sandbox\android\app\build\outputs\apk\debug\app-debug.apk'
Copy-Item -LiteralPath '.\apps\overworld-sandbox\android\app\build\outputs\apk\debug\app-debug.apk' -Destination "$env:USERPROFILE\Desktop\Pokemon-Z-Battle-debug.apk"
```

La copie produite ici peut être volumineuse (environ 863 Mo lors du build du
27 octobre 2026). Vérifier la place disponible sur le PC et le téléphone.

## 6. Installer et vérifier sur un téléphone

**Sans câble USB :** transférer l’APK sur le téléphone, ouvrir le fichier dans
son gestionnaire de fichiers, puis autoriser l’installation depuis cette
application si Android le demande. Le transfert de l’APK ne transfère pas la
sauvegarde : chaque téléphone conserve ses données locales.

**Avec câble USB (facultatif) :** activer les options développeur et le débogage
USB, déverrouiller le téléphone et accepter la demande d’autorisation. Depuis la
racine du dépôt :

```powershell
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
& $adb devices
& $adb -d install -r '.\apps\overworld-sandbox\android\app\build\outputs\apk\debug\app-debug.apk'
```

`adb devices` doit afficher le téléphone avec l’état `device` ; l’installation
doit répondre `Success`. Si le SDK se trouve ailleurs, prendre son chemin dans
**Android SDK Location** et adapter la première ligne. L’application apparaît
ensuite sous le nom **Pokemon Z-Battle**.

Avant une mise à jour, enregistrer la partie dans le jeu : l’installation relance
l’application et la progression non sauvegardée peut être perdue.

## Lors des générations suivantes

Après un `git pull` ou une modification du code, lancer de nouveau depuis la
racine :

```powershell
corepack pnpm install
corepack pnpm prepare:local
corepack pnpm android:apk
```

`prepare:local` est surtout nécessaire lorsque les données du jeu ou l’extracteur
ont changé ; il est conservé ici pour que la procédure soit reproductible.
L’APK précédent est remplacé au même endroit. Le build Android, l’APK,
`local.properties`, `.pokemon-z/` et les médias copiés par Capacitor sont ignorés
par Git. Un clone ne peut donc pas contenir l’APK généré par un collègue.

## Si quelque chose bloque

| Symptôme | Vérification |
| --- | --- |
| `local-test.json` absent ou données introuvables | Refaire l’étape 3 avec **la copie locale** du jeu et le bon chemin `--source`. |
| `SDK location not found` | Ouvrir le dossier `android` dans Android Studio et vérifier le chemin du SDK ; `local.properties` doit être créé localement. |
| `JDK Android introuvable` | Vérifier l’installation d’Android Studio. Le script cherche son JDK dans `C:\Program Files\Android\Android Studio\jbr` ou dans `JAVA_HOME`. |
| Gradle réclame API 36 ou des licences | Revenir dans **SDK Manager**, installer la plateforme 36 et les outils, puis accepter les licences. |
| `adb devices` indique `unauthorized` | Déverrouiller le téléphone et accepter la fenêtre de débogage USB. |
| Installation refusée comme mise à jour incompatible | Les APK de débogage produits sur deux PC utilisent en général des clés différentes. Ne pas désinstaller l’application avant d’avoir préservé la sauvegarde ; coordonner la signature des futures versions. |

Cet APK est une **version de test signée pour le débogage**, destinée à une
installation directe. Une version à distribuer durablement demande un paquet de
publication signé avec une clé conservée par le projet.

Références : [installation d’Android Studio](https://developer.android.com/studio/install),
[SDK Manager](https://developer.android.com/studio/intro/update),
[prérequis Capacitor 8](https://capacitorjs.com/docs/getting-started/environment-setup),
[signature Android](https://developer.android.com/studio/publish/app-signing),
[installation par ADB](https://developer.android.com/build/building-cmdline).
