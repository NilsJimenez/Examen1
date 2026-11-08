/**
 * Service Worker para FashionStore PWA (Desafío II - Sistemas 2)
 * Proporciona:
 *   1. Capacidad de instalación como PWA independiente (Standalone).
 *   2. Estrategia Network-First con fallback a Cache para navegación SPA offline.
 *   3. Estrategia Cache-First para recursos estáticos (estilos, fuentes, scripts).
 *   4. Persistencia offline sin conexión a Internet.
 */

const CACHE_NAME = 'fashionstore-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// 1. INSTALACIÓN: Precaching de recursos críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precacheando recursos estáticos de FashionStore...');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Aviso al precachear algunos recursos externos:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. ACTIVACIÓN: Limpieza de versiones obsoletas de caché
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Eliminando caché obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. FETCH: Gestión inteligente de peticiones con fallback offline
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // No interceptar llamadas al backend de sincronización para que el servicio offline maneje los errores HTTP directamente
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Para navegación HTML (SPA): Network-first con fallback a cache '/index.html'
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html').then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return caches.match('/');
        });
      })
    );
    return;
  }

  // Para assets estáticos: Cache-first con actualización en segundo plano
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // En background actualizar cache si hay red
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {/* Offline silente */});
        return cachedResponse;
      }

      // Si no está en cache, ir a la red
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch((err) => {
        console.warn('[SW] Fallo de red para recurso estático:', request.url);
        return new Response('', { status: 408, statusText: 'Offline Fallback' });
      });
    })
  );
});
