# Apps

| App   | Package    | Role                                     |
| ----- | ---------- | ---------------------------------------- |
| `web` | `@fie/web` | Business Financial OS UI (Next.js) + PWA |
| `api` | —          | NestJS + Prisma (siguiente fase)         |

## Web (MVP)

```bash
npx pnpm@9.15.9 --filter @fie/web dev
```

Abre [http://localhost:3000](http://localhost:3000) (landing) y [http://localhost:3000/app](http://localhost:3000/app) (tablero).

Motores conectados: break-even, liquidez, marketing plan-vs-actual, risk score, recommendation.

PWA: `manifest.webmanifest` + `sw.js` — en el celular, “Instalar app / Agregar a inicio”.
