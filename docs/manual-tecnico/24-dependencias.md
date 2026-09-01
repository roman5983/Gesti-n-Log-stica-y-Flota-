# Capítulo 24 — Las 50 dependencias, una por una

> **Alcance.** Los dos `package.json` declaran **50 paquetes**: 28 en el backend
> (15 de producción + 13 de desarrollo) y 22 en el frontend (12 + 10).
>
> De cada uno se explica: **qué problema resuelve**, **cómo funciona por dentro**,
> **dónde se usa en este proyecto** (archivo:línea), **con qué alternativas compite** y
> **qué pasaría si desapareciera**.
>
> Todas las versiones resueltas se verificaron contra `node_modules`.

---

## 24.1 · Introducción

Una dependencia es una decisión que alguien tomó y que ya no se discute. Instalar
`bcryptjs` es decidir cómo se guardan las contraseñas de toda la empresa; instalar
`zustand` es decidir cómo fluye el estado por 29 pantallas. Nadie vuelve a esas decisiones
después, y sin embargo **el 90 % del código que se ejecuta en producción no lo escribió el
equipo**.

Este capítulo las examina una por una. Y aparecen tres cosas que ningún capítulo anterior
podía mostrar, porque solo se ven mirando el conjunto:

**1. Cuatro paquetes están instalados y no se usan.** `@mui/x-date-pickers` (que arrastra
`dayjs`), `@testing-library/react`, `@testing-library/jest-dom` y —de facto— `jsdom`.
Verifiqué las cuatro con búsquedas en todo `src/`. Son ~4 MB de `node_modules` y, lo más
caro, **son la evidencia de una intención abandonada**: alguien iba a usar selectores de
fecha de MUI y a probar componentes, y no lo hizo.

**2. `@mui/x-date-pickers` sin usar explica el bug más extendido del proyecto.** El
paquete resuelve exactamente el problema de fechas de §22A.4: un `<DatePicker>` de MUI con
`dayjs` no tiene el error de la medianoche UTC. Está instalado. En su lugar se usaron
`<input type="date">` a mano y `toLocaleDateString`, y de ahí salen los cuatro sitios donde
un vencimiento se muestra un día antes. **La herramienta estaba en el proyecto.**

**3. Falta el paquete cuya ausencia causó tres bugs.** No hay ESLint. Los nueve
`eslint-disable` del código (§22B.5.2) silencian un linter que no existe, y tres de ellos
tapan cierres obsoletos reales. Es la dependencia **no instalada** más cara del proyecto.

### 24.1.1 · Cómo leer una versión

Todas las versiones llevan `^`:

```json
"express": "^4.21.2"
```

El acento circunflejo significa **"esta versión o cualquier posterior que no cambie el
primer número distinto de cero"**. Para `^4.21.2`, el rango es `>=4.21.2 <5.0.0`.

Se apoya en el **versionado semántico**, una convención de tres números `MAYOR.MENOR.PARCHE`:

| Cambia | Significa | ¿`^` lo acepta? |
|:--|:--|:--:|
| **PARCHE** (4.21.**2** → 4.21.**3**) | Corrección compatible | ✅ |
| **MENOR** (4.**21**.2 → 4.**22**.0) | Función nueva, compatible | ✅ |
| **MAYOR** (**4**.21.2 → **5**.0.0) | Cambio que rompe | ❌ |

Es una **promesa social, no una garantía técnica**: nada impide publicar un cambio
rompedor en un parche. Por eso existe `package-lock.json`, que congela las versiones
exactas de todo el árbol y hace las instalaciones reproducibles.

Se nota en este proyecto: `zod` está declarado `^3.23.8` y **resuelto en 3.25.76** — 
treinta y ocho versiones menores de diferencia entre lo que alguien escribió y lo que
corre.

### 24.1.2 · `dependencies` vs `devDependencies`

| | `dependencies` | `devDependencies` |
|:--|:--|:--|
| **Van a producción** | Sí | No (`npm ci --omit=dev`) |
| **Ejemplos aquí** | `express`, `zod`, `react` | `typescript`, `vite`, `vitest` |

**En el frontend la distinción casi no significa nada.** Vite compila todo a archivos
estáticos: lo que llega al navegador es el resultado del empaquetado, no `node_modules`.
`react` podría estar en `devDependencies` y funcionaría igual. La clasificación se mantiene
por convención y porque las herramientas de análisis de vulnerabilidades la usan.

**En el backend sí importa**, y mucho: el contenedor de producción instala solo las quince
de producción. Poner `typescript` ahí sumaría ~65 MB de imagen para nada.

**Y hay una excepción que este proyecto tiene**: `prisma` (el CLI) está en
`devDependencies`, pero `package.json:9` declara:

```json
"postinstall": "prisma generate"
```

Ese guion corre **después de cada `npm install`**, incluida una instalación de producción
con `--omit=dev`… donde `prisma` no estaría. Se desarrolla en §24.3.2.

---

## 24.2 · Panorama

### 24.2.1 · Las 50, de un vistazo

**Backend — producción (15)**

| Paquete | Declarada | Resuelta | Qué resuelve | Uso |
|:--|:--|:--|:--|:--:|
| `express` | ^4.21.2 | 4.22.2 | Servidor HTTP y enrutado | ✅ |
| `@prisma/client` | ^7.8.0 | 7.8.0 | ORM, cliente generado | ✅ |
| `@prisma/adapter-mariadb` | ^7.8.0 | — | Controlador nativo, sin Rust | ✅ |
| `zod` | ^3.23.8 | 3.25.76 | Validación y tipos derivados | ✅ |
| `jsonwebtoken` | ^9.0.2 | — | Firma y verificación de JWT | ✅ |
| `bcryptjs` | ^2.4.3 | — | Hash de contraseñas | ✅ |
| `helmet` | ^8.0.0 | — | Cabeceras de seguridad | ✅ |
| `cors` | ^2.8.5 | — | Control de origen cruzado | ✅ |
| `cookie-parser` | ^1.4.7 | — | Analiza `Cookie:` | ✅ |
| `express-rate-limit` | ^7.4.1 | — | Límite de peticiones | ✅ |
| `multer` | ^1.4.5-lts.1 | — | Subida *multipart* | ✅ |
| `nodemailer` | ^9.0.3 | 9.0.3 | Envío de correo | ✅ |
| `pino` | ^9.5.0 | — | Registro estructurado | ✅ |
| `pino-http` | ^10.3.0 | — | Registro por petición | ✅ |
| `dotenv` | ^16.4.5 | — | Carga de `.env` | ✅ |

**Backend — desarrollo (13)**

| Paquete | Declarada | Qué resuelve | Uso |
|:--|:--|:--|:--:|
| `typescript` | ^5.6.3 | Compilador y tipos | ✅ |
| `tsx` | ^4.19.2 | Ejecuta TS sin compilar | ✅ |
| `prisma` | ^7.8.0 | CLI: migrar, generar, seed | ✅ |
| `vitest` | ^4.1.10 | Pruebas | ✅ |
| `pino-pretty` | ^13.0.0 | Registro legible en desarrollo | ✅ |
| `@types/node` | ^22.9.0 | Tipos de Node | ✅ |
| `@types/express` | ^4.17.21 | Tipos de Express 4 | ✅ |
| `@types/bcryptjs` | ^2.4.6 | Tipos | ✅ |
| `@types/cookie-parser` | ^1.4.7 | Tipos | ✅ |
| `@types/cors` | ^2.8.17 | Tipos | ✅ |
| `@types/jsonwebtoken` | ^9.0.7 | Tipos | ✅ |
| `@types/multer` | ^1.4.13 | Tipos | ✅ |
| `@types/nodemailer` | ^8.0.1 | Tipos | ⚠️ *desfasado* |

**Frontend — producción (12)**

| Paquete | Declarada | Qué resuelve | Uso |
|:--|:--|:--|:--:|
| `react` | ^18.3.1 | Biblioteca de interfaz | ✅ |
| `react-dom` | ^18.3.1 | Renderizador al DOM | ✅ |
| `react-router-dom` | ^6.28.0 | Enrutado en el cliente | ✅ |
| `@mui/material` | ^6.1.6 | Componentes | ✅ |
| `@mui/icons-material` | ^6.1.6 | ~2.100 iconos | ✅ |
| `@emotion/react` | ^11.13.3 | Motor CSS-in-JS de MUI | ✅ *(indirecto)* |
| `@emotion/styled` | ^11.13.0 | API `styled` de Emotion | ✅ *(indirecto)* |
| `axios` | ^1.7.7 | Cliente HTTP con interceptores | ✅ |
| `zustand` | ^5.0.1 | Estado global | ✅ |
| `recharts` | ^2.13.3 | Gráficos | ✅ *(1 pantalla)* |
| **`@mui/x-date-pickers`** | ^7.22.2 | Selectores de fecha | 🔴 **NO SE USA** |
| **`dayjs`** | ^1.11.13 | Manejo de fechas | 🔴 **NO SE USA** |

**Frontend — desarrollo (10)**

