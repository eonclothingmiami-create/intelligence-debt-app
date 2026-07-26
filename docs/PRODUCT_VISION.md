# Visión del producto — Business Financial Operating System

**Nombre:** Financial OS  
**Rol:** Director Financiero (CFO) digital de la empresa.

---

## Qué NO es

| No es                        | Por qué                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| Un ERP                       | El ERP (Ventas Hera) es la fuente operativa; el OS es cliente        |
| Software contable            | No busca asientos ni libros; busca **decisiones**                    |
| Solo administrador de deudas | La deuda es un módulo; el objetivo es la **salud financiera global** |

---

## Filosofía

El sistema **no** decide por:

- intuición;
- reglas fijas genéricas (“siempre pague la tarjeta”);
- fechas del calendario sin datos;
- promedios inventados sin historial del negocio.

Cada recomendación debe sustentarse en **datos reales** del negocio (ERP + inputs del usuario + políticas configurables).

**Sin supuestos silenciosos.** Ver [CONFIGURATION_PRINCIPLE.md](./CONFIGURATION_PRINCIPLE.md).

---

## Objetivo principal

Maximizar la **salud financiera** mediante un manejo eficiente del dinero.

Toda recomendación busca el **equilibrio simultáneo** entre:

1. Mantener liquidez
2. Reducir deuda
3. Proteger el flujo de caja
4. Aumentar patrimonio
5. Mantener la operación
6. Optimizar el uso del efectivo

**Nunca** optimizar una variable sacrificando las demás.

### Regla más importante

**Nunca recomendar una acción que comprometa la operación.**  
Reducir deuda importa; **mantener viva la empresa es prioritario.**  
Toda recomendación debe respetar la **liquidez mínima configurable** por el usuario.

---

## Fuentes de información (reales)

| Dominio    | Origen                                                   | Ejemplos                                                                              |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Ventas     | ERP (eventos/API)                                        | Día, mes, canal, producto, margen, ticket, devoluciones                               |
| Gastos     | Usuario (+ eventos ERP si aplica)                        | Fijos, variables, ads, nómina, arriendo, impuestos                                    |
| Deudas     | **Usuario** (`@fie/debt-manager`, historial por eventos) | TC, leasing, proveedores, tipos inventados; opcional bridge a `@fie/financial-engine` |
| Caja       | Usuario / proyecciones                                   | Bancos, disponible, reservas, flujo                                                   |
| Objetivos  | Usuario (políticas)                                      | Utilidad, liquidez mín., reserva, meta ventas, pago deuda                             |
| Publicidad | Usuario plan vs real                                     | Presupuesto por canal vs cobro real                                                   |

El OS **no** modifica ventas del ERP. Solo las consume. Ver [ERP_INTEGRATION.md](./ERP_INTEGRATION.md).

---

## Motor de decisiones

```text
Ventas + Gastos + Deudas + Caja + Ads + BEP (reales)
        ↓
   @fie/financial-orchestrator (valida → capacidad → motores)
        ↓
   Capacidad Financiera (6 preguntas) + recomendación + impacto
        ↓
   Dashboard / Decisión / CFO AI
```

Detalle de Capacidad + orquestador: [CAPACITY.md](./CAPACITY.md).

El dashboard **no** es el producto; es la superficie. El producto es la capacidad de responder:

- ¿Qué hago con mi dinero **hoy**?
- ¿Qué decisión **más fortalece** la empresa?
- ¿Cómo reduzco deudas **sin** poner en riesgo la operación?

### Criterio de éxito

**No** se mide por cantidad de reportes o gráficos.  
**Sí** se mide por respuestas concretas, matemáticas y accionables.

---

## Contrato de toda recomendación

Obligatorio:

1. Basarse en datos reales (inputs trazables).
2. Tener justificación matemática.
3. Explicar **por qué** esa acción.
4. Mostrar **impacto financiero esperado**.

Prohibido responder solo: _“Pague esta deuda.”_

Formato esperado:

> Se recomienda un abono extraordinario de $X porque:
>
> - liquidez / runway …
> - punto de equilibrio …
> - ventas reales del período …
> - ahorro de intereses proyectado …
> - flujo operativo permanece …

