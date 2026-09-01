# Plan de Pruebas — Sistema de Gestión Logística y Flota (TP DSW)

Etapa 5. Combina pruebas automatizadas (unitarias, sin base de datos) y una
guía de pruebas manuales de integración de punta a punta (requieren MySQL +
seed corriendo). Fuente de verdad: `analisis-funcional-gestion-logistica.md`.

## 1. Pruebas automatizadas (Vitest)

Corren sin base de datos.

**Backend** (`cd backend && npm test`) — 23 tests:
- `crypto`: round-trip AES-256-GCM, IV aleatorio, detección de manipulación, SHA-256 (A-9).
- `dates`: `utcStartOfToday`/`utcEndOfDay` (fronteras UTC, RN-1, rangos inclusivos).
- Schemas Zod: viajes (origen fijo ignorado RN-21, campos requeridos), tipos de
  mantenimiento (umbrales cross-field RN-13), usuarios (rol DRIVER rechazado, reglas de
  contraseña, filtro de rol CSV), choferes (DNI, categoría de licencia).

**Frontend** (`cd frontend && npm test`) — 5 tests:
- `datetime`: round-trip datetime-local ↔ ISO sin desplazamiento de zona horaria.
- `guards`: ruta home por rol.

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
- Eliminar un viaje pendiente → OK; eliminar uno asignado o finalizado → 422 (RN-14/RN-15).

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

## 4. Automatización futura (opcional)

Tests de integración con una base MySQL de test (o Testcontainers) que ejerciten los flujos
de §3.7–3.8 de forma programática, y tests de componente (Testing Library) para los diálogos
de formulario. Requieren infraestructura de BD en CI; quedan fuera del alcance actual.
