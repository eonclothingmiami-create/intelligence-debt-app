# Versiones de costos

## Qué es

Historial con **fecha de vigencia** del presupuesto de costos fijos.

Ejemplo:

| Costo    | Vigente desde | Monto     |
| -------- | ------------- | --------- |
| Arriendo | 2025-01       | 2.500.000 |
| Arriendo | 2026-01       | 3.000.000 |

El catálogo vivo en Costos sigue alimentando el BEP de hoy. El historial permite que motores / reportes / AI sepan qué monto aplicaba en cada fecha (`projectModelAsOf`).

## Qué no es

- No son pagos reales (eso es cierre diario / `fixedCostsThisMonth`).
- No son supuestos a futuro ([ASSUMPTIONS.md](./ASSUMPTIONS.md)).
- No inventa vigencias: la primera versión de una línea exige el monto anterior **y** desde cuándo aplicaba.

## Código

| Capa            | Ruta                                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| Resolución pura | `packages/break-even-engine/src/catalog/versions.ts` (`amountAsOf`, `projectModelAsOf`) |
| Persistencia UI | `apps/web/src/lib/costVersionsStore.ts` (`fie.os.costVersions.v1`)                      |
| UI              | pestaña **Costos** → `CostVersionsPanel`                                                |
| AI              | `FinancialContext.costs.amountVersions`                                                 |

## Flujo

```text
Registrar versión (monto + YYYY-MM)
        ↓
Preserva segmento anterior (si es la 1ª vez)
        ↓
Actualiza monto vivo del catálogo → BEP actual
        ↓
historyByLineId → projectModelAsOf(date) para histórico
```

## Relacionado

- Costos / BEP: catálogo en OsShell (tab Costos)
- Pagos del mes: registro diario
- Roadmap restante: Auditoría global · Historial de recomendaciones
