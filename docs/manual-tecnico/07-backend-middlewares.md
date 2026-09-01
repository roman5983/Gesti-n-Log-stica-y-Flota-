# Capítulo 7 — Los middlewares

> **Prerrequisitos:** [Capítulo 1](01-conceptos-previos.md) (cierres, asincronía, genéricos), [Capítulo 5, §5.2.2](05-backend-bootstrap.md) (qué es un middleware) y [Capítulo 6](06-backend-shared.md) (la jerarquía de errores).
> **Archivos que se explican aquí:** `middlewares/authenticate.ts` (26 líneas), `authorize.ts` (21), `validate.ts` (21), `error-handler.ts` (89), `rate-limiter.ts` (15), `upload.ts` (30). Total: 202 líneas, todas.
> **Al terminar** el lector entenderá el sistema de seguridad completo del backend, sabrá exactamente dónde se decide cada código de error, y podrá evaluar qué protege y qué no protege cada capa.

---

## 7.1. Introducción

Los seis archivos de `middlewares/` son **202 líneas que protegen 6.600**. Son la frontera entre el mundo exterior —donde todo dato es hostil hasta que se demuestre lo contrario— y el interior del sistema, donde los servicios pueden asumir que lo que reciben es válido, que quien lo pide está identificado, y que tiene permiso.

Cada uno responde a una pregunta distinta, y el **orden** en que se hacen esas preguntas importa tanto como las preguntas mismas:

| # | Middleware | Pregunta que responde | Si falla |
|:-:|:--|:--|:--|
| 1 | `rate-limiter` | ¿Estás pidiendo demasiado seguido? | 429 |
| 2 | `authenticate` | ¿Quién sos? | 401 |
| 3 | `authorize` | ¿Podés hacer esto? | 403 |
| 4 | `validate` | ¿Lo que mandaste tiene sentido? | 400 |
| 5 | `upload` | ¿El archivo es aceptable? | 400 / 413 |
| 6 | `error-handler` | *(no pregunta: traduce todo fallo a HTTP)* | — |

💡 **El orden es de menor a mayor costo computacional, y eso no es casualidad.** Rechazar por límite de velocidad cuesta una consulta a un mapa en memoria. Verificar un JWT cuesta un HMAC-SHA256. Validar con Zod cuesta recorrer un esquema. Ejecutar el servicio cuesta consultas a la base. **Cuanto antes se rechace lo inválido, menos recursos se desperdician** — y menos superficie de ataque queda expuesta.

---

## 7.2. Conceptos previos

### 7.2.1. Autenticación vs. autorización

Son dos cosas distintas que se confunden constantemente, y el proyecto las separa en dos archivos deliberadamente.

| | **Autenticación** | **Autorización** |
|:--|:--|:--|
| Pregunta | *¿Quién sos?* | *¿Qué podés hacer?* |
| Analogía | Mostrar el documento en la puerta | Que el documento diga que sos socio del club |
| Código de fallo | **401** Unauthorized | **403** Forbidden |
| Archivo | `authenticate.ts` | `authorize.ts` |
| Depende de | El token | El rol dentro del token |
| Orden | **Primero** | **Después** |

🔴 **El nombre "401 Unauthorized" es un error histórico de la especificación HTTP.** Debería llamarse "Unauthenticated". El 403 es el que corresponde a "no autorizado". Es una fuente permanente de confusión, y por eso conviene pensar en ellos por su significado y no por su nombre:

- **401** = *"No sé quién sos. Identificate."* → el cliente debe autenticarse y reintentar.
- **403** = *"Sé perfectamente quién sos, y no."* → reintentar no sirve de nada.

💡 **La distinción tiene una consecuencia práctica directa en el frontend.** El interceptor de Axios (`api/axios.ts:45`) reacciona **solo** al 401: intenta renovar el token y reintenta la petición. Ante un 403 no hace nada, porque renovar el token no cambiaría el rol. **Confundir los códigos en el backend rompería el refresh automático del frontend.**

### 7.2.2. Defensa en profundidad

**Defensa en profundidad** es el principio de no confiar en una sola barrera. Si una falla, otra debe detener el ataque.

En este proyecto, una operación como "borrar un usuario" atraviesa **cinco** capas independientes:

```mermaid
graph TB
    A["👤 Usuario con rol DRIVER<br/>intenta DELETE /api/v1/users/5"]
    B["1️⃣ Frontend: guards.tsx<br/>la ruta /usuarios no existe para su rol"]
    C["2️⃣ Frontend: AppSidebarLayout<br/>el menú no muestra 'Usuarios'"]
    D["3️⃣ Backend: authenticate<br/>¿el token es válido?"]
    E["4️⃣ Backend: authorize('ADMIN')<br/>¿su rol está permitido?"]
    F["5️⃣ Backend: users.service<br/>reglas de negocio adicionales"]
    G["6️⃣ MySQL: ON DELETE RESTRICT<br/>integridad referencial"]
    H["💀 Operación ejecutada"]

    A --> B --> C --> D --> E --> F --> G --> H

    B -.->|"se saltea con curl"| D
    C -.->|"se saltea con curl"| D
    E -.->|"❌ 403 — barrera REAL"| X["🛑 Bloqueado"]

    style B fill:#fff9c4,stroke:#f57f17
    style C fill:#fff9c4,stroke:#f57f17
    style E fill:#ffebee,stroke:#c62828,stroke-width:3px
    style G fill:#ffebee,stroke:#c62828,stroke-width:3px
```

🔴 **Las dos primeras capas son comodidad, no seguridad.** Se saltean escribiendo la petición a mano con `curl`. **Las capas 4 y 6 son las que realmente protegen.** Un desarrollador que confunda esto —que piense "el frontend ya lo impide"— deja una vulnerabilidad abierta.

**La regla, en una frase: toda validación del frontend debe existir también en el backend. La del frontend es para el usuario legítimo; la del backend es para el atacante.**

### 7.2.3. El patrón fábrica en los middlewares

Tres de los seis middlewares son **fábricas**: funciones que devuelven un middleware configurado.

| Archivo | Firma | Por qué es fábrica |
|:--|:--|:--|
| `authenticate.ts` | `function authenticate(req, res, next)` | ❌ **No es fábrica.** No tiene configuración. |
| `authorize.ts` | `function authorize(...roles) → middleware` | ✅ Cada ruta permite roles distintos. |
| `validate.ts` | `function validate(schema, part) → middleware` | ✅ Cada ruta valida un esquema distinto. |
| `upload.ts` | `function createUploader() → multer` | ✅ Devuelve un objeto multer configurado. |

**Cómo funciona un middleware fábrica**, con `authorize` como ejemplo:

```ts
// En el arranque del servidor, UNA sola vez:
vehiclesRoutes.post('/', authorize('ADMIN'), ...);
//                      └────────┬────────┘
//                    se EJECUTA acá y devuelve una función

// En cada petición, la función devuelta:
(req, res, next) => { if (!['ADMIN'].includes(req.user.role)) ... }
//                          └──┬──┘
//              recuerda 'ADMIN' por CIERRE (§1.2.6)
```

💡 **La distinción entre "cuándo se ejecuta la fábrica" y "cuándo se ejecuta el middleware" es crucial.** La fábrica corre **una vez, al arrancar**. El middleware corre **una vez por petición**. Cualquier trabajo caro que se pueda hacer en la fábrica (compilar un esquema, construir una estructura de búsqueda) se hace una vez en lugar de miles.

---

## 7.3. `authenticate.ts` línea por línea

```ts
1  import type { NextFunction, Request, Response } from 'express';
2  import jwt from 'jsonwebtoken';
3  import { env } from '../config/env';
4  import { UnauthorizedError } from '../shared/errors/app-error';
5  import type { JwtPayload } from '../shared/types/auth';
6
7  /**
8   * Verifies the Bearer access token and attaches the user to the request.
9   * Stateless by design: user existence/active checks happen at login and
10  * refresh time; access tokens are short-lived (15 min).
11  */
12 export function authenticate(req: Request, _res: Response, next: NextFunction): void {
13   const header = req.headers.authorization;
14   if (!header?.startsWith('Bearer ')) {
15     next(new UnauthorizedError('Missing access token'));
16     return;
17   }
18
19   try {
20     const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as unknown as JwtPayload;
21     req.user = { id: payload.sub, role: payload.role };
22     next();
23   } catch {
24     next(new UnauthorizedError('Invalid or expired access token'));
25   }
26 }
```

### 7.3.1. Qué es un JWT, en detalle

