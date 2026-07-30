const C='furugen-ver7-cache-7.2.0';
const CORE=['./','./index.html','./config.js','./manifest.webmanifest','./assets/css/app.css','./assets/js/app.js'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(C).then(cache=>cache.addAll(CORE)))});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==C).map(key=>caches.delete(key)))),self.clients.claim()]))});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(C).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request)))});
