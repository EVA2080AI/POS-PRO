const state = {
  token: null,
  user: null,
  cart: [],
  inventory: [
    { code: '7707203350071', name: 'MCCAIN TRADICIONAL 13X13', price: 18266, stock: 50 },
    { code: 'COS001', name: 'COSTILLAS X 250 GR', price: 7517, stock: 20 }
  ],
  history: [],
  plans: [],
  nequiNumber: '',
  localMode: false,
  lastInvoice: null
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`;
let audioCtx;

const DEFAULT_SUPER_LOGIN = { mode: 'super_admin', email: 'sebastian', password: 'Masmela3$' };
const DEFAULT_USER_LOGIN = { mode: 'user', email: 'angela', password: 'Masmela3$' };
const LOGIN_STORAGE_KEY = 'posRememberLogin';

function applyLoginPreset(data) {
  $('#login-mode').value = data.mode;
  $('#login-email').value = data.email;
  $('#login-pass').value = data.password;
}

function loadRememberedLogin() {
  const raw = localStorage.getItem(LOGIN_STORAGE_KEY);
  if (!raw) return applyLoginPreset(DEFAULT_SUPER_LOGIN);
  try {
    const data = JSON.parse(raw);
    if (data?.email && data?.password && data?.mode) {
      applyLoginPreset(data);
      $('#remember-login').checked = true;
      return;
    }
  } catch {}
  applyLoginPreset(DEFAULT_SUPER_LOGIN);
}

function persistLoginIfNeeded() {
  if (!$('#remember-login').checked) return localStorage.removeItem(LOGIN_STORAGE_KEY);
  localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify({
    mode: $('#login-mode').value,
    email: $('#login-email').value,
    password: $('#login-pass').value
  }));
}

function open(id) { $(id).classList.remove('hidden'); }
function close(id) { $(id).classList.add('hidden'); }
function setStatus(msg, type = 'ready') { const bar = $('#status-bar'); bar.className = `status-bar ${type}`; $('#status-text').textContent = msg; }
function showAlert(message, title = 'Aviso') { $('#alert-title').textContent = title; $('#alert-message').textContent = message; open('#modal-alert'); }

function enableLocalMode(reason = '') {
  state.localMode = true;
  if (!state.user) {
    state.user = {
      id: 'demo-local', name: 'Demo local', email: 'demo@local', role: 'super_admin', plan: 'pro', status: 'active', trialInvoicesRemaining: 999
    };
  }
  close('#modal-auth');
  renderCart();
  setStatus(`Modo demo activo: puedes usar la app sin backend${reason ? ` (${reason})` : ''}.`, 'ready');
}

function beep(ok = true) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = ok ? 'sine' : 'square';
    osc.frequency.value = ok ? 900 : 190;
    gain.gain.value = ok ? 0.06 : 0.1;
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + (ok ? 0.06 : 0.15));
  } catch {}
}

async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await res.text();
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const isJson = contentType.includes('application/json') || raw.trim().startsWith('{') || raw.trim().startsWith('[');
  const data = isJson ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;

  if (!res.ok) throw new Error((data && data.error) || `Error API (${res.status})`);
  if (!data) throw new Error('Respuesta inválida del servidor.');
  return data;
}

function calc() {
  const gross = state.cart.reduce((a, i) => a + i.price * i.qty, 0);
  const itemDisc = state.cart.reduce((a, i) => a + (i.price * i.qty * (i.disc / 100)), 0);
  const gPct = Number($('#global-disc').value) || 0;
  const gDisc = (gross - itemDisc) * (gPct / 100);
  const fixed = Number($('#fixed-disc').value) || 0;
  const disc = Math.min(gross, itemDisc + gDisc);
  const totalDisc = Math.min(gross, disc + fixed);
  return { gross, disc, fixed, totalDisc, total: Math.max(0, gross - totalDisc) };
}

function renderInventory() {
  const q = ($('#inv-search').value || '').toLowerCase();
  const rows = state.inventory.filter((i) => !q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q));
  $('#chip-inv').textContent = `${state.inventory.length} productos`;
  $('#inv-list').innerHTML = rows.length
    ? rows.map((i) => `<div class='inv-item'><div><b>${i.name}</b><br><small>${i.code}</small></div><div><b>${fmt(i.price)}</b><br><small>Stock ${i.stock ?? '-'}</small></div></div>`).join('')
    : '<div class="empty-msg">Sin productos</div>';
}

function invoicePrintableHtml(invoice) {
  const rows = (invoice.items || []).map((item) => `
    <tr>
      <td>${item.code || '-'}</td>
      <td>${item.name}</td>
      <td>${item.qty}</td>
      <td>${fmt(item.price)}</td>
      <td>${item.disc || 0}%</td>
      <td>${fmt(item.qty * item.price * (1 - ((item.disc || 0) / 100)))}</td>
    </tr>
  `).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/><title>Factura ${invoice.id}</title>
  <style>body{font-family:Arial;padding:16px;color:#0f172a}h1{margin:0 0 8px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}.tot{display:flex;justify-content:flex-end;gap:20px;font-weight:700}</style>
  </head><body>
  <h1>Factura ${invoice.id}</h1>
  <div>Fecha: ${new Date(invoice.createdAt || Date.now()).toLocaleString('es-CO')}</div>
  <table><thead><tr><th>Código</th><th>Producto</th><th>Cant</th><th>Valor</th><th>Dcto</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="tot"><span>Total:</span><span>${fmt(invoice.total || 0)}</span></div>
  <script>window.print()</script>
  </body></html>`;
}

