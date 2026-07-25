import { FINANCIAL_RECOMMENDATION_SYSTEM_PROMPT } from '../../prompt/financial-recommendation-system-prompt.js';
import type {
  AiFinancialRecommendation,
  GenerateRecommendationInput,
} from '../../context/types.js';
import type { RecommendationProvider } from '../../ports/RecommendationProvider.js';

export type OpenAIProviderConfig = {
  apiKey: string;
  /** Defaults to gpt-4o-mini */
  model?: string;
  baseUrl?: string;
};

/**
 * Sole class allowed to talk to OpenAI.
 * Never import this from React components — call via API / Edge only.
 */
export class OpenAIRecommendationProvider implements RecommendationProvider {
  readonly name = 'openai';

  constructor(private readonly config: OpenAIProviderConfig) {
    if (!config.apiKey?.trim()) {
      throw new Error('OPENAI_API_KEY is required');
    }
  }

  async generate(input: GenerateRecommendationInput): Promise<AiFinancialRecommendation> {
    const baseUrl = (this.config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = this.config.model ?? 'gpt-4o-mini';

    const userPayload = {
      instruction:
        'Analiza el siguiente contexto financiero del Business Financial OS y emite la recomendación JSON requerida.',
      context: input.context,
    };

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: FINANCIAL_RECOMMENDATION_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${detail.slice(0, 400)}`);
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) throw new Error('OpenAI returned empty content');

    return parseRecommendationJson(raw);
  }
}

/** @deprecated Prefer OpenAIRecommendationProvider — alias for Architecture/OpenAI naming. */
export { OpenAIRecommendationProvider as OpenAIProvider };

export function parseRecommendationJson(raw: string): AiFinancialRecommendation {
  const parsed = JSON.parse(raw) as Partial<AiFinancialRecommendation>;
  return {
    executiveSummary: String(parsed.executiveSummary ?? ''),
    currentSituation: String(parsed.currentSituation ?? ''),
    strengths: asStringArray(parsed.strengths),
    risks: asStringArray(parsed.risks),
    recommendations: asStringArray(parsed.recommendations),
    justification: String(parsed.justification ?? ''),
    expectedImpact: String(parsed.expectedImpact ?? ''),
    confidenceLevel: String(parsed.confidenceLevel ?? 'baja'),
    missingInformation: asStringArray(parsed.missingInformation),
  };
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}
