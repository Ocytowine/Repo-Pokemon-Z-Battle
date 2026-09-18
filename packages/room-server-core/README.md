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

La couche Durable Object fournit les WebSockets, les jetons de reconnexion et la
persistance de l'état complet, y compris le monde, les inventaires, les drapeaux,
les synchronisations coopératives, les séquences de mouvement, les
actions et remplacements en attente. Elle ne recalcule aucune règle de jeu.
