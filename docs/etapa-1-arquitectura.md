# Etapa 1 — Arquitectura del Sistema
## Sistema de Gestión Logística y Flota (TP DSW)

**Fuente de verdad:** `analisis-funcional-gestion-logistica.md` (versión consolidada 2026-07-13).
**Estado:** propuesta para aprobación.

---

## 1. Arquitectura general

Aplicación web **cliente-servidor desacoplada en dos aplicaciones independientes** dentro de un único repositorio (monorepo):

```
┌─────────────────────┐         ┌──────────────────────────────────┐         ┌───────────┐
│  FRONTEND (SPA)     │  HTTPS  │  BACKEND (API REST /api/v1)      │  Prisma │  MySQL    │
│  React + MUI        │ ──────► │  Node.js + Express               │ ──────► │  Server   │
│  React Router       │  JSON   │  Capas: Routes → Controllers →   │   SQL   │           │
│  Zustand + Axios    │ ◄────── │  Services → Repositories         │ ◄────── │           │
└─────────────────────┘  JWT    └──────────────────────────────────┘         └───────────┘
```

**Justificación.**
- **SPA + API REST versionada (`/api/v1`):** lo exige el documento (RNF: "API REST agnóstica, con versionado"). Además permite que las tres interfaces (Operador, Administrador, Chofer responsive) consuman la misma API, y deja la puerta abierta a un cliente móvil futuro sin tocar el backend.
- **Monorepo (`backend/` + `frontend/`):** un solo repositorio ya definido en el proyecto (`dsw-gestion-logistica`), simplifica el versionado conjunto, los issues y la corrección de la cátedra. Las dos apps son independientes en dependencias y despliegue (cada una con su `package.json`).
- **Prisma sobre MySQL:** decisión confirmada. Schema declarativo como única fuente del modelo físico, migraciones versionadas (auditables en Git) y seeds integrados — el documento exige seeds para 6 entidades (F-1) y migraciones.

---

## 2. Patrón de arquitectura (backend)

**Arquitectura en capas (Layered Architecture)**, exigida explícitamente por el documento (RNF: "Controllers, Services, Repositories, Models"):

| Capa | Responsabilidad | Qué NO hace |
|:-|:-|:-|
| **Routes** | Declarar endpoints, asociar middlewares (auth, autorización, validación) y delegar al controller | Lógica de ningún tipo |
| **Controllers** | Traducir HTTP ↔ dominio: extraer datos del request ya validado, invocar al service, mapear la respuesta y códigos HTTP | Reglas de negocio, acceso a datos |
| **Services** | **Toda la lógica de negocio**: reglas RN-1 a RN-22, transiciones de estado, asignación automática, orquestación de transacciones, emisión de alertas y auditoría | Conocer HTTP ni SQL |
| **Repositories** | Acceso a datos: encapsulan Prisma; una interfaz por agregado (usuario, viaje, vehículo…) | Reglas de negocio |
| **Models** | Schema de Prisma (entidades, relaciones, enums de estados) + tipos de dominio | — |

**Justificación.**
- Las reglas de negocio del sistema son transversales y encadenadas (ej.: finalizar viaje → actualiza km → libera vehículo → audita → recalcula disponibilidad del chofer). Concentrarlas en services las hace testeables sin HTTP ni base de datos (Etapa 7) y evita duplicarlas entre endpoints.
- Repositories como única puerta a Prisma aplica **Dependency Inversion (SOLID)**: los services dependen de una abstracción, no del ORM; si mañana cambia el ORM, las reglas de negocio no se tocan.
- Cada módulo (auth, usuarios, choferes, vehículos, tipos-mantenimiento, mantenimientos, documentación, viajes, reportes, alertas) es un paquete vertical con sus 4 capas → **Single Responsibility** y desarrollo incremental por módulo tal como exige la Etapa 3.

