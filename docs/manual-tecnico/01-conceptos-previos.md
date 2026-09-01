# Capítulo 1 — Conceptos previos

> **Prerrequisitos de este capítulo:** ninguno más allá de saber qué es una variable, un `if` y una función.
> **Al terminar este capítulo** el lector podrá leer cualquier archivo del proyecto y reconocer *qué* está mirando, aunque todavía no entienda *por qué*.

---

## 1.1. Introducción

El resto del manual explica código real. Pero el código real está escrito en dos lenguajes (TypeScript en dos dialectos distintos), corre sobre dos entornos de ejecución distintos (Node.js y el navegador), habla dos protocolos (HTTP y el protocolo binario de MySQL), y usa una docena de conceptos que se dan por sabidos en cualquier tutorial.

Este capítulo elimina todos esos supuestos. Es largo a propósito. Nada de lo que aparece aquí es opcional: cada sección se referencia después, desde los capítulos técnicos.

El orden es de afuera hacia adentro:

1. Qué es un programa y qué es un proceso.
2. Cómo se comunican dos programas por red.
3. Qué es HTTP y cómo se ve una petición real.
4. Qué es REST y qué es JSON.
5. JavaScript: el lenguaje.
6. TypeScript: el lenguaje sobre el lenguaje.
7. Bases de datos relacionales y SQL.
8. El vocabulario del desarrollo web moderno.

---

## 1.2. Conceptos previos

### 1.2.1. Programa, proceso y entorno de ejecución

Un **programa** es un archivo con instrucciones. Está quieto en el disco; no hace nada.

Un **proceso** es un programa que el sistema operativo cargó en memoria y está ejecutando. El mismo programa puede tener varios procesos corriendo al mismo tiempo (por ejemplo, dos ventanas de un editor de texto).

Un proceso tiene:

- **Memoria propia y aislada.** Un proceso no puede leer ni escribir la memoria de otro proceso. Esto es una garantía del sistema operativo, no una convención. Por eso dos procesos que quieren compartir datos necesitan un mecanismo explícito: archivos, red, o memoria compartida declarada.
- **Un identificador (PID).** Un número que el sistema operativo asigna.
- **Un código de salida.** Un número que devuelve al terminar: `0` significa "todo bien", cualquier otro número significa "algo falló". En este proyecto aparece explícitamente en `backend/src/config/env.ts:46` (`process.exit(1)`) y en `backend/src/server.ts:18` (`process.exit(0)`).

Un **entorno de ejecución** (*runtime*) es un programa que sabe ejecutar otro tipo de archivo. JavaScript no se ejecuta solo: necesita un runtime que lo lea, lo compile y lo corra.

En este proyecto hay **dos runtimes de JavaScript distintos**, y esta distinción es una de las que más confusión genera:

| | **Node.js** | **El navegador** |
|:--|:--|:--|
| Dónde corre | En el servidor | En la computadora del usuario |
| Qué parte del proyecto | `backend/` | `frontend/` |
| Puede leer archivos del disco | Sí (`fs`) | No (salvo lo que el usuario elija subir) |
| Puede abrir puertos de red | Sí | No |
| Puede pintar píxeles en pantalla | No | Sí |
| Tiene `document` y `window` | No | Sí |
| Tiene `process` y `require` | Sí | No |

🔴 **Error frecuente.** Intentar usar `fs` (sistema de archivos) en el frontend, o `document` en el backend. El código compila si TypeScript no está bien configurado, pero explota en tiempo de ejecución. Por eso el proyecto tiene **dos `tsconfig.json` separados**, con la opción `lib` distinta en cada uno: `backend/tsconfig.json:6` declara `"lib": ["ES2022"]` (sin APIs del navegador), mientras que el frontend incluye `DOM`.

---

### 1.2.2. Cómo se comunican dos programas por red

Cuando el navegador del usuario y el servidor Node.js quieren hablar, no comparten memoria: están en computadoras distintas (o al menos en procesos distintos). Se comunican por **red**.

**Dirección IP.** Un número que identifica una máquina en una red. En desarrollo, la dirección `127.0.0.1` (alias: `localhost`) significa "esta misma máquina". Todo el desarrollo del proyecto ocurre contra `localhost`.

**Puerto.** Un número de 0 a 65535 que identifica *qué programa* dentro de esa máquina debe recibir el mensaje. Una IP sola no alcanza: en una máquina pueden correr veinte servidores. En este proyecto:

| Puerto | Quién escucha | Definido en |
|:--:|:--|:--|
| 3000 | La API del backend | `backend/.env.example:3` (`PORT=3000`), usado en `backend/src/server.ts:7` |
| 5173 | El servidor de desarrollo de Vite (frontend) | Valor por defecto de Vite; referenciado en `backend/.env.example:4` |
| 3306 | MySQL | Dentro de `DATABASE_URL`, `backend/.env.example:7` |

Un puerto solo puede estar ocupado por un proceso a la vez. Si se intenta levantar el backend dos veces, el segundo falla con `EADDRINUSE` (*address already in use*).

**Socket.** La combinación de IP + puerto, ya conectada. Es el "tubo" por donde viajan los bytes.

**TCP.** El protocolo que garantiza que los bytes llegan completos y en orden. HTTP se construye encima de TCP.

**DNS.** El sistema que traduce nombres (`api.empresa.com`) a direcciones IP. En desarrollo no interviene porque se usa `localhost` directamente.

```mermaid
graph LR
    A["Navegador<br/>proceso Chrome"] -- "TCP a<br/>127.0.0.1:3000" --> B["Node.js<br/>proceso backend"]
    B -- "TCP a<br/>127.0.0.1:3306" --> C["mysqld<br/>proceso MySQL"]

    style A fill:#e3f2fd,stroke:#1565c0
    style B fill:#e8f5e9,stroke:#2e7d32
    style C fill:#fff3e0,stroke:#ef6c00
```

💡 **Nota de diseño.** El navegador **nunca** habla directamente con MySQL. No podría aunque quisiera (no tiene acceso a sockets TCP arbitrarios), y no debería (las credenciales de la base estarían en el código que el usuario puede leer). El backend es el único que conoce la contraseña de la base de datos. Esta es la razón fundamental por la que existe un backend.

---

### 1.2.3. HTTP: el protocolo

**HTTP** (*HyperText Transfer Protocol*) es un protocolo de **petición y respuesta**: el cliente manda un mensaje, el servidor responde uno, y la conversación termina. El servidor no puede iniciar la conversación.

#### Anatomía de una petición

Una petición HTTP es **texto plano** con una estructura fija. Esta es una petición real de este sistema, tal como viaja por el cable:

```http
POST /api/v1/auth/login HTTP/1.1
Host: localhost:3000
Content-Type: application/json
Content-Length: 58
Origin: http://localhost:5173

{"email":"admin@empresa.com","password":"Admin1234!"}
```

Desglosada:

| Parte | Valor en el ejemplo | Qué significa |
|:--|:--|:--|
| **Método** | `POST` | El verbo: qué se quiere hacer. |
| **Ruta** | `/api/v1/auth/login` | Qué recurso. |
| **Versión** | `HTTP/1.1` | Qué dialecto del protocolo. |
| **Cabeceras** | `Host`, `Content-Type`, … | Metadatos: una por línea, formato `Nombre: valor`. |
| **Línea en blanco** | — | Separa cabeceras de cuerpo. **Obligatoria.** |
| **Cuerpo** | `{"email":…}` | Los datos. Opcional según el método. |

#### Los métodos HTTP

| Método | Semántica | ¿Tiene cuerpo? | ¿Es *seguro*? | ¿Es *idempotente*? | Uso en este proyecto |
|:--|:--|:--:|:--:|:--:|:--|
| `GET` | Leer un recurso | No | Sí | Sí | Listar viajes, ver un vehículo |
| `POST` | Crear, o ejecutar una acción | Sí | No | No | Login, crear viaje, asignar viaje |
| `PUT` | Reemplazar un recurso completo | Sí | No | Sí | No se usa en este proyecto |
| `PATCH` | Modificar parcialmente | Sí | No | No necesariamente | Editar vehículo, editar usuario |
| `DELETE` | Eliminar | No | No | Sí | Baja lógica de usuarios y vehículos |

- **Seguro** significa que no modifica nada en el servidor. Un `GET` se puede repetir mil veces sin consecuencias.
- **Idempotente** significa que ejecutarlo N veces deja el sistema en el mismo estado que ejecutarlo una vez. `DELETE /users/5` repetido deja al usuario 5 borrado: idempotente. `POST /trips` repetido crea tres viajes: no idempotente.

💡 **Decisión de diseño del proyecto.** Las transiciones de estado no son `PATCH` genéricos sino **acciones `POST` explícitas**: `POST /trips/:id/assign`, `POST /trips/:id/finish`. La justificación está en `docs/etapa-1-arquitectura.md:147`: *"las transiciones de estado son acciones POST explícitas, no PATCH genéricos: hace imposible saltarse las reglas de transición"*. Con un `PATCH {status: "COMPLETED"}` el cliente podría saltar de `PENDING_ASSIGNMENT` directo a `COMPLETED`; con `POST /finish` el servidor controla la transición.

#### Anatomía de una respuesta

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Set-Cookie: refreshToken=a1b2c3...; HttpOnly; Path=/api/v1/auth; SameSite=Lax
Content-Length: 187

