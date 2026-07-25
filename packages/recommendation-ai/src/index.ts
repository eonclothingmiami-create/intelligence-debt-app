export type { RecommendationProvider } from './ports/RecommendationProvider.js';
export type {
  AiFinancialRecommendation,
  FinancialContext,
  GenerateRecommendationInput,
} from './context/types.js';
export type { FinancialContextBoardInput } from './context/buildFinancialContext.js';
export { buildFinancialContext } from './context/buildFinancialContext.js';
export { FINANCIAL_RECOMMENDATION_SYSTEM_PROMPT } from './prompt/financial-recommendation-system-prompt.js';
export {
  OpenAIRecommendationProvider,
  OpenAIProvider,
  parseRecommendationJson,
  type OpenAIProviderConfig,
} from './Infrastructure/OpenAI/OpenAIRecommendationProvider.js';
