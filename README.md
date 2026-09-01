# Sistema de Gestión Logística y de Flota

Plataforma integral para la gestión y optimización de las operaciones logísticas de una empresa de transporte: administra la flota vehicular, el personal (choferes), la ejecución de viajes y el mantenimiento, con alertas automáticas, auditoría, reportes y un panel de indicadores.

Trabajo práctico de Desarrollo de Software (DSW). Full-stack con backend REST y frontend SPA.

---

## Qué hace el sistema

- **Gestión de flota:** alta/baja de vehículos, estado en tiempo real (disponible, en viaje, en taller, inactivo), historial de kilometraje y mantenimiento.
- **Gestión de choferes:** disponibilidad, documentación obligatoria (DNI, licencia, ART, psicofísico), y control de vencimientos.
- **Viajes:** planificación, asignación de chofer con selección automática de vehículo, seguimiento de estado (pendiente → en curso → finalizado) y registro de kilometraje.
- **Mantenimiento:** preventivo y correctivo, con tipos configurables, máquina de estados y comprobantes adjuntos.
- **Alertas automáticas:** vencimientos de licencia/documentación/seguro, km de mantenimiento superado, vehículos inactivos, con reconciliación (auto-resolución).
- **Auditoría:** registro inmutable de todas las acciones, con detalle de antes/después.
- **Reportes y dashboard:** indicadores clave (utilización de flota, viajes, mantenimientos, alertas) y reportes por período.
- **Roles:** Administrador (acceso total), Operador (operación diaria) y Chofer (app mobile con su viaje, historial y documentación).

---

## Tecnologías

**Backend** — Node.js + TypeScript · Express 4 · Prisma 7 (ORM) · MySQL 8 · Zod (validación) · JWT + bcrypt (auth) · Helmet · Pino (logging) · Multer (archivos) · Nodemailer (email) · Vitest (tests).

**Frontend** — React 18 + TypeScript · Vite · Material UI (MUI) · React Router · Zustand (estado) · Axios · Recharts (gráficos) · Vitest (tests).

---

## Estructura del repositorio

```
.
├── backend/          API REST (Node + Express + Prisma). 13 módulos, 57 endpoints.
│   ├── src/
│   │   ├── modules/  un módulo por entidad (routes / controller / service / repository / schemas)
│   │   ├── middlewares/  auth, validación, manejo de errores, rate limiting, uploads
│   │   ├── shared/   utilidades, errores, tipos comunes
│   │   └── config/   validación de entorno (fail-fast)
│   └── prisma/       schema, migraciones y seed de datos de demostración
├── frontend/         SPA React (Vite + MUI). Todas las pantallas por rol.
│   └── src/
│       ├── pages/    pantallas (dashboard, usuarios, vehículos, choferes, viajes, ...)
│       ├── components/  componentes reutilizables (tabla, diálogos, KPIs)
│       ├── api/      clientes HTTP tipados por módulo
│       ├── auth/     guards y sesión
│       └── layouts/  layouts por rol (sidebar admin/operador, mobile chofer)
├── docs/             documentación del proyecto (ver abajo)
└── GUIA-PRUEBAS-E2E.md   guía de pruebas manuales end-to-end
```

---

## Documentación

Toda la documentación de diseño y desarrollo está en `docs/`: (índice completo en [docs/README.md](docs/README.md))

- **`analisis-funcional-gestion-logistica.md`** — análisis funcional completo: requisitos, reglas de negocio (RN), casos de uso. Es la fuente de verdad del proyecto.
- **`etapa-1-arquitectura.md`** — decisiones de arquitectura y convenciones.
- **`etapa-2-der-definitivo.md`** y **`etapa-2-modelo-relacional.md`** — diagrama entidad-relación y modelo relacional.
- **`schema.sql`** — DDL de referencia de la base de datos.
- **`DEVLOG.md`** — bitácora de desarrollo: historial de decisiones técnicas, etapa por etapa.
- **`PLAN-DE-PRUEBAS.md`** — plan de pruebas (automatizadas + manuales).

---

## Cómo levantar el proyecto

**Requisitos:** Node.js 20+, MySQL 8, y npm.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env          # completar DATABASE_URL, JWT secrets, PASSWORD_ENCRYPTION_KEY
npx prisma migrate dev --name init
npx prisma db seed
npm run dev                   # http://localhost:3000
```

Variables de entorno necesarias (ver `backend/.env.example`): conexión a MySQL, secretos JWT, clave de cifrado de contraseñas (AES-256-GCM), y opcionalmente configuración SMTP para el envío real de credenciales.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_URL (y opcional VITE_GOOGLE_MAPS_API_KEY)
npm run dev                   # http://localhost:5173
```

### Credenciales del seed

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Administrador | `admin@empresa.com` | `Admin1234!` |
| Operador | `operador@empresa.com` | `Operator1234!` |
| Chofer | `chofer@empresa.com` | `Driver1234!` |

---

## Pruebas

**Automatizadas (sin base de datos):**

```bash
cd backend  && npm test      # 23 tests: crypto, fechas UTC, schemas de validación
cd frontend && npm test      # 5 tests: fechas datetime-local, rutas por rol
```

**Manuales (end-to-end):** ver `GUIA-PRUEBAS-E2E.md` — guion paso a paso por rol contra la app corriendo.

---

## Notas de seguridad

- Los archivos `.env` (con secretos) están excluidos del repositorio vía `.gitignore`. Usar los `.env.example` como plantilla.
- Contraseñas de usuarios con bcrypt; contraseñas de choferes además cifradas con AES-256-GCM (requisito de negocio: consultables por el administrador).
- Autenticación con access token JWT de vida corta + refresh token opaco (hash SHA-256) en cookie httpOnly, con rotación.
