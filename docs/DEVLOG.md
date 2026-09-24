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

# Seed ampliado — una empresa con historia

**Qué cambió.** El seed pasó de 5 viajes y ninguna auditoría a ~200 días de operación: más de 400 viajes
finalizados (el gráfico de 6 meses del dashboard aparece completo), cancelaciones en ruta y antes de
asignar, 19 mantenimientos (según la política de km, más uno en curso, uno programado y dos
cancelados), 26 documentos (algunos reemplazados), 11 alertas resueltas con su historia (renovaciones
de licencias y seguros, un seguro que se venció tres días, un chofer dado de baja) y ~1.500 registros de
auditoría. Se sumaron una segunda operadora, tres choferes (uno dado de baja) y tres vehículos.

**Diseño.** La generación es una función pura (`prisma/seed-history.ts`) con PRNG de semilla fija:
determinística y testeable sin MySQL. `seed-history.test.ts` comprueba las reglas de negocio sobre los
datos generados. Cada día consume la misma cantidad de números aleatorios, así la historia no depende
del día de la semana en que se corre. `seed.ts` quedó como orquestación.

**Coherencia con el estado final.** Las alertas pendientes no se siembran: las levanta el job
automático sobre el estado final. El test replica la lógica del evaluador y fija las 10 esperadas
(Carlos y Lucía, documentos por vencer y vencidos, BBB222 con km superado y seguro por vencer, CCC333
inactivo y con seguro vencido). BBB222 queda con el service vencido porque el generador ubica su
último mantenimiento antes del tramo final de viajes que suma más de 10.000 km.

**Arreglos de paso.** Re-correr el seed ahora devuelve los vehículos a su estado (antes el viaje en
curso de María se recreaba aunque DDD444 hubiera quedado disponible) y resetea las contraseñas de demo.
El ART de María pasó de vencido a por vencer: con un documento vencido, la regla RN-4 no le habría
permitido tener el viaje en curso que le asigna el propio seed.

---

# Build de producción del backend

**El problema.** `npm run dev` funcionaba, pero la versión compilada del backend no arrancaba. Tenía
dos fallas encadenadas:

1. `tsconfig.json` usa `rootDir: "."` para que `tsc --noEmit` revise también `prisma/*.ts`. Con eso,
   la compilación dejaba el servidor en `dist/src/server.js`, mientras `npm start` buscaba
   `dist/server.js`.
2. Aun apuntando al archivo correcto, Node cortaba con `ReferenceError: exports is not defined in ES
   module scope`. El generador `prisma-client` emite ESM por defecto y usa `import.meta.url`. `tsc`
   compila a CommonJS (el `package.json` no tiene `"type": "module"`) pero deja `import.meta` intacto.
   Node ve esa sintaxis, trata el archivo como ESM, y el `exports` de CommonJS no existe.

**La solución.**

- `schema.prisma`: `moduleFormat = "cjs"` en el generador. El cliente generado queda en el mismo formato
  que el resto del backend. `tsx` (dev) y Vitest lo cargan igual.
- `tsconfig.build.json` (nuevo): extiende `tsconfig.json`, compila solo `src/` con `rootDir: "src"` y
  excluye los `*.test.ts`. El `tsconfig.json` sigue siendo el de revisión de tipos del editor, de
  `tsc --noEmit` y del lint, e incluye `prisma/`.
- Scripts: `build` usa `tsconfig.build.json` y lo precede `prebuild` → `clean`, que borra `dist/`
  para no arrastrar archivos compilados de módulos que ya no existen. Se agregó `prisma:deploy`
  (`prisma migrate deploy`).
- `prisma` pasó de `devDependencies` a `dependencies`: producción lo necesita para el `postinstall`
  (`prisma generate`) y para aplicar migraciones. Antes se instalaba igual, pero solo porque es
  *peer dependency* de `@prisma/client`. En el lockfile solo cambian las marcas `devOptional`.
- `engines.node`: `^20.19 || ^22.12 || >=24.0`, el mínimo que exige Prisma 7. Los servicios de hosting
  lo usan para elegir la versión de Node.

**Verificación** (en una copia aparte, sin MySQL):

- `npm run build` genera `dist/server.js` sin tests.
- `NODE_ENV=production node dist/server.js` arranca y responde `/health`. Las rutas protegidas
  devuelven 401 y las que tocan la base, un 500 prolijo. El proceso sigue vivo después del primer
  ciclo del job de alertas.