{"data":{"accessToken":"eyJhbG...","user":{"id":1,"name":"Administrador General","role":"ADMIN"}}}
```

#### Los códigos de estado

El número de tres cifras clasifica la respuesta. La primera cifra da la familia:

| Familia | Significado | Códigos usados en este proyecto |
|:--:|:--|:--|
| **2xx** | Éxito | `200 OK`, `201 Created`, `204 No Content` |
| **3xx** | Redirección | (no se usan) |
| **4xx** | Error del cliente | `400`, `401`, `403`, `404`, `409`, `413`, `422`, `429` |
| **5xx** | Error del servidor | `500` |

Los que aparecen literalmente en el código del backend:

| Código | Nombre | Cuándo lo emite este sistema | Dónde está definido |
|:--:|:--|:--|:--|
| 400 | Bad Request | Entrada malformada | `shared/errors/app-error.ts:21` |
| 401 | Unauthorized | Falta el token o es inválido | `app-error.ts:27`, `middlewares/authenticate.ts:15` |
| 403 | Forbidden | Autenticado pero sin permiso de rol | `app-error.ts:33`, `middlewares/authorize.ts:16` |
| 404 | Not Found | El recurso no existe o está dado de baja | `app-error.ts:39` |
| 409 | Conflict | Conflicto de estado (vehículo no disponible, email duplicado) | `app-error.ts:45` |
| 413 | Payload Too Large | Archivo adjunto de más de 1 MB | `middlewares/error-handler.ts:40` |
| 422 | Unprocessable Entity | Violación de una regla de negocio RN-1..RN-22 | `app-error.ts:51` |
| 429 | Too Many Requests | Más de 10 intentos de login en 15 minutos | `middlewares/rate-limiter.ts:13` |
| 500 | Internal Server Error | Error inesperado, no previsto | `error-handler.ts:76` |

🔴 **Distinción importante entre 401 y 403.** *401* = "no sé quién sos" (falta identificarse). *403* = "sé quién sos, y no podés". Un chofer que intenta borrar un usuario recibe **403**, no 401: está perfectamente autenticado, simplemente no tiene permiso. Confundirlos es uno de los errores más comunes en APIs.

#### Cabeceras que importan en este proyecto

| Cabecera | Dirección | Para qué |
|:--|:--:|:--|
| `Authorization: Bearer <token>` | Cliente → Servidor | Lleva el access token JWT. Leída en `middlewares/authenticate.ts:13`. |
| `Content-Type: application/json` | Ambas | Declara que el cuerpo es JSON. |
| `Content-Type: multipart/form-data` | Cliente → Servidor | Declara que el cuerpo lleva archivos. Procesada por multer. |
| `Cookie` / `Set-Cookie` | Ambas | Transporte del refresh token. |
| `Origin` | Cliente → Servidor | Desde qué sitio se hace la petición. Base del control CORS. |
| `Access-Control-Allow-Origin` | Servidor → Cliente | Qué orígenes acepta el servidor. Configurado en `app.ts:31`. |

#### CORS, explicado

**CORS** (*Cross-Origin Resource Sharing*) es una restricción que **impone el navegador**, no el servidor.

Regla base del navegador: una página cargada desde `http://localhost:5173` **no puede** leer la respuesta de una petición a `http://localhost:3000`, porque son **orígenes distintos** (origen = esquema + host + puerto; basta que difiera uno).

Esto existe para que un sitio malicioso no pueda leer el correo del usuario haciendo peticiones a `gmail.com` con las cookies de la víctima.

Para permitirlo, el servidor debe responder explícitamente con la cabecera `Access-Control-Allow-Origin`. Eso hace el middleware `cors` en `app.ts:31`:

```ts
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
```

`origin: env.CORS_ORIGIN` vale `http://localhost:5173`. `credentials: true` es necesario para que el navegador acepte enviar y recibir cookies entre orígenes distintos — sin eso, el refresh token nunca llegaría.

🔴 **Error frecuente.** Poner `origin: '*'` (cualquier origen) junto con `credentials: true`. El navegador lo rechaza: la especificación prohíbe esa combinación precisamente porque sería equivalente a desactivar la protección.

---

### 1.2.4. REST

**REST** (*Representational State Transfer*) no es una tecnología ni una librería: es un **estilo de diseño** de APIs. Sus reglas prácticas:

1. **Todo es un recurso**, identificado por una URL. Los recursos son *sustantivos en plural*, no verbos: `/vehicles`, no `/getVehicles`.
2. **El método HTTP indica la operación.** `GET /vehicles` lista, `POST /vehicles` crea, `GET /vehicles/7` lee uno, `PATCH /vehicles/7` modifica, `DELETE /vehicles/7` borra.
3. **Sin estado (*stateless*).** Cada petición lleva toda la información necesaria. El servidor no recuerda nada entre peticiones. Por eso el token viaja en **cada** petición, no una sola vez al principio.
4. **Representación uniforme.** Todas las respuestas tienen la misma forma.

La convención de forma de respuesta de este proyecto está fijada en `docs/etapa-1-arquitectura.md:148`:

```jsonc
// Éxito
{ "data": { /* … */ }, "meta": { "page": 1, "limit": 10, "total": 42 } }

// Error
{ "error": { "code": "BUSINESS_RULE_VIOLATION", "message": "…", "details": [ /* … */ ] } }
```

💡 **Por qué envolver en `data`.** Si la respuesta fuera el objeto pelado, agregar metadatos (paginación, avisos) después rompería a todos los clientes. Con el envoltorio, `meta` se agrega sin tocar `data`. Es una decisión de *evolución del contrato*.

**Versionado.** Todas las rutas cuelgan de `/api/v1` (`app.ts:62`). Si en el futuro hay que cambiar la forma de una respuesta de manera incompatible, se crea `/api/v2` y ambas conviven mientras los clientes migran. Sin versionado, cualquier cambio incompatible rompe todas las apps instaladas de golpe.

---

### 1.2.5. JSON

**JSON** (*JavaScript Object Notation*) es un formato de texto para representar datos. Tiene exactamente seis tipos:

| Tipo | Ejemplo | Nota |
|:--|:--|:--|
| Objeto | `{"a": 1}` | Claves siempre entre comillas dobles. |
| Arreglo | `[1, 2, 3]` | Ordenado, heterogéneo. |
| String | `"hola"` | Comillas dobles obligatorias. |
| Número | `42`, `3.14` | Sin distinción entre entero y decimal. |
| Booleano | `true`, `false` | Minúsculas. |
| Nulo | `null` | — |

Lo que JSON **no tiene**, y que causa problemas concretos en este proyecto:

- **No tiene fechas.** Una fecha se serializa como string ISO 8601: `"2026-07-15T00:00:00.000Z"`. El receptor debe convertirla de vuelta. Todo el capítulo sobre `shared/utils/dates.ts` existe por esto.
- **No tiene enteros grandes.** El campo `AuditLog.id` es `BigInt` en la base de datos (`schema.prisma:265`). JavaScript no puede representar un `BigInt` en JSON sin conversión manual — este es un punto de fricción real que se analiza en el capítulo 15.
- **No tiene decimales exactos.** Los `Decimal` de la base (`avgKm`, `estimatedDistanceKm`) llegan como string o como número según la configuración, y hay que tratarlos con cuidado para no perder precisión.

⚙️ **Cómo funciona internamente.** `JSON.stringify(objeto)` recorre el objeto en profundidad y produce texto. `JSON.parse(texto)` hace lo inverso y produce objetos *nuevos* (no comparte referencias con nada). En Express, `express.json()` (`app.ts:32`) hace el `parse` automáticamente sobre el cuerpo de la petición y deja el resultado en `req.body`. Sin ese middleware, `req.body` sería `undefined`.

---

### 1.2.6. JavaScript: el lenguaje

#### Qué es y cómo se ejecuta

JavaScript es un lenguaje **interpretado y compilado a la vez**. El motor (V8 en Chrome y en Node.js) lee el código fuente, lo convierte a un formato intermedio (*bytecode*), lo ejecuta, y mientras lo ejecuta detecta las partes que se repiten mucho y las **recompila a código máquina nativo** (*JIT: Just-In-Time compilation*). Por eso JavaScript es mucho más rápido de lo que su reputación de "lenguaje de scripting" sugiere.

⚙️ **Detalle interno relevante.** V8 optimiza objetos que mantienen siempre la misma "forma" (*hidden classes*). Agregar propiedades a un objeto después de crearlo lo *desoptimiza*. Por eso el estilo del proyecto crea objetos completos de una vez, en lugar de irlos armando propiedad por propiedad.

#### Tipos primitivos

| Tipo | Valores | Detalle |
|:--|:--|:--|
| `number` | `42`, `3.14`, `NaN`, `Infinity` | **Todos** son coma flotante de 64 bits (IEEE 754). No hay enteros. Entero seguro máximo: 9.007.199.254.740.991. |
| `string` | `"texto"`, `'texto'`, `` `texto` `` | Inmutables. Codificación UTF-16. |
| `boolean` | `true`, `false` | — |
| `undefined` | `undefined` | "Esta variable existe pero no tiene valor asignado". |
| `null` | `null` | "Esta variable tiene explícitamente el valor 'nada'". |
| `bigint` | `9007199254740993n` | Enteros de precisión arbitraria. Sufijo `n`. |
| `symbol` | `Symbol('x')` | Identificadores únicos. No se usa en este proyecto. |

🔴 **`null` vs `undefined`.** La distinción importa mucho en este proyecto porque se mapea a la base de datos. En `schema.prisma`, un campo `DateTime?` (con signo de interrogación) puede ser `NULL` en MySQL, y Prisma lo devuelve como `null`. Un campo que simplemente no se seleccionó en la consulta llega como `undefined`. Confundirlos produce el bug clásico: `if (vehiculo.insuranceExpiryDate)` es `false` tanto si la fecha es `null` (no tiene seguro cargado) como si es `undefined` (no se pidió ese campo). Son situaciones distintas que requieren tratamientos distintos.

#### Declaración de variables

```js
const x = 1;   // No se puede reasignar x.
let y = 2;     // Se puede reasignar.
var z = 3;     // Forma antigua. NO se usa en este proyecto.
```

| | `const` | `let` | `var` |
|:--|:--|:--|:--|
| Reasignable | No | Sí | Sí |
| Alcance (*scope*) | Bloque `{}` | Bloque `{}` | Función completa |
| *Hoisting* utilizable antes de declarar | No (zona muerta) | No (zona muerta) | Sí (vale `undefined`) |
| Usado en el proyecto | Sí, por defecto | Sí, cuando hace falta | Nunca |

