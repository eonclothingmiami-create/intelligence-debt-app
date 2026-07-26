# Capacidad Financiera + Orquestador (Fase 1)

## Qué es

La pestaña **Capacidad** responde las seis preguntas del dueño con hechos del tablero:

1. ¿Cuánto puedo gastar hoy?
2. ¿Cuánto puedo invertir?
3. ¿Cuánto puedo abonar a deuda?
4. ¿Cuánto inventario puedo recomprar?
5. ¿Cuánto puedo retirar como utilidad?
6. ¿Cuánto puedo destinar a publicidad?

Los montos salen de `@fie/financial-orchestrator` (`deriveCapacity` / `runBoard`). El orquestador **no inventa fórmulas**: valida inputs, ejecuta motores en orden y expone un `BoardSnapshot`. Detalle de coordinación: [ORCHESTRATOR.md](./ORCHESTRATOR.md).

**Gastar hoy** ≠ **invertir**: liquidez inmediata post-earmarks vs excedente que ya respeta la reserva. Capacidad es la pestaña home por defecto.

## Flujo

```text
Caja + % recompra + nómina + cuota TC + política (reserva / piso)
        ↓
validateBoardInputs
        ↓
deriveCapacity  →  6 respuestas + gaps
        ↓
break-even → liquidity → debt optimizer → recommend + score
        ↓
BoardSnapshot → Capacidad UI · Decisión · FinancialContext.capacity (AI)
```

## Config

Capacidad lee reglas del **Centro de Configuración** ([CONFIGURATION.md](./CONFIGURATION.md)):

| Campo                          | Dónde                                              |
| ------------------------------ | -------------------------------------------------- |
| Reserva (meses) + piso de caja | Configuración → Reserva y liquidez (`policyStore`) |
| % recompra earmarked           | Capacidad / `cashStore`                            |
| Moneda display                 | Configuración → Identidad                          |

Alertas operativas: [ALERTS.md](./ALERTS.md). Versiones de costos: [COST_VERSIONS.md](./COST_VERSIONS.md). Auditoría global e historial de recomendaciones siguen en roadmap.

## AI

`FinancialContext.capacity` lleva las seis respuestas precomputadas. El prompt del CFO AI prohíbe recalcularlas. `workspaceConfig` aporta metas y moneda.
