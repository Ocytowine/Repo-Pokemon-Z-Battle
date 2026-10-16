Hache faible
Elle remplace concrètement Coupe. Elle détruit certains arbustes, peut fournir des ressources et se casse après utilisation. Elle apparaît sur une vingtaine de cartes.

Poudre explosive
Elle détruit les rochers, est consommée et peut déclencher une rencontre spéciale. Elle est référencée dans plus de quarante cartes. C’est la véritable mécanique récurrente équivalente à Éclate-Roc.

Talisman de Malvo
Objet utilisable uniquement à un emplacement précis d’Illysée. Il ouvre temporairement un passage vers « les ombres ». Il nécessite une mécanique générique d’objet sensible au lieu, pas un bouton de déplacement ordinaire.

Regadera magique
Elle est utilisée sur plusieurs éléments d’Illysée pour faire apparaître le Talisman de Malvo. C’est une petite chaîne exploration → objet → transformation du monde.

Marteau et Ciseau
Les deux sont nécessaires pour lancer l’excavation de la Grotte de Las-Eau. Cela ouvre le minijeu de fouilles, qui est une fonctionnalité entière à qualifier.

Énigme des Zarbi
Une porte vérifie que l’équipe contient exactement six Zarbi formant « ETERNO » avec leurs formes, dans le bon ordre. Cela implique que les formes et l’ordre de l’équipe soient fidèlement conservés.

Amulettes de type
Dix-huit amulettes augmentent pendant 500 pas la probabilité de rencontrer un type déterminé. Leur effet doit intervenir dans le noyau de tirage des rencontres.

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