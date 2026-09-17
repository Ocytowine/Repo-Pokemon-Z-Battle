import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "apps", "asset-preview");
const port = 4173;
createServer((request, response) => {
  const requested = request.url === "/" ? "index.html" : request.url?.replace(/^\//u, "");
  if (requested !== "index.html") {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  createReadStream(path.join(root, "index.html")).pipe(response);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Asset Lab: http://127.0.0.1:${port}\n`);
});
