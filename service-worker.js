const CACHE='ha-accounting-shell-v4-push-notifications';
const ASSETS=['./','./index.html','./auth-client.js','./supabase-config.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));return response;}).catch(async()=>await caches.match(request)||await caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;})));
});

self.addEventListener('push',event=>{
  let data={};try{data=event.data?event.data.json():{};}catch{data={body:event.data?.text()||'يوجد استحقاق محاسبي متأخر.'};}
  const title=data.title||'تنبيه من HA محاسبة';
  const options={body:data.body||'يوجد استحقاق يحتاج المتابعة.',icon:'./icon-192.png',badge:'./icon-192.png',tag:data.tag||'ha-accounting-push',renotify:false,data:{url:data.url||'./'}};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const target=new URL(event.notification.data?.url||'./',self.registration.scope).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if(new URL(client.url).origin===self.location.origin)return client.focus().then(()=>client.navigate(target));}return clients.openWindow(target);}));
});
