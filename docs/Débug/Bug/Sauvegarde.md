Titre : Probleme de continuité
Description : Quand le joueur rejoins une partie en co-op et qu'il tente de sauvegarder, le jeu ne doit pas sauvegarder la position car elle va casser la continuité scenaristique du jeu. Le joueur doit être renvoyé au dernier point de sauvegarde pour éviter de perdre la continuité de l'histoire.
Étapes pour reproduire :
1. Rejoindre une partie en co-op.
2. Tenter de sauvegarder la partie.
3. Observer le comportement du jeu.
Résultat attendu : Le jeu ne doit pas sauvegarder la position du joueur et doit le renvoyer au dernier point de sauvegarde. Les objets, pokemons, états des pokemons et autres éléments du jeu doivent être sauvegardés, mais la position du joueur ne doit pas l'être pour maintenir la continuité scénaristique.
Résultat réel : Le jeu sauvegarde la position du joueur, ce qui casse la continuité scénaristique.