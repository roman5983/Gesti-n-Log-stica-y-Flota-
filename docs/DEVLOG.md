# Bitácora de Desarrollo — Sistema de Gestión Logística y Flota (TP DSW)

Registro oficial de cada paso de desarrollo aprobado. Una entrada por paso,
agregada **después** de la aprobación del usuario (incluye sus observaciones
y las correcciones derivadas de la revisión). Fuente de verdad de los
requerimientos: `analisis-funcional-gestion-logistica.md` (consolidado, 2026-07-13).

Nota de idioma: la bitácora se escribe en castellano (directiva del 2026-07-15);
el código y los documentos técnicos, en inglés.

---

## Entrada 1 — Etapa 1: Arquitectura del sistema (aprobada)

**Alcance.** Arquitectura general, estructura de carpetas, convenciones, patrón de arquitectura, flujos frontend↔backend↔BD.

**Entregado.** `etapa-1-arquitectura.md`.

**Decisiones clave.**
- Monorepo (`backend/` + `frontend/`), SPA React + API REST `/api/v1` + MySQL.
- Backend en capas (Routes → Controllers → Services → Repositories), organizado en módulos verticales.
- Las reglas de negocio viven en los services; los repositories son la única puerta al ORM.
- Transiciones de estado como endpoints POST explícitos (`/trips/:id/assign`, `/finish`).
- Stack cerrado con el usuario: Prisma, Material UI, Zustand, Zod, Axios.
- Mejora propuesta y aceptada: TypeScript en ambas aplicaciones.

---

## Entrada 2 — Etapa 2 (parte 1): DER definitivo (aprobado)

**Alcance.** Modelo de datos construido desde cero a partir del documento funcional consolidado (12 entidades: atributos, PK/FK, restricciones, relaciones, cardinalidades).

**Entregado.** `etapa-2-der-definitivo.md`.

**Decisiones clave.**
- Especialización usuario/chofer con PK compartida (1:1 garantizado en BD).
- Contraseñas: hash bcrypt para todos los logins + copia AES-256-GCM solo para choferes (resuelve la contradicción A-9 vs. bcrypt; opción elegida por el usuario).
- Dominios de estado cerrados como ENUM; `alert_type` como VARCHAR (taxonomía extensible, C-4).
- La disponibilidad del chofer (RN-19) es derivada, nunca se persiste.
- Archivos en filesystem, metadata + CHECK de 1 MB en BD (F-9).
- Agregados más allá del documento, aprobados: `insurance_expiry_date` (P-A), umbrales temporales de mantenimiento (P-B), tabla `refresh_tokens` (P-C), tabla `maintenance_attachments` (P-D).

---

## Entrada 3 — Etapa 2 (parte 2): Modelo relacional + script SQL (aprobado)

**Alcance.** Modelo relacional y DDL de referencia para MySQL 8.

**Entregado.** `etapa-2-modelo-relacional.md`, `schema.sql`.

**Decisiones clave.**
- Reglas de negocio empujadas a la BD donde es posible: CHECK `arrival_km > departure_km` (RN-5), archivos ≤ 1 MB (F-9), consistencia estado↔datos del viaje.
- `ON DELETE RESTRICT` casi universal (materializa la baja lógica RN-20); CASCADE solo en adjuntos y refresh tokens.
- Índices solo donde una consulta documentada los justifica; el más crítico: `trips(driver_id, status)`.
- Verificado con parser del dialecto MySQL (16 sentencias sin errores).

---

## Entrada 4 — Directiva: código y documentos en inglés

Desde este punto, todo el código y los documentos generados se escriben en
inglés (la conversación sigue en castellano; los textos de la UI quedan en
español según los mockups). `schema.sql` fue regenerado en inglés (`users`,
`drivers`, `trips`, `AVAILABLE`, `PENDING_ASSIGNMENT`, …).
La bitácora es la excepción: por directiva posterior (2026-07-15) se lleva en castellano.

---

## Entrada 5 — Etapa 3, Módulo 1: Setup del backend + Autenticación (aprobado)

**Alcance.** Fundaciones del proyecto backend y primer módulo funcional.

**Entregado.** `backend/` — proyecto Express + TypeScript + Prisma: configuración de entorno validada al arranque (fail-fast), schema de Prisma espejo del DDL, middlewares (`authenticate`, `authorize`, `validate`, `errorHandler`, `rateLimiter`), jerarquía de errores (`AppError`), utilidad AES-256-GCM, módulo auth (`POST /auth/login|refresh|logout`, `GET /auth/me`), seed con catálogo + un usuario por rol.

