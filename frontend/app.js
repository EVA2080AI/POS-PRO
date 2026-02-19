const state = { token: null, user: null, cart: [] };

const $ = (s) => document.querySelector(s);
const fmt = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;

function open(id){$(id).classList.remove('hidden')} function close(id){$(id).classList.add('hidden')}

async function api(path, method='GET', body){
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', ...(state.token?{Authorization:`Bearer ${state.token}`}:{}) }, body: body?JSON.stringify(body):undefined });
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

function render(){
  $('#cart-body').innerHTML = state.cart.length ? state.cart.map(i=>`<tr><td>${i.name}</td><td>${i.qty}</td><td>${fmt(i.price)}</td><td>${i.disc}%</td><td>${fmt(i.price*i.qty*(1-i.disc/100))}</td></tr>`).join('') : '<tr><td colspan="5">Sin items</td></tr>';
  const t = calc();
  $('#t-gross').textContent=fmt(t.gross); $('#t-disc').textContent=fmt(t.disc); $('#t-fixed').textContent=fmt(t.fixed); $('#t-total-disc').textContent=fmt(t.totalDisc); $('#t-total').textContent=fmt(t.total);
  $('#chip-user').textContent = state.user ? `${state.user.name} (${state.user.role})` : 'Sin sesión';
  $('#chip-plan').textContent = state.user ? `Plan ${state.user.plan}` : 'Plan';
  $('#btn-admin').hidden = !(state.user && ['admin','super_admin'].includes(state.user.role));
  $('#btn-logout').hidden = !state.user;
}

function bind(){
  $('#btn-login').onclick=()=>open('#modal-auth'); $('#close-auth').onclick=()=>close('#modal-auth');
  $('#btn-admin').onclick=async()=>{await loadUsers();open('#modal-admin')}; $('#close-admin').onclick=()=>close('#modal-admin');
  $('#btn-add').onclick=()=>{const n=$('#product-name').value.trim();const p=Number($('#product-price').value);const q=Number($('#product-qty').value)||1;const d=Number($('#product-disc').value)||0; if(!n||!p)return; state.cart.push({name:n,price:p,qty:q,disc:d}); render();};
  $('#global-disc').oninput=render; $('#fixed-disc').oninput=render;

  $('#do-login').onclick=async()=>{
    try {
      const mode=$('#login-mode').value;
      const data=await api('/api/auth/login','POST',{roleMode:mode,email:$('#login-email').value,password:$('#login-pass').value});
      state.token=data.token; state.user=data.user; close('#modal-auth'); render();
    } catch(e){ alert(e.message); }
  };

  $('#btn-logout').onclick=async()=>{ if(state.token) await api('/api/auth/logout','POST'); state.token=null; state.user=null; render(); };

  $('#create-user').onclick=async()=>{
    try {
      await api('/api/admin/users','POST',{name:$('#new-name').value,email:$('#new-email').value,password:$('#new-pass').value,role:$('#new-role').value});
      await loadUsers();
    } catch(e){ alert(e.message); }
  };

  $('#btn-save').onclick=async()=>{
    try{
      const t=calc();
      const payload={items:[...state.cart],gross:t.gross,disc:t.disc,fixedDisc:t.fixed,totalDisc:t.totalDisc,total:t.total};
      await api('/api/invoices','POST',payload);
      state.cart=[];render();alert('Factura guardada');
    }catch(e){alert(e.message)}
  }
}

async function loadUsers(){
  const users = await api('/api/admin/users');
  $('#users-list').innerHTML = users.map(u=>`<div class='user-card'><b>${u.name}</b><div>${u.email}</div><div>${u.role} | ${u.plan}</div></div>`).join('');
}

bind();render();open('#modal-auth');