**Transversales (middlewares y servicios compartidos):**
- `authenticate` (JWT access token) y `authorize(...roles)` (autorización por rol — RNF).
- `validate(schema)` con **Zod**: validación centralizada en el borde (RNF "validaciones centralizadas Joi/Zod"; se elige Zod por inferencia de tipos y reutilización de schemas).
- `errorHandler` global + clase `AppError` (jerarquía de errores de dominio: `NotFoundError`, `BusinessRuleError`, `ForbiddenError`…): un solo punto de traducción error → HTTP.
- `auditLogger` como **servicio de dominio invocado por los services** (no middleware HTTP): la auditoría registra acciones de negocio con datos previos/posteriores (RN-7), información que solo el service conoce.
- `rateLimiter` en endpoints sensibles (login) — RNF.
- Logging de requests con `morgan` (dev) / logger estructurado `pino` (app).

---

## 3. Estructura de carpetas

```
dsw-gestion-logistica/
├── README.md
├── docs/                              # documentación oficial
│   ├── analisis-funcional.md          # fuente de verdad
│   ├── arquitectura.md                # este documento
│   └── der/                           # DER definitivo (Etapa 2)
│
├── backend/
│   ├── package.json
│   ├── .env.example                   # variables documentadas, sin secretos
│   ├── prisma/
│   │   ├── schema.prisma              # modelo físico (única fuente)
│   │   ├── migrations/
│   │   └── seed.ts                    # seeds F-1 (6 entidades)
│   └── src/
│       ├── server.ts                  # arranque HTTP
│       ├── app.ts                     # instancia Express + middlewares globales
│       ├── config/                    # env tipado y validado al arranque, constantes
│       ├── middlewares/               # authenticate, authorize, validate, errorHandler, rateLimiter
│       ├── shared/
│       │   ├── errors/                # AppError y jerarquía
│       │   ├── utils/                 # helpers puros (fechas, paginación)
│       │   └── types/                 # tipos compartidos (JwtPayload, Paginated<T>…)
│       ├── database/
│       │   └── prisma.client.ts       # singleton de PrismaClient
│       └── modules/                   # 1 carpeta = 1 módulo vertical
│           ├── auth/
│           │   ├── auth.routes.ts
│           │   ├── auth.controller.ts
│           │   ├── auth.service.ts
│           │   └── auth.schemas.ts    # schemas Zod del módulo
│           ├── usuarios/
│           │   ├── usuarios.routes.ts
│           │   ├── usuarios.controller.ts
│           │   ├── usuarios.service.ts
│           │   ├── usuarios.repository.ts
│           │   └── usuarios.schemas.ts
│           ├── choferes/              # misma estructura interna
│           ├── vehiculos/
│           ├── tipos-mantenimiento/
│           ├── mantenimientos/
│           ├── documentacion/
│           ├── viajes/
│           ├── reportes/
│           ├── alertas/
│           └── auditoria/             # service + repository + listado (solo lectura, A-5)
│
└── frontend/
    ├── package.json
    ├── .env.example
    └── src/
        ├── main.tsx
        ├── App.tsx                    # router + providers (theme, auth)
        ├── api/
        │   ├── axios.ts               # instancia con baseURL, interceptores JWT/refresh
        │   └── <modulo>.api.ts        # un cliente por módulo del backend
        ├── auth/                      # contexto de sesión, guards por rol
        ├── components/                # reutilizables puros (DataTable, StatusBadge,
        │   │                          #   ConfirmDialog, FileUpload, KpiCard, MapaRecorrido)
        ├── layouts/
        │   ├── AdminLayout.tsx        # sidebar Admin (DOC-5 §5.2)
        │   ├── OperadorLayout.tsx     # sidebar Operador (DOC-5 §5.1)
        │   └── ChoferLayout.tsx       # bottom-nav móvil (DOC-5 §5.3)
        ├── pages/                     # 1 carpeta por módulo funcional
        │   ├── auth/  dashboard/  usuarios/  choferes/  vehiculos/
        │   ├── mantenimientos/  documentacion/  viajes/  alertas/
        │   ├── auditoria/  reportes/  configuracion/
        ├── stores/                    # Zustand: authStore, uiStore
        ├── hooks/                     # useAuth, usePagination…
        └── utils/                     # formateo de fechas, km, validadores
```

