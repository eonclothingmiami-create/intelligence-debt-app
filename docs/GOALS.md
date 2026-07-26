# Objetivos

## Qué es

Metas **explícitas** del dueño que Capacidad, Decisión y el CFO AI deben respetar. No son recomendaciones ni KPIs calculados.

## Modelo

| Campo                         | Uso                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `northStar`                   | Visión norte (texto libre confirmado)                                                             |
| `kind`                        | profit, debt_reduction, debt_clear, sales, ads_budget_cap, cash_reserve, liquidity_months, custom |
| `targetAmount` / `targetDate` | Meta cuantitativa y horizonte (opcionales)                                                        |
| `relatedObligationId`         | Para `debt_clear` — deuda concreta                                                                |
| `status`                      | active / paused / achieved / abandoned                                                            |

## Código

- Store: [`apps/web/src/lib/goalsStore.ts`](../apps/web/src/lib/goalsStore.ts)
- UI: tab **Objetivos** → [`GoalsPanel.tsx`](../apps/web/src/components/os/GoalsPanel.tsx)
- Sync: al guardar, montos `profit` / `debt_reduction` activos se reflejan en Config (`targetProfitAmount`, `debtReductionTargetAmount`)
- AI: `FinancialContext.goals`

## Relación con Config

Config guarda atajos de meta utilidad / reducción deuda. Objetivos es el catálogo completo. La fuente de verdad operativa para el AI es `goals.*`.

## Fuera de v1

Tracking de cumplimiento histórico, OKRs multi-período, vinculación automática a escenarios.
