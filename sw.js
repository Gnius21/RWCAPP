/* RWCAPP service worker — offline app shell.
   Bumps the cache name on each release so old shells are evicted.
   Live weather data (NOAA / KNMI / proxies) is cross-origin and is left
   to the network + the app's own localStorage cache — never served stale
   from here. */
const CACHE = 'rwcapp-shell-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './images/cloud-types.jpeg',
  './images/beaufort-scale.jpeg',
  './images/compass-rose.jpeg',
  './images/visibility-flow.png',
  './images/weather-vis-table.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // Cache best-effort: a single CDN miss must not abort the whole install.
      Promise.allSettled(SHELL.map((u) => c.add(u)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isLeaflet = url.hostname === 'unpkg.com';

  // Only the app shell is cache-managed. Everything else (data APIs, proxies,
  // fonts) goes straight to the network so live data is never stale-served.
  if (!sameOrigin && !isLeaflet) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) {
        // Refresh in the background so the next load is current.
        fetch(req).then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        }).catch(() => {});
        return hit;
      }
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