- `npm ci --omit=dev` instala, genera el cliente y deja disponible `prisma migrate deploy`.
- `npm run dev`, `tsc --noEmit`, ESLint y los 56 tests siguen igual.

**Después de hacer pull:** correr `npm install` en `backend/`. Eso regenera el cliente de Prisma
(`src/generated/` no está en el repo) con el nuevo formato; sin ese paso, `npm run build` sigue
produciendo el binario roto.

---

# Deploy: proxy, trust proxy y archivos en la base

Plataforma elegida: frontend en **Vercel** y backend en **Render** (plan gratuito). Hubo cuatro
problemas que impedían que funcionara desplegado; los cuatro quedaron resueltos.

**1. La sesión se perdía al recargar.** El refresh token viaja en una cookie `httpOnly` con
`SameSite=Strict`. Con el frontend en `*.vercel.app` y la API en `*.onrender.com`, que son sitios
distintos, el navegador no la manda. Pasarla a `SameSite=None` la convertiría en cookie de terceros,
y Safari (el navegador del chofer en iPhone) las bloquea. **Solución:** el navegador habla con un
solo origen. `frontend/vercel.json` reenvía `/api/*` a Render, y en desarrollo el proxy de Vite hace
lo mismo con `localhost:3000`. El cliente HTTP usa `/api/v1` relativo por defecto, y `VITE_API_URL`
quedó como override opcional. La cookie es de primera parte y conserva `SameSite=Strict`.
Complementos:
- la API responde `Cache-Control: no-store`: son datos por usuario y ningún CDN debe guardarlos;
- `vercel.json` desactiva explícitamente el cacheo de los rewrites.

**2. El límite de intentos de login no distinguía clientes.** Detrás de proxies, la IP del socket es la
del proxy. Sin `trust proxy`, el limitador de login contaría a todos como un único cliente y, tras 10
intentos, bloquearía el login de todo el mundo. **Solución:** `TRUST_PROXY` (cantidad de saltos) en la
configuración validada, con `app.set('trust proxy', n)`. Vale 0 en desarrollo y 2 en Render: Vercel
fija `X-Forwarded-For` con la IP del cliente y Render agrega la de Vercel. Cada log de pedido incluye
`clientIp` (la IP que ve el limitador) para calibrar el valor en el deploy real.

Riesgo residual documentado: la URL de Render sigue siendo accesible directamente. Por ese camino, un
cliente puede falsear el `X-Forwarded-For` y rotar su IP aparente. Cerrarlo exige autenticar al proxy
(un secreto compartido), algo que los rewrites de Vercel no permiten sin middleware propio.

**3. Los archivos subidos se perdían.** El disco de Render (plan gratuito) es efímero: se borra en cada
deploy, reinicio o suspensión, y ese plan no admite disco persistente. **Solución:** los bytes pasaron
a la base, en la columna `content MEDIUMBLOB` de `driver_documents` y `maintenance_attachments`
(migración `20260923120000_store_files_in_db`). Esto revisa la decisión 3 del DER; la justificación
está en `etapa-2-der-definitivo.md` §4. Detalles:
- los repositorios nunca traen `content` salvo en la descarga (`omit` en listados, altas y
  modificaciones, porque Prisma devuelve la fila entera también al crear o actualizar);
- la subida guarda bytes, metadata y auditoría en una sola transacción, así que desaparece la
  compensación de archivos en disco (`storeFile`/`safeUnlink`);
- `content` es nullable solo por las filas previas a la migración. La descarga las informa como
  "El archivo ya no está disponible", igual que antes cuando faltaba el archivo en disco.

De paso, el seed guarda **PDFs de muestra reales**, generados sin dependencias (`prisma/sample-pdf.ts`).
Antes, los documentos sembrados apuntaban a archivos inexistentes y abrirlos daba error.

**4. Recargar una ruta del frontend daba 404.** `vercel.json` agrega el fallback de SPA: cualquier ruta
que no sea un archivo estático sirve `index.html`.

**Infraestructura como código.** `render.yaml` (Blueprint) define build, arranque, health check y
variables. El build usa `npm ci --include=dev` porque `NODE_ENV=production` omitiría TypeScript. Las
migraciones corren al arrancar (`prisma migrate deploy`), porque el plan gratuito no tiene comando de
pre-deploy. El paso a paso está en el README, sección "Deploy".

