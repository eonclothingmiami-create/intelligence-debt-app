# Reportes

## Qué es

Exportación de **hechos del tablero** para dueño, banco, contador o archivo. No recalcula: arma un snapshot y lo baja como CSV (Excel), JSON o impresión / PDF del navegador.

## Tipos (v1)

| Kind               | Audiencia          |
| ------------------ | ------------------ |
| `monthly_snapshot` | Dueño / socios     |
| `liquidity`        | Tesorería          |
| `debts`            | Banco / dueño      |
| `costs`            | Contador / dueño   |
| `capacity`         | Dueño (diario)     |
| `kpis`             | Dueño / inversores |
| `full_board`       | Archivo            |

Los gaps se listan en el export (`— (sin dato)` + lista de gaps).

## Código

- Motor: [`apps/web/src/lib/reports.ts`](../apps/web/src/lib/reports.ts)
- UI: tab **Reportes** → [`ReportsPanel.tsx`](../apps/web/src/components/os/ReportsPanel.tsx)

## Fuera de v1

Plantillas PDF tipográficas, Excel multi-hoja, envío por email, reportes programados, paquete contador DIAN.