Un **JSON Web Token** es un string con **tres partes separadas por puntos**:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc1NDIzNDU2NywiZXhwIjoxNzU0MjM1NDY3fQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
└──────────── cabecera ─────────────┘ └──────────────────── payload ─────────────────────────────┘ └──────────────── firma ────────────────┘
```

**Parte 1 — Cabecera** (base64url de un JSON):

```json
{ "alg": "HS256", "typ": "JWT" }
```

**Parte 2 — Payload** (base64url de un JSON):

```json
{ "sub": 1, "role": "ADMIN", "iat": 1754234567, "exp": 1754235467 }
```

**Parte 3 — Firma:**

```
HMAC-SHA256(base64url(cabecera) + "." + base64url(payload), SECRETO)
```

🔴 **Base64 NO es cifrado. El payload es LEGIBLE por cualquiera.**

```bash
echo 'eyJzdWIiOjEsInJvbGUiOiJBRE1JTiJ9' | base64 -d
# → {"sub":1,"role":"ADMIN"}
```

**Lo que la firma garantiza es INTEGRIDAD, no confidencialidad:** nadie puede modificar el payload sin conocer el secreto, porque la firma dejaría de coincidir. Pero cualquiera puede **leerlo**. Esa es la razón de mantener el payload mínimo (§6.4.1).

⚙️ **Por qué el atacante no puede simplemente cambiar `"role":"ADMIN"`.** Podría hacerlo: decodifica el payload, lo modifica, lo vuelve a codificar. Pero entonces la firma —que se calculó sobre el payload original— ya no coincide con el nuevo. Y para calcular la firma correcta necesitaría `JWT_ACCESS_SECRET`, que solo tiene el servidor. `jwt.verify` recalcula la firma y compara: si difiere, lanza.

🔴 **El ataque `alg: none`, y por qué este código está a salvo.** Existe un ataque histórico contra implementaciones ingenuas de JWT: el atacante cambia la cabecera a `{"alg":"none"}` y borra la firma. Una librería mal escrita ve "sin algoritmo" y acepta el token sin verificar nada. **`jsonwebtoken` no es vulnerable** por defecto: rechaza `alg: none` salvo que se lo permita explícitamente. Pero el proyecto **no especifica la lista de algoritmos permitidos**, lo que se analiza abajo.

### 7.3.2. Análisis línea por línea

**Línea 12 — la firma**

```ts
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
```

**Tres parámetros** → Express lo trata como middleware normal (§5.2.2). `_res` con guion bajo indica que no se usa: este middleware **nunca responde directamente**, siempre delega en `next()`.

💡 **Que `authenticate` no responda nunca es una decisión de diseño consistente con §2.7.4:** los errores se lanzan y el manejador global los traduce. Si respondiera con `res.status(401).json(...)`, habría **dos** lugares generando respuestas de error con formatos potencialmente distintos.

**Línea 13 — leer la cabecera**

```ts
const header = req.headers.authorization;
```

**Las cabeceras HTTP no distinguen mayúsculas**, y Node las normaliza a minúsculas. `Authorization`, `authorization` y `AUTHORIZATION` llegan todas como `req.headers.authorization`.

Tipo: `string | undefined`.

**Línea 14 — la comprobación**

```ts
if (!header?.startsWith('Bearer ')) {
```

**Dos comprobaciones en una expresión:**

1. `header?.` — **encadenamiento opcional**: si `header` es `undefined`, la expresión completa vale `undefined` en lugar de lanzar `TypeError: Cannot read properties of undefined`.
2. `.startsWith('Bearer ')` — verifica el esquema de autenticación.

**Tabla de comportamiento:**

| Valor de `header` | `header?.startsWith('Bearer ')` | `!` | ¿Rechaza? |
|:--|:--|:--|:--:|
| `undefined` | `undefined` | `true` | ✅ Sí |
| `''` | `false` | `true` | ✅ Sí |
| `'Basic abc'` | `false` | `true` | ✅ Sí |
| `'bearer abc'` | `false` | `true` | ✅ Sí |
| `'Bearer abc'` | `true` | `false` | ❌ Pasa |

⚠️ **Nótese: `'bearer'` en minúscula se RECHAZA.** Según el RFC 7235, el esquema de autenticación **no** distingue mayúsculas, así que técnicamente `bearer` es válido. Este código es más estricto que el estándar.

**¿Es un problema?** En la práctica no: el único cliente es el propio frontend, que escribe `Bearer` (`api/axios.ts:14`). Pero si alguien integrara una herramienta de terceros que use minúscula, obtendría un 401 desconcertante. La corrección sería `header?.toLowerCase().startsWith('bearer ')`.

**El espacio en `'Bearer '` es significativo.** Sin él, un valor como `BearerXYZ` (sin espacio) pasaría la comprobación, y `slice(7)` cortaría en el lugar equivocado.

**Líneas 15-16 — el rechazo**

```ts
next(new UnauthorizedError('Missing access token'));
return;
```

🔴 **El `return` es obligatorio, y su ausencia es un bug clásico de Express.** Sin él, la ejecución continuaría al bloque `try`, se llamaría a `jwt.verify` con basura, fallaría, y se llamaría a `next()` **por segunda vez**. Express respondería dos veces y produciría:

```
Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client
```

Un error que aparece en el log del servidor mucho después de que el cliente ya recibió su respuesta, y cuya causa es difícil de rastrear.

**Línea 20 — la verificación del token**

```ts
const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as unknown as JwtPayload;
```

**`header.slice(7)`** elimina los 7 caracteres de `'Bearer '` (6 letras + 1 espacio).

⚠️ **El `7` es un número mágico.** Sería más robusto `header.slice('Bearer '.length)` — misma semántica, autoexplicativo, y a prueba de cambios en el prefijo.

**Qué hace `jwt.verify` internamente, en orden:**

```mermaid
graph TB
    A["jwt.verify(token, secreto)"] --> B{"¿Tiene 3 partes<br/>separadas por punto?"}
    B -->|No| X["throw JsonWebTokenError:<br/>'jwt malformed'"]
    B -->|Sí| C{"¿La cabecera y el payload<br/>son base64url válido de JSON?"}
    C -->|No| X
    C -->|Sí| D["Recalcula la firma:<br/>HMAC-SHA256(cabecera.payload, secreto)"]
    D --> E{"¿Coincide con la<br/>firma recibida?"}
    E -->|No| Y["throw JsonWebTokenError:<br/>'invalid signature'"]
    E -->|Sí| F{"¿exp > ahora?"}
    F -->|No| Z["throw TokenExpiredError:<br/>'jwt expired'"]
    F -->|Sí| G["✅ devuelve el payload"]

    style X fill:#ffebee,stroke:#c62828
    style Y fill:#ffebee,stroke:#c62828
    style Z fill:#ffebee,stroke:#c62828
    style G fill:#e8f5e9,stroke:#2e7d32
```

⚙️ **La comparación de firmas usa comparación en tiempo constante.** Una comparación normal (`a === b`) termina en el primer byte distinto, lo que filtra información: comparar el byte 1 tarda menos que comparar 20 bytes iguales. Midiendo esos tiempos, un atacante podría reconstruir la firma byte a byte (**ataque de temporización**). `jsonwebtoken` usa `crypto.timingSafeEqual`, que **siempre** recorre todos los bytes.

🔴 **`as unknown as JwtPayload` es una mentira potencial, y ya se señaló en §1.2.7.**

`jwt.verify` devuelve `string | JwtPayload` (el tipo de la librería, no el del proyecto). La doble aserción fuerza el tipo sin ninguna comprobación.

**Qué pasaría si el token tuviera `{ userId: 5 }` en vez de `{ sub: 5 }`:**
- TypeScript diría que `payload.sub` es `number`.
- En tiempo de ejecución sería `undefined`.
- `req.user = { id: undefined, role: undefined }`.
- `authorize` compararía `undefined` contra los roles permitidos → **403** para todo.
- Y si alguna consulta usara `req.user.id`, buscaría `WHERE id = undefined`.

**¿Por qué es seguro en la práctica?** Porque **el mismo sistema firma y verifica el token**, con el mismo secreto y la misma estructura (`auth.service.ts`). La garantía viene de la criptografía, no del sistema de tipos.

💡 **La corrección correcta sería validar el payload con Zod**, cerrando el círculo del proyecto:

```ts
// — mejora propuesta —
const jwtPayloadSchema = z.object({
  sub: z.number().int().positive(),
  role: z.enum(['ADMIN', 'OPERATOR', 'DRIVER']),
});

const payload = jwtPayloadSchema.parse(jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET));
```

Cuesta cinco líneas y elimina la aserción. Y protegería contra un escenario real: si un token viejo (emitido antes de un cambio de estructura del payload) llegara tras un despliegue, el error sería explícito en vez de silencioso.

🔴 **Lo que falta y es una debilidad de seguridad concreta: no se especifica `algorithms`.**

```ts
// — mejora propuesta —
jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] })
```

Sin esa opción, `jwt.verify` acepta **cualquier algoritmo simétrico** que la cabecera declare. El ataque clásico: si el sistema alguna vez usara claves asimétricas (RS256), un atacante podría cambiar la cabecera a HS256 y firmar con la **clave pública** (que es pública) como si fuera el secreto compartido. Aquí el algoritmo siempre es HS256, así que el ataque no aplica hoy — pero **declarar la lista explícita es la práctica recomendada** precisamente porque protege contra cambios futuros.

**Línea 21 — la traducción al modelo del proyecto**

```ts
req.user = { id: payload.sub, role: payload.role };
```

`sub` → `id`. Es la capa anticorrupción de §6.4.2: el vocabulario JWT queda confinado a este archivo.

**Línea 23 — `catch` sin parámetro**

```ts
} catch {
```

**Sintaxis de ES2019** (*optional catch binding*): permite omitir el parámetro cuando no se usa.

💡 **Aquí es deliberado y es una decisión de seguridad.** `jwt.verify` lanza errores específicos (`TokenExpiredError`, `JsonWebTokenError`, `NotBeforeError`) con mensajes distintos. El código los **descarta todos** y devuelve el mismo mensaje genérico: `'Invalid or expired access token'`.

🔴 **Por qué NO diferenciar "token expirado" de "firma inválida" hacia el cliente.** Diferenciarlos daría información útil a un atacante:

| Mensaje diferenciado | Lo que revela |
|:--|:--|
| *"Token expirado"* | La firma **era válida** → el atacante tiene un token real, solo necesita uno más nuevo. |
| *"Firma inválida"* | El token es falso → puede seguir probando variantes sabiendo que va por mal camino. |

Con un mensaje único, el atacante no obtiene ninguna señal.

⚠️ **Pero hay un costo real: el frontend tampoco puede distinguir.** El interceptor de Axios (`api/axios.ts:45`) reintenta ante **cualquier** 401. Si el token está expirado, el reintento tras renovar funciona (correcto). Si la firma es inválida (por ejemplo, porque el servidor rotó su secreto), el reintento también fallará, y recién ahí se limpia la sesión. Es un viaje de red desperdiciado, pero el comportamiento final es correcto.

💡 **La solución que da lo mejor de ambos:** mensaje genérico al cliente, **detalle en el log del servidor**. Hoy el error se descarta por completo y no queda registro de si hubo intentos con firmas inválidas — que es exactamente la señal que indicaría un ataque en curso.

### 7.3.3. Lo que `authenticate` deliberadamente NO hace

El comentario de las líneas 9-10 es explícito: *"Stateless by design: user existence/active checks happen at login and refresh time; access tokens are short-lived (15 min)."*

**Lo que NO verifica:**

| Verificación omitida | Ventana de exposición |
|:--|:--|
| ¿El usuario todavía existe? | Un usuario borrado sigue operando hasta 15 min. |
| ¿`isActive` sigue en `true`? | Un usuario suspendido sigue operando hasta 15 min. |
| ¿El rol cambió? | Un ex-administrador conserva privilegios hasta 15 min. |
| ¿El token fue revocado? | No hay revocación de access tokens. |

**Lo que se gana:** **cero consultas a la base por petición.** Con 57 endpoints y decenas de peticiones por pantalla, es un ahorro sustancial y elimina un punto de fallo.

**Lo que se pierde:** revocación inmediata.

🔴 **La consecuencia de negocio más incómoda: despedir a un empleado no lo desconecta inmediatamente.** Un administrador que da de baja a un operador debe saber que ese operador puede seguir creando viajes durante 15 minutos.

**Es el intercambio estándar de los JWT**, y es defendible. Lo criticable es que **no está documentado fuera de este comentario**: ni el README ni la guía de pruebas lo mencionan, y un administrador razonablemente esperaría que "dar de baja" sea inmediato.

**Las alternativas, con su costo real:**

| Solución | Costo | Cuándo vale la pena |
|:--|:--|:--|
| Consultar el usuario en cada petición | +1 consulta por petición | Sistemas donde la revocación inmediata es un requisito legal. |
| Lista negra en Redis | +1 consulta a Redis + infraestructura nueva | Sistemas grandes con muchas sesiones. |
| Reducir el TTL a 5 min | ×3 llamadas a `/auth/refresh` | Compromiso barato: reduce la ventana sin infraestructura nueva. |
| Versión de sesión en el usuario | +1 consulta, pero cacheable | Buen punto medio. |

---

## 7.4. `authorize.ts` línea por línea

```ts
1  import type { NextFunction, Request, Response } from 'express';
2  import type { Role } from '../generated/prisma/client';
3  import { ForbiddenError, UnauthorizedError } from '../shared/errors/app-error';
4
5  /**
6   * Role-based authorization (RNF). Must run AFTER authenticate.
7   * Usage: router.get('/', authenticate, authorize('ADMIN', 'OPERATOR'), handler)
8   */
9  export function authorize(...allowedRoles: Role[]) {
10   return (req: Request, _res: Response, next: NextFunction): void => {
11     if (!req.user) {
12       next(new UnauthorizedError('Authentication required'));
13       return;
14     }
15     if (!allowedRoles.includes(req.user.role)) {
16       next(new ForbiddenError('Insufficient permissions for this operation'));
17       return;
18     }
19     next();
20   };
21 }
```

**Línea 2 — `import type { Role } from '../generated/prisma/client'`**

💡 **Este es un import excelente y conviene destacarlo**, porque contrasta con los antipatrones señalados en capítulos anteriores. En `seed.ts:79` y en los schemas de Zod, los roles se escriben a mano (`'ADMIN' | 'OPERATOR' | 'DRIVER'`). **Aquí se importa el tipo generado.**

**Consecuencia concreta:** agregar un rol `SUPERVISOR` al `schema.prisma` y regenerar hace que este archivo lo acepte automáticamente, y que `authorize('SUPERVSOR')` (con error de tipeo) sea un error de compilación. En los otros lugares, no.

**Línea 9 — la fábrica y el parámetro rest**

```ts
export function authorize(...allowedRoles: Role[]) {
```

**`...allowedRoles` es un parámetro *rest*** (§1.2.6): recolecta todos los argumentos en un arreglo.

```ts
authorize('ADMIN')                    // allowedRoles = ['ADMIN']
authorize('ADMIN', 'OPERATOR')        // allowedRoles = ['ADMIN', 'OPERATOR']
authorize()                           // allowedRoles = []  🔴
```

🔴 **`authorize()` sin argumentos rechaza a TODOS**, porque `[].includes(cualquierCosa)` es siempre `false`. Es un fallo seguro (*fail-safe*): ante un error del programador, se deniega en vez de permitir.

💡 **Que el fallo por omisión sea "denegar" y no "permitir" es un principio de diseño de seguridad fundamental.** Comparar con la alternativa: si `authorize()` sin roles permitiera todo, un olvido abriría un endpoint sin que nadie lo notara.

⚠️ **Aun así, sería mejor que fuera imposible.** TypeScript puede exigir al menos un argumento:

```ts
// — mejora propuesta —
export function authorize(primerRol: Role, ...otrosRoles: Role[]) {
  const allowedRoles = [primerRol, ...otrosRoles];
  // …
}
```

Ahora `authorize()` es un error de compilación, no un comportamiento raro en tiempo de ejecución.

⚠️ **Sin tipo de retorno declarado.** Es una de las pocas funciones exportadas sin anotación. TypeScript infiere `(req: Request, _res: Response, next: NextFunction) => void`, que es correcto. Anotarlo como `RequestHandler` (el tipo de Express) sería más explícito.

**Línea 10 — la función devuelta y el cierre**

```ts
return (req: Request, _res: Response, next: NextFunction): void => {
```

Esta función arrow **captura `allowedRoles` por cierre** (§1.2.6). Cuando el servidor arranca y ejecuta `authorize('ADMIN')`, la función externa termina — pero la interna **sigue viva dentro del router** y sigue teniendo acceso a `['ADMIN']`.

⚙️ **Qué pasa en memoria.** V8 detecta que la función interna referencia `allowedRoles`, así que en lugar de destruir el ámbito de `authorize` al terminar, lo mueve al *heap* y lo mantiene mientras exista una referencia a la función interna. Como los routers viven toda la ejecución del servidor, ese arreglo también.

**Es memoria permanente**, pero mínima: 57 endpoints × un arreglo de 1-3 strings cortos.

**Líneas 11-14 — la comprobación de autenticación**

```ts
if (!req.user) {
  next(new UnauthorizedError('Authentication required'));
  return;
}
```

🔴 **Esta comprobación existe porque el tipo de `req.user` es `AuthenticatedUser | undefined`** (§6.4.3). TypeScript **obliga** a comprobar antes de leer `req.user.role` en la línea 15.

**¿Cuándo puede ser `undefined` en la práctica?** Solo si `authorize` se registra **sin** `authenticate` antes. Es un error de configuración del router.

💡 **Devolver 401 (no 403) en ese caso es lo correcto.** No es que el usuario no tenga permiso: es que no hay usuario. Y comunica al frontend "identificate", que es la acción que corresponde.

⚠️ **Es una defensa contra un error del programador, no contra un atacante.** El escenario que la dispara es un router mal armado, y en ese caso la aplicación tiene un bug que habría que arreglar. Un `console.error` adicional ayudaría a detectarlo:

```ts
// — mejora propuesta —
if (!req.user) {
  console.error(`[authorize] ${req.method} ${req.path} no tiene authenticate antes`);
  next(new UnauthorizedError('Authentication required'));
  return;
}
```

**Líneas 15-18 — la comprobación de rol**

```ts
if (!allowedRoles.includes(req.user.role)) {
  next(new ForbiddenError('Insufficient permissions for this operation'));
  return;
}
```

**`Array.prototype.includes`** hace comparación estricta (`===`) sobre cada elemento. Con arreglos de 1-3 elementos, la búsqueda lineal es óptima: un `Set` sería más lento por el costo de construcción.

⚠️ **El mensaje es genérico: `'Insufficient permissions for this operation'`.** No dice qué rol haría falta.

**Es deliberado y correcto:** revelar "necesitás ser ADMIN" le da a un atacante un mapa de la estructura de permisos del sistema. Se llama **minimización de la divulgación de información**.

💡 **Pero para el usuario legítimo el mensaje es inútil.** Un operador que hace clic en algo que no puede ve un error que no explica nada. La solución es que el frontend **no muestre** acciones no permitidas (que es lo que hacen los guards y el layout) — el mensaje del backend es la red de seguridad, no la experiencia principal.

### 7.4.1. El modelo de permisos completo del sistema

Extraído de los 13 archivos de rutas:

| Módulo | Lectura | Escritura | Acciones especiales |
|:--|:--|:--|:--|
| `auth` | *(público)* | *(público)* | — |
| `users` | ADMIN | ADMIN | — |
| `drivers` | ADMIN, OPERATOR | ADMIN | Ver credenciales: ADMIN |
| `documents` | ADMIN, OPERATOR, DRIVER (propio) | ADMIN | — |
| `vehicles` | ADMIN, OPERATOR | ADMIN | Activar/desactivar: **solo ADMIN** (RN-16/A-8) |
| `maintenance-types` | ADMIN, OPERATOR | ADMIN | — |
| `maintenances` | ADMIN, OPERATOR | ADMIN, OPERATOR | — |
| `trips` | ADMIN, OPERATOR, DRIVER (propio) | OPERATOR, ADMIN | Finalizar: DRIVER (propio) |
| `alerts` | ADMIN, OPERATOR | ADMIN, OPERATOR | Evaluar: ADMIN |
| `audit-logs` | **ADMIN** | ❌ *(inmutable)* | — |
| `dashboard` | ADMIN, OPERATOR | — | — |
| `reports` | ADMIN | — | — |
| `settings` | ADMIN | ADMIN | — |

💡 **El patrón general que emerge: OPERATOR puede operar, ADMIN puede administrar.** El operador crea viajes, registra mantenimientos y ve la flota; no toca usuarios, ni configuración, ni auditoría, ni da de baja vehículos.

**El comentario de `vehicles.routes.ts:14-16` documenta una decisión concreta:**

> *"Reads: ADMIN + OPERATOR (fleet listing by status is an operator view). Mutations: ADMIN. INACTIVE transitions: ADMIN only — RN-16/A-8 says no other role has that permission, and it is enforced here at the route."*

🔴 **"and it is enforced here at the route" es la frase clave.** La regla RN-16 se cumple **en la declaración de la ruta**, no dentro del servicio. Es más simple y más visible: leyendo el archivo de rutas se ve el modelo de permisos completo del módulo, sin abrir el servicio.

⚠️ **Pero tiene una limitación importante:** `authorize` solo sabe de **roles**, no de **propiedad**. No puede expresar *"un chofer puede ver SUS documentos pero no los de otro"*. Esa comprobación tiene que estar en el servicio, y **es fácil de olvidar**.

**El riesgo concreto** se llama **IDOR** (*Insecure Direct Object Reference*): si `GET /api/v1/drivers/:driverId/documents` solo verifica `authorize('DRIVER')`, el chofer 3 podría pedir `/drivers/5/documents` y ver la documentación de otro. **Hay que verificar en el capítulo 11 que el servicio lo controle.**

---

## 7.5. `validate.ts` línea por línea

Veintiuna líneas, y es el middleware con más impacto sobre la ergonomía del resto del código.

```ts
1  import type { NextFunction, Request, Response } from 'express';
2  import type { ZodSchema } from 'zod';
3
4  type RequestPart = 'body' | 'params' | 'query';
5
6  /**
7   * Centralized request validation (RNF).
8   * Parses and REPLACES the request part with the Zod output, so controllers
9   * always receive typed, coerced and stripped data — never raw input.
10  */
11 export function validate(schema: ZodSchema, part: RequestPart = 'body') {
12   return (req: Request, _res: Response, next: NextFunction): void => {
13     const result = schema.safeParse(req[part]);
14     if (!result.success) {
15       next(result.error);
16       return;
17     }
18     req[part] = result.data;
19     next();
20   };
21 }
```

**Línea 4 — el tipo de las partes**

```ts
type RequestPart = 'body' | 'params' | 'query';
```

Las tres fuentes de datos de una petición HTTP:

| Parte | De dónde viene | Ejemplo | Tipo original |
|:--|:--|:--|:--|
| `body` | El cuerpo, parseado por `express.json()` | `{"model":"Iveco"}` | `any` |
| `params` | Los segmentos de ruta con `:` | `/vehicles/7` → `{id:'7'}` | `Record<string,string>` |
| `query` | La cadena de consulta | `?page=2&limit=20` | `Record<string,string\|string[]>` |

🔴 **`params` y `query` son SIEMPRE strings.** Por eso los esquemas usan `z.coerce.number()` en todos lados (§6.3.1). `body` sí puede tener números, porque JSON los tiene.

**Falta `headers`**, que sería la cuarta fuente. No se valida ninguna cabecera con Zod en este proyecto (la de `Authorization` la maneja `authenticate`).

**Línea 11 — la fábrica**

```ts
export function validate(schema: ZodSchema, part: RequestPart = 'body') {
```

**`part` tiene valor por defecto `'body'`**, que es el caso más frecuente. Por eso se puede escribir `validate(createVehicleSchema)` sin segundo argumento, y `validate(idParamSchema, 'params')` cuando hace falta.

🔴 **`schema: ZodSchema` es un tipo NO genérico, y esa es la limitación central de este archivo.**

`ZodSchema` (alias de `ZodType<any, any, any>`) no conserva ninguna información sobre lo que produce. Consecuencias en cadena:

1. `result.data` tiene tipo `any`.
2. `req[part] = result.data` asigna `any` a `req.body`.
3. **El controlador no sabe qué recibió**, y por eso escribe aserciones a mano:

```ts
// vehicles.controller.ts:38 — la consecuencia
const vehicle = await vehiclesService.update(id, req.body as UpdateVehicleDto, req.user!.id);
//                                                        └──── aserción manual ────┘
```

**La versión genérica que eliminaría todas las aserciones:**

```ts
// — mejora propuesta —
export function validate<T extends ZodTypeAny>(schema: T, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) { next(result.error); return; }
    req[part] = result.data as z.infer<T>;
    next();
  };
}
```

⚠️ **Aunque incluso con eso, TypeScript no puede propagar el tipo desde el middleware hasta el controlador**, porque Express tipa `req.body` como `any` en su declaración global y no hay forma de que un middleware "estreche" el tipo para los siguientes. Es una limitación conocida de Express 4. La solución completa requiere un envoltorio tipado de los controladores, o migrar a un framework con tipado de extremo a extremo (Fastify con JSON Schema, tRPC, Hono). El capítulo 25 lo desarrolla.

**Línea 13 — `safeParse`**

```ts
const result = schema.safeParse(req[part]);
```

Devuelve `{ success: true, data }` o `{ success: false, error }`, sin lanzar (§5.3.3).

**Zod hace TRES cosas en esta línea**, y las tres importan:

| Operación | Ejemplo |
|:--|:--|
| **Validar** | `{ year: 'abc' }` → falla |
| **Convertir** (*coerce*) | `{ year: '2023' }` → `{ year: 2023 }` |
| **Recortar** (*strip*) | `{ model:'X', hackeado:true }` → `{ model:'X' }` |

🔴 **El recorte es una protección de seguridad crítica y poco conocida.**

Por defecto, `z.object()` **elimina** las propiedades que no están en el esquema. Sin eso, existiría el ataque de **asignación masiva** (*mass assignment*):

```ts
// — ejemplo ilustrativo del ataque que se previene —
// El cliente envía:
{ "name": "Juan", "email": "j@x.com", "role": "ADMIN", "isActive": true }

// Sin recorte, si el servicio hiciera:
await prisma.user.create({ data: req.body });
// → ¡el usuario se crea como ADMIN!
```

**Con el recorte de Zod**, si `createUserSchema` no incluye `role`, esa propiedad **desaparece** antes de llegar al servicio. El ataque es imposible por construcción.

💡 **Es una de las razones más fuertes para validar en el borde y REEMPLAZAR el dato**, en lugar de solo comprobar y dejar pasar el original.

**Línea 15 — `next(result.error)`**

```ts
next(result.error);
```

Pasa el `ZodError` **crudo** al manejador global, que lo formatea (`error-handler.ts:26-35`):

```ts
if (err instanceof ZodError) {
  res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    },
  });
}
```

💡 **La separación de responsabilidades es correcta:** el middleware detecta el fallo, el manejador decide su representación HTTP. Si el formato del error de validación cambiara, se toca un archivo.

**Línea 18 — el reemplazo, que es lo más importante del archivo**

```ts
req[part] = result.data;
```

🔴 **Esta línea REEMPLAZA el dato original con el resultado de Zod.** No es una comprobación pasiva: es una transformación.

**Lo que garantiza a partir de aquí, en todo el código posterior:**

| Garantía | Ejemplo |
|:--|:--|
| Los tipos ya están convertidos | `req.params.id` **es** un `number`, no `'7'` |
| Los valores por defecto están aplicados | `req.query.page` es `1` aunque no se haya enviado |
| Las transformaciones se ejecutaron | `licensePlate` está en mayúsculas y sin espacios |
| Los campos extra desaparecieron | Sin asignación masiva |

💡 **El comentario de las líneas 8-9 lo declara:** *"Parses and REPLACES the request part with the Zod output, so controllers always receive typed, coerced and stripped data — never raw input."*

**Es lo que hace válida la aserción del controlador.** `req.params as unknown as { id: number }` (§2.3.2) es cierta **porque esta línea ya reemplazó el objeto**. Sin ella, la aserción sería una mentira y `id` sería un string.

⚠️ **Y ahí está la fragilidad:** la corrección de la aserción depende de que **alguien haya puesto el `validate` correspondiente en la ruta**. Si se olvida, el código compila igual y falla en tiempo de ejecución de forma sutil (una comparación `id === 7` con `id = '7'` da `false`).

### 7.5.1. La doble validación

`vehicles.routes.ts:35-41` aplica `validate` **dos veces** en la misma ruta:

```ts
vehiclesRoutes.patch(
  '/:id',
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),     // ← primera
  validate(updateVehicleSchema),          // ← segunda (body por defecto)
  vehiclesController.update,
);
```

**Son dos middlewares independientes**, cada uno validando una parte distinta. Se ejecutan en orden: primero `params`, después `body`.

⚠️ **Consecuencia: si el `id` es inválido, el cuerpo NO se valida.** El primer `validate` corta la cadena con `next(error)`. El usuario recibe solo el error del id, y al corregirlo puede descubrir que además el cuerpo estaba mal.

**Es un intercambio.** Validar todo junto daría mejor experiencia (todos los errores de una vez), pero requeriría un esquema combinado por ruta. La forma actual es más componible: `idParamSchema` se reutiliza en 30+ rutas.

---

## 7.6. `error-handler.ts` línea por línea

Ochenta y nueve líneas: el **único** punto donde un error se convierte en respuesta HTTP.

### 7.6.1. La firma (líneas 13-18)

```ts
13 export function errorHandler(
14   err: unknown,
15   req: Request,
16   res: Response,
17   _next: NextFunction,
18 ): void {
```

🔴 **Los cuatro parámetros son OBLIGATORIOS, aunque `_next` no se use.** Express identifica los manejadores de error por `fn.length === 4` (§5.2.2). Con tres, sería un middleware normal que se ejecutaría en todas las peticiones respondiendo error a todo.

**`err: unknown`, no `err: Error`** — analizado en §1.2.7. En JavaScript se puede lanzar cualquier cosa: `throw 42`, `throw 'texto'`, `throw null`. Declararlo `Error` sería mentir, y TypeScript permitiría `err.message` sobre algo que podría no tenerlo.

💡 **`unknown` OBLIGA a comprobar el tipo antes de usarlo**, y por eso el archivo es una secuencia de `instanceof`. **El tipado fuerza el código defensivo correcto.**

### 7.6.2. Caso 1 — errores de dominio (líneas 19-24)

```ts
if (err instanceof AppError) {
  res.status(err.statusCode).json({
    error: { code: err.code, message: err.message, details: err.details },
  });
  return;
}
```

**Cinco líneas que manejan seis tipos de error.** Es el Principio Abierto/Cerrado en acción (§2.5): agregar una subclase nueva **no requiere tocar este archivo**.

⚠️ **`details: err.details` se envía sin filtrar.** Como se señaló en §6.2.2, es una superficie de fuga: nada impide que un servicio ponga un objeto con datos sensibles ahí.

⚠️ **Y `rule` de `BusinessRuleError` se pierde aquí** (§6.2.4).

⚠️ **Cuando `details` es `undefined`, la clave aparece igual en el objeto** — pero `JSON.stringify` **omite** las propiedades `undefined`, así que el JSON resultante no la incluye. Es correcto por accidente, no por diseño.

### 7.6.3. Caso 2 — errores de Zod (líneas 26-35)

```ts
if (err instanceof ZodError) {
  res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    },
  });
  return;
}
```

**`err.issues` es un arreglo: Zod recolecta TODOS los problemas**, no se detiene en el primero. El usuario ve los tres campos mal de una vez.

**El `.map` transforma la estructura interna de Zod en algo consumible:**

```jsonc
// Lo que Zod produce internamente (simplificado):
{ code: 'too_small', minimum: 6, path: ['licensePlate'], message: 'String must contain at least 6 character(s)' }