🔴 **`const` no significa inmutable.** `const arr = [1,2]; arr.push(3);` es perfectamente válido: lo que no se puede es hacer `arr = [4,5]`. `const` congela la *referencia*, no el *contenido*.

**Por qué el proyecto usa `const` por defecto.** Una variable que no se reasigna es una variable menos que rastrear mentalmente al leer una función. Cuando aparece un `let`, comunica "esto cambia, prestá atención".

#### Funciones

Hay tres formas de definir una función, y las tres aparecen en el proyecto:

```ts
// 1) Declaración de función — se puede usar antes de su definición (hoisting).
export function authenticate(req, res, next) { /* … */ }
//    middlewares/authenticate.ts:12

// 2) Expresión de función asignada a una constante.
const shutdown = async function (signal) { /* … */ };

// 3) Función flecha (arrow function).
const handler = (req, res, next) => { /* … */ };
//    middlewares/authorize.ts:10
```

**La diferencia crítica: `this`.**

Una función normal decide el valor de `this` **en el momento de la llamada**, según quién la llame. Una función flecha **no tiene `this` propio**: usa el del ámbito donde fue escrita, y ese valor queda fijo para siempre (*lexical this*).

```js
// — ejemplo ilustrativo, no está en el repositorio —
const obj = {
  nombre: 'A',
  normal() { return this.nombre; },       // 'A'  — this = obj
  flecha: () => this.nombre,              // undefined — this = ámbito exterior
};
```

En este proyecto casi todo son funciones flecha o funciones exportadas sin `this`, porque el estilo es **funcional, no orientado a objetos**. La única excepción son las clases de error (`shared/errors/app-error.ts`), donde `this` sí importa.

#### Cierres (*closures*)

Un **cierre** ocurre cuando una función "recuerda" las variables del ámbito donde fue creada, aunque ese ámbito ya haya terminado de ejecutarse.

Este es el mecanismo que hace funcionar el middleware `authorize`. Miremos el código real (`middlewares/authorize.ts:9-21`):

```ts
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!allowedRoles.includes(req.user.role)) { /* … */ }
  };
}
```

Cuando se escribe `authorize('ADMIN', 'OPERATOR')` en una ruta, la función `authorize` se ejecuta **una sola vez, al arrancar el servidor**, y termina. Pero la función flecha que devolvió sigue viva dentro del router de Express, y **sigue teniendo acceso a `allowedRoles`**, que era una variable local de una función que ya terminó.

⚙️ **Cómo funciona internamente.** El motor detecta que la función interna referencia `allowedRoles`, y en lugar de destruir ese ámbito al terminar `authorize`, lo mueve al *heap* (memoria dinámica) y lo mantiene mientras exista alguna referencia a la función interna. Es memoria que no se libera hasta que la función interna sea recolectada.

🔴 **Riesgo.** Un cierre que captura un objeto grande lo mantiene vivo indefinidamente. Es una fuente clásica de fugas de memoria. En este proyecto no ocurre: los cierres capturan solo arreglos de strings pequeños.

Este patrón —una función que devuelve otra función preconfigurada— se llama **fábrica** (*factory*). Aparece tres veces en el proyecto: `authorize()`, `validate()` (`middlewares/validate.ts:11`) y `createUploader()` (`middlewares/upload.ts:16`).

#### Objetos y desestructuración

```ts
const usuario = { id: 1, nombre: 'Ana', rol: 'ADMIN' };

// Acceso clásico
const id = usuario.id;

// Desestructuración: extrae varias propiedades de una
const { id, nombre } = usuario;

// Con renombre
const { id: userId } = usuario;

// Con valor por defecto (se aplica solo si la propiedad es undefined)
const { activo = true } = usuario;
```

En arreglos, la desestructuración es **posicional**. Ejemplo real, `shared/utils/crypto.ts:24`:

```ts
const [iv, authTag, ciphertext] = payload.split(':');
```

`split(':')` devuelve un arreglo de tres strings; la línea les da nombre a los tres de una sola vez. Sin desestructuración habría que escribir `const partes = payload.split(':'); const iv = partes[0]; …`.

#### Operador de propagación (*spread*) y *rest*

El mismo símbolo `...` hace dos cosas opuestas según dónde esté:

```ts
// SPREAD: expande — "desarmá esto acá"
const copia = { ...usuario, rol: 'OPERATOR' };  // copia todas las props y pisa rol
const unidos = [...arr1, ...arr2];

// REST: recolecta — "juntá todo lo que sobre acá"
function authorize(...allowedRoles: Role[]) { }   // authorize.ts:9
authorize('ADMIN', 'OPERATOR');                   // allowedRoles === ['ADMIN','OPERATOR']
```

🔴 **El spread de objetos es una copia superficial (*shallow*).** `{ ...usuario }` copia las propiedades de primer nivel. Si una propiedad es a su vez un objeto, se copia la *referencia*, no el objeto. Modificar el anidado afecta al original.

#### Operadores modernos que aparecen en el código

| Operador | Nombre | Qué hace | Ejemplo real |
|:--|:--|:--|:--|
| `?.` | Encadenamiento opcional | Si lo de la izquierda es `null`/`undefined`, devuelve `undefined` en vez de romper. | `header?.startsWith('Bearer ')` — `authenticate.ts:14` |
| `??` | Fusión nula (*nullish coalescing*) | Devuelve la derecha solo si la izquierda es `null` o `undefined`. | `env.SMTP_PORT ?? 587` — `mailer.ts:20` |
| `\|\|` | O lógico | Devuelve la derecha si la izquierda es *falsy*. | — |
| `??=` | Asignación nula | Asigna solo si es `null`/`undefined`. | — |

🔴 **`??` vs `||`: la diferencia que causa bugs reales.** Los valores *falsy* de JavaScript son: `false`, `0`, `""`, `null`, `undefined`, `NaN`. Con `||`, un puerto configurado como `0` o un nombre configurado como `""` serían reemplazados por el valor por defecto — casi nunca lo deseado. Con `??`, solo `null` y `undefined` disparan el reemplazo. Por eso `mailer.ts:20-21` usa `??`: si alguien configura `SMTP_SECURE=false` explícitamente, `env.SMTP_SECURE ?? false` respeta el `false`; con `||` daría igual, pero si el valor por defecto hubiera sido `true`, `||` lo habría pisado silenciosamente.

#### Asincronía: el corazón de Node.js

Este es el concepto más importante de la sección, y el que más se malinterpreta.

**El problema.** Node.js ejecuta JavaScript en **un solo hilo**. Si una operación tarda (leer un archivo, consultar la base de datos, esperar una respuesta de red), y el programa se quedara esperando, **todo el servidor se congelaría**: ninguna otra petición podría atenderse.

**La solución.** Las operaciones lentas no bloquean. Se *inician*, y el hilo sigue con otra cosa. Cuando la operación termina, se avisa.

##### Nivel 1: callbacks

La forma original. Se pasa una función que se ejecutará "cuando esté listo":

```js
// — ejemplo ilustrativo —
fs.readFile('a.txt', (error, contenido) => {
  if (error) return manejarError(error);
  console.log(contenido);
});
console.log('esto se imprime PRIMERO');
```

🔴 **El problema de los callbacks: el "infierno de callbacks".** Tres operaciones encadenadas producen tres niveles de anidación; diez producen código ilegible. Y el manejo de errores hay que repetirlo en cada nivel.

Sobrevive un callback en el proyecto, en `server.ts:16`:

```ts
server.close(async () => {
  await prisma.$disconnect();
  process.exit(0);
});
```

`server.close()` es una API antigua de Node que solo acepta callback.

##### Nivel 2: Promesas (*Promise*)

Una **Promesa** es un objeto que representa "un valor que todavía no está, pero va a estar". Tiene tres estados posibles, y una vez que sale de `pending` **nunca vuelve a cambiar**:

```mermaid
stateDiagram-v2
    [*] --> Pending: se crea la promesa
    Pending --> Fulfilled: resolve(valor)
    Pending --> Rejected: reject(error)
    Fulfilled --> [*]
    Rejected --> [*]
```

| Estado | Significado | Cómo se consume |
|:--|:--|:--|
| `pending` | Pendiente, en curso | — |
| `fulfilled` | Terminó bien, hay un valor | `.then(valor => …)` |
| `rejected` | Terminó mal, hay un error | `.catch(error => …)` |

Las promesas se **encadenan**, lo que aplana la anidación de los callbacks:

```ts
// prisma/seed.ts:367-373 — código real del proyecto
main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
```

- `main()` devuelve una promesa (es `async`).
- `.catch(...)` se ejecuta solo si esa promesa se rechaza.
- `.finally(...)` se ejecuta **siempre**, haya salido bien o mal. Aquí garantiza que la conexión a la base se cierre incluso si el seed falló a la mitad. Sin ese `finally`, el proceso quedaría colgado con una conexión abierta.
- `void` delante de la expresión descarta explícitamente el valor devuelto. Es una señal para el lector y para el analizador estático: *"sé que esto devuelve una promesa y estoy decidiendo ignorarla"*.

##### Nivel 3: `async` / `await`

Azúcar sintáctico sobre promesas. Permite escribir código asíncrono que **se lee** como código secuencial.

```ts
// shared/utils/files.ts:16-27 — código real
export async function storeFile(
  subfolder: string,
  originalName: string,
  buffer: Buffer,
): Promise<StoredFile> {
  const dir = path.join(UPLOAD_ROOT, subfolder);
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(originalName).toLowerCase();
  const filePath = path.join(dir, `${randomUUID()}${ext}`);
  await fs.writeFile(filePath, buffer);
  return { filePath };
}
```

Las reglas:

1. `async` delante de una función hace que **siempre** devuelva una promesa, aunque el `return` sea un valor común. Por eso el tipo de retorno es `Promise<StoredFile>` y no `StoredFile`.
2. `await` solo se puede usar dentro de una función `async`.
3. `await promesa` **pausa esa función** hasta que la promesa se resuelva, y devuelve su valor. **No bloquea el hilo**: mientras esta función está pausada, Node atiende otras peticiones.
4. Si la promesa se rechaza, `await` **lanza** el error, y se puede capturar con `try`/`catch` normal.

⚙️ **Qué pasa realmente en memoria.** Cuando el motor encuentra un `await`, guarda el estado completo de la función (variables locales, punto de ejecución) en el *heap*, libera la pila de llamadas, y registra una continuación. Cuando la promesa se resuelve, la continuación se encola en la *microtask queue*, y el event loop la retoma en el próximo ciclo. La función "reanuda" exactamente donde estaba, con todas sus variables intactas.

##### El event loop

```mermaid
graph TB
    A["Pila de llamadas<br/>(Call Stack)"] -->|"al vaciarse"| B{Event Loop}
    B -->|"1º: prioridad máxima"| C["Cola de microtareas<br/>(promesas resueltas)"]
    B -->|"2º"| D["Timers<br/>(setTimeout, setInterval)"]
    B -->|"3º"| E["Cola de macrotareas<br/>(I/O: red, disco, BD)"]
    C --> A
    D --> A
    E --> A

    style B fill:#e8f5e9,stroke:#2e7d32
    style C fill:#fff3e0,stroke:#ef6c00
```

El bucle es simple: mientras haya algo en la pila, ejecutalo. Cuando la pila se vacía, **vaciá completamente** la cola de microtareas, después atendé una macrotarea, y volvé a empezar.

🔴 **La consecuencia práctica.** Un cálculo pesado y **síncrono** (un bucle de un millón de iteraciones, un `JSON.parse` de 50 MB, un hash bcrypt con muchas rondas) **sí bloquea todo el servidor**, porque ocupa la pila y el event loop no puede avanzar. La asincronía de Node ayuda con la **espera** (I/O), no con el **cómputo**. Por eso `prisma/seed.ts:19` usa `BCRYPT_ROUNDS = 10` y no 15: cada ronda adicional duplica el tiempo de CPU, y bcrypt es síncrono en su núcleo.

#### Módulos: `import` y `export`

Un **módulo** es un archivo. Todo lo que declara es **privado** salvo que lo exporte explícitamente.

```ts
// Exportación con nombre (named export) — el estilo dominante en este proyecto
export const prisma = new PrismaClient({ adapter });     // database/prisma-client.ts:13
export function authenticate(req, res, next) { }         // middlewares/authenticate.ts:12

// Importación con nombre — los nombres deben coincidir exactamente
import { prisma } from './database/prisma-client';
import { env, isProduction } from './config/env';        // app.ts:6

// Exportación por defecto — como máximo una por archivo
export default defineConfig({ /* … */ });                // vitest.config.ts:8

// Importación por defecto — el nombre lo elige quien importa
import express from 'express';                           // app.ts:1

// Importación solo de tipos — se borra al compilar, no genera código
import type { NextFunction, Request, Response } from 'express';
//    middlewares/authenticate.ts:1
```

💡 **Por qué el proyecto prefiere exportaciones con nombre.** Con `export default`, cada archivo que importa puede ponerle el nombre que quiera, y el mismo módulo termina llamándose distinto en distintos lugares. Con exportaciones nombradas, el nombre es único y global, el renombrado automático del editor funciona, y las herramientas pueden detectar código muerto.

⚙️ **Resolución de módulos.** Cuando Node lee `import { env } from './config/env'`, busca `./config/env.ts`, `./config/env.js`, `./config/env/index.ts`… en ese orden. Si la ruta no empieza con `.` o `/` (por ejemplo `import express from 'express'`), busca en `node_modules/`, subiendo por el árbol de directorios hasta la raíz.

**Importaciones circulares.** Si `a.ts` importa `b.ts` y `b.ts` importa `a.ts`, uno de los dos recibe un módulo a medio inicializar. Es una fuente de errores del tipo *"Cannot access 'X' before initialization"*. Este proyecto las evita por construcción: las dependencias van siempre en una sola dirección (rutas → controlador → servicio → repositorio → Prisma), nunca hacia atrás.

#### Clases, herencia, `abstract`

Aunque el proyecto es mayormente funcional, usa clases para los errores. Código real (`shared/errors/app-error.ts:6-17`):

```ts
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

Conceptos que aparecen aquí:

- **Clase**: una plantilla para crear objetos con estado y comportamiento.
- **`abstract`**: no se puede instanciar directamente (`new AppError(...)` es un error de compilación). Solo sirve como base. Y sus miembros `abstract` **obligan** a cada subclase a definirlos.
- **`extends Error`**: **herencia**. `AppError` obtiene todo lo de `Error` (la propiedad `message`, el `stack` de llamadas) y agrega lo suyo.
- **`super(message)`**: llama al constructor de la clase padre. **Obligatorio** antes de usar `this` en una subclase.
- **`readonly details?: unknown` en el constructor**: TypeScript tiene un atajo llamado *parameter property*. Poner un modificador (`readonly`, `public`, `private`) en un parámetro del constructor lo convierte automáticamente en propiedad de la instancia. Sin ese atajo habría que escribir `this.details = details;` a mano.
- **`this.constructor.name`**: devuelve el nombre de la clase *real* del objeto en tiempo de ejecución. Si se crea un `NotFoundError`, esto vale `"NotFoundError"`, no `"AppError"`. Esto es **polimorfismo** en acción.

**Polimorfismo, concretamente.** El manejador global de errores (`middlewares/error-handler.ts:19-23`) escribe:

```ts
if (err instanceof AppError) {
  res.status(err.statusCode).json({ error: { code: err.code, ... } });
}
```

No pregunta *qué tipo* de error es. Pregunta si *es un* `AppError`, y confía en que cada subclase sabe cuál es su `statusCode`. Agregar un nuevo tipo de error (por ejemplo `TooManyRequestsError` con `statusCode = 429`) **no requiere tocar el manejador**. Esto es el **Principio Abierto/Cerrado** de SOLID, aplicado en 5 líneas.

**Alternativas descartadas y por qué:**

| Alternativa | Por qué no |
|:--|:--|
| Devolver objetos `{ ok: false, error }` en vez de lanzar | Obliga a comprobar el resultado en cada nivel; un olvido pasa desapercibido. Con excepciones, el error sube solo hasta el manejador. |
| Un solo tipo de error con un campo `tipo` | Cada nuevo tipo obliga a agregar un `case` en el `switch` del manejador. No escala. |
| Códigos de error numéricos sin clases | Se pierde el `stack trace` y el tipado. |

---

### 1.2.7. TypeScript

#### Qué es

TypeScript es JavaScript **más un sistema de tipos**. Los tipos:

- se escriben en el código fuente;
- se verifican al **compilar**;
- **desaparecen por completo** en el archivo JavaScript resultante.

🔴 **Consecuencia crítica que hay que interiorizar.** TypeScript **no valida nada en tiempo de ejecución**. Si el frontend envía `{ "year": "no soy un número" }` y el backend declara `year: number`, TypeScript no lo detecta: el tipo era una promesa sobre lo que el programador creía, no una comprobación real.

**Por eso existe Zod en este proyecto.** Zod valida en tiempo de ejecución lo que TypeScript solo promete en tiempo de compilación. La combinación de ambos —tipo estático + validación dinámica, derivados de la *misma* definición— es una de las decisiones de diseño centrales del backend (`docs/etapa-1-arquitectura.md:48`), y se explica a fondo en el capítulo 6.

#### Anotaciones de tipo

```ts
const puerto: number = 3000;
function saludar(nombre: string): string { return `Hola ${nombre}`; }
function log(msg: string): void { console.log(msg); }   // void = no devuelve nada
```

**Inferencia.** Casi siempre no hace falta anotar: TypeScript deduce el tipo.

```ts
const puerto = 3000;        // TypeScript infiere: number
const nombres = ['a','b'];  // infiere: string[]
```

💡 **Convención del proyecto.** No se anotan las variables locales (la inferencia basta y el código queda limpio), pero **sí se anota siempre el tipo de retorno de las funciones exportadas**. Ver `middlewares/authenticate.ts:12` (`: void`), `shared/utils/files.ts:20` (`: Promise<StoredFile>`). Razón: el tipo de retorno explícito es un contrato. Si alguien modifica el cuerpo de la función y cambia sin querer lo que devuelve, el compilador falla *en esa función*, no a 40 archivos de distancia donde se usa.

#### Tipos compuestos

```ts
type Estado = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';  // unión de literales
type Quizas = string | null;                             // unión
type ConId = { id: number } & { nombre: string };         // intersección
type Lista = string[];                                    // arreglo
type Par = [string, number];                              // tupla (longitud y tipos fijos)
```

Las **uniones de literales** son la herramienta más valiosa aquí. Declarar `status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'` hace que escribir `status = 'PENDIENTE'` sea un error de compilación. Los 7 `enum` de `schema.prisma` se convierten automáticamente en tipos así.

#### `interface` vs `type`

```ts
interface JwtPayload { sub: number; role: Role; }   // shared/types/auth.ts:4
type JwtPayload = { sub: number; role: Role; };     // equivalente en este caso
```

| | `interface` | `type` |
|:--|:--|:--|
| Describe objetos | Sí | Sí |
| Uniones (`A \| B`) | No | Sí |
| Se puede extender (`extends`) | Sí | Con `&` |
| *Declaration merging* (dos declaraciones se fusionan) | **Sí** | No |
| Mensajes de error del compilador | Más legibles | Pueden expandirse mucho |

El *declaration merging* de las interfaces se usa deliberadamente en este proyecto, en `shared/types/auth.ts:16-23`:

```ts
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
```

Esto es **aumentación de módulo** (*module augmentation*). Express define su propia `interface Request`. Este bloque agrega una propiedad `user` a esa interfaz **ya existente**, sin modificar el código de Express. A partir de aquí, en todo el proyecto, `req.user` está tipado. Con `type` esto sería imposible.

