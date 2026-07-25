/**
 * Financial OS inventory ingress — READ-ONLY from Hera ERP.
 * Source: public.products (stock × cost / price). Never writes ERP.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PROVIDER = "hera-inventario";
const CURRENCY = "COP";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

function pathOf(req: Request): string {
  const u = new URL(req.url);
  const parts = u.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("fie-os-inventory");
  const rest = idx >= 0 ? parts.slice(idx + 1) : parts;
  return "/" + rest.join("/");
}

async function loadInventorySnapshot(supabase: ReturnType<typeof adminClient>) {
  const { data, error } = await supabase
    .from("products")
    .select("id, ref, name, stock, cost, price, active, stock_min");
  if (error) throw error;

  let skuCount = 0;
  let skusWithStock = 0;
  let skusBelowMin = 0;
  let units = 0;
  let valueAtCost = 0;
  let valueAtPrice = 0;
  const topByValue: Array<{
    id: string;
    ref: string;
    name: string;
    stock: number;
    valueAtCost: string;
  }> = [];

  for (const row of data ?? []) {
    skuCount += 1;
    const active = row.active !== false;
    if (!active) continue;
    const stock = Number(row.stock ?? 0);
    const cost = Number(row.cost ?? 0);
    const price = Number(row.price ?? 0);
    const stockMin = Number(row.stock_min ?? 0);
    if (stock > 0) skusWithStock += 1;
    if (stockMin > 0 && stock < stockMin) skusBelowMin += 1;
    units += stock;
    const lineCost = stock * cost;
    valueAtCost += lineCost;
    valueAtPrice += stock * price;
    if (lineCost > 0) {
      topByValue.push({
        id: String(row.id),
        ref: String(row.ref ?? ""),
        name: String(row.name ?? ""),
        stock,
        valueAtCost: money(lineCost),
      });
    }
  }

  topByValue.sort((a, b) => Number(b.valueAtCost) - Number(a.valueAtCost));
  const top = topByValue.slice(0, 15);

  const snapshot = {
    currency: CURRENCY,
    source: "public.products",
    skuCount,
    skusWithStock,
    skusBelowMin,
    units: money(units),
    valueAtCost: money(valueAtCost),
    valueAtPrice: money(valueAtPrice),
    topByValueAtCost: top,
    syncedAt: new Date().toISOString(),
  };

  await supabase.from("fie_domain_events").delete().eq("provider_id", PROVIDER);
  const { error: upErr } = await supabase.from("fie_domain_events").upsert(
    {
      provider_id: PROVIDER,
      event_type: "InventorySnapshotSynced",
      external_id: "snapshot_current",
      occurred_at: snapshot.syncedAt,
      currency: CURRENCY,
      payload: snapshot,
    },
    { onConflict: "provider_id,event_type,external_id" },
  );
  if (upErr) throw upErr;

  return {
    ok: true,
    provider: PROVIDER,
    empty: units <= 0,
    message:
      units <= 0
        ? "No hay unidades en stock en products activos."
        : `Inventario Hera: ${money(units)} uds · ${money(valueAtCost)} a costo · ${skusWithStock} SKUs con stock.`,
    snapshot,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const path = pathOf(req);
    const supabase = adminClient();

    if (req.method === "GET" && (path === "/" || path === "/health")) {
      return json({ ok: true, service: "fie-os-inventory", provider: PROVIDER });
    }

    if (
      (req.method === "GET" && path === "/v1/projections/inventory") ||
      (req.method === "POST" && path === "/integrations/hera/inventory/sync")
    ) {
      return json(await loadInventorySnapshot(supabase));
    }

    return json({ error: "NOT_FOUND", path }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
