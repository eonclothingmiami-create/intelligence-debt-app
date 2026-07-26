/**
 * Daily manual financial movements Edge API.
 * Complements ERP (Hera): expenses, obligation payments, new debts, extraordinaries.
 * "mark-idle" records days with no manual movements without a multi-step form.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const TZ = "America/Bogota";
const PROVIDER = "fie-closing";

type ClosingLineInput = {
  lineType:
    | "expense"
    | "obligation_payment"
    | "fixed_cost_payment"
    | "extraordinary"
    | "new_obligation";
  sortOrder?: number;
  concept?: string | null;
  category?: string | null;
  note?: string | null;
  obligationId?: string | null;
  fixedCostId?: string | null;
  paymentKind?: "minimo" | "cuota" | "abono_extra" | "fixed_cost" | null;
  baseAmount?: string | number;
  lateInterestAmount?: string | number;
  otherAdjustmentAmount?: string | number;
  totalAmount?: string | number;
  direction?: "outflow" | "inflow";
  meta?: Record<string, unknown>;
};

type CloseBody = {
  salesSnapshot?: Record<string, unknown>;
  notes?: string | null;
  closedBy?: string;
  lines?: ClosingLineInput[];
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function todayInTz(timeZone = TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysInclusive(from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function yearMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function num(v: string | number | undefined | null): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function sb(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function ensureSeriesStart(client: SupabaseClient): Promise<{
  seriesStart: string;
  timezone: string;
}> {
  const { data: existing, error } = await client
    .from("fie_closing_config")
    .select("series_start_date, timezone")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw error;
  if (existing?.series_start_date) {
    return {
      seriesStart: String(existing.series_start_date).slice(0, 10),
      timezone: existing.timezone ?? TZ,
    };
  }
  const start = todayInTz(TZ);
  const { error: upsertErr } = await client.from("fie_closing_config").upsert({
    id: "default",
    series_start_date: start,
    timezone: TZ,
    updated_at: new Date().toISOString(),
  });
  if (upsertErr) throw upsertErr;
  return { seriesStart: start, timezone: TZ };
}

async function listClosedDays(
  client: SupabaseClient,
  from: string,
  to: string,
): Promise<Set<string>> {
  const { data, error } = await client
    .from("fie_daily_closings")
    .select("business_day")
    .gte("business_day", from)
    .lte("business_day", to);
  if (error) throw error;
  return new Set((data ?? []).map((r) => String(r.business_day).slice(0, 10)));
}

async function buildStatus(client: SupabaseClient) {
  const { seriesStart, timezone } = await ensureSeriesStart(client);
  const today = todayInTz(timezone);
  const closed = await listClosedDays(client, seriesStart, today);
  const all = daysInclusive(seriesStart, today);
  const pendingDays = all.filter((d) => !closed.has(d));
  const closedSorted = [...closed].sort();
  return {
    seriesStart,
    today,
    timezone,
    pendingDays,
    nextPendingDay: pendingDays[0] ?? null,
    lastClosed: closedSorted.length ? closedSorted[closedSorted.length - 1] : null,
    closedCount: closed.size,
    canGenerateRecommendations: pendingDays.length === 0,
  };
}

async function loadClosing(client: SupabaseClient, day: string) {
  const { data: closing, error } = await client
    .from("fie_daily_closings")
    .select("*")
    .eq("business_day", day)
    .maybeSingle();
  if (error) throw error;
  if (!closing) return null;
  const { data: lines, error: linesErr } = await client
    .from("fie_daily_closing_lines")
    .select("*")
    .eq("closing_id", closing.id)
    .order("sort_order", { ascending: true });
  if (linesErr) throw linesErr;
  const { data: audit, error: auditErr } = await client
    .from("fie_daily_closing_audit")
    .select("*")
    .eq("closing_id", closing.id)
    .order("changed_at", { ascending: true });
  if (auditErr) throw auditErr;
  return { closing, lines: lines ?? [], audit: audit ?? [] };
}

function mapLineRow(line: ClosingLineInput, closingId: string, idx: number) {
  const base = num(line.baseAmount);
  const late = num(line.lateInterestAmount);
  const other = num(line.otherAdjustmentAmount);
  const total =
    line.totalAmount != null && String(line.totalAmount) !== ""
      ? num(line.totalAmount)
      : base + late + other;
  return {
    closing_id: closingId,
    line_type: line.lineType,
    sort_order: line.sortOrder ?? idx,
    concept: line.concept ?? null,
    category: line.category ?? null,
    note: line.note ?? null,
    obligation_id: line.obligationId ?? null,
    fixed_cost_id: line.fixedCostId ?? null,
    payment_kind: line.paymentKind ?? null,
    base_amount: base,
    late_interest_amount: late,
    other_adjustment_amount: other,
    total_amount: total,
    direction: line.direction ?? "outflow",
    meta: line.meta ?? {},
  };
}

async function closeDay(client: SupabaseClient, day: string, body: CloseBody) {
  const status = await buildStatus(client);
  if (day > status.today) {
    return json({ error: "future_day", message: "No se puede cerrar un día futuro." }, 400);
  }
  if (day < status.seriesStart) {
    return json({
      error: "before_series",
      message: `El día ${day} es anterior al inicio de serie ${status.seriesStart}.`,
    }, 400);
  }
  if (status.nextPendingDay !== day) {
    return json({
      error: "not_next_pending",
      message: status.nextPendingDay
        ? `Debes cerrar primero ${status.nextPendingDay}.`
        : "No hay días pendientes.",
      nextPendingDay: status.nextPendingDay,
    }, 409);
  }

  const existing = await loadClosing(client, day);
  if (existing) {
    return json({ error: "already_closed", message: `El día ${day} ya está cerrado.`, closing: existing }, 409);
  }

  const linesIn = body.lines ?? [];
  for (const line of linesIn) {
    if (line.lineType === "fixed_cost_payment") {
      if (!line.fixedCostId) {
        return json({ error: "missing_fixed_cost_id", message: "Pago de costo fijo sin fixedCostId." }, 400);
      }
      const ym = yearMonth(day);
      const { data: paid } = await client
        .from("fie_fixed_cost_month_payments")
        .select("id")
        .eq("fixed_cost_id", line.fixedCostId)
        .eq("year_month", ym)
        .maybeSingle();
      if (paid) {
        return json({
          error: "fixed_cost_already_paid",
          message: `El costo fijo ${line.fixedCostId} ya fue pagado en ${ym}.`,
        }, 409);
      }
    }
  }

  const { data: closing, error: insErr } = await client
    .from("fie_daily_closings")
    .insert({
      business_day: day,
      status: "closed",
      sales_snapshot: body.salesSnapshot ?? {},
      notes: body.notes ?? null,
      closed_by: body.closedBy ?? "owner",
      revision: 1,
    })
    .select("*")
    .single();
  if (insErr) throw insErr;

  const lineRows = linesIn.map((l, i) => mapLineRow(l, closing.id, i));
  let insertedLines: Array<Record<string, unknown>> = [];
  if (lineRows.length) {
    const { data: lines, error: linesErr } = await client
      .from("fie_daily_closing_lines")
      .insert(lineRows)
      .select("*");
    if (linesErr) throw linesErr;
    insertedLines = lines ?? [];
  }

  for (const row of insertedLines) {
    if (row.line_type !== "fixed_cost_payment" || !row.fixed_cost_id) continue;
    const total = Number(row.total_amount) || 0;
    if (total <= 0) continue; // deferred / omitted — no month payment ledger
    const { error: payErr } = await client.from("fie_fixed_cost_month_payments").insert({
      fixed_cost_id: row.fixed_cost_id,
      year_month: yearMonth(day),
      closing_id: closing.id,
      closing_line_id: row.id,
      base_amount: row.base_amount,
      late_interest_amount: row.late_interest_amount,
      other_adjustment_amount: row.other_adjustment_amount,
      total_paid: row.total_amount,
      paid_on: day,
    });
    if (payErr) throw payErr;
  }

  await client.from("fie_domain_events").upsert(
    {
      provider_id: PROVIDER,
      event_type: "DailyClosingCompleted",
      external_id: day,
      occurred_at: `${day}T23:59:59-05:00`,
      currency: "COP",
      payload: {
        closingId: closing.id,
        businessDay: day,
        lineCount: insertedLines.length,
        notes: body.notes ?? null,
      },
    },
    { onConflict: "provider_id,event_type,external_id" },
  );

  const nextStatus = await buildStatus(client);
  return json({
    ok: true,
    message: "Movimientos registrados correctamente",
    closing: { ...closing, lines: insertedLines },
    status: nextStatus,
  });
}

/** Mark all pending days through today as updated with zero manual movements. */
async function markIdlePending(client: SupabaseClient, closedBy = "owner") {
  const status = await buildStatus(client);
  const markedDays: string[] = [];
  for (const day of status.pendingDays) {
    const { error: insErr } = await client.from("fie_daily_closings").insert({
      business_day: day,
      status: "closed",
      sales_snapshot: {
        source: "erp_hera",
        note: "Sin movimientos manuales — ventas siguen en ERP",
      },
      notes: "sin_movimientos_manuales",
      closed_by: closedBy,
      revision: 1,
    });
    if (insErr) throw insErr;
    await client.from("fie_domain_events").upsert(
      {
        provider_id: PROVIDER,
        event_type: "DailyClosingCompleted",
        external_id: day,
        occurred_at: `${day}T23:59:59-05:00`,
        currency: "COP",
        payload: {
          businessDay: day,
          idle: true,
          lineCount: 0,
        },
      },
      { onConflict: "provider_id,event_type,external_id" },
    );
    markedDays.push(day);
  }
  const nextStatus = await buildStatus(client);
  return json({
    ok: true,
    message:
      markedDays.length === 0
        ? "No había días pendientes"
        : `Sin movimientos manuales — ${markedDays.length} día(s) actualizado(s)`,
    markedDays,
    status: nextStatus,
  });
}