- `declare global` significa "lo que sigue afecta al ámbito global, no solo a este archivo".
- `user?` con `?` la marca **opcional**: es `AuthenticatedUser | undefined`. Correcto, porque en las rutas públicas (login) no hay usuario. Esto obliga a comprobar `if (!req.user)` antes de usarla — exactamente lo que hace `middlewares/authorize.ts:11`.

#### Genéricos

Un **genérico** es un tipo parametrizado: una plantilla donde el tipo concreto se decide en el punto de uso.

```ts
// shared/schemas.ts:16-19 — código real
export interface PaginatedResult<T> {
  items: T[];
  total: number;
}
```

`T` es una variable de tipo. `PaginatedResult<Vehicle>` produce `{ items: Vehicle[]; total: number }`. `PaginatedResult<Trip>` produce `{ items: Trip[]; total: number }`.

**Qué problema resuelve.** Sin genéricos habría que escribir `PaginatedVehicles`, `PaginatedTrips`, `PaginatedUsers`… trece veces, una por módulo. O usar `items: any[]` y perder todo el tipado. El genérico da una sola definición **y** tipado exacto en cada uso.

`Promise<T>` es el genérico más usado: `Promise<StoredFile>` significa "una promesa que, al resolverse, produce un `StoredFile`".

#### `unknown`, `any` y `never`

| Tipo | Significa | Se puede usar sin comprobar |
|:--|:--|:--:|
| `any` | "No verifiques nada" | Sí — 🔴 desactiva el compilador |
| `unknown` | "No sé qué es, averigualo antes de usarlo" | **No** |
| `never` | "Este valor no puede existir" | — |

`unknown` aparece en dos lugares clave del proyecto:

```ts
readonly details?: unknown              // app-error.ts:12
export function errorHandler(err: unknown, ...)  // error-handler.ts:14
```

En `errorHandler`, `err` es `unknown` porque en JavaScript **se puede lanzar cualquier cosa**: `throw 42`, `throw "texto"`, `throw null`. Declararlo `Error` sería mentir. Al declararlo `unknown`, TypeScript **obliga** a comprobar el tipo antes de tocarlo — y por eso el archivo está lleno de `err instanceof X`. El tipado hace obligatorio el código defensivo correcto.

#### Estrechamiento de tipos (*narrowing*)

TypeScript sigue el flujo de control y **recuerda** lo que se comprobó:

```ts
function f(x: string | number) {
  if (typeof x === 'string') {
    x.toUpperCase();   // acá TypeScript sabe que x es string
  } else {
    x.toFixed(2);      // acá sabe que es number
  }
}
```

Las formas de estrechar usadas en el proyecto:

| Forma | Ejemplo real |
|:--|:--|
| `typeof` | — |
| `instanceof` | `err instanceof AppError` — `error-handler.ts:19` |
| Comprobación de verdad | `if (!req.user) { … return; }` — `authorize.ts:11` |
| `in` | — |
| Comprobación de nulidad | `if (!iv \|\| !authTag \|\| !ciphertext)` — `crypto.ts:25` |

#### Aserciones de tipo

```ts
const payload = jwt.verify(token, secret) as unknown as JwtPayload;
//    middlewares/authenticate.ts:20
```

`as` le dice al compilador "confiá en mí, esto es de este tipo". **No hace ninguna comprobación.** El doble `as unknown as X` es un truco necesario cuando los dos tipos no se solapan lo suficiente para que TypeScript acepte la conversión directa: primero se "olvida" el tipo original (`as unknown`), después se afirma el nuevo.

🔴 **Esto es una mentira potencial.** Si el token contuviera `{ userId: 5 }` en vez de `{ sub: 5 }`, `payload.sub` sería `undefined` en tiempo de ejecución y TypeScript no diría nada. Es seguro en este caso solo porque el mismo sistema firma y verifica el token, con el mismo secreto — es decir, la garantía viene de la criptografía, no del tipo. Se analiza a fondo en el capítulo 8, y en el capítulo 25 se propone reemplazarlo por una validación Zod del payload.

#### Opciones del compilador en este proyecto

`backend/tsconfig.json`, línea por línea:

| Línea | Opción | Qué hace | Por qué |
|:--:|:--|:--|:--|
| 3 | `"target": "ES2022"` | Nivel de JavaScript que genera. | Node 20 soporta ES2022 nativamente: no hace falta transpilar `async/await` ni clases. |
| 4-5 | `"module"/"moduleResolution": "nodenext"` | Sistema de módulos y cómo resolverlos. | Modo moderno de Node, con soporte de ESM y CommonJS mezclados. |
| 6 | `"lib": ["ES2022"]` | Qué APIs globales existen. | **Sin `DOM`**: usar `document` o `window` en el backend es error de compilación. |
| 7 | `"outDir": "dist"` | Dónde deja el JavaScript compilado. | Separa fuente de artefacto; `dist/` está en `.gitignore`. |
| 9 | `"strict": true` | Activa todas las comprobaciones estrictas de golpe. | La más importante: incluye `strictNullChecks`, que hace que `string` y `string \| null` sean tipos distintos. Sin esto, la mitad del valor de TypeScript se pierde. |
| 10 | `"noUncheckedIndexedAccess": true` | `arr[0]` tiene tipo `T \| undefined`, no `T`. | Fuerza a comprobar antes de usar. Es la razón directa de la comprobación en `crypto.ts:25`: sin esta opción, `iv` sería `string` y nadie comprobaría. |
| 11 | `"noImplicitOverride": true` | Sobrescribir un método del padre requiere la palabra `override`. | Evita sobrescribir sin darse cuenta al renombrar. |
| 12 | `"esModuleInterop": true` | Permite `import x from 'cjs-module'`. | Necesario para librerías CommonJS antiguas como `express`. |
| 13 | `"forceConsistentCasingInFileNames": true` | `./Env` y `./env` son distintos. | macOS y Windows no distinguen mayúsculas; Linux sí. Sin esto, el código compila en la laptop y falla en el servidor. |
| 14 | `"skipLibCheck": true` | No verifica los `.d.ts` de `node_modules`. | Ahorra mucho tiempo de compilación; los tipos de terceros no son responsabilidad del proyecto. |
| 15 | `"resolveJsonModule": true` | Permite `import datos from './x.json'`. | — |
| 16 | `"sourceMap": true` | Genera mapas de código fuente. | Sin esto, un error en producción apunta a la línea del JavaScript compilado, no a la del TypeScript original. Depurar sería casi imposible. |

---

### 1.2.8. Bases de datos relacionales y SQL

#### El modelo relacional

Una base de datos **relacional** organiza la información en **tablas**. Cada tabla tiene:

- **Columnas** (o campos, o atributos): definen *qué* se guarda y de qué tipo.
- **Filas** (o registros, o tuplas): cada una es una cosa concreta.

Ejemplo de la tabla `vehicles` de este proyecto:

| id | license_plate | model | year | accumulated_km | status |
|:--|:--|:--|:--|:--|:--|
| 1 | AAA111 | Mercedes-Benz Sprinter | 2021 | 45000 | AVAILABLE |
| 2 | BBB222 | Iveco Daily | 2019 | 95000 | AVAILABLE |
| 3 | CCC333 | Ford Transit | 2018 | 120000 | INACTIVE |

#### Clave primaria (*Primary Key*)

Una columna (o combinación) que identifica **unívocamente** cada fila. No puede repetirse ni ser nula.

En este proyecto casi todas las tablas usan un `id` numérico autoincremental como clave primaria (`AUTO_INCREMENT`): la base asigna 1, 2, 3… sola. Es una **clave sustituta** (*surrogate key*): un número sin significado de negocio.

💡 **Por qué una clave sustituta y no la patente del vehículo.** Porque los datos de negocio cambian. Una patente se puede corregir si se cargó mal; un DNI se puede reasignar por error. Si la patente fuera la clave primaria, corregirla obligaría a actualizar en cascada todas las tablas que la referencian. Con un `id` sin significado, el identificador nunca cambia.

**La excepción reveladora.** La tabla `drivers` tiene como clave primaria `user_id` (`schema.prisma:104`), que es a la vez clave foránea a `users`. Esto se llama **clave primaria compartida**, y modela una relación **1 a 1**: cada chofer *es* un usuario. Se explica en detalle en el capítulo 3.

#### Clave foránea (*Foreign Key*)

Una columna que apunta a la clave primaria de otra tabla. Es lo que crea las **relaciones**.

```sql
-- migration.sql:235 — código real del proyecto
ALTER TABLE `trips`
  ADD CONSTRAINT `fk_trips_driver`
  FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`user_id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

La base **garantiza** que `trips.driver_id` siempre contiene un `drivers.user_id` que existe. Es imposible tener un viaje que apunte a un chofer inexistente. Esto se llama **integridad referencial**.

**Qué pasa al borrar el padre** — lo define `ON DELETE`:

| Opción | Comportamiento | Dónde se usa aquí |
|:--|:--|:--|
| `RESTRICT` | **Prohíbe** borrar si hay hijos. | La mayoría: `trips`, `drivers`, `maintenances`, `audit_logs`. |
| `CASCADE` | Borra los hijos también. | `refresh_tokens` (si se borra el usuario) y `maintenance_attachments` (si se borra el mantenimiento). |
| `SET NULL` | Pone `NULL` en el hijo. | No se usa. |

💡 **La decisión de diseño detrás de esto.** `RESTRICT` en casi todo es deliberado: es lo que **impide destruir la historia**. No se puede borrar un chofer que hizo viajes, porque esos viajes son el registro histórico de la empresa. `CASCADE` solo se usa donde el hijo no tiene sentido sin el padre: un refresh token de un usuario borrado no le sirve a nadie, y un comprobante de un mantenimiento borrado tampoco.

🔴 **Qué pasaría si se cambiara `RESTRICT` por `CASCADE` en `fk_trips_driver`.** Dar de baja un chofer borraría silenciosamente todos sus viajes. Los reportes históricos cambiarían retroactivamente. La auditoría apuntaría a viajes inexistentes. Es un cambio de una palabra con consecuencias catastróficas e irreversibles.

