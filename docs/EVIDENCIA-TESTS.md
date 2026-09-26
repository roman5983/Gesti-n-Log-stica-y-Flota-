# Evidencia de Ejecución de Tests — 26/09/2026

Ejecución completa de las suites automatizadas del backend y frontend.

## Backend (`cd backend && npm test`)

```
 RUN  v4.1.10

 ✓ prisma/sample-pdf.test.ts (4 tests) 14ms
 ✓ prisma/seed-history.test.ts (16 tests) 452ms
 ✓ src/shared/schemas.test.ts (19 tests) 36ms              ← NUEVO (Santiago)
 ✓ src/shared/utils/dates.test.ts (4 tests) 15ms
 ✓ src/shared/utils/crypto.test.ts (4 tests) 14ms
 ✓ src/shared/utils/like.test.ts (2 tests) 8ms
 ✓ src/modules/settings/settings.schemas.test.ts (9 tests) 28ms   ← NUEVO (Santiago)
 ✓ src/modules/maintenance-types/maintenance-types.schemas.test.ts (4 tests) 18ms
 ✓ src/modules/maintenances/maintenances.repository.test.ts (9 tests) 45ms
 ✓ src/modules/maintenances/maintenances.service.test.ts (5 tests) 20ms
 ✓ src/modules/vehicles/vehicles.schemas.test.ts (19 tests) 38ms  ← NUEVO (Santiago)
 ✓ src/modules/audit-logs/audit-logs.service.test.ts (4 tests) 9ms
 ✓ src/modules/trips/trips.service.test.ts (2 tests) 22ms
 ✓ src/modules/alerts/alerts.scheduler.test.ts (8 tests) 96ms
 ✓ src/modules/alerts/alerts.repository.test.ts (7 tests) 25ms
 ✓ src/modules/alerts/alerts.service.test.ts (3 tests) 33ms
 ✓ src/modules/trips/trips.repository.test.ts (6 tests) 26ms
 ✓ src/modules/trips/trips.schemas.test.ts (5 tests) 25ms
 ✓ src/modules/users/users.schemas.test.ts (4 tests) 29ms
 ✓ src/modules/drivers/drivers.schemas.test.ts (3 tests) 16ms
 ✓ src/modules/documents/documents.service.test.ts (4 tests) 22ms
 ✓ src/modules/reports/reports.schemas.test.ts (3 tests) 17ms

 Test Files  22 passed (22)
      Tests  144 passed (144)
```

## Frontend (`cd frontend && npm test`)

```
 RUN  v4.1.10

 ✓ src/pages/vehicles/VehiclesPage/VehiclesPage.helpers.test.ts (3 tests) 12ms  ← NUEVO (Santiago)
 ✓ src/pages/trips/TripsPage/TripsPage.helpers.test.ts (3 tests) 5ms           ← NUEVO (Santiago)
 ✓ src/auth/guards/guards.helpers.test.ts (2 tests) 3ms
 ✓ src/pages/alerts/AlertsPage/AlertsPage.helpers.test.ts (3 tests) 3ms
 ✓ src/pages/alerts/AlertCard/AlertCard.helpers.test.ts (5 tests) 3ms
 ✓ src/pages/dashboard/DashboardPage/DashboardPage.helpers.test.ts (2 tests) 2ms
 ✓ src/pages/audit/auditLabels/auditLabels.helpers.test.ts (10 tests) 3ms
 ✓ src/utils/date-input.test.ts (3 tests) 4ms
 ✓ src/utils/datetime.test.ts (10 tests) 4ms
 ✓ src/theme/theme.tokens.test.ts (45 tests) 13ms
 ✓ src/api/axios.test.ts (5 tests) 7ms
 ✓ src/pages/alerts/AlertCard/AlertCard.test.tsx (3 tests) 397ms
 ✓ src/components/SearchField/SearchField.test.tsx (3 tests) 522ms
 ✓ src/pages/audit/AuditLogDetailDialog/AuditLogDetailDialog.test.tsx (6 tests) 783ms
 ✓ src/components/DateField/DateField.test.tsx (8 tests) 4762ms
 ✓ src/App/App.smoke.test.tsx (44 tests) 16994ms

 Test Files  16 passed (16)
      Tests  155 passed (155)
```

## Resumen

| Capa      | Archivos | Tests | Resultado |
|-----------|----------|-------|-----------|
| Backend   | 22       | 144   | ✅ 100%   |
| Frontend  | 16       | 155   | ✅ 100%   |
| **Total** | **38**   | **299** | ✅ **100%** |

## Tests nuevos de Santiago (esta sesión)

| Archivo | Capa | Tests | Qué cubre |
|---------|------|-------|-----------|
| `vehicles.schemas.test.ts` | Backend | 14 | Patente (upper-case, largo, chars), año (rango), km inicial, update parcial, listado (filtro status, search) |
| `settings.schemas.test.ts` | Backend | 10 | Update parcial, email inválido, campos vacíos, longitudes máximas, taxId |
| `shared/schemas.test.ts` | Backend | 14 | idParam, pagination defaults/límites, search trim/blanqueo, sortOrder, paginationMeta |
| `VehiclesPage.helpers.test.ts` | Frontend | 7 | statusFromParams: 4 estados válidos, null, desconocidos, case-sensitive |
| `TripsPage.helpers.test.ts` | Frontend | 7 | statusFromParams: 4 estados de viaje, null, desconocidos, case-sensitive |
| **Total nuevos** | | **52** | |
