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
- Super Admin: `sebastian689@gmail.com` / `Masmela3$` (también permite modo super admin con password)
- Admin prueba: `angela.wilches@pospro.local` / `Angela2026*`
- Usuario operación: `SEBASTIAN` (o `sebastian@pospro.local`) / `Masmela3$`

## Funcionalidades clave
- Zona de super usuario para:
  - Crear usuarios
  - Ver usuarios creados, plan, estado y prueba mínima restante
  - Aprobar/Rechazar solicitudes de pago
- Planes visibles para todos (`trial`, `free`, `pro`)
- Solicitud de activación manual por referencia de pago (Nequi)
- Facturación limitada por prueba mínima para usuarios nuevos
- Importación de inventario desde Google Sheets vía backend
- Historial de facturas conectado al backend

## API nueva/relevante
- `GET /api/plans`
- `POST /api/inventory/import-gsheets`
- `POST /api/payments/request`
- `GET /api/admin/payments`
- `PATCH /api/admin/payments/:id`

## Documentación de producto
- `docs/historias-usuario-superadmin.md`
- `docs/master-prompt-ejecucion-pos-pro.md`
