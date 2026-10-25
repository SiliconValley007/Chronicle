import {
  cpSync,
  rmSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { createHash } from "node:crypto";
const F = [
  "index.html",
  "data.js",
  "countries.js",
  "favicon.svg",
  "manifest.webmanifest",
];
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
for (const f of F) {
  if (!existsSync(f)) throw Error("missing " + f);
  cpSync(f, "dist/" + f);
}
const h = createHash("sha1");
for (const f of F) h.update(readFileSync(f));
writeFileSync(
  "dist/sw.js",
  readFileSync("sw.js", "utf8").replace("__V__", h.digest("hex").slice(0, 10)),
);
console.log("built dist/ (relative paths only)");