| Paquete | Declarada | Qué resuelve | Uso |
|:--|:--|:--|:--:|
| `vite` | ^5.4.11 | Servidor de desarrollo y empaquetador | ✅ |
| `@vitejs/plugin-react` | ^4.3.3 | JSX y refresco rápido | ✅ |
| `typescript` | ^5.6.3 | Compilador | ✅ |
| `vitest` | ^4.1.10 | Pruebas | ✅ |
| `@types/react` | ^18.3.12 | Tipos de React | ✅ |
| `@types/react-dom` | ^18.3.1 | Tipos del renderizador | ✅ |
| `@types/google.maps` | ^3.65.3 | Tipos del SDK de Maps | ✅ |
| **`@testing-library/react`** | ^16.3.2 | Pruebas de componentes | 🔴 **NO SE USA** |
| **`@testing-library/jest-dom`** | ^7.0.0 | Aserciones de DOM | 🔴 **NO SE USA** |
| **`jsdom`** | ^29.1.1 | DOM en Node | ⚠️ *configurado, innecesario* |

### 24.2.2 · Lo que no está

Tan revelador como lo instalado:

| Ausente | Consecuencia verificada |
|:--|:--|
| **ESLint** + `eslint-plugin-react-hooks` | 🔴 Nueve `eslint-disable` sin linter; **tres cierres obsoletos** (§22A.3.5, §22B.5.2, §22C.4.2) que la regla `exhaustive-deps` habría marcado |
| **Prettier** | Formato a criterio de cada editor |
| **Supertest** | Ninguna prueba toca un endpoint |
| **Playwright / Cypress** | Sin pruebas de extremo a extremo (hay una guía manual, `GUIA-PRUEBAS-E2E.md`) |
| **TanStack Query** | Cada pantalla reimplementa carga, error y recarga (`usePaginatedList` es la versión casera) |
| **date-fns / Luxon** | Las fechas se manejan a mano — **con `dayjs` instalado y sin usar** |
| **Husky / lint-staged** | Nada verifica el código antes de un *commit* |
| **Zod en el frontend** | Los tipos se duplican a mano (§19.3.4) |

---

## 24.3 · Backend, producción

### 24.3.1 · `express` ^4.21.2 → 4.22.2

**Qué es.** El marco de trabajo HTTP minimalista de Node. No impone estructura: da
enrutado y una cadena de *middlewares*, y el resto lo decide el equipo.

**Cómo funciona por dentro.** Todo Express es una lista de funciones
`(req, res, next)` que se ejecutan en orden. Cada una puede responder o llamar a `next()`
para ceder el turno. Un enrutador es una lista anidada; el manejador de errores es una
función con **cuatro** parámetros —`(err, req, res, next)`— y Express la reconoce por la
aridad, no por el nombre.

Esa detección por número de parámetros es el detalle que más sorprende:

```ts
// middlewares/error-handler.ts — SI se quita el `next` sin usar, DEJA DE FUNCIONAR
export function errorHandler(err, req, res, next) { ... }
```

Quitar el cuarto parámetro porque "no se usa" convierte el manejador de errores en un
middleware normal, y todos los errores quedan sin manejar. Es la trampa clásica.

**Dónde se usa.** `app.ts` entero, los 13 archivos `*.routes.ts`, los 13
`*.controller.ts`, los 6 middlewares.

**Por qué la 4 y no la 5.** Express 5 salió en 2024 y trae una mejora importante: **captura
automáticamente los errores de funciones `async`**. En Express 4 hay que envolverlas o
usar `try/catch`; en la 5, un `throw` dentro de un `async` llega solo al manejador de
errores.

El proyecto usa la 4 y lo resuelve con `try/catch` en cada controlador. Es más verboso y
funciona. La razón probable es el ecosistema: en el momento de arrancar, `@types/express`
para la 5 era menos maduro. **Decisión conservadora, defendible.**

**Alternativas.**

| | Ventaja sobre Express | Coste |
|:--|:--|:--|
| **Fastify** | 2-3× más rápido, validación con JSON Schema integrada | Ecosistema menor |
| **NestJS** | Estructura impuesta, inyección de dependencias, decoradores | Curva alta; impondría lo que aquí se hizo a mano |
| **Hono** | Ligero, corre en múltiples entornos | Muy joven |

**Si desapareciera:** habría que reescribir el arranque, las 13 rutas y los 6 middlewares.
El código de servicios y repositorios **no se tocaría** — que es exactamente lo que la
arquitectura por capas del capítulo 2 buscaba.

### 24.3.2 · `@prisma/client` ^7.8.0 · `prisma` ^7.8.0 · `@prisma/adapter-mariadb`

Tres paquetes que son una sola decisión.

**`prisma`** es el CLI: `migrate`, `generate`, `studio`, `db seed`. Vive en
`devDependencies` porque en producción no se migra desde la aplicación.

**`@prisma/client`** es el cliente que la aplicación importa. Pero el paquete instalado es
**una cáscara**: el cliente real lo genera `prisma generate` leyendo `schema.prisma`. En
este proyecto son **22.748 líneas** en `backend/src/generated/prisma/` (§4.4).

**Por qué generar en vez de reflejar en tiempo de ejecución.** El código generado permite
que TypeScript sepa que `prisma.vehicle.findMany({ where: { licensePlate: 'ABC123' } })` es
válido y que `{ where: { patente: ... } }` no. Un ORM que descubre el esquema al arrancar
no puede dar eso. **El precio es el paso de generación**, y de ahí sale la trampa de la
línea 9:

```json
"postinstall": "prisma generate"
```

`postinstall` corre tras cada `npm install`. Sin él, un clon recién descargado no
compilaría: `src/generated/` no está en el repositorio.

⚠️ **Pero `prisma` está en `devDependencies`.** Una instalación de producción
(`npm ci --omit=dev`) no lo instala, y el `postinstall` **falla**. La solución habitual es
generar en la etapa de construcción, antes de podar las dependencias. No está documentado
en el proyecto y es la clase de cosa que aparece la primera vez que se despliega.

**`@prisma/adapter-mariadb`** es la novedad de Prisma 7. Hasta la 6, Prisma incluía un
**motor de consultas escrito en Rust**: un binario de ~20 MB por plataforma que la
aplicación lanzaba como proceso aparte. Prisma 7 lo elimina y usa controladores nativos de
Node.

| | Prisma ≤6 | Prisma 7 |
|:--|:--|:--|
| Motor | Binario Rust aparte | JavaScript + controlador de Node |
| Tamaño | ~20 MB por plataforma | Sin binario |
| Arranque | Levantar el proceso | Inmediato |
| Contenedores | Binario por arquitectura | Indiferente |

**Es una mejora clara y el proyecto la aprovecha.** Que un TP académico esté en Prisma 7
con el adaptador sin Rust —una decisión de 2025— es notable.

**Alternativas.** Drizzle (más ligero, SQL más explícito, sin generación), TypeORM
(patrón Active Record, decoradores), Knex (constructor de consultas sin ORM), SQL a pelo
(máximo control, cero seguridad de tipos).

**Si desapareciera:** habría que reescribir los 13 repositorios. Los servicios se salvarían
casi enteros, salvo los siete `$queryRaw` (§4.6) y los `$transaction`.

### 24.3.3 · `zod` ^3.23.8 → 3.25.76

**Qué es.** Validación de datos en tiempo de ejecución que **deriva el tipo de TypeScript
del esquema**.

**El problema que resuelve.** TypeScript desaparece al compilar. Esto compila y es mentira:

```ts
const body = req.body as CreateTripDto;   // ❌ una promesa sin verificar
```

`req.body` es lo que mandó el cliente: puede ser `{}`, `null`, o
`{ destination: 42, __proto__: {...} }`. El `as` solo silencia al compilador.

Zod verifica de verdad:

```ts
export const createTripSchema = z.object({
  destination: z.string().min(2).max(120),
  departureAt: z.coerce.date(),
  notes: z.string().max(1000).optional(),
});
export type CreateTripDto = z.infer<typeof createTripSchema>;
```

**`z.infer` es lo que hace a Zod distinto.** El tipo se **deriva** del esquema. No hay dos
declaraciones que mantener sincronizadas: cambiar el esquema cambia el tipo, y todo lo que
lo use deja de compilar hasta actualizarse. Una sola fuente de verdad.

**Y hay un efecto secundario que vale por sí solo:** `.parse()` devuelve un objeto **nuevo,
solo con las claves del esquema**. Los campos extra se descartan. Eso convierte al
middleware `validate` en la protección contra **asignación masiva** (§7.4.3): un cliente que
mande `{ destination: 'X', role: 'ADMIN' }` a un endpoint que no acepta `role` ve
desaparecer el campo antes de que nadie lo lea.

**Dónde se usa.** Los 13 `*.schemas.ts`, el middleware `validate`, y `config/env.ts` para
validar las variables de entorno al arrancar.

**⚠️ Y donde no.** El frontend **no tiene Zod**. Los tipos de la API se escriben a mano en
`api/*.api.ts` y deben coincidir con los del backend por disciplina (§19.3.4). Compartir
los esquemas en un paquete común habría eliminado la duplicación, a costa de convertir el
monorepo en un espacio de trabajo real.

