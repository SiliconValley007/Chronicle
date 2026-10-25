// Usage: node scripts/content-pipeline.mjs validate | summary <WikipediaTitle>
import { ITEMS } from "../data.js";
import { REG } from "../countries.js";
const [cmd, arg] = process.argv.slice(2);
if (cmd === "validate") {
  let bad = 0;
  const names = new Set(REG.map((r) => r.name)),
    ids = new Set();
  for (const i of ITEMS) {
    const w = i.b.split(/\s+/).length,
      e = [];
    if (ids.has(i.id)) e.push("dup id");
    ids.add(i.id);
    if (i.c && !names.has(i.c)) e.push("country");
    if (w < 8 || w > 120) e.push("body length " + w);
    if (!i.license) e.push("license");
    if (!/^https:\/\//.test(i.src.u)) e.push("url");
    if (e.length) {
      bad++;
      console.log(i.id, e.join(","));
    }
  }
  const cov = new Set(ITEMS.map((i) => i.c));
  console.log(
    `${ITEMS.length} items; ${REG.filter((r) => cov.has(r.name)).length}/195 countries covered; ${bad} invalid`,
  );
  process.exit(bad ? 1 : 0);
} else if (cmd === "summary" && arg) {
  // helper for authors: prints REST summary for manual rewriting; polite UA, backoff
  for (let t = 0; t < 4; t++) {
    const r = await fetch(
      "https://en.wikipedia.org/api/rest_v1/page/summary/" +
        encodeURIComponent(arg),
      {
        headers: {
          "User-Agent":
            "ChronicleBot/1.0 (content authoring; contact via repo)",
        },
      },
    );
    if (r.ok) {
      const j = await r.json();
      console.log(
        JSON.stringify(
          {
            title: j.title,
            url: j.content_urls?.desktop?.page,
            extract: j.extract,
          },
          null,
          1,
        ),
      );
      process.exit(0);
    }
    await new Promise((x) => setTimeout(x, 1000 * 2 ** t));
  }
  console.error("failed");
  process.exit(1);
} else {
  console.log("usage: validate | summary <WikipediaTitle>");
}
