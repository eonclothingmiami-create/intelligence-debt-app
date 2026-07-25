# Mathematical Specification

**Package:** `@fie/financial-engine`  
**Formula set version:** `1.0.0`  
**Currency examples:** COP (0 decimal places for settlement; internal calc may use higher precision then round)

Every formula below includes: **origin**, **explanation**, **numeric example**, **reference**.

---

## 0. Notation

| Symbol                   | Meaning                                                 |
| ------------------------ | ------------------------------------------------------- |
| \(P\)                    | Principal / outstanding capital                         |
| \(i\)                    | Periodic interest rate (decimal fraction per period)    |
| \(r_{nom,m}\)            | Nominal annual rate with \(m\) compounding periods/year |
| \(r_{eff}\)              | Effective annual rate (EAR)                             |
| \(i_m\)                  | Monthly rate                                            |
| \(i_d\)                  | Daily rate                                              |
| \(n\)                    | Number of periods                                       |
| \(A\)                    | Level installment (French)                              |
| \(\mathrm{round}(x, s)\) | Rounding to scale \(s\) under documented policy         |

Internal arithmetic uses arbitrary-precision Decimal. Settlement to currency scale uses the credit’s rounding policy (default: half-up to currency decimals).

---

## 1. Rate conversions

### 1.1 Nominal to periodic rate

**Origin:** Compound interest identity.

\[
i = \frac{r_{nom,m}}{m}
\]

**Example:** Nominal 36% annual compounded monthly → \(i_m = 0.36/12 = 0.03\) (3% monthly).

**Reference:** Brigham & Houston, _Fundamentals of Financial Management_; standard compound interest.

### 1.2 Effective annual rate from nominal

\[
r_{eff} = \left(1 + \frac{r_{nom,m}}{m}\right)^{m} - 1
\]

**Example:** \(r_{nom,12}=0.36\) → \(r_{eff}=(1.03)^{12}-1 \approx 0.4258\) (42.58%).

**Reference:** Equivalent rates; Colombia Superintendencia Financiera disclosures often quote EA (efectiva anual).

### 1.3 Nominal from effective (monthly compounding)

\[
r_{nom,12} = 12 \left((1+r_{eff})^{1/12} - 1\right)
\]

### 1.4 Monthly rate from effective annual

\[
i_m = (1+r_{eff})^{1/12} - 1
\]

**Example:** EA 42.58% → \(i_m \approx 0.03\).

### 1.5 Daily rate (actual/365)

Default day-count for revolving cards in this engine (see Assumptions):

\[
i_d = (1+r_{eff})^{1/365} - 1
\]

Alternative (nominal/365 linear), used only when `dayCountConvention = nominal365`:

\[
i_d = \frac{r_{nom,365}}{365}
\]

**Reference:** Day-count conventions (Actual/365, Actual/360); bank product sheets specify which. Engine stores convention on the Credit.

### 1.6 Monthly from daily (365)

\[
i_m = (1+i_d)^{daysInMonth} - 1
\]

For a fixed 30-day billing month assumption when configured:

\[
i_m = (1+i_d)^{30} - 1
\]

---

## 2. Simple and compound interest

### 2.1 Simple interest over \(t\) periods

\[
I = P \cdot i \cdot t
\]

**Example:** \(P=1{,}000{,}000\), \(i_m=0.03\), \(t=1\) → \(I=30{,}000\).

### 2.2 Compound interest

\[
FV = P(1+i)^n, \quad I = FV - P
\]

---

## 3. Revolving credit card interest

### 3.1 Average daily balance (ADB) method

For billing cycle from day \(D_0\) (exclusive of prior close) to \(D_1\) (inclusive), with end-of-day balances \(B_d\):

\[
ADB = \frac{1}{N}\sum_{d=1}^{N} B_d, \quad N = \text{days in cycle}
\]

\[
I_{cycle} = \mathrm{round}(ADB \cdot i_d \cdot N,\; s)
\]

**Explanation:** Interest accrues on daily outstanding revolving principal (and billed interest if capitalized per product rules). Purchases may be grace-eligible if the previous statement is paid in full by due date (see Assumptions A-CC-GRACE).

**Example:** Constant \(B_d=2{,}000{,}000\) for 30 days, \(i_d\) such that monthly ≈ 3%:

\[
I \approx 2{,}000{,}000 \times 0.03 = 60{,}000
\]

**Reference:** Common revolving card practice (US Truth in Lending ADB; Colombian issuers publish EA and apply daily accrual — product-specific; engine parameters capture issuer rules).

### 3.2 When a purchase enters

1. Event `PurchaseCreated` increases outstanding (or creates installment schedule).
2. Same-day balance includes the purchase for ADB unless `graceEligible` and grace applies.
3. Deferred purchases (`installments > 1`) do **not** put full principal into revolving ADB; they generate installment principal due per period.

### 3.3 When a payment enters

1. Event `PaymentReceived` with amount \(Pay\).
2. Allocation order (default): late fees → interest → insurance → commissions → revolving principal → installment principal (oldest first). See Assumptions A-PAY-ORDER.
3. Allocation emits `PaymentAllocated` (and optionally `ExtraPaymentApplied` for surplus to principal).
4. Balance is **not** assigned; next fold recomputes.

