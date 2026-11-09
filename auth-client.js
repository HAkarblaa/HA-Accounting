(()=>{
'use strict';
const cfg=window.HA_SUPABASE_CONFIG||{};
const boot=document.getElementById('authBoot'),gate=document.getElementById('authGate'),form=document.getElementById('authForm'),msg=document.getElementById('authMessage'),loginBtn=document.getElementById('loginButton');
const adminLayer=document.getElementById('subscriberAdmin'),adminMessage=document.getElementById('adminMessage');
let client=null,currentUser=null,isAdmin=false,moduleType='full',syncTimer=0,workspaceChannel=null;
const selfWriteSnapshots=new Map();
function rememberSelfWrite(userId,data){const token={signature:stableJson(data)};selfWriteSnapshots.set(userId,token);setTimeout(()=>{if(selfWriteSnapshots.get(userId)===token)selfWriteSnapshots.delete(userId);},30000);}
const userKey=id=>'ha-accounting-v1:'+id;
const pendingKey=id=>'ha-accounting-pending-sync:'+id;
const revisionKey=id=>'ha-accounting-sync-revision:'+id;
const baseKey=id=>'ha-accounting-sync-base:'+id;
function watchWorkspace(user){
 if(!client||!user?.id)return;
 if(workspaceChannel)client.removeChannel(workspaceChannel);
 workspaceChannel=client.channel('ha-accounting-workspace-'+user.id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'accounting_workspaces',filter:`user_id=eq.${user.id}`},payload=>{
  const remote=payload.new?.data;if(!remote)return;
  const ownWrite=selfWriteSnapshots.get(user.id);
  if(ownWrite&&stableJson(remote)===ownWrite.signature){
   localStorage.setItem(baseKey(user.id),JSON.stringify(remote));
   if(payload.new?.updated_at)localStorage.setItem(revisionKey(user.id),payload.new.updated_at);
   return;
  }
  if(localStorage.getItem(pendingKey(user.id))==='1'){showMessage('توجد فواتير من هذا الجهاز بانتظار المزامنة. لن نستبدلها بتحديث الجهاز الآخر.');return;}
  let local=null;try{local=JSON.parse(localStorage.getItem(userKey(user.id))||'null');}catch{}
  if(JSON.stringify(local)===JSON.stringify(remote)){localStorage.setItem(baseKey(user.id),JSON.stringify(remote));if(payload.new?.updated_at)localStorage.setItem(revisionKey(user.id),payload.new.updated_at);return;}
  localStorage.setItem(userKey(user.id),JSON.stringify(remote));localStorage.setItem(baseKey(user.id),JSON.stringify(remote));if(payload.new?.updated_at)localStorage.setItem(revisionKey(user.id),payload.new.updated_at);
  if(window.HA_ACCOUNTING_MODULE_TYPE==='simple'&&typeof window.HA_APPLY_REMOTE_WORKSPACE==='function'){const applyWhenSafe=()=>{if(document.getElementById('modal')?.open){setTimeout(applyWhenSafe,700);return;}window.HA_APPLY_REMOTE_WORKSPACE(remote);};applyWhenSafe();return;}
  const reloadWhenSafe=()=>{if(document.getElementById('modal')?.open){setTimeout(reloadWhenSafe,700);return;}location.reload();};
  reloadWhenSafe();
 }).subscribe();
}
const showMessage=(text,ok=false)=>{msg.textContent=text;msg.classList.toggle('success',ok);};
const adminMsg=(text,ok=false)=>{adminMessage.textContent=text;adminMessage.classList.toggle('success',ok);};
const hideApp=()=>{document.querySelector('.layout').classList.remove('authenticated');gate.classList.remove('auth-pending');gate.style.display='grid';boot?.remove();};
const showApp=()=>{boot?.remove();gate.classList.remove('auth-pending');gate.style.display='none';document.querySelector('.layout').classList.add('authenticated');document.getElementById('openAdmin').classList.toggle('hidden',!isAdmin);document.getElementById('adminInterfacePreview')?.classList.toggle('hidden',!isAdmin);window.HA_ACCOUNTING_IS_ADMIN=isAdmin;window.HA_ACCOUNTING_MODULE_TYPE=isAdmin?'full':moduleType;window.HA_APPLY_MODULE_ACCESS?.(window.HA_ACCOUNTING_MODULE_TYPE,{entry:true});};
function loginEmail(raw){const id=String(raw||'').trim();return id.includes('@')?id:`${id.toLowerCase()}@ha-accounting.invalid`;}
function readCachedAccess(id){try{return JSON.parse(localStorage.getItem('ha-accounting-access:'+id)||'null');}catch{return null;}}
function isAccessDenied(err){return ['هذا الحساب غير مفعّل للاستخدام. راجع الأدمن.','الاشتراك موقوف حالياً. راجع الأدمن.','انتهت مدة الاشتراك. راجع الأدمن للتجديد.'].includes(String(err?.message||''));}
function setWorkspaceKey(id){const desired=userKey(id);localStorage.setItem('ha-accounting-active-user',id);window.HA_ACCOUNTING_IS_ADMIN=isAdmin;if(window.HA_ACCOUNTING_KEY!==desired){location.reload();return false;}return true;}
function startOfflineFromCache(){
 const id=localStorage.getItem('ha-accounting-active-user');
 const cached=id&&readCachedAccess(id);
 if(!id||!cached?.active)return false;
 currentUser={id};isAdmin=!!cached.isAdmin;moduleType=['restaurant','wholesale','market','engineering','processor','yemen','simple','service','personal','generator','full'].includes(cached.moduleType)?cached.moduleType:'full';window.HA_ACCOUNTING_IS_ADMIN=isAdmin;window.HA_ACCOUNTING_MODULE_TYPE=isAdmin?'full':moduleType;showApp();
 const company=(()=>{try{return JSON.parse(localStorage.getItem(userKey(id))||'{}').company?.name;}catch{return'';}})();
 if(company)document.getElementById('companyShort').textContent=company;
 document.getElementById('logoutButton').addEventListener('click',()=>{
  try{const projectRef=new URL(cfg.url).hostname.split('.')[0];localStorage.removeItem(cfg.auth?.storageKey||`sb-${projectRef}-auth-token`);}catch{}
  localStorage.removeItem('ha-accounting-active-user');location.reload();
 });
 window.addEventListener('online',()=>location.reload(),{once:true});
 return true;
}
window.addEventListener('ha-accounting-save',()=>{
 if(!currentUser)return;
 if(!navigator.onLine){localStorage.setItem(pendingKey(currentUser.id),'1');return;}
 if(!client)return;
 clearTimeout(syncTimer);syncTimer=setTimeout(async()=>{
  let data;try{data=JSON.parse(localStorage.getItem(userKey(currentUser.id))||'null');}catch{return;}
  if(!data)return;
  try{await pushLocalWorkspace(currentUser,data);}catch(error){console.error('HA cloud sync requires review',error);showMessage(error?.message||'المزامنة تنتظر مراجعة تعارض البيانات.');}
 },900);
});
if(!window.supabase?.createClient||!cfg.url||!cfg.publishableKey){
 if(!navigator.onLine&&startOfflineFromCache())return;
 hideApp();showMessage('لأول دخول أو مزامنة الحساب، اتصل بالإنترنت.');return;
}
client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.HA_AUTH_CLIENT=client;
const manualSyncButton=document.getElementById('manualSyncButton');
let syncToastTimer=0;
function showSyncToast(text,ok=false){let toast=document.getElementById('manualSyncToast');if(!toast){toast=document.createElement('div');toast.id='manualSyncToast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.style.cssText='position:fixed;z-index:2000;right:50%;bottom:22px;transform:translateX(50%);max-width:calc(100vw - 24px);padding:12px 16px;border-radius:12px;background:#173f5f;color:#fff;box-shadow:0 8px 28px #102a4340;font:600 13px Tahoma,Arial,sans-serif;text-align:center;';document.body.appendChild(toast);}toast.style.background=ok?'#087c69':'#173f5f';toast.textContent=text;toast.hidden=false;clearTimeout(syncToastTimer);syncToastTimer=setTimeout(()=>{toast.hidden=true;},4500);}
manualSyncButton?.addEventListener('click',async()=>{
 if(manualSyncButton.disabled)return;
 if(document.getElementById('modal')?.open){showSyncToast('احفظ الفاتورة أو أغلقها قبل تحديث البيانات.');return;}
 if(!navigator.onLine){showSyncToast('ماكو إنترنت حالياً. تبقى البيانات محفوظة بهذا الجهاز إلى أن يرجع الاتصال.');return;}
 if(!client||!currentUser){showSyncToast('تعذر تحديد الحساب. أعد تسجيل الدخول ثم حاول مرة ثانية.');return;}
 manualSyncButton.disabled=true;const oldText=manualSyncButton.textContent;manualSyncButton.textContent='جارٍ التحديث…';
 try{clearTimeout(syncTimer);let data;try{data=JSON.parse(localStorage.getItem(userKey(currentUser.id))||'null');}catch{}if(!data)throw new Error('ما لكيت بيانات هذا الحساب بهذا الجهاز.');await pushLocalWorkspace(currentUser,data);showSyncToast('تمت مزامنة البيانات وجلب آخر التغييرات.',true);setTimeout(()=>location.reload(),650);}
 catch(error){console.error('HA manual sync failed',error);showSyncToast(error?.message||'تعذّر تحديث البيانات. حاول عند استقرار الإنترنت.');manualSyncButton.disabled=false;manualSyncButton.textContent=oldText;}
});
async function checkAccess(user){
 const adminResult=await client.from('super_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 if(adminResult.error)throw new Error('تعذر التحقق من صلاحيات الحساب. تأكد من تشغيل ملفات SQL في Supabase.');
 if(adminResult.data){isAdmin=true;moduleType='full';return;}
 const subResult=await client.from('subscriptions').select('active,expires_at,module_type').eq('user_id',user.id).maybeSingle();
 if(subResult.error)throw new Error('تعذر التحقق من الاشتراك.');
 const sub=subResult.data;
 if(!sub)throw new Error('هذا الحساب غير مفعّل للاستخدام. راجع الأدمن.');
 if(!sub.active)throw new Error('الاشتراك موقوف حالياً. راجع الأدمن.');
 if(sub.expires_at&&new Date(sub.expires_at).getTime()<Date.now())throw new Error('انتهت مدة الاشتراك. راجع الأدمن للتجديد.');
 isAdmin=false;moduleType=['restaurant','wholesale','market','engineering','processor','yemen','simple','service','personal','generator','full'].includes(sub.module_type)?sub.module_type:'full';
}
function rememberAccess(user){localStorage.setItem('ha-accounting-access:'+user.id,JSON.stringify({isAdmin,moduleType:isAdmin?'full':moduleType,active:true,checkedAt:Date.now()}));}
function hasTransactions(data){return ['entries','documents','contacts','products','stockMovements','employees','payroll'].some(k=>Array.isArray(data?.[k])&&data[k].length>0)||['products','contacts','docs'].some(k=>Array.isArray(data?.processorData?.[k])&&data.processorData[k].length>0);}
function stableJson(value){return JSON.stringify(value??null,(key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.keys(item).sort().reduce((sorted,name)=>{sorted[name]=item[name];return sorted;},{}):item); }
function stockTouched(base,next){const before=new Map((base?.stockMovements||[]).map(x=>[x.id,stableJson(x)])),after=new Map((next?.stockMovements||[]).map(x=>[x.id,stableJson(x)])),products=new Set();for(const m of [...(base?.stockMovements||[]),...(next?.stockMovements||[])])if(before.get(m.id)!==after.get(m.id)&&m.productId)products.add(String(m.productId));const bp=new Map((base?.products||[]).map(x=>[x.id,stableJson(x)])),ap=new Map((next?.products||[]).map(x=>[x.id,stableJson(x)]));for(const p of [...(base?.products||[]),...(next?.products||[])])if(bp.get(p.id)!==ap.get(p.id))products.add(String(p.id));return products;}
function mergeWorkspaces(base,local,remote){
 const merged={...remote,...local},conflicts=new Set();
 const lm=stockTouched(base,local),rm=stockTouched(base,remote);for(const id of lm)if(rm.has(id))conflicts.add(id);
 for(const key of ['accounts','entries','documents','contacts','products','productCategories','stockMovements','employees','payroll','recurringExpenses','warehouses','cashierShifts']){
  const b=new Map((base?.[key]||[]).filter(x=>x?.id).map(x=>[String(x.id),x])),l=new Map((local?.[key]||[]).filter(x=>x?.id).map(x=>[String(x.id),x])),r=new Map((remote?.[key]||[]).filter(x=>x?.id).map(x=>[String(x.id),x])),ids=new Set([...b.keys(),...l.keys(),...r.keys()]),out=[];
  for(const id of ids){const bv=b.get(id),lv=l.get(id),rv=r.get(id),lc=stableJson(lv)!==stableJson(bv),rc=stableJson(rv)!==stableJson(bv);if(lc&&rc&&stableJson(lv)!==stableJson(rv)){conflicts.add(id);continue;}const selected=lc?lv:rc?rv:bv;if(selected)out.push(selected);}
  merged[key]=out;
 }
 return {data:merged,conflicts:[...conflicts]};
}
async function pushLocalWorkspace(user,data){
 const key=userKey(user.id),baseText=localStorage.getItem(baseKey(user.id)),base=(()=>{try{return JSON.parse(baseText||'null');}catch{return null;}})(),baseRevision=localStorage.getItem(revisionKey(user.id));
 const {data:remoteRow,error:readError}=await client.from('accounting_workspaces').select('data,updated_at').eq('user_id',user.id).maybeSingle();
 if(readError){localStorage.setItem(pendingKey(user.id),'1');throw new Error('تعذر فحص آخر نسخة قبل المزامنة. بقيت الفواتير محفوظة بهذا الجهاز وستتم إعادة المحاولة عند عودة الاتصال.');}
 let outgoing=data;
 if(remoteRow?.data){
  if(!baseRevision&&!base&&stableJson(data)!==stableJson(remoteRow.data)){localStorage.setItem(pendingKey(user.id),'1');window.dispatchEvent(new CustomEvent('ha-accounting-sync-conflict',{detail:{text:'لا توجد نسخة مقارنة لهذا الجهاز. التعديلات محفوظة محلياً ولم نستبدل نسخة السحابة.'}}));throw new Error('توجد نسخة سحابية سابقة ولا توجد نسخة مقارنة لهذا الجهاز. بقيت التعديلات محلياً حتى لا نستبدل بيانات الحساب.');}
  const changed=baseRevision&&remoteRow.updated_at?Date.parse(remoteRow.updated_at)!==Date.parse(baseRevision):stableJson(base)!==stableJson(remoteRow.data);
  if(changed){if(!base){localStorage.setItem(pendingKey(user.id),'1');window.dispatchEvent(new CustomEvent('ha-accounting-sync-conflict',{detail:{text:'تعارض بالمزامنة. بقيت الفواتير محفوظة على هذا الجهاز ولم نستبدل نسخة السحابة.'}}));throw new Error('تغيّر دفتر جهاز آخر قبل تجهيز نسخة المقارنة. احتفظنا بالتعديلات محلياً وأوقفنا الاستبدال حتى لا تضيع الفواتير.');}
   const result=mergeWorkspaces(base,data,remoteRow.data);
   if(result.conflicts.length){const names=result.conflicts.map(id=>(data.products||[]).find(p=>String(p.id)===id)?.name||(remoteRow.data.products||[]).find(p=>String(p.id)===id)?.name||'صنف '+id.slice(0,8));localStorage.setItem(pendingKey(user.id),'1');const warning='تعارض كمية أو تعديل متزامن: '+names.join('، ')+'. بقيت التعديلات بهذا الجهاز ولم نستبدل نسخة السحابة.';window.dispatchEvent(new CustomEvent('ha-accounting-sync-conflict',{detail:{text:warning}}));throw new Error(warning+' راجع الكميات في الجهازين قبل المتابعة.');}
   outgoing=result.data;
  }
 }else if(baseRevision){localStorage.setItem(pendingKey(user.id),'1');throw new Error('نسخة السحابة غير موجودة بعد مزامنة سابقة. بقيت البيانات محلياً ولم نرفعها فوق نسخة غير معروفة.');}
 outgoing.documents=(outgoing.documents||[]).map(d=>({...d,syncStatus:'synced'}));const revision=new Date().toISOString();rememberSelfWrite(user.id,outgoing);let writeError=null;
 if(remoteRow){const {data:written,error}=await client.from('accounting_workspaces').update({data:outgoing,updated_at:revision}).eq('user_id',user.id).eq('updated_at',remoteRow.updated_at).select('updated_at').maybeSingle();writeError=error;if(!error&&!written){localStorage.setItem(pendingKey(user.id),'1');const warning='تغيّر دفتر جهاز آخر أثناء المزامنة. بقيت تعديلات هذا الجهاز محفوظة ولم نستبدل آخر نسخة.';window.dispatchEvent(new CustomEvent('ha-accounting-sync-conflict',{detail:{text:warning}}));throw new Error(warning);}}
 else{const {error}=await client.from('accounting_workspaces').insert({user_id:user.id,data:outgoing,updated_at:revision});writeError=error;}
 if(writeError){localStorage.setItem(pendingKey(user.id),'1');throw new Error('تعذر مزامنة البيانات مع السحابة. بقيت الفواتير محفوظة بهذا الجهاز.');}
 localStorage.setItem(key,JSON.stringify(outgoing));localStorage.setItem(baseKey(user.id),JSON.stringify(outgoing));localStorage.setItem(revisionKey(user.id),revision);localStorage.removeItem(pendingKey(user.id));window.dispatchEvent(new Event('ha-accounting-synced'));
}
async function prepareWorkspace(user){
 const key=userKey(user.id),pending=localStorage.getItem(pendingKey(user.id))==='1';
 const {data,error}=await client.from('accounting_workspaces').select('data,updated_at').eq('user_id',user.id).maybeSingle();
 if(error)throw new Error('تعذر تحميل بيانات الحساب من السحابة.');
 if(data?.data&&!pending){localStorage.setItem(key,JSON.stringify(data.data));localStorage.setItem(baseKey(user.id),JSON.stringify(data.data));if(data.updated_at)localStorage.setItem(revisionKey(user.id),data.updated_at);return;}
 let initial=null;try{initial=JSON.parse(localStorage.getItem(key)||'null');}catch{}
 if(isAdmin&&initial&&!hasTransactions(initial))initial=null;
 if(!initial&&isAdmin){try{initial=JSON.parse(localStorage.getItem('ha-accounting-v1')||'null');}catch{}if(initial&&!hasTransactions(initial))initial=null;}
 if(pending&&initial){await pushLocalWorkspace(user,initial);return;}
 if(data?.data){localStorage.setItem(key,JSON.stringify(data.data));localStorage.setItem(baseKey(user.id),JSON.stringify(data.data));if(data.updated_at)localStorage.setItem(revisionKey(user.id),data.updated_at);return;}
 if(initial){localStorage.setItem(key,JSON.stringify(initial));await pushLocalWorkspace(user,initial);}
}
async function enter(user){
 const cached=readCachedAccess(user.id);
 if(navigator.onLine){
  try{await checkAccess(user);rememberAccess(user);}
  catch(err){if(!cached?.active||isAccessDenied(err))throw err;isAdmin=!!cached.isAdmin;}
  try{await prepareWorkspace(user);}
  catch(err){const local=localStorage.getItem(userKey(user.id));if(!readCachedAccess(user.id)?.active||!local)throw err;localStorage.setItem(pendingKey(user.id),'1');}
 }else{
  if(!cached?.active)throw new Error('أول تسجيل دخول لهذا الحساب يحتاج إنترنت. بعده يشتغل على هذا الجهاز أوفلاين.');
  isAdmin=!!cached.isAdmin;moduleType=['restaurant','wholesale','market','engineering','processor','yemen','simple','service','personal','generator','full'].includes(cached.moduleType)?cached.moduleType:'full';
 }
 currentUser=user;window.HA_ACCOUNTING_IS_ADMIN=isAdmin;window.HA_ACCOUNTING_MODULE_TYPE=isAdmin?'full':moduleType;
 if(!setWorkspaceKey(user.id))return;
 showApp();
 try{if(user?.id)watchWorkspace(user);}catch(syncError){console.warn('تعذر تشغيل المزامنة المباشرة',syncError);}
 const company=(()=>{try{return JSON.parse(localStorage.getItem(userKey(user.id))||'{}').company?.name;}catch{return'';}})();
 if(company)document.getElementById('companyShort').textContent=company;
}
form.addEventListener('submit',async e=>{
 e.preventDefault();loginBtn.disabled=true;showMessage('جارٍ التحقق من الحساب…');
 try{
  const {data,error}=await client.auth.signInWithPassword({email:loginEmail(document.getElementById('loginId').value),password:document.getElementById('loginPassword').value});
  if(error)throw new Error('المعرّف أو كلمة المرور غير صحيحة.');
  await enter(data.user);if(!document.querySelector('.layout').classList.contains('authenticated'))showMessage('');
 }catch(err){showMessage(err?.message||'تعذر التحقق من الحساب. إذا كان الحساب مسجلاً سابقاً، أعد المحاولة عند توفر الاتصال.');}
 finally{loginBtn.disabled=false;}
});
document.getElementById('logoutButton').addEventListener('click',async()=>{
 if(!navigator.onLine){try{const projectRef=new URL(cfg.url).hostname.split('.')[0];localStorage.removeItem(cfg.auth?.storageKey||`sb-${projectRef}-auth-token`);}catch{}}
 else await client.auth.signOut();
 localStorage.removeItem('ha-accounting-active-user');location.reload();
});
window.addEventListener('online',async()=>{
 if(!client||!currentUser)return;
 try{await checkAccess(currentUser);rememberAccess(currentUser);window.HA_ACCOUNTING_MODULE_TYPE=isAdmin?'full':moduleType;window.HA_APPLY_MODULE_ACCESS?.(window.HA_ACCOUNTING_MODULE_TYPE);const local=JSON.parse(localStorage.getItem(userKey(currentUser.id))||'null');if(local)await pushLocalWorkspace(currentUser,local);}
 catch(err){if(isAccessDenied(err)){hideApp();showMessage(err.message||'تم إيقاف الوصول لهذا الحساب.');return;}const cached=readCachedAccess(currentUser.id);if(cached?.active){isAdmin=!!cached.isAdmin;moduleType=['restaurant','wholesale','market','engineering','processor','yemen','simple','service','personal','generator','full'].includes(cached.moduleType)?cached.moduleType:'full';showApp();}showMessage('الاتصال بالخدمة غير مستقر؛ بقي الحساب مفتوحاً وستتم إعادة المزامنة عند عودة الاتصال.');}
});
const adminDeleteStyles=document.createElement('style');adminDeleteStyles.textContent='#subscriberAdmin .admin-card{width:min(1000px,100%)}#subscriberAdmin .subscriber-row{grid-template-columns:minmax(90px,1fr) auto minmax(80px,.8fr) minmax(120px,1fr) auto auto auto}#subscriberAdmin .subscriber-row [data-sub-delete]:hover{background:#ffdede}@media(max-width:700px){#subscriberAdmin .subscriber-row{grid-template-columns:1fr 1fr}#subscriberAdmin .subscriber-row button{grid-column:1/-1}}';document.head.appendChild(adminDeleteStyles);
document.getElementById('openAdmin').addEventListener('click',()=>{adminLayer.classList.add('open');adminLayer.setAttribute('aria-hidden','false');loadSubscribers();});
document.getElementById('closeAdmin').addEventListener('click',()=>{adminLayer.classList.remove('open');adminLayer.setAttribute('aria-hidden','true');});
async function adminCall(body){const {data,error}=await client.functions.invoke('manage-subscribers',{body});if(error)throw new Error(error.message||'تعذر الاتصال بدالة إدارة المشتركين.');if(data?.error)throw new Error(data.error);return data;}
const moduleOptions=(selected='full')=>[['restaurant','مطعم / مقهى'],['wholesale','جملة'],['market','أسواق / تجزئة'],['engineering','هندسة ومقاولات'],['processor','المعالجات'],['yemen','قسم ورشة صناعية'],['simple','واجهة بسيطة'],['service','مركز صيانة واستبدال'],['personal','حسابات شخصية'],['generator','مولدة كهرباء'],['full','نشاط آخر · كل الأقسام']].map(([value,label])=>`<option value="${value}" ${value===(selected||'full')?'selected':''}>${label}</option>`).join('');async function loadSubscribers(){const box=document.getElementById('subscriberList');box.innerHTML='<p class="hint">جارٍ تحميل الحسابات…</p>';adminMsg('');try{const result=await adminCall({action:'list'});box.innerHTML=(result.users||[]).map(u=>`<div class="subscriber-row"><b>${escapeHtml(u.login_id)}</b><span class="subscriber-status ${u.active?'':'off'}">${u.active?'فعال':'موقوف'}</span><span>${u.expires_at?new Date(u.expires_at).toLocaleDateString('ar-IQ'):'بدون انتهاء'}</span><select data-sub-module="${escapeHtml(u.user_id)}" aria-label="نوع نشاط ${escapeHtml(u.login_id)}">${moduleOptions(u.module_type)}</select><button type="button" data-sub-save-module="${escapeHtml(u.user_id)}">حفظ النشاط</button><button type="button" data-sub-user="${escapeHtml(u.user_id)}" data-sub-active="${!u.active}">${u.active?'إيقاف':'تفعيل'}</button><button type="button" data-sub-delete="${escapeHtml(u.user_id)}" data-sub-name="${escapeHtml(u.login_id)}" style="background:#ffeded;color:#a32626">حذف الحساب</button></div>`).join('')||'<p class="empty">ماكو حسابات مشتركين بعد.</p>';}catch(err){box.innerHTML='';adminMsg(`${err.message} تأكد من تشغيل تحديث قاعدة البيانات ونشر Edge Function باسم manage-subscribers.`);}}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const createSubscriberForm=document.getElementById('createSubscriber');const generatorFields=()=>{const show=createSubscriberForm.elements.moduleType.value==='generator';document.getElementById('generatorNameField')?.classList.toggle('hidden',!show);document.getElementById('generatorOwnerField')?.classList.toggle('hidden',!show);};createSubscriberForm.elements.moduleType.addEventListener('change',generatorFields);createSubscriberForm.addEventListener('reset',()=>setTimeout(generatorFields,0));generatorFields();createSubscriberForm.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);adminMsg('جارٍ إنشاء الحساب…');try{const result=await adminCall({action:'create',loginId:d.get('loginId'),password:d.get('password'),expiresAt:d.get('expiresAt')||null,moduleType:d.get('moduleType')||'full',generatorName:d.get('generatorName')||null,generatorOwner:d.get('generatorOwner')||null});adminMsg(`تم إنشاء الحساب ${result.user.login_id}. أرسل له المعرّف وكلمة المرور الآن واحفظهما بمكان آمن.`,true);f.reset();await loadSubscribers();}catch(err){adminMsg(err.message);}});
document.getElementById('subscriberList').addEventListener('click',async e=>{const del=e.target.closest('[data-sub-delete]');if(del){const name=del.dataset.subName||'هذا الحساب';if(!confirm(`حذف حساب «${name}» نهائياً؟ سيتم حذف تسجيل الدخول والاشتراك وبياناته السحابية، ولا يمكن التراجع.`))return;del.disabled=true;adminMsg(`جارٍ حذف حساب ${name}…`);try{const result=await adminCall({action:'delete',userId:del.dataset.subDelete});await loadSubscribers();adminMsg(result.warning||`تم حذف حساب ${name} نهائياً.`,true);}catch(err){adminMsg(err.message);del.disabled=false;}return;}const saveModule=e.target.closest('[data-sub-save-module]');if(saveModule){const userId=saveModule.dataset.subSaveModule,moduleType=document.querySelector(`[data-sub-module="${CSS.escape(userId)}"]`)?.value;saveModule.disabled=true;try{await adminCall({action:'update',userId,moduleType});await loadSubscribers();adminMsg('تم تحديث أقسام نشاط المشترك.',true);}catch(err){adminMsg(err.message);saveModule.disabled=false;}return;}const b=e.target.closest('[data-sub-user]');if(!b)return;try{await adminCall({action:'update',userId:b.dataset.subUser,active:b.dataset.subActive==='true'});await loadSubscribers();adminMsg('تم تحديث حالة الحساب.',true);}catch(err){adminMsg(err.message);}});
(async()=>{
 if(!navigator.onLine&&startOfflineFromCache())return;
 try{
  const {data:{session},error}=await client.auth.getSession();
  if(error)throw error;
  if(!session){localStorage.removeItem('ha-accounting-active-user');hideApp();if(!navigator.onLine)showMessage('أول تسجيل دخول لهذا الحساب يحتاج إنترنت.');return;}
  try{await enter(session.user);}catch(err){hideApp();showMessage(err.message||'تعذر التحقق من الاشتراك.');}
 }catch(err){hideApp();showMessage('تعذر استعادة جلسة الدخول. سجّل الدخول مرة ثانية عند توفر الاتصال.');}
})();
})();