**Verificación** (copia aparte, sin MySQL):
- tsc, ESLint y 64 tests en backend, con dos archivos nuevos: `documents.service.test.ts` (archivos en
  la base, filas previas sin archivo y acceso ajeno) y `sample-pdf.test.ts` (estructura y offsets del PDF);
- el PDF generado lo validan `qpdf --check` y `pdftotext`, con acentos;
- el servidor compilado con `TRUST_PROXY=2` resuelve `clientIp` al primer valor del `X-Forwarded-For`;
- el proxy de Vite llega al backend y la respuesta trae `no-store`;
- el build del frontend no contiene `localhost:3000`.

**Después de hacer pull:** en `backend/`, correr `npm install`, `npx prisma migrate dev` y
`npx prisma db seed`. Los archivos subidos a mano antes de la migración quedan sin contenido. En
`frontend/.env`, `VITE_API_URL` ya no hace falta.

**Nota sobre el lockfile del frontend:** con npm 10, `npm ci` en `frontend/` reporta el lockfile
desincronizado (faltan `esbuild` y `yaml` como *peers* opcionales de la versión de Vite que trae
Vitest). Es una diferencia entre versiones de npm, no un error del proyecto: Vercel usa `npm install`.
Se puede normalizar regenerando el lockfile con la versión de npm que use el equipo.

---

# Selector de fecha unificado

**Qué pasaba.** Había dos formas de ingresar fechas:
- el `DatePicker` de MUI, solo en los filtros de Viajes y Reportes;
- el `<input type="date">` / `datetime-local` del navegador en todo lo demás (filtro de Auditoría,
  vencimiento de licencia, seguro y documentos, salida del viaje, fecha del mantenimiento).

El nativo cambia de aspecto y de orden según el navegador y el sistema: dd/mm en uno, mm/dd en otro.
El de MUI tenía dos fallas:
- avisaba cada tecla al padre: una fecha incompleta vaciaba el filtro, y el año completado dígito a
  dígito (0002 → 0020 → 0202 → 2027) disparaba consultas con el año 202 (reproducido en un test);
- sus textos quedaban en inglés, porque faltaba el paquete de idioma.

**Qué se hizo.** Un único control para toda la app, `components/DateField.tsx`:
- `DateField` para fechas (dd/mm/aaaa) y `DateTimeField` para fecha y hora (dd/mm/aaaa hh:mm, 24 h);
- se tipea con números, y cada parte salta a la siguiente al completarse; también se puede pegar una
  fecha entera;
- el botón de calendario abre en los años, sigue con los meses y termina en los días;
- le avisa al padre solo cuando la fecha está terminada: tipeando, con un año de 4 cifras entre 1900
  y 2099; con el calendario, al cerrarlo;
- una fecha incompleta, fuera de rango o requerida y vacía bloquea el envío del formulario con un
  mensaje en castellano (validación nativa, `setCustomValidity`);
- el valor sigue siendo el mismo string de antes (`YYYY-MM-DD` o `YYYY-MM-DDTHH:mm` local), así que las
  llamadas a la API y el manejo de zonas horarias no cambiaron;
- `AppLocalizationProvider` monta el idioma castellano de los pickers (placeholders DD/MM/AAAA, textos
  de los botones).

Reemplaza los 9 selectores:
- los filtros Desde/Hasta de Viajes, Reportes y Auditoría (Auditoría pasó a usar `DateRangeFilter`,
  con sus atajos);
- el vencimiento de licencia, de seguro y de documentos;
- la salida del viaje y la fecha programada del mantenimiento.

En Reportes, un rango invertido deshabilita "Generar informe". En Documentación, "Elegir archivo"
valida el vencimiento antes de abrir el selector de archivos.

**Verificación.**
- 11 tests nuevos en el frontend (36 en total): `DateField.test.tsx` maneja el componente como un
  usuario (tipeo, calendario año → mes → día, cambios externos, rangos, formulario bloqueado) y
  `date-input.test.ts` cubre la lógica pura;
- tsc, ESLint y build limpios.

---

# Sistema de color (pendientes 31 y 33)

**Qué pasaba.** Casi toda la interfaz usaba el mismo verde petróleo: botones, menú, avatar, insignia
de rol, gráfico. Nada se distinguía de un vistazo, y el color no decía si algo era una acción, un
estado o decoración. Además:
- los chips de color eran bloques saturados con texto blanco; en éxito y advertencia no llegaba a
  4.5:1;
