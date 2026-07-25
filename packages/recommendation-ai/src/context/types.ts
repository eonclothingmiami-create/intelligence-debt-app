/**
 * Snapshot of already-computed Financial OS facts.
 * AI must not invent or recalculate these values.
 */
export type FinancialContext = {
  generatedAt: string;
  currency: string;
  sales: {
    dayNet: string | null;
    dayCount: number | null;
    monthNet: string | null;
    monthCount: number | null;
    accumulatedNet: string | null;
    accumulatedCount: number | null;
    source: string;
  };
  breakEven: {
    breakEvenSales: string | null;
    projectedSales: string | null;
    safetyMargin: string | null;
    safetyMarginRate: string | null;
    contributionMarginRate: string | null;
    totalFixedCosts: string | null;
  };
  liquidity: {
    cash: string | null;
    monthlyFixedBurn: string | null;
    monthlyFreeCashFlow: string | null;
    reserveMonths: string | null;
    runwayMonths: string | null;
    maxSafeExtraDebtPayment: string | null;
  };
  health: {
    score: number | null;
    riskLevel: string | null;
  };
  engineRecommendation: {
    action: string | null;
    suggestedExtraDebtPayment: string | null;
    adjustedMaxSafeExtraDebtPayment: string | null;
    valid: boolean | null;
    rationale: string[];
  };
  debts: {
    totalBalance: string | null;
    estimatedMonthlyInterest: string | null;
    monthlyInstallmentsDue: string | null;
    obligationCount: number | null;
    allowsExtraPaymentCount: number | null;
    optimizerSuggestedTarget: string | null;
    optimizerSuggestedAmount: string | null;
    optimizerRationale: string[];
    obligations: Array<{
      label: string;
      kindLabel: string;
      balance: string;
      estimatedMonthlyInterest: string | null;
      allowsExtraPayments: boolean;
      interestOnlyPayments: boolean;
      ratePercent: string | null;
      ratePeriodicity: string;
      purpose: string | null;
    }>;
  };
  marketing: {
    totalBudget: string | null;
    totalActual: string | null;
    freedCapacityAmount: string | null;
    overspendAmount: string | null;
    channels: Array<{
      label: string;
      budget: string;
      actual: string;
    }>;
  };
  costs: {
    fixedCostLines: Array<{
      label: string;
      category: string;
      amount: string;
    }>;
  };
  /** Explicit gaps the CFO prompt must acknowledge — filled by buildFinancialContext. */
  missingFields: string[];
  alerts: string[];
  notes: string[];
};

export type AiFinancialRecommendation = {
  executiveSummary: string;
  currentSituation: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
  justification: string;
  expectedImpact: string;
  confidenceLevel: 'alta' | 'media' | 'baja' | string;
  missingInformation: string[];
};

export type GenerateRecommendationInput = {
  context: FinancialContext;
};
