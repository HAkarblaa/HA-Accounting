/* HA camera barcode adapter. Native detector when usable, bundled ZXing fallback for Safari. */
(()=>{'use strict';
const FORMATS=['ean_13','ean_8','upc_a','upc_e','code_128','code_39','itf','codabar'];
let active=null,enginePromise=null;
function loadEngine(){
 if(window.ZXing?.MultiFormatReader)return Promise.resolve(window.ZXing);
 if(enginePromise)return enginePromise;
 enginePromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='./ha-zxing-0.21.3.min.js';script.async=true;let timer;
  const fail=()=>{clearTimeout(timer);script.onload=script.onerror=null;script.remove();reject(Error('تعذر تجهيز قارئ الباركود. حدّث البرنامج عند توفر الإنترنت، ثم أعد المحاولة.'));};
  script.onload=()=>{clearTimeout(timer);if(!window.ZXing?.MultiFormatReader){fail();return;}script.onload=script.onerror=null;resolve(window.ZXing);};
  script.onerror=fail;timer=setTimeout(fail,20000);document.head.appendChild(script);
 }).catch(error=>{enginePromise=null;throw error;});
 return enginePromise;
}
function fallback(z){
 const hints=new Map();hints.set(z.DecodeHintType.POSSIBLE_FORMATS,FORMATS.map(f=>z.BarcodeFormat[f.toUpperCase()]));hints.set(z.DecodeHintType.TRY_HARDER,true);
 const reader=new z.MultiFormatReader();reader.setHints(hints);const canvas=document.createElement('canvas'),context=canvas.getContext('2d',{willReadFrequently:true});
 if(!context)throw Error('تعذر تجهيز صورة الكاميرا في هذا المتصفح.');
 return{decode(video){
  const ratio=Math.min(1,960/video.videoWidth,720/video.videoHeight),width=Math.max(1,Math.round(video.videoWidth*ratio)),height=Math.max(1,Math.round(video.videoHeight*ratio));
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  context.drawImage(video,0,0,width,height);const rgba=context.getImageData(0,0,width,height).data,luminance=new Uint8ClampedArray(width*height);
  for(let p=0,i=0;p<luminance.length;p++,i+=4)luminance[p]=(rgba[i]+2*rgba[i+1]+rgba[i+2])>>2;
  const bitmap=new z.BinaryBitmap(new z.HybridBinarizer(new z.RGBLuminanceSource(luminance,width,height)));
  try{return reader.decodeWithState(bitmap).getText();}finally{reader.reset();}
 }};
}
function messageFor(error){
 if(error?.name==='NotAllowedError'||error?.name==='PermissionDeniedError')return 'اسمح باستخدام الكاميرا لهذا الموقع من إعدادات Safari، ثم اضغط إعادة المحاولة.';
 if(error?.name==='NotFoundError'||error?.name==='DevicesNotFoundError')return 'ما لكيت كاميرا متاحة على هذا الجهاز.';
 if(error?.name==='NotReadableError'||error?.name==='TrackStartError')return 'الكاميرا مشغولة أو تعذر تشغيلها. أغلق التطبيقات التي تستخدمها وأعد المحاولة.';
 if(error?.name==='SecurityError')return 'افتح البرنامج برابط HTTPS واسمح له باستخدام الكاميرا.';
 return error?.message||'تعذر تشغيل قارئ الكاميرا. أعد المحاولة أو أدخل رقم الباركود يدوياً.';
}
function stop(overlay){if(overlay?.__haBarcodeStop){overlay.__haBarcodeStop();return;}if(!overlay||active?.overlay===overlay)active?.stop();else overlay.remove();}
async function start(targetId){
 const target=document.getElementById(targetId),modal=document.getElementById('modal'),host=modal?.open?modal:document.getElementById('view');
 if(!target||!host)return;
 active?.stop();
 const overlay=document.createElement('div');overlay.className='barcode-camera-overlay';overlay.setAttribute('role','region');overlay.setAttribute('aria-label','قارئ الباركود بالكاميرا');
 overlay.style.position='fixed';overlay.style.zIndex='9999';
 overlay.innerHTML='<div class="barcode-camera-box"><div class="barcode-camera-head"><b>مسح الباركود بالكاميرا</b><button type="button" class="btn secondary small" data-camera-close>إغلاق</button></div><div style="position:relative"><video class="barcode-camera-video" autoplay playsinline webkit-playsinline muted></video><div class="barcode-camera-guide" style="top:35%;height:30%;box-shadow:none"></div></div><p data-camera-status role="status" aria-live="polite">جارٍ فتح الكاميرا الخلفية…</p><button type="button" class="btn secondary small" data-camera-retry hidden style="margin-top:12px">إعادة المحاولة</button></div>';
 // Camera must not resize or scroll the invoice behind it, including Safari's keyboard viewport.
 const scrollX=window.scrollX||0,scrollY=window.scrollY||0;
 const ancestors=[];for(let node=target.parentElement;node;node=node.parentElement)ancestors.push([node,node.scrollTop||0,node.scrollLeft||0]);
 const savedStyles=[];
 function lock(element,values){if(!element)return;const saved=Object.keys(values).map(key=>[key,element.style.getPropertyValue(key),element.style.getPropertyPriority(key)]);savedStyles.push([element,saved]);for(const [key,value]of Object.entries(values))element.style.setProperty(key,value,'important');}
 window.HA_BARCODE_CAMERA_ACTIVE=true;
 document.activeElement?.blur?.();
 lock(document.documentElement,{'overflow':'hidden','overscroll-behavior':'none','scroll-behavior':'auto'});
 lock(document.body,{'position':'fixed','top':-scrollY+'px','left':-scrollX+'px','width':'100%','overflow':'hidden','overscroll-behavior':'none'});
 if(host===modal)lock(modal,{'overflow':'hidden','overscroll-behavior':'none','scroll-behavior':'auto'});
 function restorePosition(){for(const [node,top,left]of ancestors){if(node.isConnected){node.scrollTop=top;node.scrollLeft=left;}}if(typeof window.scrollTo==='function')window.scrollTo(scrollX,scrollY);}
 function unlock(){for(const [element,values]of savedStyles.reverse())for(const [key,value,priority]of values){if(value)element.style.setProperty(key,value,priority);else element.style.removeProperty(key);}restorePosition();window.HA_BARCODE_CAMERA_ACTIVE=false;}
 host.appendChild(overlay);const video=overlay.querySelector('video'),status=overlay.querySelector('[data-camera-status]'),retry=overlay.querySelector('[data-camera-retry]');
 video.muted=true;video.autoplay=true;video.playsInline=true;
 let timer=0,observer=null,closed=false,done=false,stream=null,native=null,decoder=null,started=Date.now();
 const session={overlay,stop(){if(closed)return;closed=true;clearTimeout(timer);observer?.disconnect();document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',onPageHide);modal?.removeEventListener('close',onModalClose);if(stream){for(const track of stream.getTracks())track.stop();stream=null;}video.srcObject=null;overlay.remove();unlock();if(active===session)active=null;}};
 function onVisibility(){if(document.visibilityState==='hidden')session.stop();}function onPageHide(){session.stop();}function onModalClose(){if(host===modal)session.stop();}
 active=session;overlay.__haBarcodeStop=session.stop;overlay.querySelector('[data-camera-close]').onclick=session.stop;retry.onclick=()=>start(targetId);
 document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pagehide',onPageHide);modal?.addEventListener('close',onModalClose);
 if(typeof MutationObserver==='function'){observer=new MutationObserver(()=>{if(!overlay.isConnected||!target.isConnected)session.stop();});observer.observe(document.body,{childList:true,subtree:true});}
 function live(){return !closed&&overlay.isConnected&&target.isConnected&&active===session;}
 function fail(error){if(!live())return;clearTimeout(timer);if(stream){for(const track of stream.getTracks())track.stop();stream=null;}video.srcObject=null;status.textContent=messageFor(error);retry.hidden=false;}
 async function useFallback(){if(!live()||decoder)return;status.textContent='جارٍ تجهيز القارئ…';const z=await loadEngine();if(!live())return;decoder=fallback(z);native=null;status.textContent='وجّه خطوط الباركود داخل الإطار وثبّت الكاميرا لحظة.';}
 function deliver(value){const text=String(value??'').trim();if(!text||!live()||done)return false;done=true;window.HA_BARCODE_CAMERA_RESULT_UNTIL=Date.now()+1200;session.stop();target.value=text;target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));return true;}
 async function scan(){
  if(!live())return;
  if(video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0){
   try{
    if(native){let values;try{values=await native.detect(video);}catch{await useFallback();values=[];}if(!live())return;const code=(values||[]).find(x=>x?.rawValue);if(code&&deliver(code.rawValue))return;
     // Some browsers expose a detector but fail silently. Try the software reader as well.
     if(native&&Date.now()-started>3500)await useFallback();
    }else if(decoder){try{if(deliver(decoder.decode(video)))return;}catch(error){if(!['NotFoundException','ChecksumException','FormatException'].includes(error?.name)&&!['NotFoundException','ChecksumException','FormatException'].includes(error?.constructor?.name)&&!['NotFoundException','ChecksumException','FormatException'].includes(error?.getKind?.()))throw error;}}
   }catch(error){fail(error);return;}
  }
  if(live())timer=setTimeout(scan,200);
 }
 try{
  if(window.isSecureContext===false)throw Object.assign(Error('افتح البرنامج برابط HTTPS حتى تعمل الكاميرا.'),{name:'SecurityError'});
  if(!navigator.mediaDevices?.getUserMedia)throw Error('الكاميرا غير متاحة هنا. افتح رابط البرنامج في Safari واسمح باستخدام الكاميرا.');
  // Request camera in the button gesture before awaiting a library download (important on iOS).
  const captured=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
  if(!live()){captured.getTracks().forEach(t=>t.stop());return session;}stream=captured;video.srcObject=stream;await video.play();if(!live())return session;
  if(typeof window.BarcodeDetector==='function'){
   try{let formats=FORMATS;if(typeof window.BarcodeDetector.getSupportedFormats==='function'){const supported=await window.BarcodeDetector.getSupportedFormats();formats=FORMATS.filter(f=>supported.includes(f));}if(!live())return session;if(formats.length)native=new window.BarcodeDetector({formats});}catch{native=null;}
  }
  if(!native)await useFallback();if(!live())return session;status.textContent='وجّه خطوط الباركود داخل الإطار وثبّت الكاميرا لحظة.';started=Date.now();timer=setTimeout(scan,0);
 }catch(error){fail(error);}
 return session;
}
window.HABarcodeScanner={start,stop};
})();