**Decisiones clave.**
- **Prisma 7** (cliente Rust-free, driver adapter MariaDB): major vigente, sin binarios de engine; cliente generado en `src/generated/` (ignorado en Git, se regenera en `postinstall`).
- Refresh tokens opacos (no JWT), persistidos solo como SHA-256, con **rotación**; un token reusado revoca todas las sesiones del usuario. Cookie `httpOnly` limitada a `/api/v1/auth`.
- Errores de login indistinguibles (sin enumeración de cuentas); rate limit 10/15min.
- A-9 implementado: chofer seedeado con hash bcrypt + copia cifrada AES.

**Verificación.** Typecheck limpio; smoke test en runtime (health 200, validación 400 con detalle, 401, 404, formato único de error).

**Ajustes del usuario durante la revisión.** `tsconfig` a `module: nodenext`; `DATABASE_URL` con `allowPublicKeyRetrieval=true`; corrida local contra MySQL confirmada.

---

## Entrada 6 — Etapa 3, Módulo 2: Usuarios + servicio de Auditoría (aprobado con observaciones)

**Alcance.** CRUD de usuarios (solo Admin) y el servicio de auditoría de dominio (primer uso de RN-7).

**Entregado.** `modules/users/` (schemas, repository, service, controller, routes), `modules/audit-logs/` (lado de escritura: repository + service), `shared/schemas.ts` (id param, paginación). Endpoints: `GET/POST /users`, `GET/PATCH/DELETE /users/:id`, `POST /users/:id/activate|deactivate`.

**Decisiones clave.**
- La auditoría se escribe dentro de la misma transacción que el cambio de negocio; repositorio INSERT-only (A-5); campos sensibles redactados antes de persistir.
- `role: DRIVER` rechazado en `/users` — los choferes se crean atómicamente vía `POST /drivers` (Módulo 3).
- Consistencia A-9: cambiar la contraseña de un chofer por PATCH actualiza la copia AES en la misma transacción.
- Guardas de auto-modificación: un admin no puede desactivarse ni eliminarse a sí mismo.
- Desactivación/eliminación revoca todos los refresh tokens del usuario afectado.

**Observaciones del usuario (todas corregidas y verificadas).**
1. **Bug:** `emailTaken()` ignoraba filas soft-deleted pero el UNIQUE(email) de la BD no → baja lógica + recreación con el mismo email producía un 500. **Fix:** tombstone del email en la baja lógica (`deleted-{id}@deleted.local`, original preservado en `previousData` de auditoría) + traducción global de Prisma P2002 a 409 CONFLICT (cubre también carreras de creación concurrente y protege los futuros campos únicos).
2. Cambiar la contraseña por PATCH no revocaba sesiones → ahora revoca todos los refresh tokens del afectado.
3. Un admin podía cambiarse su propio rol → bloqueado (422).

---

## Entrada 7 — Etapa 3, Módulo 3: Choferes (aprobado con observación)

**Alcance.** Gestión de choferes: creación atómica usuario+perfil, licencia como atributo del chofer (C-2), credenciales administradas desde la pantalla del chofer (A-9/F-4), disponibilidad calculada (RN-19).

**Entregado.** `modules/drivers/` (schemas, repository, service, controller, routes), `shared/utils/dates.ts`. Endpoints: `GET /drivers` (paginado, filtro `?available=`, búsqueda nombre/DNI), `GET /drivers/:id`, `POST /drivers`, `PATCH /drivers/:id`, `GET|PUT /drivers/:id/password`.

**Decisiones clave.**
- `POST /drivers` crea usuario (rol DRIVER forzado) + fila driver en una transacción, con email y DNI únicos validados.
- Disponibilidad nunca persistida (RN-19): calculada en respuestas y como filtro SQL (`available=true`) — consulta que consumirá la asignación automática de viajes.
- `GET /drivers/:id/password` (solo ADMIN) descifra la copia AES y registra `VIEW_CREDENTIALS` en auditoría: el acceso a credenciales deja huella.
- `PUT /drivers/:id/password`: hash bcrypt + copia AES en la misma transacción; revoca las sesiones del chofer.
- Permisos: lecturas ADMIN + OPERATOR; mutaciones y credenciales solo ADMIN.

**Observación del usuario (corregida y verificada).**
- **Bug de timezone:** `licenseExpiryDate` (DATE) vuelve de Prisma como medianoche UTC, pero "hoy" se calculaba como medianoche local (UTC-3) → el día exacto del vencimiento la licencia figuraba inválida, violando RN-1. **Fix:** helper compartido `utcStartOfToday()` (medianoche UTC de la fecha calendario local) usado en el service y en los dos filtros del repository; verificado con `TZ=America/Argentina/Cordoba` reproduciendo el escenario (hoy = válida, ayer = inválida). Se extrajo a `shared/utils/dates.ts` porque Documentación (Módulo 7) y las alertas de vencimiento (A-12) necesitan la misma semántica.