// Lo que se envía:
{ path: 'licensePlate', message: 'String must contain at least 6 character(s)' }
```

💡 **Descartar `code`, `minimum` y los demás campos internos de Zod es correcto:** son detalles de implementación de la librería. Si el proyecto cambiara Zod por Valibot, el contrato de la API no cambiaría.

**`i.path.join('.')`** convierte el arreglo de segmentos en una ruta: `['direccion','calle']` → `'direccion.calle'`. Permite que el frontend asocie el error al campo del formulario.

⚠️ **Los mensajes de Zod están en inglés.** *"String must contain at least 6 character(s)"* llega tal cual al usuario de una aplicación en español. Zod permite mensajes personalizados por validación (`z.string().min(6, 'La patente debe tener al menos 6 caracteres')`), y el proyecto lo usa **solo en `env.ts`** y en un par de esquemas. **La mayoría de los errores de validación que ve el usuario final están en inglés.** Es una deuda de experiencia de usuario concreta y de corrección mecánica.

⚠️ **Un detalle de arrays: `i.path` puede contener números** para índices (`['items', 0, 'nombre']` → `'items.0.nombre'`). El frontend tendría que interpretarlo. En este proyecto no hay arreglos anidados en los esquemas, así que no ocurre.

### 7.6.4. Caso 3 — errores de multer (líneas 37-49)

```ts
if (err instanceof MulterError) {
  const tooLarge = err.code === 'LIMIT_FILE_SIZE';
  res.status(tooLarge ? 413 : 400).json({
    error: {
      code: tooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
      message: tooLarge
        ? `File exceeds the maximum size of ${MAX_FILE_SIZE_BYTES / 1024} KB`
        : err.message,
    },
  });
  return;
}
```

**413 Payload Too Large** es el código específico para "lo que mandaste es demasiado grande". Usar un 400 genérico sería menos informativo.

**Los códigos de error de multer:**

| Código | Significado | Cómo lo trata |
|:--|:--|:--|
| `LIMIT_FILE_SIZE` | Archivo demasiado grande | **413** con mensaje propio |
| `LIMIT_FILE_COUNT` | Demasiados archivos | 400 con el mensaje de multer |
| `LIMIT_UNEXPECTED_FILE` | Nombre de campo inesperado | 400 |
| `LIMIT_FIELD_KEY` / `LIMIT_FIELD_VALUE` | Campo de formulario demasiado grande | 400 |

⚠️ **`err.message` de multer está en inglés** y es técnico: *"Unexpected field"*. Llega tal cual al usuario. Misma deuda que con Zod.

⚠️ **El mensaje dice "1024 KB" en vez de "1 MB"** (§5.4). Correcto pero poco natural.

🔴 **`BadRequestError` de `upload.ts:19` (MIME no permitido) NO llega acá.** Es un `AppError`, así que lo captura el caso 1. Es correcto, pero significa que **los errores de subida se manejan en dos lugares distintos** según su origen: los de multer aquí, los del `fileFilter` en el caso 1. Funciona, pero fragmenta la lógica.

### 7.6.5. Casos 4 y 5 — errores de Prisma (líneas 51-72)

```ts
// Safety net for DB unique-constraint races (e.g. two concurrent creates
// with the same email): services validate first, but the constraint can
// still fire — translate it to 409 instead of leaking a 500.
if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
  res.status(409).json({
    error: { code: 'CONFLICT', message: 'A record with this unique value already exists' },
  });
  return;
}

