(function(){'use strict';const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])),num=x=>Number.isFinite(Number(x))?Number(x):0;
const companyHeaderCSS=`
.ha-invoice-company {
  box-sizing:border-box;display:flex;align-items:center;flex:0 0 auto;gap:12px;
  width:100%;min-width:0;padding:9px 12px;margin:0 0 10px;
  border:1px solid #5f8697;background:#fff;color:#18384b;
  text-align:start;line-height:1.45;break-inside:avoid;
}
.ha-invoice-company img {width:56px;height:46px;flex:0 0 auto;object-fit:contain}
.ha-invoice-company-content {min-width:0;overflow-wrap:anywhere}
.ha-invoice-company-name {display:block;font-size:1.25em;line-height:1.25}
.ha-invoice-company-detail {font-size:.92em}
.ha-invoice-company-contacts {display:flex;flex-wrap:wrap;gap:0 12px}
@media (max-width:480px) {
  .ha-invoice-company {padding:7px 9px;gap:8px}
  .ha-invoice-company img {width:44px;height:40px}
}
`;
function companyHeader(company={}){
  const name=String(company.name||'').trim()||'شركتي';
  const subtitle=String(company.receiptTitle||'').trim();
  const address=String(company.address||'').trim();
  const phone=String(company.phone||'').trim();
  const email=String(company.email||'').trim();
  const registration=String(company.taxNumber||'').trim();
  const logo=company.logoData?`<img src="${esc(company.logoData)}" alt="شعار الشركة">`:'';
  const contacts=[
    phone&&`<span>الهاتف <bdi>${esc(phone)}</bdi></span>`,
    email&&`<span>البريد <bdi>${esc(email)}</bdi></span>`,
    registration&&`<span>رقم التسجيل <bdi>${esc(registration)}</bdi></span>`
  ].filter(Boolean).join('');
  return `<section class="ha-invoice-company" dir="rtl">${logo}
    <div class="ha-invoice-company-content">
      <strong class="ha-invoice-company-name">${esc(name)}</strong>
      ${subtitle&&subtitle!==name?`<div class="ha-invoice-company-detail">${esc(subtitle)}</div>`:''}
      ${address?`<div class="ha-invoice-company-detail">${esc(address)}</div>`:''}
      ${contacts?`<div class="ha-invoice-company-detail ha-invoice-company-contacts">${contacts}</div>`:''}
    </div>
  </section>`;
}
const voucherCSS=`
.ha-voucher {width:100%;max-width:100%;min-width:0;color:#18384b;overflow-wrap:anywhere}
.ha-voucher-head,.ha-voucher-field,.ha-voucher-amount,.ha-voucher-signatures{break-inside:avoid}
.ha-voucher-title {margin:0 0 8px;color:#18384b;font-size:1.55em}
#modal .ha-voucher-title {display:none}
.ha-voucher-meta,.ha-voucher-fields {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:0 0 8px}
.ha-voucher-field,.ha-voucher-amount {min-width:0;border:1px solid #b9cbd4;padding:8px 10px}
.ha-voucher-label {display:block;color:#405e6d;font-size:.9em}
.ha-voucher-amount {margin:0 0 8px;border-color:#437f70;background:#f1f8f5}
.ha-voucher[data-kind="payment"] .ha-voucher-amount {border-color:#6d8296;background:#f0f5f9}
.ha-voucher-amount-value {display:block;font-size:1.6em;line-height:1.35}
.ha-voucher-words {display:block;margin-top:3px}
.ha-voucher-memo {white-space:pre-wrap;margin:0}
.ha-voucher-ledger {margin-top:12px}
.ha-voucher-ledger h3 {margin:0 0 5px;font-size:1.1em}
.ha-voucher-ledger table {width:100%;border-collapse:collapse;table-layout:fixed}
.ha-voucher-ledger td,.ha-voucher-ledger th {border:1px solid #b9cbd4;padding:6px;text-align:start}
.ha-voucher-signatures {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:32px}
.ha-voucher-signatures span {padding-top:6px;border-top:1px solid #849eab;text-align:center}
body[data-ha-paper="58"] .ha-voucher,body[data-ha-paper="80"] .ha-voucher {color:#000}
:is(body[data-ha-paper="58"],body[data-ha-paper="80"]) .ha-voucher .ha-invoice-company{padding:5px;gap:6px;color:#000;border-color:#000}
:is(body[data-ha-paper="58"],body[data-ha-paper="80"]) .ha-voucher .ha-invoice-company img{width:34px;height:33px}
:is(body[data-ha-paper="58"],body[data-ha-paper="80"]) .ha-voucher :is(.ha-voucher-meta,.ha-voucher-fields){grid-template-columns:1fr;gap:4px}
:is(body[data-ha-paper="58"],body[data-ha-paper="80"]) .ha-voucher :is(.ha-voucher-field,.ha-voucher-amount){padding:4px 5px;background:#fff;color:#000}
:is(body[data-ha-paper="58"],body[data-ha-paper="80"]) .ha-voucher .ha-voucher-signatures{grid-template-columns:1fr;gap:16px;margin-top:20px}
`;
function voucherMoney(value,currency='د.ع'){
  const unit=currency==='IQD'?'د.ع':currency;
  return new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(num(value))+' '+unit;
}
function voucherWords(value,currency){
  if(!['IQD','د.ع'].includes(currency)||num(value)<0)return '';
  const cents=Math.round(num(value)*100);
  return 'فقط '+words(Math.floor(cents/100))+' دينار عراقي'+(cents%100?' و'+words(cents%100)+' جزء من مائة دينار':'')+' لا غير';
}
function voucherBody(model){
  const {company,title,kind,number,date,amount,currency='د.ع',fields=[],memo,
    ledger=[],returnSummary,editHistory,signatures=[]}=model;
  const field=(label,value)=>`<div class="ha-voucher-field"><span class="ha-voucher-label">${esc(label)}</span><bdi>${esc(value||'—')}</bdi></div>`;
  const amountText=voucherWords(amount,currency);
  return `<article class="ha-voucher" dir="rtl" data-kind="${esc(kind)}">
    <header class="ha-voucher-head">
      ${companyHeader(company)}
      <h2 class="ha-voucher-title">${esc(title)}</h2>
      <div class="ha-voucher-meta">${field('رقم السند',number)}${field('التاريخ',date)}</div>
    </header>
    <div class="ha-voucher-amount"><span class="ha-voucher-label">المبلغ</span>
      <strong class="ha-voucher-amount-value"><bdi>${esc(voucherMoney(amount,currency))}</bdi></strong>
      ${amountText?`<span class="ha-voucher-words">${esc(amountText)}</span>`:''}
    </div>
    ${fields.length?`<div class="ha-voucher-fields">${fields.map(([key,value])=>field(key,value)).join('')}</div>`:''}
    <section class="ha-voucher-field"><span class="ha-voucher-label">البيان</span><p class="ha-voucher-memo">${esc(memo||'—')}</p></section>
    ${renderReturns(returnSummary)}${renderEdits(editHistory)}
    ${ledger.length?`<section class="ha-voucher-ledger"><h3>القيد المحاسبي</h3><table>
      <thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead>
      <tbody>${ledger.map(row=>`<tr><td>${esc(row.account)}</td><td><bdi>${esc(voucherMoney(row.debit,currency))}</bdi></td><td><bdi>${esc(voucherMoney(row.credit,currency))}</bdi></td></tr>`).join('')}</tbody>
    </table></section>`:''}
    ${signatures.length?`<div class="ha-voucher-signatures">${signatures.map(label=>`<span>${esc(label)}</span>`).join('')}</div>`:''}
  </article>`;
}
function renderVoucher(model){
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
  <title>${esc(model.title)} ${esc(model.number)}</title><style>
  *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}body{font:14px/1.55 Tahoma,Arial,sans-serif}
  ${companyHeaderCSS}${voucherCSS}
  </style></head><body data-ha-paper="A4">${voucherBody(model)}</body></html>`;
}
const headerFields=[
  ['name','اسم الشركة',120],['receiptTitle','عنوان الشركة أو النشاط',120],['address','العنوان',220],
  ['phone','الهاتف',80],['email','البريد الإلكتروني',120],['taxNumber','رقم التسجيل',80]
];
const headerEditorCSS=`
.ha-document-header{margin:0 0 9px;min-width:0}
.ha-document-header details{padding:6px 9px;border:1px solid #b9cbd4;background:#fff;color:#18384b}
.ha-document-header summary{cursor:pointer;font-weight:700;font-size:.88rem}
.ha-document-header-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:9px 0}
.ha-document-header-fields label{display:grid;gap:4px;min-width:0;font-size:.85rem}
.ha-document-header-fields input{width:100%;min-width:0}
.ha-document-header-controls{display:flex;flex-wrap:wrap;align-items:center;gap:7px}
.ha-document-header-status{color:#405e6d;font-size:.82rem;margin:5px 0 0}
.ha-document-header-preview>.ha-invoice-company{margin-bottom:5px}
@media(max-width:620px){.ha-document-header-fields{grid-template-columns:1fr}}
#modal.hpw-invoice-dialog .ha-document-header details[open]{max-height:32vh;overflow:auto}
`;
function cleanHeaderOverride(candidate){
  if(!candidate||typeof candidate!=='object')return {};
  const valid={};
  for(const [key,,limit] of headerFields){
    if(typeof candidate[key]==='string')valid[key]=candidate[key].trim().slice(0,limit);
  }
  const logo=candidate.logoData;
  if(typeof logo==='string'&&(logo===''||logo.length<=380000&&/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(logo)))valid.logoData=logo;
  return valid;
}
function companyForDocument(company,record){
  return {...company,...cleanHeaderOverride(record?.companyHeaderOverride)};
}
function documentHeaderEditor(company,formId,record,expanded=false){
  const base=Object.fromEntries(headerFields.map(([key])=>[key,String(company?.[key]||'').trim()]));
  base.logoData=String(company?.logoData||'');
  const override=cleanHeaderOverride(record?.companyHeaderOverride),current={...base,...override};
  return `<div class="ha-document-header" data-ha-header-base="${esc(JSON.stringify(base))}">
    <div class="ha-document-header-preview">${companyHeader(current)}</div>
    <details${expanded?' open':''}><summary>تعديل ترويسة هذا المستند</summary>
      <div class="ha-document-header-fields">${headerFields.map(([key,label,limit])=>
        `<label>${label}<input type="text" data-ha-header-field="${key}" maxlength="${limit}" value="${esc(current[key])}"${['phone','email','taxNumber'].includes(key)?' dir="auto"':''}></label>`).join('')}
        <label>شعار هذا المستند<input type="file" data-ha-header-file accept="image/*"></label>
      </div>
      <div class="ha-document-header-controls">
        <button type="button" class="btn secondary small" data-ha-header-remove-logo>إزالة الشعار من هذا المستند</button>
        <button type="button" class="btn secondary small" data-ha-header-reset>استخدام بيانات الشركة الافتراضية</button>
      </div>
      <p class="ha-document-header-status" role="status">التغييرات تخص هذا المستند وتُحفظ عند الحفظ.</p>
    </details>
    <input type="hidden" name="haDocumentHeaderOverride" form="${esc(formId)}" value="${esc(JSON.stringify(override))}">
  </div>`;
}
function readDocumentHeader(form){
  const input=form?.elements?.namedItem('haDocumentHeaderOverride');
  if(!input)return {};
  try{return cleanHeaderOverride(JSON.parse(input.value));}catch{return {};}
}
function setDocumentHeader(record,override){
  const valid=cleanHeaderOverride(override);
  if(Object.keys(valid).length)record.companyHeaderOverride=valid;
  else delete record.companyHeaderOverride;
  return record;
}
function updateHeader(editor,logo,reset=false){
  const base=JSON.parse(editor.dataset.haHeaderBase);
  const output=editor.querySelector('[name=haDocumentHeaderOverride]');
  const previous=JSON.parse(output.value);
  const changed={};
  for(const field of editor.querySelectorAll('[data-ha-header-field]')){
    const key=field.dataset.haHeaderField;
    if(reset)field.value=base[key];
    const value=field.value.trim();
    if(value!==base[key])changed[key]=value;
  }
  if(!reset&&logo!==undefined&&logo!==base.logoData)changed.logoData=logo;
  if(!reset&&logo===undefined&&Object.prototype.hasOwnProperty.call(previous,'logoData'))changed.logoData=previous.logoData;
  output.value=JSON.stringify(cleanHeaderOverride(changed));
  editor.querySelector('.ha-document-header-preview').innerHTML=companyHeader({...base,...changed});
}
const logoConversions=new WeakMap();
document.addEventListener('input',event=>{
  if(!event.target.matches?.('[data-ha-header-field]'))return;
  updateHeader(event.target.closest('.ha-document-header'));
});
document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-ha-header-reset],[data-ha-header-remove-logo]');
  if(!button)return;
  const editor=button.closest('.ha-document-header'),reset=button.hasAttribute('data-ha-header-reset');
  logoConversions.delete(editor);
  editor.querySelector('[data-ha-header-file]').value='';
  updateHeader(editor,'',reset);
  editor.querySelector('.ha-document-header-status').textContent=reset?'تم اختيار البيانات الافتراضية. احفظ المستند لتثبيت التغيير.':'تمت إزالة الشعار من هذا المستند. احفظ المستند لتثبيت التغيير.';
});
document.addEventListener('change',async event=>{
  const input=event.target;
  if(!input.matches?.('[data-ha-header-file]')||!input.files?.[0])return;
  const editor=input.closest('.ha-document-header'),status=editor.querySelector('.ha-document-header-status'),selection={};
  logoConversions.set(editor,selection);
  status.textContent='جارٍ تجهيز الشعار…';
  const url=URL.createObjectURL(input.files[0]);
  try{
    const image=new Image();
    image.src=url;
    await image.decode();
    if(logoConversions.get(editor)!==selection)return;
    const scale=Math.min(1,420/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    updateHeader(editor,canvas.toDataURL('image/jpeg',.9));
    status.textContent='تم تجهيز الشعار. احفظ المستند لتثبيت التغيير.';
  }catch{
    if(logoConversions.get(editor)===selection)status.textContent='تعذر فتح الصورة. اختر ملف صورة صالحاً.';
  }finally{
    URL.revokeObjectURL(url);
    if(logoConversions.get(editor)===selection)logoConversions.delete(editor);
  }
});
document.addEventListener('submit',event=>{
  const output=event.target.elements?.namedItem('haDocumentHeaderOverride'),editor=output?.closest('.ha-document-header');
  if(editor&&logoConversions.has(editor)){
    event.preventDefault();
    event.stopImmediatePropagation();
    editor.querySelector('.ha-document-header-status').textContent='انتظر تجهيز الشعار قبل الحفظ.';
  }
},true);
const screenHeaderStyle=document.createElement('style');
screenHeaderStyle.textContent=companyHeaderCSS+voucherCSS+headerEditorCSS+`
@media (min-width:1000px) and (min-height:580px) {
  #modal.hpw-invoice-dialog :is(.ha-invoice-company,.ha-document-header) ~ .hpw-invoice {overflow-y:auto!important}
}
`;
document.head.append(screenHeaderStyle);
function words(value){const n=Math.floor(Math.abs(num(value))),u=['','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'],t=['','','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'],h=['','مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'];function group(x){let a=[];if(x>=100){a.push(h[Math.floor(x/100)]);x%=100;}if(x<20){if(x)a.push(u[x]);}else a.push((x%10?u[x%10]+' و':'')+t[Math.floor(x/10)]);return a.join(' و');}if(!n)return'صفر';if(n>=1e12)return String(n);const a=[];for(const [base,one,two,many]of [[1e9,'مليار','ملياران','مليارات'],[1e6,'مليون','مليونان','ملايين'],[1000,'ألف','ألفان','آلاف']]){const x=Math.floor(n/base)%1000;if(x)a.push(x===1?one:x===2?two:group(x)+' '+(x<=10?many:one));}if(n%1000)a.push(group(n%1000));return a.join(' و');}
function renderReturns(summary,options={}){if(!summary?.records?.length)return '';const s=summary,currency=s.currency||'IQD',unit=currency==='IQD'?'د.ع':currency==='USD'?'$':currency,fmt=(n,digits=2)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(num(n))+' '+unit,voucher=s.kind==='voucher';return `<section class="ha-return-summary" style="margin:14px 0;padding:10px;border:1px solid #777;color:#111;font-family:Tahoma,Arial,sans-serif;overflow-wrap:anywhere"><style>.ha-return-thermal{display:none}body[data-ha-paper="58"] .ha-return-lines,body[data-ha-paper="80"] .ha-return-lines{display:none!important}body[data-ha-paper="58"] .ha-return-thermal,body[data-ha-paper="80"] .ha-return-thermal{display:table!important;width:100%;border-collapse:collapse;font-size:11px}.ha-return-thermal td,.ha-return-thermal th{border:1px solid #777;padding:5px;color:#000;overflow-wrap:anywhere}.ha-return-summary tr{break-inside:avoid}</style><h3 style="margin:0 0 8px;font-size:14px">${voucher?'بيان إرجاع السند':'بيان المرتجعات والمواد المرتجعة'}</h3><p style="margin:4px 0">الأصل: ${esc(s.sourceLabel||'المستند')} · <b>${esc(s.sourceNumber||'—')}</b>${s.through?' · حتى '+esc(s.through):''}</p>${options.showTotals===false?'':`<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:12px"><tbody><tr><th style="border:1px solid #999;padding:6px;text-align:right">${voucher?'مبلغ السند الأصلي':'إجمالي الوصل قبل الترجيع'}</th><td style="border:1px solid #999;padding:6px" dir="ltr">${fmt(s.original)}</td></tr><tr><th style="border:1px solid #999;padding:6px;text-align:right">${voucher?'إجمالي المبلغ المرتجع':'إجمالي قيمة المرتجع'}</th><td style="border:1px solid #999;padding:6px" dir="ltr">${fmt(s.returned)}</td></tr><tr><th style="border:1px solid #999;padding:6px;text-align:right">${voucher?'صافي السند بعد الإرجاع':'الإجمالي بعد الترجيع'}</th><td style="border:1px solid #999;padding:6px;font-weight:bold" dir="ltr">${fmt(s.net)}</td></tr></tbody></table>`}${s.records.map(r=>`<div style="margin-top:10px;border-top:1px solid #bbb;padding-top:7px"><b>${voucher?'إرجاع سند':'مرتجع'} ${esc(r.number||'—')}</b> · ${esc(r.dateLabel||r.date||'')} ${r.items?.length?`<table class="ha-return-lines" style="width:100%;border-collapse:collapse;margin-top:6px;table-layout:fixed;font-size:11px"><thead><tr><th style="border:1px solid #999;padding:5px;width:40%;text-align:right">المادة المرتجعة</th><th style="border:1px solid #999;padding:5px">الكمية / الوحدة</th><th style="border:1px solid #999;padding:5px">سعر الوحدة بالأصل</th><th style="border:1px solid #999;padding:5px">قيمة المرتجع</th></tr></thead><tbody>${r.items.map(i=>`<tr><td style="border:1px solid #999;padding:5px;overflow-wrap:anywhere">${esc(i.name)}</td><td style="border:1px solid #999;padding:5px">${num(i.qty)} ${esc(i.unit||'')}</td><td style="border:1px solid #999;padding:5px" dir="ltr">${fmt(i.price,4)}</td><td style="border:1px solid #999;padding:5px" dir="ltr">${fmt(i.total)}</td></tr>`).join('')}</tbody></table><table class="ha-return-thermal"><thead><tr><th>الكمية / الوحدة</th><th>سعر الأصل</th><th>قيمة المرتجع</th></tr></thead><tbody>${r.items.map(i=>`<tr><td colspan="3"><b>${esc(i.name)}</b></td></tr><tr><td>${num(i.qty)} ${esc(i.unit||'')}</td><td dir="ltr">${fmt(i.price,4)}</td><td dir="ltr">${fmt(i.total)}</td></tr>`).join('')}</tbody></table><small>قيمة المرتجع تشمل حصة المادة من خصم وضريبة الأصل.</small>`:voucher?'<p style="margin:5px 0">عكس مبلغ سند؛ لا توجد مواد.</p>':''}${num(r.delivery)?`<p style="margin:5px 0">توصيل مرتجع: ${fmt(r.delivery)}</p>`:''}<p style="margin:6px 0"><b>${voucher?'مبلغ الإرجاع':'إجمالي هذا المرتجع'}: ${fmt(r.amount)}</b> · ${voucher?'صافي الأصل بعده':'قيمة الأصل بعده'}: ${fmt(r.netAfter)}</p>${r.note?`<p style="margin:5px 0;white-space:pre-wrap">الملاحظات: ${esc(r.note)}</p>`:''}</div>`).join('')}<p style="font-size:10px;margin:8px 0 0">تفاصيل مرتبطة بالأصل للبيان.</p></section>`;}
function expiryLabel(value){const text=String(value||'');return /^\d{4}-\d{2}-\d{2}$/.test(text)?text.slice(8,10)+'/'+text.slice(5,7)+'/'+text.slice(0,4):text;}
function renderEdits(history){if(!Array.isArray(history)||!history.length)return '';return `<section class="ha-voucher-edit-history" style="margin:12px 0;padding:10px;border:1px solid #8c9ca6;color:#111;overflow-wrap:anywhere"><h3 style="font-size:14px;margin:0 0 8px">سجل التعديلات — للبيان فقط</h3><p style="font-size:11px;margin:0 0 8px">التغييرات التالية لا تُجمع مرة ثانية ضمن مبالغ الكشف.</p>${history.map(h=>{const time=new Date(h.at),stamp=Number.isFinite(time.getTime())?time.toLocaleString('en-GB',{timeZone:'Asia/Baghdad',hour12:false}):h.at||h.date||'';return `<div style="margin-top:10px;break-inside:avoid"><b>${esc(h.title||'تعديل السند')}</b><small style="display:block">${esc(stamp)} · بتوقيت بغداد</small><table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:11px"><thead><tr><th style="border:1px solid #aaa;padding:5px">الحقل</th><th style="border:1px solid #aaa;padding:5px">قبل التعديل</th><th style="border:1px solid #aaa;padding:5px">بعد التعديل</th></tr></thead><tbody>${(h.changes||[]).map(change=>`<tr><td style="border:1px solid #aaa;padding:5px">${esc(change.label)}</td><td style="border:1px solid #aaa;padding:5px;white-space:pre-wrap">${esc(change.label==='التاريخ'?expiryLabel(change.before)||'—':change.before||'—')}</td><td style="border:1px solid #aaa;padding:5px;white-space:pre-wrap">${esc(change.label==='التاريخ'?expiryLabel(change.after)||'—':change.after||'—')}</td></tr>`).join('')}</tbody></table></div>`;}).join('')}</section>`;}
function legacyCompanyBrand(company){return `<div class="invoice-brand">${company.logoData?`<img src="${esc(company.logoData)}" alt="شعار الشركة">`:''}<div><h1>${esc(company.name||'شركتي')}</h1><div class="company-details">${esc([company.phone,company.email,company.address,company.taxNumber?'رقم التسجيل: '+company.taxNumber:''].filter(Boolean).join('\n'))}</div></div></div>`;}
function thermalInvoiceItems(items,format){
  const field=(label,value)=>`<div class="thermal-item-field"><dt>${label}</dt><dd>${value}</dd></div>`;
  const rows=items.map((item,index)=>{
    const quantity=`<bdi>${format(item.qty,3)}</bdi>${item.unit?`<small>${esc(item.unit)}</small>`:''}`;
    const price=`<bdi>${format(item.price,4)}</bdi>`;
    const total=`<bdi>${format(item.total??num(item.qty)*num(item.price))}</bdi>`;
    return `<li class="thermal-invoice-item ha-paper-record">
      <div class="thermal-item-name"><span class="thermal-item-number">${index+1}</span><b>${esc(item.name||'—')}</b></div>
      ${item.expiryDate?`<small class="thermal-item-expiry">انتهاء الصلاحية <bdi>${esc(expiryLabel(item.expiryDate))}</bdi></small>`:''}
      <dl class="thermal-item-fields">${field('الكمية',quantity)}${field('سعر الوحدة',price)}${field('الإجمالي',total)}</dl>
    </li>`;
  }).join('');
  return `<section class="thermal-invoice-list" aria-label="أصناف الفاتورة">
    <h3>الأصناف</h3>${rows?`<ol class="thermal-invoice-items">${rows}</ol>`:'<p>لا توجد أصناف</p>'}
  </section>`;
}
function thermalInvoiceMeta(model){
  const fields=[['التاريخ',model.date||'—'],['الدفع',model.paymentMode||'—'],
    [model.partyLabel||'الجهة',model.party||'—'],['الهاتف',model.phone],
    ['العنوان',model.address],['المندوب',model.representative]];
  return `<section class="thermal-meta"><dl class="thermal-meta-fields">${fields.filter(([,value])=>value).map(([label,value])=>
    `<div><dt>${esc(label)}</dt><dd><bdi>${esc(value)}</bdi></dd></div>`).join('')}</dl></section>`;
}
function render(model){const m=model||{},company=m.company||{},currency=m.currency||'IQD',currencyText=currency==='IQD'?'د.ع':currency==='USD'?'$':currency,fmt=(x,d=2)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:d}).format(num(x)),money=x=>fmt(x)+' '+currencyText,items=m.items||[],originalTotal=num(m.total),total=m.returnSummary?num(m.returnSummary.net):originalTotal,fraction=Math.round((Math.abs(total)%1)*100),amountWords=(total<0?'سالب ':'')+words(total)+(fraction?' و '+fraction+'/100':'')+' '+(currency==='IQD'?'دينار عراقي':currency==='USD'?'دولار أمريكي':currencyText),title=m.title||'فاتورة',rows=items.map((i,index)=>`<tr><td>${index+1}</td><td class="item-description">${esc(i.name)}${i.expiryDate?`<small style="display:block;font-size:11px">انتهاء الصلاحية: ${esc(expiryLabel(i.expiryDate))}</small>`:''}</td><td>${esc(i.unit||'—')}</td><td dir="ltr">${fmt(i.qty,3)}</td><td dir="ltr">${fmt(i.price,4)}</td><td dir="ltr">${fmt(i.total??num(i.qty)*num(i.price))}</td></tr>`).join('');const sum=(label,value,cls='')=>`<tr class="${cls}"><th>${label}</th><td dir="ltr">${money(value)}</td></tr>`,extra=(m.extra||[]).map(e=>`<p><b>${esc(e.label)}:</b> ${esc(e.value)}</p>`).join('');return`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)} ${esc(m.number)}</title><style>
*{box-sizing:border-box}html,body{margin:0;padding:0;background:white;color:#101820;font-family:Tahoma,Arial,sans-serif;font-size:12px;line-height:1.6}body{width:100%}.invoice-shell{width:100%;max-width:100%;margin:0 auto}.invoice-header{display:flex;justify-content:space-between;align-items:center;gap:18px;border-bottom:2px solid #17384d;padding:0 0 12px;margin-bottom:16px}.invoice-brand{display:flex;align-items:center;gap:12px;min-width:0}.invoice-brand img{width:88px;height:70px;object-fit:contain}.invoice-brand h1{font-size:23px;margin:0;color:#155e88}.company-details{font-size:11px;white-space:pre-line}.invoice-heading{text-align:left;flex-shrink:0}.invoice-heading h2{font-size:25px;color:#176c9d;margin:0}.invoice-heading b{font-size:13px}.invoice-meta{width:100%;border-collapse:collapse;margin:8px 0 18px;table-layout:fixed}.invoice-meta th,.invoice-meta td{padding:5px;text-align:right;border:0!important;overflow-wrap:anywhere}.invoice-meta th{width:15%;font-size:11px}.invoice-meta td{width:35%}.invoice-lines{width:100%;border-collapse:collapse;table-layout:fixed;margin:12px 0 0}.invoice-lines th,.invoice-lines td{border:1px solid #516a7e;padding:6px 7px;text-align:center;vertical-align:top;overflow-wrap:anywhere}.invoice-lines th{background:#176c9d;color:white;font-weight:bold}.invoice-lines .item-description{text-align:right;font-weight:500}.invoice-lines tr{break-inside:avoid}.invoice-summary{width:47%;margin:0 0 0 auto;border-collapse:collapse;table-layout:fixed}.invoice-summary th,.invoice-summary td{border:1px solid #516a7e;padding:5px 8px;text-align:right;overflow-wrap:anywhere}.invoice-summary td{text-align:left;font-weight:bold}.invoice-summary .grand{font-size:14px;background:#edf6fc}.invoice-words{border:1px solid #516a7e;padding:7px 9px;margin:12px 0;overflow-wrap:anywhere}.invoice-account{margin:12px 0;border:1px solid #516a7e;padding:8px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-weight:bold}.invoice-notes{white-space:pre-wrap;overflow-wrap:anywhere;margin:16px 0;padding:10px;border:1px solid #b5c5d1;break-inside:avoid}.invoice-extras p{margin:4px 0;overflow-wrap:anywhere}.invoice-signatures{display:flex;justify-content:space-between;gap:20px;margin-top:24px;break-inside:avoid}.invoice-signatures span{width:30%;text-align:center;border-top:1px solid #627789;padding-top:8px}.invoice-footer{border-top:1px solid #a8bbc9;font-size:10px;margin-top:14px;padding-top:8px;white-space:pre-line}.invoice-plan{width:100%;border-collapse:collapse;margin-top:15px}.invoice-plan th,.invoice-plan td{border:1px solid #a5b5c1;padding:5px;text-align:right}.thermal-only,.thermal-meta{display:none}.invoice-terms{white-space:pre-wrap;font-size:10px;margin-top:14px}.invoice-unit-note{font-size:10px}.invoice-header,.invoice-account,.invoice-words{break-inside:avoid}
body[data-ha-paper="80"],body[data-ha-paper="58"]{font-size:12px!important;color:#000!important;line-height:1.55}body[data-ha-paper="80"] .a4-only,body[data-ha-paper="58"] .a4-only{display:none!important}body[data-ha-paper="80"] .thermal-meta,body[data-ha-paper="58"] .thermal-meta{display:block;margin:8px 0;line-height:1.65;font-size:12px;overflow-wrap:anywhere}body[data-ha-paper="80"] .invoice-header,body[data-ha-paper="58"] .invoice-header{display:block;text-align:center;margin-bottom:8px;padding-bottom:8px;border-color:#000}body[data-ha-paper="80"] .invoice-brand,body[data-ha-paper="58"] .invoice-brand{display:block;text-align:center}body[data-ha-paper="80"] .invoice-brand img,body[data-ha-paper="58"] .invoice-brand img{width:60px;height:48px}body[data-ha-paper="80"] h1,body[data-ha-paper="58"] h1{font-size:18px;color:#000}body[data-ha-paper="80"] .invoice-heading,body[data-ha-paper="58"] .invoice-heading{text-align:center}body[data-ha-paper="80"] .invoice-heading h2,body[data-ha-paper="58"] .invoice-heading h2{font-size:17px;color:#000}body[data-ha-paper="80"] .invoice-meta,body[data-ha-paper="58"] .invoice-meta{margin:5px 0;table-layout:auto}body[data-ha-paper="80"] .invoice-meta th,body[data-ha-paper="80"] .invoice-meta td,body[data-ha-paper="58"] .invoice-meta th,body[data-ha-paper="58"] .invoice-meta td{font-size:11px;padding:3px!important;width:auto}body[data-ha-paper="80"] .invoice-meta tr,body[data-ha-paper="58"] .invoice-meta tr{display:flex;flex-wrap:wrap}body[data-ha-paper="80"] .invoice-meta th,body[data-ha-paper="58"] .invoice-meta th{width:30%}body[data-ha-paper="80"] .invoice-meta td,body[data-ha-paper="58"] .invoice-meta td{width:70%}body[data-ha-paper="80"] .invoice-summary,body[data-ha-paper="58"] .invoice-summary{width:100%;margin:8px 0}body[data-ha-paper="80"] .invoice-summary th,body[data-ha-paper="80"] .invoice-summary td,body[data-ha-paper="58"] .invoice-summary th,body[data-ha-paper="58"] .invoice-summary td{padding:5px 3px!important;font-size:12px!important;color:#000;border-color:#000}body[data-ha-paper="80"] .invoice-account,body[data-ha-paper="58"] .invoice-account{display:block;font-size:12px;color:#000}body[data-ha-paper="80"] .invoice-words,body[data-ha-paper="58"] .invoice-words{font-size:11px}body[data-ha-paper="80"] .invoice-signatures,body[data-ha-paper="58"] .invoice-signatures{margin-top:24px;gap:5px;font-size:9px}body[data-ha-paper="80"] .invoice-notes,body[data-ha-paper="58"] .invoice-notes{padding:6px;font-size:12px}body[data-ha-paper="58"] .company-details{font-size:10px}body[data-ha-paper="80"] .invoice-summary th,body[data-ha-paper="80"] .invoice-summary td,body[data-ha-paper="58"] .invoice-summary th,body[data-ha-paper="58"] .invoice-summary td{border-color:#000!important;color:#000!important}body[data-ha-paper="80"] .zero-total,body[data-ha-paper="58"] .zero-total{display:none}body[data-ha-paper="80"] .grand,body[data-ha-paper="58"] .grand{background:#fff!important;font-weight:800}@page{size:A4;margin:12mm}@media print{thead{display:table-header-group}.invoice-plan thead{display:table-row-group}body{padding:0!important}}

.thermal-invoice-list{display:none}
:is(body[data-ha-paper="58"],body[data-ha-paper="80"]) .thermal-invoice-list{display:block;margin:9px 0 6px;color:#000}
body[data-ha-paper="58"]{--thermal-label-size:11px;--thermal-value-size:12px;--thermal-product-size:13px}
body[data-ha-paper="80"]{--thermal-label-size:12px;--thermal-value-size:14px;--thermal-product-size:15px}
.thermal-invoice-list>h3{font-size:var(--thermal-product-size,13px);margin:0 0 5px;color:#000}
.thermal-invoice-items{list-style:none;margin:0;padding:0}
.thermal-invoice-items>.thermal-invoice-item{
  border:1px solid #000;padding:0;margin:0 0 6px;min-width:0;break-inside:avoid
}
.thermal-item-name{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:5px;padding:4px;overflow-wrap:anywhere;line-height:1.3;font-size:var(--thermal-product-size,13px);color:#000}
.thermal-item-number{min-width:17px;text-align:center;border:1px solid #000;font-size:var(--thermal-label-size,11px);line-height:1.35}
.thermal-item-expiry{display:block;margin:0;padding:0 4px 3px;color:#000;font-size:var(--thermal-label-size,11px)}
.thermal-item-fields{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.12fr) minmax(0,1.12fr);margin:0;border-top:1px solid #000}
.thermal-item-field{padding:3px;min-width:0}
.thermal-item-field+.thermal-item-field{border-inline-start:1px solid #000}
.thermal-item-field dt{font-size:var(--thermal-label-size,11px);font-weight:700;line-height:1.25;color:#000}
.thermal-item-field dd{font-weight:700;font-size:var(--thermal-value-size,12px);font-variant-numeric:tabular-nums;line-height:1.3;margin:2px 0 0;overflow-wrap:anywhere;color:#000}
.thermal-item-field dd small{display:block;font-size:var(--thermal-label-size,11px);font-weight:400;line-height:1.3;color:#000}
.thermal-meta .thermal-meta-fields{margin:0;border:1px solid #000;color:#000}
.thermal-meta-fields>div{display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1.65fr);padding:2px 4px;gap:5px}
.thermal-meta-fields>div+div{border-top:1px solid #000}
.thermal-meta-fields dt{font-weight:700}
.thermal-meta-fields dd{margin:0;overflow-wrap:anywhere}

${companyHeaderCSS}
.invoice-header.invoice-header-branded {display:block;border:0;padding:0}
.invoice-header-branded .ha-invoice-company {padding:12px 14px;gap:14px;border-color:#243f4f}
.invoice-header-branded .ha-invoice-company img {width:84px;height:62px}
.invoice-header-branded .ha-invoice-company-name {font-size:20px}
.invoice-header-branded .invoice-heading {text-align:right}
:is(body[data-ha-paper="58"],body[data-ha-paper="80"]) .invoice-header-branded .ha-invoice-company {
  padding:5px;gap:6px;color:#000;border-color:#000
}
:is(body[data-ha-paper="58"],body[data-ha-paper="80"]) .invoice-header-branded .ha-invoice-company img {
  width:34px;height:33px
}
:is(body[data-ha-paper="58"],body[data-ha-paper="80"]) .invoice-header-branded .ha-invoice-company-name {font-size:14px}
</style></head><body data-ha-paper="A4"><main class="invoice-shell"><header class="invoice-header${m.companyBanner?' invoice-header-branded':''}">${m.companyBanner?companyHeader(company):legacyCompanyBrand(company)}<div class="invoice-heading"><h2>${esc(title)}</h2><b dir="ltr">${esc(m.number)}</b></div></header><table class="invoice-meta a4-only"><tbody><tr><th>نوع الدفع</th><td>${esc(m.paymentMode||'—')}</td><th>التاريخ</th><td>${esc(m.date||'—')}</td></tr><tr><th>${m.partyLabel||'الجهة'}</th><td>${esc(m.party||'—')}</td><th>الهاتف</th><td>${esc(m.phone||'—')}</td></tr>${m.address?`<tr><th>العنوان</th><td colspan="3">${esc(m.address)}</td></tr>`:''}${m.representative?`<tr><th>المندوب</th><td colspan="3">${esc(m.representative)}</td></tr>`:''}</tbody></table>${thermalInvoiceMeta(m)}<table class="invoice-lines a4-only"><colgroup><col style="width:5%"><col style="width:39%"><col style="width:10%"><col style="width:10%"><col style="width:18%"><col style="width:18%"></colgroup><thead><tr><th>#</th><th>اسم المادة / الخدمة</th><th>الوحدة</th><th>الكمية</th><th>سعر الوحدة</th><th>المجموع</th></tr></thead><tbody>${rows||'<tr><td colspan="6">لا توجد مواد</td></tr>'}</tbody></table>${thermalInvoiceItems(items,fmt)}<p class="invoice-unit-note">الأسعار بعملة ${esc(currencyText)}</p><table class="invoice-summary"><tbody>${sum('مجموع المواد',m.subtotal??items.reduce((n,i)=>n+num(i.total??num(i.qty)*num(i.price)),0))}${sum('الخصم',m.discount,'optional-total'+(num(m.discount)?'':' zero-total'))}${sum('الضريبة',m.tax,'optional-total'+(num(m.tax)?'':' zero-total'))}${sum(m.deliverySeparate?'التوصيل — خارج إجمالي الأصل':'التوصيل',m.delivery,'optional-total'+(num(m.delivery)?'':' zero-total'))}${m.returnSummary?sum('إجمالي الوصل قبل الترجيع',originalTotal)+sum('إجمالي قيمة المرتجع',m.returnSummary.returned)+sum('الإجمالي بعد الترجيع',total,'grand'):sum('الصافي',total,'grand')}${m.paid!==null&&m.paid!==undefined?sum(m.returnSummary?'المسدد الصافي':'المسدد المسجل',m.paid):''}${m.remaining!==null&&m.remaining!==undefined?sum('المتبقي على الفاتورة',m.remaining):''}${!m.returnSummary&&m.returned?sum('مرتجعات مرتبطة',m.returned):''}${num(m.creditBalance)>0?sum(m.sale===false?'مبلغ مستحق من المجهز بعد الترجيع':'مبلغ مستحق للزبون بعد الترجيع',m.creditBalance):''}</tbody></table>${renderReturns(m.returnSummary,{showTotals:false})}<div class="invoice-words">فقط ${esc(amountWords)} لا غير</div>${m.partyBalance!==null&&m.partyBalance!==undefined?`<div class="invoice-account"><span>${esc(m.balanceLabel||'رصيد حساب الجهة')}</span><span dir="ltr">${money(m.partyBalance)}</span></div><p class="invoice-unit-note">الرصيد الموجب مبلغ إليك، والسالب مبلغ عليك.</p>`:''}${m.notes?`<section class="invoice-notes"><b>الملاحظات:</b>\n${esc(m.notes)}</section>`:''}<div class="invoice-extras">${extra}</div>${m.installments?.length?`<h3>جدول الأقساط المسجل</h3><table class="invoice-plan"><thead><tr><th>القسط</th><th>التاريخ</th><th>المبلغ</th><th>المسدد</th></tr></thead><tbody>${m.installments.map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.date||p.dueDate||'')}</td><td>${money(p.amount)}</td><td>${money(p.paid)}</td></tr>`).join('')}</tbody></table>`:''}${company.invoiceTerms?`<p class="invoice-terms">${esc(company.invoiceTerms)}</p>`:''}<div class="invoice-signatures">${(m.signatures||['توقيع '+(m.partyLabel||'المستلم'),'توقيع '+(m.sale===false?'المشتري':'البائع'),'توقيع أمين المخزن']).map(text=>`<span>${esc(text)}</span>`).join('')}</div><footer class="invoice-footer">${esc([company.name,company.address,company.phone,company.email].filter(Boolean).join(' · '))}</footer></main></body></html>`;}
window.HAInvoiceLayout={render,words,renderReturns,renderEdits,companyHeader,voucherBody,renderVoucher,voucherMoney,companyForDocument,documentHeaderEditor,readDocumentHeader,setDocumentHeader};})();