---

## Entrada 8 — Etapa 3, Módulo 4: Vehículos (aprobado)

**Alcance.** CRUD de la flota con estados C-1, kilometraje inicial manual (A-13) e Inactivo exclusivo del Admin (RN-16/A-8).

**Entregado.** `modules/vehicles/` (schemas, repository, service, controller, routes). Endpoints: `GET /vehicles` (paginado, filtro por estado, búsqueda patente/modelo), `GET /vehicles/:id`, `POST /vehicles`, `PATCH /vehicles/:id`, `POST /vehicles/:id/activate|deactivate`, `DELETE /vehicles/:id`.

**Decisiones clave.**
- RN-16 en dos capas: transiciones a INACTIVE como endpoints explícitos solo-ADMIN; `ON_TRIP` e `IN_WORKSHOP` no son seteables por API — solo los módulos de Viajes y Mantenimientos los producen.
- Guardas: no se desactiva ni elimina un vehículo `ON_TRIP`; activar solo desde `INACTIVE`; desactivación idempotente.
- `initialKm` editable solo sin historia (sin viajes ni mantenimientos); con la corrección, `accumulatedKm` acompaña. Al crear, `accumulatedKm = initialKm`.
- Tombstone de patente en la baja lógica (`DEL-{id}`) — patrón del fix de la Entrada 6 aplicado preventivamente.
- `insuranceValid` calculado con `utcStartOfToday()` (fix de la Entrada 7 reutilizado); insumo de la futura alerta `INSURANCE_EXPIRED`.

**Verificación.** Typecheck limpio; smoke test: OPERATOR desactivando → 403, body inválido → 400 con detalle, estado inválido en filtro → 400.

---

## Entrada 9 — Etapa 3, Módulo 5: Tipos de mantenimiento (aprobado)

**Alcance.** CRUD del catálogo que parametriza RN-3/RN-13: umbrales de km (`kmAlert`/`kmTarget`) y temporales opcionales (`monthsAlert`/`monthsTarget`, C-7).

**Entregado.** `modules/maintenance-types/` (schemas, repository, service, controller, routes). Endpoints: `GET /maintenance-types` (paginado), `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`.

**Decisiones clave.**
- Invariantes cross-field en Zod (`kmTarget ≥ kmAlert`, `monthsTarget ≥ monthsAlert`); un catálogo inválido no puede crearse (CHECKs de BD como segunda capa).
- Update con semántica PUT (set completo): evita romper el invariante con ediciones parciales; omitir los meses elimina el umbral temporal.
- Borrado físico solo si no está en uso (las filas de catálogo sin referencias no tienen historia); tipo referenciado → 422, con FK RESTRICT como segunda línea.
- Permisos: lecturas ADMIN+OPERATOR; mutaciones ADMIN.

**Verificación.** Typecheck limpio; smoke test: umbrales invertidos → 400 con ambos errores cross-field; OPERATOR creando → 403.

---

## Entrada 10 — Etapa 3, Módulo 6: Mantenimientos (aprobado con dos rondas de observaciones)

**Alcance.** Ciclo completo de mantenimientos (C-6) con máquina de estados, efectos sobre el vehículo (RN-9) y adjuntos con límite de 1 MB (F-9). Primer módulo con transiciones que afectan otra entidad.

**Entregado.** `modules/maintenances/` (schemas, repository, service, controller, routes) + infraestructura reutilizable: `config/constants.ts` (1 MB, MIME, lead de 14 días para A-12, origen fijo RN-21), `middlewares/upload.ts`, `shared/utils/files.ts`. Endpoints: `GET /maintenances` (paginado, filtros vehículo/estado/vista scheduled|history), `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/start|complete`, `POST /:id/attachments`, `GET /:id/attachments/:attachmentId`.

**Decisiones clave.**
- Máquina de estados como acciones POST explícitas: `create` → PENDING; `start` → IN_PROGRESS con efecto vehículo AVAILABLE → IN_WORKSHOP; `complete` → COMPLETED con efecto IN_WORKSHOP → AVAILABLE + `lastMaintenanceDate` (RN-9). Cada transición ejecuta ambos cambios en una sola transacción.
- Guardas: iniciar exige vehículo AVAILABLE; un COMPLETED es inmutable (RN-22); vistas Programados (PENDING+IN_PROGRESS) e Historial (COMPLETED) vía `view`.
- Adjuntos append-only: se pueden agregar aunque el mantenimiento esté COMPLETED (RN-22 protege el registro, no la evidencia aditiva); sin endpoint de borrado/reemplazo.
- Permisos: ADMIN + OPERATOR (operación del operador, P-OP-5).

