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