**Nota sobre la versión.** Declarado `^3.23.8`, resuelto **3.25.76**. Zod 4 ya existe y trae
mejoras de rendimiento y un `z.iso.date()` que evitaría parte del manejo manual de fechas.
Migrar tiene coste; conviene saber que la 3 es la línea anterior.

**Alternativas.** Yup (anterior, tipos más débiles), Joi (sin integración con TS),
class-validator (decoradores, encaja con NestJS), TypeBox (JSON Schema, más rápido).

### 24.3.4 · `jsonwebtoken` ^9.0.2

**Qué es.** Firma y verificación de JSON Web Tokens.

**Cómo funciona.** Un JWT son tres bloques en Base64URL separados por puntos:

```
eyJhbGciOiJIUzI1NiJ9  .  eyJzdWIiOjEsInJvbGUiOiJBRE1JTiJ9  .  4pcPyMD09...
    cabecera                        carga útil                     firma
```

**Los dos primeros no están cifrados: están codificados.** Cualquiera los decodifica en un
segundo. Lo que protege el token es la **firma**: `HMAC-SHA256(cabecera.carga, secreto)`.
Cambiar un byte de la carga invalida la firma, y sin el secreto no se puede recalcular.

De ahí la regla: **un JWT es legible, no confidencial**. Este proyecto lo respeta —la carga
es `{ sub: id, role }` (`auth.service.ts:34`), sin nada sensible.

**Dónde se usa.** `auth.service.ts:36` (firmar), `middlewares/authenticate.ts` (verificar).

**⚠️ La trampa histórica del paquete.** Las versiones antiguas aceptaban
`{ "alg": "none" }`: un token sin firma se daba por válido. Era una vulnerabilidad de
manual. La versión 9 lo cierra por defecto, y el proyecto está en la 9.

**Por qué el token de refresco NO es un JWT.** Es una decisión que merece verse:

| | Acceso (JWT) | Refresco (opaco) |
|:--|:--|:--|
| Verificar | Solo criptografía, sin BD | Consulta a la BD |
| Revocar | **Imposible** hasta que caduque | Inmediato (`revoked = true`) |
| Vida | 15 minutos | 7 días |

Un JWT no se puede revocar: si es válido y no ha caducado, se acepta. Por eso el de acceso
dura quince minutos —la ventana de daño— y el de larga vida es un valor opaco que
**siempre se consulta contra la base**, donde se puede matar. Es el compromiso correcto.

**Alternativas.** `jose` (moderno, promesas, soporta más algoritmos), o sesiones en
servidor con `express-session` — más simples de revocar, pero con estado.

### 24.3.5 · `bcryptjs` ^2.4.3

**Qué es.** Hash de contraseñas con bcrypt, **implementado en JavaScript puro**.

**Por qué no un hash normal.** SHA-256 es rápido: una GPU calcula miles de millones por
segundo. Contra una base de hashes SHA-256, un atacante prueba diccionarios enteros en
minutos.

bcrypt está diseñado para ser **deliberadamente lento**, y con un coste ajustable. Con el
factor por defecto (10), cada hash tarda ~50-100 ms. Eso es imperceptible al iniciar
sesión y **devastador para la fuerza bruta**: mil millones de intentos pasan de minutos a
milenios.

**Y la sal va incluida.** El resultado tiene esta forma:

```
$2a$10$N9qo8uLOickgx2ZMRZoMye.IjZAgcfl7p92ldGxad68LJZdL17lhWy
 │   │  └── sal (22 car.) ──┘└──── hash (31 car.) ────────────┘
 │   └── coste: 2¹⁰ iteraciones
 └── variante del algoritmo
```

La sal es aleatoria por contraseña, así que **dos usuarios con la misma contraseña tienen
hashes distintos**. Las tablas precalculadas quedan inservibles. Y como todo está en la
cadena, `bcrypt.compare` no necesita nada más para verificar.

**Dónde se usa.** `auth.service.ts:65` (comparar) y `users.service` / `drivers.service` (al
crear).

**⚠️ El sufijo `js`.** El paquete `bcrypt` usa un módulo nativo en C++, más rápido pero que
necesita compilarse en la instalación —una fuente clásica de fallos en despliegue.
`bcryptjs` es JavaScript puro: más lento (que aquí es *una característica*) y sin problemas
de compilación. **Para este caso es la elección correcta.**

**Alternativas.** Argon2 es hoy la recomendación de OWASP —ganó la competición de hashing
de contraseñas de 2015 y resiste mejor los ataques con GPU y ASIC. Requiere módulo nativo.
scrypt viene en Node (`crypto.scrypt`) sin dependencias. **bcrypt sigue siendo una elección
perfectamente defendible**, pero si el proyecto creciera, Argon2 sería el destino.

### 24.3.6 · Las cuatro de seguridad HTTP

**`helmet` ^8.0.0** — pone ~15 cabeceras de seguridad. `app.ts:30`, el **primer**
middleware.

| Cabecera | Qué evita |
|:--|:--|
| `Content-Security-Policy` | Ejecución de scripts no autorizados (XSS) |
| `X-Content-Type-Options: nosniff` | Que el navegador adivine el tipo de un archivo |
| `X-Frame-Options: DENY` | *Clickjacking* dentro de un iframe |
| `Strict-Transport-Security` | Degradación a HTTP |
| `X-Powered-By` (lo **quita**) | Revelar que corre Express |

Se usa con la configuración por defecto. Para una API que solo devuelve JSON es
razonable — el CSP importa sobre todo en respuestas HTML.

**`cors` ^2.8.5** — `app.ts:31`:

```ts
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
```

La política de mismo origen del navegador impide por defecto que `localhost:5173` lea
respuestas de `localhost:3000`. CORS es el mecanismo por el que el **servidor** autoriza
ese cruce.

Los dos parámetros importan:

- **`origin: env.CORS_ORIGIN`** — una lista explícita. Con `origin: '*'` cualquier web
  podría llamar a la API desde el navegador de un usuario.
- **`credentials: true`** — sin esto, **la cookie de refresco no viajaría** y la sesión no
  sobreviviría a una recarga. Y es incompatible con `origin: '*'`: el navegador rechaza esa
  combinación. Las dos opciones están acopladas.

**`cookie-parser` ^1.4.7** — `app.ts:33`. Convierte la cabecera `Cookie:` en
`req.cookies`. Trece líneas de lógica; sin él, `/auth/refresh` no encontraría el token y
**nadie mantendría la sesión**.

**`express-rate-limit` ^7.4.1** — limita peticiones por IP. Se usa en `/auth/login` con un
límite estricto (contra fuerza bruta) y uno general en el resto.

⚠️ **Guarda los contadores en memoria del proceso.** Con dos instancias del backend, cada
una cuenta por su lado: el límite efectivo se duplica. Para producción hace falta un
almacén compartido (`rate-limit-redis`). No está documentado.

### 24.3.7 · `multer` ^1.4.5-lts.1

**Qué es.** El middleware para `multipart/form-data`, el formato de las subidas de archivo.

**Por qué no sirve `express.json`.** Un formulario con archivo no manda JSON: manda un
cuerpo dividido en partes con una frontera:

```
------WebKitFormBoundary7MA4YWxk
Content-Disposition: form-data; name="documentType"

LICENSE
------WebKitFormBoundary7MA4YWxk
Content-Disposition: form-data; name="file"; filename="licencia.pdf"
Content-Type: application/pdf

%PDF-1.4 ...bytes binarios...
------WebKitFormBoundary7MA4YWxk--
```

Multer analiza ese flujo y deja `req.file` y `req.body`.

**Configuración del proyecto** (`middlewares/upload.ts`):

- **`memoryStorage`** — el archivo va a RAM. Permite que `fileFilter` rechace **antes** de
  que nada toque el disco (§23.7).
- **`limits.fileSize`** — `MAX_UPLOAD_BYTES`, 1 MB.
- **`fileFilter`** — la validación real de tipo MIME. El `accept` del `<input>` solo filtra
  el diálogo del sistema operativo.

**⚠️ La versión.** `1.4.5-lts.1` es la línea 1.x. Existe Multer 2.x, publicado tras
corregir vulnerabilidades de denegación de servicio en la 1.x. El sufijo `-lts` indica que
esta rama recibe parches, pero **la línea 1 está en modo mantenimiento**. Es la dependencia
que más conviene revisar antes de desplegar.

### 24.3.8 · `nodemailer` ^9.0.3 → 9.0.3

**Qué es.** Envío de correo por SMTP.

**Dónde se usa.** `shared/services/mailer.ts`, llamado desde `users.service.ts:6` y
`drivers.service.ts:7` para enviar credenciales al crear una cuenta.

**El detalle bueno:** si no hay SMTP configurado, el mailer **registra el mensaje en vez de
enviarlo** (`mailer.ts:65-72`, con tres `console`). El sistema funciona sin servidor de
correo, y en desarrollo las credenciales aparecen en la terminal. Es la misma degradación
elegante de `AddressAutocomplete` y `RouteMap` (§22B.4.2) — un patrón consistente.