#### Índices

Un **índice** es una estructura auxiliar que la base mantiene para encontrar filas rápido, sin recorrer la tabla entera.

**Analogía.** Buscar "Pérez" en una guía telefónica ordenada alfabéticamente lleva segundos. En una lista desordenada de un millón de nombres, hay que leerlos todos. El orden alfabético es el índice.

⚙️ **Cómo funciona internamente.** MySQL (motor InnoDB) implementa los índices como **árboles B+**: una estructura de árbol equilibrado donde cada nodo contiene muchas claves ordenadas. Buscar un valor entre un millón requiere unos 3 saltos en lugar de un millón de comparaciones. Complejidad: O(log n) en vez de O(n).

**El costo.** Cada índice ocupa espacio en disco y **hace más lentas las escrituras**: cada `INSERT`, `UPDATE` o `DELETE` debe actualizar todos los índices de la tabla. Por eso no se indexa todo: se indexa lo que se consulta.

En este proyecto hay 20 índices declarados. Ejemplos con su justificación:

| Índice | Tabla | Por qué existe |
|:--|:--|:--|
| `uq_users_email` | `users` | **Único**: garantiza que no haya dos usuarios con el mismo email, *y* acelera el login (que busca por email). |
| `idx_trips_driver_status` | `trips` | **Compuesto** `(driver_id, status)`: la consulta "¿este chofer tiene un viaje en curso?" se responde con una sola lectura del índice, sin tocar la tabla. Es la comprobación central de la regla RN-19. |
| `idx_drivers_license_expiry` | `drivers` | El motor de alertas recorre todos los choferes buscando licencias que vencen pronto. Sin este índice, sería un recorrido completo de la tabla en cada evaluación. |
| `idx_alerts_status_raised` | `alerts` | Listar alertas pendientes ordenadas por fecha: el índice ya las tiene filtradas y ordenadas. |

🔴 **En un índice compuesto, el orden de las columnas importa.** `(driver_id, status)` sirve para buscar por `driver_id` solo, o por `driver_id` **y** `status`. **No** sirve para buscar solo por `status` — para eso hace falta otro índice. Es el mismo principio que la guía telefónica: ordenada por (apellido, nombre) sirve para buscar "todos los Pérez", pero no para "todos los que se llaman Juan".

#### Tipos de datos usados en este proyecto

| Tipo SQL | Tamaño | Rango / formato | Dónde |
|:--|:--|:--|:--|
| `INTEGER UNSIGNED` | 4 bytes | 0 a 4.294.967.295 | Todos los `id`, `accumulated_km`, `file_size` |
| `BIGINT UNSIGNED` | 8 bytes | 0 a 18.4 trillones | `audit_logs.id` |
| `SMALLINT UNSIGNED` | 2 bytes | 0 a 65.535 | `vehicles.year` |
| `TINYINT UNSIGNED` | 1 byte | 0 a 255 | `maintenance_types.months_alert`, `company_settings.id` |
| `VARCHAR(n)` | variable | Hasta n caracteres | Nombres, emails, patentes |
| `CHAR(64)` | fijo, 64 | Exactamente 64 caracteres | `refresh_tokens.token_hash` (un SHA-256 en hexadecimal mide siempre 64) |
| `TEXT` | variable | Hasta 65.535 bytes | `notes` |
| `DATE` | 3 bytes | Solo fecha, sin hora | Vencimientos: licencia, seguro, documentos |
| `DATETIME(3)` | 8 bytes | Fecha y hora con milisegundos | Timestamps: `created_at`, `departure_at` |
| `DECIMAL(10,2)` | variable | 10 dígitos, 2 decimales, **exacto** | `avg_km`, `estimated_distance_km` |
| `ENUM(...)` | 1-2 bytes | Uno de una lista cerrada | Todos los estados |
| `JSON` | variable | Documento JSON validado | `audit_logs.previous_data`, `new_data` |
| `BOOLEAN` | 1 byte | En MySQL es un alias de `TINYINT(1)` | `is_active`, `revoked` |

💡 **Por qué `DECIMAL` y no `FLOAT` para los kilómetros promedio.** `FLOAT` y `DOUBLE` son coma flotante binaria: no pueden representar exactamente valores como 0.1. `0.1 + 0.2` da `0.30000000000000004`. Para distancias promedio ese error es tolerable, pero la convención del proyecto es usar `DECIMAL` en todo valor numérico con decimales que se muestre al usuario, porque **el error se acumula** al sumar miles de filas en un reporte.

💡 **Por qué `DATE` y no `DATETIME` para los vencimientos.** Una licencia vence "el 15 de julio", no "el 15 de julio a las 00:00:00 de la zona horaria X". Usar `DATE` elimina la ambigüedad horaria del dato en sí. Pero la reintroduce al leerlo desde JavaScript, que solo tiene `Date` (que siempre incluye hora). Ese es exactamente el problema que resuelve `shared/utils/dates.ts`, y por eso ese archivo tiene 10 líneas de comentario explicativo para 6 líneas de código.

💡 **Por qué `UNSIGNED` en todos los enteros.** Duplica el rango positivo con el mismo espacio, y —más importante— convierte "kilómetros negativos" en un error de la base de datos, no en un dato corrupto que alguien descubre tres meses después.

#### Nulabilidad

Una columna es `NOT NULL` (obligatoria) o `NULL` (opcional). No es una decisión menor: **es la definición del modelo de negocio**.

Comparando `trips`:

```sql
`destination`  VARCHAR(120)      NOT NULL,   -- todo viaje tiene destino, siempre
`driver_id`    INTEGER UNSIGNED  NULL,       -- un viaje puede no tener chofer todavía
`arrival_km`   INTEGER UNSIGNED  NULL,       -- solo se conoce al finalizar
```

`driver_id NULL` **es** la representación del estado `PENDING_ASSIGNMENT`. Si fuera `NOT NULL`, sería imposible crear un viaje sin asignarlo — y ese es justamente el flujo de trabajo del sistema: el operador planifica primero, asigna después.

#### Normalización

La **normalización** es el proceso de organizar las tablas para que cada dato viva en un solo lugar.

| Forma normal | Regla | Cómo la cumple este proyecto |
|:--|:--|:--|
| **1FN** | Cada celda contiene un solo valor atómico; no hay grupos repetidos. | Ninguna columna guarda listas. Los documentos de un chofer están en una tabla aparte (`driver_documents`), no en una columna `documentos` con texto separado por comas. |
| **2FN** | 1FN + toda columna no clave depende de la clave **completa**. | Se cumple trivialmente: todas las claves primarias son de una sola columna. |
| **3FN** | 2FN + ninguna columna no clave depende de otra columna no clave. | `maintenances` guarda `maintenance_type_id`, no el nombre y la descripción del tipo. Cambiar el nombre de un tipo de mantenimiento actualiza automáticamente todos los mantenimientos. |

**La desnormalización deliberada.** `drivers` tiene dos columnas que violan 3FN a propósito (`schema.prisma:109-110`):

```prisma
completedTrips Int     @default(0) @map("completed_trips")
avgKm          Decimal @default(0) @map("avg_km")
```

Ambos valores **se pueden calcular** desde `trips`. Guardarlos duplica información, y crea el riesgo de que queden desincronizados (de hecho, el seed tiene que actualizarlos a mano en `seed.ts:286-287`).

Se hace igual porque estos dos números aparecen en el listado de choferes, que se consulta constantemente. Calcularlos al vuelo implicaría un `COUNT` y un `AVG` sobre `trips` **por cada fila** del listado. Es el clásico intercambio: **rendimiento de lectura a cambio de complejidad de escritura**. La contrapartida es que el servicio de viajes tiene la obligación de mantenerlos coherentes al finalizar cada viaje — y si alguien modifica `trips` sin pasar por ese servicio, los números mienten.

#### SQL básico

**SQL** (*Structured Query Language*) es el lenguaje de las bases relacionales. Se divide en:

- **DDL** (*Data Definition Language*): define la estructura. `CREATE TABLE`, `ALTER TABLE`, `DROP TABLE`. Es lo que contiene `migration.sql`.
- **DML** (*Data Manipulation Language*): manipula los datos. `SELECT`, `INSERT`, `UPDATE`, `DELETE`.

```sql
-- Leer
SELECT id, license_plate, status FROM vehicles WHERE status = 'AVAILABLE' ORDER BY id LIMIT 10;

-- Insertar
INSERT INTO vehicles (license_plate, model, year, initial_km, accumulated_km)
VALUES ('FFF666', 'Fiat Ducato', 2023, 0, 0);

-- Actualizar
UPDATE vehicles SET status = 'ON_TRIP' WHERE id = 1;

-- Borrar
DELETE FROM vehicles WHERE id = 99;

-- Combinar tablas (JOIN)
SELECT t.id, t.destination, u.name AS chofer
FROM trips t
INNER JOIN drivers d ON d.user_id = t.driver_id
INNER JOIN users   u ON u.id = d.user_id
WHERE t.status = 'IN_PROGRESS';
```

**Tipos de `JOIN`:**

| Tipo | Devuelve |
|:--|:--|
| `INNER JOIN` | Solo las filas que tienen correspondencia en ambas tablas. |
| `LEFT JOIN` | Todas las de la izquierda; `NULL` donde no hay correspondencia. |
| `RIGHT JOIN` | Simétrico del anterior. |
| `FULL OUTER JOIN` | Todas de ambos lados. **MySQL no lo soporta.** |

🔴 **En este proyecto casi no se escribe SQL a mano.** Prisma genera las consultas. Pero entender SQL es indispensable para leer el `EXPLAIN` de una consulta lenta y saber si está usando el índice. El capítulo 25 incluye una sección sobre esto.

#### Transacciones

Una **transacción** agrupa varias operaciones en una unidad atómica: **o se aplican todas, o ninguna**.

