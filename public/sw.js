const CACHE_VERSION = 'v2-hungarian-fix';
const CACHE_NAME = 'darts-training-' + CACHE_VERSION;

self.addEventListener('install', (event) => {
  console.log('[SW] Installing new version:', CACHE_VERSION);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('[SW] Clearing old caches...');
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('darts-training-') && name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Claiming clients...');
      return self.clients.claim();
    }).then(() => {
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        console.log('[SW] Forcing Hungarian locale and reload for', clients.length, 'clients');
        clients.forEach(client => {
          client.postMessage({
            type: 'FORCE_HUNGARIAN_LOCALE'
          });
          client.postMessage({
            type: 'FORCE_RELOAD'
          });
        });
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/') || event.request.url.includes('supabase')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || 'New notification',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: data.data || {},
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'DartsTraining', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
