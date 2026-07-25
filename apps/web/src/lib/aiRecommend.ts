import {
  buildFinancialContext,
  type AiFinancialRecommendation,
  type FinancialContext,
  type FinancialContextBoardInput,
} from '@fie/recommendation-ai';
import { getStoredOpenAiKey } from '@/lib/openaiKey';

const RECOMMEND_URL =
  process.env.NEXT_PUBLIC_RECOMMEND_URL ??
  'https://niilaxdeetuzutycvdkz.supabase.co/functions/v1/fie-recommend';

const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paWxheGRlZXR1enV0eWN2ZGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjc0NjIsImV4cCI6MjA4ODk0MzQ2Mn0.GI8E7vRzxi5NumN_f4T432Lx4BcmgGLZo81BR9h3h8c';

/**
 * Assembles board facts into FinancialContext (no OpenAI).
 * OpenAI is only invoked on the backend via requestAiRecommendation.
 */
export function assembleBoardFinancialContext(input: FinancialContextBoardInput): FinancialContext {
  return buildFinancialContext(input);
}

/**
 * Calls backend RecommendationProvider (Edge).
 * User OpenAI key (if connected) is sent as x-openai-api-key — never used in React for OpenAI SDK.
 */
function recommendHeaders(): Record<string, string> {
  const userKey = getStoredOpenAiKey();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ANON_KEY}`,
    apikey: ANON_KEY,
  };
  if (userKey) {
    headers['x-openai-api-key'] = userKey;
  }
  return headers;
}

export async function requestAiRecommendation(
  context: FinancialContext,
): Promise<AiFinancialRecommendation> {
  const res = await fetch(RECOMMEND_URL, {
    method: 'POST',
    headers: recommendHeaders(),
    body: JSON.stringify({ mode: 'recommendation', context }),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    recommendation?: AiFinancialRecommendation;
    error?: string;
    message?: string;
    detail?: string;
  };
  if (!res.ok || !body.recommendation) {
    throw new Error(body.message || body.detail || body.error || `Recomendación AI ${res.status}`);
  }
  return body.recommendation;
}

export type LiquidityPolicySuggestion = {
  suggestedReserveMonths: string;
  suggestedMinCashFloor: string | null;
  reserveIsHardFloor: boolean;
  rationale: string;
  confidenceLevel: string;
  questionsForUser: string[];
};

/** AI draft only — never auto-saves. User must confirm in Políticas. */
export async function requestLiquidityPolicySuggestion(
  context: FinancialContext,
): Promise<LiquidityPolicySuggestion> {
  const res = await fetch(RECOMMEND_URL, {
    method: 'POST',
    headers: recommendHeaders(),
    body: JSON.stringify({ mode: 'liquidity_policy', context }),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    suggestion?: LiquidityPolicySuggestion;
    error?: string;
    message?: string;
    detail?: string;
  };
  if (!res.ok || !body.suggestion) {
    throw new Error(
      body.message || body.detail || body.error || `Sugerencia de política ${res.status}`,
    );
  }
  return body.suggestion;
}

export type { AiFinancialRecommendation, FinancialContext };
