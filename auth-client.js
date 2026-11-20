(()=>{
'use strict';
const cfg=window.HA_SUPABASE_CONFIG||{};
const boot=document.getElementById('authBoot'),gate=document.getElementById('authGate'),form=document.getElementById('authForm'),msg=document.getElementById('authMessage'),loginBtn=document.getElementById('loginButton');
const adminLayer=document.getElementById('subscriberAdmin'),adminMessage=document.getElementById('adminMessage');
let client=null,currentUser=null,isAdmin=false,moduleType='full',syncTimer=0,workspaceChannel=null,workspacePollTimer=0,logoutRequested=false,reconnectRunning=false,needsReconnect=false,displayedModuleType=null,staffContext=null;
const selfWriteSnapshots=new Map();
function rememberSelfWrite(userId,data){const token={signature:stableJson(data)};selfWriteSnapshots.set(userId,token);setTimeout(()=>{if(selfWriteSnapshots.get(userId)===token)selfWriteSnapshots.delete(userId);},30000);}
const userKey=id=>'ha-accounting-v1:'+id;
const pendingKey=id=>'ha-accounting-pending-sync:'+id;
const revisionKey=id=>'ha-accounting-sync-revision:'+id;
const baseKey=id=>'ha-accounting-sync-base:'+id;
function watchWorkspace(user){
 if(staffContext||window.HA_ADMIN_DEMO)return;
 if(!client||!user?.id)return;
 if(workspaceChannel)client.removeChannel(workspaceChannel);
 const receiveWorkspace=payload=>{
  const remote=payload?.new?.data,revision=payload?.new?.updated_at;
  if(!remote||typeof remote!=='object'||logoutRequested||currentUser?.id!==user.id)return;
  const knownRevision=localStorage.getItem(revisionKey(user.id));if(revision&&knownRevision&&Date.parse(revision)<=Date.parse(knownRevision))return;
  const applyWhenSafe=()=>{
   if(document.getElementById('modal')?.open){setTimeout(applyWhenSafe,500);return;}
   const ownWrite=selfWriteSnapshots.get(user.id);
   if(ownWrite&&stableJson(remote)===ownWrite.signature){
    if(localStorage.getItem(pendingKey(user.id))!=='1'){
     localStorage.setItem(baseKey(user.id),JSON.stringify(remote));
     if(revision)localStorage.setItem(revisionKey(user.id),revision);
    }
    return;
   }
   if(localStorage.getItem(pendingKey(user.id))==='1'){showMessage('توجد تغييرات محفوظة بهذا الجهاز بانتظار المزامنة؛ لن نستبدلها بنسخة الجهاز الآخر.');return;}
   let local=null,base=null;
   try{local=JSON.parse(localStorage.getItem(userKey(user.id))||'null');}catch{}
   try{base=JSON.parse(localStorage.getItem(baseKey(user.id))||'null');}catch{}
   const seen=localStorage.getItem(revisionKey(user.id));
   if(revision&&seen&&Date.parse(revision)<=Date.parse(seen))return;
   if(stableJson(local)===stableJson(remote)){
    localStorage.setItem(baseKey(user.id),JSON.stringify(remote));
    if(revision)localStorage.setItem(revisionKey(user.id),revision);
    return;
   }
   const localDirty=!!local&&stableJson(local)!==stableJson(base||remote);
   if(localDirty){
    const result=mergeWorkspaces(base||{},local,remote);
    if(result.conflicts.length){
     localStorage.setItem(pendingKey(user.id),'1');
     const warning='وجدنا تعديلات متزامنة على نفس البيانات. احتفظنا بتغييرات هذا الجهاز ولم نستبدلها.';
     window.dispatchEvent(new CustomEvent('ha-accounting-sync-conflict',{detail:{text:warning}}));
     showMessage(warning);
     return;
    }
    localStorage.setItem(userKey(user.id),JSON.stringify(result.data));
    localStorage.setItem(baseKey(user.id),JSON.stringify(remote));
    if(revision)localStorage.setItem(revisionKey(user.id),revision);
    localStorage.setItem(pendingKey(user.id),'1');
    window.HA_APPLY_REMOTE_WORKSPACE?.(result.data);
    window.dispatchEvent(new Event('ha-accounting-save'));
    return;
   }
   localStorage.setItem(userKey(user.id),JSON.stringify(remote));
   localStorage.setItem(baseKey(user.id),JSON.stringify(remote));
   if(revision)localStorage.setItem(revisionKey(user.id),revision);
   window.HA_APPLY_REMOTE_WORKSPACE?.(remote);
  };
  applyWhenSafe();
 };
 workspaceChannel=client.channel('ha-accounting-workspace-'+user.id)
  .on('postgres_changes',{event:'*',schema:'public',table:'accounting_workspaces',filter:`user_id=eq.${user.id}`},receiveWorkspace)
  .subscribe(status=>{
   const ready=status==='SUBSCRIBED';
   if(!ready&&(status==='CHANNEL_ERROR'||status==='TIMED_OUT'))console.warn('HA workspace realtime unavailable; using periodic refresh.');
  });
 if(workspacePollTimer)clearInterval(workspacePollTimer);
 let polling=false;
 workspacePollTimer=setInterval(async()=>{
  if(polling||!currentUser||currentUser.id!==user.id||!navigator.onLine||document.visibilityState==='hidden'||localStorage.getItem(pendingKey(user.id))==='1')return;
  polling=true;
  try{await withSyncDeadline(async signal=>{
   const {data:metadata,error:metadataError}=await syncQuery(client.from('accounting_workspaces').select('updated_at').eq('user_id',user.id).maybeSingle(),signal);
   if(metadataError)throw metadataError;
   if(!metadata?.updated_at||logoutRequested||currentUser?.id!==user.id)return;
   const known=localStorage.getItem(revisionKey(user.id));
   if(known&&Date.parse(metadata.updated_at)<=Date.parse(known))return;
   if(localStorage.getItem(pendingKey(user.id))==='1')return;
   const {data,error}=await syncQuery(client.from('accounting_workspaces').select('data,updated_at').eq('user_id',user.id).maybeSingle(),signal);
   if(error)throw error;if(data?.data)receiveWorkspace({new:data});
  });}catch(error){console.warn('HA workspace refresh failed',error);}finally{polling=false;}
 },45000);
}
const showMessage=(text,ok=false)=>{msg.textContent=text;msg.classList.toggle('success',ok);};
const adminMsg=(text,ok=false)=>{adminMessage.textContent=text;adminMessage.classList.toggle('success',ok);};
const hideApp=()=>{document.querySelector('.layout').classList.remove('authenticated');gate.classList.remove('auth-pending');gate.style.display='grid';boot?.remove();};
const showApp=()=>{if(staffContext){boot?.remove();gate.style.display='none';document.querySelector('.layout').classList.add('authenticated');window.HAStaff?.mount(staffContext);return;}window.HAStaff?.unmount();const layout=document.querySelector('.layout'),wasOpen=layout.classList.contains('authenticated');boot?.remove();gate.classList.remove('auth-pending');gate.style.display='none';layout.classList.add('authenticated');document.getElementById('openAdmin').classList.toggle('hidden',!isAdmin||window.HA_ADMIN_DEMO);document.getElementById('adminInterfacePreview')?.classList.toggle('hidden',!isAdmin);window.HA_ACCOUNTING_IS_ADMIN=isAdmin;window.HA_ACCOUNTING_MODULE_TYPE=isAdmin?'full':moduleType;if(!wasOpen||displayedModuleType!==window.HA_ACCOUNTING_MODULE_TYPE){displayedModuleType=window.HA_ACCOUNTING_MODULE_TYPE;window.HA_APPLY_MODULE_ACCESS?.(displayedModuleType,{entry:!wasOpen});}adminDemoControls();window.dispatchEvent(new Event('ha-accounting-auth-ready'));};
function adminDemoControls(){
 let button=document.getElementById('adminDemoButton'),reset=document.getElementById('adminDemoReset');const beside=document.getElementById('adminInterfacePreview');if(!beside)return;
 if(!button){button=document.createElement('button');button.id='adminDemoButton';button.type='button';button.className='btn secondary small';beside.insertAdjacentElement('afterend',button);button.onclick=()=>{if(!isAdmin)return;const url=new URL(location.href);if(window.HA_ADMIN_DEMO)url.searchParams.delete('ha_admin_demo');else url.searchParams.set('ha_admin_demo','1');url.searchParams.set('page','dashboard');location.assign(url.href);};}
 button.classList.toggle('hidden',!isAdmin);button.textContent=window.HA_ADMIN_DEMO?'الرجوع لبياناتي الفعلية':'بيانات تجريبية للأدمن';
 if(!reset){reset=document.createElement('button');reset.id='adminDemoReset';reset.type='button';reset.className='btn secondary small';reset.textContent='إعادة البيانات التجريبية';button.insertAdjacentElement('afterend',reset);reset.onclick=()=>{if(isAdmin&&window.HA_ADMIN_DEMO)window.HA_RESET_ADMIN_DEMO?.();};}reset.classList.toggle('hidden',!isAdmin||!window.HA_ADMIN_DEMO);
}
function loginEmail(raw){const id=String(raw||'').trim();return id.includes('@')?id:`${id.toLowerCase()}@ha-accounting.invalid`;}
function readCachedAccess(id){try{return JSON.parse(localStorage.getItem('ha-accounting-access:'+id)||'null');}catch{return null;}}
function isAccessDenied(err){return ['هذا الحساب غير مفعّل للاستخدام. راجع الأدمن.','الاشتراك موقوف حالياً. راجع الأدمن.','انتهت مدة الاشتراك. راجع الأدمن للتجديد.'].includes(String(err?.message||''));}
function setWorkspaceKey(id){const demo=isAdmin&&new URL(location.href).searchParams.get('ha_admin_demo')==='1';window.HA_ADMIN_DEMO=demo;const desired=userKey(id)+(demo?':admin-demo-v1':'');localStorage.setItem('ha-accounting-active-user',id);window.HA_ACCOUNTING_IS_ADMIN=isAdmin;if(window.HA_ACCOUNTING_KEY!==desired){location.reload();return false;}return true;}
function applyCachedAccess(cached){staffContext=cached.staffContext||null;isAdmin=!!cached.isAdmin;moduleType=['restaurant','wholesale','market','engineering','processor','yemen','simple','service','personal','generator','full'].includes(cached.moduleType)?cached.moduleType:'full';}
window.HA_DENY_STAFF_ACCESS=()=>denyCachedAccess(currentUser,new Error('هذا الحساب غير مفعّل للاستخدام. راجع الأدمن.'));
function denyCachedAccess(user,err){if(user?.id){const cached=readCachedAccess(user.id)||{};localStorage.setItem('ha-accounting-access:'+user.id,JSON.stringify({...cached,active:false}));}currentUser=null;isAdmin=false;hideApp();window.HAStaff?.deny();showMessage(err?.message||'تم إيقاف الوصول لهذا الحساب.');}
function startOfflineFromCache(){
 if(logoutRequested)return false;
 const id=localStorage.getItem('ha-accounting-active-user'),cached=id&&readCachedAccess(id);let local=null;try{local=id&&JSON.parse(localStorage.getItem(userKey(id)+(window.HA_ADMIN_DEMO?':admin-demo-v1':''))||'null');}catch{}
 if(!id||!cached?.active||!local||typeof local!=='object'||Array.isArray(local))return false;
 currentUser={id};applyCachedAccess(cached);needsReconnect=true;
 if(!setWorkspaceKey(id))return true;
 showApp();if(local.company?.name)document.getElementById('companyShort').textContent=local.company.name;
 return true;
}
function applySyncedWorkspace(user,before){
 if(window.HA_ADMIN_DEMO)return;
 if(logoutRequested||currentUser?.id!==user.id)return;
 if(document.getElementById('modal')?.open){setTimeout(()=>applySyncedWorkspace(user,before),500);return;}
 if(localStorage.getItem(pendingKey(user.id))==='1')return;
 let latest=null;try{latest=JSON.parse(localStorage.getItem(userKey(user.id))||'null');}catch{}
 if(latest&&stableJson(latest)!==before)window.HA_APPLY_REMOTE_WORKSPACE?.(latest);
}
document.getElementById('logoutButton').addEventListener('click',async()=>{
 logoutRequested=true;currentUser=null;clearTimeout(syncTimer);clearInterval(workspacePollTimer);
 localStorage.removeItem('ha-accounting-active-user');
 try{const projectRef=new URL(cfg.url).hostname.split('.')[0];localStorage.removeItem(cfg.auth?.storageKey||`sb-${projectRef}-auth-token`);}catch{}
 try{if(client)await Promise.race([client.auth.signOut({scope:'local'}),new Promise(resolve=>setTimeout(resolve,1200))]);}catch{}finally{location.reload();}
});
window.addEventListener('offline',()=>{needsReconnect=true;});
window.addEventListener('ha-accounting-save',()=>{
 if(!currentUser||staffContext||window.HA_ADMIN_DEMO)return;
 localStorage.setItem(pendingKey(currentUser.id),'1');
 if(!navigator.onLine)return;
 if(!client)return;
 clearTimeout(syncTimer);syncTimer=setTimeout(async()=>{
  let data;try{data=JSON.parse(localStorage.getItem(userKey(currentUser.id))||'null');}catch{return;}
  if(!data)return;
  try{const user=currentUser,before=stableJson(data);await pushLocalWorkspace(user,data);applySyncedWorkspace(user,before);}catch(error){needsReconnect=true;console.error('HA cloud sync requires review',error);showMessage(error?.message||'المزامنة تنتظر مراجعة تعارض البيانات.');}
 },900);
});
if(!window.supabase?.createClient||!cfg.url||!cfg.publishableKey){
 if(startOfflineFromCache())return;
 hideApp();showMessage('لأول دخول أو مزامنة الحساب، اتصل بالإنترنت.');return;
}
client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.HA_AUTH_CLIENT=client;
const manualSyncButton=document.getElementById('manualSyncButton');
let syncToastTimer=0;
function showSyncToast(text,ok=false){let toast=document.getElementById('manualSyncToast');if(!toast){toast=document.createElement('div');toast.id='manualSyncToast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.style.cssText='position:fixed;z-index:2000;right:50%;bottom:22px;transform:translateX(50%);max-width:calc(100vw - 24px);padding:12px 16px;border-radius:12px;background:#173f5f;color:#fff;box-shadow:0 8px 28px #102a4340;font:600 13px Tahoma,Arial,sans-serif;text-align:center;';document.body.appendChild(toast);}const activeModal=document.getElementById('modal'),host=activeModal?.open?document.getElementById('modalBody'):document.body;if(toast.parentNode!==host)host.appendChild(toast);toast.style.position=activeModal?.open?'relative':'fixed';toast.style.transform=activeModal?.open?'none':'translateX(50%)';toast.style.right=activeModal?.open?'auto':'50%';toast.style.bottom=activeModal?.open?'auto':'22px';toast.style.background=ok?'#087c69':'#173f5f';toast.textContent=text;toast.hidden=false;clearTimeout(syncToastTimer);syncToastTimer=setTimeout(()=>{toast.hidden=true;},4500);}
function syncQuery(query,signal){return signal?query.abortSignal(signal):query;}
async function withSyncDeadline(task,ms=20000){const controller=new AbortController();let timer;try{return await Promise.race([task(controller.signal),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('انتهت مهلة التحديث؛ بياناتك محفوظة. حاول مجدداً عند استقرار الاتصال.'));},ms);})]);}finally{clearTimeout(timer);}}
async function performManualSync(user,signal,allowReadOnlyModal=false){
 if(staffContext){await window.HAStaff.refresh();return;}
 const {data,error}=await client.auth.getSession();if(signal.aborted)throw new Error('تم إيقاف محاولة التحديث.');if(error)throw error;
 if(!data?.session||data.session.user.id!==user.id)throw new Error('تعذر تجديد الاتصال بالحساب. بقيت بياناتك محفوظة؛ حاول مجدداً عند استقرار الاتصال.');
 const before=localStorage.getItem(userKey(user.id));await prepareWorkspace(user,{signal});if(signal.aborted||logoutRequested||currentUser?.id!==user.id)return;
 if(allowReadOnlyModal&&document.getElementById('modal')?.open&&!document.getElementById('modalBody').querySelector('form')){const latest=JSON.parse(localStorage.getItem(userKey(user.id))||'null');if(latest)window.HA_APPLY_REMOTE_WORKSPACE?.(latest);}else applySyncedWorkspace(user,(()=>{try{return stableJson(JSON.parse(before||'null'));}catch{return 'null';}})());
}
async function manualRefreshAccounting({allowReadOnlyModal=false}={}){
 if(window.HA_ADMIN_DEMO){showSyncToast('مساحة تجريبية محلية؛ لا تُزامن مع بيانات الحساب.',true);return true;}
 if(manualSyncButton.disabled)return;
 if(document.getElementById('modal')?.open&&(!allowReadOnlyModal||document.getElementById('modalBody').querySelector('form'))){showSyncToast('احفظ الفاتورة أو أغلقها قبل تحديث البيانات.');return;}
 if(!navigator.onLine){showSyncToast('ماكو إنترنت حالياً. بياناتك محفوظة بهذا الجهاز وتنتظر المزامنة.');return;}
 if(!client||!currentUser){showSyncToast('تعذر تحديد جلسة الحساب. حدّث الصفحة عند توفر الاتصال.');return;}
 const user=currentUser;manualSyncButton.disabled=true;const oldText=manualSyncButton.textContent;manualSyncButton.textContent='جارٍ التحديث…';
 try{clearTimeout(syncTimer);await withSyncDeadline(signal=>performManualSync(user,signal,allowReadOnlyModal));needsReconnect=localStorage.getItem(pendingKey(user.id))==='1';showSyncToast('تم تحديث البيانات ومزامنة التعديلات.',true);return true;}
 catch(error){needsReconnect=true;console.error('HA manual sync failed',error);showSyncToast(error?.message||'تعذّر التحديث؛ بياناتك محفوظة. حاول مجدداً.');return false;}
 finally{manualSyncButton.disabled=false;manualSyncButton.textContent=oldText;}
}
window.HA_MANUAL_REFRESH=manualRefreshAccounting;manualSyncButton?.addEventListener('click',manualRefreshAccounting);
async function checkAccess(user){
 staffContext=null;
 const adminResult=await client.from('super_admins').select('user_id').eq('user_id',user.id).maybeSingle();
 if(adminResult.error)throw new Error('تعذر التحقق من صلاحيات الحساب. تأكد من تشغيل ملفات SQL في Supabase.');
 if(adminResult.data){isAdmin=true;moduleType='full';return;}
 const subResult=await client.from('subscriptions').select('active,expires_at,module_type').eq('user_id',user.id).maybeSingle();
 if(subResult.error)throw new Error('تعذر التحقق من الاشتراك.');
 const sub=subResult.data;
 if(!sub){const result=await client.functions.invoke('accounting-staff',{body:{action:'context'}});let detail=result.data;if(result.error){try{detail=await result.error.context?.json();}catch{}}if(detail?.error==='staff_access_denied')throw new Error('هذا الحساب غير مفعّل للاستخدام. راجع الأدمن.');if(result.error)throw new Error('تعذر الاتصال للتحقق من حساب الموظف. تبقى النسخة المحلية متاحة للحساب المسجل سابقاً.');if(detail?.role!=='staff')throw new Error('هذا الحساب غير مفعّل للاستخدام. راجع الأدمن.');staffContext={...detail,userId:user.id};isAdmin=false;moduleType=staffContext.moduleType;return;}
 if(!sub.active)throw new Error('الاشتراك موقوف حالياً. راجع الأدمن.');
 if(sub.expires_at&&new Date(sub.expires_at).getTime()<Date.now())throw new Error('انتهت مدة الاشتراك. راجع الأدمن للتجديد.');
 isAdmin=false;moduleType=['restaurant','wholesale','market','engineering','processor','yemen','simple','service','personal','generator','full'].includes(sub.module_type)?sub.module_type:'full';
}
function rememberAccess(user){localStorage.setItem('ha-accounting-access:'+user.id,JSON.stringify({isAdmin,staffContext,moduleType:isAdmin?'full':moduleType,active:true,checkedAt:Date.now()}));}
function hasTransactions(data){return ['entries','documents','contacts','products','stockMovements','employees','payroll','personalAppointments'].some(k=>Array.isArray(data?.[k])&&data[k].length>0)||['products','contacts','docs','returns'].some(k=>Array.isArray(data?.processorData?.[k])&&data.processorData[k].length>0)||['partners','transactions','plans','distributions'].some(k=>Array.isArray(data?.processorData?.partnership?.[k])&&data.processorData.partnership[k].length>0)||['engineeringTransactions','engineeringMaterials','engineeringProjects','engineeringQuotes','engineeringWriteoffs'].some(k=>Array.isArray(data?.[k])&&data[k].length>0)||!!data?.engineeringPartnerData?.book?.partners?.length;}
function stableJson(value){return JSON.stringify(value??null,(key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.keys(item).sort().reduce((sorted,name)=>{sorted[name]=item[name];return sorted;},{}):item); }
function stockTouched(base,next){const before=new Map((base?.stockMovements||[]).map(x=>[x.id,stableJson(x)])),after=new Map((next?.stockMovements||[]).map(x=>[x.id,stableJson(x)])),products=new Set();for(const m of [...(base?.stockMovements||[]),...(next?.stockMovements||[])])if(before.get(m.id)!==after.get(m.id)&&m.productId)products.add(String(m.productId));const bp=new Map((base?.products||[]).map(x=>[x.id,stableJson(x)])),ap=new Map((next?.products||[]).map(x=>[x.id,stableJson(x)]));for(const p of [...(base?.products||[]),...(next?.products||[])])if(bp.get(p.id)!==ap.get(p.id))products.add(String(p.id));return products;}
function mergeWorkspaces(base,local,remote){
 const merged={...remote,...local},conflicts=new Set();
 // Keep remote dashboard preferences when this device did not edit its layout.
 merged.processorDashboardLayout=stableJson(local?.processorDashboardLayout)!==stableJson(base?.processorDashboardLayout)?local?.processorDashboardLayout:remote?.processorDashboardLayout;
 const processorBundle=x=>({data:x?.processorData||null,expenses:x?.simpleExpenses||[],vouchers:(x?.entries||[]).filter(e=>e.processorVoucher||e.processorPartnerId||e.source==='simple-expense')}),pb=stableJson(processorBundle(base)),pl=stableJson(processorBundle(local)),pr=stableJson(processorBundle(remote));if(pl!==pb&&pr!==pb&&pl!==pr)conflicts.add('processor-workspace');merged.processorData=pl!==pb?local?.processorData:remote?.processorData;merged.simpleExpenses=pl!==pb?local?.simpleExpenses:remote?.simpleExpenses;
 const engKeys=['engineeringProjects','engineeringMaterials','engineeringTransactions','engineeringPayees','engineeringRepresentatives','engineeringMaterialCategories','engineeringStocktakes','engineeringQuotes','engineeringWriteoffs','engineeringPartnerData','engineeringDashboardLayout','engineeringDeletedRecords'],engBundle=x=>Object.fromEntries(engKeys.map(k=>[k,x?.[k]??null])),eb=stableJson(engBundle(base)),el=stableJson(engBundle(local)),er=stableJson(engBundle(remote));if(el!==eb&&er!==eb&&el!==er)conflicts.add('engineering-workspace');for(const k of engKeys)merged[k]=el!==eb?local?.[k]:remote?.[k];
 // Return records, stock and settlement allocations commit as one workspace operation.
 const sharedBundle=x=>({returns:x?.sharedReturnsRecords||[],groups:x?.sharedReturnGroups||[],entries:(x?.entries||[]).filter(e=>!e.processorVoucher),documents:x?.documents||[],products:x?.products||[],stock:x?.stockMovements||[],contacts:x?.contacts||[],engineering:x?.engineeringTransactions||[],materials:x?.engineeringMaterials||[],workshop:x?.yemen||null}),sharedChanged=x=>stableJson(x?.sharedReturnsRecords||[])!==stableJson(base?.sharedReturnsRecords||[]),sb=stableJson(sharedBundle(base)),sl=stableJson(sharedBundle(local)),sr=stableJson(sharedBundle(remote));if((sharedChanged(local)||sharedChanged(remote))&&sl!==sb&&sr!==sb&&sl!==sr)conflicts.add('shared-returns-workspace');
 const yb=stableJson(base?.yemen),yl=stableJson(local?.yemen),yr=stableJson(remote?.yemen);if(yl!==yb&&yr!==yb&&yl!==yr)conflicts.add('workshop-workspace');merged.yemen=yl!==yb?local?.yemen:remote?.yemen;
 const lm=stockTouched(base,local),rm=stockTouched(base,remote);for(const id of lm)if(rm.has(id))conflicts.add(id);
 for(const key of ['accounts','entries','documents','contacts','products','productCategories','stockMovements','employees','payroll','recurringExpenses','warehouses','cashierShifts','personalAppointments','sharedReturnsRecords','sharedReturnGroups','engineeringProjects','engineeringMaterials','engineeringTransactions','engineeringPayees','engineeringMaterialCategories']){
  const b=new Map((base?.[key]||[]).filter(x=>x?.id).map(x=>[String(x.id),x])),l=new Map((local?.[key]||[]).filter(x=>x?.id).map(x=>[String(x.id),x])),r=new Map((remote?.[key]||[]).filter(x=>x?.id).map(x=>[String(x.id),x])),ids=new Set([...b.keys(),...l.keys(),...r.keys()]),out=[];
  for(const id of ids){const bv=b.get(id),lv=l.get(id),rv=r.get(id),lc=stableJson(lv)!==stableJson(bv),rc=stableJson(rv)!==stableJson(bv);if(lc&&rc&&stableJson(lv)!==stableJson(rv)){conflicts.add(id);continue;}const selected=lc?lv:rc?rv:bv;if(selected)out.push(selected);}
  merged[key]=out;
 }
 return {data:merged,conflicts:[...conflicts]};
}
async function pushLocalWorkspace(user,data,{signal}={}){
 if(window.HA_ADMIN_DEMO||data?.adminDemoSandbox)throw new Error('بيانات التجربة منفصلة ولا تُرفع إلى دفتر الحساب الحقيقي.');
 if(signal?.aborted)throw new Error('تم إيقاف محاولة التحديث.');
 const inputSignature=stableJson(data);
 const key=userKey(user.id),baseText=localStorage.getItem(baseKey(user.id)),base=(()=>{try{return JSON.parse(baseText||'null');}catch{return null;}})(),baseRevision=localStorage.getItem(revisionKey(user.id));
 const {data:remoteRow,error:readError}=await syncQuery(client.from('accounting_workspaces').select('data,updated_at').eq('user_id',user.id).maybeSingle(),signal);
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
 if(remoteRow){const {data:written,error}=await syncQuery(client.from('accounting_workspaces').update({data:outgoing,updated_at:revision}).eq('user_id',user.id).eq('updated_at',remoteRow.updated_at).select('updated_at').maybeSingle(),signal);writeError=error;if(!error&&!written){localStorage.setItem(pendingKey(user.id),'1');const warning='تغيّر دفتر جهاز آخر أثناء المزامنة. بقيت تعديلات هذا الجهاز محفوظة ولم نستبدل آخر نسخة.';window.dispatchEvent(new CustomEvent('ha-accounting-sync-conflict',{detail:{text:warning}}));throw new Error(warning);}}
 else{const {error}=await syncQuery(client.from('accounting_workspaces').insert({user_id:user.id,data:outgoing,updated_at:revision}),signal);writeError=error;}
 if(writeError){localStorage.setItem(pendingKey(user.id),'1');throw new Error('تعذر مزامنة البيانات مع السحابة. بقيت الفواتير محفوظة بهذا الجهاز.');}
 let currentLocal=null;try{currentLocal=JSON.parse(localStorage.getItem(key)||'null');}catch{}const newerLocal=stableJson(currentLocal)!==inputSignature;
 if(newerLocal){if(!base){localStorage.setItem(baseKey(user.id),inputSignature);if(remoteRow?.updated_at)localStorage.setItem(revisionKey(user.id),remoteRow.updated_at);}localStorage.setItem(pendingKey(user.id),'1');needsReconnect=true;}else{localStorage.setItem(key,JSON.stringify(outgoing));localStorage.setItem(baseKey(user.id),JSON.stringify(outgoing));localStorage.setItem(revisionKey(user.id),revision);localStorage.removeItem(pendingKey(user.id));window.dispatchEvent(new Event('ha-accounting-synced'));}
}
async function prepareWorkspace(user,{signal}={}){
 if(window.HA_ADMIN_DEMO)return;
 if(signal?.aborted)throw new Error('تم إيقاف محاولة التحديث.');
 const key=userKey(user.id);
 const {data,error}=await syncQuery(client.from('accounting_workspaces').select('data,updated_at').eq('user_id',user.id).maybeSingle(),signal);
 if(signal?.aborted)throw new Error('تم إيقاف محاولة التحديث.');
 if(error)throw new Error('تعذر تحميل بيانات الحساب من السحابة.');
 const pending=localStorage.getItem(pendingKey(user.id))==='1';
 if(data?.data&&!pending){localStorage.setItem(key,JSON.stringify(data.data));localStorage.setItem(baseKey(user.id),JSON.stringify(data.data));if(data.updated_at)localStorage.setItem(revisionKey(user.id),data.updated_at);return;}
 let initial=null;try{initial=JSON.parse(localStorage.getItem(key)||'null');}catch{}
 if(isAdmin&&initial&&!hasTransactions(initial))initial=null;
 if(!initial&&isAdmin){try{initial=JSON.parse(localStorage.getItem('ha-accounting-v1')||'null');}catch{}if(initial&&!hasTransactions(initial))initial=null;}
 if(pending&&initial){await pushLocalWorkspace(user,initial,{signal});return;}
 if(data?.data){localStorage.setItem(key,JSON.stringify(data.data));localStorage.setItem(baseKey(user.id),JSON.stringify(data.data));if(data.updated_at)localStorage.setItem(revisionKey(user.id),data.updated_at);return;}
 if(initial){localStorage.setItem(key,JSON.stringify(initial));await pushLocalWorkspace(user,initial,{signal});}
}
async function enter(user){
 if(logoutRequested)return;const before=localStorage.getItem(userKey(user.id));
 const cached=readCachedAccess(user.id);
 if(navigator.onLine){
  try{await checkAccess(user);rememberAccess(user);}
  catch(err){if(!cached?.active||isAccessDenied(err))throw err;applyCachedAccess(cached);needsReconnect=true;}
  try{if(!staffContext)await withSyncDeadline(signal=>prepareWorkspace(user,{signal}));}
  catch(err){const local=localStorage.getItem(userKey(user.id));if(!readCachedAccess(user.id)?.active||!local)throw err;localStorage.setItem(pendingKey(user.id),'1');}
 }else{
  if(!cached?.active)throw new Error('أول تسجيل دخول لهذا الحساب يحتاج إنترنت. بعده يشتغل على هذا الجهاز أوفلاين.');
  staffContext=cached.staffContext||null;isAdmin=!!cached.isAdmin;moduleType=['restaurant','wholesale','market','engineering','processor','yemen','simple','service','personal','generator','full'].includes(cached.moduleType)?cached.moduleType:'full';
 }
 if(logoutRequested)return;currentUser=user;window.HA_ACCOUNTING_IS_ADMIN=isAdmin;window.HA_ACCOUNTING_MODULE_TYPE=isAdmin?'full':moduleType;
 if(!setWorkspaceKey(user.id))return;
 showApp();if(staffContext){await window.HAStaff.refresh().catch(error=>showMessage(error.message));return;}applySyncedWorkspace(user,(()=>{try{return stableJson(JSON.parse(before||'null'));}catch{return 'null';}})());
 try{if(user?.id)watchWorkspace(user);}catch(syncError){console.warn('تعذر تشغيل المزامنة المباشرة',syncError);}
 const company=(()=>{try{return JSON.parse(localStorage.getItem(window.HA_ADMIN_DEMO?window.HA_ACCOUNTING_KEY:userKey(user.id))||'{}').company?.name;}catch{return'';}})();
 if(company)document.getElementById('companyShort').textContent=company;
}
form.addEventListener('submit',async e=>{
 e.preventDefault();loginBtn.disabled=true;showMessage('جارٍ التحقق من الحساب…');
 try{
  const {data,error}=await client.auth.signInWithPassword({email:loginEmail(document.getElementById('loginId').value),password:document.getElementById('loginPassword').value});
  if(error)throw new Error('المعرّف أو كلمة المرور غير صحيحة.');
  await enter(data.user);if(!document.querySelector('.layout').classList.contains('authenticated'))showMessage('');
 }catch(err){if(isAccessDenied(err)&&currentUser)denyCachedAccess(currentUser,err);showMessage(err?.message||'تعذر التحقق من الحساب. إذا كان الحساب مسجلاً سابقاً، أعد المحاولة عند توفر الاتصال.');}
 finally{loginBtn.disabled=false;}
});
async function reconnectAccount(){
 if(!client||!currentUser||logoutRequested||!navigator.onLine||reconnectRunning)return;
 reconnectRunning=true;const user=currentUser;
 try{
  const {data,error}=await client.auth.getSession();if(error)throw error;
  if(!data?.session||data.session.user.id!==user.id)throw new Error('تعذر تجديد جلسة الاتصال. تبقى بيانات الحساب المحلي متاحة.');
  await checkAccess(data.session.user);if(logoutRequested||currentUser?.id!==user.id)return;rememberAccess(user);needsReconnect=false;showApp();if(staffContext){await window.HAStaff.refresh();return;}watchWorkspace(data.session.user);if(window.HA_ADMIN_DEMO)return;
  let local=null;try{local=JSON.parse(localStorage.getItem(userKey(user.id))||'null');}catch{}
  if(local){const before=stableJson(local);let base=null;try{base=JSON.parse(localStorage.getItem(baseKey(user.id))||'null');}catch{}const dirty=localStorage.getItem(pendingKey(user.id))==='1'||(base&&stableJson(base)!==before);if(dirty)await pushLocalWorkspace(user,local);else await withSyncDeadline(signal=>prepareWorkspace(user,{signal}));applySyncedWorkspace(user,before);}
 }catch(err){
  if(logoutRequested)return;
  if(isAccessDenied(err)){denyCachedAccess(user,err);return;}
  needsReconnect=true;const cached=readCachedAccess(user.id);if(cached?.active){applyCachedAccess(cached);showApp();}showMessage('الاتصال بالخدمة غير مستقر؛ بقي الحساب والواجهة والبيانات محفوظة، وستُعاد المزامنة عند عودة الاتصال.');
 }finally{reconnectRunning=false;}
}
window.addEventListener('online',()=>{needsReconnect=true;reconnectAccount();});
setInterval(()=>{if(needsReconnect&&document.visibilityState!=='hidden')reconnectAccount();},45000);
const adminDeleteStyles=document.createElement('style');adminDeleteStyles.textContent='#subscriberAdmin .admin-card{width:min(1000px,100%)}#subscriberAdmin .subscriber-row{grid-template-columns:repeat(auto-fit,minmax(110px,1fr))}#subscriberAdmin .subscriber-row [data-sub-delete]:hover{background:#ffdede}@media(max-width:700px){#subscriberAdmin .subscriber-row{grid-template-columns:1fr 1fr}#subscriberAdmin .subscriber-row button{grid-column:1/-1}}';document.head.appendChild(adminDeleteStyles);
document.getElementById('openAdmin').addEventListener('click',()=>{adminLayer.classList.add('open');adminLayer.setAttribute('aria-hidden','false');loadSubscribers();});
document.getElementById('closeAdmin').addEventListener('click',()=>{adminLayer.classList.remove('open');adminLayer.setAttribute('aria-hidden','true');});
async function adminCall(body){if(window.HA_ADMIN_DEMO)throw new Error('ارجع إلى حسابك الفعلي لإدارة المشتركين.');const {data,error}=await client.functions.invoke('manage-subscribers',{body});if(error)throw new Error(error.message||'تعذر الاتصال بدالة إدارة المشتركين.');if(data?.error)throw new Error(data.error);return data;}
const moduleOptions=(selected='full')=>{const options=[['market','أسواق / تجزئة'],['engineering','الهندسة المعمارية'],['processor','المعالجات'],['yemen','الورشة الصناعية'],['simple','واجهة بسيطة'],['service','مركز صيانة واستبدال'],['personal','حسابات شخصية'],['full','نشاط آخر · كل الأقسام']];const retired={restaurant:'مطعم · تعيين سابق',wholesale:'جملة · تعيين سابق',generator:'مولدة كهرباء · تعيين سابق'};if(retired[selected])options.unshift([selected,retired[selected]]);return options.map(([value,label])=>`<option value="${value}" ${value===(selected||'full')?'selected':''}>${label}</option>`).join('')};async function loadSubscribers(){const box=document.getElementById('subscriberList');box.innerHTML='<p class="hint">جارٍ تحميل الحسابات…</p>';adminMsg('');try{const result=await adminCall({action:'list'});box.innerHTML=(result.users||[]).map(u=>`<div class="subscriber-row"><b>${escapeHtml(u.login_id)}</b><span class="subscriber-status ${u.active?'':'off'}">${u.active?'فعال':'موقوف'}</span><span>${u.expires_at?new Date(u.expires_at).toLocaleDateString('ar-IQ'):'بدون انتهاء'}</span><select data-sub-module="${escapeHtml(u.user_id)}" aria-label="نوع نشاط ${escapeHtml(u.login_id)}">${moduleOptions(u.module_type)}</select><label>حد الموظفين<input type="number" min="0" max="100" step="1" data-sub-limit="${escapeHtml(u.user_id)}" value="${Number(u.staff_limit)||0}" aria-label="عدد موظفي ${escapeHtml(u.login_id)}"></label><button type="button" data-sub-save-module="${escapeHtml(u.user_id)}">حفظ النشاط والعدد</button><button type="button" data-sub-user="${escapeHtml(u.user_id)}" data-sub-active="${!u.active}">${u.active?'إيقاف':'تفعيل'}</button><button type="button" data-sub-delete="${escapeHtml(u.user_id)}" data-sub-name="${escapeHtml(u.login_id)}" style="background:#ffeded;color:#a32626">حذف الحساب</button></div>`).join('')||'<p class="empty">ماكو حسابات مشتركين بعد.</p>';}catch(err){box.innerHTML='';adminMsg(`${err.message} تأكد من تشغيل تحديث قاعدة البيانات ونشر Edge Function باسم manage-subscribers.`);}}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
const createSubscriberForm=document.getElementById('createSubscriber');const generatorFields=()=>{const show=createSubscriberForm.elements.moduleType.value==='generator';document.getElementById('generatorNameField')?.classList.toggle('hidden',!show);document.getElementById('generatorOwnerField')?.classList.toggle('hidden',!show);};createSubscriberForm.elements.moduleType.addEventListener('change',generatorFields);createSubscriberForm.addEventListener('reset',()=>setTimeout(generatorFields,0));generatorFields();createSubscriberForm.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,d=new FormData(f);adminMsg('جارٍ إنشاء الحساب…');try{const result=await adminCall({action:'create',loginId:d.get('loginId'),password:d.get('password'),expiresAt:d.get('expiresAt')||null,moduleType:d.get('moduleType')||'full',staffLimit:Number(d.get('staffLimit')||0),generatorName:d.get('generatorName')||null,generatorOwner:d.get('generatorOwner')||null});adminMsg(`تم إنشاء الحساب ${result.user.login_id}. أرسل له المعرّف وكلمة المرور الآن واحفظهما بمكان آمن.`,true);f.reset();await loadSubscribers();}catch(err){adminMsg(err.message);}});
document.getElementById('subscriberList').addEventListener('click',async e=>{const del=e.target.closest('[data-sub-delete]');if(del){const name=del.dataset.subName||'هذا الحساب';if(!confirm(`حذف حساب «${name}» نهائياً؟ سيتم حذف تسجيل الدخول والاشتراك وبياناته السحابية، ولا يمكن التراجع.`))return;del.disabled=true;adminMsg(`جارٍ حذف حساب ${name}…`);try{const result=await adminCall({action:'delete',userId:del.dataset.subDelete});await loadSubscribers();adminMsg(result.warning||`تم حذف حساب ${name} نهائياً.`,true);}catch(err){adminMsg(err.message);del.disabled=false;}return;}const saveModule=e.target.closest('[data-sub-save-module]');if(saveModule){const userId=saveModule.dataset.subSaveModule,moduleType=document.querySelector(`[data-sub-module="${CSS.escape(userId)}"]`)?.value;saveModule.disabled=true;try{const staffLimit=Number(document.querySelector(`[data-sub-limit="${CSS.escape(userId)}"]`)?.value);if(!Number.isInteger(staffLimit)||staffLimit<0||staffLimit>100)throw Error('عدد الموظفين من 0 إلى 100.');await adminCall({action:'update',userId,moduleType,staffLimit});await loadSubscribers();adminMsg('تم حفظ نشاط المشترك وعدد الموظفين المسموح.',true);}catch(err){adminMsg(err.message);saveModule.disabled=false;}return;}const b=e.target.closest('[data-sub-user]');if(!b)return;try{await adminCall({action:'update',userId:b.dataset.subUser,active:b.dataset.subActive==='true'});await loadSubscribers();adminMsg('تم تحديث حالة الحساب.',true);}catch(err){adminMsg(err.message);}});
(async()=>{
 const restored=startOfflineFromCache();
 if(!navigator.onLine){if(!restored){hideApp();showMessage('أول تسجيل دخول لهذا الحساب يحتاج إنترنت.');}return;}
 try{
  const {data,error}=await client.auth.getSession();if(error)throw error;const session=data?.session;
  if(!session){if(restored){needsReconnect=true;return;}hideApp();return;}
  try{await enter(session.user);}catch(err){if(isAccessDenied(err)){denyCachedAccess(session.user,err);return;}if(!restored&&!startOfflineFromCache()){hideApp();showMessage(err.message||'تعذر التحقق من الاشتراك.');}else{needsReconnect=true;showMessage('تعذر الاتصال حالياً؛ بقيت الواجهة والبيانات المحلية متاحة.');}}
 }catch(err){if(!restored&&!startOfflineFromCache()){hideApp();showMessage('تعذر استعادة جلسة الدخول. حاول عند توفر الاتصال.');}else{needsReconnect=true;showMessage('الاتصال غير مستقر؛ بقي الحساب مفتوحاً بالبيانات المحفوظة.');}}
})();
})();
