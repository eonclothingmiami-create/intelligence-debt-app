/**
 * Financial OS sales ingress on Supabase Edge.
 * SoT for money-in: Hera Tesorería → public.tes_movimientos (categoria venta_pos).
 * Copies into fie_domain_events only; dashboard never queries ERP tables.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PROVIDER = "hera-trazabilidad";
const LEGACY_PROVIDER = "ventas-hera";
const CURRENCY = "COP";

type SalePayload = {
  orderId: string;
  grossAmount: string;
  netAmount: string;
  itemCount: string;
  costAmount?: string;
  utilityAmount?: string;
  discountAmount?: string;
  taxAmount?: string;
  channel?: string;
  method?: string;
  bucket?: string;
  concept?: string;
};

type DomainEvent = {
  type: string;
  providerId: string;
  externalId: string;
  occurredAt: string;
  currency: string;
  payload: SalePayload | { amount: string; method?: string };
};

type SalesProjection = {
  currency: string;
  salesCount: number;
  unitsSold: string;
  grossSales: string;
  netSales: string;
  totalCost: string;
  totalUtility: string;
  totalDiscounts: string;
  totalTaxes: string;
  averageTicket: string | null;
  cancelledCount: number;
  paymentsReceived: string;
  lastEventAt: string | null;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hera-webhook-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function money(n: number): string {
  return Math.round(n).toFixed(0);
}

function project(events: DomainEvent[]): SalesProjection {
  let gross = 0;
  let net = 0;
  let cost = 0;
  let utility = 0;
  let discounts = 0;
  let taxes = 0;
  let units = 0;
  let payments = 0;
  let salesCount = 0;
  let cancelled = 0;
  let lastEventAt: string | null = null;

  for (const e of events) {
    lastEventAt = e.occurredAt;
    if (e.type === "SaleCreated") {
      const p = e.payload as SalePayload;
      salesCount += 1;
      gross += Number(p.grossAmount) || 0;
      net += Number(p.netAmount) || 0;
      cost += Number(p.costAmount ?? "0") || 0;
      utility += Number(p.utilityAmount ?? "0") || 0;
      discounts += Number(p.discountAmount ?? "0") || 0;
      taxes += Number(p.taxAmount ?? "0") || 0;
      units += Number(p.itemCount) || 0;
    } else if (e.type === "SaleCancelled") {
      cancelled += 1;
    } else if (e.type === "PaymentReceived") {
      payments += Number((e.payload as { amount?: string }).amount ?? "0") || 0;
    }
  }

  return {
    currency: CURRENCY,
    salesCount,
    unitsSold: money(units),
    grossSales: money(gross),
    netSales: money(net),
    totalCost: money(cost),
    totalUtility: money(utility),
    totalDiscounts: money(discounts),
    totalTaxes: money(taxes),
    averageTicket: salesCount > 0 ? money(net / salesCount) : null,
    cancelledCount: cancelled,
    paymentsReceived: money(payments),
    lastEventAt,
  };
}

function dashboard(events: DomainEvent[], asOfIso: string) {
  const today = asOfIso.slice(0, 10);
  const month = asOfIso.slice(0, 7);
  // Prefer Bogotá calendar day for "hoy" when asOf is UTC evening
  const bogotaDay = new Date(asOfIso).toLocaleDateString("en-CA", {
    timeZone: "America/Bogota",
  });
  const bogotaMonth = bogotaDay.slice(0, 7);
  const dayEvents = events.filter((e) => {
    const d = new Date(e.occurredAt).toLocaleDateString("en-CA", {
      timeZone: "America/Bogota",
    });
    return d === bogotaDay || e.occurredAt.slice(0, 10) === today || e.occurredAt.slice(0, 10) === bogotaDay;
  });
  const monthEvents = events.filter((e) => {
    const d = new Date(e.occurredAt).toLocaleDateString("en-CA", {
      timeZone: "America/Bogota",
    });
    return d.startsWith(bogotaMonth) || e.occurredAt.slice(0, 7) === month || e.occurredAt.slice(0, 7) === bogotaMonth;
  });
  return {
    asOf: asOfIso,
    day: project(dayEvents),
    month: project(monthEvents),
    accumulated: project(events),
  };
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function pathOf(req: Request): string {
  const u = new URL(req.url);
  const marker = "/fie-os-sales";
  const idx = u.pathname.indexOf(marker);
  const rest = idx >= 0 ? u.pathname.slice(idx + marker.length) : u.pathname;
  return rest.replace(/\/+$/, "") || "/";
}

async function loadEvents(
  supabase: ReturnType<typeof adminClient>,
): Promise<DomainEvent[]> {
  const { data, error } = await supabase
    .from("fie_domain_events")
    .select("event_type, provider_id, external_id, occurred_at, currency, payload")
    .eq("provider_id", PROVIDER)
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    type: row.event_type as string,
    providerId: row.provider_id as string,
    externalId: row.external_id as string,
    occurredAt: row.occurred_at as string,
    currency: (row.currency as string) || CURRENCY,
    payload: row.payload as SalePayload,
  }));
}

/**
 * Sync from Hera money traceability (tes_movimientos / venta_pos), not public.ventas.
 * Matches Tesorería → Trazab. Dinero totals (efectivo + transferencias + otros métodos).
 */
