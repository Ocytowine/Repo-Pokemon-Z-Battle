# Validation manuelle Android

Derniere mise a jour : 2026-10-26.

Cette recette doit etre executee sur un appareil Android reel. Les cases restent
ouvertes tant que le comportement n'a pas ete observe directement sur le
telephone. L'emulation Chrome ne valide pas le bouton Retour materiel, le
verrouillage d'orientation ni la suspension reelle de l'application.

## Methode recommandee : USB et transfert de port Chrome

### 1. Demarrer le jeu sur le PC

Depuis la racine du depot :

```powershell
corepack pnpm --filter @pokemon-z-battle/overworld-sandbox dev
```

Le serveur local doit ecouter sur le port `5174`. Laisser ce terminal ouvert
pendant tout le test.

### 2. Activer le debogage USB sur Android

1. Ouvrir `Parametres > A propos du telephone > Informations logiciel`.
2. Appuyer sept fois sur `Numero de version` pour activer les options
   developpeur.
3. Ouvrir les options developpeur et activer `Debogage USB`.
4. Relier le telephone au PC avec un cable USB capable de transporter les
   donnees.
5. Deverrouiller le telephone et accepter l'autorisation de debogage USB.

### 3. Configurer Chrome sur le PC

1. Ouvrir `chrome://inspect/#devices` dans Chrome sur le PC.
2. Activer `Discover USB devices`.
3. Verifier que le modele du telephone apparait. S'il est indique `Offline`,
   accepter de nouveau l'autorisation affichee sur le telephone.
4. Ouvrir `Port forwarding`.
5. Ajouter le port `5174` avec la destination `localhost:5174`.
6. Activer le transfert de port et valider.
7. Dans Chrome Android, ouvrir `http://localhost:5174`.

Sous l'onglet Android liste dans `chrome://inspect/#devices`, le lien `Inspect`
ouvre les DevTools de la vraie page mobile. Il permet de lire la console, de
recharger la page et d'activer le screencast. Desactivez le screencast pour juger
les performances et les animations.

Documentation de reference :

