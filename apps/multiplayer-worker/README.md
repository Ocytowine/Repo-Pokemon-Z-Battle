# Multiplayer Worker

Adaptateur Cloudflare de la phase 5. Chaque code à six caractères désigne un Durable
Object SQLite. Le Worker public crée les rooms, délivre deux tickets et transfère les
connexions WebSocket vers l'objet correspondant.

```powershell
corepack pnpm --filter @pokemon-z-battle/multiplayer-worker dev
```

API locale :

- `POST /api/rooms` crée une room et retourne le ticket du joueur 1 ;
- `POST /api/rooms/{code}/join` retourne le ticket du joueur 2 ;
- `GET /api/rooms/{code}/socket?playerId=...&token=...` ouvre le WebSocket ;
- `GET /health` vérifie le Worker.

Les jetons bruts ne sont jamais persistés : seul leur SHA-256 est stocké. L'état de
room, les actions en attente et la position de la RNG sont sauvegardés après chaque
mutation. Les pièces jointes WebSocket ne conservent que l'identifiant du joueur,
afin de permettre l'hibernation du Durable Object.

Le déploiement nécessite une connexion préalable à Cloudflare avec Wrangler :

```powershell
corepack pnpm --filter @pokemon-z-battle/multiplayer-worker deploy
```