**Observaciones ronda 1 (corregidas y verificadas).**
- **Bug de adjuntos huérfanos:** `diskStorage` dejaba en disco el archivo parcial cuando superaba 1 MB. **Fix:** `memoryStorage` — la validación de tamaño/MIME ocurre en memoria; el service escribe el buffer solo tras validar y lo borra si falla la BD. Verificado: dos rechazos consecutivos no crean ni la carpeta.

**Observaciones ronda 2 — cross-module (corregidas y verificadas).**
- **Bug (Módulo 4):** el soft-delete de vehículo solo bloqueaba `ON_TRIP`, no un mantenimiento abierto. **Fix:** `vehicles.service.softDelete` bloquea si `hasOpenForVehicle` (cubre IN_WORKSHOP y PENDING).
- **Race del mantenimiento abierto:** chequeo fuera de transacción sin UNIQUE de respaldo. **Fix:** chequeo movido dentro de la transacción + lock de fila del vehículo (`SELECT ... FOR UPDATE`, `lockVehicle`) que serializa creates concurrentes.
- **P2003 (FK) sin mapear (Módulo 5):** el delete de un tipo referenciado podía filtrar un 500. **Fix:** P2003 → 409 CONFLICT en el error handler (junto al P2002 existente). Verificado con errores simulados.

**Observaciones ronda 3 (corregidas y verificadas).**
- Adjuntar en COMPLETED: comportamiento explicitado con comentario (RN-22 no cubre evidencia aditiva) + política append-only documentada.
- **Endpoint de descarga faltante:** `findAttachment` era código muerto. **Fix:** `GET /:id/attachments/:attachmentId` sirve el archivo inline, acotado a su mantenimiento; 404 si falta en disco.
- Invariante `nextMaintenanceKm >= km`: cross-field en el schema (ambos presentes) + re-chequeo en el service contra el valor almacenado (edición parcial).

**Nota de infraestructura.** Corregido además un desajuste de versiones: `@types/multer` bajado de 2.2.0 (incompatible con multer 1.4.x, rompía `Express.Multer.File`) a 1.4.13.

---

## Entrada 11 — Etapa 3, Módulo 7: Documentación (aprobado con dos rondas de observaciones)

**Alcance.** CRUD de documentos del chofer (F-4) con vencimientos, upload/descarga con límite de 1 MB (F-9), reutilizando la infraestructura de archivos del Módulo 6.

**Entregado.** `modules/documents/` (schemas, repository, service, controller, routes), anidado en `/drivers/:driverId/documents`. Endpoints: `GET/POST /`, `GET /:documentId` (descarga inline), `PATCH /:documentId`, `DELETE /:documentId`.

**Decisiones clave.**
- Sub-recurso anidado (router con `mergeParams`): la documentación depende del chofer (1:N del DER).
- Autorización a nivel de recurso: un chofer solo accede a lo suyo; el Admin a todos (ownership resuelto en el service).
- Reutilización de `memoryStorage` + `storeFile` + rollback; `expired` calculado con `utcStartOfToday()`.
- Baja lógica que conserva el archivo en disco (el registro lo referencia para auditoría).

**Observaciones ronda 1 — compliance (corregidas y verificadas).**
- **Mutaciones restringidas a ADMIN:** un DRIVER podía editar el vencimiento (PATCH) y borrar (DELETE) sus propios documentos, pudiendo falsear u ocultar su estado de cumplimiento. **Fix:** POST/GET siguen para ADMIN+DRIVER (con ownership); PATCH/DELETE pasan a ADMIN-only (authorize por ruta). Verificado: DRIVER en PATCH/DELETE → 403.
- **Un documento activo por tipo:** nuevo `activeTypeExists(driverId, type)` filtrando `deletedAt: null` (en el service, no UNIQUE de BD, por el soft-delete y la falta de índice único parcial en MySQL); al crear un tipo ya activo → 409.

**Observación ronda 2 (corregida y verificada).**
- El PATCH permitía cambiar `documentType` sin validar unicidad → dos documentos activos del mismo tipo. **Fix:** en `update`, si el tipo cambia se chequea `activeTypeExists(driverId, nuevoTipo, documentId)` con `excludeId` → 409 (mismo patrón que el DNI en el update de choferes).

---

## Entrada 12 — Etapa 3, Módulo 8: Viajes (aprobado con dos rondas de observaciones)

**Alcance.** Núcleo del negocio: crear (origen fijo RN-21), asignar (vehículo automático RN-12, validaciones RN-1/4/19), finalizar (RN-5/8/11), eliminar solo PENDING (RN-15), estados PENDING_ASSIGNMENT → IN_PROGRESS → COMPLETED, sin cancelación (RN-14).

