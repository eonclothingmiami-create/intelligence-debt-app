# KPIs

## Qué es

Indicadores **con nombre** (runway, endeudamiento, cobertura, márgenes, ads, inventario, health score) derivados solo de hechos del tablero.

Si falta un input, el KPI queda en estado `unknown` — **no se inventa** el ratio.

## Grupos

| Grupo        | Ejemplos                                                   |
| ------------ | ---------------------------------------------------------- |
| Liquidez     | Runway, caja, capacidad inmediata, máx. abono seguro       |
| Deuda        | Saldo, interés mes, deuda/ventas, cobertura interés/cuotas |
| Margen / BEP | Contribución, margen de seguridad, punto de equilibrio     |
| Ventas / Ads | Ventas mes, desviación publicidad                          |
| Operación    | Inventario a costo, SKUs bajo mínimo                       |
| Salud        | Business Health Score                                      |

## Código

- Motor: [`apps/web/src/lib/kpis.ts`](../apps/web/src/lib/kpis.ts) → `deriveKpis`
- UI: tab **KPIs** → [`KpisPanel.tsx`](../apps/web/src/components/os/KpisPanel.tsx)
- AI: `FinancialContext.kpis`

## Fuera de v1

ROAS/CAC con atribución, días de inventario / rotación con COGS histórico, widgets personalizables por usuario (`DashboardWidget`), umbrales editables en Config.
