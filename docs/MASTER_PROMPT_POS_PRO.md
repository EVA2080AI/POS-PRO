# MASTER PROMPT POS PRO (Único)

## Arquitectura oficial
- Frontend oficial: `index.html` + `frontend/styles.css` + `frontend/app.js`
- Backend oficial: `backend/src/server.js`
- Persistencia: `backend/data/store.json`

## Reglas técnicas
1. No duplicar HTML de entrada.
2. No mezclar persistencia local del navegador para datos core (usuarios/facturas).
3. Usar API backend para auth, usuarios, facturas.
4. No usar `alert/confirm/prompt`; usar modal UI (`#modal-alert`).
5. Mantener feedback sonoro de eventos críticos (ok/error).

## Criterios de aceptación
- Login super admin con `Masmela3$`.
- Usuario seed `Angela Wilches` existente.
- Admin puede crear usuarios.
- Se puede guardar factura vía backend.
- App arranca con `npm start`.
