import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const mime = { html: "text/html", js: "text/javascript", css: "text/css", svg: "image/svg+xml", png: "image/png", woff2: "font/woff2" };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/src/config.js" && process.env.API_ORIGIN) {
      const origin = new URL(process.env.API_ORIGIN).origin;
      res.setHeader("Content-Type", "text/javascript");
      res.setHeader("Cache-Control", "no-store");
      res.end(`export const API_ORIGIN = ${JSON.stringify(origin)}; export const API_PREFIX = "/api/v1";`);
      return;
    }
    const requested = resolve(root, "." + decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!requested.startsWith(root.endsWith(sep) ? root : root + sep)) throw new Error("Invalid path");
    const info = await stat(requested);
    if (!info.isFile()) throw new Error("Missing file");
    res.setHeader("Content-Type", mime[requested.split(".").at(-1)] ?? "application/octet-stream");
    createReadStream(requested).pipe(res);
  } catch {
    res.writeHead(404).end("Archivo no encontrado");
  }
});
server.listen(Number(process.env.PORT ?? 4173), "127.0.0.1", () => console.log(`http://127.0.0.1:${server.address().port}`));
