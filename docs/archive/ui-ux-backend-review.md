# Auditoría rápida UI/UX + lógica (front/back) — POS Pro HTML

## Resumen ejecutivo
Este archivo base tiene una UI sólida y moderna, pero **no está alineado todavía** con la versión “v3 definitiva” que definiste (descuentos avanzados, eliminación total de `alert/confirm/prompt`, y consistencia en estructura de factura). El sistema es usable, pero necesita ajustes para cumplir 100% el estándar funcional objetivo.

## Hallazgos de UI/UX

### Lo que está bien
- Diseño visual consistente (tokens, paneles, jerarquía, densidad de información).
- Flujo principal de caja claro: escáner → carrito → pago → factura.
- Responsive y overlays bien organizados para operación diaria.

### Gaps UX a corregir
1. **Acciones destructivas con `confirm()` del navegador** (cancelar factura, cerrar caja, limpiar inventario).
2. **Mensajes de error/éxito con `alert()`** en vez de modal unificado (`showAlert`).
3. En “Pago” faltan controles de **descuento global % y descuento fijo $** en la interfaz.
4. No hay señal visual de descuento aplicado dentro de totales (línea de descuento y total descuento).

## Hallazgos de lógica/"backend" (en navegador)

1. **No hay descuento por ítem (`disc`)** ni cálculo de descuento global/fijo en `renderCart()`/`confirmPay()`.
2. `confirmPay()` no persiste campos clave esperados en la factura final:
   - `fixedDisc`
   - `totalDisc`
   - `disc` (descuento porcentual en pesos)
3. `renderInvoicePreview()` no imprime desglose de descuento total.
4. El parseo de precios usa una normalización básica; falta robustez tipo `parsePeso()` para formatos COP mixtos (`$7.517,00`, `7.517`, etc.).
5. Inconsistencia menor en el header: se formatea con `fmtInvNum()` al inicio pero luego se actualiza con `#${settings.invoiceCounter}` tras confirmar pago.

## Riesgos operativos
- Diferencias entre total mostrado y total esperado si se agregan descuentos sin normalizar cálculo.
- Dependencia de diálogos nativos del navegador (mala experiencia y menos control en móvil/kiosko).
- Errores silenciosos en importación por formatos de precio regionales.

## Plan de corrección recomendado (orden)
1. Implementar `showAlert(type, msg, cb)` y reemplazar todos los `alert/confirm/prompt`.
2. Agregar UI de descuentos en tab Pago:
   - input `% Dcto global`
   - input `$ Dcto fijo`
3. Reescribir cálculo central:
   - `gross`
   - `disc` (porcentaje en pesos)
   - `fixedDisc`
   - `totalDisc`
   - `subtotal`, `iva`, `total`
4. Incluir estos campos en `confirmPay()` y en `salesHistory`.
5. Renderizar desglose de descuento en vista de factura.
6. Unificar parser de dinero con `parsePeso()` robusto para importaciones.
7. Ajustar numeración de factura para usar siempre `fmtInvNum()` en header y preview.

## Checklist de validación final sugerido
- Escaneo + carrito + cantidades.
- Descuento % por ítem.
- Descuento global %.
- Descuento fijo $.
- Combinación % + $ con topes (nunca total < 0).
- Factura preview/PDF/email con `totalDisc` correcto.
- Sin `alert/confirm/prompt` en todo el flujo.
- Importación con precios COP y US.

## Conclusión
La base está bien construida para operación real, pero para considerarla “definitiva v3” faltan principalmente: **motor de descuentos completo**, **modal propio para todas las alertas/confirmaciones** y **consistencia de datos de factura**.
