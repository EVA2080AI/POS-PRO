const state = {
  token: null,
  user: null,
  cart: [],
  inventory: [
    { code:'7707203350071', name:'MCCAIN TRADICIONAL 13X13', price:18266, stock:50 },
    { code:'COS001', name:'COSTILLAS X 250 GR', price:7517, stock:20 }
  ],
  history: []
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
let audioCtx;

function open(id){$(id).classList.remove('hidden');}
function close(id){$(id).classList.add('hidden');}
function setStatus(msg, type='ready'){ const bar=$('#status-bar'); bar.className=`status-bar ${type}`; $('#status-text').textContent=msg; }
function showAlert(message, title='Aviso'){ $('#alert-title').textContent=title; $('#alert-message').textContent=message; open('#modal-alert'); }

function beep(ok=true){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = ok ? 'sine' : 'square';
    osc.frequency.value = ok ? 880 : 200;
    g.gain.value = ok ? 0.06 : 0.1;
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + (ok ? 0.07 : 0.15));
  } catch {}
}

async function api(path, method='GET', body){
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(state.token?{Authorization:`Bearer ${state.token}`}:{}) },
    body: body?JSON.stringify(body):undefined
  });
  if(!res.ok) throw new Error((await res.json()).error || 'Error API');
  return res.json();
}

function calc(){
  const gross = state.cart.reduce((a,i)=>a+i.price*i.qty,0);
  const itemDisc = state.cart.reduce((a,i)=>a+(i.price*i.qty*(i.disc/100)),0);
  const gPct = Number($('#global-disc').value)||0;
  const gDisc = (gross-itemDisc)*(gPct/100);
  const fixed = Number($('#fixed-disc').value)||0;
  const disc = Math.min(gross,itemDisc+gDisc);
  const totalDisc = Math.min(gross,disc+fixed);
  return { gross, disc, fixed, totalDisc, total: Math.max(0,gross-totalDisc) };
}

function renderInventory(){
  const q = ($('#inv-search').value || '').toLowerCase();
  const rows = state.inventory.filter(i => !q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q));
  $('#chip-inv').textContent = `${state.inventory.length} productos`;
  $('#inv-list').innerHTML = rows.length ? rows.map(i=>`<div class='inv-item'><div><b>${i.name}</b><br><small>${i.code}</small></div><div><b>${fmt(i.price)}</b><br><small>Stock ${i.stock ?? '-'}</small></div></div>`).join('') : '<div class="empty-msg">Sin productos</div>';
}

function renderHistory(){
  $('#hist-list').innerHTML = state.history.length ? state.history.slice().reverse().map(h=>`<div class='hist-item'><div class='num'>${h.id || 'Factura'}</div><div>Total: ${fmt(h.total || 0)}</div><div>${h.createdAt || ''}</div></div>`).join('') : '<div class="empty-msg">Sin ventas</div>';
}

function renderCart(){
  $('#cart-body').innerHTML = state.cart.length
    ? state.cart.map((i,idx)=>`<tr><td>${i.code||'-'}</td><td>${i.name}</td><td>${i.qty}</td><td>${fmt(i.price)}</td><td>${i.disc}%</td><td>${fmt(i.price*i.qty*(1-i.disc/100))}</td><td><button class='btn btn-danger btn-sm' data-rm='${idx}'>✕</button></td></tr>`).join('')
    : '<tr><td colspan="7" class="empty-msg"><span class="empty-icon">🧾</span>Factura vacía</td></tr>';

  const t = calc();
  $('#t-gross').textContent=fmt(t.gross); $('#t-disc').textContent=fmt(t.disc); $('#t-fixed').textContent=fmt(t.fixed); $('#t-total-disc').textContent=fmt(t.totalDisc); $('#t-total').textContent=fmt(t.total);

  $('#chip-user').textContent = state.user ? `${state.user.name} (${state.user.role})` : 'Sin sesión';
  $('#chip-plan').textContent = state.user ? `Plan ${state.user.plan}` : 'Plan';
  $('#btn-admin').hidden = !(state.user && ['admin','super_admin'].includes(state.user.role));
  $('#btn-logout').hidden = !state.user;

  $$('[data-rm]').forEach(btn => btn.onclick = () => {
    state.cart.splice(Number(btn.dataset.rm),1);
    renderCart();
  });
}

