# Passerelle de connexion des sauvegardes

Ce Worker est distinct de `multiplayer-worker`. La connexion Cloudflare Access
avec `GET /api/session` est validée sur navigateur et Android. `GET /api/login`
montre une page de retour au jeu après le code reçu par courriel. Sans identité
Access, le Worker répond `401` même si sa politique était retirée.

La base D1 `pokemon-z-battle-saves` et le bucket R2 privé
`pokemon-z-battle-saves-private` sont liés au Worker déployé. Les tables sont
encore vides. Les routes sont limitées à deux parties et à `manual`/`auto`, avec des
révisions immuables et une écriture conditionnelle sur la révision précédente.
`GET /api/saves` liste les têtes du compte connecté ;
`GET /api/saves/{1|2}/{manual|auto}` récupère une version ;
`PUT` au même chemin attend `{ expectedRevisionId, snapshot }`. Une révision
concurrente renvoie `409` sans écraser les données existantes.

Le bucket R2 est lié comme `SAVE_BUCKET` avec la juridiction `eu`. Le mode D1
seul reste possible pour les tests locaux. Le
test local `node scripts/smoke-local.mjs`, avec `wrangler dev --port 8791`,
vérifie création, conflit et séparation des parties.

Après connexion de Wrangler au bon compte Cloudflare :

1. `corepack pnpm --filter @pokemon-z-battle/cloud-save-worker run deploy` ;
2. dans **Workers & Pages**, ouvrir `pokemon-z-battle-cloud-save`, puis l'onglet
   **Access** ; protéger ce Worker en production avec une politique **Allow**
   limitée aux adresses de test et la méthode **One-time PIN** ;
3. ouvrir `https://pokemon-z-battle-cloud-save.mimidu33-eb.workers.dev/api/session`
   dans un navigateur privé. Après connexion, la réponse doit indiquer
   `authenticated: true` et le courriel attendu. Sans connexion, le Worker
   répond `401` si Access ne bloque pas déjà l'appel ;
4. tester ensuite le parcours Android WebView avant d'ajouter D1/R2 et les
   opérations de synchronisation.

Ne pas protéger `multiplayer-worker` avec cette politique : ses WebSockets
doivent continuer à fonctionner. Ne pas ajouter les sauvegardes ni les fichiers
source du jeu à Git.
