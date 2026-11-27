(function () {
  'use strict';
  const build = '20261127-market-daily-profit-v89';
  window.HA_ACCOUNTING_BUILD = build;
  const sync = document.getElementById('manualSyncButton');
  if (!sync) return;
  const button = document.createElement('button');
  button.id = 'appUpdateButton'; button.type = 'button';
  button.className = 'btn secondary small'; button.textContent = '⟳ تحديث البرنامج';
  sync.insertAdjacentElement('afterend', button);
  let busy = false;
  let lastInput = 0, lastAutomaticCheck = 0;
  const dirtyForms = new WeakSet();
  document.addEventListener('input', event => {
    lastInput = Date.now();
    if (event.target?.form) dirtyForms.add(event.target.form);
  }, true);
  document.addEventListener('reset', event => dirtyForms.delete(event.target), true);
  function automaticSafe() {
    if (document.visibilityState === 'hidden' || !navigator.onLine || window.HAStaff?.hasOpenForm?.() || window.HA_WORKSPACE_FORMS?.hasOpen?.()) return false;
    if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return false;
    if (document.getElementById('modal')?.open) return false;
    if (document.activeElement?.matches?.('input,textarea,select,[contenteditable="true"]')) return false;
    if (lastInput && Date.now() - lastInput < 60000) return false;
    return !Array.from(document.querySelectorAll('form')).some(form => dirtyForms.has(form));
  }
  function message(text, sticky = false) {
    let el = document.getElementById('appUpdateStatus');
    if (!el) {
      el = document.createElement('div'); el.id = 'appUpdateStatus'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;z-index:3000;bottom:24px;left:12px;right:12px;max-width:600px;margin:auto;background:#173f5f;color:white;padding:14px;border-radius:12px;text-align:center;font:14px Tahoma';
      document.body.append(el);
    }
    el.textContent = text; el.hidden = false; clearTimeout(el.hideTimer);
    if (!sticky) el.hideTimer = setTimeout(() => el.hidden = true, 7000);
  }
  async function limited(task, ms = 15000) {
    let timer;
    try { return await Promise.race([task, new Promise((_, reject) => timer = setTimeout(() => reject(Error('انتهت مهلة التحديث؛ حاول عند استقرار الإنترنت.')), ms))]); }
    finally { clearTimeout(timer); }
  }
  function workerBuild(worker) {
    return new Promise(resolve => {
      if (!worker || typeof MessageChannel === 'undefined') { resolve(null); return; }
      const channel = new MessageChannel();
      const finish = value => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(value); };
      const timer = setTimeout(() => finish(null), 800);
      channel.port1.onmessage = event => finish(event.data?.type === 'HA_BUILD' ? event.data.build : null);
      try { worker.postMessage({ type: 'HA_GET_BUILD' }, [channel.port2]); } catch { finish(null); }
    });
  }
  function workerUnavailable(error) {
    return error?.name === 'InvalidStateError' || error?.name === 'SecurityError';
  }
  async function workerRegistration() {
    try {
      const workers = navigator.serviceWorker;
      if (!workers?.getRegistration) return null;
      const registration = await limited(workers.getRegistration());
      return { workers, registration };
    } catch (error) {
      if (workerUnavailable(error)) return null;
      throw error;
    }
  }
  async function awaitController(workers, registration, expected) {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (await workerBuild(workers.controller) === expected) return;
      registration.waiting?.postMessage({ type: 'HA_SKIP_WAITING' });
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw Error('لم يكتمل تفعيل النسخة الجديدة. بقيت بياناتك محفوظة؛ أعد المحاولة بعد اكتمال نشر الملفات.');
  }
  const pageBuild = () => document.querySelector('meta[name="ha-app-build"]')?.content;
  async function verifyArrival() {
    const url = new URL(location.href);
    let pending;
    try { pending = JSON.parse(sessionStorage.getItem('ha-app-update-pending') || 'null'); } catch {}
    const expected = url.searchParams.get('ha_update') || (pending && Date.now() - pending.at < 600000 ? pending.build : null);
    if (!expected) return;
    const worker = await workerRegistration();
    const controller = worker?.workers.controller;
    const controlledBuild = controller ? await workerBuild(controller) : null;
    const workerConfirmed = !worker || controlledBuild === expected || !controller && pending?.build === expected && pending.direct;
    if (pageBuild() === expected && build === expected && workerConfirmed) {
      try { sessionStorage.removeItem('ha-app-update-pending'); } catch {}
      ['ha_update', 'ha_reload', 'ha_check'].forEach(key => url.searchParams.delete(key));
      history.replaceState(history.state, '', url.href);
      message('تم فتح النسخة الجديدة بنجاح.');
    } else message('لم يكتمل تحديث الواجهة. اتصل بالإنترنت واضغط تحديث البرنامج مرة ثانية؛ بياناتك محفوظة.', true);
  }
  const hasOpenForm = () => Boolean(window.HA_WORKSPACE_FORMS?.hasOpen?.() || window.HAStaff?.hasOpenForm?.() || document.getElementById('modal')?.open && document.getElementById('modalBody')?.querySelector('form'));
  async function update(options = {}) {
    const automatic = options.automatic === true;
    if (automatic && !automaticSafe()) return false;
    if (busy) return false;
    if (hasOpenForm()) {
      message('احفظ النماذج المفتوحة أو أغلق تبويباتها قبل تحديث البرنامج.'); return false;
    }
    if (!navigator.onLine) { message('ماكو إنترنت. حدّث عند رجوع الاتصال؛ حسابك وبياناتك محفوظة.'); return false; }
    if (!['https:', 'http:'].includes(location.protocol)) {
      if (!automatic) message('هاي نسخة محلية. حدّثها من ملفات الإصدار على الحاسبة، أو افتح رابط المحاسبة المنشور حتى تستخدم التحديث أونلاين.');
      return false;
    }
    busy = true; button.disabled = true; button.textContent = 'جارٍ فحص النسخة…';
    try {
      const url = new URL('./index.html', location.href); url.searchParams.set('ha_check', Date.now());
      const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 12000);
      let response;
      try { response = await fetch(url.href, { cache: 'no-store', signal: abort.signal }); } finally { clearTimeout(timer); }
      if (!response.ok) throw Error('تعذر جلب أحدث نسخة.');
      const latest = (await response.text()).match(/name="ha-app-build" content="([^"]+)"/)?.[1];
      if (!latest) throw Error('نشر ملفات النسخة لم يكتمل بعد؛ حاول لاحقاً.');
      const worker = await workerRegistration();
      const controlled = worker ? await workerBuild(worker.workers.controller) : latest;
      if (latest === build && pageBuild() === latest && controlled === latest) {
        if (!automatic) message('أنت تستخدم أحدث نسخة. زر تحديث البيانات يزامن حسابك.');
        return true;
      }
      let direct = !worker;
      if (worker) {
        try {
          const registration = worker.registration || await limited(worker.workers.register('./service-worker.js', { scope: './', updateViaCache: 'none' }));
          await limited(registration.update());
          await awaitController(worker.workers, registration, latest);
        } catch (error) {
          if (!workerUnavailable(error) || worker.workers.controller) throw error;
          direct = true;
        }
      }
      if (hasOpenForm() || automatic && !automaticSafe()) {
        if (!automatic) message('احفظ النماذج المفتوحة أو أغلق تبويباتها قبل تحديث البرنامج.');
        return false;
      }
      try { sessionStorage.setItem('ha-app-update-pending', JSON.stringify({ build: latest, at: Date.now(), direct })); } catch {}
      const target = new URL(location.href); target.searchParams.delete('ha_check');
      target.searchParams.set('ha_update', latest); target.searchParams.set('ha_reload', Date.now());
      message('جارٍ فتح النسخة الجديدة…'); location.replace(target.href); return true;
    } catch (error) {
      if (!automatic) message(error.name === 'AbortError' ? 'الاتصال بطيء؛ أعد المحاولة. بياناتك محفوظة.' : workerUnavailable(error) ? 'تعذّر تحديث نافذة البرنامج. سكّرها وافتحها مرة ثانية بوجود الإنترنت، أو افتح موقع المحاسبة بالمتصفح.' : error.message || 'تعذر التحديث.', true); return false;
    } finally { busy = false; button.disabled = false; button.textContent = '⟳ تحديث البرنامج'; }
  }
  button.addEventListener('click', () => update()); window.HA_UPDATE_APPLICATION = update;
  async function automaticCheck() {
    if (busy || !automaticSafe() || Date.now() - lastAutomaticCheck < 240000) return;
    lastAutomaticCheck = Date.now();
    await update({ automatic: true });
  }
  window.addEventListener('online', automaticCheck);
  window.addEventListener('pageshow', automaticCheck);
  document.addEventListener('visibilitychange', automaticCheck);
  setTimeout(automaticCheck, 15000);
  setInterval(automaticCheck, 60000);
  verifyArrival().catch(() => message('تعذر التأكد من اكتمال التحديث؛ اضغط تحديث البرنامج.', true));
})();
