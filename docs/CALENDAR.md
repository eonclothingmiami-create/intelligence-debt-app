# Calendario de vencimientos

## Qué es

Vista mensual de **pagos y hitos** ya configurados: costos fijos (`dueDay`), deudas (`paymentDueDay`), días de cierre formal (Config), quincenas (si hay nómina), recompra proyectada (si hay ciclo en Config).

No inventa fechas. Si un costo no tiene día de pago, no aparece.

## Fuentes

| Evento                | Origen                                       |
| --------------------- | -------------------------------------------- |
| Costo fijo            | Catálogo BEP · `dueDay`                      |
| Deuda / cuota         | Debt manager · `paymentDueDay` + monto cuota |
| Cierre formal         | Config · `closingDaysOfMonth` (ej. `15,30`)  |
| Quincena              | Nómina en costos → días 15 y fin de mes      |
| Recompra proyectada   | Config · `inventoryRestockCycleDays` (hints) |
| Estado pagado/parcial | Ledger de compromisos (`commitmentSchedule`) |

## Código

- Motor: [`apps/web/src/lib/calendar.ts`](../apps/web/src/lib/calendar.ts)
- UI: tab **Calendario** → [`CalendarPanel.tsx`](../apps/web/src/components/os/CalendarPanel.tsx)
- AI: `FinancialContext.calendar.upcoming`

## Relación con Alertas / Movimientos

- Alertas de “vence hoy/mañana” enlazan al Calendario.
- Confirmación de pago sigue en **Movimientos** (registro diario).

## Fuera de v1

Recurrencias multi-mes, impuestos DIAN como catálogo propio, sync Google Calendar, vistas semanal/agenda.