**Justificación.**
- **Módulos verticales, no capas horizontales** (`modules/viajes/` con sus 4 archivos vs. carpetas globales `controllers/`, `services/`): todo lo de un módulo vive junto → alta cohesión, se desarrolla y revisa módulo por módulo (orden de Etapa 3), y un cambio funcional toca una sola carpeta.
- **`shared/` mínimo y explícito:** solo lo verdaderamente transversal; evita el "cajón de sastre" que degrada la mantenibilidad.
- **Frontend espejo del backend:** `pages/` y `api/` replican los módulos → el mapeo pantalla ↔ endpoint es directo y los nombres se mantienen consistentes en todo el proyecto (restricción del encargo).
- **Tres layouts separados:** el documento define tres interfaces distintas por rol (sidebars diferentes y bottom-nav del chofer). Separarlas evita condicionales de rol dispersos en las vistas; el guard de rol decide el layout una sola vez.

---

## 4. Convenciones del proyecto

**Lenguaje y nombres**
- **TypeScript en backend y frontend.** Mejora propuesta sobre el documento (que solo dice Node/React, sin prohibir TS): tipado estático sobre un dominio con muchos estados y transiciones (viaje, vehículo, mantenimiento) elimina toda una clase de errores en tiempo de compilación, y Prisma genera tipos automáticamente — usarlos desde JS desperdiciaría su principal beneficio. Costo de adopción bajo; beneficio directo en mantenibilidad, que es prioridad declarada.
- **Dominio en español, infraestructura en inglés:** entidades, módulos, rutas y campos usan los términos del documento funcional y del DER (`viaje`, `chofer`, `kmInicial`, `PENDIENTE_DE_ASIGNACION`) para que documentación ↔ código ↔ BD ↔ UI hablen igual; lo técnico genérico va en inglés (`errorHandler`, `authenticate`, `repository`).
- Archivos: `kebab-case` o `<modulo>.<capa>.ts`. Clases/componentes: `PascalCase`. Variables/funciones: `camelCase`. Tablas y columnas MySQL: `snake_case` (mapeadas con `@map` en Prisma). Enums de estado: `SCREAMING_SNAKE_CASE`.

**API**
- Prefijo `/api/v1`. Recursos en plural y español: `/api/v1/viajes`, `/api/v1/viajes/:id/asignar`, `/api/v1/viajes/:id/finalizar` (las transiciones de estado son acciones POST explícitas, no `PATCH` genéricos: hace imposible saltarse las reglas de transición).
- Respuesta uniforme: `{ data, meta? }` en éxito; `{ error: { code, message, details? } }` en falla. Paginación estándar: `?page=&limit=` → `meta: { page, limit, total }`.
- Códigos: 200/201, 400 validación, 401 sin autenticar, 403 sin permiso, 404, 409 conflicto de regla de negocio (ej. vehículo no Disponible), 422 regla de negocio violada.

**Calidad**
- ESLint + Prettier compartidos en la raíz (config única para ambas apps).
- Variables de entorno solo vía `config/` (validadas con Zod al arranque; la app no levanta con config inválida). Nunca secretos en Git; `.env.example` documentado.
- Baja lógica (RN-20): los repositories filtran inactivos por defecto; nunca `DELETE` físico en entidades con historia.

**Git**
- Ramas: `main` (estable) ← `develop` (integración) ← `feature/<modulo>-<descripcion>` (ej. `feature/viajes-asignacion-automatica`). Merge a `develop` vía Pull Request.
- **Conventional Commits**: `feat(viajes): asignación automática de vehículo`, `fix(auth): expiración del refresh token`. Historial legible y trazable por módulo.
- Un tag por etapa aprobada: `etapa-1-arquitectura`, `etapa-2-modelo-datos`…

---

## 5. Flujo entre frontend, backend y base de datos

**Flujo de una operación de negocio (ej.: Asignar viaje — A-1/C-8):**

