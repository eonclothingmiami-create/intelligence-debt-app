# Capacidad Financiera + Orquestador (Fase 1)

## Qué es

La pestaña **Capacidad** responde las seis preguntas del dueño con hechos del tablero:

1. ¿Cuánto puedo gastar hoy?
2. ¿Cuánto puedo invertir?
3. ¿Cuánto puedo abonar a deuda?
4. ¿Cuánto inventario puedo recomprar?
5. ¿Cuánto puedo retirar como utilidad?
6. ¿Cuánto puedo destinar a publicidad?

Los montos salen de `@fie/financial-orchestrator` (`deriveCapacity` / `runBoard`). El orquestador **no inventa fórmulas**: valida inputs, ejecuta motores en orden y expone un `BoardSnapshot`.

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

## Config mínima (esta fase)

Solo lo que Capacidad necesita:

| Campo                          | Dónde                                               |
| ------------------------------ | --------------------------------------------------- |
| Reserva (meses) + piso de caja | Políticas (`policyStore`)                           |
| % recompra earmarked           | Capacidad / `cashStore`                             |
| Moneda display                 | Modelo BEP (COP) — lectura en Políticas / Capacidad |

El **Centro de Configuración** completo (alertas, calendario, KPIs, objetivos, supuestos, reportes, versiones, auditoría, historial de recomendaciones) es **Fase 2+** — ver roadmap en [PRODUCT_VISION.md](./PRODUCT_VISION.md).

## AI

`FinancialContext.capacity` lleva las seis respuestas precomputadas. El prompt del CFO AI prohíbe recalcularlas.
