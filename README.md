# POS Pro

## Fuente única de frontend
- `index.html` (entrypoint oficial)
- `frontend/styles.css`
- `frontend/app.js`

## Backend
- `backend/src/server.js`
- `backend/data/store.json`

## Ejecutar
```bash
npm start
```
Abrir: `http://localhost:8080`

## Credenciales seed
- Super Admin: `Masmela3$`
- Admin prueba: `angela.wilches@pospro.local` / `Angela2026*`

## Bloque implementado en esta iteración
- Tabs operativas: Pago / Inventario / Historial
- Scanner por código (Enter) con beep ok/error
- Carrito con remoción de ítems y descuentos
- Historial cargado desde backend (`/api/invoices`)
- Modal unificado de alertas (sin alert/confirm/prompt)

## Documentación maestra
- `docs/MASTER_PROMPT_POS_PRO.md`