function generateInvoicePdf(invoice) {
  if (!invoice) return showAlert('No hay factura para exportar.');
  const win = window.open('', '_blank');
  if (!win) return showAlert('Permite popups para generar el PDF.');
  win.document.write(invoicePrintableHtml(invoice));
  win.document.close();
}

function renderHistory() {
  $('#hist-list').innerHTML = state.history.length
    ? state.history.slice().reverse().map((h) => `<div class='hist-item'><div><b>${h.id || 'Factura'}</b></div><div>Total: ${fmt(h.total || 0)}</div><div>${new Date(h.createdAt || Date.now()).toLocaleString('es-CO')}</div><button class='btn btn-ghost btn-sm' data-pdf='${h.id}'>Generar PDF</button></div>`).join('')
    : '<div class="empty-msg">Sin ventas</div>';

  $$('[data-pdf]').forEach((btn) => {
    btn.onclick = () => {
      const inv = state.history.find((h) => h.id === btn.dataset.pdf);
      generateInvoicePdf(inv);
    };
  });
}

function renderPlans() {
  const order = { trial: 0, free: 1, pro: 2 };
  const rows = state.plans.slice().sort((a, b) => (order[a.id] ?? 99) - (order[b.id] ?? 99));
  $('#plans-list').innerHTML = rows.map((p) => `<div class='user-card'><b>${p.name}</b><div><small>Plan ${p.id.toUpperCase()}</small></div><div><strong>${fmt(p.priceCop)}</strong> / ${p.billing}</div><div>Límite: ${p.invoiceLimit ?? 'ilimitado'} facturas</div></div>`).join('');
  $('#plan-help').textContent = state.nequiNumber ? `Pagos por Nequi: ${state.nequiNumber}.` : 'Planes cargados.';
}

function renderCart() {
  $('#cart-body').innerHTML = state.cart.length
    ? state.cart.map((i, idx) => `<tr><td>${i.code || '-'}</td><td>${i.name}</td><td>${i.qty}</td><td>${fmt(i.price)}</td><td>${i.disc}%</td><td>${fmt(i.price * i.qty * (1 - i.disc / 100))}</td><td><button class='btn btn-danger btn-sm' data-rm='${idx}'>✕</button></td></tr>`).join('')
    : '<tr><td colspan="7" class="empty-msg">🧾 Factura vacía</td></tr>';

  const t = calc();
  $('#t-gross').textContent = fmt(t.gross);
  $('#t-disc').textContent = fmt(t.disc);
  $('#t-fixed').textContent = fmt(t.fixed);
  $('#t-total-disc').textContent = fmt(t.totalDisc);
  $('#t-total').textContent = fmt(t.total);

  $('#chip-user').textContent = state.user ? `${state.user.name} (${state.user.role})` : 'Sin sesión';
  $('#chip-plan').textContent = state.user ? `Plan ${state.user.plan} (${state.user.status || 'n/a'})` : 'Plan';
  $('#chip-trial').textContent = state.user ? `Prueba: ${state.user.trialInvoicesRemaining ?? '-'}` : 'Prueba: -';
  $('#btn-admin').hidden = !(state.user && ['admin', 'super_admin'].includes(state.user.role));
  $('#btn-logout').hidden = !state.user;

  $$('[data-rm]').forEach((btn) => {
    btn.onclick = () => { state.cart.splice(Number(btn.dataset.rm), 1); renderCart(); };
  });
}

