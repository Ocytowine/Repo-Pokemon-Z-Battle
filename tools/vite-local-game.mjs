import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const workspaceDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = path.join(workspaceDirectory, ".pokemon-z", "data");
const configPath = path.join(dataDirectory, "local-test.json");

const mediaTypes = new Map([
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"], [".gif", "image/gif"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"],
  [".bmp", "image/bmp"], [".webp", "image/webp"], [".svg", "image/svg+xml"],
  [".wav", "audio/wav"], [".ogg", "audio/ogg"], [".mp3", "audio/mpeg"],
]);

function safeFile(root, encodedRelativePath) {
  let decoded;
  try {
    decoded = decodeURIComponent(encodedRelativePath).replaceAll("/", path.sep);
  } catch {
    return null;
  }
  const candidate = path.resolve(root, decoded);
  if (!existsSync(candidate)) return null;
  try {
    const realFile = realpathSync(candidate);
    const relative = path.relative(root, realFile);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
    return statSync(realFile).isFile() ? realFile : null;
  } catch {
    return null;
  }
}

function sendFile(response, file) {
  response.statusCode = 200;
  response.setHeader("Content-Type", mediaTypes.get(path.extname(file).toLowerCase()) ?? "application/octet-stream");
  response.setHeader("Cache-Control", "no-store");
  createReadStream(file).pipe(response);
}

export function localPokemonZPlugin() {
  return {
    name: "pokemon-z-local-test-assets",
    apply: "serve",
    configureServer(server) {
      if (!existsSync(configPath)) return;
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      if (config?.schemaVersion !== "1.0.0" || typeof config.sourceDirectory !== "string") {
        throw new Error(`${configPath} est invalide. Relancez pnpm prepare:local.`);
      }
      const sourceDirectory = realpathSync(config.sourceDirectory);
      const routes = [
        ["/__pokemon-z/data/", realpathSync(dataDirectory)],
        ["/__pokemon-z/source/", sourceDirectory],
      ];
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
        const route = routes.find(([prefix]) => pathname.startsWith(prefix));
        if (route === undefined) return next();
        const host = (request.headers.host ?? "").toLowerCase();
        const fetchSite = request.headers["sec-fetch-site"];
        const localHost = /^(127\.0\.0\.1|localhost)(:\d+)?$/u.test(host) || /^\[::1\](:\d+)?$/u.test(host);
        if (!localHost || fetchSite === "cross-site") {
          response.statusCode = 403;
          response.end("Local test assets are only available from this local application.");
          return;
        }
        const [prefix, root] = route;
        const file = safeFile(root, pathname.slice(prefix.length));
        if (file === null) {
          response.statusCode = 404;
          response.end("Local test file not found.");
          return;
        }
        sendFile(response, file);
      });
    },
  };
}
