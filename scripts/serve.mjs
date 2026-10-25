import http from "node:http";
import { readFile } from "node:fs/promises";
const T = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};
http
  .createServer(async (q, r) => {
    let u = q.url.split("?")[0];
    if (!u.startsWith("/chronicle/")) {
      r.writeHead(404).end();
      return;
    }
    u = u.slice(10) || "/";
    if (u.endsWith("/")) u += "index.html";
    try {
      const b = await readFile("dist" + u);
      r.writeHead(200, {
        "content-type": T[u.slice(u.lastIndexOf("."))] || "text/plain",
      }).end(b);
    } catch {
      r.writeHead(404).end();
    }
  })
  .listen(4173);