**⚠️ Los tipos no corresponden a la versión.** `nodemailer@9.0.3` **no incluye tipos
propios** (verificado: `types` y `typings` ausentes en su `package.json`), así que
`@types/nodemailer` es necesario. Pero el instalado es **8.0.1**: los tipos de la línea 8
contra el runtime de la línea 9.

Mientras la API no haya cambiado, compila y funciona. Pero es una discrepancia real: si la
9 añadió o cambió opciones, TypeScript no las conoce o describe mal las que hay. Es la
clase de desajuste que produce un error en tiempo de ejecución con el compilador en verde.

**Alternativas.** SDKs de servicios (Resend, SendGrid, SES) evitan gestionar SMTP y dan
métricas de entrega. Para un TP, Nodemailer es lo correcto.

### 24.3.9 · `pino` ^9.5.0 · `pino-http` ^10.3.0 · `pino-pretty` ^13.0.0

**Qué es.** El registrador más rápido de Node, **estructurado en JSON**.

**Por qué JSON y no texto.** Un registro en texto es legible para una persona y opaco para
una máquina. Uno en JSON se puede consultar:

```json
{"level":30,"time":1754400000000,"req":{"method":"POST","url":"/api/v1/trips"},"res":{"statusCode":201},"responseTime":47}
```

Con eso se responde "¿cuántos 500 hubo ayer?" o "¿qué endpoint es el más lento?" con una
consulta. Con texto plano, con expresiones regulares y esperanza.

**Por qué Pino y no Winston.** Pino serializa a JSON con el mínimo trabajo posible y puede
delegar la escritura a un proceso aparte, de modo que el hilo principal no se bloquea.
Winston es más flexible y bastante más lento.

**`pino-http`** conecta Pino a Express: un registro por petición, con método, URL, estado y
duración. `app.ts:34-39`.

**La configuración crítica** (`app.ts:37`):

```ts
redact: ['req.headers.authorization', 'req.headers.cookie'],  // never log credentials
```

Sin esas dos entradas, **cada petición autenticada dejaría el JWT completo escrito**. Un
registro filtrado equivaldría a un volcado de sesiones activas.

**`pino-pretty`** transforma el JSON en texto coloreado y legible. Solo en desarrollo
(`isProduction ? undefined : { target: 'pino-pretty' }`) — en producción se quiere el JSON
crudo, que es lo que las herramientas ingieren. **Correctamente en `devDependencies`.**

### 24.3.10 · `dotenv` ^16.4.5

**Qué es.** Lee `.env` y vuelca sus pares en `process.env`.

**Por qué existe.** El *manifiesto de los doce factores* dice que la configuración va en el
entorno, no en el código: la misma imagen sirve para desarrollo y producción, y los
secretos no entran al repositorio. Pero en desarrollo nadie quiere exportar quince
variables a mano. `.env` es el archivo local que las tiene, y **no se versiona**.

**Dónde se usa.** `config/env.ts`, que además **valida** con Zod y **falla al arrancar** si
falta algo:

```
❌ Invalid environment configuration:
   JWT_ACCESS_SECRET: Required
```

Es el patrón *fallar rápido*: mejor no arrancar que arrancar roto y descubrirlo cuando el
primer usuario intente iniciar sesión.

⚠️ **Node 20.6+ trae `--env-file` nativo**, que hace lo mismo sin dependencia. El proyecto
declara Node 20+, así que `dotenv` podría eliminarse. Es la dependencia más prescindible
del backend.

---

## 24.4 · Backend, desarrollo

### 24.4.1 · `typescript` ^5.6.3

La dependencia que da forma a todo lo demás. Ya se explicó en el capítulo 1 (el lenguaje) y
en el 2 (cada opción de `tsconfig.json`). Aquí solo el papel:

**TypeScript no existe en tiempo de ejecución.** Comprueba tipos y los borra. Todo lo que
verifica —que `driver.licenseExpiryDate` es una `Date`, que `role` solo puede ser uno de
tres valores— **desaparece al compilar**. De ahí que Zod sea necesario: para lo que llega
de fuera, hace falta comprobar de verdad.

**Los 8 paquetes `@types/*`** son las declaraciones de tipos de librerías escritas en
JavaScript. Viven en el repositorio comunitario DefinitelyTyped y se publican por separado
del paquete que describen. De ahí el desajuste de `@types/nodemailer` (§24.3.8): **son dos
paquetes independientes que nadie obliga a ir sincronizados**.

Las librerías modernas incluyen sus tipos y no necesitan `@types`. Por eso `zod`, `helmet`,
`pino` y `@prisma/client` no aparecen en esa lista, y sí lo hacen `express`, `bcryptjs`,
`cors`, `cookie-parser`, `jsonwebtoken`, `multer` y `nodemailer` — todas anteriores a la
adopción generalizada de TypeScript.

### 24.4.2 · `tsx` ^4.19.2

**Qué es.** Ejecuta TypeScript directamente, sin compilar antes.

```json
"dev": "tsx watch src/server.ts"
```

**Cómo.** Usa **esbuild** —un compilador escrito en Go, 10-100× más rápido que `tsc`— para
transpilar en memoria. `watch` reinicia el proceso al guardar.

**El detalle que hay que entender:** esbuild **borra los tipos sin comprobarlos**. En
desarrollo con `tsx`, un error de tipos **no impide que el servidor arranque**. La
verificación real la hace `npm run typecheck` (`tsc --noEmit`) o la construcción.

Es un intercambio deliberado: se cambia seguridad inmediata por un ciclo de recarga de
milisegundos. Y es **exactamente la misma decisión que Vite toma en el frontend** (§18.3),
por lo que ambos entornos se comportan igual.

⚠️ **La consecuencia práctica:** si nadie ejecuta `typecheck` y no hay integración continua
que lo haga, **los errores de tipos se acumulan invisibles** hasta el primer intento de
construir. El proyecto tiene el guion; nada lo obliga a correr.

**Alternativas.** `ts-node` (comprueba tipos, mucho más lento), `nodemon` + `tsc -w`
(dos procesos), o Node 22+ con `--experimental-strip-types` nativo.

### 24.4.3 · `vitest` ^4.1.10 — y las 28 pruebas que existen

**Qué es.** El marco de pruebas de la familia de Vite. API compatible con Jest,
significativamente más rápido, y con soporte nativo de TypeScript y módulos ES.

**Qué se prueba realmente.** Aquí conviene ser preciso, porque es fácil equivocarse en las
dos direcciones:

| Archivo | Casos | Qué cubre |
|:--|--:|:--|
| `backend/shared/utils/crypto.test.ts` | 4 | AES-256-GCM, SHA-256 |
| `backend/shared/utils/dates.test.ts` | 4 | `utcStartOfToday`, `utcEndOfDay` |
| `backend/modules/users/users.schemas.test.ts` | 4 | Esquemas Zod |
| `backend/modules/trips/trips.schemas.test.ts` | 4 | Esquemas Zod |
| `backend/modules/maintenance-types/…test.ts` | 4 | Esquemas Zod (`kmTarget >= kmAlert`) |
| `backend/modules/drivers/drivers.schemas.test.ts` | 3 | Esquemas Zod |
| `frontend/utils/datetime.test.ts` | 3 | Ida y vuelta ISO ↔ `datetime-local` |
| `frontend/auth/guards.test.ts` | 2 | `homePathForRole` |
| **Total** | **28** | |

**Vitest se usa.** Ocho archivos, 28 casos, y están bien escritos — el de `datetime`
verifica precisamente el ida y vuelta sin deriva que §22B.2.4 explicó.

**Lo que no se prueba** es más revelador que lo que sí:

- ❌ Ningún **servicio** (donde vive toda la lógica de negocio)
- ❌ Ningún **repositorio**
- ❌ Ningún **endpoint** (no hay Supertest)
- ❌ Ningún **componente de React**
- ❌ Ningún **flujo completo**
- ❌ Ninguna de las **carreras de concurrencia** del capítulo 23

Se prueba lo fácil de probar: funciones puras sin dependencias. `trips.service.assign`, con
sus siete validaciones y dos cerrojos, **no tiene una sola prueba**. Y es el código que más
la necesita.

⚠️ **La causa es estructural, no de negligencia.** Probar un servicio exige una base de
datos, o sustituir Prisma por un doble. Ninguna de las dos cosas está montada: no hay
`docker-compose` de pruebas, ni utilidades de simulación, ni datos de prueba
independientes del seed. **La infraestructura de pruebas se detuvo justo antes de la parte
cara.**

**Y hay dos configuraciones distintas de la misma herramienta:** el backend importa
`describe`/`it`/`expect` explícitamente; el frontend usa `globals: true` (§18.3). Sin razón
aparente.

---

## 24.5 · Frontend

### 24.5.1 · `react` ^18.3.1 · `react-dom` ^18.3.1

**Dos paquetes, una biblioteca.** `react` define componentes, hooks y elementos —sin saber
nada de navegadores—. `react-dom` los traduce a nodos del DOM. La separación permite que
existan React Native (a vistas nativas) o Ink (a la terminal): el mismo `react`, otro
renderizador.

