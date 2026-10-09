import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const workspaceDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDataDirectory = path.join(workspaceDirectory, ".pokemon-z", "data");
const configPaths = [
  path.join(workspaceDirectory, ".pokemon-z", "local-test.json"),
  path.join(defaultDataDirectory, "local-test.json"),
];

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

function readLocalConfiguration() {
  const configPath = configPaths.find((candidate) => existsSync(candidate));
  if (configPath === undefined) return null;
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const legacy = config?.schemaVersion === "1.0.0" && typeof config.sourceDirectory === "string";
  const current = config?.schemaVersion === "2.0.0" && typeof config.sourceDirectory === "string"
    && typeof config.dataDirectory === "string";
  if (!legacy && !current) {
    throw new Error(`${configPath} est invalide. Relancez pnpm prepare:local avec --source et --output.`);
  }
  return {
    sourceDirectory: realpathSync(config.sourceDirectory),
    dataDirectory: realpathSync(current ? config.dataDirectory : defaultDataDirectory),
  };
}

export function localPokemonZPlugin() {
  return {
    name: "pokemon-z-local-test-assets",
    apply: "serve",
    configureServer(server) {
      const config = readLocalConfiguration();
      if (config === null) {
        server.middlewares.use((request, response, next) => {
          const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
          if (!pathname.startsWith("/__pokemon-z/")) { next(); return; }
          response.statusCode = 503;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: "LOCAL_CONFIGURATION_MISSING" }));
        });
        return;
      }
      const routes = [
        ["/__pokemon-z/data/", config.dataDirectory],
        ["/__pokemon-z/source/", config.sourceDirectory],
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
