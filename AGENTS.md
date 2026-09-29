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
