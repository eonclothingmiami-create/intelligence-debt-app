/**
 * Backend-only OpenAI recommendation endpoint.
 * React must never call OpenAI SDK; only POST FinancialContext here.
 * API key: header x-openai-api-key (user session) OR secret OPENAI_API_KEY.
 *
 * Modes:
 * - recommendation (default): full CFO recommendation
 * - liquidity_policy: draft policy suggestion (user must confirm in UI)
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  FINANCIAL_RECOMMENDATION_SYSTEM_PROMPT,
  LIQUIDITY_POLICY_SUGGESTION_SYSTEM_PROMPT,
} from "./prompt.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-openai-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter(Boolean);
}

function parseRecommendation(raw: string) {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return {
    executiveSummary: String(parsed.executiveSummary ?? ""),
    currentSituation: String(parsed.currentSituation ?? ""),
    strengths: asStringArray(parsed.strengths),
    risks: asStringArray(parsed.risks),
    recommendations: asStringArray(parsed.recommendations),
    justification: String(parsed.justification ?? ""),
    expectedImpact: String(parsed.expectedImpact ?? ""),
    confidenceLevel: String(parsed.confidenceLevel ?? "baja"),
    missingInformation: asStringArray(parsed.missingInformation),
  };
}

function parseLiquidityPolicySuggestion(raw: string) {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const floor =
    parsed.suggestedMinCashFloor == null || parsed.suggestedMinCashFloor === ""
      ? null
      : String(parsed.suggestedMinCashFloor);
  return {
    suggestedReserveMonths: String(parsed.suggestedReserveMonths ?? ""),
    suggestedMinCashFloor: floor,
    reserveIsHardFloor: parsed.reserveIsHardFloor !== false,
    rationale: String(parsed.rationale ?? ""),
    confidenceLevel: String(parsed.confidenceLevel ?? "baja"),
    questionsForUser: asStringArray(parsed.questionsForUser),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const userKey = req.headers.get("x-openai-api-key")?.trim();
    const envKey = Deno.env.get("OPENAI_API_KEY")?.trim();
    const apiKey = userKey || envKey;
    if (!apiKey) {
      return json(
        {
          error: "OPENAI_API_KEY_MISSING",
          message:
            "Conecta tu API key en el tablero (CFO AI) o configura OPENAI_API_KEY en Supabase Secrets.",
        },
        503,
      );
    }

    const body = (await req.json()) as { context?: unknown; mode?: string };
    if (!body?.context || typeof body.context !== "object") {
      return json({ error: "CONTEXT_REQUIRED" }, 400);
    }

    const mode = body.mode === "liquidity_policy" ? "liquidity_policy" : "recommendation";
    const systemPrompt =
      mode === "liquidity_policy"
        ? LIQUIDITY_POLICY_SUGGESTION_SYSTEM_PROMPT
        : FINANCIAL_RECOMMENDATION_SYSTEM_PROMPT;
    const instruction =
      mode === "liquidity_policy"
        ? "Con el contexto financiero, propone una política de liquidez JSON. No la apliques; el usuario confirmará."
        : "Analiza el siguiente contexto financiero del Business Financial OS y emite la recomendación JSON requerida.";

    const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: JSON.stringify({
              instruction,
              context: body.context,
            }),
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: "OPENAI_ERROR", detail: detail.slice(0, 500) }, 502);
    }

    const openaiBody = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = openaiBody.choices?.[0]?.message?.content;
    if (!raw) return json({ error: "EMPTY_RESPONSE" }, 502);

    if (mode === "liquidity_policy") {
      return json({
        ok: true,
        provider: "openai",
        keySource: userKey ? "user" : "server",
        suggestion: parseLiquidityPolicySuggestion(raw),
      });
    }

    return json({
      ok: true,
      provider: "openai",
      keySource: userKey ? "user" : "server",
      recommendation: parseRecommendation(raw),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
