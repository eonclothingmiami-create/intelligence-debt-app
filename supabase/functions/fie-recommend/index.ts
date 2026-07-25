/**
 * Backend-only OpenAI recommendation endpoint.
 * React must never call OpenAI SDK; only POST FinancialContext here.
 * API key: header x-openai-api-key (user session) OR secret OPENAI_API_KEY.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { FINANCIAL_RECOMMENDATION_SYSTEM_PROMPT } from "./prompt.ts";

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

    const body = (await req.json()) as { context?: unknown };
    if (!body?.context || typeof body.context !== "object") {
      return json({ error: "CONTEXT_REQUIRED" }, 400);
    }

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
          { role: "system", content: FINANCIAL_RECOMMENDATION_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              instruction:
                "Analiza el siguiente contexto financiero del Business Financial OS y emite la recomendación JSON requerida.",
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
