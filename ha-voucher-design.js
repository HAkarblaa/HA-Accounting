/* Voucher entry layout; derived text/history are read-only. Posting uses original forms. */
(()=>{'use strict';if(window.HAVoucherDesign)return;let queued=false,activeForm=null,historyTimer=0;const historyKeys=new WeakMap(),formatted=new WeakSet(),moneyFormat=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});const modal=document.getElementById('modal');if(!modal)return;
function text(node,value){if(node&&node.textContent!==value)node.textContent=value;}
function kindOf(form){return form.querySelector('[name=kind]')?.value||form.dataset.haVoucherKind||'';}
function amountWords(raw){if(String(raw).trim()===''||!Number.isFinite(Number(raw))||Number(raw)<0)return'—';const total=Math.round(Number(raw)*100),whole=Math.floor(total/100),part=total%100,words=window.HAInvoiceLayout?.words;if(!words)return new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(raw))+' د.ع';return 'فقط '+words(whole)+' دينار عراقي'+(part?' و'+words(part)+' جزء من مائة دينار':'')+' لا غير';}
function history(form,kind,force=false){
 if(!form.isConnected||!modal.open||form!==activeForm)return;
 const key=JSON.stringify([kind,form.dataset.haVoucherScope,form.dataset.haVoucherId,form.querySelector('[name=party]')?.value||'']);
 if(!force&&historyKeys.get(form)===key)return;
 let details=form.querySelector('.hvd-history');if(!details){details=document.createElement('details');details.className='hvd-history';const summary=document.createElement('summary'),body=document.createElement('div');body.className='hvd-history-body';summary.textContent='السندات السابقة';details.append(summary,body);form.insertBefore(details,form.querySelector(':scope > .form-actions'));}
 historyKeys.set(form,key);const rows=(form.dataset.haVoucherScope==='engineering'?window.HA_ENG_VOUCHER_HISTORY:window.HA_VOUCHER_HISTORY)?.({kind,scope:form.dataset.haVoucherScope||'standard',party:form.querySelector('[name=party]')?.value||'',exclude:form.dataset.haVoucherId||''})||[],signature=JSON.stringify(rows);if(details.dataset.hvdSignature===signature)return;details.dataset.hvdSignature=signature;text(details.querySelector('summary'),'السندات السابقة · '+rows.length+' معروضة');const body=details.querySelector('.hvd-history-body');body.replaceChildren();if(!rows.length){const empty=document.createElement('p');empty.textContent='لا توجد سندات سابقة مطابقة ضمن هذا الدفتر.';body.append(empty);return;}
 const table=document.createElement('table'),thead=document.createElement('thead'),tr=document.createElement('tr');for(const value of ['رقم السند','التاريخ','الجهة','المبلغ']){const cell=document.createElement('th');cell.textContent=value;tr.append(cell);}thead.append(tr);table.append(thead);const tbody=document.createElement('tbody');for(const row of rows){const line=document.createElement('tr');for(const value of [row.number,row.dateLabel,row.party||'بدون تحديد',moneyFormat.format(row.amount)+' د.ع']){const cell=document.createElement('td');cell.textContent=String(value??'');line.append(cell);}tbody.append(line);}table.append(tbody);body.append(table);
}
function scheduleHistory(form,delay=180,force=false){
 clearTimeout(historyTimer);historyTimer=setTimeout(()=>{
  if(form!==activeForm||!form.isConnected||!modal.open)return;
  try{history(form,kindOf(form),force);}catch(error){historyKeys.delete(form);console.warn('Voucher history display failed',error);}
 },delay);
}
function updateWords(form){text(form.querySelector('.hvd-words output'),amountWords(form.querySelector('[name=amount]')?.value||''));}
function decorate(){const form=modal.querySelector('#trForm,#editTreasuryForm,#engAdvancedCash'),kind=form?kindOf(form):'',active=!!form&&modal.open&&['receipt','payment'].includes(kind);modal.classList.toggle('ha-voucher-dialog',active);if(!active){activeForm=null;clearTimeout(historyTimer);return;}const switched=activeForm!==form;activeForm=form;if(modal.dataset.hvdKind!==kind)modal.dataset.hvdKind=kind;form.classList.add('hvd-form');text(modal.querySelector('.modal-title h2'),(form.id==='editTreasuryForm'||form.dataset.haVoucherEdit?'تعديل ':'')+(kind==='receipt'?'سند قبض':'سند دفع'));
 const grid=form.querySelector(':scope > .form-grid');if(!grid)return;const order=['kind','number','date','projectId','partyKind','party','category','other','cash','paymentChannel','amount','memo'];for(const [index,name]of order.entries()){const field=form.querySelector('[name="'+name+'"]')?.closest('.field');if(field&&field.style.order!==String(name==='memo'?21:index))field.style.order=String(name==='memo'?21:index);if(name==='memo')field?.classList.add('hvd-memo');if(name==='amount')field?.classList.add('hvd-money');}
 let words=form.querySelector('.hvd-words');if(!words){words=document.createElement('div');words.className='field hvd-words';words.style.order='20';const label=document.createElement('span'),value=document.createElement('output');label.className='hvd-label';label.textContent='المبلغ كتابةً';value.setAttribute('aria-live','polite');words.append(label,value);grid.append(words);}updateWords(form);
 const amountField=form.querySelector('[name=amount]')?.closest('.field');if(amountField&&!amountField.querySelector('.hvd-currency')){const unit=document.createElement('small');unit.className='hvd-currency';unit.textContent='دينار عراقي (د.ع)';amountField.append(unit);}if(switched||!formatted.has(form)){formatted.add(form);scheduleHistory(form,0,true);}
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});}
// Only replacement of the form or opening/closing the dialog requires a full decoration.
// Amount and memo input must never cause a scan/sort of the accounting history.
const observer=new MutationObserver(schedule);
const body=modal.querySelector('#modalBody');
if(body)observer.observe(body,{childList:true});
observer.observe(modal,{attributes:true,attributeFilter:['open']});
for(const type of ['input','change'])document.addEventListener(type,event=>{
 const form=event.target.closest?.('#trForm,#editTreasuryForm,#engAdvancedCash');
 if(!form||form!==activeForm)return;
 if(event.target.name==='amount')updateWords(form);
 if(event.target.name==='party'||event.target.name==='partyKind')scheduleHistory(form);
 if(event.target.name==='kind'){decorate();scheduleHistory(form);}
});
for(const type of ['ha-accounting-save','ha-accounting-synced'])window.addEventListener(type,()=>{if(activeForm)scheduleHistory(activeForm,250,true);});
window.HAVoucherDesign={decorate,amountWords};schedule();
})();
