# AI recommendations (OpenAI) — interpretation only

Financial OS engines compute all money facts. OpenAI only interprets a `FinancialContext` snapshot.

## Package

`@fie/recommendation-ai`

- `RecommendationProvider` (port)
- `Infrastructure/OpenAI/OpenAIRecommendationProvider` (sole OpenAI client)
- `prompt/financial-recommendation-system-prompt.ts` (single system prompt)

## Backend endpoints

| Runtime               | Path                                |
| --------------------- | ----------------------------------- |
| Supabase Edge (Pages) | `POST …/functions/v1/fie-recommend` |
| Local `@fie/api`      | `POST /v1/recommendations/generate` |

Body: `{ "context": FinancialContext }`

Secret: `OPENAI_API_KEY` (never in the browser). Optional `OPENAI_MODEL` (default `gpt-4o-mini`).

### Set secret on Supabase

Dashboard → Project → Edge Functions → Secrets → `OPENAI_API_KEY=sk-...`

Or CLI: `supabase secrets set OPENAI_API_KEY=sk-...`

## UI

Tablero → **Generar recomendación** builds context from board state and calls the Edge Function.
