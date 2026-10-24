// Bump VERSION whenever app files or data change.
const VERSION = "v2";
const SHELL = `shell-${VERSION}`;
const IMG = "img-v1";
const CORE = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest",
  "data/dex.json", "data/moves.json", "data/meta.json", "icons/icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== IMG).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isImg = url.pathname.includes("/sprites/") || url.hostname === "raw.githubusercontent.com";
  if (isImg) {
    // sprites and artwork never change: cache-first, fill lazily so the whole dex works offline once seen
    e.respondWith(caches.open(IMG).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // app shell + data: cache-first, revalidate in background
  e.respondWith(caches.open(SHELL).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
