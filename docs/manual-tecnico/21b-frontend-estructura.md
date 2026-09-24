# 21B · Estructura del frontend: una carpeta por componente, código en inglés

> **Fecha:** 23/09/2026 (pendiente 28). Los capítulos 18 a 22C citan las rutas de archivo **anteriores** a este cambio; la tabla de §21B.4 da la equivalencia. El código que muestran sigue siendo válido: se movió y se renombró, no se reescribió.

## 21B.1 · Qué cambió y por qué

Antes, cada pantalla era un único archivo que mezclaba el componente con sus tipos, constantes, listas fijas y funciones auxiliares. Además, los nombres estaban mitad en castellano (`ViajesPage`, `pages/choferes/`) y mitad en inglés (`TripFormDialog`). Ahora:

- **Cada componente vive en su propia carpeta**, con un archivo por responsabilidad. Para cambiar, por ejemplo, las opciones de orden de Mantenimiento no hace falta abrir el componente: están en `MaintenanceListTab.data.ts`.
- **Todo el código está en inglés:** carpetas, archivos, componentes, variables, comentarios y títulos de los tests.
- **Lo que ve el usuario sigue en castellano:** botones, etiquetas, mensajes y las URLs (`/viajes`, `/choferes`…). La app es para una empresa argentina, así que la interfaz no se traduce.

## 21B.2 · La convención

```
ComponentName/
├─ ComponentName.tsx          # componente: JSX, hooks, manejadores de eventos
├─ ComponentName.types.ts     # props y tipos propios (interfaz <ComponentName>Props)
├─ ComponentName.const.ts     # constantes primitivas (SCREAMING_SNAKE_CASE)
├─ ComponentName.data.ts      # listas y objetos fijos (opciones de un select, menú, etiquetas)
├─ ComponentName.helpers.ts   # funciones puras de TypeScript, sin React ni hooks
├─ ComponentName.styles.ts    # estilos (objetos sx de MUI), solo si el componente los tiene
└─ ComponentName.test.tsx     # tests (o .helpers.test.ts si prueban los helpers)
```

**Solo se crean los archivos que el componente necesita.** `PageHeader` tiene dos (`.tsx` y `.types.ts`); `AlertCard`, seis.

**Diferencias con el estándar de referencia**, acordadas el 23/09/2026 para respetar el stack del proyecto:

| Estándar de referencia | En este proyecto | Por qué |
|:--|:--|:--|
| `ComponentName.scss` | `ComponentName.styles.ts` | Los estilos son objetos `sx` de MUI, que leen el tema (colores, modo oscuro). Sumar SCSS mezclaría dos formas de estilar. |
| `ComponentName.server.ts` con callbacks `onSuccess`/`onError` | Clientes compartidos en `src/api/<recurso>.api.ts`, con `async/await` | Varias pantallas usan el mismo recurso (`tripsApi` lo usan Viajes, el diálogo de asignación y "Mi viaje"). Un cliente por recurso evita duplicar llamadas. |

## 21B.3 · El árbol

```
src/
├─ main.tsx                 # punto de entrada (providers)
├─ App/App.tsx              # rutas por rol
├─ api/                     # un cliente HTTP por recurso (trips.api.ts, alerts.api.ts…) + axios.ts
├─ auth/guards/             # RequireAuth / RequireRole + homePathForRole (.helpers.ts)
├─ components/<Name>/       # reutilizables: DataTable, SearchField, SortControl, IconBadge, NotificationProvider…
├─ hooks/                   # useAuth, useNotify, usePaginatedList, useFilterOptions, useBootstrapSession…
├─ layouts/<Name>/          # SidebarLayout, AdminLayout, OperatorLayout, DriverLayout (menús en .data.ts)
├─ lib/google-maps.ts       # carga del SDK y clave de Maps (una sola definición)
├─ pages/<módulo>/<Name>/   # pantallas y diálogos, agrupados por módulo:
│    alerts · audit · auth · dashboard · driver-portal · drivers · maintenance
│    profile · reports · settings · trips · users · vehicles
├─ stores/                  # zustand (sesión, modo de color)
├─ theme/                   # theme.ts (buildTheme), theme.tokens.ts (valores), theme.types.ts, theme.helpers.ts
└─ utils/                   # fechas, selector de fecha, blobs
```

