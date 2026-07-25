# Mathematical Specification — Break-even

**Formula version:** `1.0.0`  
**Currency:** COP (0 decimal settlement by default)  
**Reference:** Local 311 PUNTO EQUILIBRIO spreadsheet

---

## 1. Unit economics

### Full unit cost

\[
C_{unit} = C_{product} + \sum_{v \in V_{active}} c_v
\]

**Example (Local 311):** \(14{,}000 + 3{,}448 = 17{,}448\).

### Contribution margin (per unit)

\[
CM = P - C_{unit}
\]

**Example:** \(34{,}896 - 17{,}448 = 17{,}448\).

### Margin rate

\[
m = \frac{CM}{P}
\]

**Example:** \(17{,}448 / 34{,}896 = 0.5\) (50% utility pricing).

### Price from target utility on full cost

\[
P = C_{unit} \cdot (1 + u)
\]

With \(u = 1\) (100% markup on cost ≈ “utilidad 50%” on price): \(P = 2 \cdot C_{unit}\).

---

## 2. Fixed costs

\[
FC = \sum_{f \in F_{active}} f
\]

**Example:** \(FC = 15{,}195{,}000\).

Credit installments enter as fixed-cost lines (not computed here).

---

## 3. Break-even (no target profit)

### Units

\[
Q_{BE} = \frac{FC}{CM}
\]

**Example:** \(15{,}195{,}000 / 17{,}448 \approx 870.870\ldots\) → displayed **870,87**.

### Money (sales)

\[
S_{BE} = Q_{BE} \cdot P
\]

**Example:** \(\approx 30{,}390{,}000\).

---

## 4. Break-even with target profit \(\pi\)

\[
Q_{BE}(\pi) = \frac{FC + \pi}{CM}, \quad S_{BE}(\pi) = Q_{BE}(\pi) \cdot P
\]

---

## 5. Period scaling

`operatingDaysPerMonth` **D** is supplied by the user (e.g. 26 or 30). There is no engine default.

| Period  | Units                | Money                |
| ------- | -------------------- | -------------------- |
| Monthly | \(Q_{BE}\)           | \(S_{BE}\)           |
| Daily   | \(Q_{BE}/D\)         | \(S_{BE}/D\)         |
| Weekly  | \(Q_{BE} \cdot 7/D\) | \(S_{BE} \cdot 7/D\) |
| Annual  | \(Q_{BE} \cdot 12\)  | \(S_{BE} \cdot 12\)  |

**Example (user chose D=26, Local 311 dataset):** \(870.87/26 \approx 33.50\), \(30{,}390{,}000/26 \approx 1{,}168{,}846\).

---

## 6. Safety margin

Given projected sales \(S_{proj}\):

\[
SM = S_{proj} - S_{BE}, \quad sm\% = \frac{SM}{S_{proj}}
\]

Positive \(SM\) ⇒ above break-even.

---

## 7. Multi-product (weighted)

For mix with weights \(w_i\) (\(\sum w_i = 1\)):

\[
CM_{avg} = \sum w_i \cdot CM_i, \quad P_{avg} = \sum w_i \cdot P_i
\]

Then apply §3–§4 with \(CM_{avg}\), \(P_{avg}\).

---

## References

1. Garrison, Noreen, Brewer — contribution margin & break-even.
2. Local 311 operational spreadsheet (empirical calibration).
