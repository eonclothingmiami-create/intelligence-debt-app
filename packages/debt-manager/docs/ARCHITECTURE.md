# Debt Manager — Architecture

**Package:** `@fie/debt-manager`  
**Pillar of the Financial OS** — see [PRODUCT_VISION.md](../../../docs/PRODUCT_VISION.md)

---

## 1. What it is

Configurable **Debt Manager**: user registers every living obligation (TC, leasing, vehículo, proveedor, factoring, tipos inventados…).

| Layer              | Responsibility                           | Location                |
| ------------------ | ---------------------------------------- | ----------------------- |
| **Debt Manager**   | Registry + event history (SoT = usuario) | este paquete            |
| **Debt Engine**    | Math profunda (TC, folding)              | `@fie/financial-engine` |
| **Debt Simulator** | Slider pago → plazos / intereses         | `src/simulator/`        |
| **Debt Optimizer** | Comparar destinos de abono extra         | `src/optimizer/`        |

**Not ERP.** Optional bank sync later. Initially 100% manual.

---

## 2. Living object, not a bare balance

```text
DebtObligation (identidad + reglas)
        +
DebtLifecycleEvent[] (historial)
        ↓ fold
DerivedDebtState (saldo / totales)
```

Events include: desembolso, compra TC, abono ordinario/extraordinario, interés, comisión, cambio de tasa/plazo, refinanciación, cierre.

**Never** treat a single `balance` field as authority without the log.

---

## 3. Rules differ per debt

| Field                  | Why                                             |
| ---------------------- | ----------------------------------------------- |
| `allowsExtraPayments`  | Some products forbid extras                     |
| `prepaymentPenalty`    | Cost of prepago                                 |
| `ratePeriodicity`      | monthly / annual / daily / **none** (proveedor) |
| `kindId` / `kindLabel` | User-extensible — never a closed enum           |
| `engineCreditId`       | Optional bridge to financial-engine card fold   |

---

## 4. Integration with the OS

```text
Debt portfolio dashboard
        ↓
Cash flow (cuotas del mes)
Liquidity (capacidad de pago)
Break-even (líneas de cuota como costo fijo si el usuario las mapea)
Business Health (endeudamiento)
Recommendation Engine (nunca “pague el mayor saldo”)
```

Optimizer ranks by **interest burden (rate × balance)** among debts that allow extras — Recommendation Engine still gates on liquidity / BEP / sales.

---

## 5. Forbidden heuristics

- “Pague primero la de mayor saldo” as a fixed rule
- Ignoring `allowsExtraPayments`
- Isolating a debt from BEP / liquidity / ads reality
