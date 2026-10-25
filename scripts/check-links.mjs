import { ITEMS } from "../data.js";
const offlineErr = (e) =>
  [
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "UND_ERR_CONNECT_TIMEOUT",
  ].includes(e.cause?.code);
function fmt(u) {
  try {
    const x = new URL(u);
    if (
      x.protocol !== "https:" ||
      x.hostname !== "en.wikipedia.org" ||
      !/^\/wiki\/[^\s#?]+$/.test(x.pathname)
    )
      return false;
    decodeURIComponent(x.pathname);
    return !/\s/.test(u);
  } catch {
    return false;
  }
}
let mode = "live",
  bad = 0;
try {
  await fetch(ITEMS[0].src.u, { method: "HEAD" });
} catch (e) {
  if (offlineErr(e)) mode = "offline";
}
if (mode === "live") {
  for (const i of ITEMS) {
    try {
      const r = await fetch(i.src.u, { method: "HEAD" });
      if (!r.ok) {
        bad++;
        console.log(r.status, i.src.u);
      }
    } catch (e) {
      bad++;
      console.log("ERR", i.src.u);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
} else
  for (const i of ITEMS)
    if (!fmt(i.src.u)) {
      bad++;
      console.log("bad format", i.src.u);
    }
console.log(
  `MODE: ${mode === "live" ? "live HTTP check" : "OFFLINE format validation only (network blocked; links NOT verified live)"} — ${ITEMS.length} URLs, ${bad} problem(s)`,
);
process.exit(bad ? 1 : 0);
