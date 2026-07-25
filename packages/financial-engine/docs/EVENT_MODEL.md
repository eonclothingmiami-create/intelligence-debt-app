# Event Model

**Package:** `@fie/financial-engine`  
**Event schema version:** `1.0.0`

Events are immutable facts. Payloads use string decimals for money (`"1000000.00"`) at the serialization boundary; in-process types use `Money`.

---

## Envelope (all events)

```ts
type DomainEventBase = {
  eventId: string; // UUID
  type: string; // discriminant
  creditId: string; // aggregate id
  occurredOn: string; // ISO date YYYY-MM-DD
  recordedAt?: string; // optional ISO timestamp (audit; not used in accrual math)
  sequence: number; // monotonic per credit
  schemaVersion: 1;
  formulaVersion: string; // e.g. "1.0.0"
  meta?: Record<string, string>;
};
```

---

## Catalog

### CreditOpened

**When:** Facility created.  
**Payload:** `{ currency, productType, annualEffectiveRate, dayCountConvention, statementDay, paymentDueDay, minPaymentRate, minPaymentFloor, graceEnabled, extraPaymentTarget, lateDailyRate? }`  
**Fold:** Initializes config & zero balances.

### PurchaseCreated

**When:** Purchase / charge posted.  
**Payload:** `{ purchaseId, amount, installments, category?, merchant?, graceEligible?, deferredInterestMode? }`  
**Fold:** If `installments <= 1`, increase revolving principal; else create installment plan + `InstallmentGenerated` lines (same transaction may emit multiple events).

### InstallmentGenerated

**When:** Deferred schedule line created or due.  
**Payload:** `{ purchaseId, installmentId, installmentNumber, totalInstallments, principalAmount, dueOn }`  
**Fold:** Adds to installment schedule; on due, increases `installmentsDue`.

### PaymentReceived

**When:** Customer payment captured.  
**Payload:** `{ paymentId, amount, method? }`  
**Fold:** Does not change balances alone; must be followed by allocation events (engine command handler emits both).

### PaymentAllocated

**When:** Portion of payment applied to a bucket.  
**Payload:** `{ paymentId, bucket: LateFee|Interest|Insurance|Commission|RevolvingPrincipal|InstallmentPrincipal, amount, installmentId? }`  
**Fold:** Reduces corresponding due/principal bucket.

### ExtraPaymentApplied

**When:** Surplus after dues.  
**Payload:** `{ paymentId, amount, target: revolving_first|installments_first|pro_rata, details? }`  
**Fold:** Reduces principal per target policy.

### InterestAccrued

**When:** Interest calculated (usually statement close or daily batch).  
**Payload:** `{ amount, periodFrom, periodTo, rateUsed, method: adb|daily|simple, baseAmount }`  
**Fold:** Increases interest due / may capitalize if policy says so.

### InterestCapitalized

**When:** Billed interest added to revolving principal.  
**Payload:** `{ amount, statementId }`  
**Fold:** interest due ↓, revolving principal ↑.

### StatementClosed

**When:** Billing cycle closed.  
**Payload:** `{ statementId, periodFrom, periodTo, cutOffOn, dueOn, minimumPayment, interestBilled, feesBilled, closingPrincipal, closingTotalDue }`  
**Fold:** Stores statement snapshot fields on derived state; resets cycle counters.

### RateChanged

**Payload:** `{ annualEffectiveRate, effectiveOn, previousRate }`  
**Fold:** Updates rate from `effectiveOn` (split accrual per Math Spec).

### TermChanged

**Payload:** `{ purchaseId, newTotalInstallments, remainingPrincipal }`  
**Fold:** Rebuilds remaining installment schedule.

### LateFeeApplied

**Payload:** `{ amount, reason, daysLate }`  
**Fold:** Increases fees due.

### InsuranceCharged

**Payload:** `{ amount, insuranceId?, periodFrom?, periodTo? }`  
**Fold:** Increases insurance due.

### CommissionCharged

**Payload:** `{ amount, commissionType }`  
**Fold:** Increases commission due.

### Refinanced

**Payload:** `{ refinanceId, newCreditId?, principalMoved, terms }`  
**Fold:** Product-specific; typically zeroes old principals and links transfer events.

### AdjustmentApplied

**Payload:** `{ amount, direction: debit|credit, reason, bucket }`  
**Fold:** Compensating correction.

### ReversalIssued

**Payload:** `{ reversesEventId, reason }`  
**Fold:** Applies inverse economic effect of target event.

### StatementImported

**Payload:** `{ externalStatementId, bank, periodFrom, periodTo, reportedBalance, rawHash }`  
**Fold:** May emit follow-up adjustments to align engine state to bank (import pipeline); engine records fact for audit/golden tests.

### BudgetProjectionSet

**When:** User sets a **planned** marketing budget (not an actual charge).  
**Payload:** `{ plannedDailyAdBudget, from, to, channelId? }`  
**Fold:** Updates `plannedDailyAdBudget` only. Does **not** change revolving principal.

### AdSpendActualRecorded

**When:** Platform actually charged (TikTok/Meta/etc.).  
**Payload:** `{ channelId, actualAmount, linkedPurchaseId?, externalRef? }`  
**Fold:** Accumulates `actualAdSpendTotal`. Debt impact requires a paired `PurchaseCreated` (or card movement) with the same amount.

---

## Command → events (examples)

| Command                   | Events emitted                                                      |
| ------------------------- | ------------------------------------------------------------------- |
| Open credit               | `CreditOpened`                                                      |
| Post purchase (revolving) | `PurchaseCreated`                                                   |
| Post purchase (36 cuotas) | `PurchaseCreated` + N× `InstallmentGenerated` (or lazy generation)  |
| Post payment              | `PaymentReceived` + N× `PaymentAllocated` [+ `ExtraPaymentApplied`] |
| Close statement           | `InterestAccrued` [+ fee events] + `StatementClosed`                |
| Change rate               | `RateChanged`                                                       |
| Import bank statement     | `StatementImported` [+ adjustments]                                 |

---

## Ordering

1. Sort by `occurredOn` ascending.
2. Tie-break by `sequence` ascending.
3. Fold is a left reduction; no parallel mutation.

---

## Serialization

JSON fixtures use string amounts:

```json
{
  "type": "PurchaseCreated",
  "creditId": "crd_1",
  "occurredOn": "2026-01-05",
  "sequence": 2,
  "payload": { "purchaseId": "p1", "amount": "1500000", "installments": 1 }
}
```
