/*
 * Offline support for the shopping list. After a first visit the app, the product list and the photos already seen stay
 * on the phone, so the list and the shopping checklist still open with a weak signal inside the store.
 * Files with a version in their address (?v=…) never change, so they are served from the phone; the page itself is
 * always asked from the network first, so a new version of the site is picked up as soon as there is a connection.
 * The cache name changes with every published version (set by tools/publish.js), and older caches are removed.
 */
'use strict';
var CACHE = 'jamiya-5304b801e7';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function keep(req, res) {
  if (res && res.ok && res.type === 'basic') { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {                       // the page: network first, the saved copy when offline
    e.respondWith(fetch(req).then(function (res) { return keep(req, res); }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('./'); });
    }));
    return;
  }
  if (/[?&]v=/.test(url.search)) {                     // versioned files and photos: from the phone when already saved
    e.respondWith(caches.match(req).then(function (r) { return r || fetch(req).then(function (res) { return keep(req, res); }); }));
    return;
  }
  e.respondWith(fetch(req).then(function (res) { return keep(req, res); }).catch(function () { return caches.match(req); }));
});