function addItemFromInputs(){
  const name=$('#quick-name').value.trim();
  const code=$('#product-code').value.trim();
  const price=Number($('#product-price').value);
  const qty=Number($('#product-qty').value)||1;
  const disc=Number($('#product-disc').value)||0;
  if(!name||!price){ beep(false); return showAlert('Ingresa nombre y precio'); }
  state.cart.push({name,code,price,qty,disc});
  beep(true); setStatus('Item agregado al carrito', 'ready'); renderCart();
}

function scanByCode(code){
  const item = state.inventory.find(i => i.code===code || i.code===code.replace(/^0+/,''));
  if(!item){ beep(false); setStatus(`Código ${code} no encontrado`, 'error'); return; }
  const ex = state.cart.find(c => c.code===item.code);
  if(ex) ex.qty += 1;
  else state.cart.push({ ...item, qty:1, disc:0 });
  beep(true); setStatus(`Agregado: ${item.name}`, 'ready'); renderCart();
}

async function loadHistory(){
  if(!state.token) return;
  try { state.history = await api('/api/invoices'); renderHistory(); }
  catch(e){ showAlert(e.message,'Error historial'); }
}

async function saveInvoice(){
  if(!state.token) return showAlert('Debes iniciar sesión');
  if(!state.cart.length) return showAlert('No hay items en el carrito');
  try{
    const t=calc();
    const payload={items:[...state.cart],gross:t.gross,disc:t.disc,fixedDisc:t.fixed,totalDisc:t.totalDisc,total:t.total};
    const inv = await api('/api/invoices','POST',payload);
    state.cart=[];
    beep(true);
    setStatus('Factura guardada', 'ready');
    renderCart();
    await loadHistory();
    showAlert(`Factura creada: ${inv.id}`,'Éxito');
  }catch(e){ beep(false); showAlert(e.message,'Error'); }
}

function bindTabs(){
  $$('.tab-btn').forEach(btn => btn.onclick = () => {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    $(`#tab-${btn.dataset.tab}`).classList.add('active');
  });
}

function bind(){
  bindTabs();
  $('#btn-login').onclick=()=>open('#modal-auth');
  $('#close-auth').onclick=()=>close('#modal-auth');
  $('#btn-admin').onclick=async()=>{await loadUsers();open('#modal-admin');};
  $('#close-admin').onclick=()=>close('#modal-admin');
  $('#alert-ok').onclick=()=>close('#modal-alert');

  $('#btn-add').onclick=addItemFromInputs;
  $('#global-disc').oninput=renderCart; $('#fixed-disc').oninput=renderCart;
  $('#inv-search').oninput=renderInventory;
  $('#btn-refresh-history').onclick=loadHistory;

  $('#scanner-input').addEventListener('keydown', (e)=>{
    if(e.key==='Enter'){
      e.preventDefault();
      const code=$('#scanner-input').value.trim();
      $('#scanner-input').value='';
      if(code) scanByCode(code);
    }
  });

  $('#do-login').onclick=async()=>{
    try {
      const mode=$('#login-mode').value;
      const data=await api('/api/auth/login','POST',{roleMode:mode,email:$('#login-email').value,password:$('#login-pass').value});
      state.token=data.token; state.user=data.user; close('#modal-auth');
      beep(true); setStatus(`Bienvenido ${state.user.name}`,'ready');
      renderCart(); await loadHistory();
    } catch(e){ beep(false); showAlert(e.message,'Error'); }
  };

  $('#btn-logout').onclick=async()=>{
    try { if(state.token) await api('/api/auth/logout','POST'); } catch {}
    state.token=null; state.user=null; state.history=[];
    setStatus('Sesión cerrada', 'waiting');
    renderCart(); renderHistory();
  };

  $('#create-user').onclick=async()=>{
    try {
      await api('/api/admin/users','POST',{name:$('#new-name').value,email:$('#new-email').value,password:$('#new-pass').value,role:$('#new-role').value});
      await loadUsers();
      beep(true); showAlert('Usuario creado correctamente','Admin');
    } catch(e){ beep(false); showAlert(e.message,'Error'); }
  };

  $('#btn-save').onclick=saveInvoice;
}

async function loadUsers(){
  const users = await api('/api/admin/users');
  $('#users-list').innerHTML = users.map(u=>`<div class='user-card'><b>${u.name}</b><div>${u.email}</div><div>${u.role} | ${u.plan}</div></div>`).join('');
}

bind();
renderInventory();
renderCart();
renderHistory();
open('#modal-auth');
setStatus('Inicia sesión para operar.', 'waiting');
