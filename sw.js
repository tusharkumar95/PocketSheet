const CACHE_NAME = "pocketsheet-shell-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./style.css?v=3",
  "./data.css?v=4",
  "./lookup.css?v=5",
  "./rowview.css?v=6",
  "./summary.css?v=7",
  "./refine.css?v=8",
  "./core-tools.css?v=9",
  "./file-tools.css?v=10",
  "./dynamic-columns.css?v=11",
  "./sheet-ops.css?v=12",
  "./workbook.css?v=13",
  "./tab-polish.css?v=14",
  "./polish-v2.css?v=15",
  "./app.js?v=3",
  "./formula-number.js?v=8",
  "./data.js?v=4",
  "./lookup.js?v=5",
  "./rowview.js?v=6",
  "./summary.js?v=7",
  "./core-tools.js?v=9",
  "./file-tools.js?v=10",
  "./dynamic-columns.js?v=11",
  "./sheet-ops.js?v=12",
  "./workbook.js?v=13",
  "./tab-polish.js?v=14",
  "./polish-v2.js?v=15"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html")))
  );
});
