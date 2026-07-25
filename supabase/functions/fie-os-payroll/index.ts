/**
 * Financial OS payroll ingress — READ-ONLY from Hera ERP.
 * Source: public.employees (and optional nom_nominas counts).
 * Never writes ERP tables. UI must not query employees directly.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const PROVIDER = "hera-nomina";

export type HeraEmployeeDto = {
  id: string;
  nombre: string;
  salarioBase: string;
  tipoContrato: string;
  createdAt: string;
};

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

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

function pathOf(req: Request): string {
  const u = new URL(req.url);
  // /functions/v1/fie-os-payroll/... → strip function prefix
  const parts = u.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("fie-os-payroll");
  const rest = idx >= 0 ? parts.slice(idx + 1) : parts;
  return "/" + rest.join("/");
}

async function loadEmployees(supabase: ReturnType<typeof adminClient>) {
  const { data, error } = await supabase
    .from("employees")
    .select("id, nombre, salario_base, tipo_contrato, created_at")
    .order("nombre", { ascending: true });
  if (error) throw error;

  const employees: HeraEmployeeDto[] = (data ?? []).map((row) => ({
    id: String(row.id),
    nombre: String(row.nombre ?? ""),
    salarioBase: String(Math.round(Number(row.salario_base ?? 0))),
    tipoContrato: String(row.tipo_contrato ?? "indefinido"),
    createdAt: String(row.created_at ?? ""),
  }));

  // Mirror into OS events (copy only) for audit / future projections
  if (employees.length > 0) {
    await supabase.from("fie_domain_events").delete().eq("provider_id", PROVIDER);
    const rows = employees.map((e) => ({
      provider_id: PROVIDER,
      event_type: "EmployeeSynced",
      external_id: e.id,
      occurred_at: e.createdAt || new Date().toISOString(),
      currency: "COP",
      payload: {
        employeeId: e.id,
        nombre: e.nombre,
        salarioBase: e.salarioBase,
        tipoContrato: e.tipoContrato,
      },
    }));
    const { error: upErr } = await supabase.from("fie_domain_events").upsert(rows, {
      onConflict: "provider_id,event_type,external_id",
    });
    if (upErr) throw upErr;
  }

  const { count: nominaCount } = await supabase
    .from("nom_nominas")
    .select("id", { count: "exact", head: true });

  return {
    ok: true,
    provider: PROVIDER,
    source: "public.employees",
    employeeCount: employees.length,
    payrollRunCount: nominaCount ?? 0,
    empty: employees.length === 0,
    message:
      employees.length === 0
        ? "No hay trabajadores en el módulo Nómina del ERP (public.employees). Regístralos en Hera o usa la calculadora SMMLV en el OS."
        : `Se leyeron ${employees.length} trabajador(es) desde Hera. El OS actualizará el costo fijo de nómina / BEP.`,
    employees,
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
      return json({ ok: true, service: "fie-os-payroll", provider: PROVIDER });
    }

    if (
      (req.method === "GET" && path === "/v1/projections/payroll") ||
      (req.method === "POST" && path === "/integrations/hera/payroll/sync")
    ) {
      return json(await loadEmployees(supabase));
    }

    return json({ error: "NOT_FOUND", path }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
