# Plan de Pruebas — Sistema de Gestión Logística y Flota (TP DSW)

Etapa 5. Combina pruebas automatizadas (unitarias, sin base de datos) y una
guía de pruebas manuales de integración de punta a punta (requieren MySQL +
seed corriendo). Fuente de verdad: `analisis-funcional-gestion-logistica.md`.

## 1. Pruebas automatizadas (Vitest)

Corren sin base de datos.

**Backend** (`cd backend && npm test`) — 171 tests en 27 archivos:
- `crypto`: round-trip AES-256-GCM, IV aleatorio, detección de manipulación, SHA-256 (A-9).
- `dates`: `utcStartOfToday`/`utcEndOfDay` (fronteras UTC, RN-1, rangos inclusivos).
- `like`: escape de wildcards LIKE para búsquedas seguras.
- Schemas Zod compartidos (`shared/schemas`): coerción de id param, defaults y límites de
  paginación, trim y blanqueo de search, sort order, y helper `paginationMeta`.
- Schemas Zod de módulos: viajes (origen fijo ignorado RN-21, campos requeridos), tipos de
  mantenimiento (umbrales cross-field RN-13), usuarios (rol DRIVER rechazado, reglas de
  contraseña, filtro de rol CSV), choferes (DNI, categoría de licencia), reportes (período
  máximo, dateTo ≥ dateFrom), vehículos (patente normalizada a mayúsculas, año en rango
  1950–actual+1, km inicial ≥ 0, update parcial requiere al menos un campo, filtro de
  status y búsqueda en listado), configuración (update parcial, email válido, longitudes
  máximas, campos obligatorios no vacíos).
- Servicios y repositorios: alertas (evaluación, scheduler, repository), mantenimientos
  (repository, service), viajes (repository, service), auditoría, documentos.
- Prisma: seed-history (generación de historial puro), sample-pdf.
- Documentación de la API (`docs/openapi.test.ts`): las 60 rutas de Express están documentadas, y ninguna de más; cada ruta protegida declara sus roles y los errores 401/403; los bodies salen de los esquemas de validación; `/api/v1/openapi.json` y `/api/v1/docs` responden.
- Servicios nuevos (28/09): `users.service` (un chofer con viaje en curso no se elimina ni se desactiva; la
  comprobación corre bajo el bloqueo del chofer), `vehicles.service` (baja y eliminación deciden con la fila
  bloqueada), `auth.service` (LOGIN/LOGOUT en la auditoría), y `drivers.repository` ("disponible" exige la
  documentación completa, RN-4).

**Frontend** (`cd frontend && npm test`) — 169 tests en 20 archivos:
- `datetime`: round-trip datetime-local ↔ ISO sin desplazamiento de zona horaria,
  formatDateOnly conserva el día UTC, formatRelativeDay (Hoy/Ayer/fecha completa).
- `date-input`: parseo estricto, serialización, validación con mensajes en español.
- `guards`: ruta home por rol.
- `axios`: interceptores de refresh, manejo de errores y tiempo límite de las peticiones.
- `theme.tokens`: contraste WCAG AA para todos los pares de color (texto, sidebar,
  chart scale, tooltip) en modo claro y oscuro.
- Helpers de páginas: `VehiclesPage.helpers` (statusFromParams reconoce los cuatro estados
  válidos, rechaza desconocidos), `TripsPage.helpers` (statusFromParams con los cuatro
  estados de viaje), `AlertsPage.helpers`, `AlertCard.helpers`, `DashboardPage.helpers`,
  `auditLabels.helpers` (incluye las acciones de sesión), `DriversPage.helpers` (motivo por el que un
  chofer no está disponible).
- `form-validation`: mensajes propios para campos vacíos, formato, rango y los de
  DateField/AddressAutocomplete (formularios con `noValidate`).
- Componentes (Testing Library + jsdom): DateField, SearchField, AlertCard,
  AuditLogDetailDialog, VehicleFormDialog (un formulario vacío no se envía), EditProfileDialog (un
  email inválido no se envía), App smoke test.

## 2. Preparación del entorno de integración

```
# Backend
cd backend
cp .env.example .env         # completar DATABASE_URL, JWT secrets, PASSWORD_ENCRYPTION_KEY
npx prisma migrate dev --name init
npx prisma db seed
npm run dev                  # http://localhost:3000

# Frontend (otra terminal)
cd frontend
cp .env.example .env         # VITE_API_URL (y opcional VITE_GOOGLE_MAPS_API_KEY)
npm run dev                  # http://localhost:5173
```

Credenciales del seed: `admin@empresa.com / Admin1234!`, `operador@empresa.com / Operator1234!`,
`chofer@empresa.com / Driver1234!`.

