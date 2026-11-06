/* JC Diagnose – Offline-Cache. Bei jeder neuen Version VER erhöhen. */
var VER = 'jc-0104';
var FILES = ['./', './index.html', './app.css?v=0104', './data.js?v=0104', './jcx.js?v=0104', './oszi.js?v=0104', './pids.js?v=0104', './bericht.js?v=0104', './app.js?v=0104', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function(e){ e.waitUntil(caches.open(VER).then(function(c){ return c.addAll(FILES); }).then(function(){ return self.skipWaiting(); })); });
self.addEventListener('activate', function(e){ e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k!==VER; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); })); });
self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  var u = new URL(e.request.url);
  if (u.origin !== location.origin) { e.respondWith(caches.match(e.request).then(function(r){ return r || fetch(e.request).then(function(res){ var cp = res.clone(); caches.open(VER).then(function(c){ c.put(e.request, cp); }); return res; }); })); return; }
  e.respondWith(caches.match(e.request, {ignoreSearch: u.pathname.endsWith('/') || u.pathname.endsWith('index.html')}).then(function(r){ return r || fetch(e.request); }));
});
