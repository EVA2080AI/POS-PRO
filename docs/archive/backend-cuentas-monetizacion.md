# Backend lógico de cuentas, permisos y monetización (POS Pro v4)

## Nota de arquitectura
Esta implementación funciona sin servidor (zero-backend), por lo tanto la persistencia y sesión se guardan en `localStorage`.

## Módulos implementados
- Registro de usuarios
- Login
- Sesión activa
- Seed de super admin inicial
- RBAC básico (`merchant`, `admin`, `super_admin`)
- Planes (`free`, `pro`) con vencimiento
- Feature flags por usuario

## Operaciones administrativas
- Asignar rol
- Asignar plan
- Extender plan (30 días)
- Forzar vencimiento
- Activar/desactivar feature puntual

## Función crítica de autorización
`hasFeature(featureKey)` valida:
1. sesión activa
2. usuario existente
3. estado de plan (vigente/no vencido)
4. override de feature
5. fallback por plan/free

## Limitaciones (importante)
- Seguridad: al ser localStorage, no sustituye un backend real.
- Contraseñas: demo local (en texto plano), debe migrar a hash + backend.
- Multi-dispositivo: no sincroniza datos.

## Próximo paso recomendado
Migración a backend real (Node/Express + Postgres + JWT):
- `/auth/register`, `/auth/login`
- `/admin/users`, `/admin/plans`
- `/billing/subscriptions`
- `/features/evaluate`
