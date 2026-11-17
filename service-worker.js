const CACHE='ha-accounting-shell-v230-form-recovery';
const ASSETS=['./ha-form-recovery.js?v=1','./ha-html2canvas-1.4.1.min.js','./ha-invoice-layout.js?v=1','./ha-app-update.js?v=5','./','./index.html','./yemen-section.js?v=4-form-recovery','./yemen-section.css?v=2-customer-requests-maintenance','./ha-language.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./ha-accounting-product-photos.js','./ha-business-print.js?v=3-layout-pdf','./ha-personal-print-center.js?v=1','./supabase-2.118.0.js','./auth-client.js?v=86-processor-returns','./supabase-config.js','./ha-pos-operations.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ha-accounting-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='HA_SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(new URL(request.url).searchParams.has('ha_check')){event.respondWith(fetch(request,{cache:'no-store'}));return;}
  if(request.mode==='navigate'){
    event.respondWith((async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);try{const response=await fetch(request,{signal:controller.signal});if(!response.ok)throw new Error('Navigation unavailable');const copy=response.clone();event.waitUntil(caches.open(CACHE).then(async cache=>{await cache.put('./index.html',copy.clone());await cache.put(request,copy);}));return response;}catch(error){const cached=await caches.match(request)||await caches.match('./index.html');if(cached)return cached;throw error;}finally{clearTimeout(timer);}})());
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