### 3.4 Extra payment (abono extraordinario)

Surplus after covering billed interest, fees, and scheduled installment dues reduces revolving principal and/or future installment principal per policy `extraPaymentTarget`:

- `revolving_first` (default)
- `installments_first`
- `pro_rata`

### 3.5 Multiple purchases with different terms

Each purchase \(k\) with term \(N_k\) generates installment amount:

\[
Inst_k = \mathrm{round}(P_k / N_k,\; s)
\]

(Interest on deferred plans may be embedded or charged separately — flag `deferredInterestMode`: `included` | `revolving` | `flat_addon`.)

Minimum payment includes sum of current installment dues + revolving minimum component.

### 3.6 Rate change mid-cycle

Event `RateChanged` at date \(T\):

- Accrue interest on ADB (or daily balances) from cycle start to \(T\) at old rate.
- Accrue from \(T\) to cycle end at new rate.
- Or, if issuer applies new rate only next cycle: store effective from next `StatementClosed` (`rateEffectivePolicy`).

### 3.7 Term change

Event `TermChanged` on a deferred purchase: remaining principal \(P_{rem}\) rescheduled over new remaining installments \(N'\):

\[
Inst' = \mathrm{round}(P_{rem} / N',\; s)
\]

Last installment absorbs remainder to keep \(\sum Inst = P_{rem}\).

### 3.8 Late interest / mora

If payment after due date:

\[
I_{late} = P_{pastDue} \cdot i_{late,d} \cdot daysLate
\]

Plus optional flat `LateFeeApplied`. Rates and fee caps are Credit parameters (Colombian usury ceilings are an app/compliance concern; engine accepts configured caps).

### 3.9 Insurance and commissions

Periodic charges emit `InsuranceCharged` / `CommissionCharged` and increase amount due; they are allocated before principal on payments.

---

## 4. Minimum payment (revolving)

Default formula (configurable):

\[
MinPay = \max\big(
MinFloor,\;
\alpha \cdot RevolvingPrincipal + InterestBilled + FeesBilled + InstallmentsDue
\big)
\]

Typical \(\alpha = 0.05\) (5%) or issuer-specific; `MinFloor` e.g. COP 30,000 — parameters on Credit.

---

## 5. Amortization systems

### 5.1 French (level payment)

\[
A = P \cdot \frac{i(1+i)^n}{(1+i)^n - 1}
\]

Period \(k\) interest: \(I_k = P_{k-1} \cdot i\)  
Principal: \(C_k = A - I_k\)  
\(P_k = P_{k-1} - C_k\)

**Example:** \(P=10{,}000{,}000\), \(i=0.02\), \(n=12\) → compute \(A\) then schedule.

**Reference:** Standard annuity formula (level payment mortgage / consumer loans).

### 5.2 German (level principal)

\[
C = \frac{P}{n}, \quad I_k = P_{k-1} \cdot i, \quad Payment_k = C + I_k
\]

### 5.3 American (interest-only + balloon)

\[
I_k = P \cdot i \quad (k=1..n-1),\quad Payment_n = P + I_n
\]

---

## 6. ROI vs financing cost (ads use case)

For advertising spend \(S\) financed on a card over horizon \(H\) months:

**Financing cost** \(F\) = total interest (+ fees) attributable to those purchases (from simulation).

**Gross commercial return** \(R\) = attributed revenue (or contribution margin) from ads (input; not computed by interest engine).

\[
ROI_{net} = \frac{R - S - F}{S}
\]

\[
Spread = R - S - F
\]

**Recommendation rule (input to optimizer, not a hard bank rule):**

- If \(Spread > 0\) and cash-flow constraint binds → may keep financing.
- If \(F\) dominates or liquidity risk high → accelerate payoff.

**Example:** \(S=5{,}000{,}000\)/month, \(F=180{,}000\), \(R=7{,}000{,}000\) → \(Spread=1{,}820{,}000\), \(ROI_{net}=36.4\%\).

---

## 7. Determinism

Given the same ordered event log, Credit config, `formulaVersion`, and rounding policy, all outputs are bit-identical (Decimal string equality).

No wall-clock, no `Math.random`, no unordered object iteration in calculation paths.

---

## 8. Worked mini-cycle (revolving)

| Day | Event                          | Note                           |
| --- | ------------------------------ | ------------------------------ |
| 1   | Purchase 1,000,000 (revolving) | Balance 1,000,000              |
| 15  | Payment 200,000                | Allocated to principal         |
| 30  | Statement close                | ADB interest on daily balances |

Interest ≈ function of daily balances × \(i_d\) × days; exact golden fixture lives in tests.

---

## References (summary)

1. Brigham, E. F., & Houston, J. F. — compound interest & annuities.
2. Standard French/German/American amortization identities (corporate finance textbooks).
3. Revolving credit ADB — consumer credit disclosures (TILA / issuer product rules).
4. Colombian EA (efectiva anual) quoting practice — Superintendencia Financiera de Colombia educational materials on rates.