Su funcionamiento —JSX, DOM virtual, reconciliación, reglas de los hooks— ocupa §18.5, y no
se repite.

**Por qué la 18 y no la 19.** React 19 salió a finales de 2024 y trae Componentes de
Servidor, el hook `use`, y `useOptimistic`. El proyecto está en la 18, que es lo prudente:
MUI 6 declara compatibilidad con la 18, y buena parte del ecosistema tardó meses en
adaptarse.

⚠️ **Y una consecuencia concreta de la 18 que el proyecto sufre:** `<StrictMode>` (§18.4)
**monta, desmonta y vuelve a montar cada componente en desarrollo**, ejecutando los efectos
dos veces. Es intencional: expone efectos sin limpieza. En este proyecto significa que cada
pantalla hace **dos peticiones** en desarrollo y una en producción. Quien no lo sepa,
persigue un fantasma en la pestaña de red.

**Alternativas.** Vue (más sencillo de aprender, plantillas), Svelte (compila a JS sin
runtime, muy rápido), Angular (marco completo con inyección de dependencias), SolidJS
(sintaxis de React sin DOM virtual).

### 24.5.2 · `@mui/material` ^6.1.6 · `@mui/icons-material` · `@emotion/*`

**Qué es MUI.** La implementación de Material Design para React. ~100 componentes
accesibles y con tema.

**Dónde se usa.** Prácticamente en cada archivo de `pages/` y `components/`. Es la
dependencia más presente del frontend.

**Por qué Emotion aparece y nunca se importa.** Busqué `@emotion` en todo `frontend/src/`:
**cero apariciones**. Y sin embargo los dos paquetes son necesarios.

MUI usa **CSS-in-JS**: los estilos se declaran en JavaScript y se inyectan en tiempo de
ejecución. Ese `sx={{ mb: 2 }}` que aparece en centenares de sitios lo procesa Emotion, que
genera una clase CSS única y la inserta en el documento. MUI los declara como
**dependencias entre pares** (*peer dependencies*): "necesito que estén, pero instálalos
tú, para que haya una sola copia". Si hubiera dos instancias de Emotion, cada una tendría
su caché de estilos y aparecerían duplicados y conflictos.

**El coste del CSS-in-JS:** el navegador ejecuta JavaScript para generar CSS. Es más lento
que una hoja de estilos estática y es la razón de que la industria se esté moviendo hacia
soluciones de tiempo de compilación (Tailwind, CSS Modules, Panda). MUI 6 lo sabe y ofrece
`@mui/system` con extracción estática — el proyecto no lo usa.

**⚠️ `@mui/icons-material` son ~2.100 iconos** y el proyecto usa unos veinte. La forma de
importarlos es lo que decide si eso importa:

```tsx
import AddIcon from '@mui/icons-material/Add';        // ✅ lo que hace el proyecto
import { Add } from '@mui/icons-material';            // ❌ importa el índice entero
```

El proyecto usa **siempre** la primera forma. Con la segunda, el sacudido de árbol
(*tree-shaking*) de Rollup debería salvar la situación, pero la compilación se vuelve
notablemente más lenta. **Está bien hecho, consistentemente.**

**Alternativas.** Tailwind (utilidades, sin runtime), shadcn/ui (se copia el código, no se
instala), Chakra UI, Ant Design, Radix + estilos propios.

### 24.5.3 · 🔴 `@mui/x-date-pickers` ^7.22.2 y `dayjs` ^1.11.13 — instalados y sin usar

Busqué ambos identificadores en todo `frontend/src/`. **Cero apariciones.**

**Y este es el hallazgo más caro del capítulo**, porque los dos paquetes resuelven
exactamente el problema que causó el bug más extendido del proyecto.

**Qué es `@mui/x-date-pickers`.** Los selectores de fecha de MUI: `<DatePicker>`,
`<DateTimePicker>`, `<TimePicker>`. Con teclado, con calendario, accesibles, localizables,
integrados con el tema.

**Qué es `dayjs`.** Una biblioteca de fechas de 2 KB con API similar a Moment.js. Es el
adaptador por defecto de los selectores de MUI, y de ahí que esté instalado.

**Qué usa el proyecto en su lugar:**

```tsx
// VehicleFormDialog, TripFormDialog, ReportesPage, ViajesPage, AuditoriaPage…
<TextField label="Desde" type="date" InputLabelProps={{ shrink: true }} />
```

`<input type="date">` nativo. Funciona, es ligero, y su apariencia la decide el navegador
—distinta en Chrome, Firefox y Safari, dentro de una interfaz que por lo demás es
uniformemente Material Design.

**La conexión con el bug.** El capítulo 22A documentó que los vencimientos se muestran un
día antes, en cuatro sitios, porque `new Date(fechaDATE).toLocaleDateString('es-AR')`
convierte una medianoche UTC a hora local y retrocede al día anterior.

Con `dayjs` y su extensión UTC, eso se escribe:

```tsx
dayjs.utc(v.insuranceExpiryDate).format('DD/MM/YYYY')   // ✅ sin desplazamiento
```

Y con un `<DatePicker>` el problema **ni siquiera se plantea**: el componente trabaja con
objetos `dayjs`, no con cadenas cortadas a mano.

> **La herramienta que evitaba el bug estaba instalada en el proyecto, y no se usó.**

Eso cambia la naturaleza del hallazgo. No es "faltaba una librería": es que se instaló, se
declaró en `package.json`, se descargó en cada `npm install` — y el problema se resolvió a
mano, mal, en catorce sitios.

**Las dos salidas honestas:**

1. **Usarlos.** Sustituir los `<input type="date">` por `<DatePicker>` y centralizar el
   formateo con `dayjs.utc`. Arregla los cuatro sitios del bug y unifica la apariencia.
2. **Desinstalarlos.** `npm uninstall @mui/x-date-pickers dayjs` y arreglar el bug con
   `slice(0, 10)`. Menos peso, menos promesa incumplida.

Lo que no se puede es dejarlo como está: **un `package.json` que declara una intención que
el código no cumple**.

### 24.5.4 · `react-router-dom` ^6.28.0

**Qué resuelve.** En una SPA no hay navegación real: el servidor manda siempre el mismo
`index.html` y JavaScript decide qué pintar. Pero el usuario espera que la URL cambie, que
"atrás" funcione, y que un enlace se pueda compartir. React Router mantiene esa ilusión con
la History API del navegador.

**Dónde se usa.** `App.tsx` (el `BrowserRouter`), `components/RouteMap.tsx` (las rutas por
rol), `AppSidebarLayout` (los enlaces), y `useNavigate` en varias pantallas.

**Por qué la 6 y no la 7.** La 7 fusionó React Router con Remix y cambió bastante la
superficie. La 6 con `createBrowserRouter` es estable y suficiente.

**⚠️ Lo que el proyecto no aprovecha.** React Router 6 tiene `loader` y `action`: cargar los
datos de una ruta **antes** de renderizarla, en lugar de montar el componente y disparar un
`useEffect`. Eso elimina el parpadeo de "cargando" y las carreras de peticiones. El
proyecto usa el patrón clásico de `useEffect` en todas partes.

Y no usa `useSearchParams` —que resolvería el hallazgo de la pestaña de mantenimiento
(§22C, hallazgo 10)— aunque ya es una dependencia.

### 24.5.5 · `axios` ^1.7.7

**Qué resuelve, si `fetch` viene incluido.** Tres cosas concretas:

| | `fetch` nativo | Axios |
|:--|:--|:--|
| **Interceptores** | No existen | ✅ La razón principal |
| **JSON** | `await r.json()` a mano | Automático |
| **Errores HTTP** | 404 y 500 **no** rechazan la promesa | Rechazan |
| **`baseURL`** | Concatenar a mano | Configurado una vez |
| **Peso** | 0 | ~13 KB |

**Los interceptores son la razón, y sin ellos el proyecto sería otro.** `api/axios.ts` los
usa para dos cosas que tocan todas las peticiones:

1. **Petición:** añadir `Authorization: Bearer <token>` a cada llamada, leyendo el token
   del store. Sin interceptor, esas cuatro líneas estarían repetidas en los 13
   `*.api.ts`.
2. **Respuesta:** capturar el 401, refrescar el token y **reintentar la petición
   original**, sin que la pantalla se entere (§23.6).

La segunda es la que no se puede replicar razonablemente con `fetch`: exige envolver cada
llamada en una función propia — es decir, escribir Axios.

**El segundo punto de la tabla también importa.** Con `fetch`, un 500 **no** lanza: hay que
comprobar `response.ok` a mano en cada llamada, y olvidarlo produce el bug de tratar una
página de error como si fueran datos. Axios rechaza, así que el `try/catch` de cada
pantalla funciona como se espera.

**Alternativas.** `ky` (~4 KB, sobre `fetch`, con reintentos), TanStack Query (resuelve un
problema distinto y mayor: caché, invalidación, estados de carga — reemplazaría a
`usePaginatedList`), o `fetch` con un envoltorio propio.

