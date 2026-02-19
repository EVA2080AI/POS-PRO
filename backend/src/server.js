const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readDb, withDb } = require('./store');

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, '..', '..');
const FRONT = path.join(ROOT, 'frontend');

const PLAN_FEATURES = {
  free: { basicSale: true, excelImport: true, advancedReports: false, multiCaja: false, autoEmail: false },
  pro: { basicSale: true, excelImport: true, advancedReports: true, multiCaja: true, autoEmail: true }
};

const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'application/javascript', '.json':'application/json' };

function send(res, status, body, headers={}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', ...headers });
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
  const db = readDb();
  const session = db.sessions.find((s) => s.token === t);
  if (!session) return null;
  return db.users.find((u) => u.id === session.userId) || null;
}

function sanitizeUser(user){ const { password, ...safe } = user; return safe; }

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url;
  const file = path.join(FRONT, urlPath);
  if (!file.startsWith(FRONT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return false;
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '', { 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' });

  // API
  if (req.url === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });

  if (req.url === '/api/auth/login' && req.method === 'POST') {
    const body = await parseBody(req);
    const db = readDb();
    let user;
    if (body.roleMode === 'super_admin') user = db.users.find(u => u.role === 'super_admin' && u.password === body.password);
    else user = db.users.find(u => u.email === String(body.email||'').toLowerCase() && u.password === body.password);
    if (!user) return send(res, 401, { error: 'Credenciales inválidas' });
    const t = crypto.randomBytes(16).toString('hex');
    withDb(wdb => { wdb.sessions = wdb.sessions.filter(s => s.userId !== user.id); wdb.sessions.push({ token: t, userId: user.id, createdAt: new Date().toISOString() }); });
    return send(res, 200, { token: t, user: sanitizeUser(user) });
  }

  if (req.url === '/api/auth/logout' && req.method === 'POST') {
    const authz = req.headers.authorization || '';
    const t = authz.startsWith('Bearer ') ? authz.slice(7) : null;
    withDb(db => { db.sessions = db.sessions.filter(s => s.token !== t); });
    return send(res, 200, { ok: true });
  }

  if (req.url === '/api/me' && req.method === 'GET') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    const base = PLAN_FEATURES[user.plan] || PLAN_FEATURES.free;
    return send(res, 200, { user: sanitizeUser(user), effectiveFeatures: { ...base, ...(user.features||{}) } });
  }

  if (req.url === '/api/admin/users' && req.method === 'GET') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    if (!['admin','super_admin'].includes(user.role)) return send(res, 403, { error: 'Permisos insuficientes' });
    return send(res, 200, readDb().users.map(sanitizeUser));
  }

  if (req.url === '/api/admin/users' && req.method === 'POST') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    if (!['admin','super_admin'].includes(user.role)) return send(res, 403, { error: 'Permisos insuficientes' });
    const body = await parseBody(req);
    if (!body.name || !body.email || !body.password) return send(res, 400, { error: 'Datos incompletos' });
    try {
      const created = withDb(db => {
        if (db.users.some(u => u.email === String(body.email).toLowerCase())) throw new Error('EMAIL_EXISTS');
        const u = { id:`u-${crypto.randomUUID()}`, name:body.name, email:String(body.email).toLowerCase(), password:body.password, role:body.role||'merchant', plan:'free', planExpiresAt:null, features:{} };
        db.users.push(u); return u;
      });
      return send(res, 201, sanitizeUser(created));
    } catch { return send(res, 409, { error: 'Email existente' }); }
  }

  if (req.url.startsWith('/api/admin/users/') && req.method === 'PATCH') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    if (!['admin','super_admin'].includes(user.role)) return send(res, 403, { error: 'Permisos insuficientes' });
    const id = req.url.split('/').pop();
    const body = await parseBody(req);
    const updated = withDb(db => {
      const u = db.users.find(x=>x.id===id); if(!u) return null;
      if(body.role) u.role = body.role; if(body.plan) u.plan = body.plan;
      if(body.planExpiresAt !== undefined) u.planExpiresAt = body.planExpiresAt;
      if(body.features) u.features = { ...(u.features||{}), ...body.features };
      return u;
    });
    if(!updated) return send(res,404,{error:'No encontrado'});
    return send(res,200,sanitizeUser(updated));
  }

  if (req.url === '/api/invoices' && req.method === 'POST') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    const body = await parseBody(req);
    const inv = withDb(db => { const it={id:`inv-${crypto.randomUUID()}`,createdBy:user.id,createdAt:new Date().toISOString(),...body}; db.invoices.push(it); return it; });
    return send(res, 201, inv);
  }

  if (req.url === '/api/invoices' && req.method === 'GET') {
    const user = auth(req); if (!user) return send(res, 401, { error: 'No autorizado' });
    const db = readDb();
    const data = ['admin','super_admin'].includes(user.role) ? db.invoices : db.invoices.filter(i=>i.createdBy===user.id);
    return send(res, 200, data);
  }

  if (serveStatic(req, res)) return;
  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => console.log(`POS Pro backend running on http://localhost:${PORT}`));
