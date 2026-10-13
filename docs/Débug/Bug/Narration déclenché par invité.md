Titre : l'invité déclenche la narration
Description : Lorsqu'un joueur invité rejoint une partie, cela déclenche des événements de narration qui ne devraient pas se produire. notament des evenement de scenario, des combat contre dresseurs, des dialogues importants, etc. Cela peut perturber l'expérience de jeu et la continuité de l'histoire pour le joueur hôte.
Étapes pour reproduire :
1. Inviter un joueur à rejoindre une partie en cours.
2. Observer les événements de narration qui se déclenchent.
3. faire en sorte qu'il spawn sur une zone qui déclenche des evenements de narration, comme un combat contre un dresseur ou un dialogue important.

Résultat attendu : Les événements de narration ne devraient pas se déclencher par et pour le joueur invité.
Résultat réel : Les événements de narration se déclenchent pour et par le joueur invité, perturbant l'expérience de jeu.

Statut au 2026-10-13 : correctif implémenté, validation manuelle requise.
Le moteur distingue maintenant les positions de collision (hôte et invité) des
cibles narratives (hôte uniquement). Vérifier avec un Dresseur à portée de
l'invité puis de l'hôte : l'invité ne doit rien déclencher, l'hôte doit encore
obtenir l'approche, le dialogue et le combat visibles sur les deux clients.
