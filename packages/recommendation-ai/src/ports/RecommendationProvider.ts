import type {
  AiFinancialRecommendation,
  FinancialContext,
  GenerateRecommendationInput,
} from '../context/types.js';

/**
 * Port for external recommendation generators.
 * Swap OpenAI for another vendor without touching the OS engines or UI.
 */
export interface RecommendationProvider {
  readonly name: string;
  generate(input: GenerateRecommendationInput): Promise<AiFinancialRecommendation>;
}

export type { AiFinancialRecommendation, FinancialContext, GenerateRecommendationInput };
