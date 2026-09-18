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

Pour valider le parcours HTTP/WebSocket complet, laissez le Worker local ouvert et
lancez dans un second terminal :

```powershell
corepack pnpm test:multiplayer:e2e
```

Cette recette crée deux tickets, connecte les deux joueurs, démarre le combat par
équipes, exécute un changement volontaire, vérifie que les états concordent puis
teste la reconnexion avec le ticket initial. Elle applique ensuite un poison grave
et vérifie sa persistance, poursuit le combat jusqu'à un K.O. puis contrôle le
remplacement obligatoire. Une URL différente peut être passée en
argument au script.

Les jetons bruts ne sont jamais persistés : seul leur SHA-256 est stocké. L'état de
room, les équipes, les actions et remplacements en attente ainsi que la position de
la RNG sont sauvegardés après chaque mutation. Les pièces jointes WebSocket ne conservent que l'identifiant du joueur,
afin de permettre l'hibernation du Durable Object.

Le déploiement nécessite une connexion préalable à Cloudflare avec Wrangler :

```powershell
corepack pnpm --filter @pokemon-z-battle/multiplayer-worker deploy
```