- [Debogage distant d'un appareil Android](https://developer.chrome.com/docs/devtools/remote-debugging)
- [Transfert de port vers un serveur local](https://developer.chrome.com/docs/devtools/remote-debugging/local-server)
- [Verrouillage d'orientation](https://developer.mozilla.org/en-US/docs/Web/API/ScreenOrientation/lock)

## APK debug Capacitor

Prerequis : Android Studio, SDK Platform 36, Build-Tools 36.0.0, Platform-Tools,
Command-line Tools et une configuration `.pokemon-z/local-test.json` valide.

Depuis la racine du depot :

```powershell
corepack pnpm android:apk
```

L'APK est produit dans
`apps/overworld-sandbox/android/app/build/outputs/apk/debug/app-debug.apk`.
Les donnees et medias locaux sont copies uniquement dans `dist` et dans les assets
Android ignores par Git. Ne jamais forcer leur ajout au depot.

- [x] APK debug construit avec Android API 36.
- [x] APK installe par ADB sur Samsung SM-S911U1.
- [x] Application lancee et premier ecran du jeu affiche le 2026-10-27.
- [ ] Mode immersif : barres systeme masquees et overworld 4:3 sur toute la
      hauteur utile, sans marges haute/basse inegales.
- [ ] Menu : surface utile remplie avec marges haute/basse symetriques et aucun
      contenu sous la decoupe ou les commandes systeme.
- [ ] Equipe > Pokemon > Details : la fiche apparait immediatement au-dessus du
      menu, occupe la surface utile et revient au menu avec sa croix.
- [ ] Images et sons verifies pendant un parcours jouable.
- [ ] Sauvegarde creee, application arretee puis progression rechargee.
- [ ] Taille reduite avant toute distribution : premier APK de fidelite, 823 Mo.

## Pourquoi la methode Wi-Fi n'est pas proposee

Le serveur de developpement refuse volontairement les routes
`/__pokemon-z/data/` et `/__pokemon-z/source/` lorsque l'hote HTTP n'est pas
`localhost` ou `127.0.0.1`. Cette protection evite d'exposer sur le reseau local
les fichiers du jeu source. Demarrer Vite avec `--host 0.0.0.0` afficherait le
shell, mais les donnees locales repondraient HTTP 403. Utiliser le transfert de
port USB ci-dessus, qui conserve `http://localhost:5174` sur le telephone. Ne pas
affaiblir cette garde uniquement pour simplifier un test Wi-Fi.

## Recette fonctionnelle

### Plein ecran et orientation

- [ ] En portrait, le bloqueur demande de tourner le telephone.
- [ ] La premiere pression dans l'application demande le plein ecran.
- [ ] Les barres du navigateur disparaissent si Chrome autorise le plein ecran.
- [ ] Le passage en paysage est automatique si le verrouillage est accepte.
- [ ] Si le verrouillage est refuse, la rotation manuelle permet quand meme de
      jouer en paysage.
- [ ] Le retour en portrait bloque de nouveau les intentions de jeu.

Le verrouillage d'orientation est une capacite optionnelle du navigateur. Un
refus n'est pas un echec du moteur si le jeu reste utilisable apres rotation
manuelle.

### Commandes overworld

- [ ] Le joystick est dans la bande gauche, hors de la scene 4:3.
- [ ] Les boutons `A`, `B`, `Sprint` et `Menu` sont dans la bande droite.
- [ ] Le joystick ne produit que haut, bas, gauche ou droite.
- [ ] `A` interagit et valide.
- [ ] `B` annule ou revient en arriere.
- [ ] `Sprint` reste actif uniquement pendant le maintien.
- [ ] `Menu` ouvre l'interface plein viewport.
- [ ] Les commandes disparaissent devant les interfaces qui possedent leurs
      propres controles.

### Suspension et reprise

1. Maintenir le joystick dans une direction ou maintenir `Sprint`.
2. Sans relacher, retourner a l'ecran d'accueil Android ou changer
   d'application.
3. Attendre au moins cinq secondes.
4. Revenir dans Chrome.

- [ ] Le personnage ne continue pas a marcher tout seul.
- [ ] Le bouton Sprint n'est plus actif.
- [ ] Le bouton du joystick revient au centre.
- [ ] Une nouvelle pression est necessaire pour recommencer un mouvement.

### Bouton Retour Android

- [ ] En plein ecran, le premier Retour quitte seulement le plein ecran ou
      produit le comportement attendu par Chrome.
- [ ] Dans un menu, Retour ne ferme pas brutalement l'onglet.
- [ ] Dans l'overworld, Retour ne provoque pas de mouvement ni d'interaction
      parasite.
- [ ] Noter precisement tout comportement different avant correction.

### Interfaces et cartes

- [ ] Le menu occupe toute la surface disponible hors zones sures.
- [x] Les marges noires gauche/droite du menu sont identiques sur le Samsung
      (32 px CSS de chaque cote).
- [ ] Les autres interfaces plein ecran gardent ces marges egales en usage tactile,
      y compris pres des coins arrondis.
- [ ] La carte regionale reste centree et conserve son ratio 3:2.
- [ ] La carte occupe la hauteur disponible et son panneau d'informations,
      Consultation et Vol est a droite sans masquer les reperes.
- [ ] La navigation principale a huit boutons au contenu aligne a gauche ; `Test dev` est dans
      Options et son bouton Retour mene bien aux options.
- [ ] Dans Equipe, numero, PV et attaques restent lisibles sans chevauchement.
- [ ] Ouvrir le menu avec le bouton tactile ne selectionne aucun Pokemon sans
      autre pression ; fermer puis rouvrir laisse aussi l'equipe deselectionnee.
- [ ] Les bandes noires de part et d'autre du canvas ont la meme largeur et le
      jeu ne passe pas sous les coins arrondis du telephone.
- [ ] Selectionner un Pokemon puis quitter/revenir dans Equipe efface la selection.
- [ ] Les roues de selection, notamment Donner un objet puis les poches, restent
      entierement visibles et utilisables sur le telephone.
- [ ] Ranch et Pension remplissent la meme surface utile que le menu, sans contenu
      masque par les bords ou les commandes Android.
- [ ] Avec le Ranch rempli, les cartes non visibles restent accessibles par defilement
      et la pagination reste utilisable.
- [ ] Le Gardien des Oeufs et l'Incubateur remplissent la surface utile, leurs
      boutons et dialogues restant visibles et utilisables.
- [ ] Les reperes de carte restent alignes avec l'image.
- [ ] Les zones de capture du Pokedex restent alignees avec la grille.
- [ ] Aucun contenu important ne passe sous une encoche ou une barre systeme.

### Coop et reprise prolongee

Cette partie reste ouverte jusqu'au lot de reprise audio/reconnexion.

- [ ] En tant qu'hote, une suspension puis un retour restaure l'etat autoritaire.
- [ ] En tant qu'invite, aucune intention n'est envoyee avant la resynchronisation.
- [ ] Le joueur distant conserve le bon mode, la bonne position et la bonne
      animation.
- [ ] Une suspension prolongee declenche puis termine correctement la reconnexion.
- [ ] La musique et l'ambiance reprennent sans doublon.

## Informations a relever en cas d'echec

- modele du telephone et version Android ;
- version de Chrome Android ;
- orientation et etat plein ecran au moment du probleme ;
- etapes exactes de reproduction ;
- capture d'ecran ou video ;
- erreurs visibles dans la console ouverte avec `Inspect` ;
- resultat obtenu et resultat attendu.

