# Financial Orchestrator

Paquete: `@fie/financial-orchestrator`

## Rol

No calcula fórmulas nuevas. Coordina los motores especializados y entrega **un** estado financiero consistente (`BoardSnapshot`) al dashboard, a Decisión y al CFO AI.

| Sí                                       | No                                      |
| ---------------------------------------- | --------------------------------------- |
| Validar que no falten datos              | Inventar caja, BEP o reservas           |
| Ejecutar motores en orden fijo           | Llamar motores entre sí                 |
| Resolver dependencias (capacidad → liq.) | Sustituir lógica de break-even / deuda  |
| Empaquetar contexto único                | Decidir política de negocio por defecto |

## Pipeline

```text
validateBoardInputs
        ↓
deriveCapacity          (6 preguntas del dueño)
        ↓
computeBreakEven        (@fie/break-even-engine)
        ↓
computeLiquidity        (@fie/liquidity-engine)
        ↓
rankDebtsForExtraPayment (@fie/debt-manager)
        ↓
recommendBusinessAction (@fie/recommendation-engine)
        ↓
computeBusinessScore    (@fie/risk-engine; defaults desde hechos del board)
        ↓
BoardSnapshot (+ pipeline[])
```

Orden exportado como `BOARD_PIPELINE`.

## API pública

| Función                     | Uso                                            |
| --------------------------- | ---------------------------------------------- |
| `validateBoardInputs`       | Gaps de hechos antes de correr motores         |
| `deriveCapacity`            | Solo capacidad (UI Capacidad / preview)        |
| `runBoard`                  | Entrada única para Decisión / AI / reportes    |
| `deriveRiskInputsFromBoard` | Score desde BEP + runway + deudas + inventario |

La web arma hechos con `buildBoardInput` / `runOsBoard` (`apps/web/src/lib/board.ts`) y llama `actionRunBoard`. La shell **no** secuencia riesgo ni inventa componentes de score: pasa `inventoryHint` opcional y deja el resto al orquestador.

## Motores compuestos (sin acoplamiento cruzado)

- `@fie/break-even-engine`
- `@fie/liquidity-engine`
- `@fie/debt-manager`
- `@fie/recommendation-engine`
- `@fie/risk-engine`

Nuevos motores se enganchan en `runBoard` + `BOARD_PIPELINE`, no desde la UI ni entre paquetes hermanos.

## Relacionado

- Capacidad (6 preguntas): [CAPACITY.md](./CAPACITY.md)
- Visión de producto: [PRODUCT_VISION.md](./PRODUCT_VISION.md)
