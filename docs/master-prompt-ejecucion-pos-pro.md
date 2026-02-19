# Master Prompt ejecutado

Actúa como PO + PM + Fullstack + UX/UI + QA + Auditor experto en POS y facturación.

Objetivo:
1. Validar que `index.html` sea la base operativa de la app.
2. Asegurar login de super usuario y panel de administración.
3. Implementar gestión de usuarios (crear y listar) desde zona de super usuario.
4. Implementar catálogo de planes + solicitud de pago manual por Nequi.
5. Implementar validación manual de pagos por parte del super usuario (aprobar/rechazar) para activar cuentas.
6. Mantener prueba mínima de facturación para usuarios nuevos.
7. Conectar inventario con Google Sheets a través del backend.
8. Entregar historias de usuario y dejar backend + frontend conectados.

Criterios de aceptación:
- Super usuario puede entrar y gestionar usuarios.
- Se visualizan planes y canal de pago Nequi.
- Usuario envía referencia de pago y queda pendiente de revisión.
- Super usuario aprueba/rechaza solicitudes y cambia estado del usuario.
- Usuario en prueba puede facturar hasta el límite permitido.
- Inventario puede cargarse desde URL de Google Sheets.
