/* JC Diagnose – Offline-Cache. Bei jeder neuen Version VER erhöhen. */
var VER = 'jc-0160';
var FILES = ['./', './index.html', './app.css?v=0160', './data.js?v=0160', './jcx.js?v=0160', './oszi.js?v=0160', './pids.js?v=0160', './ecus.js?v=0160', './bericht.js?v=0160', './app.js?v=0160', './manifest.json', './icon-192.png', './icon-512.png'];
self.addEventListener('install', function(e){ e.waitUntil(caches.open(VER).then(function(c){ return c.addAll(FILES); }).then(function(){ return self.skipWaiting(); })); });
self.addEventListener('activate', function(e){ e.waitUntil(caches.keys().then(function(ks){ return Promise.all(ks.filter(function(k){ return k!==VER; }).map(function(k){ return caches.delete(k); })); }).then(function(){ return self.clients.claim(); })); });
self.addEventListener('fetch', function(e){
  if (e.request.method !== 'GET') return;
  var u = new URL(e.request.url);
  if (u.origin !== location.origin) { e.respondWith(caches.match(e.request).then(function(r){ return r || fetch(e.request).then(function(res){ var cp = res.clone(); caches.open(VER).then(function(c){ c.put(e.request, cp); }); return res; }); })); return; }
  var isPage = e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('index.html');
  if (isPage){   // Startseite zuerst aus dem Netz, damit neue Versionen sofort erscheinen; offline aus dem Cache
    e.respondWith(fetch(e.request).then(function(res){ var cp = res.clone(); caches.open(VER).then(function(c){ c.put('./index.html', cp); }); return res; }).catch(function(){ return caches.match('./index.html'); }));
    return;
  }
  e.respondWith(caches.match(e.request).then(function(r){ return r || fetch(e.request); }));
});