### 24.5.6 · `zustand` ^5.0.1

**Qué resuelve.** Estado compartido entre componentes que no son parientes. Aquí: el
usuario autenticado y el token de acceso, que necesitan `RouteMap`, `AppSidebarLayout`,
media docena de pantallas y —crucialmente— el interceptor de Axios, que **no es un
componente**.

**Por qué no Context.** React Context resolvería el caso de los componentes, pero tiene dos
problemas que aquí importan:

1. **Re-renderiza todos los consumidores** cuando el valor cambia, aunque solo usen una
   parte.
2. **Solo es accesible desde componentes.** El interceptor de Axios es una función suelta
   en un módulo: no puede llamar a `useContext`.

Zustand resuelve los dos:

```tsx
// Desde un componente — reactivo
const user = useAuthStore((s) => s.user);   // solo re-renderiza si `user` cambia

// Desde código normal — imperativo
const token = useAuthStore.getState().accessToken;   // ← esto es lo que usa el interceptor
```

**La segunda forma es la que hace a Zustand la elección correcta aquí**, y no una
preferencia estética. El store vive en el ámbito del módulo, no en el árbol de React. Por
eso tampoco necesita `<Provider>` envolviendo la aplicación.

**Alternativas.** Redux Toolkit (más ceremonia, mejores herramientas de depuración, viaje
en el tiempo), Jotai (átomos), Valtio (proxies), Context (suficiente para casos pequeños).

**Para un proyecto de este tamaño, Zustand es la respuesta correcta**: cubre lo necesario
en ~40 líneas de código propio, contra las varias decenas que costaría Redux.

### 24.5.7 · `recharts` ^2.13.3

**Qué es.** Gráficos declarativos para React, sobre D3, que emiten SVG. Su modelo de
programación se explicó en §22C.2.4.

**Dónde se usa.** `DashboardPage.tsx`. **Un solo archivo, un solo gráfico.**

⚠️ **Y ahí está la pregunta.** Recharts pesa ~500 KB sin comprimir (arrastra buena parte de
D3) para dibujar un gráfico de barras de doce valores.

Con `React.lazy` y división de código, esos 500 KB se cargarían solo al abrir el tablero en
vez de en el arranque de la aplicación. El proyecto **no divide el código en ningún sitio**
(§18.3): todo el JavaScript viaja en un solo paquete.

Para una aplicación interna de escritorio no es dramático. Es la optimización de mayor
retorno del frontend si alguna vez importa el tiempo de carga inicial, y `React.lazy` +
`<Suspense>` son tres líneas.

**Alternativas.** Chart.js (canvas, más ligero, imperativo), Victory, Nivo, visx (de
Airbnb, más control), o D3 directo.

### 24.5.8 · `vite` ^5.4.11 · `@vitejs/plugin-react` ^4.3.3

Ya explicados en §18.3. El resumen de por qué importan:

**En desarrollo,** Vite sirve módulos ES nativos sin empaquetar. El navegador pide
`main.tsx`, Vite lo transpila **solo a él** con esbuild y lo devuelve. Arranque instantáneo,
independiente del tamaño del proyecto. Webpack empaquetaba todo antes de servir la primera
página.

**En producción,** empaqueta con Rollup: un archivo, minificado, con sacudido de árbol.

⚠️ **Y la asimetría que hay que conocer:** esbuild en desarrollo **no comprueba tipos**. La
verificación llega en `npm run build`, que hace `tsc -b && vite build`. Un error de tipos no
se ve hasta construir. Es la misma decisión que `tsx` en el backend (§24.4.2), lo cual al
menos hace los dos entornos coherentes.

**`@vitejs/plugin-react`** aporta la transformación de JSX y el **refresco rápido**: al
guardar un componente, se sustituye en caliente **conservando su estado**. Un formulario a
medio llenar no se vacía. Es la diferencia entre recargar y no recargar.

### 24.5.9 · 🔴 `@testing-library/react` · `@testing-library/jest-dom` · `jsdom`

**Los dos primeros no se usan.** Ninguna prueba los importa: las dos del frontend
(`guards.test.ts`, `datetime.test.ts`) son pruebas de funciones puras que solo importan
`vitest`.

**`jsdom` está configurado pero es innecesario.** `vitest.config.ts:9` declara
`environment: 'jsdom'`, así que se carga en cada ejecución de pruebas. Pero ninguna de las
dos pruebas toca el DOM: `homePathForRole` devuelve una cadena, `isoToLocalInput` también.
Con `environment: 'node'` las pruebas correrían igual y más rápido.

**Qué habrían aportado.** Testing Library propone una filosofía concreta: **probar lo que
el usuario ve, no la implementación**. Nada de "el estado `formOpen` es `true`", sino "hay
un diálogo con el título Nuevo viaje":

```tsx
render(<VehiculosPage />);
await userEvent.click(screen.getByRole('button', { name: /nuevo vehículo/i }));
expect(screen.getByRole('dialog')).toHaveTextContent('Nuevo vehículo');
```

`jest-dom` añade las aserciones legibles: `toBeVisible()`, `toHaveTextContent()`,
`toBeDisabled()`.

**Y aquí se cierra un círculo del manual.** Los tres hallazgos de gravedad alta más
repetidos —el cierre obsoleto en tres pantallas— son **exactamente** lo que una prueba de
componente detecta:

```tsx
// Esta prueba fallaría hoy, en tres pantallas distintas
it('recarga la página actual, no la primera', async () => {
  render(<MaintenanceListTab view="scheduled" />);
  await userEvent.click(screen.getByLabelText('página 3'));
  await userEvent.click(screen.getAllByLabelText('Iniciar')[0]);
  expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
});
```

**Las herramientas están instaladas. Las pruebas no se escribieron.** Es el mismo patrón que
`@mui/x-date-pickers`: la dependencia declara una intención que el código no cumple.

**`@types/google.maps` ^3.65.3** sí se usa: da los tipos de `google.maps.places.Autocomplete`
en `AddressAutocomplete.tsx:30,35`. Sin él, todo el SDK sería `any`.

---

## 24.6 · Resumen

**Lo que el conjunto revela y ningún paquete por separado podía mostrar:**

1. **Las decisiones son mayoritariamente buenas y algunas notables.** Prisma 7 con el
   adaptador sin Rust, Pino con `redact`, Zod con `z.infer`, Zustand por su acceso
   imperativo, la importación individual de iconos. No hay ninguna elección que haya que
   revertir.

2. **Cuatro paquetes instalados y sin usar, y no son inocuos.**
   `@mui/x-date-pickers` + `dayjs` resolvían el bug de fechas más extendido del proyecto;
   `@testing-library/*` habría detectado los tres cierres obsoletos. **Las dos herramientas
   que evitaban los hallazgos más repetidos del manual estaban instaladas.**

3. **La dependencia más cara es la que falta.** Sin ESLint, nueve supresiones silencian a
   un linter inexistente y tres cierres obsoletos llegaron a producción. Veinte minutos de
   configuración.

4. **Las pruebas se detuvieron justo antes de la parte cara.** 28 casos, todos de funciones
   puras y esquemas. Cero servicios, cero endpoints, cero componentes, cero concurrencia.
   La causa es estructural: no hay infraestructura para probar con base de datos.

5. **Dos versiones conviene revisar antes de desplegar:** `multer` 1.x (línea en
   mantenimiento, la 2.x corrige vulnerabilidades) y `@types/nodemailer` 8 contra
   `nodemailer` 9.

### 24.6.1 · Hallazgos del capítulo