**Entregado.** `modules/trips/` (schemas, repository, service, controller, routes) + `documentsRepository.hasExpiredActive` (RN-4). Endpoints: `GET /trips` (paginado, filtros estado/fechas/chofer/vehículo), `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/assign`, `POST /:id/finish`, `DELETE /:id`.

**Decisiones clave.**
- Flujo de dos pasos (A-1): create genera la ruta (origen fijo, no del cliente); assign asigna y arranca el viaje.
- Asignación automática de vehículo (RN-12/C-8): operador elige chofer, sistema elige el AVAILABLE con menor km (`FOR UPDATE SKIP LOCKED`).
- Validaciones de assign bajo lock del chofer: RN-1 (licencia), RN-4 (docs vencidos), RN-19 (sin viaje activo; RN-6 se reduce a esto porque assign arranca el viaje al instante).
- Efectos encadenados en transacción: assign (viaje IN_PROGRESS, vehículo ON_TRIP, snapshot departureKm); finish (odómetro, vehículo AVAILABLE, viaje COMPLETED, stats denormalizadas del chofer).
- Finish por chofer (propio) u operador (A-3); delete solo PENDING (hard delete, sin historia); sin cancelación (RN-14).
- Un DRIVER solo ve/consulta sus propios viajes (forzado en el service).

**Observaciones ronda 1 — concurrencia (corregidas y verificadas).**
- **Falta lock en `finish`:** dos finish simultáneos (chofer + operador) leían IN_PROGRESS y aplicaban los efectos dos veces (odómetro pisado, stats del chofer dobladas). **Fix:** `lockTrip(id, tx)` + relectura y revalidación de estado bajo el lock; el perdedor ve COMPLETED y se rechaza.
- **`assign` usaba el chofer leído antes del lock:** **Fix:** relectura del chofer bajo `lockDriver` para chequear isActive/licencia sobre dato fresco.
- **RN-4 documentado:** la ausencia de documentos no bloquea a propósito (solo los vencidos) — decisión de negocio, comentario aclaratorio.

**Observación ronda 2 (corregida y verificada).**
- **Bug BigInt:** `pickAvailableVehicle` devolvía el id de `$queryRaw` como BigInt (oculto por el tipo declarado `{id:number}`), que rompía `findById` con `PrismaClientValidationError`. **Fix:** tipar el raw como `{id:bigint}[]` y convertir con `Number()`.

---

## Entrada 13 — Etapa 3, Módulo 9: Reportes (aprobado con observación)

**Alcance.** Informe por período (A-11 / P-AD-5), solo lectura y solo ADMIN.

**Entregado.** `modules/reports/` (schemas, repository, service, controller, routes). Endpoint: `GET /reports/trips?dateFrom&dateTo`.

**Decisiones clave.**
- Ambas fechas obligatorias, `dateTo >= dateFrom` cross-field; período inclusivo por día (`dateTo` normalizado a fin de día).
- "Viajes realizados" = COMPLETED con `finishedAt` en el rango.
- Agregación en memoria (no `groupBy`): el km por viaje es derivado (`arrivalKm - departureKm`).
- Informe: resumen (viajes finalizados, km totales, distancia promedio, mantenimientos completados, alertas generadas/resueltas), por chofer, por vehículo, destinos top 10.
- Las métricas de alertas ya se consultan (la tabla `alerts` ya existía en el modelo).

**Observación (corregida y verificada).**
- **Bug de timezone en el límite superior:** `endOfDay` usaba `setHours` (hora local del servidor) sobre fechas parseadas como medianoche UTC → en UTC-3, "del 1 al 31" terminaba a las 02:59Z del 31 y se comía casi todo el día. **Fix:** helper compartido `utcEndOfDay(date)` en `shared/utils/dates.ts` con `setUTCHours(23,59,59,999)`, junto a `utcStartOfToday`; verificado con `TZ=America/Argentina/Cordoba`.

---

## Entrada 14 — Etapa 3, Módulo 10: Alertas (aprobado con dos rondas de observaciones)

**Alcance.** Último módulo del backend. Emisión automática de alertas (F-8), taxonomía extensible (C-4), listado pendientes/resueltas, resolución manual.

**Entregado.** `modules/alerts/` (schemas, repository, service, controller, routes). Endpoints: `GET /alerts` (paginado, filtros estado/entidad/tipo), `POST /alerts/evaluate`, `POST /alerts/:id/resolve`.