- el borde de los campos de formulario (gris de MUI al 23 %) quedaba por debajo del 3:1 que pide
  WCAG 1.4.11;
- "Finalizar viaje" era rojo, el color de los errores, aunque es la acción principal.

**Qué se hizo.** Un sistema de color con la paleta que acordó el equipo, en dos archivos:
- `theme-tokens.ts` tiene todos los hexadecimales, por modo, en cuatro grupos: primario `#2563EB`
  (solo acciones y estados activos), acento violeta (insignias y métricas), neutros (fondo `#FFFFFF`,
  contenedores `#F3F4F6`, texto `#1F2937`) y semánticos (éxito `#16A34A`, advertencia `#D97706`, error
  `#DC2626`, información cian);
- `theme.ts` los pasa a MUI e impone las reglas en todos los componentes: hover ~10 % más oscuro y
  presionado ~20 %, deshabilitado gris, anillo de foco visible, chips suaves, contenedores con borde
  neutro de 1 px en vez de sombra, borde de controles con ≥ 3:1, sin negro puro;
- el modo oscuro tiene los mismos roles con valores propios.

En las pantallas:
- el menú lateral es gris muy oscuro, con el ítem activo en el primario;
- el avatar y la insignia "Administrador" usan el acento (no son acciones);
- los KPI del dashboard muestran el ícono en un círculo del color de su estado, y la fila de totales
  del admin ganó íconos;
- "Finalizar viaje" y "Cerrar hoja de ruta" pasaron al primario;
- las pantallas del chofer usan `StatusChip`, igual que el resto.

**Gráfico del dashboard (pendiente 31).** Cada barra tiene su tono: el mes con más viajes es el más
claro y el de menos, el más oscuro (`scaleColor`, un `<Cell>` por barra). El número se escribe sobre
cada barra, así el color no es la única forma de leer el dato. Como el color de la interfaz pasó a ser
el azul, la escala es de azules; si se la quiere verde, se cambian `chart.low` y `chart.high`.

**Verificación.**
- `theme-tokens.test.ts` (45 tests) comprueba, en los dos modos, cada par de colores que la UI
  dibuja: texto, texto sobre cada color en sus tres estados, chips sobre fondo y contenedor, menú,
  tooltip, bordes de controles y toda la escala del gráfico;
- el test encontró un problema que la paleta de referencia no mostraba: el paso 700 de éxito,
  advertencia e información cae a ~4.0:1 sobre su propio tinte en un contenedor gris. Para texto se
  usa el 800;
- 81 tests del frontend, tsc, ESLint y build limpios.

---

# Mejoras de UX pedidas (pendientes 26 a 31)

Seis pedidos de Román del 23/09/2026. Tres de ellos tenían decisiones abiertas que se acordaron antes de empezar: el buscador de Viajes es un solo campo para chofer y destino; en la estructura del frontend se traduce solo el código, no la interfaz; y el estándar de carpetas se adapta al stack.

**26 · Buscador en Viajes.** Una caja con lupa (`SearchField`) busca a la vez en el nombre del chofer y en el destino. La búsqueda se hace en el servidor (`GET /trips?search=`, `buildTripWhere` arma un `OR`), así funciona junto con la paginación y los demás filtros. MySQL compara con la collation de la columna: no distingue mayúsculas ni tildes. El campo espera 350 ms después de la última tecla antes de buscar, y Enter busca en el momento. Vehículos y Choferes, que ya tenían búsqueda con un botón "Buscar", pasaron al mismo componente. `usePaginatedList` ahora descarta respuestas viejas: sin eso, una búsqueda lenta que llega tarde pisaba el resultado de la última.

**27 · Filtrar y ordenar en Mantenimiento y Alertas.**
- Mantenimiento se filtra por vehículo, tipo y período. Se ordena por fecha programada, fecha de finalización, tipo, patente o kilometraje, con el control "Ordenar por" o tocando el encabezado de la columna.
- Alertas se filtra por tipo (agrupados por categoría), vehículo y período, y se ordena por fecha o tipo. `DateRangeFilter` sumó el atajo "Esta semana" (lunes a domingo).
- En el backend: `sortBy` / `sortOrder` en `GET /maintenances` y `GET /alerts`, con listas cerradas de campos, y un desempate por `id` para que la paginación no repita ni saltee filas. El filtro por vehículo en Mantenimiento también resuelve el pendiente 15 ("historial de mantenimientos por vehículo" en la interfaz).

