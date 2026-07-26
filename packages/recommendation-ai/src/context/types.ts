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
  dailyClosing: {
    seriesStart: string | null;
    today: string | null;
    pendingDays: string[];
    lastClosed: string | null;
    canGenerateRecommendations: boolean | null;
    recentClosings: Array<{
      businessDay: string;
      notes: string | null;
      lineCount: number;
      expensesTotal: string;
      fixedCostPaymentsTotal: string;
      obligationPaymentsTotal: string;
      extraordinaryNet: string;
    }>;
    fixedCostsThisMonth: Array<{
      fixedCostId: string;
      label: string;
      planAmount: string;
      paid: boolean;
      totalPaid: string | null;
      basePaid: string | null;
      lateInterestPaid: string | null;
      otherAdjustmentPaid: string | null;
      paidOn: string | null;
    }>;
    commitments: Array<{
      key: string;
      kind: string;
      label: string;
      scheduledAmount: string;
      status: string;
      paidAmount: string | null;
      dueDay: number;
      deferredTo: string | null;
    }>;
  };
  inventory: {
    units: string | null;
    valueAtCost: string | null;
    valueAtPrice: string | null;
    skuCount: number | null;
    skusWithStock: number | null;
    skusBelowMin: number | null;
    source: string;
  };
  scenarios: {
    immediateCapacity: string | null;
    preferredScenarioId: string | null;
    evaluations: Array<{
      id: string;
      label: string;
      kind: string;
      extraDebtPayment: string;
      restockAllocation: string;
      capacityLeft: string;
      notes: string[];
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