El caso real del proyecto: finalizar un viaje implica cuatro escrituras:

1. `trips`: estado → `COMPLETED`, `arrival_km`, `finished_at`, `finished_by_id`.
2. `vehicles`: `accumulated_km` += km recorridos, estado → `AVAILABLE`.
3. `drivers`: `completed_trips` += 1, recalcular `avg_km`.
4. `audit_logs`: insertar el registro de auditoría.

Sin transacción, un corte de luz entre el paso 1 y el 2 dejaría el viaje finalizado pero el vehículo marcado como "en viaje" para siempre: un vehículo fantasma que ningún otro viaje puede usar y que ninguna pantalla explica.

Las transacciones cumplen las propiedades **ACID**:

| Propiedad | Significado |
|:--|:--|
| **A**tomicidad | Todo o nada. |
| **C**onsistencia | La base pasa de un estado válido a otro estado válido; las restricciones se respetan. |
| **I**slamiento | Las transacciones concurrentes no se ven a medio hacer entre sí. |
| **D**urabilidad | Una vez confirmada (*commit*), sobrevive a un corte de energía. |

En Prisma se expresa con `prisma.$transaction(async (tx) => { … })`. Todas las operaciones que usen `tx` en lugar de `prisma` van en la misma transacción. Se detalla en el capítulo 12.

---

### 1.2.9. Vocabulario del desarrollo web moderno

| Término | Definición |
|:--|:--|
| **SPA** (*Single Page Application*) | Aplicación web donde el navegador carga una sola página HTML y el JavaScript va cambiando el contenido sin recargar. Este es el modelo del frontend. |
| **MPA** (*Multi Page Application*) | Modelo clásico: cada clic pide una página HTML nueva al servidor. |
| **Bundler** | Herramienta que toma cientos de archivos fuente y produce unos pocos archivos optimizados para el navegador. Aquí: Vite. |
| **Transpilar** | Traducir de un lenguaje a otro del mismo nivel (TypeScript → JavaScript). |
| **Middleware** | Función que se ejecuta *entre* la llegada de una petición y su respuesta. Concepto central de Express; capítulo 7. |
| **ORM** (*Object-Relational Mapping*) | Librería que traduce entre objetos del lenguaje y filas de una base relacional. Aquí: Prisma. |
| **Migración** | Archivo versionado que describe un cambio en la estructura de la base de datos. |
| **Seed** | Script que carga datos iniciales de ejemplo. |
| **Endpoint** | Una combinación concreta de método + ruta que la API atiende. Ej.: `POST /api/v1/trips`. |
| **DTO** (*Data Transfer Object*) | Objeto cuya única función es transportar datos entre capas, sin comportamiento. |
| **Payload** | Los datos útiles de un mensaje, sin contar cabeceras ni metadatos. |
| **Hash** | Función de un solo sentido: del dato se obtiene el hash, del hash **no** se puede volver al dato. Aquí: bcrypt para contraseñas, SHA-256 para refresh tokens. |
| **Cifrado** | Transformación **reversible** con una clave. Aquí: AES-256-GCM para las contraseñas de choferes. |
| **JWT** (*JSON Web Token*) | Token firmado criptográficamente que transporta datos y no requiere consultar la base para validarse. Capítulo 8. |
| **Idempotente** | Operación que produce el mismo resultado se ejecute una o N veces. |
| **Fail-fast** | Estrategia de fallar inmediatamente y ruidosamente ante una configuración inválida, en vez de arrancar y romperse después. Ver `config/env.ts`. |
| **Borrado lógico** (*soft delete*) | Marcar una fila como borrada (`deleted_at`) en vez de eliminarla. Preserva la historia. |
| **Monorepo** | Un solo repositorio Git con varios proyectos independientes dentro. |

---

## 1.3. Explicación detallada: cómo encaja todo

Con el vocabulario ya definido, el sistema completo se puede describir en un párrafo denso que ahora debería resultar legible por completo:

> El **frontend** es una **SPA** de **React** empaquetada por **Vite**, escrita en **TypeScript**, que corre en el **navegador**. Cuando el usuario actúa, la SPA emite una petición **HTTP** con **Axios** hacia la API. La petición lleva un **JWT** en la cabecera `Authorization`, y su cuerpo es **JSON**. Del otro lado, un **proceso** de **Node.js** con **Express** la recibe en el puerto 3000. La petición atraviesa una cadena de **middlewares**: seguridad (Helmet), **CORS**, parseo de JSON, logging, autenticación (verifica el JWT), autorización (verifica el rol) y validación (Zod). Luego llega al **controlador** del módulo correspondiente, que delega en un **servicio** donde vive la lógica de negocio. El servicio, si necesita datos, llama a un **repositorio**, que usa el **ORM** **Prisma** para traducir la operación a **SQL** y ejecutarla contra **MySQL**, dentro de una **transacción** si hay varias escrituras encadenadas. El resultado sube por las mismas capas, el controlador lo envuelve en `{ data }` y responde con un **código de estado** apropiado. Axios recibe la respuesta, la SPA actualiza su estado, y React **re-renderiza** solo las partes de la interfaz que cambiaron.

Cada elemento en negrita de ese párrafo tiene su capítulo.

---

## 1.4. Flujo interno: qué pasa en el primer segundo

Para cerrar el capítulo, un recorrido temporal de lo que ocurre cuando alguien abre la aplicación por primera vez.

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuario
    participant N as Navegador
    participant V as Vite (:5173)
    participant A as API Node (:3000)
    participant D as MySQL (:3306)

    U->>N: escribe localhost:5173
    N->>V: GET /
    V-->>N: index.html
    N->>V: GET /src/main.tsx
    V-->>N: JavaScript compilado
    Note over N: El motor V8 ejecuta el JS.<br/>React monta la aplicación.
    Note over N: No hay sesión → redirección a /login
    U->>N: completa email y contraseña, clic en Ingresar
    N->>A: POST /api/v1/auth/login {email, password}
    Note over A: helmet → cors → json → cookieParser → pino<br/>→ rateLimiter → validate(loginSchema)
    A->>D: SELECT * FROM users WHERE email = ?
    D-->>A: 1 fila
    Note over A: bcrypt.compare(password, passwordHash)
    A->>D: INSERT INTO refresh_tokens (...)
    D-->>A: OK
    A-->>N: 200 {data:{accessToken, user}} + Set-Cookie: refreshToken
    Note over N: El token se guarda en memoria (Zustand).<br/>La cookie la administra el navegador.
    N->>A: GET /api/v1/dashboard (Authorization: Bearer ...)
    A->>D: varias consultas agregadas
    D-->>A: métricas
    A-->>N: 200 {data:{...}}
    Note over N: React re-renderiza el dashboard con los KPIs
```

Cada uno de esos 20 pasos se explica en profundidad en los capítulos siguientes.

---

## 1.5. Ejemplos

### Ejemplo 1 — Una petición completa, byte a byte

**Lo que envía el navegador:**

```http
POST /api/v1/vehicles HTTP/1.1
Host: localhost:3000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc1NDIzNDU2NywiZXhwIjoxNzU0MjM1NDY3fQ.xxxxx
Content-Type: application/json
Origin: http://localhost:5173
Content-Length: 96

{"licensePlate":"FFF666","model":"Fiat Ducato","year":2023,"initialKm":0,"accumulatedKm":0}
```

**Lo que responde el servidor:**

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true

{"data":{"id":6,"licensePlate":"FFF666","model":"Fiat Ducato","year":2023,"initialKm":0,"accumulatedKm":0,"lastMaintenanceDate":null,"insuranceExpiryDate":null,"status":"AVAILABLE","createdAt":"2026-08-03T18:42:11.204Z","updatedAt":"2026-08-03T18:42:11.204Z"}}
```

Obsérvese: el cliente envió 5 campos, el servidor devolvió 10. Los otros 5 los completó la base de datos con sus valores por defecto (`status`) o automáticos (`id`, `createdAt`, `updatedAt`) o son nulos porque no se enviaron.

### Ejemplo 2 — El mismo endpoint, con un error de validación

```http
POST /api/v1/vehicles HTTP/1.1
Content-Type: application/json

{"licensePlate":"F","model":"","year":1850}
```

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{"error":{"code":"VALIDATION_ERROR","message":"Invalid request data","details":[
  {"path":"licensePlate","message":"String must contain at least 6 character(s)"},
  {"path":"model","message":"String must contain at least 1 character(s)"},
  {"path":"year","message":"Number must be greater than or equal to 1950"}
]}}
```

**Los tres errores se reportan juntos**, no de a uno. Eso es intencional: Zod recolecta todos los problemas antes de fallar (`error-handler.ts:31`). Reportar de a uno obligaría al usuario a corregir, reenviar, descubrir el siguiente, corregir…

### Ejemplo 3 — Estado de la memoria durante un `await`

```ts
export async function storeFile(subfolder, originalName, buffer) {
  const dir = path.join(UPLOAD_ROOT, subfolder);   // (A)
  await fs.mkdir(dir, { recursive: true });        // (B)
  const ext = path.extname(originalName);          // (C)
  // …
}
```

| Momento | Pila de llamadas | Heap | Event loop |
|:--|:--|:--|:--|
| En (A) | `storeFile` | `dir = "uploads/documents"` | vacío |
| Al llegar a (B) | `storeFile` se **retira** | Estado de `storeFile` guardado (`dir`, `subfolder`, `buffer`) | Petición de `mkdir` delegada al sistema operativo |
| Entre (B) y (C) | **vacía** — *Node atiende otras peticiones* | Estado esperando | Esperando el evento del SO |
| El SO responde | — | — | La continuación se encola en microtareas |
| En (C) | `storeFile` **restaurada** con `dir` intacto | — | vacío |

Este es el mecanismo exacto por el que un servidor Node de un solo hilo puede atender miles de peticiones simultáneas: durante toda la fila "entre (B) y (C)", el hilo está libre.

---

## 1.6. Diagramas

### Mapa conceptual del capítulo

```mermaid
mindmap
  root((Conceptos<br/>previos))
    Sistema
      Programa vs proceso
      Runtime: Node vs navegador
      Memoria aislada
    Red
      IP y puertos
      TCP
      HTTP
        Métodos
        Códigos de estado
        Cabeceras
        CORS
      REST
      JSON
    JavaScript
      Tipos primitivos
      const let var
      Funciones y closures
      Objetos y spread
      Asincronía
        Callbacks
        Promesas
        async await
        Event loop
      Módulos
      Clases y herencia
    TypeScript
      Anotaciones e inferencia
      interface vs type
      Genéricos
      unknown any never
      Narrowing
      tsconfig
    Base de datos
      Tablas y filas
      PK y FK
      Índices B+
      Tipos de datos
      Normalización
      SQL
      Transacciones ACID