**29 · Evaluación de alertas una vez al día.** El job pasó de correr cada 10 minutos a una vez al día a la hora `ALERTS_EVAL_TIME` (06:00 por defecto), en la zona horaria de la empresa (`ALERTS_EVAL_TIMEZONE`). También corre 15 s después de cada arranque, porque en Render el servicio se duerme y a las 06:00 puede estar dormido. "Evaluar alertas" sigue igual. `ALERTS_EVAL_INTERVAL_MIN` desaparece: si quedó en un `.env`, se ignora.

**30 · Carteles cuando algo no se puede.** Antes, un error de una acción de fila aparecía arriba de la tabla, a veces fuera de la vista, y cada pantalla lo manejaba distinto. Ahora hay una regla para todas:
- una acción confirmada en un diálogo que el servidor rechaza deja el diálogo abierto con el motivo adentro;
- una acción de un clic (activar, iniciar un mantenimiento) muestra el motivo en un cartel emergente (`NotificationProvider` + `useNotify`);
- toda acción que sale bien muestra un cartel verde de confirmación.

Además, `apiErrorMessage` explica en castellano los errores sin mensaje del servidor: sin conexión, sesión vencida, permisos, 429, y el servidor iniciándose (502/503/504, lo que pasa al despertar Render). En los errores de validación nombra el campo en castellano. En Reportes, el botón deshabilitado dice qué falta elegir.

**31 · Alertas como tarjetas.** `AlertCard` reemplaza la tabla. El ícono dice de qué trata la alerta (licencia, documento, seguro, mantenimiento, vehículo) y el color dice qué tan urgente es (rojo vencida, ámbar por vencer, cian informativa). Un borde lateral del mismo color permite recorrer la lista por urgencia, y una etiqueta ("Vencida", "Por vencer") lo repite en palabras. La fecha se lee "Hoy 10:32" / "Ayer 17:42". Un tipo que el frontend todavía no conoce se muestra igual, con una campana.

**28 · Una carpeta por componente, código en inglés.** Cada componente tiene su carpeta con `.tsx`, `.types.ts`, `.const.ts`, `.data.ts`, `.helpers.ts`, `.styles.ts` y sus tests (solo los que hacen falta), y el código quedó en inglés. La interfaz y las URLs siguen en castellano. Los imports usan el alias `@/`. La migración la hizo un script reproducible y se verificó con tsc, ESLint, los tests y el build. Detalle y tabla de rutas anteriores → actuales en `docs/manual-tecnico/21b-frontend-estructura.md`. De paso:
- `IconBadge` reemplaza el círculo con ícono que estaba copiado en KPIs y alertas;
- la clave de Maps se define una sola vez;
- se eliminó el último warning de ESLint (pendiente 24).

**Verificación.** Backend: 91 tests (27 nuevos), tsc, ESLint y build. Frontend: 102 tests (21 nuevos), tsc, ESLint sin warnings y build.

---

# Revisión de lo implementado (23/09/2026)

Se revisó todo lo de las entradas anteriores buscando fallas que tsc, ESLint y los tests unitarios no detectan.

**Cómo se revisó.**
- **SQL generado.** Prisma 7 arma el SQL en JavaScript, así que se lo puede inspeccionar con un adaptador falso, sin base. Se revisaron las consultas nuevas (búsqueda con `JOIN` a chofer y usuario, orden por nombre de tipo y por patente, `completedAt` con nulos al final, filtros de alertas por vehículo y período). Todo es SQL válido de MySQL.
- **Capa HTTP.** Se levantó la app Express y se llamaron los endpoints nuevos con un token real: `search`, `sortBy`, `sortOrder` y los filtros. Responden 200, y 400 con el mensaje en castellano ante un valor inválido.
- **Pantallas.** Un smoke test nuevo (`App/App.smoke.test.tsx`) levanta la app completa (router, guards, layouts, tema, providers) contra una API simulada y abre cada pantalla de cada rol, en modo claro y oscuro. Falla si una pantalla no carga o si React escribe algo en `console.error`. Otros seis tests prueban que los controles nuevos llegan a la API (búsqueda, orden por encabezado, parámetros de alertas) y que los carteles se muestran como corresponde: rechazo en un clic, rechazo dentro del diálogo, confirmación.