| # | Gravedad | Hallazgo | Evidencia |
|--:|:--|:--|:--|
| 1 | 🔴 Alta | **`@mui/x-date-pickers` y `dayjs` instalados y sin usar** — y resuelven exactamente el bug de fechas de §22A.4. Cero apariciones en `frontend/src/`. La herramienta estaba en el proyecto. | `package.json` vs búsqueda en `src/` |
| 2 | 🔴 Alta | **ESLint no está instalado**, y su ausencia causó tres cierres obsoletos que `exhaustive-deps` habría marcado. Nueve `eslint-disable` sin linter. | `package.json` (ambos), 9 comentarios |
| 3 | 🔴 Alta | **`@testing-library/react` y `jest-dom` instalados y sin usar.** Ninguna prueba renderiza un componente. Habrían detectado los tres cierres obsoletos. | 8 archivos de prueba, ninguno los importa |
| 4 | ⚠️ Media | **`multer` en la línea 1.x**, en mantenimiento. La 2.x se publicó tras corregir vulnerabilidades de denegación de servicio. La dependencia a revisar antes de desplegar. | `^1.4.5-lts.1` |
| 5 | ⚠️ Media | **`@types/nodemailer` 8.0.1 contra `nodemailer` 9.0.3.** El runtime no trae tipos propios (verificado), así que el desajuste de mayor es real: el compilador describe una API que puede no ser la que corre. | `package.json` + `node_modules` |
| 6 | ⚠️ Media | **`postinstall: prisma generate` con `prisma` en `devDependencies`.** Una instalación de producción con `--omit=dev` no lo tiene y el guion falla. No está documentado. | `package.json:9` |
| 7 | ⚠️ Media | **`express-rate-limit` cuenta en memoria del proceso.** Con dos instancias, el límite efectivo se duplica. Sin almacén compartido. | `middlewares/rate-limiter.ts` |
| 8 | ⚠️ Baja | **Las pruebas cubren solo funciones puras.** 28 casos: utilidades y esquemas Zod. Cero servicios, repositorios, endpoints, componentes o concurrencia. Falta la infraestructura, no la voluntad. | 8 archivos |
| 9 | ⚠️ Baja | **`jsdom` se carga sin hacer falta.** `environment: 'jsdom'` en la configuración, ninguna prueba toca el DOM. `'node'` sería más rápido. | `frontend/vitest.config.ts:9` |
| 10 | ⚠️ Baja | **`recharts` (~500 KB) para un solo gráfico**, sin división de código. `React.lazy` son tres líneas. | `DashboardPage.tsx` |
| 11 | ⚠️ Baja | **`dotenv` es prescindible.** Node 20.6+ trae `--env-file` nativo y el proyecto declara Node 20+. | `config/env.ts` |
| 12 | ⚠️ Baja | **`react-router-dom` infrautilizado.** No usa `loader`/`action` (evitarían el parpadeo de carga) ni `useSearchParams` (resolvería §22C, hallazgo 10). | `RouteMap.tsx` |
| 13 | ✅ Bueno | **Prisma 7 con `@prisma/adapter-mariadb`.** Sin binario Rust: contenedores más pequeños, arranque inmediato, sin problemas de arquitectura. Decisión de 2025 en un TP. | `package.json` |
| 14 | ✅ Bueno | **`redact` en Pino.** Sin esas dos entradas, cada petición autenticada dejaría el JWT completo escrito en el registro. | `app.ts:37` |
| 15 | ✅ Bueno | **Zod con `z.infer`.** Una sola fuente de verdad para validación y tipo, más el descarte de campos extra que protege contra asignación masiva. | 13 `*.schemas.ts` |
| 16 | ✅ Bueno | **Zustand por su acceso imperativo.** `getState()` desde el interceptor de Axios, que no es un componente y no podría usar Context. La razón técnica, no estética. | `api/axios.ts` |
| 17 | ✅ Bueno | **Iconos importados uno a uno**, consistentemente, en los ~20 usos. Evita arrastrar el índice de 2.100. | Todo `pages/` |
| 18 | ✅ Bueno | **`bcryptjs` sobre `bcrypt`.** JavaScript puro: sin compilación nativa en el despliegue. La lentitud es una característica. | `auth.service.ts:65` |
| 19 | ✅ Bueno | **`pino-pretty` solo en desarrollo.** En producción el JSON crudo, que es lo que las herramientas ingieren. | `app.ts:36` |

---

## 24.7 · Preguntas de repaso

<details>
<summary><b>1. ¿Qué significa <code>^4.21.2</code> y por qué <code>zod</code> corre en 3.25.76 si dice <code>^3.23.8</code>?</b></summary>

`^` acepta cualquier versión que no cambie el **primer número distinto de cero**. Para
`^3.23.8`, el rango es `>=3.23.8 <4.0.0`.

Se apoya en el versionado semántico `MAYOR.MENOR.PARCHE`:

- **PARCHE** — corrección compatible → `^` lo acepta
- **MENOR** — función nueva, compatible → `^` lo acepta
- **MAYOR** — cambio rompedor → `^` **no** lo acepta

Así que cuando se instaló, npm resolvió a la última 3.x disponible: **3.25.76**. Treinta y
ocho versiones menores por encima de lo declarado.

**Es una promesa social, no una garantía técnica**: nada impide a un autor publicar un
cambio rompedor en un parche. Por eso existe `package-lock.json`, que congela las versiones
exactas de todo el árbol de dependencias y hace las instalaciones reproducibles. Sin él,
dos `npm install` en momentos distintos pueden dar árboles distintos.
</details>

<details>
<summary><b>2. ¿Por qué hacen falta Zod y TypeScript, si los dos verifican tipos?</b></summary>

Porque verifican en **momentos distintos** y sobre **datos distintos**.

**TypeScript verifica al compilar y desaparece al ejecutar.** Esto compila sin protestar y
es mentira:

```ts
const body = req.body as CreateTripDto;   // ❌ una promesa sin verificar
```

`req.body` es lo que mandó el cliente. Puede ser `{}`, `null`, o
`{ destination: 42, role: 'ADMIN' }`. El `as` solo silencia al compilador; no comprueba
nada.

**Zod verifica en tiempo de ejecución**, cuando el dato ya llegó:

```ts
const dto = createTripSchema.parse(req.body);   // ✅ lanza si no cumple
```

Y `z.infer` cierra el círculo: el **tipo** de TypeScript se deriva del **esquema** de Zod.
Una sola declaración produce las dos cosas, y cambiar el esquema rompe la compilación de
todo lo que dependa del tipo.

**Regla general:** TypeScript para lo que nace dentro del programa; Zod para todo lo que
cruza la frontera — cuerpos HTTP, parámetros de consulta, variables de entorno.

**Y el efecto secundario que vale por sí solo:** `.parse()` devuelve un objeto **nuevo**,
solo con las claves del esquema. Los campos extra desaparecen. Eso es la protección contra
asignación masiva de §7.4.3.
</details>

<details>
<summary><b>3. ¿Qué habría cambiado si el proyecto hubiera usado <code>@mui/x-date-pickers</code>, que ya tiene instalado?</b></summary>

**El bug más extendido del proyecto no existiría.**

§22A.4 documentó que los vencimientos se muestran un día antes, en cuatro sitios, porque:

```tsx
new Date("2026-08-05T00:00:00.000Z").toLocaleDateString('es-AR')   // → "04/08/2026"
```

Una columna `DATE` llega como medianoche UTC; convertirla a hora argentina resta tres horas
y cruza al día anterior.

Con `dayjs` —también instalado— eso se escribe sin desplazamiento:

```tsx
dayjs.utc(v.insuranceExpiryDate).format('DD/MM/YYYY')   // ✅ "05/08/2026"
```

Y con un `<DatePicker>` el problema **ni se plantea**: el componente trabaja con objetos
`dayjs`, no con cadenas ISO cortadas a mano.

Además se habría ganado apariencia uniforme —hoy `<input type="date">` se ve distinto en
cada navegador, dentro de una interfaz que por lo demás es toda Material Design— y mejor
accesibilidad.

**Lo que hace el hallazgo especialmente caro:** los paquetes están declarados, se descargan
en cada instalación, y el problema se resolvió a mano y mal en catorce sitios. **La
herramienta estaba en el proyecto.**
</details>

<details>
<summary><b>4. ¿Por qué el interceptor de Axios obliga a usar Zustand y no React Context?</b></summary>

Porque **el interceptor no es un componente de React**.

`api/axios.ts` define una función suelta en el ámbito de un módulo. No está en el árbol de
React, no tiene un ciclo de renderizado, y **no puede llamar a `useContext`** — los hooks
solo funcionan dentro de un componente durante el renderizado.

Zustand tiene dos interfaces, y la segunda es la que resuelve esto:

```tsx
// Desde un componente — reactivo, re-renderiza al cambiar
const user = useAuthStore((s) => s.user);

// Desde código normal — imperativo, lee el valor actual
const token = useAuthStore.getState().accessToken;   // ← lo que usa el interceptor
```

El store vive en el ámbito del módulo, no en el árbol. Por eso tampoco necesita un
`<Provider>` envolviendo la aplicación.

**Con Context**, el interceptor no tendría forma de leer el token. Habría que sacarlo a una
variable de módulo aparte y sincronizarla con el Context — es decir, reimplementar Zustand
peor.

Y hay un segundo motivo: Context **re-renderiza todos sus consumidores** cuando el valor
cambia, aunque solo usen una parte. El selector de Zustand re-renderiza solo si lo
seleccionado cambió.
</details>

<details>
<summary><b>5. Enumere las cuatro dependencias instaladas que no se usan y diga por qué cada una importa.</b></summary>

| Paquete | Por qué importa que esté sin usar |
|:--|:--|
| **`@mui/x-date-pickers`** | Resuelve exactamente el bug de fechas de §22A.4, presente en cuatro sitios |
| **`dayjs`** | Instalado como adaptador del anterior; su modo UTC arregla el mismo bug en una línea |
| **`@testing-library/react`** | Habría permitido las pruebas de componente que detectan los tres cierres obsoletos |
| **`@testing-library/jest-dom`** | Las aserciones legibles del anterior |

Y medio caso más: **`jsdom`** está configurado como entorno de pruebas
(`vitest.config.ts:9`) pero **ninguna prueba toca el DOM**. Se carga en cada ejecución sin
hacer falta; `environment: 'node'` sería más rápido.

**Lo que tienen en común** es más importante que el peso en disco: **las dos herramientas
que habrían evitado los hallazgos más repetidos del manual estaban instaladas**. No fue
falta de conocimiento ni de recursos. Alguien las eligió, las instaló, y el trabajo se
detuvo antes de usarlas.

