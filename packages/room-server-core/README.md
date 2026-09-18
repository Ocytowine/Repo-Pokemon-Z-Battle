# Room server core

Machine d'état autoritaire et indépendante de Cloudflare pour une room à deux
joueurs. Elle attribue les places, conserve l'état prêt et les connexions, déduplique
les requêtes, attend les deux intentions d'un tour puis appelle le moteur de combat
par équipes. Les changements volontaires font partie des actions du tour ; après un
K.O., la room attend les remplacements requis avant d'autoriser le tour suivant.

La couche Durable Object fournit les WebSockets, les jetons de reconnexion et la
persistance de l'état complet, y compris les actions et remplacements en attente.
Elle ne recalcule aucune règle de combat.
