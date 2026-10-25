import { ITEMS, COUNTRIES } from "./data.js";
import { REG } from "./countries.js";
import { spawnSync } from "node:child_process";
const err = [],
  ids = new Set(),
  ER = {
    Ancient: [-1e5, 600],
    Medieval: [500, 1500],
    "Early Modern": [1400, 1800],
    Modern: [1750, 2100],
  };
if (REG.length !== 195 || new Set(REG.map((r) => r.code)).size !== 195)
  err.push("registry must have 195 unique codes");
if (JSON.stringify(REG.map((r) => r.name)) !== JSON.stringify(COUNTRIES))
  err.push("COUNTRIES != registry");
for (const i of ITEMS) {
  const w = (m) => err.push(`${i.id}: ${m}`);
  for (const k of [
    "id",
    "y",
    "era",
    "th",
    "t",
    "b",
    "sig",
    "license",
    "title",
    "body",
    "impact",
  ])
    if (!i[k]) w("missing " + k);
  if (ids.has(i.id)) w("duplicate id");
  ids.add(i.id);
  if (i.b.trim().length < 140) w(`body ${i.b.trim().length} chars (<140)`);
  if (
    !Number.isFinite(i.s) ||
    i.s > 2026 ||
    !ER[i.era] ||
    i.s < ER[i.era][0] ||
    i.s > ER[i.era][1]
  )
    w("year/era mismatch");
  if (!/^https:\/\/en\.wikipedia\.org\/wiki\/[^\s#?]+$/.test(i.src.u))
    w("non-canonical source URL");
  if (i.c && !COUNTRIES.includes(i.c)) w("unknown country " + i.c);
}
const sg = new Map();
for (const i of ITEMS) {
  if (sg.has(i.sig)) err.push(`duplicate sig: ${i.id} / ${sg.get(i.sig)}`);
  sg.set(i.sig, i.id);
}
const cov = spawnSync(process.execPath, ["scripts/coverage.mjs"], {
  stdio: "inherit",
});
if (cov.status !== 0) err.push("coverage < 2 articles x 195 countries");
if (err.length) {
  console.error(`FAIL: ${err.length} problem(s)`);
  console.error(
    err.slice(0, 15).join("\n") +
      (err.length > 15 ? `\n…and ${err.length - 15} more` : ""),
  );
  process.exit(1);
}
console.log(`OK: ${ITEMS.length} items, 195 countries`);