```

### Las tres capas de ejecución

```mermaid
graph TB
    subgraph L1["Capa 1 — Navegador (V8 + DOM)"]
        A1["frontend/src/**<br/>TypeScript → JS por Vite"]
    end
    subgraph L2["Capa 2 — Node.js (V8 + libuv)"]
        B1["backend/src/**<br/>TypeScript → JS por tsc/tsx"]
    end
    subgraph L3["Capa 3 — MySQL (C++)"]
        C1["12 tablas · 20 índices<br/>motor InnoDB"]
    end

    A1 -->|"HTTP/JSON"| B1
    B1 -->|"protocolo MySQL<br/>vía adaptador MariaDB"| C1

    style L1 fill:#e3f2fd,stroke:#1565c0
    style L2 fill:#e8f5e9,stroke:#2e7d32
    style L3 fill:#fff3e0,stroke:#ef6c00
```

---

## 1.7. Resumen

1. **Dos runtimes distintos.** `backend/` corre en Node.js (tiene disco y red, no tiene DOM). `frontend/` corre en el navegador (tiene DOM, no tiene disco ni red arbitraria). Confundirlos es el error de principiante más costoso.

2. **HTTP es texto plano, petición-respuesta, sin estado.** El servidor no recuerda nada entre peticiones: por eso el token viaja en cada una.

3. **CORS lo impone el navegador, no el servidor.** El servidor solo puede *autorizar* explícitamente.

4. **TypeScript no existe en tiempo de ejecución.** Los tipos se borran al compilar. Por eso el proyecto valida con Zod además de tipar.

5. **Node es de un solo hilo y no bloqueante.** La asincronía resuelve la *espera*, no el *cómputo*. `await` pausa la función, no el proceso.

6. **Los cierres son el mecanismo detrás de los middlewares configurables.** `authorize('ADMIN')` funciona porque la función devuelta recuerda `allowedRoles`.

7. **En la base de datos, `NOT NULL` y `ON DELETE RESTRICT` no son detalles técnicos: son reglas de negocio codificadas.** `driver_id NULL` *es* la definición del estado "pendiente de asignación". `RESTRICT` *es* la política de preservar la historia.

8. **Los índices aceleran lecturas y frenan escrituras.** Se indexa lo que se consulta, no todo.

9. **Las transacciones garantizan que las escrituras encadenadas sean atómicas.** Sin ellas, un fallo a mitad de camino deja el sistema en un estado imposible.

---

## 1.8. Preguntas de repaso

1. ¿Por qué el navegador no puede conectarse directamente a MySQL, y por qué no debería aunque pudiera?
2. Un chofer autenticado intenta borrar un usuario. ¿Qué código de estado devuelve el sistema y por qué no el otro candidato obvio?
3. ¿Cuál es la diferencia práctica entre `??` y `||`? Dar un caso donde produzcan resultados distintos.
4. `await` "pausa la ejecución". ¿Pausa el proceso entero? Explicar qué queda libre y qué no.
5. Si TypeScript borra los tipos al compilar, ¿qué protege exactamente el backend de recibir `{"year": "abc"}`?
6. ¿Por qué `drivers` usa `user_id` como clave primaria en lugar de un `id` propio?
7. El índice `idx_trips_driver_status` es `(driver_id, status)`. ¿Sirve para responder rápido "dame todos los viajes en curso"? Justificar.
8. ¿Qué pasaría exactamente si `fk_trips_driver` fuera `ON DELETE CASCADE`?
9. `drivers.avg_km` viola la tercera forma normal. ¿Por qué se aceptó y qué obligación crea?
10. ¿Por qué `const arr = [1,2]; arr.push(3);` es válido?

<details>
<summary><strong>Respuestas</strong></summary>

1. Técnicamente, el navegador no expone sockets TCP arbitrarios al JavaScript de una página, solo HTTP/WebSocket. Conceptualmente, aunque pudiera, las credenciales de la base tendrían que estar en el código descargado por el usuario, y cualquiera podría leerlas y hacer lo que quisiera con la base. El backend existe, entre otras razones, para ser el único poseedor de ese secreto.

2. **403 Forbidden**. No es 401 porque el sistema sabe perfectamente quién es: el JWT es válido y está autenticado. Lo que falla es el permiso de rol, que verifica `authorize()` en `middlewares/authorize.ts:16`. 401 significaría "identificate primero".

3. `||` reemplaza ante cualquier valor *falsy* (`0`, `""`, `false`, `NaN`, `null`, `undefined`); `??` solo ante `null` y `undefined`. Caso: `puerto || 3000` con `puerto = 0` da 3000 (mal, 0 era un valor deliberado); `puerto ?? 3000` da 0 (bien).

4. Pausa **esa función**. El estado de la función se mueve al heap, la pila de llamadas se libera, y el event loop atiende otras peticiones. Lo que **no** se libera es el cómputo síncrono: si en vez de `await` hubiera un bucle de un millón de iteraciones, el hilo quedaría ocupado y todo el servidor se congelaría.

5. **Zod**, ejecutándose en el middleware `validate` (`middlewares/validate.ts:13`). TypeScript solo garantiza coherencia entre las partes del código del proyecto; no puede saber nada de lo que llega por la red. Zod comprueba en tiempo de ejecución y devuelve 400 con el detalle.

6. Porque modela una relación **1 a 1**: un chofer *es* un usuario con datos adicionales, no una entidad separada que "tiene" un usuario. Con clave primaria compartida, la base garantiza estructuralmente que no puede haber dos filas de `drivers` para el mismo usuario. Con un `id` propio + `user_id UNIQUE` se lograría lo mismo, pero con una columna extra y una relación menos evidente.

7. **No.** Un índice compuesto solo se puede usar "por la izquierda": sirve para `WHERE driver_id = X` y para `WHERE driver_id = X AND status = Y`, pero no para `WHERE status = Y` solo. Para eso existe el índice separado `idx_trips_status` (`schema.prisma:238`).

8. Dar de baja un chofer borraría físicamente todos sus viajes. Los reportes históricos cambiarían retroactivamente sin explicación; los registros de auditoría apuntarían a `entity_id` de viajes inexistentes; los kilómetros acumulados de los vehículos dejarían de cuadrar con la suma de los viajes. Y sería irreversible.

9. Porque `completed_trips` y `avg_km` se muestran en el listado de choferes, y calcularlos al vuelo requeriría un `COUNT` y un `AVG` sobre `trips` por cada fila. La obligación que crea: **todo** código que finalice un viaje debe actualizar esos dos campos en la misma transacción. Si alguien escribe en `trips` sin pasar por el servicio de viajes, los números quedan mintiendo silenciosamente.

10. Porque `const` congela la **referencia**, no el contenido. `arr` sigue apuntando al mismo arreglo; lo que cambia es el interior de ese arreglo. Lo prohibido sería `arr = [4,5]`, que reasignaría la referencia.

</details>

---

## 1.9. Ejercicios propuestos

**Nivel 1 — Observación**

1. Abrir las herramientas de desarrollo del navegador (F12), pestaña *Network*, e iniciar sesión en la aplicación. Identificar en la petición de login: método, ruta, cabeceras, cuerpo. En la respuesta: código de estado, `Set-Cookie`, cuerpo.
2. En la misma pestaña, hacer clic en cualquier sección y contar cuántas peticiones HTTP dispara. ¿Alguna se repite?
3. Ejecutar `curl -i http://localhost:3000/health` y explicar cada línea de la salida.

**Nivel 2 — Experimentación**

4. Enviar `POST /api/v1/vehicles` **sin** cabecera `Authorization`. ¿Qué código devuelve? Rastrear en el código exactamente qué línea lo produjo.
5. Enviar la misma petición con un token válido de un usuario con rol `DRIVER`. ¿Qué código devuelve ahora? ¿Qué línea lo produjo?
6. Cambiar `CORS_ORIGIN` en `backend/.env` a `http://otro-sitio.com`, reiniciar el backend, y recargar el frontend. Describir exactamente qué error aparece en la consola del navegador y por qué el servidor **sí** procesó la petición aunque el navegador descartó la respuesta.

**Nivel 3 — Modificación**

7. Escribir una función que reciba un arreglo de números y devuelva la suma, en tres versiones: con callback, con Promesa, y con `async/await`. Comparar legibilidad y manejo de errores.
8. Agregar una nueva subclase de `AppError` llamada `TooManyRequestsError` con `statusCode = 429` y `code = 'TOO_MANY_REQUESTS'`. Verificar que **no hace falta modificar** `error-handler.ts` para que funcione. Explicar por qué.
9. En `backend/tsconfig.json`, cambiar `"strict": true` a `false` y ejecutar `npm run typecheck`. Contar cuántos errores desaparecen y elegir tres para explicar qué bug real estaban previniendo.
10. Escribir la consulta SQL que responde "¿cuántos viajes completó cada chofer el mes pasado?" usando `JOIN` y `GROUP BY`. Después ejecutarla con `EXPLAIN` delante y determinar qué índices usa.

---

**Anterior:** [Índice](00-indice.md) · **Siguiente:** [Capítulo 2 — Arquitectura general](02-arquitectura.md)