// FK constraint (ON DELETE RESTRICT): deleting a row still referenced by
// others. Services check first, but a concurrent insert can slip in —
// translate to 409 instead of a leaked 500.
if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
  res.status(409).json({
    error: {
      code: 'CONFLICT',
      message: 'This record is referenced by other records and cannot be deleted',
    },
  });
  return;
}
```

**Los comentarios explican por qué existen estos casos, y el razonamiento es sofisticado.**

🔴 **Es una defensa contra CONDICIONES DE CARRERA.** El servicio verifica antes de escribir:

```ts
// — patrón del servicio —
if (await vehiclesRepository.plateTaken(dto.licensePlate)) {
  throw new ConflictError('Plate already in use');
}
await vehiclesRepository.create(dto);
```

**Pero entre la comprobación y la escritura hay una ventana:**

```mermaid
sequenceDiagram
    participant A as Petición A
    participant DB as MySQL
    participant B as Petición B

    A->>DB: SELECT ... WHERE license_plate='AAA111'
    DB-->>A: sin resultados ✅
    B->>DB: SELECT ... WHERE license_plate='AAA111'
    DB-->>B: sin resultados ✅
    Note over A,B: 🔴 Las DOS creen que la patente está libre
    A->>DB: INSERT (license_plate='AAA111')
    DB-->>A: ✅ ok
    B->>DB: INSERT (license_plate='AAA111')
    DB--xB: ❌ P2002: Unique constraint failed
    Note over B: Sin este manejo → 500 Internal Server Error
    Note over B: Con este manejo → 409 Conflict ✅
