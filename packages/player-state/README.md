# Player State

État persistant et indépendant de l'interface pour l'équipe personnelle du joueur.
Une équipe peut être vide avant le choix du starter, puis contenir jusqu'à six
Pokémon avec leurs PV, statut majeur, PP, statistiques, talent et objet tenu.

Le parseur versionné refuse les sauvegardes incohérentes. `healPlayerParty`
restaure PV, statut et PP sans muter l'état précédent. L'adaptateur de combat
transforme l'équipe en `BattleTeam`, puis `storeBattleTeam` réinjecte les PV,
statuts, PP et Pokémon actif à la fin du combat.

Une capacité, un talent ou un objet tenu non encore supporté par le moteur provoque
une erreur explicite. Le connecteur ne remplace jamais silencieusement une mécanique.
