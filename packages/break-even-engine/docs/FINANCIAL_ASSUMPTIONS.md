# Break-even assumptions

**Assumption set:** `2.0.0` — zero hardcoded finance

| ID      | Rule                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------- |
| A-BE-1  | Only **active** line items enter sums.                                                          |
| A-BE-2  | User may add/edit/disable/reorder/categorize costs without code changes.                        |
| A-BE-3  | Money uses Decimal; settlement scale comes from currency conventions in Money.                  |
| A-BE-4  | `operatingDaysPerMonth` is **required user input**. Engine never assumes 26 or 30.              |
| A-BE-5  | Credit quotas affect BEP only when present as user cost lines.                                  |
| A-BE-6  | Target profit is optional **input**; when set, additive in the numerator.                       |
| A-BE-7  | Zero/negative CM throws `NON_POSITIVE_MARGIN`.                                                  |
| A-BE-8  | Snapshots are immutable outputs.                                                                |
| A-BE-9  | **Break-even is never an input** and must never be edited as source of truth.                   |
| A-BE-10 | Utility % / sale prices are user inputs; helpers like `priceFromUtility` require an explicit %. |
| A-BE-11 | Example datasets (Local 311) exist only for tests — not product defaults.                       |