```

💡 **La base de datos es la ÚLTIMA línea de defensa, y siempre gana.** La restricción `UNIQUE` no tiene ventana de carrera: es atómica. El servicio comprueba primero para dar un mensaje **mejor** en el 99,9% de los casos; el manejador cubre el 0,1% restante.

**Sin estos dos casos**, esa carrera produciría un **500** —que sugiere "el servidor está roto"— cuando en realidad es un conflicto legítimo del que el usuario puede recuperarse cambiando la patente.

⚠️ **Los mensajes son genéricos:** *"A record with this unique value already exists"* no dice **qué** valor. Prisma expone el campo en `err.meta.target`, y se podría construir un mensaje mucho mejor:

```ts
// — mejora propuesta —
const campo = (err.meta?.target as string[] | undefined)?.join(', ');
message: campo
  ? `Ya existe un registro con ese valor en: ${campo}`
  : 'Ya existe un registro con ese valor único',
```

🔴 **Faltan varios códigos de Prisma relevantes:**

| Código | Significado | Qué pasa hoy | Qué debería pasar |
|:--|:--|:--|:--|
| `P2025` | Registro a actualizar/borrar no encontrado | **500** | **404** |
| `P2000` | Valor demasiado largo para la columna | **500** | **400** |
| `P1001` | No se puede alcanzar la base | **500** | 503 Service Unavailable |
| `P1008` | Timeout de operación | **500** | 504 Gateway Timeout |

**`P2025` es el más importante** (§4.9): ocurre si el servicio actualiza sin haber verificado la existencia primero, o si hay una carrera entre la verificación y la actualización.

⚠️ **Los dos `if` repiten `err instanceof Prisma.PrismaClientKnownRequestError`.** Sería más limpio un solo `if` con un `switch` interno sobre `err.code`, y agregar códigos sería trivial:

```ts
// — mejora propuesta —
if (err instanceof Prisma.PrismaClientKnownRequestError) {
  const mapa: Record<string, { status: number; code: string; message: string }> = {
    P2002: { status: 409, code: 'CONFLICT', message: '…' },
    P2003: { status: 409, code: 'CONFLICT', message: '…' },
    P2025: { status: 404, code: 'NOT_FOUND', message: 'El registro no existe' },
    P2000: { status: 400, code: 'VALUE_TOO_LONG', message: 'Un valor excede la longitud permitida' },
  };
  const t = mapa[err.code];
  if (t) { res.status(t.status).json({ error: { code: t.code, message: t.message } }); return; }
}
```

Esto convierte el caso en Abierto/Cerrado: agregar un código es agregar una entrada al mapa.

### 7.6.6. Caso 6 — el fallback (líneas 74-82)

```ts
// Unexpected error: log it, never leak internals to the client.
req.log?.error(err);
res.status(500).json({
  error: {
    code: 'INTERNAL_ERROR',
    message: isProduction ? 'Internal server error' : String(err),
  },
});
```

**Línea 75 — `req.log?.error(err)`**

`req.log` lo agrega `pino-http` (`app.ts:34`). El `?.` es una precaución: si algún error ocurriera **antes** de que ese middleware corriera, `req.log` sería `undefined`.

🔴 **Este es el ÚNICO lugar del archivo donde se registra el error.** Los cinco casos anteriores responden sin dejar rastro en el log.

**¿Es correcto?** Parcialmente:

| Tipo | ¿Debería registrarse? | Razón |
|:--|:--|:--|
| `NotFoundError`, `ForbiddenError` | ❌ No | Son operación normal. Registrarlos llenaría el log de ruido. |
| `ZodError` | ⚠️ Quizá en nivel `debug` | Un pico de errores de validación puede indicar un cliente roto. |
| **`P2002` / `P2003`** | ✅ **Sí** | Indican una **condición de carrera real**, que es información valiosa sobre concurrencia. Hoy son invisibles. |
| `UnauthorizedError` con firma inválida | ✅ **Sí** | Es la señal de un posible ataque. Hoy es invisible. |

💡 **Los dos últimos son hallazgos concretos: el sistema no registra ni las carreras ni los intentos con tokens falsificados.** Ambos son eventos que un equipo de operaciones querría ver.

**Línea 79 — la decisión de qué mostrar**

```ts
message: isProduction ? 'Internal server error' : String(err),
```

| Entorno | Mensaje | Por qué |
|:--|:--|:--|
| Desarrollo | `String(err)` — el error completo | Depurar sin mirar el log del servidor. |
| Producción | `'Internal server error'` | **No filtrar información interna.** |

🔴 **Qué se filtraría sin esa protección.** Un error de base de datos sin manejar contiene el SQL completo, nombres de tablas y columnas, y a veces valores. Un error de sistema de archivos contiene rutas absolutas del servidor. Un `TypeError` contiene nombres de variables internas. **Todo eso es reconocimiento gratuito para un atacante.**

⚠️ **`String(err)` NO incluye el stack trace**, solo `name: message`. Para depurar en desarrollo sería más útil `err instanceof Error ? err.stack : String(err)`.

🔴 **Y aquí conecta con §5.3.2: si `NODE_ENV` estuviera mal escrito (`prod` en vez de `production`), `isProduction` sería `false` y CADA error 500 en producción filtraría los detalles internos.** El `z.enum` de `env.ts:10` es lo que lo hace imposible. Es un buen ejemplo de cómo una validación en un archivo protege una decisión de seguridad en otro.

### 7.6.7. `notFoundHandler` (líneas 84-89)

```ts
/** 404 for unknown routes, with the same error shape. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
}
```

**Dos parámetros** → middleware normal, no manejador de error. Se ejecuta solo si ninguna ruta coincidió (§5.5.6).

**Mantiene el mismo formato de error**, para que el cliente pueda parsear todas las respuestas de error igual.

⚠️ **Incluye el método y la ruta en el mensaje.** Es útil para depurar y revela **un poco** de información: confirma que la ruta no existe, lo que ayuda a un atacante a mapear la API. Es información de bajísimo valor (la ruta la envió él mismo), así que el intercambio favorece la utilidad.

🔴 **`req.path` NO incluye la cadena de consulta**, así que un `?token=secreto` no se refleja en la respuesta. Es correcto por diseño de Express, pero conviene saberlo: usar `req.originalUrl` **sí** la incluiría y podría reflejar datos sensibles al cliente (y potencialmente habilitar XSS reflejado si la respuesta fuera HTML).

---

## 7.7. `rate-limiter.ts` línea por línea

```ts
1  import rateLimit from 'express-rate-limit';
2
3  /**
4   * Rate limiting on sensitive endpoints (RNF).
5   * Login is the main brute-force target: 10 attempts / 15 min per IP.
6   */
7  export const loginRateLimiter = rateLimit({
8    windowMs: 15 * 60 * 1000,
9    limit: 10,
10   standardHeaders: 'draft-7',
11   legacyHeaders: false,
12   message: {
13     error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts, try again later' },
14   },
15 });
```

**Qué es la limitación de velocidad.** Restringir cuántas peticiones puede hacer un cliente en una ventana de tiempo. Su propósito principal aquí: **frenar la fuerza bruta contra contraseñas**.

**Sin límite**, un atacante prueba miles de contraseñas por minuto contra `admin@empresa.com`. Con un diccionario de contraseñas comunes, una cuenta con contraseña débil cae en minutos.

**Con 10 intentos cada 15 minutos**, son **960 intentos por día por IP**. Probar un diccionario de un millón de contraseñas llevaría **2,8 años**.

⚙️ **Cómo funciona `express-rate-limit` internamente.** Mantiene un `Map` en memoria: clave = IP, valor = `{ contador, momentoDeReinicio }`. En cada petición incrementa el contador; si supera el límite, responde 429 sin llamar a `next()`.

**Línea 8 — `windowMs: 15 * 60 * 1000`**

15 minutos en milisegundos, escrito como producto para que se lea (§5.4).

⚠️ **La ventana es FIJA, no deslizante.** Con `express-rate-limit` por defecto, la ventana se reinicia completa al vencer. Eso permite un pico: 10 intentos al final de una ventana + 10 al principio de la siguiente = **20 intentos en pocos segundos**. Es una limitación conocida del algoritmo de "ventana fija"; una "ventana deslizante" lo evitaría a costa de más memoria.

**Línea 9 — `limit: 10`**

💡 **Diez es un buen equilibrio.** Un usuario legítimo que no recuerda su contraseña prueba 3-4 veces. Diez da margen para errores de teclado y mayúsculas activadas, sin dar espacio útil a un atacante.

**Línea 10 — `standardHeaders: 'draft-7'`**

Agrega las cabeceras estandarizadas del borrador 7 del IETF:

```http
RateLimit: limit=10, remaining=7, reset=847
```

Permite que un cliente bien construido sepa cuánto le queda y cuándo se reinicia, sin tener que agotar el límite para descubrirlo.

**Línea 11 — `legacyHeaders: false`**

Desactiva las cabeceras antiguas (`X-RateLimit-Limit`, `X-RateLimit-Remaining`). Enviar ambas familias sería redundante.

**Líneas 12-14 — el mensaje**

Un **objeto**, no un string, y con la **misma forma que el resto de los errores del sistema** (`{error:{code,message}}`). Es coherencia deliberada: el cliente puede parsear cualquier error de la API con el mismo código.

⚠️ **Pero no pasa por `error-handler`.** `express-rate-limit` responde **directamente**, sin llamar a `next()`. Es el **único lugar del sistema que genera una respuesta de error fuera del manejador global**, y por eso la forma tiene que replicarse a mano aquí. Si el formato cambiara, habría que acordarse de este archivo.

### 7.7.1. Las limitaciones, en detalle

🔴 **Limitación 1: solo protege el login.**

`grep -rn "loginRateLimiter" backend/src/` lo encuentra únicamente en `auth.routes.ts`. **Los otros 56 endpoints no tienen límite.**

**Lo que eso permite:**

| Ataque | Sin límite global |
|:--|:--|
| Agotamiento de recursos | Miles de `GET /api/v1/trips?limit=100` por segundo. |
| Enumeración | Recorrer `/vehicles/1` … `/vehicles/99999` para mapear los datos. |
| Abuso de subidas | Llenar el disco con archivos de 1 MB. |

**Lo correcto sería un límite global generoso** (por ejemplo, 300 peticiones cada 15 minutos) aplicado a todo `/api/v1`, además del estricto para el login.

🔴 **Limitación 2: el almacenamiento es en memoria.**

**Dos consecuencias graves:**

1. **Se reinicia al reiniciar el proceso.** Un atacante que provoque un reinicio (o que simplemente espere un despliegue) recupera sus 10 intentos.
2. **No se comparte entre instancias.** Con 3 réplicas detrás de un balanceador, cada una lleva su propia cuenta: el límite efectivo es **30 intentos cada 15 minutos**, no 10.

**La solución es un almacén compartido** (`rate-limit-redis`), que el paquete soporta con una línea de configuración.

🔴 **Limitación 3: la clave es la IP, y eso tiene dos caras.**

| Problema | Efecto |
|:--|:--|
| **Falsos positivos** | Toda una oficina detrás de una IP NAT comparte el límite. Diez empleados con un error de tipeo cada uno bloquean la oficina. |
| **Falsos negativos** | Un atacante con un botnet o proxies rotativos tiene 10 intentos **por IP**. Con 1.000 IPs, son 10.000 intentos. |

**La defensa complementaria es limitar por CUENTA además de por IP:** 5 intentos fallidos sobre `admin@empresa.com` bloquean esa cuenta temporalmente, sin importar de dónde vengan. Eso frena el botnet.

⚠️ **Y un riesgo de configuración: `trust proxy`.** Detrás de un proxy inverso (nginx, un balanceador), `req.ip` es la IP **del proxy**, no la del cliente — con lo cual **todos los usuarios comparten un único contador**. Express requiere `app.set('trust proxy', 1)` para leer `X-Forwarded-For`. **El proyecto no lo configura.** En desarrollo local no importa; en cualquier despliegue real, el limitador quedaría efectivamente inutilizado (o bloquearía a todo el mundo a la vez).

🔴 **Limitación 4: no hay bloqueo progresivo.** Tras 10 intentos, el atacante espera 15 minutos y tiene 10 más, indefinidamente. Un esquema progresivo (15 min, luego 1 h, luego 24 h) haría el ataque mucho más costoso.

---

## 7.8. `upload.ts` línea por línea

```ts
1  import multer, { type FileFilterCallback } from 'multer';
2  import type { Request } from 'express';
3  import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../config/constants';
4  import { BadRequestError } from '../shared/errors/app-error';
5
6  /**
7   * File upload middleware factory (F-9).
8   *
9   * memoryStorage (not diskStorage) is deliberate: with a 1 MB cap the file
10  * fits comfortably in memory, and nothing is ever written to disk until the
11  * size/MIME checks pass. diskStorage would stream to disk while receiving
12  * and leave a partial file behind when the size limit aborts the upload.
13  * The service writes the validated buffer to disk (Stage 1: files on
14  * filesystem, metadata in DB).
15  */
16 export function createUploader() {
17   function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
18     if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
19       cb(new BadRequestError('Only PDF, JPG and PNG files are allowed'));
20       return;
21     }
22     cb(null, true);
23   }
24
25   return multer({
26     storage: multer.memoryStorage(),
27     fileFilter,
28     limits: { fileSize: MAX_FILE_SIZE_BYTES },
29   });
30 }
```

### 7.8.1. Qué es `multipart/form-data`

Los formularios con archivos usan un formato distinto de JSON. El cuerpo se divide en **partes** separadas por un delimitador:

```http
POST /api/v1/drivers/3/documents HTTP/1.1
Content-Type: multipart/form-data; boundary=----Frontera7MA4YWxk

