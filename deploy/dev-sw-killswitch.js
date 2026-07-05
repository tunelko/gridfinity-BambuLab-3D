// Kill-switch service worker.
// Clients that still have the old Vite dev-server PWA registered fetch this
// URL on their next update check. It installs, takes over immediately,
// unregisters itself and reloads every open tab — leaving a clean client
// that then registers the real production sw.js.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* best effort */ }
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.navigate(client.url);
    }
  })());
});
