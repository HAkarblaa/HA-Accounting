(function (global) {
  'use strict';
  const STORE_KEY = 'ha-accounting-yemen-section-v1';
  const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const id = () => 'ym-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const fmt = value => new Intl.NumberFormat('ar-IQ', { maximumFractionDigits: 2 }).format(number(value));
  const defaults = () => ({
    settings: { shopName: 'القسم اليمني', address: '', phone: '', taxNo: '', baseCode: 'IQD', baseName: 'دينار عراقي', foreignCode: 'USD', foreignName: 'دولار أمريكي', rate: 0 },
    invoices: [], movements: []
  });
  function normalize(source) {
    const d = source && typeof source === 'object' ? source : defaults();
    const base = defaults();
    d.settings = { ...base.settings, ...(d.settings || {}) };
    d.invoices = Array.isArray(d.invoices) ? d.invoices : [];
    d.movements = Array.isArray(d.movements) ? d.movements : [];
    return d;
  }
  function mount(root, options = {}) {
    if (!root) throw new Error('Yemen section root element is required');
    root.__haymController?.abort();
    const controller = new AbortController();
    let data;
    try { data = normalize(options.data || JSON.parse(localStorage.getItem(STORE_KEY) || 'null')); } catch (_) { data = defaults(); }
    let tab = 'dashboard';
    let invoiceFormOpen = false;
    const onSave = typeof options.onSave === 'function' ? options.onSave : function (value) { localStorage.setItem(STORE_KEY, JSON.stringify(value)); };
    const save = () => { onSave(data); };
    const s = () => data.settings;
    const baseAmount = row => row.currency === s().foreignCode ? number(row.baseAmount ?? number(row.amount) * number(row.rate)) : number(row.amount);
    const invoiceTotal = inv => (inv.items || []).reduce((n, item) => n + number(item.qty) * number(item.price), 0);
    const records = () => [
      ...data.invoices.map(inv => ({ id: inv.id, date: inv.date, kind: inv.type, party: inv.party, detail: `فاتورة ${inv.number}`, amount: invoiceTotal(inv), currency: inv.currency, rate: inv.rate, baseAmount: inv.baseAmount, paymentMode: inv.paymentMode, invoiceId: inv.id })),
      ...data.movements
    ];
    const totals = (from = '0000-01-01', to = '9999-12-31') => {
      const rows = records().filter(r => r.date >= from && r.date <= to);
      const sum = kinds => rows.filter(r => kinds.includes(r.kind)).reduce((n, r) => n + baseAmount(r), 0);
      const sales = sum(['sale']), purchases = sum(['purchase']);
      const income = sum(['income', 'receipt']);
      const expenses = sum(['expense', 'payment', 'workshop']);
      const cashRows = rows.filter(r => (r.paymentMode || 'cash') === 'cash');
      const cashSum = kinds => cashRows.filter(r => kinds.includes(r.kind)).reduce((n,r) => n + baseAmount(r), 0);
      return { rows, sales, purchases, income, expenses, cash: cashSum(['income','receipt','sale']) - cashSum(['expense','payment','workshop','purchase']) };
    };
    const currencyOptions = selected => [
      `<option value="${esc(s().baseCode)}" ${selected === s().baseCode ? 'selected' : ''}>${esc(s().baseName)} (${esc(s().baseCode)})</option>`,
      `<option value="${esc(s().foreignCode)}" ${selected === s().foreignCode ? 'selected' : ''}>${esc(s().foreignName)} (${esc(s().foreignCode)})</option>`
    ].join('');
    const tabs = () => `<nav class="haym-nav haym-no-print">${[['dashboard','لوحة التحكم'],['invoices','الفواتير'],['movements','الحركات'],['reports','التقارير'],['settings','إعدادات المحل والعملات']].map(([key,label]) => `<button type="button" class="haym-tab ${tab === key ? 'active' : ''}" data-ym-tab="${key}">${label}</button>`).join('')}</nav>`;
    const header = () => `<header class="haym-hero"><div><h1>${esc(s().shopName || 'القسم اليمني')}</h1><p>قسم مستقل · ${esc(s().baseName)} (${esc(s().baseCode)}) و${esc(s().foreignName)} (${esc(s().foreignCode)})</p></div><span class="haym-flag" aria-hidden="true">🇾🇪</span></header>${tabs()}`;
    const card = (title, value, sub = '') => `<article class="haym-card"><h3>${title}</h3><div class="haym-value">${value}</div>${sub ? `<div class="haym-muted">${sub}</div>` : ''}</article>`;
    const table = rows => !rows.length ? '<div class="haym-empty">ماكو سجلات بعد.</div>' : `<div class="haym-tablewrap"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الرقم / البيان</th><th>الجهة</th><th>المبلغ</th><th>العملة</th><th>ما يعادل ${esc(s().baseCode)}</th><th>إجراء</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.date)}</td><td>${esc(({sale:'بيع',purchase:'شراء',income:'إيراد',expense:'مصروف',workshop:'صيانة',receipt:'قبض',payment:'صرف'})[r.kind] || r.kind)}</td><td>${esc(r.detail || (r.invoiceId ? `فاتورة ${data.invoices.find(i => i.id === r.invoiceId)?.number || ''}` : '—'))}</td><td>${esc(r.party || '—')}</td><td>${fmt(r.amount)}</td><td>${esc(r.currency || s().baseCode)}</td><td>${fmt(baseAmount(r))} ${esc(s().baseCode)}</td><td>${r.invoiceId ? `<button class="haym-btn" data-ym-print="${esc(r.invoiceId)}">طباعة / PDF</button>` : `<button class="haym-btn" data-ym-delete-move="${esc(r.id)}">حذف</button>`}</td></tr>`).join('')}</tbody></table></div>`;
    const invoiceRows = () => !data.invoices.length ? '<div class="haym-empty">ماكو فواتير محفوظة بعد.</div>' : `<div class="haym-tablewrap"><table><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>النوع</th><th>الجهة</th><th>الإجمالي</th><th>طريقة الدفع</th><th>إجراء</th></tr></thead><tbody>${data.invoices.slice().sort((a,b) => b.date.localeCompare(a.date)).map(inv => `<tr><td>${esc(inv.number)}</td><td>${esc(inv.date)}</td><td>${inv.type === 'sale' ? 'مبيعات' : 'مشتريات'}</td><td>${esc(inv.party)}</td><td>${fmt(invoiceTotal(inv))} ${esc(inv.currency)}</td><td>${esc(({cash:'نقدي',credit:'آجل',card:'بطاقة'})[inv.paymentMode] || 'نقدي')}</td><td><button class="haym-btn" data-ym-print="${esc(inv.id)}">طباعة / حفظ PDF</button></td></tr>`).join('')}</tbody></table></div>`;
    function lineMarkup(item = {}) { return `<div class="haym-line" data-ym-line><input aria-label="اسم المادة" data-ym-item placeholder="اسم المادة" value="${esc(item.name || '')}"><input aria-label="العدد" data-ym-qty type="number" min="0.01" step="any" value="${number(item.qty) || 1}"><input aria-label="السعر" data-ym-price type="number" min="0" step="any" value="${number(item.price)}"><button type="button" class="haym-btn" data-ym-remove-line aria-label="حذف البند">×</button></div>`; }
    function invoiceForm() {
      const n = String(data.invoices.length + 1).padStart(5, '0');
      return `<section class="haym-panel"><h2>إنشاء فاتورة</h2><form data-ym-invoice-form><div class="haym-form-grid"><label class="haym-field">نوع الفاتورة<select name="type"><option value="sale">مبيعات</option><option value="purchase">مشتريات</option></select></label><label class="haym-field">رقم الفاتورة<input name="number" value="YM-${n}" required></label><label class="haym-field">التاريخ<input name="date" type="date" value="${today()}" required></label><label class="haym-field">اسم الزبون / المجهز<input name="party" required placeholder="الاسم"></label><label class="haym-field">العملة<select name="currency">${currencyOptions(s().baseCode)}</select></label><label class="haym-field">طريقة الدفع<select name="paymentMode"><option value="cash">نقدي</option><option value="credit">آجل</option><option value="card">بطاقة</option></select></label></div><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:16px"><b>مواد الفاتورة</b><button type="button" class="haym-btn" data-ym-add-line>＋ إضافة مادة</button></div><div data-ym-lines>${lineMarkup({qty:1,price:0})}</div><div class="haym-total" data-ym-invoice-total>الإجمالي: 0</div><label class="haym-field">ملاحظات<textarea name="notes" rows="2"></textarea></label><div class="haym-actions" style="margin-top:12px"><button class="haym-btn primary" type="submit">حفظ الفاتورة</button><button class="haym-btn" type="submit" data-ym-save-print>حفظ وطباعة / PDF</button><button type="button" class="haym-btn" data-ym-cancel-invoice>إلغاء</button></div></form></section>`;
    }
    function reportHtml(from, to) {
      const t = totals(from, to), profit = t.sales - t.purchases;
      return `<div class="haym-grid">${card('عدد الحركات', String(t.rows.length))}${card('إجمالي المبيعات', `${fmt(t.sales)} ${esc(s().baseCode)}`)}${card('فرق المبيعات والمشتريات', `${fmt(profit)} ${esc(s().baseCode)}`, 'تقديري حسب الحركات ضمن الفترة')}${card('إجمالي المشتريات', `${fmt(t.purchases)} ${esc(s().baseCode)}`)}${card('الإيرادات والقبض', `${fmt(t.income)} ${esc(s().baseCode)}`)}${card('المصروفات والصرف', `${fmt(t.expenses)} ${esc(s().baseCode)}`)}${card('صافي الحركة النقدية', `${fmt(t.cash)} ${esc(s().baseCode)}`)}</div><section class="haym-panel"><h2>تفاصيل الفترة</h2>${table(t.rows)}</section>`;
    }
    function render() {
      const t = totals(); let body = '';
      if (tab === 'dashboard') {
        const max = Math.max(1, t.sales, t.purchases, t.income, t.expenses);
        const bars = [['مبيعات',t.sales],['مشتريات',t.purchases],['إيرادات',t.income],['مصروفات',t.expenses]].map(([label,val]) => `<div class="haym-bar" style="height:${Math.max(8, Math.round(number(val) / max * 100))}%"><span>${label}</span></div>`).join('');
        body = `<div class="haym-grid">${card('إجمالي المبيعات', `${fmt(t.sales)} ${esc(s().baseCode)}`)}${card('إجمالي المشتريات', `${fmt(t.purchases)} ${esc(s().baseCode)}`)}${card('الإيرادات والقبض', `${fmt(t.income)} ${esc(s().baseCode)}`)}${card('المصروفات والصرف', `${fmt(t.expenses)} ${esc(s().baseCode)}`)}${card('صافي الحركة النقدية', `${fmt(t.cash)} ${esc(s().baseCode)}`)}${card('سعر الصرف', number(s().rate) ? `1 ${esc(s().foreignCode)} = ${fmt(s().rate)} ${esc(s().baseCode)}` : 'أدخل سعر الصرف', 'يتحدث التحويل للحركات والفواتير الجديدة')}</div><section class="haym-panel" style="margin-top:14px"><h2>حركة المحل</h2><div class="haym-chart">${bars}</div></section><section class="haym-panel"><div class="haym-actions"><h2 style="margin-inline-end:auto">آخر الفواتير</h2><button class="haym-btn" data-ym-tab="invoices">عرض الفواتير</button></div>${invoiceRows()}</section>`;
      } else if (tab === 'invoices') {
        body = `<section class="haym-panel"><div class="haym-actions"><h2 style="margin-inline-end:auto">فواتير المبيعات والمشتريات</h2><button type="button" class="haym-btn primary" data-ym-new-invoice>＋ فاتورة جديدة</button></div>${invoiceFormOpen ? invoiceForm() : ''}${invoiceRows()}</section><div class="haym-note">الفاتورة تنحفظ في سجل القسم، ويمكن فتح نافذة الطباعة ثم اختيار الطابعة أو «حفظ كملف PDF». سعر الصرف المستخدم ينحفظ مع الفاتورة حتى تبقى قيمتها التاريخية ثابتة.</div>`;
      } else if (tab === 'movements') {
        body = `<section class="haym-panel"><h2>تسجيل قبض أو صرف أو مصروف</h2><form data-ym-move-form class="haym-form-grid"><label class="haym-field">نوع الحركة<select name="kind"><option value="income">إيراد / قبض</option><option value="expense">مصروف</option><option value="workshop">أجور صيانة</option><option value="receipt">سند قبض</option><option value="payment">سند صرف</option></select></label><label class="haym-field">التاريخ<input name="date" type="date" value="${today()}" required></label><label class="haym-field">الجهة<input name="party" placeholder="الاسم"></label><label class="haym-field">المبلغ<input name="amount" type="number" min="0.01" step="any" required></label><label class="haym-field">العملة<select name="currency">${currencyOptions(s().baseCode)}</select></label><label class="haym-field">طريقة الدفع<select name="paymentMode"><option value="cash">نقدي</option><option value="credit">آجل</option><option value="card">بطاقة</option></select></label><label class="haym-field">التفاصيل<input name="detail" placeholder="تفاصيل الحركة"></label><div class="haym-total" data-ym-move-conversion>التحويل يظهر عند إدخال المبلغ.</div><button class="haym-btn primary">حفظ الحركة</button></form></section><section class="haym-panel"><h2>سجل الحركات</h2>${table(t.rows.slice().sort((a,b) => b.date.localeCompare(a.date)))}</section>`;
      } else if (tab === 'reports') {
        const first = `${today().slice(0,8)}01`;
        body = `<section class="haym-panel"><h2>تقارير حسب الفترة</h2><div class="haym-report-tools"><label>من<input type="date" data-ym-from value="${first}"></label><label>إلى<input type="date" data-ym-to value="${today()}"></label><button class="haym-btn" data-ym-period="day">يومي</button><button class="haym-btn" data-ym-period="month">شهري</button><button class="haym-btn" data-ym-period="year">سنوي</button><button class="haym-btn primary" data-ym-run-report>عرض التقرير</button><button class="haym-btn" data-ym-print-report>طباعة</button><button class="haym-btn" data-ym-export>تنزيل CSV</button></div></section><div data-ym-report>${reportHtml(first,today())}</div>`;
      } else {
        body = `<section class="haym-panel"><h2>بيانات المحل والعملات</h2><form data-ym-settings class="haym-form-grid"><label class="haym-field">اسم المحل<input name="shopName" value="${esc(s().shopName)}"></label><label class="haym-field">العنوان<input name="address" value="${esc(s().address)}"></label><label class="haym-field">رقم الهاتف<input name="phone" value="${esc(s().phone)}"></label><label class="haym-field">الرقم الضريبي<input name="taxNo" value="${esc(s().taxNo)}"></label><label class="haym-field">سعر الصرف: 1 ${esc(s().foreignCode)} = كم ${esc(s().baseCode)}؟<input name="rate" type="number" min="0.000001" step="any" value="${number(s().rate)||''}" placeholder="أدخل سعر الصرف المعتمد" required></label><div class="haym-total" data-ym-rate-preview>تغيّر سعر الصرف يحدّث التحويل للفواتير والحركات الجديدة.</div><button class="haym-btn primary">حفظ الإعدادات</button></form></section><div class="haym-note">العملتان الافتراضيتان: الدينار العراقي IQD والدولار الأمريكي USD. أدخل سعر الصرف المعتمد عندك. الفواتير السابقة تبقى على سعر الصرف المسجل فيها.</div>`;
      }
      root.innerHTML = `<div class="haym">${header()}${body}</div>`;
    }
    function getLines() { return [...root.querySelectorAll('[data-ym-line]')].map(row => ({ name: row.querySelector('[data-ym-item]').value.trim(), qty: number(row.querySelector('[data-ym-qty]').value), price: number(row.querySelector('[data-ym-price]').value) })); }
    function refreshInvoicePreview() {
      const form = root.querySelector('[data-ym-invoice-form]'); if (!form) return;
      const fd = new FormData(form), sum = getLines().reduce((n,x) => n+x.qty*x.price, 0), currency = fd.get('currency'), rate = number(s().rate);
      const out = root.querySelector('[data-ym-invoice-total]');
      if (currency === s().foreignCode && rate <= 0) out.textContent = `الإجمالي: ${fmt(sum)} ${s().foreignCode} · أدخل سعر الصرف من الإعدادات`;
      else { const base = currency === s().foreignCode ? sum*rate : sum; out.textContent = `الإجمالي: ${fmt(sum)} ${currency} · يعادل ${fmt(base)} ${s().baseCode}`; }
    }
    function printInvoice(invoiceId) {
      const inv = data.invoices.find(x => x.id === invoiceId); if (!inv) return;
      const lines = (inv.items || []).map(x => `<tr><td>${esc(x.name)}</td><td>${fmt(x.qty)}</td><td>${fmt(x.price)} ${esc(inv.currency)}</td><td>${fmt(x.qty*x.price)} ${esc(inv.currency)}</td></tr>`).join('');
      const total = invoiceTotal(inv), html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>فاتورة ${esc(inv.number)}</title><style>body{font:15px Tahoma,Arial;color:#18324b;margin:30px}header{border-bottom:2px solid #168f89;padding-bottom:12px;margin-bottom:18px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #aaa;padding:9px;text-align:right}h1{font-size:24px}.sum{font-size:18px;font-weight:bold;margin-top:18px}.muted{color:#667}</style><header><h1>${esc(s().shopName)}</h1><div>${esc(s().address)} · ${esc(s().phone)}</div><div>${esc(s().taxNo)}</div></header><h2>فاتورة ${inv.type==='sale'?'مبيعات':'مشتريات'}</h2><p>رقم: ${esc(inv.number)}　 التاريخ: ${esc(inv.date)}　 الجهة: ${esc(inv.party)}</p><table><thead><tr><th>المادة</th><th>العدد</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead><tbody>${lines}</tbody></table><p class="sum">الإجمالي: ${fmt(total)} ${esc(inv.currency)}</p><p>ما يعادل: ${fmt(inv.baseAmount)} ${esc(s().baseCode)}　 ·　 سعر الصرف وقت الفاتورة: ${inv.currency===s().foreignCode?`1 ${esc(s().foreignCode)} = ${fmt(inv.rate)} ${esc(s().baseCode)}`:'عملة أساسية'}</p><p>الدفع: ${esc(({cash:'نقدي',credit:'آجل',card:'بطاقة'})[inv.paymentMode]||'نقدي')}</p><p>${esc(inv.notes||'')}</p><p class="muted">شكراً لتعاملكم معنا</p><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></html>`;
      const win = global.open('', '_blank', 'width=800,height=900'); if (!win) { global.alert('اسمح بفتح نافذة الطباعة لهذا الموقع.'); return; } win.document.open(); win.document.write(html); win.document.close();
    }
    function exportReport() {
      const from = root.querySelector('[data-ym-from]').value, to = root.querySelector('[data-ym-to]').value, t = totals(from,to);
      const rows = [['Date','Type','Number/Details','Party','Amount','Currency','Base amount'], ...t.rows.map(r => [r.date,r.kind,r.detail || '',r.party || '',r.amount,r.currency,baseAmount(r)])];
      const csv = '\ufeff' + rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'})); a.download = `yemen-report-${from}-${to}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    root.addEventListener('click', event => {
      const b = event.target.closest('button'); if (!b) return;
      if (b.dataset.ymTab) { tab = b.dataset.ymTab; invoiceFormOpen = false; render(); }
      else if (b.hasAttribute('data-ym-new-invoice')) { invoiceFormOpen = true; render(); }
      else if (b.hasAttribute('data-ym-cancel-invoice')) { invoiceFormOpen = false; render(); }
      else if (b.hasAttribute('data-ym-add-line')) { root.querySelector('[data-ym-lines]').insertAdjacentHTML('beforeend', lineMarkup({qty:1,price:0})); refreshInvoicePreview(); }
      else if (b.hasAttribute('data-ym-remove-line')) { if (root.querySelectorAll('[data-ym-line]').length > 1) b.closest('[data-ym-line]').remove(); refreshInvoicePreview(); }
      else if (b.dataset.ymPrint) printInvoice(b.dataset.ymPrint);
      else if (b.dataset.ymDeleteMove) { if (global.confirm('حذف هذه الحركة؟')) { data.movements = data.movements.filter(x => x.id !== b.dataset.ymDeleteMove); save(); render(); } }
      else if (b.dataset.ymPeriod) { const now = new Date(), mm = String(now.getMonth()+1).padStart(2,'0'); root.querySelector('[data-ym-from]').value = b.dataset.ymPeriod === 'day' ? today() : b.dataset.ymPeriod === 'year' ? `${now.getFullYear()}-01-01` : `${now.getFullYear()}-${mm}-01`; root.querySelector('[data-ym-to]').value = today(); }
      else if (b.hasAttribute('data-ym-run-report')) { const from=root.querySelector('[data-ym-from]').value,to=root.querySelector('[data-ym-to]').value; root.querySelector('[data-ym-report]').innerHTML = from > to ? '<div class="haym-note">تاريخ البداية لازم يسبق تاريخ النهاية.</div>' : reportHtml(from,to); }
      else if (b.hasAttribute('data-ym-print-report')) { const from=root.querySelector('[data-ym-from]').value,to=root.querySelector('[data-ym-to]').value,report=root.querySelector('[data-ym-report]')?.innerHTML||reportHtml(from,to),win=global.open('','_blank','width=850,height=900'); if(!win){global.alert('اسمح بفتح نافذة الطباعة لهذا الموقع.');return;} win.document.write(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>تقرير القسم اليمني</title><style>body{font:14px Tahoma,Arial;padding:24px;color:#18324b}.haym-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.haym-card,.haym-panel{border:1px solid #ccd;padding:12px;margin:10px 0;border-radius:8px}.haym-value{font-weight:bold}table{width:100%;border-collapse:collapse}td,th{border:1px solid #aaa;padding:7px;text-align:right}button{display:none}</style><h1>${esc(s().shopName)} · تقرير الفترة</h1><p>من ${esc(from)} إلى ${esc(to)}</p>${report}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></html>`);win.document.close(); }
      else if (b.hasAttribute('data-ym-export')) exportReport();
    }, { signal: controller.signal });
    root.addEventListener('input', event => {
      if (event.target.closest('[data-ym-invoice-form]')) refreshInvoicePreview();
      if (event.target.closest('[data-ym-settings]') && event.target.name === 'rate') { const out=root.querySelector('[data-ym-rate-preview]'); if(out) out.textContent = `1 ${s().foreignCode} = ${fmt(event.target.value)} ${s().baseCode} · ينعكس على تحويل الفواتير الجديدة مباشرة بعد حفظ الإعداد.`; }
      if (event.target.closest('[data-ym-move-form]')) { const f=event.target.closest('form'),d=new FormData(f),amount=number(d.get('amount')),rate=number(s().rate),foreign=d.get('currency')===s().foreignCode,out=root.querySelector('[data-ym-move-conversion]');out.textContent=foreign&&rate<=0?'أدخل سعر الصرف من الإعدادات.':`يعادل ${fmt(foreign?amount*rate:amount)} ${s().baseCode}`; }
    }, { signal: controller.signal });
    root.addEventListener('change', event => { if (event.target.closest('[data-ym-invoice-form]')) refreshInvoicePreview(); if (event.target.closest('[data-ym-move-form]')) { const f=event.target.closest('form'),d=new FormData(f),amount=number(d.get('amount')),rate=number(s().rate),foreign=d.get('currency')===s().foreignCode,out=root.querySelector('[data-ym-move-conversion]');out.textContent=foreign&&rate<=0?'أدخل سعر الصرف من الإعدادات.':`يعادل ${fmt(foreign?amount*rate:amount)} ${s().baseCode}`; } }, { signal: controller.signal });
    root.addEventListener('submit', event => {
      const form=event.target;
      if (form.matches('[data-ym-invoice-form]')) {
        event.preventDefault(); const d=new FormData(form), currency=String(d.get('currency')), rate=number(s().rate), items=getLines(), total=items.reduce((n,x)=>n+x.qty*x.price,0);
        if (items.some(x=>!x.name||x.qty<=0||x.price<0)||total<=0) { global.alert('أدخل مواد الفاتورة والعدد والسعر بشكل صحيح.'); return; }
        if (currency===s().foreignCode && rate<=0) { global.alert('أدخل سعر الصرف من إعدادات القسم قبل حفظ فاتورة بالدولار.'); return; }
        const invoiceNumber=String(d.get('number')).trim(); if(data.invoices.some(x=>x.number===invoiceNumber)){global.alert('رقم الفاتورة مستخدم مسبقاً.');return;}
        const inv={id:id(),type:String(d.get('type')),number:invoiceNumber,date:String(d.get('date')),party:String(d.get('party')).trim(),currency,rate:currency===s().foreignCode?rate:1,baseAmount:currency===s().foreignCode?total*rate:total,paymentMode:String(d.get('paymentMode')),notes:String(d.get('notes')||'').trim(),items};
        data.invoices.push(inv); save(); const print=event.submitter?.hasAttribute('data-ym-save-print'); invoiceFormOpen=false; render(); if(print) printInvoice(inv.id);
      } else if(form.matches('[data-ym-move-form]')) {
        event.preventDefault();const d=new FormData(form),amount=number(d.get('amount')),currency=String(d.get('currency')),rate=number(s().rate);
        if(amount<=0){global.alert('أدخل مبلغاً أكبر من صفر.');return;}if(currency===s().foreignCode&&rate<=0){global.alert('أدخل سعر الصرف من الإعدادات أولاً.');return;}
        data.movements.push({id:id(),kind:String(d.get('kind')),date:String(d.get('date')),party:String(d.get('party')||'').trim(),detail:String(d.get('detail')||'').trim(),paymentMode:String(d.get('paymentMode')||'cash'),amount,currency,rate:currency===s().foreignCode?rate:1,baseAmount:currency===s().foreignCode?amount*rate:amount});save();render();
      } else if(form.matches('[data-ym-settings]')) {
        event.preventDefault();const d=new FormData(form),rate=number(d.get('rate'));if(rate<=0){global.alert('سعر الصرف لازم يكون أكبر من صفر.');return;}Object.assign(s(),{shopName:String(d.get('shopName')||'').trim()||'القسم اليمني',address:String(d.get('address')||'').trim(),phone:String(d.get('phone')||'').trim(),taxNo:String(d.get('taxNo')||'').trim(),rate});save();render();global.alert('تم حفظ الإعدادات وسعر الصرف.');
      }
    }, { signal: controller.signal });
    render();
    return { render, getData: () => data, setTab: value => { tab=value; render(); }, destroy: () => { controller.abort(); root.innerHTML=''; } };
  }
  global.HAYemenSection = { mount };
})(window);
