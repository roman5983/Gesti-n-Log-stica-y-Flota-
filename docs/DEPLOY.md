# Deploy en Railway

Guía paso a paso para publicar el sistema fuera de `localhost`. El deploy es de
**un solo servicio**: el mismo Express que expone la API sirve también el build
del SPA de React.

## Por qué un solo servicio

El refresh token viaja en una cookie `httpOnly` con `SameSite=strict`. Si el
frontend viviera en otro dominio que la API, esa cookie pasaría a ser de
**tercera parte**: habría que bajarla a `SameSite=None`, y Safari (y Chrome con
el bloqueo de cookies de terceros) la descartaría igual. Resultado: la sesión se
caería en cada recarga.

Sirviendo el SPA desde el mismo origen que la API:

- la cookie sigue siendo de primera parte y funciona en todos los navegadores,
- no hace falta CORS (se desactiva solo cuando `SERVE_STATIC=true`),
- se paga y se mantiene un solo servicio.

---

## 1. Preparación (una sola vez, en tu máquina)

El cliente de Prisma 7 se generaba en formato ESM mientras el backend compila a
CommonJS, así que `npm start` no arrancaba. Ya está corregido en
`prisma/schema.prisma` (`moduleFormat = "cjs"`), pero hay que regenerar el
cliente local:

```bash
cd backend
npx prisma generate
npm run build && npm start   # verificación opcional
```

Después, commit y push de los cambios a GitHub:

```bash
git add .
git commit -m "chore: preparar deploy en Railway"
git push origin <tu-rama>
```

---

## 2. Crear el proyecto en Railway

1. Entrar a <https://railway.app> e iniciar sesión con GitHub.
2. **New Project → Deploy from GitHub repo** → elegir el repositorio y la rama.
3. Railway detecta el `Dockerfile` y el `railway.json` de la raíz. Va a fallar el
   primer build o el healthcheck hasta que existan la base y las variables: es
   esperable, se arregla en los pasos siguientes.

## 3. Agregar la base de datos

1. Dentro del proyecto: **New → Database → Add MySQL**.
2. Railway crea el servicio y expone las variables `MYSQL_URL` (interna) y
   `MYSQL_PUBLIC_URL` (externa).

## 4. Variables de entorno del servicio de la app

En el servicio de la app → pestaña **Variables**:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` (referencia al servicio MySQL) |
| `JWT_ACCESS_SECRET` | 96 caracteres hex aleatorios |
| `JWT_REFRESH_SECRET` | otros 96 caracteres hex aleatorios |
| `PASSWORD_ENCRYPTION_KEY` | exactamente 64 caracteres hex |
| `APP_URL` | `https://<tu-dominio>.up.railway.app` |
| `MAIL_FROM` | opcional, ej. `Gestión Logística <no-reply@empresa.com>` |
| `VITE_GOOGLE_MAPS_API_KEY` | opcional; se consume en el **build** del frontend |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | opcionales; sin `SMTP_HOST` el mailer solo loguea |

`NODE_ENV`, `PORT`, `SERVE_STATIC`, `STATIC_DIR` y `TRUST_PROXY` ya vienen
definidos en la imagen — no hace falta cargarlos.

Generar los secretos:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"  # JWT (x2)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # PASSWORD_ENCRYPTION_KEY
```

## 5. Dominio público

Servicio de la app → **Settings → Networking → Generate Domain**. Con la URL que
devuelve, actualizar `APP_URL` y redeployar.

## 6. Volumen para los adjuntos

Los archivos de documentación de choferes y comprobantes de mantenimiento se
guardan en disco (`uploads/`). El filesystem del contenedor es efímero: sin
volumen se pierden en cada deploy.

Servicio de la app → **Settings → Volumes → Add Volume**, con mount path:

```
/app/uploads
```

## 7. Migraciones y datos iniciales

Las migraciones corren solas en cada arranque (`prisma migrate deploy`, en el
start command). El seed hay que correrlo una vez, desde tu máquina, apuntando a
la base de Railway con la URL **pública**:

```bash
cd backend
DATABASE_URL="<pegar MYSQL_PUBLIC_URL>" npm run prisma:seed
```

## 8. Verificación

```bash
curl https://<tu-dominio>.up.railway.app/health
# {"status":"ok","uptime":...}
```

Después, en el navegador:

1. Abrir la URL: tiene que cargar el SPA.
2. Loguearse con el usuario del seed.
3. Recargar la página (F5): la sesión debe sobrevivir → la cookie de refresh
   está funcionando.
4. Navegar a una ruta interna y recargar ahí: debe seguir funcionando (fallback
   de SPA).
5. Subir un documento de un chofer y volver a descargarlo.

---

## Qué se tocó para el deploy

| Archivo | Cambio |
|---|---|
| `Dockerfile` | Build multi-stage: compila el SPA, compila el backend, imagen final con ambos |
| `railway.json` | Builder Dockerfile, healthcheck en `/health`, `migrate deploy` al arrancar |
| `.dockerignore` | Excluye `node_modules`, `dist`, `.env`, adjuntos y docs del contexto |
| `backend/src/config/env.ts` | Nuevas variables `SERVE_STATIC`, `STATIC_DIR`, `TRUST_PROXY`, `COOKIE_SAMESITE` |
| `backend/src/app.ts` | Sirve el SPA con fallback de rutas, CSP de helmet, `trust proxy`, CORS solo en modo separado |
| `backend/src/modules/auth/auth.controller.ts` | `SameSite` de la cookie configurable por entorno |
| `backend/src/server.ts` | Escucha en `0.0.0.0` (requisito de los contenedores) |
| `backend/package.json` | `main`/`start` apuntaban a `dist/server.js`; el build emite `dist/src/server.js` |
| `backend/prisma/schema.prisma` | `moduleFormat = "cjs"` en el generador |

## Alternativa: frontend y backend separados

Si en algún momento hace falta separarlos (por ejemplo, frontend en Vercel):

1. En el backend: `SERVE_STATIC=false`, `CORS_ORIGIN=https://<dominio-del-front>`
   y `COOKIE_SAMESITE=none`.
2. En el frontend: `VITE_API_URL=https://<dominio-del-back>/api/v1`.

Tener presente la limitación de cookies de terceros descrita arriba: con esa
configuración la sesión no sobrevive a una recarga en Safari.
