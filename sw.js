// Mbo'ehàra Service Worker
// Versión del cache — cambiar este número fuerza actualización en todos los dispositivos
const CACHE_VERSION = 'mboehara-v1.2';
const CACHE_NAME = `${CACHE_VERSION}-cache`;

// Archivos que se cachean para uso offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
];

// ── INSTALL: cachear recursos estáticos ───────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Instalando Mbo\'ehàra v1...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando recursos estáticos...');
        // Cachear de a uno para no fallar si alguno no carga
        return Promise.allSettled(
          STATIC_ASSETS.map(url => cache.add(url).catch(err => console.warn('[SW] No se pudo cachear:', url, err)))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar caches viejos ───────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activando nueva versión...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Eliminando cache viejo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia cache-first con fallback a red ─────────────────────────
self.addEventListener('fetch', event => {
  // Solo interceptar GET requests
  if (event.request.method !== 'GET') return;

  // No interceptar requests de analytics o terceros no esenciales
  const url = new URL(event.request.url);
  if (url.hostname.includes('google-analytics') || url.hostname.includes('doubleclick')) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Si está en cache, devolver cache (y actualizar en background)
        if (cachedResponse) {
          // Actualizar en background para próxima visita
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => {}); // Silenciar errores de red en background
          return cachedResponse;
        }

        // Si no está en cache, ir a la red
        return fetch(event.request)
          .then(networkResponse => {
            // Cachear la respuesta si es válida
            if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            // Sin red y sin cache: mostrar página offline
            if (event.request.destination === 'document') {
              return caches.match('/') || new Response(
                `<!DOCTYPE html>
                <html lang="es">
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                <title>Mbo'ehàra — Sin conexión</title>
                <style>
                  body{font-family:'Sora',sans-serif;background:#0a0e1a;color:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;text-align:center;padding:24px;}
                  h1{font-size:24px;font-weight:800;margin-bottom:8px;}
                  p{color:#64748b;font-size:14px;margin-bottom:24px;line-height:1.6;}
                  button{background:linear-gradient(135deg,#c0392b,#1a3a5c);color:#fff;border:none;border-radius:12px;padding:14px 28px;font-size:14px;font-weight:700;cursor:pointer;}
                </style>
                </head>
                <body>
                  <div style="font-size:60px;margin-bottom:16px">📵</div>
                  <h1>Sin conexión</h1>
                  <p>Mbo'ehàra necesita conexión para cargar.<br>Las lecciones que ya completaste están guardadas.</p>
                  <button onclick="window.location.reload()">Reintentar →</button>
                </body>
                </html>`,
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
              );
            }
          });
      })
  );
});

// ── PUSH NOTIFICATIONS (preparado para fase 2) ────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "Mbo'ehàra", {
      body: data.body || '¡Tenés una nueva lección disponible!',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'mboehara-notification',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      const url = event.notification.data?.url || '/';
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

console.log('[SW] Mbo\'ehàra Service Worker cargado ✅');
Se.js
