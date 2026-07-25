# Financial OS on Supabase

Same Supabase project as Hera ERP, **separated by design**:

| Layer         | Where                                            | Role                        |
| ------------- | ------------------------------------------------ | --------------------------- |
| ERP money SoT | `public.tes_movimientos` (`categoria=venta_pos`) | Trazabilidad de dinero      |
| OS events     | `public.fie_domain_events`                       | Ingress copy for dashboards |
| Edge          | `fie-os-sales`                                   | Sync month + projections    |

Do **not** use `public.ventas` for OS sales totals — they diverge from cash reality.

## Endpoints

Base: `https://niilaxdeetuzutycvdkz.supabase.co/functions/v1/fie-os-sales`

- `GET /health`
- `GET /v1/projections/sales`
- `POST /integrations/hera/sync?scope=month|all` — copies trazabilidad → OS events
- `POST /integrations/hera/events` — optional webhook

## Web

Button **Actualizar ventas del mes** runs sync then shows day/month from money movements.
