# Supuestos (forward-looking)

## Qué es

Centro de **hipótesis a futuro** del dueño: inflación, alza salarial, tasas, crecimiento de ventas, TRM, horizonte.

Distinto de las **reglas matemáticas del motor** (`packages/financial-engine/docs/FINANCIAL_ASSUMPTIONS.md`), que no se editan en UI.

Vacío = no definido. El OS **no inventa** 3% de inflación ni TRM.

## Campos

| Key                        | Uso                            |
| -------------------------- | ------------------------------ |
| `inflationAnnual`          | Inflación (fracción, ej. 0.05) |
| `salaryIncreaseAnnual`     | Alza nómina                    |
| `interestRateChangeAnnual` | Cambio en costo de deuda       |
| `salesGrowthAnnual`        | Crecimiento de ventas          |
| `fxUsdCop`                 | TRM USD/COP                    |
| `horizonMonths`            | Horizonte de simulación        |

## Código

- Store: [`apps/web/src/lib/assumptionsStore.ts`](../apps/web/src/lib/assumptionsStore.ts)
- UI: tab **Supuestos** → [`AssumptionsPanel.tsx`](../apps/web/src/components/os/AssumptionsPanel.tsx)
- AI: `FinancialContext.assumptions`

## Relación

- **Escenarios**: asignación de caja hoy (no sustituye supuestos).
- **Simulación futura**: consumirá estos valores cuando el forecast engine los lea (roadmap).

## Fuera de v1

Múltiples sets versionados, aplicar supuestos al simulation-engine, sensibilidad tornado.
