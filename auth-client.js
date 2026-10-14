(()=>{
'use strict';
const cfg=window.HA_SUPABASE_CONFIG||{};
const gate=document.getElementById('authGate'),form=document.getElementById('authForm'),msg=document.getElementById('authMessage'),loginBtn=document.getElementById('loginButton');
const adminLayer=document.getElementById('subscriberAdmin'),adminMessage=document.getElementById('adminMessage');
if(!window.supabase?.createClient||!cfg.url||!cfg.publishableKey){msg.textContent='إعداد الاتصال غير مكتمل. راجع ملف supabase-config.js.';return;}
const client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
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
 if(adminResult.data){isAdmin=true;localStorage.setItem('ha-accounting-access:'+user.id,JSON.stringify({isAdmin:true,active:true,checkedAt:Date.now()}));return;}
 const subResult=await client.from('subscriptions').select('active,expires_at').eq('user_id',user.id).maybeSingle();
 if(subResult.error)throw new Error('تعذر التحقق من الاشتراك.');
 const sub=subResult.data;
 if(!sub)throw new Error('هذا الحساب غير مفعّل للاستخدام. راجع الأدمن.');
 if(!sub.active)throw new Error('الاشتراك موقوف حالياً. راجع الأدمن.');
 if(sub.expires_at&&new Date(sub.expires_at).getTime()<Date.now())throw new Error('انتهت مدة الاشتراك. راجع الأدمن للتجديد.');
 isAdmin=false;
 localStorage.setItem('ha-accounting-access:'+user.id,JSON.stringify({isAdmin:false,active:true,expiresAt:sub.expires_at||null,checkedAt:Date.now()}));
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
 if(navigator.onLine){await checkAccess(user);await prepareWorkspace(user);}
 else{
  let cached=null;try{cached=JSON.parse(localStorage.getItem('ha-accounting-access:'+user.id)||'null');}catch{}
  if(!cached?.active)throw new Error('أول تسجيل دخول يحتاج إنترنت. اتصل بالإنترنت مرة واحدة وبعدها تگدر تشتغل أوفلاين.');
  if(cached.expiresAt&&new Date(cached.expiresAt).getTime()<Date.now())throw new Error('انتهت مدة الاشتراك المسجلة بهذا الجهاز. اتصل بالإنترنت وراجع الأدمن.');
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
 try{await checkAccess(currentUser);const data=JSON.parse(localStorage.getItem(userKey(currentUser.id))||'null');if(data){const {error}=await client.from('accounting_workspaces').upsert({user_id:currentUser.id,data,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)console.error('HA cloud sync failed',error);}}
 catch(err){await client.auth.signOut();localStorage.removeItem('ha-accounting-active-user');hideApp();showMessage(err.message||'تم إيقاف الوصول لهذا الحساب.');}
});
document.getElementById('openAdmin').addEventListener('click',()=>{adminLayer.classList.add('open');adminLayer.setAttribute('aria-hidden','false');loadSubscribers();});
document.getElementById('closeAdmin').addEventListener('click',()=>{adminLayer.classList.remove('open');adminLayer.setAttribute('aria-hidden','true');});
async function adminCall(body){const {data,error}=await client.functions.invoke('manage-subscribers',{body});if(error)throw new Error(error.message||'تعذر الاتصال بدالة إدارة المشتركين.');if(data?.error)throw new Error(data.error);return data;}
async function loadSubscribers(){const box=document.getElementById('subscriberList');box.innerHTML='<p class="hint">جارٍ تحميل الحسابات…</p>';adminMsg('');try{const result=await adminCall({action:'list'});box.innerHTML=(result.users||[]).map(u=>`<div class="subscriber-row"><b>${escapeHtml(u.login_id)}</b><span class="subscriber-status ${u.active?'':'off'}">${u.active?'فعال':'موقوف'}</span><span>${u.expires_at?new Date(u.expires_at).toLocaleDateString('ar-IQ'):'بدون انتهاء'}</span><button type="button" data-sub-user="${escapeHtml(u.user_id)}" data-sub-active="${!u.active}">${u.active?'إيقاف':'تفعيل'}</button></div>`).join('')||'<p class="empty">ماكو حسابات مشتركين بعد.</p>';}catch(err){box.innerHTML='';adminMsg(`${err.message} تأكد من نشر Edge Function باسم manage-subscribers.`);}}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
document.getElementById('createSubscriber').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);adminMsg('جارٍ إنشاء الحساب…');try{const result=await adminCall({action:'create',loginId:d.get('loginId'),password:d.get('password'),expiresAt:d.get('expiresAt')||null});adminMsg(`تم إنشاء الحساب ${result.user.login_id}. أرسل له المعرّف وكلمة المرور الآن واحفظهما بمكان آمن.`,true);f.reset();await loadSubscribers();}catch(err){adminMsg(err.message);}});
document.getElementById('subscriberList').addEventListener('click',async e=>{const b=e.target.closest('[data-sub-user]');if(!b)return;try{await adminCall({action:'update',userId:b.dataset.subUser,active:b.dataset.subActive==='true'});await loadSubscribers();adminMsg('تم تحديث حالة الحساب.',true);}catch(err){adminMsg(err.message);}});
(async()=>{
 hideApp();
 const {data:{session}}=await client.auth.getSession();
 if(!session){localStorage.removeItem('ha-accounting-active-user');return;}
 try{await enter(session.user);}catch(err){await client.auth.signOut();localStorage.removeItem('ha-accounting-active-user');showMessage(err.message||'تعذر التحقق من الاشتراك.');}
})();
})();