**Decisiones clave.**
- **Disparo on-demand** (decisión del usuario): `POST /alerts/evaluate` (ADMIN) escanea condiciones y reconcilia; enganchable a un cron externo más adelante.
- Condiciones: licencia/documentación/seguro por vencer (14 días, A-12) y vencidos, `MAINTENANCE_KM_EXCEEDED` (RN-3, baseline = km del último mantenimiento completado o initialKm vs. menor `kmAlert`), `VEHICLE_INACTIVE`.
- Ventanas de fecha en UTC (reutiliza `utcStartOfToday`); escaneo sin N+1 (mantenimientos reducidos en memoria).
- Permisos: lecturas ADMIN+OPERATOR (dashboards); evaluate y resolve solo ADMIN.

**Observaciones ronda 1 (corregidas y verificadas).**
- **Atomicidad de `evaluate`:** chequeo + create no atómicos podían colar duplicados (sin unique parcial posible en MySQL). **Fix:** scan+reconcile dentro de `$transaction` con advisory lock `GET_LOCK`; evaluaciones concurrentes se serializan (segunda → 409).
- **Comportamiento de condiciones persistentes** (decisión del usuario): `evaluate` **reconcilia** — crea las faltantes y auto-resuelve las PENDING cuya condición ya no aplica. Resolución manual sigue disponible. Respuesta: `{ evaluated, created, autoResolved }`.
- Cosméticas: `MAINTENANCE` quitado de `ENTITY_TYPES` (sin uso); `MAINTENANCE_KM_EXCEEDED` excluye `IN_WORKSHOP` además de `INACTIVE`.

**Observación ronda 2 (corregida y verificada).**
- **Bug:** el scan de documentos filtraba solo `deletedAt` del documento, no del chofer → un chofer dado de baja/desactivado seguía generando alertas de documentos. **Fix:** `where: { deletedAt: null, driver: { user: { deletedAt: null, isActive: true } } }`, igual criterio que el scan de licencias.

---

## Entrada 15 — Cierre del backend: lectura de auditoría + dashboard + seed integral

**Alcance.** Las tres piezas que restaban para cerrar el alcance del backend (no eran bugs).

**Entregado.**
- **Lectura de auditoría (RN-7 / P-AD-3):** `GET /audit-logs` (solo ADMIN, filtros usuario/entidad/acción/fechas, paginado). El repositorio de `audit-logs` ahora expone `findMany`/`count` además de `create` — solo INSERT y SELECT, nunca update/delete (A-5). El PK BigInt se serializa como string.
- **Dashboard en vivo (P-AD-1):** `GET /dashboard` (ADMIN+OPERATOR) consolida: flota por estado, viajes por estado, choferes total/activos, mantenimientos programados (PENDING+IN_PROGRESS), alertas pendientes, usuarios, y serie de viajes por mes (últimos 6, con meses en cero pre-sembrados para eje continuo). `modules/dashboard/` nuevo (repository/service/controller/routes).
- **Seed integral (F-1):** `prisma/seed.ts` reescrito con datos coherentes y relativos a "hoy" — 6 usuarios (admin, operador, 4 choferes con licencias variadas), 5 vehículos en distintos estados, 6 documentos (uno por vencer, uno vencido), 3 mantenimientos (historial + en curso), 5 viajes (3 finalizados, 1 en curso, 1 pendiente). Idempotente (upserts + limpieza de transaccionales). Corriendo `POST /alerts/evaluate` sobre el seed se disparan las 6 familias de alertas.

**Verificación.** Typecheck limpio; smoke test: OPERATOR en auditoría → 403, `dateFrom` inválido → 400, dashboard OPERATOR permitido, dashboard sin token → 401. Ejecución contra MySQL (migración + seed + dashboard con datos) queda para la prueba local.

**Estado:** backend de la Etapa 3 completo — 10 módulos + auditoría-lectura + dashboard + seed.

---

## Entrada 16 — Cierre backend: filtros de fecha inclusivos + envío de credenciales por email

**Alcance.** Dos piezas finales tras la revisión del cierre.

**Observación (corregida y verificada).**
- **Bug de timezone en dos filtros más:** `audit-logs.repository` y `trips.repository` usaban `lte: dateTo` crudo, recortando el último día del rango (mismo bug ya corregido en reportes). **Fix:** `utcEndOfDay(dateTo)` en ambos `buildWhere`. Los tres filtros de rango del backend (reportes, auditoría, viajes) ahora comparten el helper y son inclusivos.

**Envío de credenciales por email (DOC-1, decisión del usuario: implementar).**
- Nuevo `shared/services/mailer.ts` con nodemailer: transporte SMTP si `SMTP_HOST` está configurado; si no, `jsonTransport` en modo dev (construye y loguea el mensaje, no envía) — dev y tests funcionan sin servidor SMTP.
- `sendCredentialsEmail` es **best-effort**: nunca lanza (loguea el fallo y resuelve), y se invoca **después del commit** en `usersService.create` y `driversService.create`, así un fallo de mail no deshace el usuario creado ni queda dentro de la transacción DB.
- Config de entorno opcional (`SMTP_HOST/PORT/SECURE/USER/PASS`, `MAIL_FROM`, `APP_URL`) documentada en `.env.example`; sin SMTP, la app arranca igual.
- Dependencias: `nodemailer` + `@types/nodemailer`.

