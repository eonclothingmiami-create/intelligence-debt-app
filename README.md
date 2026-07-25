# Business Financial OS

**CFO digital** de la empresa — no es un ERP, no es contabilidad, no es solo deudas.

Canon de producto: [docs/PRODUCT_VISION.md](docs/PRODUCT_VISION.md)

## Principios

- Decisiones con **datos reales** (ERP + usuario + políticas), sin supuestos silenciosos
- Equilibrio: liquidez · deuda · flujo · patrimonio · operación · uso del efectivo
- **Nunca** comprometer la operación por pagar deuda
- Éxito = responder “¿qué hago con mi dinero hoy?” — no cantidad de gráficos

Configuración: [docs/CONFIGURATION_PRINCIPLE.md](docs/CONFIGURATION_PRINCIPLE.md) · ERP: [docs/ERP_INTEGRATION.md](docs/ERP_INTEGRATION.md)

## Packages

```text
packages/
  erp-integration/   # Ventas Hera → domain events (no ERP DB access)
  debt-manager/      # Obligaciones vivas + historial eventos (SoT usuario)
  break-even-engine/
  financial-engine/  # Debt Engine (math)
  liquidity-engine/
  risk-engine/
  cashflow-engine/
  simulation-engine/
  optimization-engine/
  recommendation-engine/
  shared/
```

ERP boundary: [docs/ERP_INTEGRATION.md](docs/ERP_INTEGRATION.md)

## Commands

```bash
npx pnpm@9.15.9 install
npx pnpm@9.15.9 test
npx pnpm@9.15.9 build
npx pnpm@9.15.9 --filter @fie/web dev
```

## Web app (MVP)

Local:

```bash
npx pnpm@9.15.9 --filter @fie/web dev
```

- Landing: http://localhost:3000
- Tablero OS: http://localhost:3000/app
- API Hera: http://localhost:4000 (`npx pnpm@9.15.9 --filter @fie/api dev`)
- PWA instalable desde el navegador del celular

### Deploy (GitHub Pages — sin Vercel)

1. Repo → **Settings → Pages → Source: GitHub Actions**
2. Push a `main` (workflow `Deploy GitHub Pages`)
3. URL pública:

`https://eonclothingmiami-create.github.io/intelligence-debt-app/`