```
1. React (pages/viajes/AsignarViaje)   valida el form (Zod) y llama a viajesApi.asignar(id, dto)
2. Axios                               adjunta Authorization: Bearer <accessToken>
3. Express /api/v1/viajes/:id/asignar  → rateLimiter → authenticate → authorize('OPERADOR')
                                       → validate(asignarViajeSchema)
4. ViajesController.asignar            extrae dto tipado, invoca al service
5. ViajesService.asignar               (transacción Prisma)
                                       ├─ verifica estado PENDIENTE_DE_ASIGNACION (RN-15)
                                       ├─ selecciona vehículo DISPONIBLE automáticamente (RN-12, RN-2)
                                       ├─ valida chofer Disponible: licencia + sin viaje activo (RN-19, RN-1)
                                       ├─ valida documentación vigente (RN-4) y solapamiento (RN-6)
                                       ├─ viaje → EN_VIAJE, vehículo → EN_VIAJE
                                       └─ AuditoriaService.registrar(datos previos/posteriores) (RN-7)
6. Repositories                        traducen a Prisma → MySQL (commit o rollback atómico)
7. Controller                          → 200 { data: viaje }  |  errorHandler → 409/422 { error }
8. React                               actualiza la vista y muestra feedback
```

**Flujo de autenticación (RNF + A-9):**

```
Login → POST /api/v1/auth/login → valida credenciales (bcrypt)
     → responde accessToken (corto, en memoria) + refreshToken (httpOnly cookie)
Cada request → middleware authenticate verifica el access token
Access token vencido → interceptor de Axios llama a POST /auth/refresh de forma
     transparente y reintenta; si el refresh falla → logout y redirección a login
Sin recuperación de contraseña: el Administrador gestiona las contraseñas de
     los choferes desde la pantalla del Chofer (A-9/F-4)
```

**Justificación:** access token en memoria + refresh en cookie `httpOnly` minimiza exposición a XSS sin sacrificar la experiencia (renovación transparente). Las transacciones en el service garantizan la atomicidad de los efectos encadenados que el documento exige (RN-11).

---

## 6. Stack consolidado (cierre de decisiones abiertas)

| Capa | Tecnología | Origen de la decisión |
|:-|:-|:-|
| Frontend | React 18 + TypeScript + Vite | Documento (React) + mejora TS justificada en §4 |
| Router / Estado | React Router + **Zustand** | Documento admite Zustand/Redux; Zustand: mínima ceremonia, suficiente para el estado global real (sesión, UI) — el estado de servidor vive en cada página vía API |
| UI | **Material UI** | Confirmado; componentes que calzan con los mockups (tablas, datepickers, badges, modales) |
| Gráficas | Recharts | Documento (Recharts o Chart.js); Recharts se integra como componentes React |
| HTTP | Axios con interceptores | Documento (Fetch/Axios); interceptores necesarios para el refresh transparente |
| Backend | Node.js + Express + TypeScript | Documento + mejora TS |
| ORM | **Prisma** | Confirmado (recomendado por el documento) |
| BD | MySQL Server | Documento (C-10) |
| Validación | Zod (backend y frontend) | Documento (Joi/Zod); Zod comparte tipos con TS |
| Auth | JWT + refresh tokens, bcrypt | Documento (RNF) |
| Logging | pino + morgan (dev) | Estándar; requerido por RNF "middleware de logging" |
| Tiempo real | **Pendiente de definición (F-6)** — la arquitectura lo aísla en un futuro módulo transversal; ninguna decisión actual lo bloquea | Documento |

---

## 7. Resultado de la etapa

- Arquitectura general, patrón por capas y flujos definidos y justificados.
- Estructura de carpetas completa para backend y frontend.
- Convenciones de código, API y Git establecidas.
- Decisiones abiertas del documento cerradas: Prisma, Material UI, Zustand, Zod, TypeScript (mejora propuesta y justificada).

**Próximo paso (requiere aprobación):** Etapa 2 — Modelo de datos: DER definitivo construido desde el documento funcional consolidado, modelo relacional y script SQL con índices y restricciones.