Un `package.json` es también una declaración de intenciones. Cuando el código no la cumple,
miente sobre lo que el proyecto es.
</details>

<details>
<summary><b>6. ¿Qué se prueba realmente en el proyecto y qué no?</b></summary>

**Sí se prueba** — 28 casos en 8 archivos:

- Utilidades puras del backend: `crypto` (4), `dates` (4)
- Esquemas Zod: usuarios (4), viajes (4), tipos de mantenimiento (4), choferes (3)
- Utilidades puras del frontend: `datetime` (3), `guards` (2)

Están bien escritas. La de `datetime` verifica precisamente el ida y vuelta sin deriva que
§22B.2.4 explicó.

**No se prueba:**

- ❌ Ningún **servicio** — donde vive toda la lógica de negocio
- ❌ Ningún **repositorio**
- ❌ Ningún **endpoint** — no hay Supertest
- ❌ Ningún **componente de React** — pese a tener Testing Library instalado
- ❌ Ninguna de las **carreras de concurrencia** del capítulo 23

`trips.service.assign`, con sus siete validaciones y dos cerrojos, **no tiene una sola
prueba**. Es el código que más la necesita.

**La causa es estructural, no negligencia.** Probar un servicio exige una base de datos de
pruebas o sustituir Prisma por un doble. Ninguna de las dos cosas está montada: no hay
`docker-compose` de pruebas, ni utilidades de simulación, ni datos independientes del
seed. **La infraestructura se detuvo justo antes de la parte cara.**
</details>

<details>
<summary><b>7. ¿Por qué <code>@emotion/react</code> aparece en <code>package.json</code> si no se importa nunca?</b></summary>

Porque es una **dependencia entre pares** (*peer dependency*) de MUI.

MUI usa **CSS-in-JS**: los estilos se declaran en JavaScript y se inyectan en tiempo de
ejecución. Cada `sx={{ mb: 2 }}` —que aparece en centenares de sitios— lo procesa Emotion,
que genera una clase CSS única y la inserta en el documento.

MUI lo declara como *peer* en lugar de dependencia normal para forzar que **haya una sola
copia** en el árbol. Si hubiera dos instancias de Emotion, cada una tendría su propia caché
de estilos: aparecerían clases duplicadas, conflictos de especificidad y estilos que se
pisan de forma impredecible.

Así que el proyecto lo instala explícitamente **para que MUI lo encuentre**, aunque su
propio código nunca lo importe. Verificado: cero apariciones de `@emotion` en
`frontend/src/`.

**El coste del enfoque:** el navegador ejecuta JavaScript para generar CSS. Es más lento
que una hoja de estilos estática, y es la razón de que el ecosistema se esté moviendo hacia
soluciones de tiempo de compilación (Tailwind, CSS Modules, Panda CSS).
</details>

<details>
<summary><b>8. ¿Cuál es la dependencia más cara del proyecto, y por qué es la que no está?</b></summary>

**ESLint con `eslint-plugin-react-hooks`.**

No está instalado —ni configuración, ni dependencia, ni guion, en ninguno de los dos
repositorios— y sin embargo el código tiene **nueve comentarios `eslint-disable`**: tres en
el frontend y seis en el backend.

Los tres del frontend silencian `react-hooks/exhaustive-deps`, que es **exactamente** la
regla que detecta el cierre obsoleto. Y dos de esos tres tapan un bug real:

| Archivo | ¿Hay bug? |
|:--|:--|
| `MaintenanceListTab:74` | 🔴 Sí |
| `AlertasPage:88` | 🔴 Sí |
| `UsuariosPage:123` | No — ese caso es correcto |

Quien las escribió no sabía distinguir cuál era cuál. **Que es precisamente para lo que
sirve la herramienta que no instaló.**

Y hay un tercer cierre obsoleto —`VehiculosPage`— que **ni siquiera tiene supresión**: nadie
lo vio.

**El coste es asimétrico**: instalar y configurar ESLint es una tarea de veinte minutos.
Habría detectado los tres bugs antes de que existieran. El proyecto tiene la cicatriz sin
la vacuna: la evidencia de que alguien vio el problema, sin el mecanismo que lo habría
impedido.
</details>

---

## 24.8 · Ejercicios propuestos

### Nivel 1 — Comprensión

**1.1.** Recorra el `package.json` del backend y clasifique las 15 dependencias de
producción en cuatro grupos: HTTP, datos, seguridad, observabilidad. ¿Alguna encaja en dos?

**1.2.** Para cada uno de los 8 paquetes `@types/*` del backend, verifique si la librería
que describe incluye sus propios tipos. ¿Cuáles serían eliminables?

**1.3.** Ejecute `npm ls --depth=0` en ambos repositorios y compare las versiones resueltas
con las declaradas. Enumere las que difieren en más de cinco versiones menores.

**1.4.** Busque `dayjs` y `@mui/x-date-pickers` en `frontend/src/`. Después busque
`toLocaleDateString`. Ponga los dos resultados uno al lado del otro y describa lo que ve.

### Nivel 2 — Verificación

**2.1.** **Mida el peso de lo que sobra.** Ejecute `npm run build` en el frontend y anote el
tamaño del paquete. Desinstale `@mui/x-date-pickers`, `dayjs`, `@testing-library/react` y
`@testing-library/jest-dom`, y repita. ¿Cuánto cambió el paquete? ¿Y `node_modules`?
Explique la diferencia entre ambas cifras.

**2.2.** **Compruebe el hallazgo 6.** En una copia del repositorio, ejecute
`npm ci --omit=dev` en el backend y observe si el `postinstall` falla. Proponga la
corrección.

**2.3.** **Verifique el hallazgo 5.** Compare la API de `nodemailer@9` con lo que declara
`@types/nodemailer@8`: ¿hay opciones nuevas que el compilador no conoce? ¿Alguna cambió de
firma?

**2.4.** **Analice las vulnerabilidades.** Ejecute `npm audit` en ambos repositorios.
Clasifique los avisos en: afectan a producción, solo a desarrollo, o falsos positivos por
transitividad. Preste atención especial a `multer`.

**2.5.** Cambie `environment: 'jsdom'` por `'node'` en `frontend/vitest.config.ts` y mida el
tiempo de `npm test` antes y después.

### Nivel 3 — Diseño

**3.1.** 🔴 **Resuelva el hallazgo 1, en las dos direcciones.**
(a) Sustituya los `<input type="date">` por `<DatePicker>` de MUI en al menos tres pantallas
y centralice el formateo con `dayjs.utc`. Verifique que los cuatro sitios del bug de fechas
quedan corregidos.
(b) En una rama distinta, desinstale ambos paquetes y arregle el bug con `slice(0, 10)`.
Compare: líneas cambiadas, peso del paquete, coherencia visual. **Argumente cuál elegiría.**

**3.2.** 🔴 **Instale ESLint.** Configure `eslint-plugin-react-hooks` y
`@typescript-eslint`. Ejecute y **cuente los avisos**. ¿Cuántos hallazgos del manual
aparecen? ¿Cuántos avisos hay que la revisión manual **no** detectó? Retire las nueve
supresiones y compruebe cuáles eran legítimas.

**3.3.** 🔴 **Monte la infraestructura de pruebas que falta.** Un `docker-compose` con MySQL
efímero, un archivo de configuración de Vitest que migre y siembre antes de la suite, y
utilidades para limpiar entre pruebas. Escriba la primera prueba de servicio: la carrera de
`assign` del §23.4.5, con dos peticiones simultáneas al mismo chofer.

**3.4.** **Divida el código del tablero.** Envuelva `DashboardPage` en `React.lazy` y
`<Suspense>`, y mida el paquete inicial antes y después. Decida si el ahorro justifica el
parpadeo de carga.

**3.5.** **Evalúe TanStack Query.** `usePaginatedList` (49 líneas) reimplementa una parte
de lo que esa librería hace. Migre **una** pantalla y compare: código eliminado, peso
añadido, comportamientos que se ganan (caché, revalidación, reintentos), y si los tres
cierres obsoletos seguirían siendo posibles.

**3.6.** **Elimine la duplicación de tipos.** Convierta el repositorio en un espacio de
trabajo de npm con un paquete `shared/` que exporte los esquemas Zod, y haga que el
frontend derive sus tipos de ahí en vez de escribirlos a mano (§19.3.4). Evalúe qué se
complica en el despliegue.

**3.7.** **Escriba la política de dependencias que el proyecto no tiene.** Un documento que
responda: quién puede añadir una dependencia y con qué criterio; cada cuánto se actualizan;
qué se hace con un `npm audit` en rojo; cómo se decide entre una librería y treinta líneas
propias. Aplíquela retroactivamente a las 50 actuales y señale cuáles no la pasarían.

---

> **Siguiente:** [Capítulo 25 — Los hallazgos, consolidados y priorizados](./25-hallazgos-plan-de-accion.md)
> **Anterior:** [Capítulo 23 — Flujos end-to-end: del clic al píxel](./23-flujos-end-to-end.md)
