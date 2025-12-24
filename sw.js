const CACHE_NAME = "f90-music-cache-v1";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./song.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./offline.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // لا نكاشِف طلبات يوتيوب/جوجل API
  if (req.url.includes("googleapis.com") || req.url.includes("youtube.com") || req.url.includes("ytimg.com")) {
    return;
  }

  event.respondWith(
    fetch(req).then(res => {
      // خزّن نسخة من الملفات الثابتة
      const copy = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(()=>{});
      return res;
    }).catch(async () => {
      const cached = await caches.match(req);
      return cached || caches.match("./offline.html");
    })
  );
});
