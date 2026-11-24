(function(){
'use strict';
function create({modal,panel,view,context,getPage,getSection,activateSection,onChange}){
 const body=modal.querySelector('#modalBody'),home=modal.parentNode,anchor=modal.nextSibling;
 const nativeClose=modal.close.bind(modal),nativeCancel=window.confirm.bind(window);
 const records=new Map();
 let current=null,sequence=0;
 const initialized=entry=>entry.baseline!==undefined;
 const values=root=>JSON.stringify([...root.querySelectorAll('input,select,textarea,[contenteditable="true"]')].map(el=>{
  if(el.type==='file')return [...el.files||[]].map(f=>[f.name,f.size,f.lastModified]);
  if(el.type==='checkbox'||el.type==='radio')return [el.value,el.checked];
  if(el.multiple&&el.selectedOptions)return [...el.selectedOptions].map(option=>option.value);
  return el.value??el.textContent;
 }));
 const snapshot=entry=>values(entry===current?body:entry.fragment);
 const changed=entry=>initialized(entry)&&entry.baseline!==snapshot(entry);
 const scope=()=>context();
 const sameScope=(record,now=scope())=>record.account===now.account&&record.module===now.module;
 const visible=()=>[...records.values()].filter(record=>sameScope(record));
 function showSection(){
  panel.hidden=true;
  view.hidden=false;
  if(modal.parentNode!==home)home.insertBefore(modal,anchor);
 }
 function clearModal(){
  if(modal.open)nativeClose();
  delete modal.dataset.haWorkTab;
  showSection();
 }
 function park(){
  const entry=current;
  if(!entry)return false;
  if(!initialized(entry))entry.baseline=values(body);
  entry.scroll=[panel.scrollLeft,panel.scrollTop];
  entry.internalScroll=[body,...body.querySelectorAll('*')].filter(el=>el.scrollTop||el.scrollLeft)
   .map(el=>[el,el.scrollLeft,el.scrollTop]);
  entry.properties=[...modal.attributes].filter(attribute=>!['id','open','data-ha-work-tab'].includes(attribute.name))
   .map(attribute=>[attribute.name,attribute.value]);
  entry.onclick=body.onclick;
  entry.onchange=body.onchange;
  entry.oninput=body.oninput;
  entry.fragment.append(...body.childNodes);
  body.onclick=body.onchange=body.oninput=null;
  current=null;
  clearModal();
  return true;
 }
 function display(entry){
  panel.hidden=false;
  view.hidden=true;
  if(modal.parentNode!==panel)panel.append(modal);
  modal.dataset.haWorkTab=entry.id;
  if(!modal.open)modal.show();
 }
 function beforeOpen(){
  if(park())onChange();
 }
 function eligible(){
  return body.querySelector('form, #categoryForm, #simpleStocktakeWarehouse, #processorDashboardCustomizer');
 }
 function present(){
  if(!eligible()||!document.querySelector('.layout.authenticated'))return false;
  const now=scope(),form=eligible(),heading=body.querySelector('.modal-title h2')?.textContent?.trim()||'مستند';
  const entry={id:'work-'+(++sequence),page:getPage(),section:getSection(),title:heading,
   account:now.account,module:now.module,owner:now.owner,fragment:document.createDocumentFragment(),form};
  if(modal.open)nativeClose();
  records.set(entry.id,entry);
  current=entry;
  display(entry);
  queueMicrotask(()=>{
   if(!records.has(entry.id))return;
   if(!initialized(entry))entry.baseline=snapshot(entry);
   const number=entry.form.querySelector?.('[name="number"]')?.value?.trim();
   if(number&&!entry.title.includes(number))entry.title+=' · '+number;
   onChange();
   if(entry===current){panel.scrollLeft=0;panel.scrollTop=0;window.scrollTo(0,0);}
  });
  return true;
 }
 function activate(id){
  const entry=records.get(id);
  if(!entry||!sameScope(entry)||entry===current)return false;
  park();
  if(modal.open)nativeClose();
  activateSection(entry);
  for(const attribute of [...modal.attributes]){
   if(!['id','open'].includes(attribute.name))modal.removeAttribute(attribute.name);
  }
  for(const [name,value]of entry.properties||[])modal.setAttribute(name,value);
  body.replaceChildren(entry.fragment);
  body.onclick=entry.onclick;
  body.onchange=entry.onchange;
  body.oninput=entry.oninput;
  current=entry;
  display(entry);
  onChange();
  requestAnimationFrame(()=>{
   if(current!==entry)return;
   for(const [el,x,y]of entry.internalScroll||[]){el.scrollLeft=x;el.scrollTop=y;}
   [panel.scrollLeft,panel.scrollTop]=entry.scroll||[0,0];
   window.scrollTo(0,0);
  });
  return true;
 }
 function mayClose(entry){
  return !changed(entry)||nativeCancel('توجد تغييرات غير محفوظة في «'+entry.title+'». إغلاق التبويب وحذف التغييرات؟');
 }
 function remove(id,ask=true){
  const entry=records.get(id);
  if(!entry||ask&&!mayClose(entry))return false;
  if(entry===current)park();
  records.delete(id);
  entry.form.dispatchEvent(new Event('ha-work-form-close'));
  onChange();
  return true;
 }
 function watch(read){
  if(!current)return;
  current.read=read;
  current.revision=JSON.stringify(read()??null);
 }
 function valid(){
  if(!current)return true;
  const now=scope();
  if(!sameScope(current,now)||current.owner!==now.owner)return false;
  return !current.read||JSON.stringify(current.read()??null)===current.revision;
 }
 function blocked(event){
  event.preventDefault();
  event.stopImmediatePropagation();
  const text='تغيّرت بيانات هذا السجل أثناء فتحه. أبقِ التبويب مفتوحاً وراجع أحدث نسخة من السجل قبل إعادة إدخال التعديل.';
  if(!window.HAFormRecovery?.notify(text,current.form.matches?.('form')?current.form:undefined)){
   let notice=body.querySelector('[data-work-conflict]');
   if(!notice){notice=document.createElement('p');notice.className='notice';notice.dataset.workConflict='';notice.setAttribute('role','alert');body.prepend(notice);}
   notice.textContent=text;
  }
 }
 modal.close=function(...args){
  if(current){remove(current.id,false);return;}
  nativeClose(...args);
 };
 modal.addEventListener('close',()=>{if(current&&!modal.open)remove(current.id,false);});
 modal.addEventListener('submit',event=>{if(current&&!valid())blocked(event);},true);
 modal.addEventListener('save-data',event=>{if(current&&!valid())blocked(event);},true);
 modal.addEventListener('click',event=>{
  if(!current)return;
  const button=event.target.closest?.('button');
  if(button?.matches('#closeModal,#simpleStocktakeCancel,[data-ym-cancel-invoice],[id^="cancel"],[data-engx="cancel"],[data-pp="cancel"]')){
   if(!mayClose(current)){event.preventDefault();event.stopImmediatePropagation();}
  }else if(button?.matches('#saveCategoryButton,#simpleStocktakeSave')&&!valid())blocked(event);
 },true);
 modal.addEventListener('keydown',event=>{
  if(current&&event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();remove(current.id);}
 });
 function reconcile(){
  const now=scope();
  if(current&&!sameScope(current,now))park();
  for(const [id,entry]of records)if(entry.account!==now.account)records.delete(id);
  onChange();
 }
 window.addEventListener('beforeunload',event=>{
  if([...records.values()].some(changed)){event.preventDefault();event.returnValue='';}
 });
 return {beforeOpen,present,activate,remove,watch,reconcile,leave:park,visible,
  active:()=>current,hasOpen:()=>records.size>0};
}
window.HAWorkspaceTabs={create};
})();