## 3. Casos de prueba manuales (E2E)

Cada caso: acción → resultado esperado. ✅ = probar contra la app real.

### 3.1 Autenticación y sesión
- Login con credenciales válidas → entra al home según rol (Admin/Operador → Dashboard; Chofer → Mi viaje).
- Login con contraseña incorrecta → error "Invalid credentials" (sin revelar si el usuario existe).
- Recargar la página (F5) estando logueado → la sesión se re-hidrata (no vuelve al login).
- Dejar pasar >15 min y hacer una acción → el access token se renueva solo (refresh transparente); no desloguea.
- Cerrar sesión → pide confirmación; al confirmar, vuelve al login y no puede volver atrás.

### 3.2 Permisos por rol
- Operador entra a Usuarios/Auditoría/Reportes/Configuración por URL directa → redirigido a su home (rol insuficiente).
- Operador en Vehículos/Choferes/Tipos de mantenimiento → ve las listas pero SIN botones de alta/edición/baja.
- Operador intenta `POST /vehicles` por API → 403.
- Chofer sólo ve sus rutas (`/mi-viaje`, `/mi-documentacion`, `/mi-historial`).

### 3.3 Usuarios (Admin)
- Crear usuario Operador → aparece en la lista; llega un mail de credenciales (o log en modo dev).
- Crear usuario con email ya existente → 409 "Email is already in use".
- Intentar auto-desactivarse o auto-eliminarse → 422.
- Eliminar un usuario y crear otro con el mismo email → funciona (tombstone del email).
- La lista NO muestra choferes (solo Admin/Operador).

### 3.4 Vehículos
- Alta con km inicial → aparece Disponible; `accumulatedKm = km inicial`.
- Editar km inicial de un vehículo con viajes/mantenimientos → 422 (inmutable con historia).
- Desactivar un vehículo Disponible → pasa a Inactivo; reactivar → Disponible.
- Intentar desactivar un vehículo En viaje o En taller → 422.
- Patente duplicada → 409.

### 3.5 Choferes y documentación
- Crear chofer (usuario+perfil+licencia) → aparece; DNI/email únicos.
- Admin: "Ver contraseña" del chofer → muestra la contraseña (queda registrado en auditoría como VIEW_CREDENTIALS).
- Admin: cambiar contraseña del chofer → las sesiones del chofer se cierran.
- Admin: subir un documento (JPG/PNG/PDF ≤ 1 MB) → aparece; subir >1 MB → 413; subir dos del mismo tipo → 409.
- Chofer: en "Mi documentación" ve/descarga los suyos pero NO puede subir (no hay formulario) → subir por API da 403.
- Abrir un documento recién subido → se ve la imagen/PDF. (Los del seed dan 404: apuntan a archivos inexistentes.)

### 3.6 Mantenimientos
- Registrar mantenimiento → nace Pendiente en "Programados".
- Iniciar → pasa a En curso y el vehículo a En taller.
- Completar → pasa a Finalizado (aparece en "Historial"), el vehículo vuelve a Disponible y se actualiza su última fecha de mantenimiento.
- Registrar un segundo mantenimiento a un vehículo que ya tiene uno abierto → 409.
- Iniciar un mantenimiento sobre un vehículo que no está Disponible → 422.
- Adjuntar un comprobante y abrirlo → se ve; no hay opción de borrar adjunto (append-only).
- `nextMaintenanceKm < km` → 400 (cross-field).

### 3.7 Viajes (núcleo — efectos encadenados)
- Crear viaje: origen fijo (Ciudad Industria…), destino, fecha/hora → queda "Pendiente de asignación".
- Editar un viaje pendiente (destino/fecha) → guarda; la hora mostrada coincide antes y después (sin desplazamiento de zona horaria).
- Asignar: elegir un chofer disponible → el viaje pasa a "En viaje", se asigna un vehículo automáticamente (menor km), el vehículo pasa a "En viaje".
- Intentar asignar con un chofer con licencia vencida (Lucía del seed) → no aparece en la lista de disponibles; si se fuerza por API → 422 (RN-1).
- Asignar cuando no hay vehículos disponibles → 409.
- Finalizar (Operador o Chofer): km de llegada ≤ km de salida → error; km mayor → viaje "Finalizado", vehículo liberado a Disponible con odómetro actualizado, y suben `viajes_realizados`/`promedio_km` del chofer.
- Doble finalización simultánea (Chofer y Operador a la vez) → solo una aplica; la otra recibe "Only in-progress trips can be finished" (lock de fila).
- Eliminar un viaje pendiente → OK; eliminar uno asignado o finalizado → 422 (RN-15). *(2026-09-21: RN-14 derogada; un viaje pendiente o en curso se puede cancelar con `POST /trips/:id/cancel`, uno finalizado o ya cancelado → 422. 2026-09-24: ahora solo se cancelan viajes pendientes; uno en curso también → 422.)*

