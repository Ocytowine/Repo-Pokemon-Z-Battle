Titre : Évolution avec capacité non appliquée
Description : Lorsqu'un Pokémon évolue et doit apprendre une nouvelle capacité, la capacité n'est pas proposée correctement.
Étapes pour reproduire :
1. Faire évoluer un Pokémon qui doit apprendre une nouvelle capacité (exemple coconfort évoluant en dardagnant, il doit apprendre double dard).
2. Observer si la nouvelle capacité est proposée correctement.
Résultat attendu : La nouvelle capacité devrait être proposée correctement lors de l'évolution.
Résultat réel : La nouvelle capacité n'est pas proposée.

Statut au 2026-10-15 : corrigé dans le code, validation manuelle requise. Le flux
d'apprentissage différé existant couvre déjà le choix et le remplacement parmi
quatre capacités. Le noyau inclut maintenant aussi les capacités de niveau source
`0`, réservées par Essentials au moment précis de l'évolution, en plus de celles
apprises au niveau courant.

Complément du 27/10/2026 : une capacité acquise à l'évolution restait invisible
quand le Pokémon avait moins de quatre capacités : elle était ajoutée directement
sans écran de proposition. Toutes les capacités de niveau 0 ou du niveau courant
sont maintenant proposées après l'animation, avec choix persistant même si une
place est libre. Le menu du Sac se ferme avant la présentation afin que l'écran
ne reste pas derrière lui sur Android. Test automatisé des deux propositions
successives ajouté ; vérification en jeu de Coconfort et Double Dard à refaire.
L'APK contenant le correctif a été installé sur le Samsung le 27/10/2026.