------Frontera7MA4YWxk
Content-Disposition: form-data; name="documentType"

LICENSE
------Frontera7MA4YWxk
Content-Disposition: form-data; name="file"; filename="licencia.pdf"
Content-Type: application/pdf

%PDF-1.4
… bytes binarios …
------Frontera7MA4YWxk--
```

🔴 **`express.json()` NO parsea esto.** Solo actúa ante `Content-Type: application/json`. Por eso hace falta multer.

**Qué produce multer:**

| Objeto | Contenido |
|:--|:--|
| `req.file` | El archivo: `{ buffer, originalname, mimetype, size, fieldname }` |
| `req.body` | Los campos de texto: `{ documentType: 'LICENSE' }` |

⚠️ **Un detalle de orden que causa bugs reales.** Multer procesa las partes **en el orden en que llegan**. Si el archivo viene antes que los campos de texto, `req.body` estará **vacío** dentro de `fileFilter`. Por eso `fileFilter` **no puede** validar en función de otros campos del formulario. Es una limitación conocida de multer.

### 7.8.2. `memoryStorage` vs. `diskStorage`

El comentario de las líneas 9-14 justifica la elección, y el razonamiento es sólido:

| | `memoryStorage` (elegido) | `diskStorage` |
|:--|:--|:--|
| Dónde va el archivo | RAM (`req.file.buffer`) | Directo al disco |
| ¿Escribe antes de validar? | ❌ **No** | ✅ Sí |
| Archivos parciales al abortar | ❌ Ninguno | ✅ **Sí, quedan** |
| Uso de memoria | 1 MB × subidas concurrentes | Mínimo |
| Adecuado para archivos grandes | ❌ No | ✅ Sí |

🔴 **La razón decisiva está en el comentario:** *"diskStorage would stream to disk while receiving and leave a partial file behind when the size limit aborts the upload."*

**Con `diskStorage`**, multer empieza a escribir apenas recibe bytes. Si el archivo resulta ser de 5 MB, al llegar a 1 MB aborta — **dejando un archivo de 1 MB en el disco** que nadie referencia. Cada intento fallido de subida (malicioso o no) deja basura.

**Con `memoryStorage`**, el archivo se acumula en RAM. Al superar el límite, se descarta y **el disco nunca se toca**. `storeFile` (§6.7) escribe **solo** el buffer ya validado.

⚠️ **El riesgo de `memoryStorage`: agotamiento de memoria.** Cien subidas concurrentes de 1 MB son 100 MB de RAM. Con un límite de 1 MB y sin limitación de velocidad en ese endpoint (§7.7), un atacante podría intentarlo. Es un riesgo teórico acotado por el límite de tamaño, pero real.

### 7.8.3. `fileFilter` (líneas 17-23)

**La firma es de estilo callback**, no de promesa:

```ts
function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void
```

**Las tres formas de llamar a `cb`:**

| Llamada | Efecto |
|:--|:--|
| `cb(null, true)` | Aceptar el archivo |
| `cb(null, false)` | Rechazarlo **silenciosamente** (sin error) |
| `cb(new Error(...))` | Rechazarlo con error |

💡 **El proyecto usa la tercera**, con un `BadRequestError`. Eso hace que llegue al manejador global como `AppError` y produzca un 400 con mensaje claro.

🔴 **`cb(null, false)` habría sido peor**: multer descartaría el archivo **sin error**, `req.file` sería `undefined`, y el servicio fallaría más adelante con un mensaje confuso del tipo "no se recibió archivo" — cuando en realidad sí se recibió y se rechazó por tipo.

**Línea 18 — la comprobación de MIME**

```ts
if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
```

La aserción de tipo se explicó en §5.4.

🔴 **La debilidad de fondo, repetida porque es importante: `file.mimetype` viene del CLIENTE.**

El navegador lo declara en la cabecera `Content-Type` de la parte. **Cualquiera puede mentir:**

```bash
curl -F "file=@virus.exe;type=application/pdf" http://localhost:3000/api/v1/drivers/3/documents
```

La comprobación pasa. El archivo se guarda como `uuid.exe` (la extensión sale de `originalName`, §6.7).

**La verificación real requiere inspeccionar los NÚMEROS MÁGICOS del contenido:**

| Tipo | Primeros bytes |
|:--|:--|
| PDF | `25 50 44 46` (`%PDF`) |
| JPEG | `FF D8 FF` |
| PNG | `89 50 4E 47 0D 0A 1A 0A` |

```ts
// — mejora propuesta —
const FIRMAS: Record<string, Buffer[]> = {
  'application/pdf': [Buffer.from('%PDF')],
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
};
function contenidoCoincide(buffer: Buffer, mime: string): boolean {
  return (FIRMAS[mime] ?? []).some((f) => buffer.subarray(0, f.length).equals(f));
}
```

**Se verificaría en el servicio**, donde el buffer completo ya está disponible (`fileFilter` corre antes de tener el contenido).

💡 **El riesgo está acotado porque los archivos se sirven como descarga y nunca se ejecutan ni se interpretan.** Pero un PDF malicioso descargado y abierto por un usuario sigue siendo un vector, y la verificación de firma es barata.

**Línea 26 — `storage: multer.memoryStorage()`**

Se llama a la función, no se pasa la referencia: `memoryStorage()` **construye** el motor de almacenamiento.

**Línea 28 — `limits: { fileSize: MAX_FILE_SIZE_BYTES }`**

⚙️ **El límite se aplica MIENTRAS se reciben los bytes**, no después. Multer cuenta lo que llega y aborta la conexión al superar el umbral. Un intento de subir 500 MB no transfiere 500 MB: se corta al llegar a 1 MB + un poco.

⚠️ **Los otros límites disponibles NO se configuran:**

| Límite | Por defecto | Riesgo de no configurarlo |
|:--|:--|:--|
| `files` | Infinito | Subir 10.000 archivos de 1 MB en una petición → 10 GB en RAM |
| `fields` | 1.000 | — |
| `fieldSize` | 1 MB | — |
| `parts` | Infinito | Similar a `files` |

🔴 **`files: 1` debería estar.** Los endpoints de este sistema esperan **un** archivo por petición. Sin el límite, nada impide enviar mil.

**Línea 16 — por qué es una fábrica**

```ts
export function createUploader() { … }
```

⚠️ **No hay ninguna configuración variable: todas las llamadas producen exactamente el mismo objeto.** Podría ser `export const uploader = multer({...})`.

**¿Por qué es fábrica entonces?** Dos razones defendibles:

1. **Cada llamada crea una instancia nueva**, sin estado compartido entre módulos.
2. **Está preparada para parametrizarse**: `createUploader({ maxSize, allowedTypes })` sería un cambio compatible.

Es diseño anticipado. Cuestionable (es complejidad para una necesidad que no existe), pero de costo cero.

---

## 7.9. Flujo interno: la cadena completa de una subida

```mermaid
sequenceDiagram
    autonumber
    participant N as Navegador
    participant H as helmet/cors
    participant J as express.json
    participant A as authenticate
    participant Z as authorize
    participant M as multer
    participant V as validate
    participant C as controller
    participant S as service
    participant EH as errorHandler

    N->>H: POST /drivers/3/documents (multipart, 800 KB)
    H->>J: cabeceras ok
    Note over J: Content-Type ≠ application/json<br/>→ NO hace nada, next()
    J->>A: ¿Bearer válido?
    A->>A: jwt.verify → req.user = {id:1, role:'ADMIN'}
    A->>Z: ¿'ADMIN' permitido?
    Z->>M: ✅
    M->>M: fileFilter: ¿MIME en la lista?
    M->>M: acumula en RAM verificando ≤ 1 MB
    M->>V: req.file = {buffer, originalname, mimetype, size}<br/>req.body = {documentType, expiryDate}
    V->>V: safeParse(req.body) + REEMPLAZO
    V->>C: datos tipados y recortados
    C->>S: create(driverId, dto, file)
    S-->>C: documento
    C-->>N: 201 {data}

    rect rgb(255, 235, 238)
    Note over M,EH: Caminos de fallo
    M--xEH: MIME no permitido → BadRequestError → 400
    M--xEH: > 1 MB → MulterError(LIMIT_FILE_SIZE) → 413
    A--xEH: token inválido → UnauthorizedError → 401
    Z--xEH: rol insuficiente → ForbiddenError → 403
    V--xEH: cuerpo inválido → ZodError → 400
    S--xEH: regla de negocio → BusinessRuleError → 422
    end
