# Registro Diario de Movimientos Financieros

Complementa al ERP (Hera). Distingue **presupuesto** (Costos / Deudas) de **ejecución** (registro diario).

## Presupuesto (una vez)

- Costos fijos con monto + **día de pago** (1–31) → BEP, proyecciones, flujo esperado.
- Obligaciones con cuota + `paymentDueDay`.

## Ejecución (diario)

Al abrir `/app`:

1. ¿Hubo movimientos manuales desde la última actualización?
   - **No** → marca días pendientes sin formulario.
   - **Sí** → registro del día siguiente pendiente.

Formulario:

1. **Pendientes del día** — compromisos que vencen hoy o estánan vencidos. Solo confirmas: Pagado / Parcial / Aplazado.
2. **Gastos extraordinarios** — lo no presupuestado (taxi, reparación…).
3. **Movimientos extraordinarios** — aporte, retiro, activo, etc.
4. **Nueva obligación** (opcional).

Estados de compromiso: `programado` · `pendiente` · `pagado` · `parcial` · `omitido` (con nueva fecha).

## Edge

`fie-os-closing` — `mark-idle`, `POST /:day`, status. Pagos de costo fijo con monto 0 (aplazados) no entran al ledger mensual.
