Hache faible — portée le 2026-10-16
Elle remplace concrètement Coupe. Les 30 arbustes de 19 cartes utilisent maintenant
leur événement source : fabrication contextuelle, son, animation, récompenses,
disparition persistante ou temporaire et casse après utilisation. La recette du
menu Alchimie se débloque au niveau 10, tandis que l'événement commun source exige
le niveau 12 pour proposer la fabrication devant l'arbuste ; cette différence du
jeu original est volontairement conservée.

Poudre explosive
Elle détruit les rochers, est consommée et peut déclencher une rencontre spéciale. Elle est référencée dans plus de quarante cartes. C’est la véritable mécanique récurrente équivalente à Éclate-Roc.

Talisman de Malvo — porté le 2026-10-16
Le Sac reconnaît désormais les objets de terrain sensibles au lieu. Le Talisman ne
se consomme pas, affiche son échec ailleurs et active exactement le switch 412 en
Map190, case 74,25. Cette mutation du monde appartient à l’hôte sur la carte Coop ;
l’invité en excursion conserve son traitement local.

Regadera magique — portée le 2026-10-16
Les fleurs de Map192 et Map215 utilisent le lecteur générique d’événements : test
du Sac, choix, animation 28, attente, consommation de la Regadera, obtention du
Talisman et switch 400. L’obtention initiale de Map191 est également couverte par
les commandes génériques d’objet et le self-switch source.

Marteau et Ciseau — portés le 2026-10-16
Les deux restent nécessaires dans les événements source de la Grotte de Las-Eau.
`pbMiningGame` ouvre maintenant le plateau complet : burin et marteau, métal,
fissures, formes et probabilités de trésors source, effondrement et remise des
objets au Sac personnel. Une entrée sans prérequis existe dans `Test dev >
Mini-jeux` pour la validation anticipée.

Énigme des Zarbi — portée le 2026-10-16
Le prédicat source `unown_check` vérifie exactement six Zarbi, dans l’ordre, avec
les formes `[4,19,4,17,13,14]` qui composent ETERNO. Il lit les formes persistées
par le modèle Pokémon commun et fonctionne donc avec l’équipe de l’hôte sans règle
spécifique à la carte.

Amulettes de type — portées le 2026-10-16
Les dix-huit amulettes sont consommées depuis le Sac et créent un effet personnel
persistant de 500 pas hors glace. Une seconde amulette est refusée tant que la
première agit. Comme dans le Ruby de Z, chaque rencontre a 50 % de chances de
filtrer la table sur le type demandé ; si aucune espèce ne correspond, la table
normale reste utilisée. Le même noyau couvre marche, grotte, pêche et Éclate-Roc.

Guide des personnages et PokéObjectif
Ce sont des interfaces de suivi propres à Z. Le Guide déverrouille progressivement les fiches des personnages rencontrés ; le PokéObjectif indique la prochaine étape de l’aventure.

Contrat Coop nécessaire
Ces obstacles modifient le monde : ils ne peuvent donc pas rester purement locaux.
- L’hôte ou la room reste autoritaire sur la disparition et la position.
- Le joueur envoie seulement une intention d’interaction.
- La room réplique l’événement supprimé ou la nouvelle position du rocher.
- L’invité voit immédiatement disparaître la collision.
- Une reconnexion restaure le même état.
- Une excursion personnelle de l’invité conserve son traitement local existant.
Il faudra aussi distinguer deux persistances source :
- pbEraseThisEvent : disparition temporaire, réinitialisée au rechargement de la carte ;
- self-switch ou événement enregistré : disparition persistante avec l’histoire.
Ensuite
Après ce chantier, les fonctions importantes seraient selon moi :
1. poursuivre les événements narratifs après la grotte ;
2. terminer le DexNav et les rencontres Éclate-Roc ;
3. raccorder l’apprentissage et l’oubli interactif des capacités ;
4. continuer les lots verticaux de capacités, talents et objets requis par les prochains Dresseurs ;
5. finir les validations visuelles d’évolution, capture et éclosion.
Je commencerais donc par un lot générique « obstacles destructibles », testé immédiatement avec les rochers explosifs de Map016, puis je l’étendrais aux arbustes de Map009.
