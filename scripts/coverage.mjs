import { ITEMS } from "../data.js";
import { REG } from "../countries.js";
const n = {};
for (const i of ITEMS) n[i.c] = (n[i.c] || 0) + 1;
const miss = REG.filter((r) => (n[r.name] || 0) < 2);
console.log(
  `Coverage with >=2 articles: ${REG.length - miss.length}/195 (${ITEMS.length} total, 390 required)`,
);
if (miss.length)
  console.log(
    "Need more: " +
      miss.map((r) => r.name + "(" + (n[r.name] || 0) + ")").join(", "),
  );
process.exit(miss.length || ITEMS.length < 390 ? 1 : 0);