### 3.8 Alertas
- `POST /alerts/evaluate` (Admin) sobre el seed → crea varias: licencia por vencer (Carlos) y vencida (Lucía), documento por vencer/vencido, seguro por vencer (BBB222) y vencido (CCC333), km de mantenimiento superado (BBB222), vehículo inactivo (CCC333).
- Marcar una alerta como resuelta → pasa a la pestaña Resueltas.
- Corregir la condición (p. ej. reactivar el vehículo inactivo) y volver a evaluar → la alerta se auto-resuelve (reconciliación).
- Evaluar dos veces seguidas → no duplica alertas (idempotente / advisory lock).

### 3.9 Reportes, Auditoría, Dashboard, Configuración
- Reporte por período que incluya los viajes del seed → totales, por chofer, por vehículo, destinos frecuentes; período inclusivo (incluye el último día).
- Auditoría → filtrar por entidad/acción/fechas; abrir el detalle de una fila → muestra antes/después (con credenciales redactadas).
- Dashboard → KPIs y gráfico de viajes por mes reflejan el estado actual; los totales del Admin coinciden con las listas.
- Configuración (Admin) → editar datos de empresa y guardar → persiste; recargar y sigue.

### 3.10 UI transversal
- Achicar la ventana (< breakpoint md) → aparece el botón hamburguesa y el menú lateral se abre.
- Formularios con datos inválidos → muestran el error del backend tal cual (400/409/422).

## 4. Pruebas automatizadas con base de datos

Las dos suites usan una base MySQL aparte: `TEST_DATABASE_URL` en `backend/.env`. Su nombre tiene que terminar en `_test`, porque los tests la vacían y la resiembran. Se crea y se migra sola con `prisma migrate deploy`. Resultado en la máquina de Román el 28/09/2026: 23/23 de integración y 12/12 E2E.

**Integración** (`cd backend && npm run test:integration`, `backend/test/integration/`) — 23 tests. Usan la app Express real (supertest) contra MySQL; cada archivo vacía la base y crea solo los datos que necesita:
- `trips.int.test.ts`: crear → asignar (vehículo con menos km y seguro vigente) → finalizar, con los efectos en el vehículo, el chofer y la auditoría; RN-1, RN-4, RN-5, sin vehículos, solo sin seguro (RN-SEGURO), cancelar y eliminar solo pendientes, origen fijo; permisos por rol (el chofer solo ve lo suyo; el operador, sin secciones de admin; sin token, 401).
- `concurrency.int.test.ts`: las carreras del capítulo 23 disparadas en paralelo: dos asignaciones del mismo viaje, el mismo chofer en dos viajes, dos viajes y un solo vehículo, dos cierres del mismo viaje, la baja de un vehículo o la eliminación de un chofer durante una asignación (5 rondas cada una) y dos altas con la misma patente. Verifican la respuesta HTTP y el estado final de la base.
- `alerts-auth.int.test.ts`: la evaluación de alertas (tipos esperados, sin duplicados, dos evaluaciones simultáneas, auto-resolución); la sesión (login, refresh con cookie, logout, LOGIN/LOGOUT en la auditoría, reúso de un refresh token rotado, mismo 401 para contraseña incorrecta y cuenta inexistente).

En su primera corrida encontraron un error real de aislamiento de transacciones, que ya está corregido (ver el DEVLOG y el capítulo 23 del manual).

**E2E** (`cd frontend && npm run test:e2e`, `frontend/e2e/`) — 12 tests con Playwright en Chromium. Levantan su propio backend (puerto 3100) y frontend (puerto 5180) contra la base de test, resembrada con los datos de demostración en cada corrida:
- `login.spec.ts`: contraseña incorrecta; pantalla de inicio y secciones visibles por rol; el operador no entra a una URL de administración escribiéndola a mano.
- `trip-flow.spec.ts`: el operador crea un viaje y lo asigna; el chofer lo ve en "Mi viaje" y lo cierra con el kilometraje; el operador lo ve finalizado.
- `admin.spec.ts`: alta de un vehículo; formulario vacío con el mensaje de la app; evaluación de alertas en tarjetas; inicio de sesión en la auditoría; zona horaria, idioma y formato de fecha no editables.

La guía manual de la sección 3 sigue sirviendo para lo que no está automatizado (archivos, mapas, reportes, modo oscuro).
