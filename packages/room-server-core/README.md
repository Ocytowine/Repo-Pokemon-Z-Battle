# Room server core

Machine d'état autoritaire et indépendante de Cloudflare pour une room à deux
joueurs. Elle attribue les places, conserve l'état prêt et les connexions, déduplique
les requêtes, résout les intentions de déplacement et d'interaction dans le monde,
applique les politiques coopératives, attend les deux intentions d'un tour puis appelle le moteur de combat
par équipes. Les changements volontaires font partie des actions du tour ; après un
K.O., la room attend les remplacements requis avant d'autoriser le tour suivant.

Pour une rencontre issue de l'overworld, elle verrouille la carte, construit un
combat minimal, joue l'adversaire côté serveur puis persiste le résultat dans la
session avant de rendre le contrôle des avatars.

Pour un combat issu de Pokemon Z, l'hôte peut soumettre `openSourceBattle`; l'invité
peut aussi le faire pour une rencontre `source-wild` sur la carte partagée. Les
combats `source-trainer` et narratifs restent réservés à l'hôte.
La room contrôle la carte, la cohérence du manifeste adverse, crée l'état tactique,
la participation, le journal et le cycle dans une mutation unique, puis conserve
le résultat en `settling` pour le futur règlement personnel et la reconnexion.
Pendant `join-window`, l'invité présent sur la carte peut observer ou proposer un
camp et une composition de six Pokémon au maximum. La room revalide les identités
et propriétaires ; l'hôte doit accepter/refuser toute proposition avant de fermer
explicitement la fenêtre. Une action autorisée ferme également cette fenêtre.

Un ralliement passe la bataille en vrai format double : trois Pokemon au maximum
par Dresseur, deux actifs par camp, action et remplacement controles par leur
proprietaire. Pour un sauvage rejoint, la fuite n'est tiree qu'apres confirmation
de tous les participants. Les confirmations sont persistees ; toute autre action
les annule et republie le snapshot afin d'eviter un joueur bloque en attente.

La couche Durable Object fournit les WebSockets, les jetons de reconnexion et la
persistance de l'état complet, y compris le monde, les inventaires, les drapeaux,
les synchronisations coopératives, les séquences de mouvement, les
actions et remplacements en attente. Elle ne recalcule aucune règle de jeu.
