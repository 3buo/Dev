// js/feedback.js — toast accesible + guardado verificado + focus trap (F15, F22, F27, F11)
let toastEl = null;
export function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    toastEl.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10000005;background:#1e1e1e;color:#e0e0e0;border:1px solid #03dac6;padding:10px 16px;border-radius:8px;font-size:14px;max-width:90vw;';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => { toastEl.textContent = ''; }, 3500);
}

export async function saveAndRender(btn, saveFn) {
  if (btn) btn.disabled = true;
  try { await saveFn(); toast('Guardado'); }
  catch (e) { toast('No se pudo guardar: ' + (e?.message || 'error de red')); }
  finally { if (btn) btn.disabled = false; }
}

export function trapFocus(modalEl) {
  if (!modalEl) return;
  const focusables = () => [...modalEl.querySelectorAll('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.offsetParent !== null);
  modalEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { modalEl.style.display = 'none'; return; }
    if (e.key !== 'Tab') return;
    const els = focusables();
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}
