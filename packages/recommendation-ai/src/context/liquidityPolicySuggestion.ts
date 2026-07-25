export type LiquidityPolicySuggestion = {
  suggestedReserveMonths: string;
  suggestedMinCashFloor: string | null;
  reserveIsHardFloor: boolean;
  rationale: string;
  confidenceLevel: 'alta' | 'media' | 'baja' | string;
  questionsForUser: string[];
};

export function parseLiquidityPolicySuggestion(raw: string): LiquidityPolicySuggestion {
  const parsed = JSON.parse(raw) as Partial<LiquidityPolicySuggestion>;
  const floor =
    parsed.suggestedMinCashFloor == null || parsed.suggestedMinCashFloor === ''
      ? null
      : String(parsed.suggestedMinCashFloor);
  return {
    suggestedReserveMonths: String(parsed.suggestedReserveMonths ?? ''),
    suggestedMinCashFloor: floor,
    reserveIsHardFloor: parsed.reserveIsHardFloor !== false,
    rationale: String(parsed.rationale ?? ''),
    confidenceLevel: String(parsed.confidenceLevel ?? 'baja'),
    questionsForUser: Array.isArray(parsed.questionsForUser)
      ? parsed.questionsForUser.map((x) => String(x)).filter(Boolean)
      : [],
  };
}
