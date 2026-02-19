const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const { readDb, withDb } = require('./store');

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, '..', '..');
const NEQUI_NUMBER = process.env.NEQUI_NUMBER || '3001234567';
const TRIAL_INVOICES = 3;

const PLAN_FEATURES = {
  trial: { basicSale: true, excelImport: true, advancedReports: false, multiCaja: false, autoEmail: false },
  free: { basicSale: true, excelImport: true, advancedReports: false, multiCaja: false, autoEmail: false },
  pro: { basicSale: true, excelImport: true, advancedReports: true, multiCaja: true, autoEmail: true }
};

const PLANS = [
  { id: 'trial', name: 'Prueba mínima', priceCop: 0, billing: 'una sola vez', invoiceLimit: TRIAL_INVOICES },
  { id: 'free', name: 'Base', priceCop: 0, billing: 'mensual', invoiceLimit: 20 },
  { id: 'pro', name: 'Pro', priceCop: 59000, billing: 'mensual', invoiceLimit: null }
];

const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'application/javascript', '.json':'application/json' };

function ensureDbShape(db) {
  db.users ||= [];
  db.sessions ||= [];
  db.invoices ||= [];
  db.payments ||= [];
  db.users.forEach((u) => {
    if (u.status === undefined) u.status = u.role === 'super_admin' ? 'active' : 'pending_activation';
    if (u.plan === undefined) u.plan = 'trial';
    if (u.trialInvoicesRemaining === undefined) u.trialInvoicesRemaining = TRIAL_INVOICES;
    u.features ||= {};
  });
}

function getDb() {
  const db = readDb();
  ensureDbShape(db);
  return db;
}

