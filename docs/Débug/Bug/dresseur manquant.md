Titre : il manque le retour du dresseur
Description : A la fin du combat contre un dresseur, le retour du dresseur n'est pas affiché, il y'a son dialogue, mais pas le sprite , pareil pour la coop et pvp.
1. Je lance un combat contre un dresseur.
2. Je constate que le retour du dresseur n'est pas affiché après la fin du combat.
Résultat attendu : Le retour du dresseur, y compris son sprite, devrait être affiché après la fin du combat.
Résultat réel : Le retour du dresseur n'est pas affiché après la fin du combat, seul son dialogue apparaît.

Statut au 2026-10-15 : corrigé dans le code, validation manuelle requise. Le
Dresseur adverse revient désormais sur son emplacement avant son dialogue de fin.
Le même chemin utilise le sprite source en solo et l'apparence personnalisée de
l'adversaire en Coop/PvP.
