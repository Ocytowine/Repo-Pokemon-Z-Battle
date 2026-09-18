# Room server core

Machine d'état autoritaire et indépendante de Cloudflare pour une room à deux
joueurs. Elle attribue les places, conserve l'état prêt et les connexions, déduplique
les requêtes, attend les deux intentions d'un tour puis appelle le moteur de combat.

La couche Durable Object à venir sera responsable des WebSockets, des jetons de
reconnexion et de la persistance. Elle ne recalculera aucune règle de combat.
