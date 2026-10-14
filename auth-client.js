(()=>{
'use strict';
const cfg=window.HA_SUPABASE_CONFIG||{};
const gate=document.getElementById('authGate'),form=document.getElementById('authForm'),msg=document.getElementById('authMessage'),loginBtn=document.getElementById('loginButton');
const adminLayer=document.getElementById('subscriberAdmin'),adminMessage=document.getElementById('adminMessage');
if(!window.supabase?.createClient||!cfg.url||!cfg.publishableKey){msg.textContent='إعداد الاتصال غير مكتمل. راجع ملف supabase-config.js.';return;}
function getDeviceId(){let id=localStorage.getItem('ha-accounting-device-id');if(!id){id=crypto.randomUUID?crypto.randomUUID():`ha-${Date.now()}-${Math.random().toString(36).slice(2)}`;localStorage.setItem('ha-accounting-device-id',id);}return id;}
const DEVICE_ID=getDeviceId();
window.HA_DEVICE_ID=DEVICE_ID;
const DEVICE_LABEL=`${navigator.userAgentData?.platform||navigator.platform||'جهاز'} / ${/Mobile/i.test(navigator.userAgent)?'موبايل':'حاسبة'}`.slice(0,120);
const client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},global:{headers:{'x-ha-device-id':DEVICE_ID}}});
window.HA_AUTH_CLIENT=client;
let currentUser=null,isAdmin=false,syncTimer=0;
const userKey=id=>'ha-accounting-v1:'+id;
const showMessage=(text,ok=false)=>{msg.textContent=text;msg.classList.toggle('success',ok);};
const adminMsg=(text,ok=false)=>{adminMessage.textContent=text;adminMessage.classList.toggle('success',ok);};
const hideApp=()=>{document.querySelector('.layout').style.display='none';gate.style.display='grid';};
const showApp=()=>{gate.style.display='none';document.querySelector('.layout').style.display='grid';document.getElementById('openAdmin').classList.toggle('hidden',!isAdmin);};
function loginEmail(raw){const id=String(raw||'').trim();return id.includes('@')?id:`${id.toLowerCase()}@ha-accounting.invalid`;}
async function checkAccess(user){
 const adminResult=await client.from('super_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 if(adminResult.error)throw new Error('تعذر التحقق من صلاحيات الحساب. تأكد من تشغيل ملفات SQL في Supabase.');
 if(adminResult.data){isAdmin=true;return;}
 const subResult=await client.from('subscriptions').select('active,expires_at').eq('user_id',user.id).maybeSingle();
 if(subResult.error)throw new Error('تعذر التحقق من الاشتراك.');
 const sub=subResult.data;
 if(!sub)throw new Error('هذا الحساب غير مفعّل للاستخدام. راجع الأدمن.');
 if(!sub.active)throw new Error('الاشتراك موقوف حالياً. راجع الأدمن.');
 if(sub.expires_at&&new Date(sub.expires_at).getTime()<Date.now())throw new Error('انتهت مدة الاشتراك. راجع الأدمن للتجديد.');
 isAdmin=false;
}
async function claimDevice(user){
 const {data,error}=await client.functions.invoke('manage-subscribers',{body:{action:'claim-device',deviceId:DEVICE_ID,deviceLabel:DEVICE_LABEL}});
 if(error||data?.error){let reason=data?.error;try{if(!reason&&error?.context)reason=(await error.context.json())?.error;}catch{}if(reason==='device_locked')throw new Error('هذا الحساب مربوط بجهاز ثاني. اطلب من الأدمن يفك ربط الجهاز القديم.');if(reason==='subscription_inactive')throw new Error('الاشتراك موقوف أو منتهي. راجع الأدمن.');throw new Error('تعذر تثبيت هذا الجهاز للحساب. تأكد من تحديث ونشر دالة إدارة المشتركين.');}
 localStorage.setItem('ha-accounting-device-bound:'+user.id,DEVICE_ID);
 localStorage.setItem('ha-accounting-access:'+user.id,JSON.stringify({isAdmin,active:true,deviceId:DEVICE_ID,checkedAt:Date.now()}));
}
async function prepareWorkspace(user){
 const key=userKey(user.id);
 const {data,error}=await client.from('accounting_workspaces').select('data').eq('user_id',user.id).maybeSingle();
 if(error)throw new Error('تعذر تحميل بيانات الحساب من السحابة.');
 if(data?.data){localStorage.setItem(key,JSON.stringify(data.data));return;}
 let initial=null;
 try{initial=JSON.parse(localStorage.getItem(key)||'null');}catch{}
 if(!initial&&isAdmin){try{initial=JSON.parse(localStorage.getItem('ha-accounting-v1')||'null');}catch{}}
 if(initial){localStorage.setItem(key,JSON.stringify(initial));const saved=await client.from('accounting_workspaces').upsert({user_id:user.id,data:initial,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(saved.error)throw new Error('تعذر إنشاء مساحة البيانات السحابية.');}
}
async function enter(user){
 if(navigator.onLine){await checkAccess(user);await claimDevice(user);await prepareWorkspace(user);}
 else{
  let cached=null;try{cached=JSON.parse(localStorage.getItem('ha-accounting-access:'+user.id)||'null');}catch{}
  if(!cached?.active)throw new Error('أول تسجيل دخول يحتاج إنترنت. اتصل بالإنترنت مرة واحدة وبعدها تگدر تشتغل أوفلاين.');
  if(localStorage.getItem('ha-accounting-device-bound:'+user.id)!==DEVICE_ID)throw new Error('هذا الحساب مربوط بجهاز ثاني. اتصل بالإنترنت واطلب من الأدمن يفك ربطه.');
  isAdmin=!!cached.isAdmin;
 }
 currentUser=user;
 localStorage.setItem('ha-accounting-active-user',user.id);
 const desired=userKey(user.id);
 if(window.HA_ACCOUNTING_KEY!==desired){location.reload();return;}
 showApp();
 const company=(()=>{try{return JSON.parse(localStorage.getItem(desired)||'{}').company?.name;}catch{return'';}})();
 if(company)document.getElementById('companyShort').textContent=company;
}
form.addEventListener('submit',async e=>{
 e.preventDefault();loginBtn.disabled=true;showMessage('جارٍ التحقق من الحساب…');
 try{
  const {data,error}=await client.auth.signInWithPassword({email:loginEmail(document.getElementById('loginId').value),password:document.getElementById('loginPassword').value});
  if(error)throw new Error('المعرّف أو كلمة المرور غير صحيحة.');
  await enter(data.user);if(document.querySelector('.layout').style.display==='none')showMessage('');
 }catch(err){await client.auth.signOut();localStorage.removeItem('ha-accounting-active-user');showMessage(err?.message||'تعذر تسجيل الدخول.');}
 finally{loginBtn.disabled=false;}
});
document.getElementById('logoutButton').addEventListener('click',async()=>{await client.auth.signOut();localStorage.removeItem('ha-accounting-active-user');location.reload();});
window.addEventListener('ha-accounting-save',()=>{
 if(!currentUser||!navigator.onLine)return;
 clearTimeout(syncTimer);syncTimer=setTimeout(async()=>{
  let data;try{data=JSON.parse(localStorage.getItem(userKey(currentUser.id))||'null');}catch{return;}
  if(!data)return;
  const {error}=await client.from('accounting_workspaces').upsert({user_id:currentUser.id,data,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error)console.error('HA cloud sync failed',error);
 },1000);
});
window.addEventListener('online',async()=>{
 if(!currentUser)return;
 try{await checkAccess(currentUser);await claimDevice(currentUser);const data=JSON.parse(localStorage.getItem(userKey(currentUser.id))||'null');if(data){const {error}=await client.from('accounting_workspaces').upsert({user_id:currentUser.id,data,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)console.error('HA cloud sync failed',error);}}
 catch(err){await client.auth.signOut();localStorage.removeItem('ha-accounting-active-user');hideApp();showMessage(err.message||'تم إيقاف الوصول لهذا الحساب.');}
});
document.getElementById('openAdmin').addEventListener('click',()=>{adminLayer.classList.add('open');adminLayer.setAttribute('aria-hidden','false');loadSubscribers();});
document.getElementById('closeAdmin').addEventListener('click',()=>{adminLayer.classList.remove('open');adminLayer.setAttribute('aria-hidden','true');});
async function adminCall(body){const {data,error}=await client.functions.invoke('manage-subscribers',{body});if(error)throw new Error(error.message||'تعذر الاتصال بدالة إدارة المشتركين.');if(data?.error)throw new Error(data.error);return data;}
document.getElementById('releaseAdminDevice').addEventListener('click',async()=>{if(!currentUser||!confirm('راح ينفصل حساب الأدمن من هذا الجهاز حتى تسجّل من جهاز ثاني. تكمل؟'))return;try{await adminCall({action:'reset-device',userId:currentUser.id});await client.auth.signOut();localStorage.removeItem('ha-accounting-active-user');location.reload();}catch(err){adminMsg(err.message);}});
async function loadSubscribers(){const box=document.getElementById('subscriberList');box.innerHTML='<p class="hint">جارٍ تحميل الحسابات…</p>';adminMsg('');try{const result=await adminCall({action:'list'});box.innerHTML=(result.users||[]).map(u=>`<div class="subscriber-row"><b>${escapeHtml(u.login_id)}</b><span class="subscriber-status ${u.active?'':'off'}">${u.active?'فعال':'موقوف'}</span><span>${u.expires_at?new Date(u.expires_at).toLocaleDateString('ar-IQ'):'بدون انتهاء'}</span><span>${u.device_label?`مرتبط بـ ${escapeHtml(u.device_label)}`:'غير مربوط بجهاز'}</span><button type="button" data-sub-user="${escapeHtml(u.user_id)}" data-sub-active="${!u.active}">${u.active?'إيقاف':'تفعيل'}</button><button type="button" data-reset-device="${escapeHtml(u.user_id)}">فك ربط الجهاز</button></div>`).join('')||'<p class="empty">ماكو حسابات مشتركين بعد.</p>';}catch(err){box.innerHTML='';adminMsg(`${err.message} تأكد من نشر Edge Function باسم manage-subscribers.`);}}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
document.getElementById('createSubscriber').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);adminMsg('جارٍ إنشاء الحساب…');try{const result=await adminCall({action:'create',loginId:d.get('loginId'),password:d.get('password'),expiresAt:d.get('expiresAt')||null});adminMsg(`تم إنشاء الحساب ${result.user.login_id}. أرسل له المعرّف وكلمة المرور الآن واحفظهما بمكان آمن.`,true);f.reset();await loadSubscribers();}catch(err){adminMsg(err.message);}});
document.getElementById('subscriberList').addEventListener('click',async e=>{const b=e.target.closest('[data-sub-user]');if(!b)return;try{await adminCall({action:'update',userId:b.dataset.subUser,active:b.dataset.subActive==='true'});await loadSubscribers();adminMsg('تم تحديث حالة الحساب.',true);}catch(err){adminMsg(err.message);}});
document.getElementById('subscriberList').addEventListener('click',async e=>{const b=e.target.closest('[data-reset-device]');if(!b)return;if(!confirm('فك ربط الجهاز لهذا الحساب؟ سيحتاج المستخدم تسجيل الدخول من جهازه الجديد.'))return;try{await adminCall({action:'reset-device',userId:b.dataset.resetDevice});adminMsg('تم فك ربط الجهاز. يمكن للحساب التسجيل من جهاز جديد.',true);}catch(err){adminMsg(err.message);}});
(async()=>{
 hideApp();
 const {data:{session}}=await client.auth.getSession();
 if(!session){localStorage.removeItem('ha-accounting-active-user');return;}
 try{await enter(session.user);}catch(err){await client.auth.signOut();localStorage.removeItem('ha-accounting-active-user');showMessage(err.message||'تعذر التحقق من الاشتراك.');}
})();
})();
