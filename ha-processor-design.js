/* Presentation only: preserve existing form controls, events and financial posting. */
(()=>{'use strict';if(window.HAProcessorDesign)return;let queued=false;const structures=new WeakMap();
const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
function field(form,selector){return form.querySelector(selector)?.closest('.field');}
function move(node,host){if(node&&host&&node.parentElement!==host)host.append(node);}
function packInvoice(form,refs,editing){
 if(form.dataset.hpwPacked)return;
 const {meta,discount,payment}=refs;if(!meta||!discount||!payment)return;
 const originalSections=[...form.children].filter(n=>n.classList.contains('processor-invoice-section'));
 const top=document.createElement('section'),products=document.createElement('section'),bottom=document.createElement('section'),drawer=document.createElement('section');
 top.className='hpw-top';products.className='hpw-products';bottom.className='hpw-bottom';drawer.className='hpw-drawer';drawer.hidden=true;drawer.setAttribute('aria-label','تفاصيل إضافية للفاتورة');
 const tools=document.createElement('div');tools.className='hpw-extra-tools';const extra=document.createElement('button');extra.type='button';extra.className='btn secondary small';extra.textContent='تفاصيل الدفع والصرف';extra.setAttribute('aria-expanded','false');tools.append(extra);
 const drawerHead=document.createElement('div'),close=document.createElement('button');drawerHead.className='hpw-drawer-head';drawerHead.append(document.createTextNode('تفاصيل الدفع والصرف'));close.type='button';close.className='btn secondary small';close.textContent='إغلاق التفاصيل';drawerHead.append(close);drawer.append(drawerHead);
 function show(value){drawer.hidden=!value;extra.setAttribute('aria-expanded',String(value));}
 extra.onclick=()=>show(drawer.hidden);close.onclick=()=>show(false);
 // These are the very same controls used by the original calculation and saving handlers.
 move(field(form,editing?'#peRate':'#processorExchangeRate'),drawer);
 move(field(form,editing?'#peDeliveryStatus':'#processorDeliveryStatus'),drawer);
 const split=form.querySelector('.processor-receive-split');move(split,drawer);for(const label of form.querySelectorAll('.processor-receive-methods label'))for(const node of label.childNodes)if(node.nodeType===3)node.nodeValue=node.nodeValue.replace(/\s*\(.*/, '');
 for(const selector of ['#processorInstallmentFields','#processorCreditFields','#peCreditField','#peInstallmentField','#peInstallmentCountField','#processorNewCustomerPanel','#processorQuickProductPanel'])move(form.querySelector(selector),drawer);
 const note=field(form,'textarea[name="memo"]');if(note){move(note,meta);note.style.order='8';note.classList.add('hpw-metadata-note');note.querySelector('textarea').rows=1;}
 move(meta,top);top.append(tools);
 if(editing){move(form.querySelector(':scope > .panel-head'),products);move(form.querySelector('.processor-edit-lines'),products);move(form.querySelector('#processorEditProductOptions'),products);}
 else{const section=originalSections.find(n=>n.querySelector('#processorLines'));if(section){while(section.firstChild)products.append(section.firstChild);section.remove();}}
 discount.classList.add('hpw-compact-adjustments');payment.classList.add('hpw-compact-payment');move(discount,bottom);move(payment,bottom);move(form.querySelector('.processor-invoice-summary'),bottom);
 const breakdown=form.querySelector('.processor-invoice-breakdown');move(breakdown,drawer);
 for(const node of [...form.children])if(node!==discount&&node!==payment&&node.classList.contains('processor-invoice-section')&&!node.querySelector('input,select,textarea,table'))node.remove();
 // Keep explanatory and error text available, without enlarging the main desktop sheet.
 for(const node of [...form.children])if(node.matches('p.hint'))move(node,drawer);
 const actions=form.querySelector(':scope > .form-actions');if(actions){const print=document.createElement('button');print.type='submit';print.className='btn secondary';print.dataset.hpwPrint='';print.textContent=editing?'حفظ التعديل وطباعة':'حفظ وطباعة';actions.append(print);form.addEventListener('submit',event=>{form.dataset.hpwPrint=event.submitter?.hasAttribute('data-hpw-print')?'1':'0';},true);}
 form.prepend(top);top.after(products);products.after(bottom);form.append(drawer);
 // Show advanced required fields when a payment/currency choice needs them.
 form.addEventListener('change',event=>{const id=event.target.id;if([editing?'pePaymentMode':'processorMode',editing?'peCurrency':'processorCurrency'].includes(id)){if(event.target.value==='USD'||['credit','installment'].includes(event.target.value))show(true);}if(['processorReceiveCash','processorReceiveBank'].includes(id)&&form.querySelector('#processorReceiveCash')?.checked&&form.querySelector('#processorReceiveBank')?.checked)show(true);if(id==='processorDeliveryStatus'||id==='peDeliveryStatus')if(event.target.value==='credit')show(true);});
 form.addEventListener('click',event=>{if(event.target.closest('#processorNewCustomerToggle,#processorQuickProductToggle'))show(true);});
 form.addEventListener('invalid',event=>{if(drawer.contains(event.target)){show(true);event.target.scrollIntoView?.({block:'nearest'});}},true);
 form.dataset.hpwPacked='1';
}
function decorateInvoice(form){
 const editing=form.id==='editProcessorInvoice';let refs=structures.get(form);if(!refs){const sections=[...form.children].filter(n=>n.classList.contains('processor-invoice-section'));refs={meta:editing?form.querySelector(':scope > .form-grid'):sections[0]?.querySelector('.processor-invoice-fields'),discount:editing?sections[0]:sections[2],payment:editing?sections[1]:sections[3]};structures.set(form,refs);}const {meta,discount,payment}=refs;
 form.classList.add('hpw-invoice');if(editing&&form.dataset.hpwKind)setText(document.querySelector('#modal .modal-title h2'),form.dataset.hpwKind==='purchase'?'تعديل فاتورة شراء':'تعديل فاتورة بيع');if(!editing&&form.dataset.hpwKind==='purchase'){const methods=form.querySelector('.processor-receive-methods');setText(methods?.parentElement?.querySelector(':scope > label'),'طريقة الدفع للمجهز (الصندوق أو المصرف)');for(const label of methods?.querySelectorAll('label')||[])for(const node of label.childNodes)if(node.nodeType===3&&node.nodeValue.includes('تم الاستلام'))node.nodeValue=node.nodeValue.replace('تم الاستلام','تم الدفع');for(const inputId of ['processorCashReceived','processorBankReceived']){const label=field(form,'#'+inputId)?.querySelector('label');if(label)for(const node of label.childNodes)if(node.nodeType===3&&node.nodeValue.includes('المستلم'))node.nodeValue=node.nodeValue.replace('المستلم','المدفوع');}}meta?.classList.add('hpw-metadata');discount?.classList.add('hpw-adjustments');payment?.classList.add('hpw-payment');
 // Move the original nodes, never clone inputs or replace their listeners.
 move(field(form,editing?'#pePaymentMode':'#processorMode'),meta);
 move(field(form,editing?'#peDeliveryFee':'#processorDeliveryFee'),discount?.querySelector('.processor-invoice-fields'));
 if(!form.dataset.hpwPacked)move(field(form,editing?'#peDeliveryStatus':'#processorDeliveryStatus'),payment?.querySelector('.processor-invoice-fields'));
 if(meta){for(const [index,name]of ['party','number','date','currency','exchangeRate','representative',editing?'paymentMode':'mode'].entries()){const node=field(form,'[name="'+name+'"]');if(node?.parentElement===meta)node.style.order=String(index);}}
 const note=field(form,'textarea[name="memo"]');note?.classList.add('hpw-notes');const breakdown=form.querySelector(':scope > .processor-invoice-breakdown');if(note&&breakdown&&note.nextElementSibling!==breakdown)form.insertBefore(note,breakdown);form.querySelector(':scope > .form-actions')?.classList.add('hpw-actions');
 for(const table of form.querySelectorAll('.processor-lines-table')){const heading=table.querySelector('thead th');setText(heading,'المنتج');for(const row of table.querySelectorAll('tbody tr'))if(row.firstElementChild?.hasAttribute('data-label'))row.firstElementChild.dataset.label='المنتج';}
 if(editing){
  const table=form.querySelector('.processor-lines-table');if(table&&!table.querySelector('[data-hpw-total-heading]')){const th=document.createElement('th');th.dataset.hpwTotalHeading='';th.textContent='الإجمالي';table.querySelector('thead tr')?.insertBefore(th,table.querySelector('thead tr')?.lastElementChild);}
  const currency=form.dataset.hpwCurrency==='USD'?'$':'د.ع',format=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n)+' '+currency;
  for(const row of form.querySelectorAll('#peLines tr')){let cell=row.querySelector('[data-hpw-line-total]');if(!cell){cell=document.createElement('td');cell.dataset.hpwLineTotal='';cell.dataset.label='الإجمالي';row.insertBefore(cell,row.lastElementChild);}setText(cell,format((Number(row.querySelector('.pe-qty')?.value)||0)*(Number(row.querySelector('.pe-price')?.value)||0)));}
  let summary=form.querySelector('.hpw-edit-summary');if(!summary){summary=document.createElement('div');summary.className='processor-invoice-summary hpw-edit-summary';summary.setAttribute('aria-live','polite');for(const label of ['الإجمالي النهائي','المدفوع','المتبقي']){const card=document.createElement('div'),small=document.createElement('small'),strong=document.createElement('strong');small.textContent=label;card.append(small,strong);summary.append(card);}form.insertBefore(summary,form.querySelector('.hpw-actions'));}
  const balance=form.querySelector('#peBalanceHint')?.textContent||'',parts=balance.split('·');setText(summary.children[0]?.querySelector('strong'),form.querySelector('#peInvoiceAmount')?.textContent||'—');setText(summary.children[1]?.querySelector('strong'),parts[0]?.trim().replace(/^المدفوع\s*/,'')||'—');setText(summary.children[2]?.querySelector('strong'),parts[1]?.trim().replace(/^المتبقي\s*/,'')||'—');
 }
 packInvoice(form,refs,editing);
}
function decorate(){
 const modal=document.getElementById('modal'),view=document.getElementById('view'),module=window.HA_APP_MODULE_TYPE||window.HA_ACCOUNTING_MODULE_TYPE,page=window.HA_APP_PAGE?.()||'';
 const processor=module==='processor'||String(page).startsWith('processor-');view?.classList.toggle('ha-processor-page',processor);
 if(!modal)return;const form=modal.querySelector('#processorInvoiceForm,#editProcessorInvoice'),scoped=!!form||processor;modal.classList.toggle('ha-processor-workspace',scoped);modal.classList.toggle('hpw-invoice-dialog',!!form);
 if(form)decorateInvoice(form);
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});}
const observer=new MutationObserver(schedule);const modal=document.getElementById('modal'),view=document.getElementById('view');for(const target of [modal,view])if(target)observer.observe(target,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['open']});
document.addEventListener('input',event=>{if(event.target.closest('#processorInvoiceForm,#editProcessorInvoice'))schedule();});document.addEventListener('change',event=>{if(event.target.closest('#processorInvoiceForm,#editProcessorInvoice'))schedule();});window.addEventListener('ha-accounting-auth-ready',schedule);window.addEventListener('popstate',schedule);window.HAProcessorDesign={decorate};schedule();
})();
