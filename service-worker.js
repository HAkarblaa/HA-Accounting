const CACHE='ha-accounting-shell-v680-compact-invoice-forms';
const SHELL_BUILD='20261124-compact-invoice-forms-v68';
const ASSETS=['./ha-workspace-tabs.js?v=3-form-close','./ha-admin-demo.js?v=1','./ha-generator-demo.html?v=1','./ha-daily-profit.js?v=1','./ha-engineering-upgrade.js?v=6-invoice-lines','./ha-engineering-upgrade.css?v=1','./ha-processor-partners.js?v=2-engineering','./ha-processor-partners.css?v=1','./ha-bottom-submenus.js?v=1','./ha-bottom-submenus.css?v=1','./ha-voucher-design.css?v=2-fitted','./ha-voucher-design.js?v=2-fitted','./ha-section-sidebar.js?v=2-engineering','./ha-processor-sidebar.css?v=1','./ha-processor-sidebar.js?v=3-partners','./ha-processor-design.css?v=2-fitted','./ha-processor-design.js?v=3-invoice-lines','./ha-paper-templates.js?v=1','./ha-barcode-scanner.js?v=3-bounds','./ha-zxing-0.21.3.min.js','./ha-staff.js?v=4-invoice-lines','./ha-form-recovery.js?v=1','./ha-html2canvas-1.4.1.min.js','./ha-invoice-layout.js?v=12-thermal-clarity','./ha-app-update.js?v=68','./','./index.html','./yemen-section.js?v=11-invoice-lines','./yemen-section.css?v=2-customer-requests-maintenance','./ha-language.js?v=1','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./ha-accounting-product-photos.js','./ha-business-print.js?v=8-thermal-reports','./ha-personal-print-center.js?v=2-paper-templates','./supabase-2.118.0.js','./auth-client.js?v=96-resume-sync','./supabase-config.js','./ha-pos-operations.js'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await cache.addAll(ASSETS.map(url=>new Request(url,{cache:'reload'})));
  const html=await (await cache.match('./index.html')).text();
  const updater=await (await cache.match('./ha-app-update.js?v=68')).text();
  if(html.match(/name="ha-app-build" content="([^"]+)"/)?.[1]!==SHELL_BUILD || updater.match(/const build\s*=\s*'([^']+)'/)?.[1]!==SHELL_BUILD){
    await caches.delete(CACHE);throw new Error('Incomplete HA deployment');
  }
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ha-accounting-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='HA_SKIP_WAITING')self.skipWaiting();if(event.data?.type==='HA_GET_BUILD')event.ports?.[0]?.postMessage({type:'HA_BUILD',build:SHELL_BUILD});});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(new URL(request.url).searchParams.has('ha_check')){event.respondWith(fetch(request,{cache:'no-store'}));return;}
  const requestUrl=new URL(request.url),shellRoot=new URL('./',self.location.href),shellIndex=new URL('./index.html',self.location.href);
  if(request.mode==='navigate'&&(requestUrl.pathname===shellRoot.pathname||requestUrl.pathname===shellIndex.pathname)){
    const networkNavigation=async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);try{const response=await fetch(request,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw new Error('Navigation unavailable');const html=await response.clone().text(),build=html.match(/name="ha-app-build" content="([^"]+)"/)?.[1];if(requestUrl.searchParams.has('ha_update')&&build!==requestUrl.searchParams.get('ha_update'))throw new Error('Requested build unavailable');if(build===SHELL_BUILD){try{const cache=await caches.open(CACHE);await cache.put('./index.html',response.clone());}catch(error){console.warn('HA shell cache update failed',error);}}return response;}finally{clearTimeout(timer);}};
    const cachedNavigation=caches.open(CACHE).then(async cache=>(await cache.match(request))||(await cache.match('./index.html'))).catch(()=>undefined);
    // Register the lifetime promise synchronously while the FetchEvent is dispatching.
    let networkPromise;
    const network=()=>networkPromise||(networkPromise=networkNavigation());
    if(requestUrl.searchParams.has('ha_update')){event.respondWith(network().catch(async error=>{const cached=await cachedNavigation;if(cached)return cached;throw error;}));return;}
    event.waitUntil(cachedNavigation.then(()=>network()).then(()=>{},()=>{}));
    event.respondWith(cachedNavigation.then(cached=>cached||network()));
    return;
  }
  if(request.mode==='navigate'){event.respondWith(fetch(request).catch(async error=>{const cached=await caches.match(request);if(cached)return cached;throw error;}));return;}
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
