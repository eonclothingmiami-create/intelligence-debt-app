# Centro de Configuración

## Qué es

Un solo lugar donde el dueño define las **reglas del negocio** que el resto del OS consume (Capacidad, orquestador, costos, registro diario, publicidad, CFO AI).

Sin defaults silenciosos de valores financieros: si un campo está vacío, el sistema lo reporta como gap.

## Campos (PRD)

| Campo                                  | Persistencia                      | Consumidores                       |
| -------------------------------------- | --------------------------------- | ---------------------------------- |
| Moneda                                 | `configStore`                     | Capacidad, liquidez, marketing, AI |
| Inicio año fiscal (mes 1–12)           | `configStore`                     | AI / reportes futuros              |
| Días de cierre (día del mes)           | `configStore`                     | Calendario (Fase 3+)               |
| Días operativos / mes                  | `configStore`                     | Escalado de períodos               |
| Reserva + piso + política liquidez     | `policyStore` (sección en Config) | Orquestador / Capacidad            |
| Meta de utilidad                       | `configStore`                     | AI context                         |
| Meta de reducción de deuda             | `configStore`                     | AI context                         |
| Días promedio recompra inventario      | `configStore`                     | AI / Capacidad notes               |
| Canales de venta activos               | `configStore`                     | Publicidad                         |
| Categorías de gastos                   | `configStore`                     | Costos + gastos extraordinarios    |
| Categorías movimientos extraordinarios | `configStore`                     | Registro diario                    |

## Código

- Tipos: `WorkspaceCentralConfig` en `@fie/shared`
- Store: [`apps/web/src/lib/configStore.ts`](../apps/web/src/lib/configStore.ts)
- UI: tab **Configuración** → [`ConfigPanel.tsx`](../apps/web/src/components/os/ConfigPanel.tsx)
- Liquidez AI: `PoliciesPanel` embebido (misma política que Capacidad)

## Roadmap (no en esta fase)

Alertas · Calendario · Objetivos dedicados · KPIs · Supuestos · Reportes · Versiones de costos · Auditoría global · Historial de recomendaciones.