async function patchClosing(client: SupabaseClient, day: string, body: CloseBody & {
  changedBy?: string;
}) {
  const loaded = await loadClosing(client, day);
  if (!loaded) {
    return json({ error: "not_found", message: `No hay cierre para ${day}.` }, 404);
  }
  const { closing, lines } = loaded;
  const changedBy = body.changedBy ?? body.closedBy ?? "owner";
  const audits: Array<{
    closing_id: string;
    field_path: string;
    old_value: unknown;
    new_value: unknown;
    changed_by: string;
  }> = [];

  const updates: Record<string, unknown> = {
    revision: (closing.revision ?? 1) + 1,
  };

  if (body.notes !== undefined && body.notes !== closing.notes) {
    audits.push({
      closing_id: closing.id,
      field_path: "notes",
      old_value: closing.notes,
      new_value: body.notes,
      changed_by: changedBy,
    });
    updates.notes = body.notes;
  }

  if (body.salesSnapshot !== undefined) {
    audits.push({
      closing_id: closing.id,
      field_path: "sales_snapshot",
      old_value: closing.sales_snapshot,
      new_value: body.salesSnapshot,
      changed_by: changedBy,
    });
    updates.sales_snapshot = body.salesSnapshot;
  }

  if (body.lines) {
    audits.push({
      closing_id: closing.id,
      field_path: "lines",
      old_value: lines,
      new_value: body.lines,
      changed_by: changedBy,
    });

    // Replace lines: delete month payment rows for this closing, delete lines, re-insert
    await client.from("fie_fixed_cost_month_payments").delete().eq("closing_id", closing.id);
    await client.from("fie_daily_closing_lines").delete().eq("closing_id", closing.id);

    const lineRows = body.lines.map((l, i) => mapLineRow(l, closing.id, i));
    let insertedLines: Array<Record<string, unknown>> = [];
    if (lineRows.length) {
      const { data: newLines, error: linesErr } = await client
        .from("fie_daily_closing_lines")
        .insert(lineRows)
        .select("*");
      if (linesErr) throw linesErr;
      insertedLines = newLines ?? [];
    }
    for (const row of insertedLines) {
      if (row.line_type !== "fixed_cost_payment" || !row.fixed_cost_id) continue;
      const { error: payErr } = await client.from("fie_fixed_cost_month_payments").insert({
        fixed_cost_id: row.fixed_cost_id,
        year_month: yearMonth(day),
        closing_id: closing.id,
        closing_line_id: row.id,
        base_amount: row.base_amount,
        late_interest_amount: row.late_interest_amount,
        other_adjustment_amount: row.other_adjustment_amount,
        total_paid: row.total_amount,
        paid_on: day,
      });
      if (payErr) throw payErr;
    }
  }

  if (Object.keys(updates).length > 1 || audits.length) {
    const { error: updErr } = await client
      .from("fie_daily_closings")
      .update(updates)
      .eq("id", closing.id);
    if (updErr) throw updErr;
  }

  if (audits.length) {
    const { error: auditErr } = await client.from("fie_daily_closing_audit").insert(audits);
    if (auditErr) throw auditErr;
  }

  const refreshed = await loadClosing(client, day);
  return json({ ok: true, closing: refreshed });
}

