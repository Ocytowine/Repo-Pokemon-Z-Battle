# Multiplayer protocol

Ce paquet définit le contrat réseau partagé de la phase 5. Il ne dépend d'aucune
API Cloudflare ou navigateur et valide les messages entrants à l'exécution.

Le client transmet uniquement des intentions : état prêt, demande de snapshot,
attaque, changement volontaire ou choix du remplaçant pour un combat et un tour
précis. Il ne peut pas transmettre de PV, de dégâts, de vainqueur ou de résultat
RNG. Ces données appartiennent exclusivement aux messages produits par le serveur
autoritaire.

Le protocole v4 transporte l'état complet des équipes, y compris les statuts,
talents et objets persistants, et distingue la résolution d'un tour de celle d'un remplacement obligatoire. Les messages sont limités à
4 Kio et validés avec des champs stricts.
Les identifiants de requête permettent au serveur d'acquitter une intention sans
l'appliquer deux fois après une reconnexion.
