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

## Methode de secours : reseau Wi-Fi local

Utiliser cette methode si le transfert USB n'est pas disponible.

1. Connecter le PC et le telephone au meme reseau Wi-Fi et couper les VPN.
2. Demarrer Vite sur toutes les interfaces reseau :

```powershell
corepack pnpm --dir apps/overworld-sandbox exec vite --host 0.0.0.0 --port 5174
```

3. Autoriser Node/Vite sur les reseaux prives si le pare-feu Windows le demande.
4. Executer `ipconfig` et relever l'adresse IPv4 de l'adaptateur Wi-Fi, par
   exemple `192.168.1.24`.
5. Ouvrir `http://192.168.1.24:5174` sur le telephone en remplacant l'adresse par
   celle du PC.

Si la page reste inaccessible, verifier le pare-feu Windows et l'isolation des
clients Wi-Fi. La methode USB est alors preferable.

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
- [ ] La carte regionale reste centree et conserve son ratio 3:2.
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

