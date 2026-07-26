# Financial OS on Supabase

Same Supabase project as Hera ERP, **separated by design**:

| Layer         | Where                                             | Role                        |
| ------------- | ------------------------------------------------- | --------------------------- |
| ERP money SoT | `public.tes_movimientos` (`categoria=venta_pos`)  | Trazabilidad de dinero      |
| OS events     | `public.fie_domain_events`                        | Ingress copy for dashboards |
| Daily closing | `fie_daily_closings` (+ lines, audit, month pays) | Durable daily facts         |
| Edge          | `fie-os-sales`                                    | Sync month + projections    |
| Edge          | `fie-os-closing`                                  | Daily closing API           |

Do **not** use `public.ventas` for OS sales totals — they diverge from cash reality.

## Endpoints

Base: `https://niilaxdeetuzutycvdkz.supabase.co/functions/v1/fie-os-sales`

- `GET /health`
- `GET /v1/projections/sales`
- `POST /integrations/hera/sync?scope=month|all` — copies trazabilidad → OS events
- `POST /integrations/hera/events` — optional webhook

### Nómina (workers → BEP)

Base: `…/functions/v1/fie-os-payroll`

- `GET /health`
- `POST /integrations/hera/payroll/sync` — **read-only** `public.employees` → OS snapshot (+ events `EmployeeSynced`)
- Web **Costos** → **Sincronizar nómina Hera**: si hay N trabajadores, suma costo empleador (SMMLV/provisiones) y actualiza la línea NOMINA / BEP
- Si `employees` está vacío: el OS no inventa headcount; usa calculadora SMMLV hasta registrarlos en Hera

### Inventario

Base: `…/functions/v1/fie-os-inventory`

- `POST /integrations/hera/inventory/sync` — **read-only** `public.products` (stock × cost/price) → OS snapshot
- Web **Resumen** → métrica inventario + **Actualizar inventario Hera**
- Alimenta CFO AI context y el componente de riesgo `inventory` (ya no placeholder fijo)

### Registro diario de movimientos

Base: `…/functions/v1/fie-os-closing`

Ver [DAILY_CLOSING.md](./DAILY_CLOSING.md). Al abrir `/app`: pregunta si hubo movimientos manuales; **No** marca los días pendientes sin formulario. Ventas/inventario siguen en Hera.

## Web

Button **Actualizar ventas del mes** runs sync then shows day/month from money movements.