**Verificación.** Typecheck limpio; el mailer en modo dev construye el mensaje, loguea "not sent — no SMTP configured" y resuelve sin lanzar (best-effort confirmado).

**Estado final:** backend de la Etapa 3 completo y cerrado.

---

# Cierre de la Etapa 3 — Backend completo

Resumen consolidado del backend terminado. A partir de aquí comienza la Etapa 4 (Frontend).

## Módulos y endpoints

Todos bajo `/api/v1`. Autenticación JWT (access token Bearer + refresh cookie httpOnly).

| Módulo | Endpoints | Roles |
|:-|:-|:-|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` | público / autenticado |
| Usuarios | `GET/POST /users`, `GET/PATCH/DELETE /users/:id`, `POST /users/:id/activate|deactivate` | ADMIN |
| Choferes | `GET/POST /drivers`, `GET/PATCH /drivers/:id`, `GET|PUT /drivers/:id/password` | lecturas ADMIN+OPERATOR; mutaciones y credenciales ADMIN |
| Documentación | `GET/POST /drivers/:driverId/documents`, `GET /...:documentId`, `PATCH/DELETE /...:documentId` | lectura/subida ADMIN+dueño; edición/baja ADMIN |
| Vehículos | `GET/POST /vehicles`, `GET/PATCH/DELETE /vehicles/:id`, `POST /vehicles/:id/activate|deactivate` | lecturas ADMIN+OPERATOR; mutaciones ADMIN |
| Tipos de mantenimiento | `GET/POST /maintenance-types`, `GET/PUT/DELETE /:id` | lecturas ADMIN+OPERATOR; mutaciones ADMIN |
| Mantenimientos | `GET/POST /maintenances`, `GET/PATCH /:id`, `POST /:id/start|complete`, `POST /:id/attachments`, `GET /:id/attachments/:attachmentId` | ADMIN+OPERATOR |
| Viajes | `GET/POST /trips`, `GET/PATCH/DELETE /:id`, `POST /:id/assign`, `POST /:id/finish` | lecturas todos (chofer solo los suyos); crear/asignar/eliminar ADMIN+OPERATOR; finalizar +DRIVER dueño |
| Reportes | `GET /reports/trips?dateFrom&dateTo` | ADMIN |
| Alertas | `GET /alerts`, `POST /alerts/evaluate`, `POST /alerts/:id/resolve` | lecturas ADMIN+OPERATOR; evaluate/resolve ADMIN |
| Auditoría | `GET /audit-logs` | ADMIN |
| Dashboard | `GET /dashboard` | ADMIN+OPERATOR |

## Stack y arquitectura

Node.js + Express + TypeScript, capas Routes → Controllers → Services → Repositories, módulos verticales.
Prisma 7 (cliente Rust-free, driver adapter MariaDB) sobre MySQL 8.0.16+. Validación Zod centralizada.
JWT access + refresh opaco con rotación. bcrypt para hashes; AES-256-GCM para la copia de contraseña del chofer (A-9). Rate limiting en login. Uploads en filesystem (metadata en BD), máx. 1 MB. Mailer nodemailer (SMTP opcional; modo dev sin envío).

## Reglas de negocio implementadas

RN-1 a RN-22 del documento consolidado, incluyendo: transiciones de estado como acciones POST explícitas; efectos encadenados en transacciones; row locks (`FOR UPDATE`, `SKIP LOCKED`) y advisory lock (`GET_LOCK`) para concurrencia en asignación, finalización, mantenimientos y evaluación de alertas; baja lógica con tombstones; manejo global de errores con traducción de P2002/P2003 a 409; comparaciones de fecha en UTC coherentes (`utcStartOfToday`/`utcEndOfDay`).

## Cómo levantarlo

```
cd backend
npm install                              # instala deps + genera el cliente Prisma (postinstall)
cp .env.example .env                     # completar secretos (JWT, PASSWORD_ENCRYPTION_KEY, DATABASE_URL)
npx prisma migrate dev --name init       # crea el esquema en MySQL
npx prisma db seed                       # carga datos de ejemplo (F-1)
npm run dev                              # API en http://localhost:3000
```

Credenciales del seed: `admin@empresa.com` / `Admin1234!`, `operador@empresa.com` / `Operator1234!`, `chofer@empresa.com` / `Driver1234!`.
Correr `POST /api/v1/alerts/evaluate` (como admin) genera las alertas de ejemplo.

## Pendientes de definición heredados del documento (no bloquean)

- Estrategia exacta de asignación automática de vehículos (hoy: menor km acumulado — P-1/C-8).
- Notificaciones en tiempo real / WebSockets (F-6): la arquitectura las deja aisladas; no implementadas.

---

# Etapa 4 — Frontend (React + Material UI): resumen

SPA construida en `frontend/` con Vite + React 18 + TypeScript + Material UI, cliente
Axios con refresh automático de JWT, store de sesión Zustand, routing con guards por rol
y tres layouts (sidebar Admin/Operador, bottom-nav Chofer). Cubre las 15 pantallas del
documento: login, dashboard con KPIs y gráfico, CRUDs (usuarios, vehículos, choferes con
licencia/credenciales/documentación, tipos de mantenimiento), operación (viajes
crear/editar/asignar/finalizar, mantenimientos con adjuntos), transversales (alertas con
evaluación y reconciliación, reportes por período, auditoría con diff antes/después,
configuración de empresa) y la app del chofer (mi viaje, documentación de solo lectura,
historial). Recorrido de viaje en Google Maps (link sin key / embed con key). Verificado
con typecheck y build de producción en cada sub-etapa.

## Pendientes registrados (para fases futuras, no bloquean)

**P-5 — Autocompletado de direcciones en modo estricto.** El campo Destino de
`TripFormDialog` usa Google Places como asistencia, pero permite texto libre. Queda
pendiente decidir/implementar el modo estricto (deshabilitar Guardar hasta seleccionar
una dirección de la lista, trackeando la selección). Se hará cuando esté disponible la
API de Google (habilitar "Places API" + facturación en la key `VITE_GOOGLE_MAPS_API_KEY`).
Opcional asociado: persistir coordenadas del destino (requiere agregar lat/lng al modelo
`Trip`) para mejorar el mapa del recorrido.

**P-6 — Vulnerabilidades de dependencias (endurecimiento pre-deploy).** `npm audit`
reporta dos, ambas de bajo riesgo para esta app interna y con fixes que implican upgrades
mayores (breaking): (a) esbuild/vite — solo afecta el server de desarrollo, no producción;
taparla obliga a Vite 8. (b) react-router 6 — open-redirect vía backslash + hidratación
SSR (no se usa SSR); el fix implica migrar a react-router 7. No correr `npm audit fix
--force`. Se encaran juntas en una pasada de actualización de dependencias al preparar el
deploy.

**P-7 — Deploy (fase futura).** Publicar la API en un servicio/servidor, MySQL alojado
(no local), variables de entorno con secretos nuevos, servir el frontend estático, y
aplicar la actualización de dependencias de P-6. El código ya está preparado: todo lo
sensible sale de `.env` (backend) y `VITE_*` (frontend), y no hay secretos hardcodeados.

## Instrucción de reinstalación (frontend)

Tras sumar `@types/google.maps`, reinstalar en la máquina del usuario:
`cd frontend && npm install`. (Recordatorio general: el `node_modules` debe generarse en
la máquina destino por los binarios nativos de Vite/Rollup, no copiarse entre sistemas.)

---

# Etapa 5 — Integración y pruebas

**Pruebas automatizadas (Vitest), sin base de datos.**
- Backend (`npm test`): 23 tests — crypto AES-256-GCM (round-trip, IV aleatorio, detección de
  manipulación, SHA-256), helpers de fecha UTC (RN-1, rangos inclusivos), y validaciones Zod de
  viajes (origen fijo RN-21, requeridos), tipos de mantenimiento (umbrales cross-field RN-13),
  usuarios (rol DRIVER rechazado, reglas de contraseña, filtro de rol CSV) y choferes (DNI, licencia).
- Frontend (`npm test`): 5 tests — round-trip datetime-local↔ISO sin desplazamiento de zona horaria,
  y ruteo home por rol.
- Todos verdes (28 en total).

**Plan de pruebas E2E guiado.** `docs/PLAN-DE-PRUEBAS.md`: checklist manual por módulo para los
flujos que requieren MySQL (auth+refresh, permisos por rol, ciclo crear→asignar→finalizar de viajes
con efectos encadenados y locks, mantenimientos con adjuntos, evaluación y reconciliación de alertas,
reportes/auditoría/dashboard/configuración, UI responsive). Incluye preparación del entorno y los
datos del seed que disparan cada caso.

**Dependencias de test agregadas.** Backend: `vitest`. Frontend: `vitest`, `jsdom`,
`@testing-library/react`, `@testing-library/jest-dom`. Requieren `npm install` en cada proyecto.

**Nota.** Los tests de integración contra MySQL (Testcontainers/BD de test) quedan como
automatización futura opcional; el plan manual cubre esos flujos por ahora.

---