**Imports con alias `@/`.** `@/` equivale a `src/`, configurado en `tsconfig.json`, `vite.config.ts` y `vitest.config.ts`. Entre archivos de la misma carpeta se usa `./`; para todo lo demás, `@/…`. Así un import se lee igual desde cualquier lugar y no se rompe si una carpeta se mueve.

## 21B.4 · Equivalencias (ruta anterior → ruta actual)

Los componentes reutilizables pasaron de `components/X.tsx` a `components/X/X.tsx`, con el mismo nombre. Además:

| Antes | Ahora |
|:--|:--|
| `App.tsx` | `App/App.tsx` |
| `auth/guards.tsx` | `auth/guards/guards.tsx` |
| `auth/guards.test.ts` | `auth/guards/guards.helpers.test.ts` |
| `auth/use-auth.ts` | `hooks/useAuth.ts` |
| `hooks/use-color-mode.ts` | `hooks/useColorMode.ts` |
| `hooks/use-notify.ts` | `hooks/useNotify.ts` |
| `theme.ts` | `theme/theme.ts` |
| `theme-tokens.ts` | `theme/theme.tokens.ts` |
| `theme-tokens.test.ts` | `theme/theme.tokens.test.ts` |
| `components/AppSidebarLayout.tsx` | `layouts/SidebarLayout/SidebarLayout.tsx` |
| `layouts/AdminLayout.tsx` | `layouts/AdminLayout/AdminLayout.tsx` |
| `layouts/OperadorLayout.tsx` | `layouts/OperatorLayout/OperatorLayout.tsx` |
| `layouts/ChoferLayout.tsx` | `layouts/DriverLayout/DriverLayout.tsx` |
| `pages/alertas/AlertasPage.tsx` | `pages/alerts/AlertsPage/AlertsPage.tsx` |
| `pages/alertas/AlertCard.tsx` | `pages/alerts/AlertCard/AlertCard.tsx` |
| `pages/alertas/AlertCard.test.tsx` | `pages/alerts/AlertCard/AlertCard.test.tsx` |
| `pages/alertas/alert-presentation.ts` | `pages/alerts/AlertCard/AlertCard.helpers.ts` |
| `pages/alertas/alert-presentation.test.ts` | `pages/alerts/AlertCard/AlertCard.helpers.test.ts` |
| `pages/auditoria/AuditoriaPage.tsx` | `pages/audit/AuditLogPage/AuditLogPage.tsx` |
| `pages/auditoria/AuditLogDetailDialog.tsx` | `pages/audit/AuditLogDetailDialog/AuditLogDetailDialog.tsx` |
| `pages/auditoria/AuditLogDetailDialog.test.tsx` | `pages/audit/AuditLogDetailDialog/AuditLogDetailDialog.test.tsx` |
| `pages/auditoria/audit-labels.ts` | `pages/audit/auditLabels/auditLabels.helpers.ts` |
| `pages/auditoria/audit-labels.test.ts` | `pages/audit/auditLabels/auditLabels.helpers.test.ts` |
| `pages/auth/LoginPage.tsx` | `pages/auth/LoginPage/LoginPage.tsx` |
| `pages/chofer/MiViajePage.tsx` | `pages/driver-portal/MyTripPage/MyTripPage.tsx` |
| `pages/chofer/MiDocumentacionPage.tsx` | `pages/driver-portal/MyDocumentsPage/MyDocumentsPage.tsx` |
| `pages/chofer/MiHistorialPage.tsx` | `pages/driver-portal/MyTripHistoryPage/MyTripHistoryPage.tsx` |
| `pages/choferes/ChoferesPage.tsx` | `pages/drivers/DriversPage/DriversPage.tsx` |
| `pages/choferes/DriverCredentialsDialog.tsx` | `pages/drivers/DriverCredentialsDialog/DriverCredentialsDialog.tsx` |
| `pages/choferes/DriverDocumentsDialog.tsx` | `pages/drivers/DriverDocumentsDialog/DriverDocumentsDialog.tsx` |
| `pages/choferes/DriverFormDialog.tsx` | `pages/drivers/DriverFormDialog/DriverFormDialog.tsx` |
| `pages/configuracion/ConfiguracionPage.tsx` | `pages/settings/SettingsPage/SettingsPage.tsx` |
| `pages/dashboard/DashboardPage.tsx` | `pages/dashboard/DashboardPage/DashboardPage.tsx` |
| `pages/perfil/MisDatosPage.tsx` | `pages/profile/MyProfilePage/MyProfilePage.tsx` |
| `pages/reportes/ReportesPage.tsx` | `pages/reports/ReportsPage/ReportsPage.tsx` |
| `pages/mantenimiento/MantenimientoPage.tsx` | `pages/maintenance/MaintenancePage/MaintenancePage.tsx` |
| `pages/mantenimiento/TiposMantenimientoTab.tsx` | `pages/maintenance/MaintenanceTypesTab/MaintenanceTypesTab.tsx` |
| `pages/mantenimiento/MaintenanceListTab.tsx` | `pages/maintenance/MaintenanceListTab/MaintenanceListTab.tsx` |
| `pages/mantenimiento/CreateMaintenanceDialog.tsx` | `pages/maintenance/CreateMaintenanceDialog/CreateMaintenanceDialog.tsx` |
| `pages/mantenimiento/MaintenanceDetailDialog.tsx` | `pages/maintenance/MaintenanceDetailDialog/MaintenanceDetailDialog.tsx` |
| `pages/mantenimiento/MaintenanceTypeFormDialog.tsx` | `pages/maintenance/MaintenanceTypeFormDialog/MaintenanceTypeFormDialog.tsx` |
| `pages/usuarios/UsuariosPage.tsx` | `pages/users/UsersPage/UsersPage.tsx` |
| `pages/usuarios/UserFormDialog.tsx` | `pages/users/UserFormDialog/UserFormDialog.tsx` |
| `pages/vehiculos/VehiculosPage.tsx` | `pages/vehicles/VehiclesPage/VehiclesPage.tsx` |
| `pages/vehiculos/VehicleFormDialog.tsx` | `pages/vehicles/VehicleFormDialog/VehicleFormDialog.tsx` |
| `pages/viajes/ViajesPage.tsx` | `pages/trips/TripsPage/TripsPage.tsx` |
| `pages/viajes/TripFormDialog.tsx` | `pages/trips/TripFormDialog/TripFormDialog.tsx` |
| `pages/viajes/AssignTripDialog.tsx` | `pages/trips/AssignTripDialog/AssignTripDialog.tsx` |
| `pages/viajes/FinishTripDialog.tsx` | `pages/trips/FinishTripDialog/FinishTripDialog.tsx` |
| `pages/viajes/TripDetailDialog.tsx` | `pages/trips/TripDetailDialog/TripDetailDialog.tsx` |

