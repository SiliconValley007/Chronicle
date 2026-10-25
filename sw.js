const V = "chronicle-__V__";
addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(V)
      .then((c) =>
        c.addAll([
          "./",
          "index.html",
          "data.js",
          "countries.js",
          "favicon.svg",
          "manifest.webmanifest",
        ]),
      )
      .then(() => skipWaiting()),
  ),
);
addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((k) =>
        Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x))),
      )
      .then(() => clients.claim()),
  ),
);
addEventListener("fetch", (e) => {
  if (new URL(e.request.url).origin !== self.location.origin) return;
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const c = r.clone();
          caches.open(V).then((x) => x.put(e.request, c));
        }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
