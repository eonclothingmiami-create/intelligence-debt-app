import { Money, Decimal, FinancialEngineError } from '@fie/financial-engine';

export type LiquidityInput = {
  cash: Money;
  monthlyFixedBurn: Money;
  monthlyFreeCashFlow: Money;
  proposedExtraDebtPayment: Money;
  /**
   * USER policy — required. How many months of burn to keep as reserve.
   * The engine never assumes "3 months".
   */
  reserveMonths: string;
  /**
   * Optional USER absolute cash floor. Extra payments must not leave cash below this.
   */
  minCashFloor?: Money;
};

export type LiquidityAssumptions = {
  reserveMonths: string;
  reserveAmount: Money;
  minCashFloor: Money | null;
};

export type LiquidityResult = {
  runwayMonths: string | null;
  freeCash: Money;
  maxSafeExtraDebtPayment: Money;
  canAffordExtraPayment: boolean;
  policyUsed: LiquidityAssumptions;
};

export function computeLiquidity(input: LiquidityInput): LiquidityResult {
  const reserve = new Decimal(input.reserveMonths);
  if (!reserve.isFinite() || reserve.lt(0)) {
    throw new FinancialEngineError(
      'MISSING_RESERVE_POLICY',
      'reserveMonths is required user policy (>= 0). The engine does not invent a default reserve.',
    );
  }

  const freeCash = input.monthlyFreeCashFlow;
  const zero = Money.zero(freeCash.currency);
  const reserveAmount = input.monthlyFixedBurn.mul(reserve);
  const surplusFromFlow = freeCash.sub(reserveAmount);
  let maxSafeExtraDebtPayment = surplusFromFlow.isPositive() ? surplusFromFlow : zero;

  const floor = input.minCashFloor ?? null;
  if (floor && floor.isPositive()) {
    const headroomFromCash = input.cash.sub(floor);
    const cashCap = headroomFromCash.isPositive() ? headroomFromCash : zero;
    if (cashCap.lt(maxSafeExtraDebtPayment)) {
      maxSafeExtraDebtPayment = cashCap;
    }
  }

  let runwayMonths: string | null = null;
  if (input.monthlyFixedBurn.isPositive()) {
    runwayMonths = input.cash.div(input.monthlyFixedBurn.decimal).toString();
  }

  const canAffordExtraPayment = input.proposedExtraDebtPayment.lte(maxSafeExtraDebtPayment);

  return {
    runwayMonths,
    freeCash,
    maxSafeExtraDebtPayment,
    canAffordExtraPayment,
    policyUsed: {
      reserveMonths: reserve.toFixed(),
      reserveAmount,
      minCashFloor: floor,
    },
  };
}
