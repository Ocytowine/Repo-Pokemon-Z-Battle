# Instructions de reprise

Avant toute modification du moteur, lire integralement `docs/AI_HANDOFF.md`, puis
consulter la section 9.7 de `docs/ROADMAP.md`. Ces documents decrivent l'etat reel
du portage, les validations manuelles et l'ordre de travail convenu avec le porteur
du projet.

- Ne jamais ajouter `.pokemon-z/` ni les fichiers du jeu source a Git.
- Preserver les changements non commites qui ne concernent pas la tache courante.
- Preferer une capacite generique du moteur a un correctif lie a un numero
  d'evenement, de carte, de switch ou a une espece particuliere.
- Toute nouvelle commande d'evenement doit etre declaree dans
  `source-command-registry.ts` et couverte par l'audit de scene.
- Mettre a jour `docs/AI_HANDOFF.md` apres chaque jalon fonctionnel important.
- Avant livraison, executer au minimum `corepack pnpm test` et
  `corepack pnpm build`.

## Regle de distribution des ressources du jeu

Avant de changer la copie Android de `Graphics` ou `Audio`, les fonds de combat
ou les mises a jour de ressources, consulter `docs/ASSET_DISTRIBUTION.md` et y
tenir le registre des decisions. Un asset absent du portage actuel ne peut pas
etre exclu sur ce seul motif. Separer les donnees de l'APK est possible sans
supprimer de ressources ; toute exclusion demande la preuve source et les tests
prevus par ce document. Ne jamais versionner les fichiers du jeu ou les packs.

## Regle d'architecture solo et multijoueur

Toute nouvelle mecanique de jeu doit etre concue une seule fois pour fonctionner
en solo et en Coop. Une fonctionnalite visible ou persistante n'est pas consideree
terminee si elle ne fonctionne que dans le chemin local, sauf si le porteur du
projet reporte explicitement son raccord multijoueur.

Avant implementation, documenter ou rendre explicites dans les types :

- l'autorite de la mecanique : joueur local, hote ou serveur ;
- son domaine d'etat : personnel, narratif de l'hote, partage ou seulement visuel ;
- sa persistance et ce qui doit etre restaure apres reconnexion ;
- les intentions envoyees au serveur et l'etat minimal replique aux autres joueurs ;
- son audience de presentation : joueur concerne, participants ou joueurs proches.

Implementer la regle metier dans un noyau partage, puis utiliser ce meme noyau par
un adaptateur local en solo et par la room autoritaire en multijoueur. Ne pas creer
deux versions independantes de la mecanique. Pour les mouvements (marche, course,
velo, surf, plongee ou suivants), le mode, les collisions, la vitesse, l'animation,
les transitions et le rendu distant doivent appartenir au meme contrat d'etat.

Chaque lot doit couvrir au minimum : comportement solo, comportement hote,
comportement invite, rendu distant et restauration/reconnexion lorsque l'etat est
persistant. Si une partie du raccord est volontairement differee, preparer le
contrat de donnees et signaler clairement la dette dans `docs/AI_HANDOFF.md` et la
roadmap avant de declarer le lot termine.

## Regle d'integration des Pokemon et Dresseurs

Toute nouvelle espece jouable, rencontre sauvage ou equipe de Dresseur doit etre
controlee par le pipeline de dependances de combat. Ne pas maintenir de liste
manuelle d'animations par capacite.

- relancer `corepack pnpm prepare:local` apres l'ajout au perimetre ;
- consulter `.pokemon-z/data/battle-integration-report.json` ou lancer
  `corepack pnpm audit:combat -- --scope pokemon:INTERNAL_NAME` (pour un Dresseur :
  `trainer:TYPE:NOM:VERSION`) ;
- porter dans le noyau commun les fonctions de capacite et talents signales avant
  de declarer l'entree terminee ;
- une fonction supportee ou partielle rend automatiquement eligibles les
  animations joueur/adversaire de toutes les capacites correspondantes ;
- les animations `Common:*` de statut sont extraites automatiquement ; une
  correspondance absente de `move2anim.dat` doit rester signalee et utiliser le
  fallback, jamais une animation inventee ;
- conserver le meme noyau et le meme audit en solo, hote et invite Coop.

Pour les evenements source, classifier la sequence par effets et audience, jamais
par numero de carte ou d'evenement :

- narration et mutations du monde : partagees en lecture seule aux participants ;
- services personnels (soin, boutique, PC, equipe, tuteur) : visibles uniquement
  par le joueur concerne ;
- ambiance sans mutation personnelle : repliquee aux joueurs presents ;
- sequence mixte ou inconnue : traitement narratif prudent et entree d'audit.
