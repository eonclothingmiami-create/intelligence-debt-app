# Financial OS on Supabase

Same Supabase project as Hera ERP, **separated by design**:

| Layer      | Where                                          | Role                               |
| ---------- | ---------------------------------------------- | ---------------------------------- |
| ERP (Hera) | `public.ventas`, …                             | Source of truth — OS never mutates |
| OS events  | `public.fie_domain_events` (+ schema `fie_os`) | Ingress copy for dashboards        |
| Edge       | `fie-os-sales`                                 | Sync month + projections           |

## Endpoints

Base: `https://niilaxdeetuzutycvdkz.supabase.co/functions/v1/fie-os-sales`

- `GET /health`
- `GET /v1/projections/sales`
- `POST /integrations/hera/sync?scope=month|all` — copies Hera → OS events
- `POST /integrations/hera/events` — optional webhook

## Web

`NEXT_PUBLIC_API_URL` points at the Edge Function. Button **Actualizar ventas del mes** runs sync then shows day/month totals.
