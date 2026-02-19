# 🧠 MASTER PROMPT — POS Pro v4 (Cuentas, Admin y Monetización)

## Contexto
POS Pro es un sistema POS colombiano con diseño dark, orientado a scanner y operación rápida. Esta versión incorpora capa de cuentas y control de funcionalidades por plan.

## Objetivo de esta versión
1. Mantener UX del POS (flujo rápido de venta).
2. Añadir backend lógico local para:
   - registro/login
   - roles (`merchant`, `admin`, `super_admin`)
   - planes (`free`, `pro`) con vencimiento
   - permisos finos por feature paga
3. Eliminar `alert/confirm/prompt` y usar modal propio (`showAlert`).

## Estructura de datos (localStorage)
- `posUsersV4`: lista de usuarios
- `posSessionV4`: sesión actual

### Usuario
```json
{
  "id": "uuid",
  "name": "Mi Negocio",
  "email": "owner@negocio.com",
  "pass": "hash-or-password",
  "role": "merchant|admin|super_admin",
  "plan": "free|pro",
  "planExpiresAt": 1735689600000,
  "featureOverrides": {
    "advancedReports": true,
    "multiCaja": false
  }
}
```

## Features con gating
- `basicSale` (free)
- `excelImport` (free)
- `advancedReports` (pro)
- `multiCaja` (pro)
- `autoEmail` (pro)

## Regla de autorización
- Si el usuario no tiene sesión: bloqueado.
- Si plan pro venció: bloqueado salvo features free explícitas.
- `featureOverrides` siempre tiene prioridad sobre defaults del plan.

## Flujo admin
1. Abrir zona admin.
2. Cambiar rol.
3. Cambiar plan.
4. Extender vencimiento (`+30 días`).
5. Habilitar/deshabilitar features pagas por usuario.

## Flujo comercial
1. Cargar ítems.
2. Aplicar descuento por ítem, global %, descuento fijo.
3. Confirmar venta.
4. Guardar factura con:
   - `gross`
   - `disc`
   - `fixedDisc`
   - `totalDisc`
   - `subtotal`
   - `iva`
   - `total`

## Entregable actual
- Archivo ejecutable: `pos-pro-v4.html`
- Documentación maestra: `docs/master-prompt-pos-pro-v4.md`
- Documento backend: `docs/backend-cuentas-monetizacion.md`