```

**Los seis caminos de fallo desembocan en el mismo manejador y producen el mismo formato de respuesta.** Esa uniformidad es el resultado directo de la convención de §2.7.4.

---

## 7.10. Resumen

1. **401 vs. 403 no es un matiz:** 401 es *"no sé quién sos"*, 403 es *"sé quién sos y no podés"*. El interceptor de Axios del frontend **solo** reacciona al 401; confundirlos rompería el refresh automático.

2. **Las validaciones del frontend son comodidad; las del backend son seguridad.** Las primeras se saltean con `curl`.

3. **`authenticate` es sin estado por diseño:** cero consultas por petición, a cambio de una ventana de hasta 15 minutos donde un usuario dado de baja sigue operando. Es un intercambio estándar, no documentado fuera de un comentario.

4. **Base64 no es cifrado.** El payload de un JWT es legible por cualquiera; la firma garantiza integridad, no confidencialidad. De ahí el payload mínimo.

5. **`authorize` es una fábrica con cierre:** se ejecuta una vez al arrancar y la función devuelta recuerda los roles permitidos. `authorize()` sin argumentos **deniega a todos** — fallo seguro.

6. **`authorize` solo conoce roles, no propiedad.** *"Un chofer ve SUS documentos"* debe verificarse en el servicio. Olvidarlo produce un IDOR.

7. **`validate` REEMPLAZA el dato con el resultado de Zod.** Eso valida, convierte tipos, aplica valores por defecto **y recorta campos extra** — previniendo la asignación masiva.

8. **`error-handler` es el único punto de traducción error → HTTP**, con seis casos. El primero (`AppError`) es Abierto/Cerrado; el resto es una cadena de `if` que hay que modificar para agregar tipos.

9. **Los casos `P2002`/`P2003` cubren condiciones de carrera reales:** la base es la última línea de defensa y siempre gana. Sin ellos, una carrera legítima produciría un 500.

10. **`memoryStorage` es deliberado:** nada toca el disco hasta que las validaciones pasan, evitando archivos parciales al abortar por tamaño.

11. **Doce deudas concretas detectadas en este capítulo:**
    - `jwt.verify` sin `algorithms: ['HS256']`.
    - El payload del JWT no se valida con Zod (aserción `as unknown as`).
    - No se registra ningún intento con firma inválida (señal de ataque invisible).
    - No se registran las condiciones de carrera `P2002`/`P2003`.
    - `validate` no es genérico → aserciones manuales en 91 métodos de controlador.
    - `P2025` produce 500 en vez de 404; `P2000`, `P1001` y `P1008` tampoco están.
    - Los mensajes de error de Zod y multer están **en inglés** en una aplicación en español.
    - `BusinessRuleError.rule` sigue sin llegar al cliente.
    - Solo el login tiene límite de velocidad; los otros 56 endpoints no.
    - El limitador usa memoria (se pierde al reiniciar, no se comparte entre instancias) y **no hay `trust proxy`**, lo que lo inutilizaría detrás de un balanceador.
    - No hay límite de **cantidad** de archivos (`files: 1`).
    - El MIME no se verifica contra el contenido real (números mágicos).

---

## 7.11. Preguntas de repaso

1. Un chofer autenticado intenta `DELETE /api/v1/users/5`. Enumerar las seis capas que atraviesa y decir cuáles son seguridad real y cuáles comodidad.
2. ¿Por qué el `return` después de `next(new UnauthorizedError(...))` es obligatorio? ¿Qué error produce omitirlo?
3. ¿Puede un atacante leer el contenido de un JWT sin conocer el secreto? ¿Puede modificarlo? Justificar ambas respuestas.
4. ¿Por qué `authenticate` devuelve el mismo mensaje para "token expirado" y "firma inválida"? ¿Qué se gana y qué se pierde?
5. Un administrador degrada a un usuario de ADMIN a OPERATOR. ¿Cuándo pierde los privilegios? Rastrear por qué en el código.
6. ¿Qué hace `authorize()` sin argumentos? ¿Es un fallo seguro o inseguro? ¿Cómo se haría imposible?
7. `validate` hace tres cosas con los datos. Enumerarlas y explicar qué ataque previene la tercera.
8. ¿Por qué `validate` **reemplaza** `req[part]` en lugar de solo comprobar? ¿Qué aserción del controlador depende de eso?
9. ¿Por qué `errorHandler` declara cuatro parámetros si `_next` no se usa?
10. ¿Por qué `err: unknown` y no `err: Error`? ¿Qué consecuencia tiene sobre la estructura del archivo?
11. Los servicios ya verifican que la patente esté libre. ¿Por qué existe entonces el caso `P2002`? Dibujar la secuencia que lo justifica.
12. Un usuario recibe 429. ¿Cuántos intentos hizo? ¿Cuánto debe esperar? ¿Qué pasa si el servidor se reinicia mientras espera?
13. ¿Por qué `memoryStorage` y no `diskStorage`? ¿Cuál es el riesgo de la elección hecha?
14. Un atacante sube `virus.exe` declarando `Content-Type: application/pdf`. ¿Lo detecta el sistema? ¿Qué haría falta para detectarlo?
15. El proyecto se despliega detrás de nginx. ¿Sigue funcionando el limitador de velocidad? Justificar.

<details>
<summary><strong>Respuestas</strong></summary>

1. (1) Guard de ruta del frontend, (2) menú lateral que no muestra la opción, (3) `authenticate`, (4) `authorize('ADMIN')`, (5) reglas del servicio, (6) `ON DELETE RESTRICT` de MySQL. **Las capas 1 y 2 son comodidad**: se saltean escribiendo la petición con `curl`. **Las capas 4 y 6 son seguridad real**: la 4 bloquea con 403 sin importar cómo se haga la petición, y la 6 es una garantía del motor de base de datos.

2. Porque sin él la ejecución **continúa** al bloque `try`, se llama a `jwt.verify` con basura, falla, y se llama a `next()` **una segunda vez**. Express intenta responder dos veces y produce `Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client` — un error que aparece en el log mucho después de que el cliente ya recibió su respuesta, y cuya causa es difícil de rastrear.

3. **Leerlo: sí.** El payload es base64url de un JSON, no cifrado: `echo '<payload>' | base64 -d` lo muestra. **Modificarlo: no útilmente.** Podría cambiar `"role":"ADMIN"`, pero la firma se calculó sobre el payload original y dejaría de coincidir. Para calcular la firma correcta necesitaría `JWT_ACCESS_SECRET`, que solo tiene el servidor. `jwt.verify` recalcula y compara.

4. Para **no darle información al atacante**. "Token expirado" revela que la firma **era válida** — el atacante tiene un token real y solo necesita uno más nuevo. "Firma inválida" le dice que va por mal camino. **Se pierde**: el frontend tampoco puede distinguir, así que reintenta ante cualquier 401 (un viaje de red desperdiciado cuando el problema es la firma). **La solución ideal** sería mensaje genérico al cliente y detalle en el log del servidor — que hoy no existe.

5. **Hasta 15 minutos después**, cuando expira su access token. `authenticate.ts:20-21` lee el `role` **del propio token**, sin consultar la base. El comentario de las líneas 9-10 lo declara: *"Stateless by design"*. El token viejo sigue diciendo `ADMIN` y sigue siendo criptográficamente válido hasta su `exp`.

6. `allowedRoles` es `[]`, y `[].includes(x)` es siempre `false`, así que **rechaza a todos con 403**. Es un **fallo seguro**: ante un error del programador, deniega en vez de permitir. Se haría imposible cambiando la firma a `authorize(primerRol: Role, ...otros: Role[])`, que convierte `authorize()` en un error de compilación.

7. **Validar** (`{year:'abc'}` falla), **convertir** (`{year:'2023'}` → `{year:2023}`), y **recortar** (elimina las propiedades que no están en el esquema). La tercera previene la **asignación masiva**: si el cliente enviara `{name, email, role:'ADMIN'}` y el servicio hiciera `create({data: req.body})`, se crearía un administrador. Con el recorte, `role` desaparece antes de llegar al servicio.

8. Porque reemplazar es lo que hace que las garantías (tipos convertidos, valores por defecto aplicados, transformaciones ejecutadas, campos extra eliminados) sean efectivas para **todo el código posterior**. La aserción `req.params as unknown as { id: number }` del controlador **es cierta solo gracias a esa línea**: sin ella, `req.params.id` seguiría siendo el string `'7'` y la aserción sería una mentira.

9. Porque Express identifica los manejadores de error por `fn.length === 4`. Con tres parámetros sería un **middleware normal**, que se ejecutaría en el flujo habitual de todas las peticiones —respondiendo 500 a todo— y **nunca** se invocaría ante un `next(err)`.

10. Porque en JavaScript se puede lanzar **cualquier cosa**: `throw 42`, `throw 'texto'`, `throw null`. Declararlo `Error` sería mentir, y TypeScript permitiría leer `err.message` sobre algo que podría no tenerlo. **Consecuencia estructural**: `unknown` obliga a comprobar el tipo antes de usar el valor, y por eso el archivo entero es una secuencia de `err instanceof X`. El tipado fuerza el código defensivo correcto.

11. Por una **condición de carrera**. Dos peticiones concurrentes consultan `plateTaken('AAA111')`, ambas reciben "libre", ambas intentan insertar. La primera lo logra; la segunda choca con la restricción `UNIQUE` y Prisma lanza `P2002`. Sin este caso, esa carrera legítima produciría un **500** ("el servidor está roto") en vez de un **409** ("esa patente ya existe, probá otra"), que es un error del que el usuario puede recuperarse.

12. Hizo **11** intentos (los 10 permitidos más el que fue rechazado). Debe esperar hasta que se cierre la ventana de 15 minutos, y la cabecera `RateLimit: reset=N` le dice cuántos segundos faltan. **Si el servidor se reinicia**, el contador se pierde por completo (el almacenamiento es un `Map` en memoria) y recupera sus 10 intentos inmediatamente.

13. Porque `diskStorage` **escribe mientras recibe**: al superar el límite de 1 MB, aborta dejando un archivo parcial en el disco que nadie referencia. `memoryStorage` acumula en RAM y descarta sin tocar el disco; `storeFile` escribe solo el buffer ya validado. **El riesgo de la elección**: agotamiento de memoria — 100 subidas concurrentes de 1 MB son 100 MB de RAM, y ese endpoint **no tiene limitación de velocidad**.

14. **No lo detecta.** `file.mimetype` es lo que el **cliente declara** en la cabecera `Content-Type` de la parte multipart, y cualquiera puede mentir. La comprobación de `fileFilter` pasa, y el archivo se guarda con extensión `.exe` (que sale de `originalName`). **Para detectarlo** habría que verificar los **números mágicos** del contenido: `%PDF` para PDF, `FF D8 FF` para JPEG, `89 50 4E 47` para PNG — comprobación que debe hacerse en el servicio, donde el buffer completo ya está disponible.

15. **No, o funciona mal.** Detrás de un proxy inverso, `req.ip` es la IP **de nginx**, no la del cliente real. Como el limitador usa la IP como clave, **todos los usuarios comparten un único contador**: bastarían 10 intentos de login de cualquier persona para bloquear a toda la aplicación durante 15 minutos. Express requiere `app.set('trust proxy', 1)` para leer la IP real de la cabecera `X-Forwarded-For`, y **el proyecto no lo configura**.

</details>

---

## 7.12. Ejercicios propuestos

**Nivel 1 — Observación**

1. Decodificar manualmente un JWT del sistema: copiar el token de las herramientas de desarrollo, separarlo por puntos, y decodificar cabecera y payload con `base64 -d`. Confirmar que se lee sin conocer el secreto.
2. Provocar cada uno de los seis códigos de error del manejador (400 Zod, 400 multer, 401, 403, 409 P2002, 500) y anotar el cuerpo exacto de la respuesta.
3. Recorrer los 13 archivos `*.routes.ts` y reconstruir la tabla de permisos de §7.4.1. ¿Coincide? ¿Hay algún endpoint sin `authorize`?

**Nivel 2 — Experimentación**

4. Modificar el payload de un JWT (cambiar `role` a `ADMIN`), volver a codificar y usarlo. ¿Qué responde el servidor y qué línea lo produjo?
5. Enviar `POST /api/v1/users` con `{"name":"X","email":"x@x.com","password":"Abc12345!","role":"ADMIN","isActive":false,"id":999}`. Verificar qué campos llegan realmente al servicio. Demostrar el recorte de Zod.
6. Hacer 11 intentos de login fallidos y documentar las cabeceras `RateLimit` de cada respuesta. Reiniciar el servidor y comprobar que el contador se perdió.
7. Subir un archivo `.txt` renombrado a `.pdf` con `curl -F "file=@x.txt;type=application/pdf"`. Verificar que se acepta.
8. Registrar una ruta **sin** `authenticate` pero **con** `authorize('ADMIN')`. ¿Qué código devuelve? Rastrear qué línea lo produjo.

**Nivel 3 — Modificación**

9. Agregar `{ algorithms: ['HS256'] }` a `jwt.verify` y verificar que todo sigue funcionando.
10. Reemplazar la aserción `as unknown as JwtPayload` por una validación Zod del payload. Provocar un token con estructura distinta y comprobar que ahora falla explícitamente.
11. Hacer `validate` genérico (`<T extends ZodTypeAny>`) y eliminar al menos una aserción manual en un controlador. Documentar hasta dónde llega la mejora y por qué no elimina todas.
12. Agregar el caso `P2025` al manejador para que devuelva 404. Escribir un caso que lo dispare (actualizar un id inexistente sin verificación previa).
13. Refactorizar los dos `if` de Prisma en un solo bloque con mapa de códigos, y agregar `P2000`, `P1001` y `P1008`.
14. Traducir al español los mensajes de validación de un módulo completo usando el segundo argumento de los validadores de Zod. Estimar el trabajo para los 13 módulos.
15. Agregar un limitador global a `/api/v1` con un límite generoso, sin afectar el del login. Configurar `trust proxy` y verificar con una cabecera `X-Forwarded-For` simulada.
16. Implementar la verificación de números mágicos en el servicio de documentos. Probar con el archivo del ejercicio 7 y confirmar que ahora se rechaza.

---

**Anterior:** [Capítulo 6 — La capa compartida](06-backend-shared.md) · **Siguiente:** Capítulo 8 — El módulo de autenticación *(pendiente)*
