# MASTER PROMPT POS PRO (Único)

## Arquitectura oficial
- Frontend oficial: `index.html` + `frontend/styles.css` + `frontend/app.js`
- Backend oficial: `backend/src/server.js`
- Persistencia: `backend/data/store.json`

## Reglas técnicas
1. Una sola entrada HTML (`index.html`).
2. API backend para auth/usuarios/facturas.
3. Mantener design system dark del POS (tokens/estructura scanner-first).
4. Feedback sonoro en eventos críticos (`beep` ok/error).
5. No usar `alert/confirm/prompt`; usar modal UI (`#modal-alert`).

## Criterios de aceptación
- Login super admin con `Masmela3$`.
- Usuario seed `Angela Wilches` existente.
- Admin puede crear usuarios.
- Se puede guardar factura vía backend.
- App arranca con `npm start`.