async function syncFromTrazabilidad(
  supabase: ReturnType<typeof adminClient>,
  scope: "month" | "all",
): Promise<{ upserted: number; scanned: number; scope: string; source: string }> {
  const bogotaNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }),
  );
  const y = bogotaNow.getFullYear();
  const m = String(bogotaNow.getMonth() + 1).padStart(2, "0");
  const monthStart = `${y}-${m}-01`;

  // Drop legacy ventas-table sync so it cannot inflate dashboards
  await supabase.from("fie_domain_events").delete().eq("provider_id", LEGACY_PROVIDER);

  let q = supabase
    .from("tes_movimientos")
    .select("id, tipo, valor, concepto, fecha, metodo, bucket, categoria, created_at, reversal_of_id")
    .eq("tipo", "ingreso")
    .eq("categoria", "venta_pos")
    .is("reversal_of_id", null)
    .order("fecha", { ascending: true });

  if (scope === "month") {
    q = q.gte("fecha", monthStart);
    // Replace month events for this provider (avoid stale ids)
    await supabase
      .from("fie_domain_events")
      .delete()
      .eq("provider_id", PROVIDER)
      .gte("occurred_at", `${monthStart}T00:00:00-05:00`);
  } else {
    await supabase.from("fie_domain_events").delete().eq("provider_id", PROVIDER);
  }

  const { data: movs, error } = await q;
  if (error) throw error;

  const rows: Record<string, unknown>[] = [];
  for (const mov of movs ?? []) {
    const id = String(mov.id);
    const valor = String(Math.round(Number(mov.valor ?? 0)));
    const fecha = String(mov.fecha);
    const occurredAt =
      (mov.created_at as string | null) ?? `${fecha}T12:00:00.000-05:00`;
    const salePayload: SalePayload = {
      orderId: id,
      grossAmount: valor,
      netAmount: valor,
      itemCount: "1",
      method: (mov.metodo as string | null) ?? undefined,
      bucket: (mov.bucket as string | null) ?? undefined,
      concept: (mov.concepto as string | null) ?? undefined,
      channel: "trazabilidad",
    };
    rows.push({
      provider_id: PROVIDER,
      event_type: "SaleCreated",
      external_id: id,
      occurred_at: occurredAt,
      currency: CURRENCY,
      payload: salePayload,
    });
    rows.push({
      provider_id: PROVIDER,
      event_type: "PaymentReceived",
      external_id: `pay_${id}`,
      occurred_at: occurredAt,
      currency: CURRENCY,
      payload: {
        amount: valor,
        method: (mov.metodo as string | null) ?? undefined,
      },
    });
  }

  let upserted = 0;
  const batch = 100;
  for (let i = 0; i < rows.length; i += batch) {
    const part = rows.slice(i, i + batch);
    const { error: upErr, count } = await supabase.from("fie_domain_events").upsert(part, {
      onConflict: "provider_id,event_type,external_id",
      count: "exact",
    });
    if (upErr) throw upErr;
    upserted += count ?? part.length;
  }

  return {
    upserted,
    scanned: (movs ?? []).length,
    scope,
    source: "tes_movimientos.venta_pos",
  };
}

function mapHeraWebhook(body: Record<string, unknown>): DomainEvent | null {
  const type = String(body.type ?? "");
  if (type !== "sale.created" && type !== "SaleCreated") return null;
  const data = (body.data ?? {}) as Record<string, unknown>;
  const id = String(body.id ?? data.orderId ?? "");
  if (!id) return null;
  const amount = String(data.netAmount ?? data.grossAmount ?? "0");
  return {
    type: "SaleCreated",
    providerId: PROVIDER,
    externalId: id,
    occurredAt: String(body.occurredAt ?? new Date().toISOString()),
    currency: String(body.currency ?? CURRENCY),
    payload: {
      orderId: id,
      grossAmount: String(data.grossAmount ?? amount),
      netAmount: amount,
      itemCount: String(data.itemCount ?? "1"),
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const path = pathOf(req);
    const supabase = adminClient();

    if (req.method === "GET" && (path === "/health" || path === "/")) {
      return json({
        ok: true,
        service: "fie-os-sales",
        provider: PROVIDER,
        source: "tes_movimientos.venta_pos",
      });
    }

    if (req.method === "GET" && path === "/v1/projections/sales") {
      const asOf = new URL(req.url).searchParams.get("asOf") ?? new Date().toISOString();
      const events = await loadEvents(supabase);
      return json(dashboard(events, asOf));
    }

    if (req.method === "POST" && path === "/integrations/hera/sync") {
      const url = new URL(req.url);
      const scope = url.searchParams.get("scope") === "all" ? "all" : "month";
      const result = await syncFromTrazabilidad(supabase, scope);
      const events = await loadEvents(supabase);
      return json({
        ok: true,
        ...result,
        dashboard: dashboard(events, new Date().toISOString()),
      });
    }

    if (req.method === "POST" && path === "/integrations/hera/events") {
      const secret = Deno.env.get("HERA_WEBHOOK_SECRET");
      if (secret) {
        const header =
          req.headers.get("X-Hera-Webhook-Secret") ??
          req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
        if (header !== secret) return json({ error: "UNAUTHORIZED" }, 401);
      }
      const body = await req.json();
      const payloads = Array.isArray(body) ? body : [body];
      let accepted = 0;
      let duplicates = 0;
      for (const raw of payloads) {
        const event = mapHeraWebhook(raw as Record<string, unknown>);
        if (!event) continue;
        const { error } = await supabase.from("fie_domain_events").upsert(
          {
            provider_id: event.providerId,
            event_type: event.type,
            external_id: event.externalId,
            occurred_at: event.occurredAt,
            currency: event.currency,
            payload: event.payload,
          },
          { onConflict: "provider_id,event_type,external_id", ignoreDuplicates: true },
        );
        if (error) {
          if (String(error.message).includes("duplicate")) duplicates += 1;
          else throw error;
        } else {
          accepted += 1;
        }
      }
      const events = await loadEvents(supabase);
      return json({
        ok: true,
        accepted,
        duplicates,
        dashboard: dashboard(events, new Date().toISOString()),
      });
    }

    return json({ error: "NOT_FOUND", path }, 404);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: message }, 500);
  }
});
