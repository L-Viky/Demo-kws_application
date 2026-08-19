// SERVICE WORKER — KWS Smart Home

// Cambia questo nome ogni volta che aggiorni i file dell'app:
// forza il service worker a scaricare di nuovo tutto invece di
// servire la cache vecchia (stesso principio del "?v=" nell'HTML).
const CACHE_NAME = 'kws-smart-home-v4';

// File dell'app da salvare in cache al primo avvio.
const APP_SHELL = [
  './kws_smart_home_v4.html',
  './style.css',
  './script.js',
  './assets/tfjs_model/model.json',
  './assets/tfjs_model/group1-shard1of1.bin',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// TensorFlow.js viene caricato da CDN esterna
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/tensorflow/4.22.0/tf.min.js'
];

// ---- INSTALL: precarica tutto lo "shell" dell'app ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      // Il CDN va aggiunto uno a uno con no-cors 
      await Promise.all(
        CDN_ASSETS.map((url) =>
          fetch(url, { mode: 'no-cors' })
            .then((res) => cache.put(url, res))
            .catch((err) => console.warn('SW: CDN non cacheable ora:', url, err))
        )
      );
    })
  );
  self.skipWaiting(); // attiva subito il nuovo SW senza aspettare la chiusura di tutte le tab
});

// ---- ACTIVATE: elimina le cache di versioni precedenti ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ---- FETCH: cache-first, con fallback alla rete (e salvataggio in cache dei nuovi file) ----
self.addEventListener('fetch', (event) => {
  // Solo richieste GET: POST/altre non vanno cachate
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Salva in cache anche le risposte valide non ancora presenti
          // (utile per i singoli file del modello scaricati al volo).
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // Evita di cachare risposte di errore
            if (response.ok || response.type === 'opaque') {
              cache.put(event.request, copy);
            }
          });
          return response;
        })
        .catch(() => {
          // Offline e non in cache: non c'è molto da fare per asset binari,
          // ma per la pagina principale potremmo restituire una risposta di fallback.
          if (event.request.mode === 'navigate') {
            return caches.match('./kws_smart_home_v4.html');
          }
        });
    })
  );
});
