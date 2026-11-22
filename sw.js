/* Service worker. Všechny cesty jsou relativní ke skriptu, takže platí i v podsložce (např. /svezemete/). */
const CACHE = "svezemete-v9";
const SCOPE_URL = new URL("./", self.location.href);
const ASSETS = [
  "./index.html",
  "./styles.css",
  "./config.js",
  "./manifest.json",
  "./sw.js",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-192.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./js/app.js",
  "./js/engine.js",
  "./js/terms.js",
  "./podminky.html",
  "./qr-podminky.png",
].map((path) => new URL(path, self.location.href).href);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!url.href.startsWith(SCOPE_URL.href)) return;
  const fallback = new URL("./index.html", self.location.href).href;
  event.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match(fallback)))
  );
});
