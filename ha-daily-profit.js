/* Read-only daily drilldown. Two columns; aggregate journal effects by their actual document. */
(()=>{'use strict';if(window.HADailyProfit)return;const round=n=>Math.round((Number(n)+Number.EPSILON)*100)/100,number=n=>Number(n)||0,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt=n=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n);
function buildMarket(source,day){
 const accounts=new Map(source.accounts.map(a=>[a.id,a]));
 const docs=new Map(source.documents.map(d=>[String(d.id),d]));
 const sales=new Map(),adjustments=new Map();
 for(const [id,d] of docs){
  if(d.kind==='sale'&&d.date===day) sales.set(id,{
   id,number:d.number||'—',party:d.party||'بيع نقدي',amount:number(d.amount),
   revenue:0,cost:0,profit:0,posted:false
  });
 }
 for(const entry of source.entries){
  if(entry.date!==day||entry.processorVoucher||entry.processorPartnerId)continue;
  const finance=(entry.lines||[]).filter(line=>['expense','revenue'].includes(accounts.get(line.accountId)?.type));
  if(!finance.length)continue;
  const profit=finance.reduce((sum,line)=>sum+number(line.credit)-number(line.debit),0);
  const id=String(entry.docId??'');
  const sale=entry.source==='document'&&!entry.sharedReturnId?sales.get(id):null;
  if(sale){
   sale.posted=true;
   sale.profit+=profit;
   for(const line of finance){
    const account=accounts.get(line.accountId);
    if(account.type==='revenue')sale.revenue+=number(line.credit)-number(line.debit);
    if(String(account.code)==='5101')sale.cost+=number(line.debit)-number(line.credit);
   }
  }else{
   const key=entry.sharedReturnId?'return:'+entry.sharedReturnId:entry.docId?'doc:'+id:'entry:'+entry.id;
   const row=adjustments.get(key)||{id:key,number:docs.get(id)?.number||entry.number||'—',profit:0};
   row.profit+=profit;
   adjustments.set(key,row);
  }
 }
 const rows=[...sales.values()].map(sale=>({...sale,revenue:round(sale.revenue),cost:round(sale.cost),profit:round(sale.profit)}));
 const otherRows=[...adjustments.values()].map(row=>({...row,profit:round(row.profit)}));
 const total=round([...rows,...otherRows].reduce((sum,row)=>sum+row.profit,0));
 return {scope:source.scope,market:true,date:day,currency:source.currency||'IQD',rows,otherRows,total,unresolved:[],
  basis:'الإجمالي يشمل القيود المرحلة. ربح الفاتورة يحسب من صافي إيرادها بعد استبعاد الضريبة وكلفة البضاعة، وتظهر المرتجعات والمصروفات اليومية كحركات منفصلة.'};
}
function build(source,day){
 if(source.market&&source.scope==='standard')return buildMarket(source,day);
const rows=new Map(),unresolved=[],add=(id,no,value)=>{if(!Number.isFinite(value)){unresolved.push(no||id);return;}const old=rows.get(id)||{id,number:no||id,profit:0};old.profit+=value;rows.set(id,old);},scope=source.scope;let basis='صافي الإيرادات ناقص المصروفات من القيود المرحلة؛ المساهمات والتحويلات وتسديد أصل الدين لا تعتبر أرباحاً.';
 if(scope==='processor'){basis='هامش فواتير البيع بعد الخصم وكلفة المواد، مع التوصيل والمرتجعات والإيراد الخارجي ومصروفات اليوم. الضرائب المحصلة مستبعدة من الربح.';const p=source.processor;for(const d of p.docs.filter(d=>d.kind==='sale'&&d.date===day)){const sub=d.subtotal??(d.items||[]).reduce((n,i)=>n+number(i.qty)*number(i.price),0),cost=(d.items||[]).reduce((n,i)=>n+number(i.qty)*number(i.cost),0);add('doc:'+d.id,d.number,number(sub)-number(d.discount)-cost);}for(const r of p.returns.filter(r=>r.kind==='sale_return'&&r.date===day)){const d=p.docs.find(d=>d.id===r.sourceId),goods=d?number(d.amount)-(d.deliveryInTotal?number(d.deliveryFee):0):0,returned=number(r.amount)-number(r.deliveryAmount),tax=goods?number(d.taxAmount)*returned/goods:0,cost=(r.items||[]).reduce((n,i)=>n+number(i.qty)*number(i.cost),0);add('return:'+r.id,r.number,-returned+tax+cost);}for(const r of p.delivery.filter(r=>r.date===day)){const returned=String(r.id||'').startsWith('return-delivery-'),id=returned?'return:'+String(r.id).slice(16):'doc:'+r.invoiceId;add(id,r.number,(r.kind==='income'?1:-1)*number(r.amount));}for(const r of p.externalIncome.filter(r=>r.date===day))add('income:'+r.id,r.number||'إيراد '+r.id,number(r.amount));for(const r of p.expenses.filter(r=>r.date===day))add('expense:'+r.id,r.number||'مصروف '+r.id,-number(r.amount));for(const r of p.writeoffs.filter(r=>r.date===day))add('writeoff:'+r.id,r.number||'إخراج '+r.id,-number(r.totalCost));}
 else if(scope==='engineering'){basis='حسب صافي حركات دفتر الهندسة: إيرادات المشاريع والمبيعات ناقص المشتريات والمصاريف وكلفة البيع المباشر. ربح العقد المتفق عليه يظهر منفصلاً في المشاريع.';for(const r of source.engineeringRows.filter(r=>r.date===day))add(r.transactionId||r.number,r.number,number(r.value));}
 else if(scope==='service'){basis='صافي مبالغ تسليمات المركز المستلمة في اليوم ناقص مصروفاته المسجلة.';for(const t of source.tickets)for(const d of (t.deliveryLog||[]).filter(d=>d.date===day))add('ticket:'+t.id,t.number, d.amount!==undefined?number(d.amount):number(d.qty)*number(d.price??t.unitPrice));for(const e of source.expenses.filter(e=>e.date===day))add('expense:'+e.id,e.number||'مصروف '+e.id,-number(e.amount));}
 else if(scope==='workshop'){basis='فرق المبيعات والمشتريات بتاريخ حركتها في دفتر الورشة، مع عكس المرتجعات. هذا احتساب الدفتر الحالي، ويختلف عن هامش كلفة البضاعة المباعة.';for(const d of source.workshop.invoices.filter(d=>d.date===day&&['sale','purchase'].includes(d.type))){const foreign=d.currency===source.workshop.settings?.foreignCode,rate=foreign?number(d.rate):1,amount=d.baseAmount!==undefined?number(d.baseAmount):rate>0?(d.items||[]).reduce((n,i)=>n+number(i.qty)*number(i.price),0)*rate:NaN;add('invoice:'+d.id,d.number,(d.type==='sale'?1:-1)*amount);}for(const r of source.workshop.returns.filter(r=>r.date===day&&['sale','purchase'].includes(r.sourceKind)))add('return:'+r.id,r.number,(r.sourceKind==='sale'?-1:1)*number(r.amount));}
 else {const accounts=new Map(source.accounts.map(a=>[a.id,a]));for(const e of source.entries.filter(e=>e.date===day&&!e.processorVoucher&&!e.processorPartnerId)){const finance=(e.lines||[]).filter(l=>['revenue','expense'].includes(accounts.get(l.accountId)?.type));if(!finance.length)continue;const profit=finance.reduce((n,l)=>n+(accounts.get(l.accountId)?.type==='revenue'?number(l.credit)-number(l.debit):number(l.credit)-number(l.debit)),0),doc=source.documents.find(d=>d.id===e.docId),id=e.sharedReturnId?'return:'+e.sharedReturnId:e.docId?'doc:'+e.docId:'entry:'+e.id;add(id,doc?.number||e.number||e.id,profit);}}
 const list=[...rows.values()].map(r=>({...r,profit:round(r.profit)}));return{scope,date:day,currency:source.currency||'IQD',basis,rows:list,total:round(list.reduce((n,r)=>n+r.profit,0)),unresolved};}
const bridge=()=>window.HA_DAILY_PROFIT_BRIDGE;function model(day){return build(bridge().snapshot(),day||bridge().today());}function currency(m){return m.currency==='IQD'?'د.ع':m.currency;}
function marketHtml(m,interactive){
 const amount=value=>fmt(value)+' '+esc(currency(m));
 const stats=row=>[['مبلغ البيع',amount(row.amount)],['صافي البيع',row.posted?amount(row.revenue):'—'],
  ['كلفة البضاعة',row.posted?amount(row.cost):'—'],['ربح الفاتورة',row.posted?amount(row.profit):'—']];
 const invoices=m.rows.map(row=>{
  const invoice=interactive?'<button type="button" class="btn secondary" data-day-profit-sale="'+esc(row.id)+'">'+esc(row.number)+'</button>':esc(row.number);
  return '<tr><td>'+invoice+'</td><td>'+esc(row.party)+'</td>'+stats(row).map(([,value])=>
   '<td dir="auto">'+value+'</td>').join('')+'</tr>';
 }).join('');
 const cards=m.rows.map(row=>'<article class="ha-market-profit-card"><header><button type="button" class="btn secondary" data-day-profit-sale="'+esc(row.id)+'" aria-label="فتح الفاتورة '+esc(row.number)+'">'+esc(row.number)+'</button><span>'+esc(row.party)+'</span></header><dl>'+
  stats(row).map(([label,value])=>'<div><dt>'+label+'</dt><dd dir="auto">'+value+'</dd></div>').join('')+'</dl></article>').join('');
 const table='<table><thead><tr><th>رقم الفاتورة</th><th>الزبون</th><th>مبلغ البيع</th><th>صافي البيع</th><th>كلفة البضاعة</th><th>ربح الفاتورة</th></tr></thead><tbody>'+invoices+'</tbody></table>';
 const sales=m.rows.length?(interactive?'<div class="ha-market-profit-table">'+table+'</div><div class="ha-market-profit-cards">'+cards+'</div>':table):'<p>ماكو فواتير بيع بهذا التاريخ.</p>';
 const others=m.otherRows.length?'<h3>الحركات الأخرى المؤثرة بالربح</h3><table><thead><tr><th>رقم الحركة</th><th>الأثر على الربح</th></tr></thead><tbody>'+m.otherRows.map(row=>'<tr><td>'+esc(row.number)+'</td><td dir="auto">'+amount(row.profit)+'</td></tr>').join('')+'</tbody></table>':'';
 return '<section class="ha-day-profit-sheet ha-market-profit-sheet" dir="rtl"><h2>فواتير البيع</h2><p>'+esc(bridge().date(m.date))+'</p>'+sales+
  (m.rows.some(row=>!row.posted)?'<p class="hint">الشرطة تعني أن الفاتورة ما إلها قيد ربح مرحّل بهذا التاريخ.</p>':'')+
  others+'<p class="ha-market-net"><strong>صافي اليوم</strong> <strong dir="auto">'+amount(m.total)+'</strong></p><p class="hint">'+esc(m.basis)+'</p></section>';
}
function html(m,interactive=false){if(m.market)return marketHtml(m,interactive);return `<section class="ha-day-profit-sheet" dir="rtl"><h2>كشف ربح اليوم</h2><p>${esc(bridge().date(m.date))}</p><table><thead><tr><th>رقم الوصل</th><th>الربح — ${esc(currency(m))}</th></tr></thead><tbody>${m.rows.map(r=>`<tr><td>${esc(r.number)}</td><td dir="ltr">${fmt(r.profit)}</td></tr>`).join('')||'<tr><td colspan="2">لا توجد حركة ربح مسجلة لهذا اليوم.</td></tr>'}</tbody><tfoot><tr><th>${m.unresolved.length?'مجموع القيم المعروفة':'صافي اليوم'}</th><th dir="ltr">${fmt(m.total)}</th></tr></tfoot></table>${m.unresolved.length?'<p>وصل يحتاج مراجعة سعر الصرف: '+m.unresolved.map(esc).join('، ')+'</p>':''}<p class="hint">${esc(m.basis)}</p></section>`;}
function show(day){if(!bridge()?.allowed())return;let date=day||bridge().today();const owner=bridge().key();bridge().modal('كشف ربح اليوم',`<div class="ha-day-profit-controls"><label>التاريخ <input type="date" id="haDayProfitDate" value="${date}" max="${bridge().today()}"></label><button type="button" class="btn secondary" data-day-profit-refresh>عرض</button><button type="button" class="btn secondary" data-day-profit-print>طباعة</button><button type="button" class="btn secondary" data-day-profit-pdf>حفظ PDF</button></div><div id="haDayProfitBody"></div>`);const root=document.querySelector('#modalBody'),body=root.querySelector('#haDayProfitBody'),input=root.querySelector('#haDayProfitDate');let current;function refresh(){if(owner!==bridge().key()||!bridge().allowed()){body.textContent='تغيّر الحساب. أعد فتح الكشف.';current=null;return;}date=input.value;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date>bridge().today()){body.textContent='اختر تاريخاً صحيحاً حتى اليوم.';current=null;return;}current=model(date);body.innerHTML=html(current,true);}body.onclick=event=>{
 const button=event.target.closest('[data-day-profit-sale]');
 if(!button||!current?.market||!bridge().allowed()||owner!==bridge().key())return;
 const selectedDate=current.date;
 bridge().openSale?.(button.dataset.dayProfitSale,()=>{if(owner===bridge().key())show(selectedDate);});
};root.querySelector('[data-day-profit-refresh]').onclick=refresh;input.closest('.ha-day-profit-controls').addEventListener('change',event=>{if(event.target===input||event.target.closest('.date-dmy-wrap')?.contains(input))refresh();});for(const [selector,mode]of [['[data-day-profit-print]','print'],['[data-day-profit-pdf]','pdf']])root.querySelector(selector).onclick=()=>{if(current&&owner===bridge().key())window.HABusinessPrint?.open('<style>body{font:14px Tahoma;direction:rtl;color:#173f5f}table{width:100%;border-collapse:collapse}td,th{border:1px solid #b7cad8;padding:10px;text-align:right}tfoot{background:#e7f6f1}.hint{font-size:11px;line-height:1.8}</style>'+html(current),'كشف ربح '+date,mode);};refresh();bridge().dates(root);}
let queued=false;function mount(root=document.getElementById('view')){if(!root||!bridge()?.allowed())return;const day=root.querySelector('#engineeringDailyDate')?.value||(bridge().scope()==='service'?root.querySelector('#serviceReportDate')?.value:'')||bridge().today();let data;const candidates=[...root.querySelectorAll('.stat .label,.personal-quick-main strong,.haym-card h3')];for(const label of candidates){if(!/(ربح|أرباح|خسارة|الصافي).*(اليوم|اليومي)/.test(label.textContent))continue;const card=label.closest('button')||label.closest('.stat,.personal-quick-card,.haym-card');if(!card)continue;card.dataset.haDailyProfit=day;if(card.tagName!=='BUTTON'){card.setAttribute('role','button');card.tabIndex=0;}const value=card.querySelector('.value,.personal-quick-value,.haym-value');if(value){data=data||model(day);const valueText=data.unresolved.length?'بحاجة لمراجعة':fmt(data.total)+' '+currency(data);if(value.textContent!==valueText)value.textContent=valueText;}}if(!root.querySelector('[data-ha-daily-profit-shortcut]')){const host=root.querySelector('.page-head,.haym-hero,.service-center .panel-head');if(host){const b=document.createElement('button');b.type='button';b.className='btn secondary small ha-daily-profit-shortcut';b.dataset.haDailyProfitShortcut='';b.dataset.haDailyProfit=day;b.textContent='كشف ربح اليوم';host.append(b);}}}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mount();});}
window.HADailyProfit={build,model,show,mount};if(typeof document!=='undefined'){const style=document.createElement('style');style.textContent='.ha-day-profit-sheet table{width:100%;border-collapse:collapse}.ha-day-profit-sheet th,.ha-day-profit-sheet td{border:1px solid #bfd1df;padding:10px;text-align:right}.ha-day-profit-sheet tfoot{background:#e4f5ee}.ha-day-profit-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px}.ha-day-profit-controls input{min-height:38px;padding:7px;border:1px solid #c3d4e1;border-radius:7px}.ha-daily-profit-shortcut{align-self:center;flex:none!important;white-space:nowrap}[data-ha-daily-profit]{cursor:pointer}.ha-day-profit-sheet .hint{line-height:1.8}@media print{.ha-day-profit-controls,.ha-daily-profit-shortcut{display:none!important}}';style.textContent+=`
 .ha-market-profit-table{overflow:auto}
 .ha-market-profit-cards{display:none}
 .ha-market-profit-sheet button[data-day-profit-sale]{overflow-wrap:anywhere;white-space:normal;min-height:36px}
 .ha-market-net{display:flex;justify-content:space-between;gap:12px;background:#e4f5ee;padding:12px;border-radius:8px}
 @media(max-width:700px){
  .ha-market-profit-table{display:none}
  .ha-market-profit-cards{display:grid;gap:8px}
  .ha-market-profit-card{border:1px solid #bfd1df;border-radius:10px;padding:10px}
  .ha-market-profit-card header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
  .ha-market-profit-card dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:8px 0 0}
  .ha-market-profit-card dl>div{background:#f2f6f9;border-radius:6px;padding:6px;overflow-wrap:anywhere}
  .ha-market-profit-card dt{font-size:11px;color:#42586b}
  .ha-market-profit-card dd{margin:0;font-weight:700}
 }`;document.head.append(style);document.addEventListener('click',e=>{const b=e.target.closest('[data-ha-daily-profit]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();show(b.dataset.haDailyProfit);},true);document.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key))return;const b=e.target.closest('[data-ha-daily-profit]');if(b){e.preventDefault();e.stopImmediatePropagation();show(b.dataset.haDailyProfit);}},true);const view=document.getElementById('view');if(view)new MutationObserver(schedule).observe(view,{childList:true,subtree:true});window.addEventListener('ha-accounting-auth-ready',schedule);schedule();}
})();
