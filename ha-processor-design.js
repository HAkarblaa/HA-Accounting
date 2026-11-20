/* Presentation only: preserve existing form controls, events and financial posting. */
(()=>{'use strict';if(window.HAProcessorDesign)return;let queued=false;
const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
function field(form,selector){return form.querySelector(selector)?.closest('.field');}
function move(node,host){if(node&&host&&node.parentElement!==host)host.append(node);}
function decorateInvoice(form){
 const editing=form.id==='editProcessorInvoice',sections=[...form.children].filter(n=>n.classList.contains('processor-invoice-section')),meta=editing?form.querySelector(':scope > .form-grid'):sections[0]?.querySelector('.processor-invoice-fields'),discount=editing?sections[0]:sections[2],payment=editing?sections[1]:sections[3];
 form.classList.add('hpw-invoice');if(editing&&form.dataset.hpwKind)setText(document.querySelector('#modal .modal-title h2'),form.dataset.hpwKind==='purchase'?'تعديل فاتورة شراء':'تعديل فاتورة بيع');if(!editing&&form.dataset.hpwKind==='purchase'){const methods=form.querySelector('.processor-receive-methods');setText(methods?.parentElement?.querySelector(':scope > label'),'طريقة الدفع للمجهز (الصندوق أو المصرف)');for(const label of methods?.querySelectorAll('label')||[])for(const node of label.childNodes)if(node.nodeType===3&&node.nodeValue.includes('تم الاستلام'))node.nodeValue=node.nodeValue.replace('تم الاستلام','تم الدفع');for(const inputId of ['processorCashReceived','processorBankReceived']){const label=field(form,'#'+inputId)?.querySelector('label');if(label)for(const node of label.childNodes)if(node.nodeType===3&&node.nodeValue.includes('المستلم'))node.nodeValue=node.nodeValue.replace('المستلم','المدفوع');}}meta?.classList.add('hpw-metadata');discount?.classList.add('hpw-adjustments');payment?.classList.add('hpw-payment');
 // Move the original nodes, never clone inputs or replace their listeners.
 move(field(form,editing?'#pePaymentMode':'#processorMode'),meta);
 move(field(form,editing?'#peDeliveryFee':'#processorDeliveryFee'),discount?.querySelector('.processor-invoice-fields'));
 move(field(form,editing?'#peDeliveryStatus':'#processorDeliveryStatus'),payment?.querySelector('.processor-invoice-fields'));
 if(meta){for(const [index,name]of ['party','number','date','currency','exchangeRate','representative',editing?'paymentMode':'mode'].entries()){const node=field(form,'[name="'+name+'"]');if(node?.parentElement===meta)node.style.order=String(index);}}
 const note=field(form,'textarea[name="memo"]');note?.classList.add('hpw-notes');const breakdown=form.querySelector(':scope > .processor-invoice-breakdown');if(note&&breakdown&&note.nextElementSibling!==breakdown)form.insertBefore(note,breakdown);form.querySelector(':scope > .form-actions')?.classList.add('hpw-actions');
 for(const table of form.querySelectorAll('.processor-lines-table')){const heading=table.querySelector('thead th');setText(heading,'المنتج');for(const row of table.querySelectorAll('tbody tr'))if(row.firstElementChild?.hasAttribute('data-label'))row.firstElementChild.dataset.label='المنتج';}
 if(editing){
  const table=form.querySelector('.processor-lines-table');if(table&&!table.querySelector('[data-hpw-total-heading]')){const th=document.createElement('th');th.dataset.hpwTotalHeading='';th.textContent='الإجمالي';table.querySelector('thead tr')?.insertBefore(th,table.querySelector('thead tr')?.lastElementChild);}
  const currency=form.querySelector('#peCurrency')?.value==='USD'?'$':'د.ع',format=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n)+' '+currency;
  for(const row of form.querySelectorAll('#peLines tr')){let cell=row.querySelector('[data-hpw-line-total]');if(!cell){cell=document.createElement('td');cell.dataset.hpwLineTotal='';cell.dataset.label='الإجمالي';row.insertBefore(cell,row.lastElementChild);}setText(cell,format((Number(row.querySelector('.pe-qty')?.value)||0)*(Number(row.querySelector('.pe-price')?.value)||0)));}
  let summary=form.querySelector('.hpw-edit-summary');if(!summary){summary=document.createElement('div');summary.className='processor-invoice-summary hpw-edit-summary';summary.setAttribute('aria-live','polite');for(const label of ['الإجمالي النهائي','المدفوع','المتبقي']){const card=document.createElement('div'),small=document.createElement('small'),strong=document.createElement('strong');small.textContent=label;card.append(small,strong);summary.append(card);}form.insertBefore(summary,form.querySelector('.hpw-actions'));}
  const balance=form.querySelector('#peBalanceHint')?.textContent||'',parts=balance.split('·');setText(summary.children[0]?.querySelector('strong'),form.querySelector('#peInvoiceAmount')?.textContent||'—');setText(summary.children[1]?.querySelector('strong'),parts[0]?.trim().replace(/^المدفوع\s*/,'')||'—');setText(summary.children[2]?.querySelector('strong'),parts[1]?.trim().replace(/^المتبقي\s*/,'')||'—');
 }
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
