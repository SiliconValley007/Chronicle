import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const first = (p) => p.locator(".card[data-id]").first();
const axe = async (p) => (
  await p.waitForTimeout(900),
  (
    await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
  ).violations.map((v) => v.id)
);
test.beforeEach(({ page }) =>
  page.route("**/*wikipedia.org/**", (r) => r.abort()),
);
const mockWiki = async (p) => {
  await p.route("**/w/api.php**", (r) => {
    const pages = {};
    for (let n = 1; n <= 6; n++)
      pages[n] = {
        pageid: n,
        index: n,
        title: "Test Event " + n,
        extract:
          "In 1850 test event " +
          n +
          " took place. It was used to exercise the bulk generator path. Observers recorded what happened that year. The test ends with a long closing remark about it. This fragment was cut off...",
        fullurl: "https://en.wikipedia.org/wiki/Test_Event_" + n,
      };
    r.fulfill({
      json: { query: { pages } },
      headers: { "access-control-allow-origin": "*" },
    });
  });
};
test("first visit: no progress bar, font, favicon, sw, 195 countries, axe", async ({
  page,
}) => {
  const e = [];
  page.on(
    "console",
    (m) =>
      m.type() === "error" && !/ERR_|fonts/.test(m.text()) && e.push(m.text()),
  );
  page.on("pageerror", (x) => e.push(x.message));
  await page.goto("./");
  await expect(first(page)).toBeVisible();
  await expect(page.locator(".bar,[role=progressbar]")).toHaveCount(0);
  expect(
    await page.evaluate(() => getComputedStyle(document.body).fontFamily),
  ).toContain("Google Sans Flex");
  await expect(page.locator("link[rel=icon]")).toHaveAttribute(
    "href",
    "favicon.svg",
  );
  expect(
    await page.evaluate(() =>
      navigator.serviceWorker.ready.then((r) => !!r.active),
    ),
  ).toBe(true);
  expect(await axe(page)).toEqual([]);
  await page.click("#bc");
  await expect(page.locator("#cl button")).toHaveCount(195);
  {
    const sb = await page.locator("#q").boundingBox(),
      fb = await page.locator("#cl button").first().boundingBox();
    expect(fb.y).toBeGreaterThanOrEqual(sb.y + sb.height);
  }
  expect(await page.locator("#cl").innerText()).not.toMatch(/0\/0/);
  expect(
    (await page.locator("#cl button").allInnerTexts()).filter(
      (t) =>
        /Endless stream|0\/0/.test(t) || t.split(/\s*\n\s*/).includes("New"),
    ),
  ).toEqual([]);
  expect(await axe(page)).toEqual([]);
  await page.keyboard.press("Escape");
  await page.click("#bs");
  expect(await axe(page)).toEqual([]);
  expect(e).toEqual([]);
});
test("keyboard nav marks viewed; reload excludes", async ({ page }) => {
  await page.goto("./#country=IN");
  const id = await first(page).getAttribute("data-id");
  await page.waitForTimeout(2500);
  await page.reload();
  const ids = await page
    .locator(".card[data-id]")
    .evaluateAll((n) => n.map((x) => x.dataset.id));
  expect(ids).not.toContain(id);
  expect(ids.length).toBeGreaterThan(0);
});
test("live prefetch appends; live+seed bookmarks persist in Saved", async ({
  page,
}) => {
  await mockWiki(page);
  await page.goto("./#country=GR");
  await expect(page.locator('.card[data-id^="live-"]').first()).toBeAttached();
  const lid = await page
    .locator('.card[data-id^="live-"]')
    .first()
    .getAttribute("data-id");
  await page
    .locator('.card[data-id^="live-"]')
    .first()
    .locator(".row .save-btn")
    .click();
  await first(page).locator(".row .save-btn").click();
  await page.reload();
  await page.evaluate(() => {
    location.hash = "#feed=saved";
  });
  await expect(page.locator(`.card[data-id="${lid}"]`)).toHaveCount(1);
  expect(await page.locator(".card[data-id]").count()).toBeGreaterThanOrEqual(
    2,
  );
  await expect(page.locator(".card.end h2")).toHaveText(
    "End of your saved articles",
  );
  expect(await axe(page)).toEqual([]);
});
test("offline: shell, seed feed and saved render via service worker", async ({
  page,
  context,
}) => {
  const e = [];
  page.on("pageerror", (x) => e.push(x.message));
  await page.goto("./#country=GR");
  await first(page).locator(".row .save-btn").click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.goto("./#feed=saved");
  await page.reload();
  await expect(first(page)).toBeVisible();
  await expect(page.locator(".card.end h2")).toHaveText(
    "End of your saved articles",
  );
  await page.evaluate(() => {
    location.hash = "#";
  });
  await expect(first(page)).toBeVisible();
  expect(e).toEqual([]);
});
test("empty saved; exhaustion; reset keeps saved", async ({ page }) => {
  await page.goto("./#feed=saved");
  await expect(page.locator(".card.end h2")).toHaveText(
    "No saved articles yet",
  );
  await page.goto("./#country=GR");
  await first(page).locator(".row .save-btn").click();
  const ids = await page.evaluate(async () =>
    (await import("./data.js")).ITEMS.filter((i) => i.c === "Greece").map(
      (i) => i.id,
    ),
  );
  await page.evaluate(
    (v) => localStorage.setItem("chr:viewed", JSON.stringify(v)),
    ids,
  );
  await page.reload();
  await expect(page.locator(".card.end h2")).toHaveText(
    "You’ve read everything here",
  );
  page.once("dialog", (d) => d.accept());
  await page.locator(".card.end").getByText("Reset reading history").click();
  await expect(first(page)).toBeVisible();
  await page.evaluate(() => {
    location.hash = "#feed=saved";
  });
  await expect(first(page)).toBeVisible();
});
test("corrupt and blocked storage degrade gracefully", async ({ page }) => {
  const e = [];
  page.on("pageerror", (x) => e.push(x.message));
  await page.addInitScript(() => {
    localStorage.setItem("chr:viewed", "{bad");
    Storage.prototype.setItem = () => {
      throw new DOMException("q", "QuotaExceededError");
    };
  });
  await page.goto("./");
  await expect(first(page)).toBeVisible();
  await first(page).locator(".row .save-btn").click();
  await expect(page.locator("#toast")).toContainText("Storage unavailable");
  expect(e).toEqual([]);
});
test("top nav keeps clear of the viewport edge", async ({ page }) => {
  await page.goto("./");
  expect(
    (await page.locator("header nav").boundingBox()).y,
  ).toBeGreaterThanOrEqual(12);
});
test("rail buttons are 44px circles and never overflow", async ({ page }) => {
  await page.goto("./");
  await expect(first(page)).toBeVisible();
  const r = await page
    .locator(".card[data-id]")
    .first()
    .locator(".row button,.row a")
    .evaluateAll((n) =>
      n.map((e) => [
        e.scrollWidth <= e.clientWidth,
        Math.round(e.getBoundingClientRect().width),
        Math.round(e.getBoundingClientRect().height),
      ]),
    );
  const c = await page
    .locator("#ctl button")
    .evaluateAll((n) =>
      n.map((e) => [
        e.scrollWidth <= e.clientWidth,
        Math.round(e.getBoundingClientRect().width),
        Math.round(e.getBoundingClientRect().height),
      ]),
    );
  expect(r.length).toBeGreaterThan(1);
  expect([...r, ...c].every((x) => x[0] && x[1] === 44 && x[2] === 44)).toBe(
    true,
  );
});
test("unsaving in Saved removes cards instantly and shows the empty state", async ({
  page,
}) => {
  await page.goto("./#country=GR");
  await first(page).locator(".row .save-btn").click();
  await page.locator(".card[data-id]").nth(1).locator(".row .save-btn").click();
  await page.evaluate(() => {
    location.hash = "#feed=saved";
  });
  await expect(page.locator(".card[data-id]")).toHaveCount(2);
  await expect(page.locator("#ctl")).toBeVisible();
  await first(page).locator(".row .save-btn").click();
  await expect(page.locator(".card[data-id]")).toHaveCount(1);
  await first(page).locator(".row .save-btn").click();
  await expect(page.locator(".card[data-id]")).toHaveCount(0);
  await expect(page.locator(".card.end h2")).toHaveText(
    "No saved articles yet",
  );
  await expect(page.locator("#ctl")).toBeHidden();
  await expect(page.locator(".card.end")).toContainText(
    "double-tap any story to save it here",
  );
});
test("country with 2 seed stories shows both before any end state; no finite-count copy", async ({
  page,
}) => {
  await page.goto("./#country=AD");
  await expect(page.locator(".card[data-id]")).toHaveCount(2);
  await expect(page.locator(".card[data-id]").nth(0)).toBeAttached();
  await expect(page.locator("body")).not.toContainText("bundled articles");
  await expect(page.locator("body")).not.toContainText("(14 new)");
  await expect(page.locator(".card[data-id]").nth(1)).toBeAttached();
  await expect(page.locator(".card.end").last()).not.toContainText("bundled");
});
test("bulk generator responses append playable live cards", async ({
  page,
}) => {
  const q = [];
  page.on(
    "request",
    (r) => /generator=search/.test(r.url()) && q.push(r.url()),
  );
  await mockWiki(page);
  await page.goto("./#country=AD");
  await expect
    .poll(() => page.locator('.card[data-id^="live-"]').count())
    .toBeGreaterThanOrEqual(4);
  expect(q.length).toBeGreaterThan(0);
  expect(q[0]).toContain("prop=extracts");
  await expect(
    page.locator('.card[data-id^="live-"]').first().locator("h2"),
  ).toHaveText(/Test Event/);
  const sg = await page.locator('.card[data-id^="live-"] .sig').allInnerTexts();
  expect(sg.length).toBeGreaterThan(0);
  expect(sg.every((t) => /[^.]\.$/.test(t.trim()) && !t.includes("..."))).toBe(
    true,
  );
});
test("root URL always boots into Global even after a country session", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("s")) {
      sessionStorage.setItem("s", "1");
      localStorage.setItem("chr:cat", JSON.stringify("India"));
    }
  });
  await page.goto("./");
  await expect(first(page)).toBeVisible();
  await expect(page.locator("#bg")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#bc")).toHaveText("Countries");
  await expect(page.locator("#bc")).toHaveAttribute("aria-pressed", "false");
  expect(page.url()).not.toContain("country=");
});
test("active country highlights the Countries pill", async ({ page }) => {
  await page.goto("./#country=IN");
  await expect(first(page)).toBeVisible();
  await expect(page.locator("#bc")).toHaveText("India");
  await expect(page.locator("#bc")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#bg")).toHaveAttribute("aria-pressed", "false");
});
test("top nav has exactly Global, Countries, Saved and no Progress", async ({
  page,
}) => {
  await page.goto("./");
  await expect(first(page)).toBeVisible();
  expect(await page.locator("header nav button").allInnerTexts()).toEqual([
    "Global",
    "Countries",
    "Saved",
  ]);
  await expect(page.locator("#bi")).toHaveCount(0);
  await expect(page.locator("header")).not.toContainText("Progress");
  await first(page).locator(".row .save-btn").click();
  await expect(page.locator("#bs")).toHaveText("Saved (1)");
});
test("every card shows a valid Read full article link that does not toggle the bookmark", async ({
  page,
}) => {
  await page.goto("./");
  await expect(first(page)).toBeVisible();
  await expect(page.locator(".source-cta").first()).toBeVisible();
  const r = await page.locator(".card[data-id]").evaluateAll((n) =>
    n.map((c) => {
      const a = c.querySelector("a.source-cta");
      return (
        !!a &&
        a.getAttribute("href").startsWith("https://") &&
        a.target === "_blank" &&
        a.rel.includes("noopener") &&
        a.rel.includes("noreferrer") &&
        a.textContent.startsWith("Read full article")
      );
    }),
  );
  expect(r.length).toBeGreaterThan(100);
  expect(r.every(Boolean)).toBe(true);
  await page.route("https://en.wikipedia.org/wiki/**", (r) =>
    r.fulfill({ body: "<html></html>", contentType: "text/html" }),
  );
  const [pop] = await Promise.all([
    page.waitForEvent("popup"),
    page.locator(".source-cta").first().dblclick(),
  ]);
  await pop.close();
  await expect(page.locator("#bs")).toHaveText("Saved");
});
test("single source link per card; share button in rail copies link without bookmarking", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("./");
  await expect(first(page)).toBeVisible();
  const c = first(page);
  await expect(c.locator('a[href^="https://"]')).toHaveCount(1);
  await expect(c.locator(".source-cta")).toHaveCount(1);
  await expect(c.locator('.row a[href^="https://"]')).toHaveCount(0);
  const sh = c.locator('.row button[aria-label="Share story"]');
  await expect(sh).toBeVisible();
  await sh.click();
  await expect(page.locator("#toast")).toContainText("Link copied");
  await expect(page.locator("#toast")).toHaveAttribute("role", "status");
  {
    const u = await page.evaluate(() => navigator.clipboard.readText());
    expect(u).not.toMatch(/\s/);
    expect(new URL(u).protocol).toMatch(/^https?:$/);
    expect(u).toContain("#story=");
  }
  await expect(c.locator(".save-btn")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#bs")).toHaveText("Saved");
});
test("active Countries pill has no double outline after selecting a country", async ({
  page,
}) => {
  await page.goto("./");
  await page.click("#bc");
  await page.locator("#cl button").nth(3).click();
  await expect(page.locator("#bc")).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(100);
  await expect(page.locator("#bc")).toHaveCSS(
    "border-top-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(page.locator("#bc")).toHaveCSS("outline-style", "none");
});
for (const mode of ["no-share", "share-abort"])
  test(`share always copies, highlights and confirms (${mode})`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript((m) => {
      Object.defineProperty(navigator, "share", {
        value:
          m === "no-share"
            ? undefined
            : () => Promise.reject(new DOMException("x", "AbortError")),
        configurable: true,
      });
    }, mode);
    await page.goto("./");
    await expect(first(page)).toBeVisible();
    const c = first(page),
      title = await c.locator("h2").innerText(),
      href = await c.locator(".source-cta").getAttribute("href"),
      sh = c.locator(".share-btn");
    await sh.click();
    await expect(sh).toHaveClass(/is-active/);
    await expect(sh).toHaveText("✓");
    await expect(sh).toHaveCSS("background-color", "rgb(229, 169, 60)");
    const t = page.locator("#toast");
    await expect(t).toHaveText("Link copied to clipboard");
    await expect(t).toHaveAttribute("role", "status");
    await expect(t).toHaveClass(/on/);
    await page.waitForTimeout(400);
    const b = await t.boundingBox(),
      vp = page.viewportSize();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
    expect(b.y + b.height).toBeLessThanOrEqual(vp.height);
    {
      const u = await page.evaluate(() => navigator.clipboard.readText());
      expect(u).not.toMatch(/\s/);
      expect(u).not.toContain(title);
      expect(new URL(u).hash).toContain("#story=");
    }
    await expect(sh).not.toBeFocused();
    await expect(sh).toHaveCSS("outline-style", "none");
    await expect(sh).not.toHaveClass(/is-active/, { timeout: 3000 });
    await expect(sh.locator("svg")).toHaveCount(1);
    await expect(page.locator("#bs")).toHaveText("Saved");
  });
test("share copies a pure deep link that reopens the exact story even after it was viewed", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./");
  await expect(first(page)).toBeVisible();
  const id = await first(page).getAttribute("data-id");
  await first(page).locator(".share-btn").click();
  const u = await page.evaluate(() => navigator.clipboard.readText());
  expect(u).not.toMatch(/\s/);
  expect(u).not.toContain(" — ");
  expect(new URL(u).protocol).toMatch(/^https?:$/);
  expect(u).toContain("#story=" + encodeURIComponent(id));
  await page.waitForTimeout(2600);
  await page.goto(u);
  await page.reload();
  await expect(page.locator(".card[data-id]").first()).toHaveAttribute(
    "data-id",
    id,
  );
  await expect(page.locator("#bg")).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(".card[data-id]").first().locator(".source-cta"),
  ).toBeVisible();
});
test("live deep link #story=…&wiki=… fetches and pins that story at card 0; live share link carries wiki slug", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.route("**/w/api.php**", (r) => {
    const u = new URL(r.request().url()),
      t = u.searchParams.get("titles"),
      pages = {};
    if (t)
      pages[777] = {
        pageid: 777,
        title: t.replace(/_/g, " "),
        extract:
          "In 1850 a deep linked story happened here. It exists only on Wikipedia and must be fetched. A third sentence follows for the body. A fourth sentence becomes the takeaway.",
        fullurl: "https://en.wikipedia.org/wiki/" + t,
      };
    else
      for (let n = 1; n <= 6; n++)
        pages[n] = {
          pageid: n,
          index: n,
          title: "Test Event " + n,
          extract:
            "In 1850 test event " +
            n +
            " took place. It was used to exercise the bulk generator path. Observers recorded what happened that year. The test ends here.",
          fullurl: "https://en.wikipedia.org/wiki/Test_Event_" + n,
        };
    r.fulfill({
      json: { query: { pages } },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto("./#story=live-777&wiki=Deep_Linked_Story");
  await expect
    .poll(() => page.locator(".card[data-id]").first().getAttribute("data-id"))
    .toBe("live-777");
  await expect(page.locator(".card[data-id]").first().locator("h2")).toHaveText(
    "Deep Linked Story",
  );
  await expect(
    page.locator(".card[data-id]").first().locator(".source-cta"),
  ).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Deep_Linked_Story");
  const lc = page
    .locator('.card[data-id^="live-"]:not([data-id="live-777"])')
    .first();
  await expect(lc).toBeAttached();
  await lc.locator(".share-btn").click({ force: true });
  const u = await page.evaluate(() => navigator.clipboard.readText());
  expect(u).toMatch(/#story=live-\d+&wiki=Test_Event_\d+$/);
});