async function listClosings(client: SupabaseClient, from: string, to: string) {
  const { data: closings, error } = await client
    .from("fie_daily_closings")
    .select("*")
    .gte("business_day", from)
    .lte("business_day", to)
    .order("business_day", { ascending: false });
  if (error) throw error;
  const rows = closings ?? [];
  const out = [];
  for (const c of rows) {
    const { data: lines } = await client
      .from("fie_daily_closing_lines")
      .select("*")
      .eq("closing_id", c.id)
      .order("sort_order", { ascending: true });
    out.push({ ...c, lines: lines ?? [] });
  }
  return out;
}

async function listFixedCostPayments(client: SupabaseClient, yearMonthParam: string) {
  const { data, error } = await client
    .from("fie_fixed_cost_month_payments")
    .select("*")
    .eq("year_month", yearMonthParam);
  if (error) throw error;
  return data ?? [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const client = sb();
    const url = new URL(req.url);
    let path = url.pathname;
    // Strip function prefix if present
    const marker = "/fie-os-closing";
    const idx = path.indexOf(marker);
    if (idx >= 0) path = path.slice(idx + marker.length) || "/";
    if (!path.startsWith("/")) path = `/${path}`;

    if (req.method === "GET" && (path === "/health" || path === "/")) {
      return json({ ok: true, service: "fie-os-closing" });
    }

    if (req.method === "GET" && path === "/v1/closing/status") {
      const status = await buildStatus(client);
      return json(status);
    }

    if (req.method === "POST" && path === "/v1/closing/mark-idle") {
      const body = (await req.json().catch(() => ({}))) as { closedBy?: string };
      return await markIdlePending(client, body.closedBy ?? "owner");
    }

    if (req.method === "GET" && path === "/v1/closing/fixed-cost-payments") {
      const ym = url.searchParams.get("yearMonth") ?? yearMonth(todayInTz());
      const rows = await listFixedCostPayments(client, ym);
      return json({ yearMonth: ym, payments: rows });
    }

    if (req.method === "GET" && path === "/v1/closing") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      if (!from || !to) {
        return json({ error: "missing_range", message: "Requiere from y to (YYYY-MM-DD)." }, 400);
      }
      const rows = await listClosings(client, from, to);
      return json({ from, to, closings: rows });
    }

    const dayMatch = path.match(/^\/v1\/closing\/(\d{4}-\d{2}-\d{2})$/);
    if (dayMatch) {
      const day = dayMatch[1];
      if (req.method === "GET") {
        const loaded = await loadClosing(client, day);
        if (!loaded) return json({ error: "not_found", message: `Sin cierre ${day}` }, 404);
        return json(loaded);
      }
      if (req.method === "POST") {
        const body = (await req.json()) as CloseBody;
        return await closeDay(client, day, body);
      }
      if (req.method === "PATCH") {
        const body = (await req.json()) as CloseBody & { changedBy?: string };
        return await patchClosing(client, day, body);
      }
    }

    return json({ error: "not_found", path }, 404);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: "internal", message }, 500);
  }
});
