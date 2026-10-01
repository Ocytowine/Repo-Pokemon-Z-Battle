# Multiplayer protocol

Ce paquet définit le contrat réseau partagé de la phase 5. Il ne dépend d'aucune
API Cloudflare ou navigateur et valide les messages entrants à l'exécution.

Le client transmet uniquement des intentions : état prêt, demande de snapshot,
direction de déplacement, interaction, attaque, changement volontaire ou choix du remplaçant
pour un combat et un tour précis. Il ne peut transmettre ni coordonnées overworld,
ni PV, dégâts, vainqueur ou résultat RNG. Ces données appartiennent exclusivement
aux messages produits par le serveur autoritaire.

Le protocole v7 transporte l'état complet du monde et des équipes, y compris les
statuts, talents et objets persistants, et distingue la résolution d'un tour de
celle d'un remplacement obligatoire. Les mouvements utilisent un numéro de
séquence croissant afin d'écarter les intentions anciennes. Les messages sont limités à
4 Kio et validés avec des champs stricts.
Les identifiants de requête permettent au serveur d'acquitter une intention sans
l'appliquer deux fois après une reconnexion. Chaque snapshot expose aussi la
dernière séquence acceptée pour que le client reprenne sans repartir de zéro.
Une intention d'interaction ne contient aucune cible : la room la déduit de la
position et de la direction autoritaires de l'avatar.

Le paquet expose aussi `NetworkPlayerProfile`, le contrat cosmétique public et
versionné du raccord coopératif. Il transporte le nom affiché,
les pronoms, les choix cosmétiques sémantiques et un identifiant de preset visuel,
jamais un chemin de fichier, l'équipe, l'inventaire ou la progression. Chaque place
publie ce profil a la creation de la room et peut le mettre a jour par l'intention
`setProfile`; le serveur le valide, le persiste et le diffuse dans les snapshots.
