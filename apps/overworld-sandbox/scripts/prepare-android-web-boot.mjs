import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(app, "dist", "index.html");
let html = readFileSync(file, "utf8");
const jsTag = /<script\s+type="module"[^>]*src="\/(assets\/[^\"]+\.js)"[^>]*><\/script>/;
const cssTag = /<link\s+rel="stylesheet"[^>]*href="\/(assets\/[^\"]+\.css)"[^>]*>/;
const script = jsTag.exec(html)?.[1];
const style = cssTag.exec(html)?.[1];
if (!script || !style) throw new Error("Entrées Vite introuvables dans l'index Android.");
html = html.replace(jsTag, "").replace(cssTag, "");
const bootstrap = `<script>
  (() => {
    const bundled = { script: ${JSON.stringify(`/${script}`)}, style: ${JSON.stringify(`/${style}`)} };
    let fallbackUsed = false;
    const load = (entry, active) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = entry.style;
      link.onerror = () => { if (active) fallback(); };
      link.onload = () => {
        if (active && fallbackUsed) return;
        const module = document.createElement('script');
        module.type = 'module'; module.src = entry.script;
        module.onerror = () => { if (active) fallback(); };
        document.body.append(module);
      };
      document.head.append(link);
    };
    const fallback = async () => {
      if (fallbackUsed) return;
      fallbackUsed = true;
      window.__pzWebCodeVersion = '';
      try { await window.Capacitor?.nativePromise?.('WebCodePack', 'rollback', {}); } catch {}
      load(bundled, false);
    };
    const start = async () => {
      try {
        const native = window.Capacitor?.nativePromise;
        if (typeof native === 'function') {
          const boot = await Promise.race([native('WebCodePack', 'boot', {}),
            new Promise((_, reject) => setTimeout(() => reject(new Error('boot timeout')), 5000))]);
          if (boot?.version && boot?.script && boot?.style) {
            window.__pzWebCodeVersion = boot.version;
            load(boot, true);
            return;
          }
        }
      } catch {}
      load(bundled, false);
    };
    start();
  })();
</script>`;
html = html.replace("</body>", `${bootstrap}\n  </body>`);
writeFileSync(file, html);
process.stdout.write(`Amorce Android préparée avec repli ${script} et ${style}.\n`);