---

## Capital como recurso limitado

Ante efectivo disponible, el OS debe **comparar destinos** (no asumir “siempre deuda”):

- Abonar deuda
- Inventario
- Publicidad
- Guardar liquidez / reserva
- No hacer nada

…y justificar con el mismo contrato (datos + impacto + operación preservada).

---

## Business Health Score

La salud es **global**, no “una deuda sana”.

Componentes a evaluar de forma continua (pesos = política del usuario):

- Liquidez / runway
- Flujo de caja
- Punto de equilibrio / margen de seguridad
- Rentabilidad
- Cobertura de deuda
- Crecimiento (cuando hay historial)
- Uso del efectivo
- Capital de trabajo
- Endeudamiento

Implementación actual del score: `@fie/risk-engine` (`computeBusinessScore`). Evoluciona hacia el **Business Health Engine** de la arquitectura objetivo.

---

## Pilar: Debt Manager

La deuda **no** se modela solo como un saldo. Cada obligación es un **objeto financiero vivo** con reglas propias (abonos extra, tasa variable/fija, TC, leasing, proveedor sin interés, tipos creados por el usuario).

```text
@fie/debt-manager          → registro + eventos (SoT usuario)
@fie/financial-engine      → Debt Engine (math TC / folding)
debt-manager/simulator     → escenarios de pago (slider)
debt-manager/optimizer     → ranking de abono (carga de interés, no “mayor saldo”)
        ↓
Cash flow · Liquidez · BEP · Health · Recommendation
```

Historial obligatorio por eventos: desembolso, compra, abono ordinario/extra, interés, comisión, cambio de tasa/plazo, refinanciación, cierre.

**Nunca** “pague primero la de mayor saldo” como regla fija.  
Ver [packages/debt-manager/docs/ARCHITECTURE.md](../packages/debt-manager/docs/ARCHITECTURE.md).

---

## Arquitectura objetivo

```text
ERP (Ventas Hera)
        │
        ▼
ERP Integration Layer     (@fie/erp-integration + @fie/api)
        │
        ▼
Financial Data Model      (eventos de dominio + políticas de workspace)
        │
        ▼
Financial Engines
 ├── Financial Orchestrator   @fie/financial-orchestrator (composición + capacidad)
 ├── Cash Flow Engine         @fie/cashflow-engine
 ├── Break-even Engine        @fie/break-even-engine
 ├── Liquidity Engine         @fie/liquidity-engine
 ├── Debt Manager             @fie/debt-manager (registro + eventos)
 ├── Debt Engine              @fie/financial-engine
 ├── Debt Simulator           @fie/debt-manager/simulator
 ├── Debt Optimizer           @fie/debt-manager/optimizer
 ├── Budget Engine            (plan vs ejecución; ads + costos — en evolución)
 ├── Forecast Engine          @fie/simulation-engine (escenarios / horizonte)
 ├── Scenario Engine          @fie/simulation-engine / what-if BEP
 ├── Optimization Engine      @fie/optimization-engine
 ├── Recommendation Engine    @fie/recommendation-engine
 └── Business Health Engine  @fie/risk-engine → health score
        │
        ▼
Dashboard + explicación     @fie/web (+ API)
```

Roadmap explícito (post Fase 1 Capacidad): Centro de Configuración completo, Alertas, Calendario, Objetivos, KPIs, Supuestos, Reportes, Versiones de costos, Auditoría global, Historial de recomendaciones. Ver [CAPACITY.md](./CAPACITY.md).

---

## Preguntas que el sistema debe poder responder

- ¿Puedo hacer un abono extraordinario este mes? ¿Cuánto, sin afectar operación?
- ¿Debo conservar caja?
- ¿Gasto de más en publicidad (plan vs real)?
- ¿Cuánto debo vender para cubrir obligaciones?
- ¿Qué deuda atacar primero? ¿Costo de la estrategia actual?
- ¿Puedo contratar / subir ads / comprar inventario?
- ¿Qué pasa si ventas −15 % o +20 %?

Cada respuesta: **datos → matemática → justificación → impacto → liquidez mínima intacta**.