function send(res, status, body, headers={}) {
  const contentType = typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json';
  res.writeHead(status, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

function auth(req) {
  const authz = req.headers.authorization || '';
  const t = authz.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!t) return null;
  const db = getDb();
  const session = db.sessions.find((s) => s.token === t);
  if (!session) return null;
  return db.users.find((u) => u.id === session.userId) || null;
}

function sanitizeUser(user){ const { password, ...safe } = user; return safe; }

function isActiveUser(user) {
  return user.role === 'super_admin' || user.status === 'active';
}

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url;
  const file = path.join(ROOT, decodeURIComponent(urlPath));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
  return true;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (line) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i += 1; } else q = !q; }
      else if (c === ',' && !q) { out.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    out.push(cur.trim());
    return out;
  };

  const headers = split(lines[0]).map((h) => h.toUpperCase().replace(/\s+/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = split(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
    const code = row.CÓDIGO || row.CODIGO || row.COD || row.EAN || row.REFERENCIA || '';
    const name = row.PRODUCTO || row.NOMBRE || row.DESCRIPCION || row.DESCRIPCIÓN || '';
    const priceRaw = row.PRECIOCONIVA || row.PRECIO || row.VALOR || '0';
    const stockRaw = row.STOCK || '';
    const price = Number(String(priceRaw).replace(/[$.\s]/g, '').replace(',', '.')) || 0;
    const stock = stockRaw === '' ? null : Number(stockRaw) || null;
    if (code && name && price > 0) rows.push({ code, name, price, stock });
  }
  return rows;
}


function resolveLoginUser(db, body) {
  const rawLogin = String(body.email || '').trim();
  const email = rawLogin.toLowerCase();
  const upperLogin = rawLogin.toUpperCase();

  if (body.roleMode === 'super_admin') {
    return db.users.find((u) => u.role === 'super_admin' && (
      u.password === body.password ||
      (email && u.email === email && u.password === body.password)
    ));
  }

  return db.users.find((u) =>
    u.password === body.password && (
      u.email === email ||
      String(u.name || '').toUpperCase() === upperLogin
    )
  );
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      if (resp.statusCode !== 200) {
        reject(new Error(`HTTP ${resp.statusCode}`));
        resp.resume();
        return;
      }
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '', { 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' });

  if (req.url === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });

  if (req.url === '/api/plans' && req.method === 'GET') {
    return send(res, 200, { plans: PLANS, nequiNumber: NEQUI_NUMBER });
  }

  if (req.url === '/api/auth/login' && req.method === 'POST') {
    const body = await parseBody(req);
    const db = getDb();
    const user = resolveLoginUser(db, body);
    if (!user) return send(res, 401, { error: 'Credenciales inválidas' });
    const t = crypto.randomBytes(16).toString('hex');
    withDb((wdb) => {
      ensureDbShape(wdb);
      wdb.sessions = wdb.sessions.filter((s) => s.userId !== user.id);
      wdb.sessions.push({ token: t, userId: user.id, createdAt: new Date().toISOString() });
    });
    return send(res, 200, { token: t, user: sanitizeUser(user) });
  }

  if (req.url === '/api/auth/logout' && req.method === 'POST') {
    const authz = req.headers.authorization || '';
    const t = authz.startsWith('Bearer ') ? authz.slice(7) : null;
    withDb((db) => { ensureDbShape(db); db.sessions = db.sessions.filter((s) => s.token !== t); });
    return send(res, 200, { ok: true });
  }

  if (req.url === '/api/me' && req.method === 'GET') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    const base = PLAN_FEATURES[user.plan] || PLAN_FEATURES.trial;
    return send(res, 200, { user: sanitizeUser(user), effectiveFeatures: { ...base, ...(user.features||{}) } });
  }

  if (req.url === '/api/inventory/import-gsheets' && req.method === 'POST') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    const body = await parseBody(req);
    const sheetUrl = String(body.url || '').trim();
    const sheetMatch = sheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const gid = String(body.gid || (sheetUrl.match(/[?&#]gid=(\d+)/)?.[1] || '0'));
    if (!sheetMatch) return send(res, 400, { error: 'URL de Google Sheets inválida' });
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv&gid=${gid}`;
      const csvText = await fetchText(csvUrl);
      const products = parseCsv(csvText);
      return send(res, 200, { products, count: products.length });
    } catch (e) {
      return send(res, 502, { error: `No se pudo cargar Google Sheets: ${e.message}` });
    }
  }

  if (req.url === '/api/admin/users' && req.method === 'GET') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    if (!['admin','super_admin'].includes(user.role)) return send(res, 403, { error: 'Permisos insuficientes' });
    return send(res, 200, getDb().users.map(sanitizeUser));
  }

  if (req.url === '/api/admin/users' && req.method === 'POST') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    if (!['admin','super_admin'].includes(user.role)) return send(res, 403, { error: 'Permisos insuficientes' });
    const body = await parseBody(req);
    if (!body.name || !body.email || !body.password) return send(res, 400, { error: 'Datos incompletos' });
    try {
      const created = withDb((db) => {
        ensureDbShape(db);
        if (db.users.some((u) => u.email === String(body.email).toLowerCase())) throw new Error('EMAIL_EXISTS');
        const u = {
          id:`u-${crypto.randomUUID()}`,
          name:body.name,
          email:String(body.email).toLowerCase(),
          password:body.password,
          role:body.role||'merchant',
          plan:body.plan || 'trial',
          status: body.status || 'pending_activation',
          planExpiresAt:null,
          trialInvoicesRemaining: body.plan === 'pro' ? TRIAL_INVOICES : TRIAL_INVOICES,
          features:{}
        };
        db.users.push(u);
        return u;
      });
      return send(res, 201, sanitizeUser(created));
    } catch {
      return send(res, 409, { error: 'Email existente' });
    }
  }

  if (req.url.startsWith('/api/admin/users/') && req.method === 'PATCH') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    if (!['admin','super_admin'].includes(user.role)) return send(res, 403, { error: 'Permisos insuficientes' });
    const id = req.url.split('/').pop();
    const body = await parseBody(req);
    const updated = withDb((db) => {
      ensureDbShape(db);
      const u = db.users.find((x) => x.id === id);
      if(!u) return null;
      if(body.role) u.role = body.role;
      if(body.plan) u.plan = body.plan;
      if(body.status) u.status = body.status;
      if(body.planExpiresAt !== undefined) u.planExpiresAt = body.planExpiresAt;
      if(body.trialInvoicesRemaining !== undefined) u.trialInvoicesRemaining = Number(body.trialInvoicesRemaining);
      if(body.features) u.features = { ...(u.features||{}), ...body.features };
      return u;
    });
    if(!updated) return send(res,404,{error:'No encontrado'});
    return send(res,200,sanitizeUser(updated));
  }

  if (req.url === '/api/payments/request' && req.method === 'POST') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    const body = await parseBody(req);
    if (!body.planId || !body.reference) return send(res, 400, { error: 'Plan y referencia son obligatorios' });
    const plan = PLANS.find((p) => p.id === body.planId);
    if (!plan) return send(res, 400, { error: 'Plan inválido' });

    const payment = withDb((db) => {
      ensureDbShape(db);
      const reqPayment = {
        id: `pay-${crypto.randomUUID()}`,
        userId: user.id,
        userEmail: user.email,
        planId: plan.id,
        amountCop: body.amountCop || plan.priceCop,
        reference: body.reference,
        note: body.note || '',
        status: 'pending_review',
        createdAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null
      };
      db.payments.push(reqPayment);
      return reqPayment;
    });
    return send(res, 201, payment);
  }

  if (req.url === '/api/admin/payments' && req.method === 'GET') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    if (!['admin','super_admin'].includes(user.role)) return send(res, 403, { error: 'Permisos insuficientes' });
    return send(res, 200, getDb().payments || []);
  }

  if (req.url.startsWith('/api/admin/payments/') && req.method === 'PATCH') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    if (!['admin','super_admin'].includes(user.role)) return send(res, 403, { error: 'Permisos insuficientes' });
    const id = req.url.split('/').pop();
    const body = await parseBody(req);
    const updated = withDb((db) => {
      ensureDbShape(db);
      const payment = db.payments.find((p) => p.id === id);
      if (!payment) return null;
      payment.status = body.status || payment.status;
      payment.reviewedAt = new Date().toISOString();
      payment.reviewedBy = user.id;
      if (body.status === 'approved') {
        const u = db.users.find((x) => x.id === payment.userId);
        if (u) {
          u.plan = payment.planId;
          u.status = 'active';
          if (payment.planId === 'pro') {
            u.features = { ...(u.features || {}), ...PLAN_FEATURES.pro };
          }
        }
      }
      if (body.status === 'rejected') {
        const u = db.users.find((x) => x.id === payment.userId);
        if (u && u.status !== 'active') u.status = 'pending_activation';
      }
      return payment;
    });
    if (!updated) return send(res, 404, { error: 'Solicitud no encontrada' });
    return send(res, 200, updated);
  }

  if (req.url === '/api/invoices' && req.method === 'POST') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    if (!isActiveUser(user)) return send(res, 403, { error: 'Usuario pendiente de activación. Solicita o valida pago de plan.' });
    if (user.plan === 'trial' && user.trialInvoicesRemaining <= 0) return send(res, 403, { error: 'Prueba mínima agotada. Elige un plan y solicita activación.' });

    const body = await parseBody(req);
    const inv = withDb((db) => {
      ensureDbShape(db);
      const currentUser = db.users.find((u) => u.id === user.id);
      if (!currentUser) throw new Error('USER_MISSING');
      if (currentUser.plan === 'trial' && currentUser.trialInvoicesRemaining > 0) {
        currentUser.trialInvoicesRemaining -= 1;
      }
      const it = { id:`inv-${crypto.randomUUID()}`,createdBy:user.id,createdAt:new Date().toISOString(),...body };
      db.invoices.push(it);
      return it;
    });
    return send(res, 201, inv);
  }

  if (req.url === '/api/invoices' && req.method === 'GET') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    const db = getDb();
    const data = ['admin','super_admin'].includes(user.role) ? db.invoices : db.invoices.filter((i)=>i.createdBy===user.id);
    return send(res, 200, data);
  }

  if (serveStatic(req, res)) return;
  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => console.log(`POS Pro backend running on http://localhost:${PORT}`));