**Lo que apareció y se corrigió.**
- **Búsquedas con `%` o `_`.** El `contains` de Prisma se traduce en `LIKE CONCAT('%', ?, '%')` sin escapar nada: buscar "50%" traía todas las filas, y "_" coincidía con cualquier carácter. `escapeLike` (`shared/utils/like.ts`) ahora escapa esos caracteres en las cuatro búsquedas: viajes y, desde antes, vehículos, choferes y usuarios.
- **Aviso de React en "Mi documentación".** El tema forzaba `elevation: 1` en todas las `Card`, y "Mi documentación" usa `variant="outlined"`. MUI avisaba en consola que la combinación no tiene efecto. Se quitó el valor por defecto; `Card` ya tiene elevación 1 sin él.
- **Chip `outlined` con color `secondary`.** El tema se rompía con esa combinación (ninguna pantalla la usa hoy). Ahora cae en el estilo por defecto.
- **Capítulo 2 del manual.** Seguía diciendo que las carpetas de páginas están en castellano. Se actualizó.

**Lo que no se pudo probar acá.** Una base MySQL real: el entorno de trabajo no permite instalarla. El SQL se validó por su forma, no ejecutándolo. Queda cubierto con la guía E2E (§3.5) contra la base local.

**Estado.** Backend: 94 tests, tsc, ESLint y build limpios. Frontend: 144 tests, tsc, ESLint sin warnings y build limpios.

---

## Merge de `justino-actualizacion-pendientes` y revisión (24/09/2026)

**Qué trajo Justino.** Una alerta nueva, `VOYAGE_NOT_ASSIGNED`: viaje pendiente de asignación que sale en menos de 1 hora o ya debía salir, sobre la entidad `TRIP`. También cambió la regla de cancelación: solo se cancelan viajes pendientes, ya no los que están en curso. Además bajó el tamaño de lote del seed de 200 a 40.

**Adaptaciones al mezclar.** Su cambio en la pantalla de Alertas tocaba el archivo viejo (`pages/alertas/AlertasPage.tsx`), que la reorganización de carpetas ya había eliminado. Sus dos cambios se pasaron a los archivos nuevos: la etiqueta, una categoría "Viajes" con su propio ícono y el link "ir al origen" hacia `/viajes`. En Viajes se sacaron el botón y el texto de "Cancelar" para viajes en curso, porque el servidor ahora rechaza esa acción.

**Revisión posterior.**
- **"Ir al origen" con alertas viejas.** Como la evaluación es diaria, una alerta puede quedar abierta cuando el viaje ya se asignó. En ese caso, en lugar del diálogo de asignación se abre el detalle del viaje con un aviso. El parámetro `highlight` se borra de la URL, igual que en Choferes, para que recargar no vuelva a abrir el diálogo.
- **Backend.** Se corrigieron el formato y la sangría del bloque de la alerta. La ventana de 1 hora pasó a una constante (`UNASSIGNED_TRIP_LEAD_MS`), y un viaje atrasado ahora dice "ya debía salir" en vez de "sale en menos de 1 hora". Se actualizaron los comentarios de `trips.service.ts` y `trips.routes.ts`, que todavía decían que se podía cancelar un viaje en curso.
- **Decisiones del equipo (Román).** Se mantiene la ventana de 1 hora aunque la evaluación sea diaria, y se mantiene la regla de cancelación de Justino. Las dos consecuencias quedaron en `PENDIENTES.md` (puntos 18 y 19): el camión averiado solo puede "finalizarse", y la alerta casi nunca salta sola.
- **Un solo archivo de pendientes.** `PENDIENTES.md` se reescribió con lo que falta hoy, incluidos los puntos todavía abiertos del plan del capítulo 25: timeout de Axios, auditoría de login y logout, campos de configuración sin uso y `multer` 2.x. El capítulo 25 ahora aclara que su plan es una foto del momento y remite a `PENDIENTES.md`.
- **Documentación.** Se agregaron notas en §12.14 (cancelación) y al final del capítulo 14 (noveno tipo de alerta), y se actualizaron `PLAN-DE-PRUEBAS.md` y la cantidad de tests en el README.

**Tests nuevos.** `alerts.service.test.ts` (3 casos: consulta, alerta generada y viaje atrasado), `AlertsPage.helpers.test.ts` (3) y dos casos en el smoke test para "ir al origen", con el viaje pendiente y con el viaje ya asignado.

**Verificación** (en copias temporales): backend con 97 tests y `tsc`, ESLint y build limpios; frontend con 149 tests, `tsc`, ESLint y `vite build` limpios.