function addItemFromInputs() {
  const name = $('#quick-name').value.trim();
  const code = $('#product-code').value.trim();
  const price = Number($('#product-price').value);
  const qty = Number($('#product-qty').value) || 1;
  const disc = Number($('#product-disc').value) || 0;
  if (!name || !price) return showAlert('Ingresa nombre y precio.');
  state.cart.push({ name, code, price, qty, disc });
  beep(true); setStatus('Item agregado al carrito', 'ready'); renderCart();
}

function scanByCode(code) {
  const item = state.inventory.find((i) => i.code === code || i.code === code.replace(/^0+/, ''));
  if (!item) { beep(false); return setStatus(`Código ${code} no encontrado`, 'error'); }
  const existing = state.cart.find((c) => c.code === item.code);
  if (existing) existing.qty += 1;
  else state.cart.push({ ...item, qty: 1, disc: 0 });
  beep(true); setStatus(`Agregado: ${item.name}`, 'ready'); renderCart();
}

function parseGSheetInput(rawUrl) {
  const clean = String(rawUrl || '').trim();
  const id = clean.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || '';
  const gid = clean.match(/[?&#]gid=(\d+)/)?.[1] || '0';
  return { clean, id, gid };
}

async function importFromGoogleSheets() {
  const parsed = parseGSheetInput($('#gs-url').value);
  const gid = $('#gs-gid').value.trim() || parsed.gid;
  if (!parsed.id) return showAlert('Pega un enlace válido de Google Sheets.');
  $('#gs-gid').value = gid;
  const data = await api('/api/inventory/import-gsheets', 'POST', {
    url: parsed.clean,
    gid
  });
  state.inventory = data.products;
  renderInventory();
  setStatus(`Inventario actualizado desde Google Sheets (${data.count} productos)`, 'ready');
}

async function loadHistory() {
  if (state.localMode) return renderHistory();
  if (!state.token) return;
  state.history = await api('/api/invoices');
  renderHistory();
}

async function loadMe() {
  if (!state.token) return;
  try {
    const me = await api('/api/me');
    state.user = me.user;
    renderCart();
  } catch {}
}

async function saveInvoice() {
  if (!state.cart.length) return showAlert('No hay items en el carrito');
  try {
    const t = calc();
    const payload = { items: [...state.cart], gross: t.gross, disc: t.disc, fixedDisc: t.fixed, totalDisc: t.totalDisc, total: t.total };
    const inv = state.localMode || !state.token
      ? { id: `local-${Date.now()}`, createdAt: new Date().toISOString(), ...payload }
      : await api('/api/invoices', 'POST', payload);

    if (state.localMode || !state.token) state.history.push(inv);
    state.lastInvoice = inv;
    state.cart = [];
    beep(true);
    setStatus('Factura guardada', 'ready');
    renderCart();
    if (!state.localMode && state.token) {
      await loadMe();
      await loadHistory();
    } else {
      renderHistory();
    }
    showAlert(`Factura creada: ${inv.id}`,'Éxito');
  } catch (e) {
    beep(false);
    showAlert(e.message, 'Error');
  }
}

function bindTabs() {
  $$('.tab-btn').forEach((btn) => {
    btn.onclick = () => {
      $$('.tab-btn').forEach((b) => b.classList.remove('active'));
      $$('.tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      $(`#tab-${btn.dataset.tab}`).classList.add('active');
    };
  });
}

async function loadPlans() {
  try {
    const data = await api('/api/plans');
    state.plans = data.plans;
    state.nequiNumber = data.nequiNumber;
    renderPlans();
  } catch (e) {
    $('#plan-help').textContent = e.message;
  }
}

async function loadUsers() {
  const users = await api('/api/admin/users');
  $('#users-list').innerHTML = users.map((u) => `<div class='user-card'><b>${u.name}</b><div>${u.email}</div><div>${u.role} | ${u.plan} | ${u.status}</div><div>Prueba restante: ${u.trialInvoicesRemaining ?? '-'}</div></div>`).join('');
}

async function loadPayments() {
  const payments = await api('/api/admin/payments');
  if (!payments.length) {
    $('#payments-list').innerHTML = '<div class="empty-msg">Sin solicitudes pendientes</div>';
    return;
  }
  $('#payments-list').innerHTML = payments.slice().reverse().map((p) => `<div class='user-card'><b>${p.userEmail}</b><div>${p.planId} - ${fmt(p.amountCop)}</div><div>Ref: ${p.reference}</div><div>Estado: ${p.status}</div><div><button class='btn btn-accent btn-sm' data-approve='${p.id}'>Aprobar</button> <button class='btn btn-danger btn-sm' data-reject='${p.id}'>Rechazar</button></div></div>`).join('');
  $$('[data-approve]').forEach((btn) => {
    btn.onclick = async () => { await api(`/api/admin/payments/${btn.dataset.approve}`, 'PATCH', { status: 'approved' }); await loadPayments(); await loadUsers(); };
  });
  $$('[data-reject]').forEach((btn) => {
    btn.onclick = async () => { await api(`/api/admin/payments/${btn.dataset.reject}`, 'PATCH', { status: 'rejected' }); await loadPayments(); };
  });
}

function bind() {
  bindTabs();
  $('#btn-login').onclick = () => open('#modal-auth');
  $('#close-auth').onclick = () => close('#modal-auth');
  $('#btn-admin').onclick = async () => { await loadUsers(); await loadPayments(); open('#modal-admin'); };
  $('#close-admin').onclick = () => close('#modal-admin');
  $('#alert-ok').onclick = () => close('#modal-alert');
  $('#fill-super').onclick = () => applyLoginPreset(DEFAULT_SUPER_LOGIN);
  $('#fill-user').onclick = () => applyLoginPreset(DEFAULT_USER_LOGIN);
  $('#btn-demo').onclick = () => enableLocalMode();

  $('#btn-add').onclick = addItemFromInputs;
  $('#global-disc').oninput = renderCart;
  $('#fixed-disc').oninput = renderCart;
  $('#inv-search').oninput = renderInventory;
  $('#btn-refresh-history').onclick = loadHistory;
  $('#btn-gs-import').onclick = async () => {
    try { await importFromGoogleSheets(); }
    catch (e) { showAlert(e.message, 'Google Sheets'); }
  };

  $('#btn-generate-last-pdf').onclick = () => generateInvoicePdf(state.lastInvoice);

  $('#scanner-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = $('#scanner-input').value.trim();
      $('#scanner-input').value = '';
      if (code) scanByCode(code);
    }
  });

  $('#do-login').onclick = async () => {
    try {
      persistLoginIfNeeded();
      const data = await api('/api/auth/login', 'POST', { roleMode: $('#login-mode').value, email: $('#login-email').value, password: $('#login-pass').value });
      state.token = data.token;
      state.user = data.user;
      close('#modal-auth');
      beep(true);
      setStatus(`Bienvenido ${state.user.name}`, 'ready');
      renderCart();
      await loadHistory();
      await loadPlans();
    } catch (e) {
      beep(false);
      enableLocalMode('sin conexión de backend');
      showAlert(`${e.message}\n\nSe activó modo demo local para que pruebes toda la aplicación sin login.`, 'Modo demo');
    }
  };

  $('#btn-logout').onclick = async () => {
    try { if (state.token) await api('/api/auth/logout', 'POST'); } catch {}
    state.token = null; state.user = null; state.history = []; state.lastInvoice = null;
    setStatus('Sesión cerrada', 'waiting');
    renderCart(); renderHistory();
  };

  $('#create-user').onclick = async () => {
    try {
      await api('/api/admin/users', 'POST', { name: $('#new-name').value, email: $('#new-email').value, password: $('#new-pass').value, role: $('#new-role').value });
      await loadUsers();
      beep(true); showAlert('Usuario creado correctamente', 'Admin');
    } catch (e) { beep(false); showAlert(e.message, 'Error'); }
  };

  $('#btn-save').onclick = saveInvoice;

  $('#btn-request-payment').onclick = async () => {
    try {
      await api('/api/payments/request', 'POST', { planId: $('#pay-plan').value.trim() || 'pro', reference: $('#pay-ref').value.trim(), note: $('#pay-note').value.trim() });
      showAlert('Solicitud enviada. El super usuario la revisará.', 'Pago');
    } catch (e) { showAlert(e.message, 'Error'); }
  };
}

bind();
renderInventory();
renderCart();
renderHistory();
loadPlans();
loadRememberedLogin();
enableLocalMode('inicio rápido');
