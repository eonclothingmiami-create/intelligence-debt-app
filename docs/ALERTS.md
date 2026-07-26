# Alertas operativas

## Qué es

Avisos automáticos derivados de **hechos del tablero**. No son recomendaciones del CFO AI ni del recommendation-engine.

Regla: si falta un dato, la alerta lo declara; no inventa saldos, vencimientos ni inventario.

## Señales (v1)

| Código                                       | Severidad típica             | Origen                 |
| -------------------------------------------- | ---------------------------- | ---------------------- |
| `LIQUIDITY_POLICY_MISSING`                   | critical                     | Config                 |
| `CLOSINGS_PENDING`                           | warning / critical (≥3 días) | Registro diario        |
| `CASH_TIGHT_AFTER_EARMARKS`                  | critical                     | Capacidad              |
| `PAYROLL_CASH_SHORT`                         | critical                     | Caja vs quincena       |
| `BELOW_CASH_FLOOR`                           | critical                     | Política piso          |
| `RUNWAY_UNDER_*`                             | warning / critical           | Liquidez               |
| `ADS_OVER_BUDGET`                            | warning                      | Publicidad             |
| `BELOW_BREAK_EVEN` / `THIN_SAFETY_MARGIN`    | critical / warning           | BEP                    |
| `INVENTORY_BELOW_MIN`                        | warning / critical           | Hera inventario        |
| `DEBT_DUE_TODAY` / `TOMORROW`                | critical / warning           | Deudas `paymentDueDay` |
| `FIXED_COST_DUE_*`                           | warning / info               | Costos `dueDay`        |
| `MISSING_PAYROLL` / `MISSING_CC_INSTALLMENT` | info                         | Gaps Capacidad         |

## Código

- Motor: [`apps/web/src/lib/alerts.ts`](../apps/web/src/lib/alerts.ts) → `deriveOperationalAlerts`
- UI: tab **Alertas** → [`AlertsPanel.tsx`](../apps/web/src/components/os/AlertsPanel.tsx)
- AI: strings en `FinancialContext.alerts` vía `alertsToContextStrings`

## Fuera de v1

Motor de alertas configurable (umbrales por usuario), push/email, snooze, historial de alertas. Calendario: ver [CALENDAR.md](./CALENDAR.md).