Componentes que cambiaron de nombre: `ViajesPage` → `TripsPage`, `ChoferesPage` → `DriversPage`, `VehiculosPage` → `VehiclesPage`, `MantenimientoPage` → `MaintenancePage`, `TiposMantenimientoTab` → `MaintenanceTypesTab`, `AlertasPage` → `AlertsPage`, `AuditoriaPage` → `AuditLogPage`, `UsuariosPage` → `UsersPage`, `ReportesPage` → `ReportsPage`, `ConfiguracionPage` → `SettingsPage`, `MisDatosPage` → `MyProfilePage`, `MiViajePage` → `MyTripPage`, `MiDocumentacionPage` → `MyDocumentsPage`, `MiHistorialPage` → `MyTripHistoryPage`, `ChoferLayout` → `DriverLayout`, `OperadorLayout` → `OperatorLayout` y `AppSidebarLayout` → `SidebarLayout`.

## 21B.5 · Cómo se hizo y cómo se verificó

La migración fue mecánica y reproducible. Un script movió los archivos, renombró los componentes y reescribió cada import a su nueva ruta. También separó las declaraciones de cada archivo en sus hermanos (`.types`, `.const`, `.data`, `.helpers`), llevando con ellas solo los imports que usan. Algunas piezas se ajustaron a mano:

- los menús pasaron a `.data.ts` guardando el **componente** del ícono, no un elemento JSX, así `.data.ts` no necesita JSX;
- `IconBadge` es el círculo con ícono que antes estaba copiado en `KpiCard` y en `AlertCard`;
- `homePathForRole` salió de `guards.tsx`, lo que eliminó el único warning de ESLint del proyecto (pendiente 24);
- la clave de Google Maps pasó a estar definida una sola vez, en `lib/google-maps.ts`;
- la carga de sesión al arrancar pasó de `App.tsx` a su propio hook, `useBootstrapSession`.

**Verificación:** los tests del frontend (102 en ese momento; 144 con el smoke test agregado en la revisión posterior; 149 tras el merge del 24/09/2026), `tsc`, ESLint (sin errores ni warnings) y `vite build` pasan. El comportamiento no cambió.
