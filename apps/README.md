# Apps

| App   | Package    | Role                                                  |
| ----- | ---------- | ----------------------------------------------------- |
| `web` | `@fie/web` | Business Financial OS UI (Next.js) + PWA              |
| `api` | `@fie/api` | Webhooks Hera → `@fie/erp-integration` → proyecciones |

## Web (MVP)

```bash
npx pnpm@9.15.9 --filter @fie/web dev
```

- Local: [http://localhost:3000](http://localhost:3000) · [http://localhost:3000/app](http://localhost:3000/app)
- Producción (GitHub Pages): [https://eonclothingmiami-create.github.io/intelligence-debt-app/](https://eonclothingmiami-create.github.io/intelligence-debt-app/)

### Activar Pages en GitHub

1. **Settings → Pages → Build and deployment → Source: GitHub Actions**
2. Merge/push a `main` (corre `.github/workflows/deploy-pages.yml`)

Motores en el navegador (export estático). PWA: Instalar / Agregar a inicio en el celular.

## API (Hera webhooks)

```bash
npx pnpm@9.15.9 --filter @fie/api dev
```

- Webhook: `POST http://localhost:4000/integrations/hera/events`
- Proyección: `GET http://localhost:4000/v1/projections/sales`
- Tablero: pestaña **Ventas ERP** (poll cada 8s + simular venta)
