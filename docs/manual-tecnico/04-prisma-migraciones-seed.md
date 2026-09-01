# Capítulo 4 — Prisma: ORM, cliente generado, migraciones y seed

> **Prerrequisitos:** [Capítulo 1, §1.2.7 y §1.2.8](01-conceptos-previos.md) (TypeScript y SQL) y [Capítulo 3](03-base-de-datos.md) completo.
> **Archivos que se explican aquí:** `backend/prisma.config.ts` (18 líneas), `backend/src/database/prisma-client.ts` (13 líneas), `backend/prisma/migrations/20260714023014_init/migration.sql` (247 líneas, íntegramente), `backend/prisma/seed.ts` (373 líneas, íntegramente) y la estructura completa de `backend/src/generated/prisma/` (22.748 líneas, analizadas conceptualmente).
> **Al terminar** el lector sabrá exactamente qué hace Prisma con cada consulta, por qué el cliente generado pesa 22.748 líneas, cómo se versiona la base de datos y cómo se puebla con datos coherentes.

---

## 4.1. Introducción

Entre el código TypeScript y la base de datos MySQL hay un abismo conceptual. De un lado hay objetos con métodos, herencia y referencias en memoria. Del otro hay tablas planas con filas, columnas y claves numéricas. Nada en un lado corresponde naturalmente a nada del otro.

Ese abismo tiene nombre: **desajuste de impedancia objeto-relacional** (*object-relational impedance mismatch*). Es un problema de 40 años y no tiene solución perfecta. Un **ORM** es un intento de salvarlo.

Este capítulo explica:

- Qué es un ORM, cuáles son los dos grandes patrones (Active Record y Data Mapper) y en cuál cae Prisma.
- Por qué Prisma 7 es arquitectónicamente distinto de Prisma 5 y anteriores, y qué ganó y perdió en ese cambio.
- Qué es exactamente un *driver adapter*, por qué hay uno de MariaDB en un proyecto MySQL, y cómo funciona el pool de conexiones.
- Qué hay dentro de las 22.748 líneas generadas, archivo por archivo, y cómo esos tipos hacen que `prisma.vehicle.findMany({ where: { statuss: 'X' } })` sea un error de compilación.
- Las migraciones: qué son, cómo se generan, cómo se aplican en desarrollo y en producción, y `migration.sql` línea por línea.
- El seed: `seed.ts` línea por línea, con foco en por qué es idempotente y por qué usa fechas relativas.
- Los errores frecuentes de Prisma y cómo diagnosticarlos.

---

## 4.2. Conceptos previos

### 4.2.1. El problema que un ORM intenta resolver

Sin ORM, hablar con la base de datos se ve así:

```ts
// — ejemplo ilustrativo, así NO está escrito el proyecto —
const [rows] = await connection.execute(
  'SELECT id, license_plate, model, accumulated_km FROM vehicles WHERE status = ? AND deleted_at IS NULL',
  ['AVAILABLE'],
);
const vehiculos = rows.map((r) => ({
  id: r.id,
  licensePlate: r.license_plate,
  model: r.model,
  accumulatedKm: r.accumulated_km,
}));
```

**Los seis problemas de este código:**

1. **La consulta es un string.** Un error de tipeo (`FORM` en vez de `FROM`, `licence_plate` en vez de `license_plate`) no lo detecta ningún compilador: explota en tiempo de ejecución, en producción, con un usuario mirando.
2. **El resultado no tiene tipo.** `rows` es `any[]`. `r.licens_plate` (con error de tipeo) devuelve `undefined` silenciosamente. TypeScript no puede ayudar porque no sabe qué columnas tiene la tabla.
3. **La conversión de nombres es manual.** `license_plate` → `licensePlate` hay que escribirlo a mano, en cada consulta, sin equivocarse.
4. **La conversión de tipos es manual.** MySQL devuelve `DATE` como string o como `Date` según la configuración del driver; `DECIMAL` como string; `TINYINT(1)` como `0`/`1` en vez de `false`/`true`.
5. **No hay refactorización posible.** Renombrar la columna `model` a `vehicle_model` obliga a buscar en strings por todo el proyecto. El editor no ayuda.
6. **Cada base de datos tiene su dialecto.** `LIMIT 10 OFFSET 20` en MySQL es `OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY` en SQL Server.

Con Prisma, lo mismo es:

```ts
// vehicles.repository.ts:36-43 — código real
prisma.vehicle.findMany({
  where: { status: 'AVAILABLE', deletedAt: null },
  orderBy: { id: 'asc' },
  skip: 0,
  take: 10,
});
```

Y ahora:

1. `statuss` (con error de tipeo) es un **error de compilación**.
2. El resultado tiene tipo `Vehicle[]` con las 12 propiedades exactas.
3. `licensePlate` viene ya convertido desde `license_plate`.
4. `deletedAt` es `Date | null`, `status` es `'AVAILABLE' | 'INACTIVE' | 'IN_WORKSHOP' | 'ON_TRIP'`.
5. Renombrar en `schema.prisma` y regenerar produce errores de compilación **en todos los lugares afectados**.
6. Cambiar `provider = "mysql"` a `"postgresql"` regenera el SQL correcto.

💡 **El intercambio.** Se gana seguridad de tipos, ergonomía y portabilidad. Se pierde control fino sobre el SQL generado, y se agrega una dependencia grande y opinada al proyecto. Para consultas complejas de reportes, Prisma tiene `$queryRaw` como válvula de escape — el proyecto la usa en `reports.repository.ts` y `dashboard.repository.ts` (se analiza en el capítulo 16).

### 4.2.2. Los dos patrones clásicos de ORM

#### Active Record

Cada fila de la base es un **objeto con métodos**. El objeto sabe guardarse a sí mismo.

```ts
// — ejemplo ilustrativo del estilo Active Record (TypeORM, Sequelize, Rails) —
const vehiculo = await Vehicle.findOne({ where: { id: 7 } });
vehiculo.model = 'Iveco Daily 2024';
await vehiculo.save();           // ← el objeto se guarda solo
await vehiculo.remove();
```

| Ventajas | Desventajas |
|:--|:--|
| Muy ergonómico y directo. | La entidad **conoce la base de datos**: viola la separación de capas. |
| Menos código para operaciones simples. | Difícil de testear: no se puede instanciar sin conexión. |
| Popular y familiar. | Las entidades acumulan responsabilidades (datos + persistencia + validación + negocio). |
| | Efectos secundarios ocultos: acceder a `vehiculo.trips` puede disparar una consulta. |

#### Data Mapper

Las entidades son **datos puros**. Un objeto separado (el *mapper* o repositorio) se encarga de leer y escribir.

```ts
// — estilo Data Mapper, que es el de Prisma —
const vehiculo = await prisma.vehicle.findUnique({ where: { id: 7 } });
// vehiculo es un objeto plano: NO tiene .save(), NO tiene .delete()
await prisma.vehicle.update({ where: { id: 7 }, data: { model: 'Iveco Daily 2024' } });
```

| Ventajas | Desventajas |
|:--|:--|
| Las entidades son objetos planos: se pueden crear, pasar y testear sin base de datos. | Más verboso: hay que nombrar la entidad *y* la operación. |
| Separación de capas limpia. | Requiere una capa explícita de repositorios (que el proyecto tiene). |
| **Todas las consultas son explícitas**: no hay efectos ocultos. | — |
| Encaja naturalmente con arquitecturas en capas. | — |

🔴 **Prisma es Data Mapper, y eso explica una decisión de todo el proyecto.** Como las entidades de Prisma son objetos planos sin comportamiento, el modelo de dominio es necesariamente **anémico** (§2.4.5): la lógica tiene que vivir en otro lado, y ese otro lado son los servicios. No es una elección estilística del equipo: es la consecuencia directa de elegir Prisma.

💡 **Y explica también por qué existe la capa de repositorios.** Con Active Record, `vehiculo.save()` ya *es* el repositorio. Con Data Mapper hay que escribirlo. El proyecto aprovecha esa obligación para convertirla en una ventaja: el repositorio es donde se centraliza el filtro de borrado lógico y el parámetro `db: DbClient = prisma` para transacciones.

### 4.2.3. El problema N+1

Es el error de rendimiento más común con cualquier ORM, y hay que conocerlo antes de leer código.

```ts
// — ejemplo ilustrativo de código MALO —
const viajes = await prisma.trip.findMany({ take: 20 });     // 1 consulta
for (const viaje of viajes) {
  const chofer = await prisma.driver.findUnique({            // 20 consultas más
    where: { userId: viaje.driverId },
  });
  console.log(chofer.dni);
}
```

**1 + 20 = 21 consultas** para traer 20 viajes con su chofer. Con 1.000 viajes serían 1.001 consultas. Cada una tiene su ida y vuelta por red: si cada una tarda 2 ms, son 2 segundos de latencia pura.

**La solución en Prisma: `include`.**

```ts
const viajes = await prisma.trip.findMany({
  take: 20,
  include: { driver: { include: { user: true } } },
});
// Prisma emite 3 consultas: trips, drivers (con IN), users (con IN)
```

⚙️ **Cómo lo hace internamente.** Prisma **no** usa `JOIN` para `include`. Emite consultas separadas y las une en memoria:

```sql
SELECT ... FROM trips LIMIT 20;
SELECT ... FROM drivers WHERE user_id IN (3, 5, 8, 3, 5, ...);
SELECT ... FROM users WHERE id IN (3, 5, 8, ...);
```

**Por qué evita el `JOIN`:** un `JOIN` con relaciones "a muchos" duplica las filas del lado "uno". Traer 20 viajes con sus 5 adjuntos cada uno daría 100 filas con los datos del viaje repetidos 5 veces — mucho más tráfico de red. Con consultas separadas, cada dato viaja una sola vez.

**Cuándo el `JOIN` sí conviene:** cuando la relación es "a uno" y solo se necesitan pocos campos. Prisma ofrece `relationJoins` como característica opcional para esos casos. Este proyecto no la usa.

🔴 **Dónde puede aparecer el N+1 en este proyecto.** En los servicios que iteran sobre listas. Un ejemplo real que hay que auditar es el motor de alertas (`alerts.service.ts`, capítulo 14): recorre choferes, vehículos y documentos evaluando condiciones. Si dentro del bucle hiciera una consulta por elemento, el N+1 sería severo. El capítulo 14 verifica cómo está resuelto.

### 4.2.4. Pool de conexiones

Abrir una conexión TCP a MySQL cuesta: negociación TCP (3 mensajes), autenticación (2-3 mensajes más), configuración de la sesión. Entre 5 y 50 milisegundos. Si cada consulta abriera una conexión nueva, la latencia se multiplicaría.

Un **pool** mantiene un conjunto de conexiones abiertas y las **presta**:

```mermaid
sequenceDiagram
    participant S as Servicio
    participant P as Pool (adaptador MariaDB)
    participant C1 as Conexión 1
    participant C2 as Conexión 2
    participant DB as MySQL

    Note over P: Al arrancar: abre N conexiones y las mantiene
    S->>P: necesito ejecutar una consulta
    P->>C1: prestada
    C1->>DB: SELECT ...
    DB-->>C1: filas
    C1-->>P: devuelta al pool (NO se cierra)
    P-->>S: resultado
    Note over P: La conexión 1 queda libre para el siguiente
    S->>P: otra consulta (concurrente)
    P->>C2: prestada
```

🔴 **La razón por la que `prisma-client.ts` tiene 13 líneas y un comentario de 6.** Cada `new PrismaClient()` crea **su propio pool**. Si el proyecto instanciara uno por módulo, tendría 13 pools independientes. Con un límite típico de 10 conexiones por pool, serían 130 conexiones abiertas contra un MySQL cuyo `max_connections` por defecto es **151**. El servidor se quedaría sin conexiones y empezaría a rechazar. Por eso el comentario del código dice literalmente: *"Multiple instances would exhaust MySQL connections."*

### 4.2.5. Qué cambió en Prisma 7

Este proyecto usa Prisma **7.8**, y su arquitectura es sustancialmente distinta de la de Prisma 2-5, que es la que aparece en la mayoría de los tutoriales.

| | **Prisma ≤5 (clásico)** | **Prisma 7 (este proyecto)** |
|:--|:--|:--|
| Motor de consultas | Binario en **Rust** (`query-engine`), un proceso aparte | **Eliminado**: todo en TypeScript |
| Comunicación | El cliente JS habla con el binario Rust por gRPC/stdio | Llamada de función directa |
| Conexión a la base | La abre el binario Rust | La abre un **driver adapter** de Node |
| Tamaño del despliegue | +40 MB por el binario, específico de cada plataforma | Sin binario |
| Arranque en frío | Lento (hay que lanzar el proceso Rust) | Rápido |
| Entornos *edge* / serverless | Problemático | Funciona |
| Generador | `prisma-client-js` (produce JS + `.d.ts`) | `prisma-client` (produce **TypeScript legible**) |
| Salida | En `node_modules/.prisma/client` | En una carpeta del proyecto (aquí `src/generated/prisma`) |

💡 **Por qué importa el cambio de generador.** Con `prisma-client-js`, el código generado quedaba escondido en `node_modules` y era JavaScript minificado: inspeccionarlo era incómodo. Con `prisma-client`, sale en `src/generated/prisma/` como TypeScript que se puede abrir y leer. Eso es lo que hace posible este capítulo.

🔴 **La consecuencia práctica: el `.gitignore` excluye `backend/src/generated/`.** Es código derivado, se regenera desde `schema.prisma`. Por eso `package.json:9` declara:

```json
"postinstall": "prisma generate"
```

`postinstall` es un script que npm ejecuta **automáticamente** después de `npm install`. Sin él, quien clone el repositorio tendría 200 errores de compilación por imports a una carpeta inexistente, y no sabría por qué. Con él, `npm install` deja el proyecto listo.

⚠️ **Modo de fallo real de este mecanismo:** si `npm install` corre sin conexión a la base, `prisma generate` **igual funciona** (solo lee `schema.prisma`, no se conecta). Pero si `schema.prisma` tiene un error de sintaxis, `postinstall` falla y el `npm install` entero se marca como fallido.

---

## 4.3. `prisma.config.ts` línea por línea

Este archivo, nuevo en Prisma 7, reemplaza la configuración que antes vivía dentro de `schema.prisma`.

```ts
1  import 'dotenv/config';
2  import { defineConfig } from 'prisma/config';
3
4  /**
5   * Prisma 7 CLI configuration (schema location, migrations, seed).
6   * The runtime connection is handled by the MariaDB driver adapter
7   * in src/database/prisma-client.ts.
8   */
9  export default defineConfig({
10   schema: 'prisma/schema.prisma',
11   migrations: {
12     path: 'prisma/migrations',
13     seed: 'tsx prisma/seed.ts',
14   },
15   datasource: {
16     url: process.env['DATABASE_URL'] ?? '',
17   },
18 });
```

**Línea 1 — `import 'dotenv/config'`**

Un **import con efecto secundario**: no importa ningún valor, solo ejecuta el módulo. Al ejecutarse, `dotenv` lee el archivo `.env` del directorio actual y vuelca sus pares clave=valor en `process.env`.

🔴 **Tiene que ser la PRIMERA línea, y el orden es crítico.** La línea 16 lee `process.env['DATABASE_URL']`. En JavaScript, los `import` se resuelven **antes** de que se ejecute cualquier código del módulo, y en el orden en que están escritos. Si esta línea estuviera después de la 2, seguiría funcionando (los imports se hoistean juntos), pero si `DATABASE_URL` se leyera en un módulo importado **antes**, valdría `undefined`. La convención de ponerlo primero elimina toda ambigüedad.

⚙️ **Qué hace `dotenv` exactamente.** Lee `.env` línea por línea, ignora las que empiezan con `#`, parte cada una por el primer `=`, quita comillas si las hay, y hace `process.env[clave] = valor` **solo si la clave no existe ya**. Esa última parte importa: las variables de entorno reales del sistema **tienen prioridad** sobre el archivo. En producción, donde las variables las inyecta la plataforma, `.env` no interfiere.

**Línea 2 — `import { defineConfig } from 'prisma/config'`**

`defineConfig` es una **función de identidad tipada**: recibe un objeto y devuelve el mismo objeto. Su única razón de existir es que TypeScript pueda verificar la forma del objeto y ofrecer autocompletado.

```ts
// — ejemplo ilustrativo de cómo está implementada —
export function defineConfig<T extends PrismaConfig>(config: T): T { return config; }
```

💡 **Por qué no simplemente `export default { ... }`.** Porque entonces TypeScript inferiría el tipo del literal y no verificaría nada contra la forma esperada. Con `defineConfig`, escribir `migrationss` (con error de tipeo) es un error de compilación. Es el mismo patrón que usan `vite.config.ts:6` y `vitest.config.ts:8`.

**Líneas 4-8 — el comentario**

No es decorativo: resuelve una pregunta que el lector se va a hacer. `schema.prisma` no tiene `url` en su bloque `datasource` (§3.5), y este archivo sí lo tiene. El comentario aclara que **hay dos caminos de conexión distintos**:

| Camino | Quién lo usa | De dónde saca la URL |
|:--|:--|:--|
| CLI (migraciones, seed, `prisma studio`) | El comando `prisma` | `prisma.config.ts:16` |
| Runtime (la aplicación corriendo) | `PrismaClient` | `database/prisma-client.ts:11` (adaptador) |

**Línea 10 — `schema: 'prisma/schema.prisma'`**

Ruta relativa a la raíz del proyecto (donde está `package.json`). Prisma la buscaría por convención en ese lugar de todas formas; declararla explícitamente hace que un cambio de estructura no rompa nada en silencio.

**Líneas 11-14 — `migrations`**

- `path: 'prisma/migrations'` — dónde viven los archivos de migración.
- `seed: 'tsx prisma/seed.ts'` — el comando que ejecuta `npx prisma db seed`.

🔴 **`tsx`, no `node`.** `seed.ts` es TypeScript, y Node no ejecuta TypeScript directamente. `tsx` es un envoltorio que transpila al vuelo con esbuild y ejecuta. La alternativa sería `tsc && node prisma/seed.js` — dos pasos, un artefacto intermedio, y hay que acordarse de recompilar.

⚠️ **Está declarado dos veces.** También aparece en `package.json:19-21`:

```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

Es la ubicación **antigua** (Prisma ≤5). Prisma 7 lee `prisma.config.ts`. Que estén las dos es duplicación: si alguien cambia una y no la otra, el comportamiento depende de qué versión de Prisma se esté ejecutando. Es un residuo de la migración a Prisma 7 y debería limpiarse.

**Líneas 15-17 — `datasource.url`**

```ts
url: process.env['DATABASE_URL'] ?? '',
```

- `process.env['DATABASE_URL']` con corchetes, no con punto. Es requisito de `noUncheckedIndexedAccess` en `tsconfig.json:10`: TypeScript tipa el acceso indexado como `string | undefined`.
- `?? ''` provee un valor por defecto si la variable no existe.

🔴 **`?? ''` es una decisión discutible.** Si `DATABASE_URL` no está definida, en lugar de fallar inmediatamente con un mensaje claro, se pasa una cadena vacía y Prisma falla más adelante con un error críptico de parseo de URL. Compárese con `config/env.ts:13`, que hace `DATABASE_URL: z.string().min(1)` y **aborta el arranque** con un mensaje explícito. La aplicación falla bien; el CLI falla mal. La mejora sería `?? (() => { throw new Error('DATABASE_URL no definida') })()`.

**Estructura de la URL de conexión** (`.env.example:7`):

```
mysql://root:password@localhost:3306/logistics_management?allowPublicKeyRetrieval=true
└─┬─┘   └┬─┘ └──┬───┘ └───┬───┘ └┬─┘ └────────┬────────┘ └──────────┬────────────┘
protocolo usuario  clave    host  puerto    base de datos         parámetros
```

⚙️ **`allowPublicKeyRetrieval=true`, explicado.** MySQL 8 usa por defecto el plugin de autenticación `caching_sha2_password`. En una conexión **sin TLS**, ese plugin necesita la clave pública RSA del servidor para cifrar la contraseña antes de enviarla. Sin este parámetro, el cliente se niega a pedirla (porque un intermediario podría suplantarla) y la conexión falla con `RSA public key is not available client side`.

🔴 **Este parámetro es aceptable SOLO en desarrollo local.** Habilitarlo significa aceptar la clave pública que el servidor mande, sin verificarla — lo que abre la puerta a un ataque de intermediario. En producción la solución correcta es TLS (`sslmode=require`), no este parámetro. `.env.example` lo incluye porque es el archivo de desarrollo, pero **es una trampa**: alguien podría copiarlo a producción sin pensarlo. Debería estar comentado con una advertencia explícita.

---

## 4.4. `database/prisma-client.ts` línea por línea

Trece líneas que determinan cómo toda la aplicación habla con la base de datos.

```ts
1  import { PrismaMariaDb } from '@prisma/adapter-mariadb';
2  import { PrismaClient } from '../generated/prisma/client';
3  import { env } from '../config/env';
4
5  /**
6   * Single PrismaClient instance for the whole process.
7   * Prisma 7 (Rust-free client): the connection is handled by the MariaDB
8   * driver adapter, which manages its own MySQL connection pool.
9   * Multiple instances would exhaust MySQL connections.
10  */
11 const adapter = new PrismaMariaDb(env.DATABASE_URL);
12
13 export const prisma = new PrismaClient({ adapter });
```

**Línea 1 — el adaptador**

`@prisma/adapter-mariadb` es un **driver adapter**: una capa fina que traduce entre la interfaz genérica que Prisma espera y el driver `mariadb` de Node.

```mermaid
graph LR
    A["PrismaClient<br/>TypeScript"] --> B["Driver adapter<br/>@prisma/adapter-mariadb"]
    B --> C["Driver mariadb<br/>protocolo MySQL<br/>+ pool"]
    C --> D[("MySQL 8")]

    style A fill:#e8f5e9,stroke:#2e7d32
    style B fill:#fff9c4,stroke:#f57f17
    style C fill:#fff3e0,stroke:#ef6c00
    style D fill:#efebe9,stroke:#4e342e
```

💡 **Por qué el adaptador de *MariaDB* en un proyecto de *MySQL*.** MariaDB nació como una bifurcación de MySQL y mantiene compatibilidad de protocolo. El driver `mariadb` de Node habla el mismo protocolo binario que MySQL y es, según la documentación de Prisma 7, el adaptador recomendado para MySQL. Los otros candidatos (`mysql2`) están soportados pero con menos madurez en el ecosistema de adaptadores. El nombre confunde; la elección es correcta.

⚠️ **La compatibilidad no es perfecta.** MariaDB y MySQL divergieron en 2012 y hoy difieren en varias cosas (secuencias, JSON, funciones de ventana en versiones viejas). Para las operaciones que hace este proyecto —CRUD, transacciones, agregaciones básicas— la compatibilidad es total. Pero si se agregaran consultas `$queryRaw` con sintaxis específica de MySQL 8, habría que verificar caso por caso.

**Línea 2 — el import del cliente generado**

```ts
import { PrismaClient } from '../generated/prisma/client';
```

Nótese la ruta: **no** es `'@prisma/client'`, que es lo que aparece en todos los tutoriales. Es una ruta **relativa a un archivo del propio proyecto**, generado por `prisma generate` según `schema.prisma:8` (`output = "../src/generated/prisma"`).

🔴 **Esto es lo que hace que el proyecto no compile tras un `git clone` sin `npm install`.** El archivo no está en Git. El script `postinstall` lo genera. Si alguien clona y corre `npm run dev` sin haber corrido `npm install`, obtiene `Cannot find module '../generated/prisma/client'`.

**Línea 11 — `const adapter = new PrismaMariaDb(env.DATABASE_URL)`**

Se construye el adaptador **una sola vez**, en el ámbito del módulo. Como los módulos de JavaScript se evalúan **una única vez** por proceso (están cacheados por el sistema de módulos), esta línea se ejecuta exactamente una vez sin importar cuántos archivos importen `prisma`.

⚙️ **El caché de módulos es el mecanismo real del singleton.** No hace falta un patrón Singleton con clase y método `getInstance()`: el sistema de módulos de Node ya garantiza que `import { prisma } from './database/prisma-client'` devuelva **el mismo objeto** en los 13 repositorios que lo importan.

**Línea 13 — `export const prisma = new PrismaClient({ adapter })`**

`{ adapter }` es **abreviatura de propiedad** (*shorthand*): equivale a `{ adapter: adapter }`.

**Configuración del pool.** El adaptador acepta un segundo parámetro con opciones (`connectionLimit`, `acquireTimeout`, `idleTimeout`). Aquí no se pasa: se usan los valores por defecto del driver `mariadb`, que son `connectionLimit: 10`.

⚠️ **Diez conexiones es un valor por defecto razonable para desarrollo y sospechoso para producción.** El cálculo correcto depende de la concurrencia esperada y del `max_connections` de MySQL. Para un solo proceso Node atendiendo una empresa de transporte, 10 es más que suficiente (recuérdese que Node es de un solo hilo: no puede tener más de unas pocas consultas *realmente* en vuelo). Pero es un número que nadie decidió, y eso es lo criticable: debería estar explícito y documentado.

🔴 **Lo que NO está y debería estar: logging de consultas.** Prisma soporta `new PrismaClient({ log: ['query', 'warn', 'error'] })`, que imprime cada SQL generado. En desarrollo es la herramienta de diagnóstico más útil que existe (revela N+1, consultas sin índice, transacciones largas). Debería estar condicionado a `!isProduction`. El capítulo 25 lo propone.

---

## 4.5. El cliente generado: 22.748 líneas

### 4.5.1. Por qué tantas líneas

La pregunta natural es: ¿cómo puede un esquema de 295 líneas producir 22.748?

La respuesta: por cada modelo, Prisma genera **todas las combinaciones posibles de tipos** para **todas las operaciones posibles**.

Tomemos `Vehicle`. Prisma genera, entre otros:

| Tipo generado | Para qué sirve |
|:--|:--|
| `VehicleModel` | La forma del registro tal como sale de la base. |
| `VehicleSelect` | Qué campos se pueden pedir en `select`. |
| `VehicleInclude` | Qué relaciones se pueden pedir en `include`. |
| `VehicleWhereInput` | Todos los filtros posibles, recursivamente (`AND`, `OR`, `NOT`, `contains`, `gt`, `in`…). |
| `VehicleWhereUniqueInput` | Filtros que garantizan como máximo una fila (`id`, `licensePlate`). |
| `VehicleOrderByWithRelationInput` | Ordenamientos, incluidos los que atraviesan relaciones. |
| `VehicleCreateInput` / `VehicleUncheckedCreateInput` | Datos para crear, con y sin relaciones anidadas. |
| `VehicleUpdateInput` / `VehicleUncheckedUpdateInput` | Datos para actualizar. |
| `VehicleAvgAggregateOutputType` | Resultado de `_avg` — **solo los campos numéricos**. |
| `VehicleSumAggregateOutputType` | Resultado de `_sum` — solo numéricos. |
| `VehicleMinAggregateOutputType` | Resultado de `_min` — todos los campos, todos nulables. |
| `VehicleMaxAggregateOutputType` | Resultado de `_max`. |
| `VehicleCountAggregateOutputType` | Resultado de `_count` — todos los campos + `_all`. |
| `VehicleGroupByOutputType` | Resultado de `groupBy`. |
| `VehicleScalarFieldEnum` | Los nombres de columna como unión de literales. |
| `VehicleDelegate` | El objeto `prisma.vehicle` con sus ~20 métodos, cada uno con su firma genérica. |

Son 1.637 líneas para un modelo de 12 campos. Multiplicado por 12 modelos, más los tipos comunes, da 22.748.

💡 **Nada de esto se escribe a mano ni se lee.** Es el precio de la seguridad de tipos: para que TypeScript pueda verificar que `where: { statuss: 'X' }` está mal, tiene que existir un tipo que enumere los campos válidos. Ese tipo hay que generarlo.

### 4.5.2. Estructura de archivos

```
backend/src/generated/prisma/
├── client.ts                        103 líneas — punto de entrada del servidor
├── browser.ts                        79 líneas — punto de entrada del navegador (no se usa acá)
├── enums.ts                          74 líneas — los 7 enums como valores Y tipos
├── models.ts                         22 líneas — reexporta los 12 modelos
├── commonInputTypes.ts              885 líneas — filtros reutilizables (StringFilter, IntFilter…)
├── internal/
│   ├── class.ts                     314 líneas — la clase PrismaClient real
│   ├── prismaNamespace.ts         1.882 líneas — el namespace Prisma con todo lo interno
│   └── prismaNamespaceBrowser.ts    414 líneas — versión reducida para el navegador
└── models/
    ├── Trip.ts                    2.384 líneas ← el más grande (4 relaciones, 18 campos)
    ├── User.ts                    2.121 líneas
    ├── Maintenance.ts             1.805 líneas
    ├── Vehicle.ts                 1.637 líneas
    ├── Driver.ts                  1.574 líneas
    ├── DriverDocument.ts          1.443 líneas
    ├── Alert.ts                   1.429 líneas
    ├── AuditLog.ts                1.374 líneas
    ├── MaintenanceType.ts         1.350 líneas
    ├── MaintenanceAttachment.ts   1.340 líneas
    ├── RefreshToken.ts            1.301 líneas
    └── CompanySettings.ts         1.217 líneas
```

💡 **El tamaño de cada archivo es proporcional a la complejidad del modelo.** `Trip.ts` es el más grande porque `Trip` tiene 4 relaciones y 18 campos: los tipos de `where`, `orderBy` e `include` se expanden recursivamente por cada relación. `CompanySettings.ts` es el más chico porque no tiene ninguna relación. Es una métrica indirecta e involuntaria de la complejidad del modelo de datos.

### 4.5.3. La cabecera de cada archivo generado

Todos empiezan igual:

```ts
/* !!! This is code generated by Prisma. Do not edit directly. !!! */
/* eslint-disable */
// biome-ignore-all lint: generated file
// @ts-nocheck
```

| Línea | Qué hace |
|:--|:--|
| `Do not edit directly` | Advertencia humana: el próximo `prisma generate` sobrescribe todo. |
| `/* eslint-disable */` | Desactiva ESLint para el archivo. |
| `biome-ignore-all` | Lo mismo para Biome (otro linter). |
| `// @ts-nocheck` | **Desactiva la verificación de tipos de TypeScript en este archivo.** |

🔴 **`@ts-nocheck` merece una explicación, porque parece alarmante.** Significa que TypeScript **no verifica** el contenido de este archivo. ¿No anula eso todo el beneficio?

No, y la distinción es importante: `@ts-nocheck` desactiva la verificación **del cuerpo** del archivo, pero los **tipos que exporta siguen siendo válidos y se siguen usando** para verificar el resto del proyecto. Prisma lo pone porque el código generado usa acrobacias de tipos (genéricos recursivos, tipos condicionales anidados) que en ciertas configuraciones estrictas del compilador producen errores espurios. Como el código es generado por una herramienta que se asume correcta, verificarlo es puro costo de compilación sin beneficio.

⚠️ **El riesgo real:** si `prisma generate` tuviera un bug y produjera tipos incoherentes, TypeScript no avisaría en el archivo, sino en los 91 lugares del proyecto que los usan, con mensajes confusos. Es un caso raro pero difícil de diagnosticar.

### 4.5.4. `enums.ts` — el patrón objeto-como-enum

```ts
export const Role = {
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
  DRIVER: 'DRIVER'
} as const

export type Role = (typeof Role)[keyof typeof Role]
```

Esta construcción es densa y vale la pena desarmarla, porque aparece por todo el ecosistema TypeScript moderno.

**Primera parte: el objeto con `as const`.**

`as const` es una **aserción de constancia**. Sin ella, TypeScript inferiría:

```ts
{ ADMIN: string; OPERATOR: string; DRIVER: string }
```

Con ella, infiere los **tipos literales exactos**:

```ts
{ readonly ADMIN: "ADMIN"; readonly OPERATOR: "OPERATOR"; readonly DRIVER: "DRIVER" }
```

**Segunda parte: `(typeof Role)[keyof typeof Role]`**, de adentro hacia afuera:

| Paso | Expresión | Resultado |
|:-:|:--|:--|
| 1 | `typeof Role` | `{ readonly ADMIN: "ADMIN"; readonly OPERATOR: "OPERATOR"; readonly DRIVER: "DRIVER" }` |
| 2 | `keyof typeof Role` | `"ADMIN" \| "OPERATOR" \| "DRIVER"` (las **claves**) |
| 3 | `(typeof Role)["ADMIN" \| "OPERATOR" \| "DRIVER"]` | `"ADMIN" \| "OPERATOR" \| "DRIVER"` (los **valores**) |

El paso 3 es un **tipo de acceso indexado**: indexar un tipo con una unión devuelve la unión de los tipos correspondientes.

**El resultado: `Role` existe como valor Y como tipo simultáneamente.**

```ts
import { Role } from './generated/prisma/client';

const r: Role = 'ADMIN';           // Role como TIPO
const todos = Object.values(Role); // Role como VALOR → ['ADMIN','OPERATOR','DRIVER']
if (usuario.role === Role.ADMIN) { }  // Role como VALOR, con autocompletado
```

💡 **Por qué esto y no `enum Role { ADMIN, ... }` de TypeScript.** Los `enum` nativos de TypeScript tienen tres problemas conocidos:

1. **Generan código JavaScript en tiempo de ejecución** (un objeto con doble mapeo bidireccional), lo que contradice el principio de que los tipos se borran al compilar.
2. **No son compatibles con `isolatedModules`**, el modo que usan los transpiladores rápidos como esbuild y SWC. `frontend/tsconfig.json:17` lo tiene activado precisamente por eso.
3. **Los enums numéricos son inseguros:** `const r: Role = 99` compila sin error si el enum es numérico.

El patrón objeto-como-enum evita los tres. Es la recomendación actual de la comunidad TypeScript.

🔴 **Consecuencia concreta para este proyecto: los enums se duplican en Zod.** `vehicles.schemas.ts:37` escribe a mano `z.enum(['AVAILABLE','INACTIVE','IN_WORKSHOP','ON_TRIP'])`. Podría escribir `z.nativeEnum(VehicleStatus)` importando el objeto generado, y entonces sería **imposible** que divergieran. Es una mejora de una línea por schema, con impacto real: hoy, agregar un estado al enum de Prisma no rompe nada en Zod, y la API seguiría rechazando el valor nuevo con un 400 desconcertante.

### 4.5.5. `client.ts` — el punto de entrada

```ts
import * as process from 'node:process'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
globalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))

import * as runtime from "@prisma/client/runtime/client"
import * as $Enums from "./enums.js"
import * as $Class from "./internal/class.js"
import * as Prisma from "./internal/prismaNamespace.js"

export const PrismaClient = $Class.getPrismaClientClass()
export type PrismaClient<...> = $Class.PrismaClient<...>
export { Prisma }

export type User = Prisma.UserModel
export type RefreshToken = Prisma.RefreshTokenModel
// … los 12 modelos
```

**La línea 4 es un parche de compatibilidad.** `globalThis['__dirname'] = ...` recrea la variable `__dirname` (que existe en CommonJS pero no en módulos ES) a partir de `import.meta.url`. El runtime de Prisma la necesita internamente. Es exactamente el tipo de detalle que uno agradece no tener que resolver a mano.

**`export const PrismaClient = $Class.getPrismaClientClass()`** — nótese que `PrismaClient` **no es una clase declarada**, sino el resultado de llamar a una función fábrica. Prisma construye la clase dinámicamente, agregando una propiedad por modelo (`prisma.user`, `prisma.vehicle`, …) según lo que diga el esquema. Por eso `prisma.vehicle` existe: no está escrito en ningún lado, se crea en tiempo de ejecución.

**Las últimas líneas son las que importa el proyecto.** `import type { Prisma, Vehicle, VehicleStatus } from '../../generated/prisma/client'` (`vehicles.repository.ts:2`) toma:

- `Vehicle` — el tipo del registro.
- `VehicleStatus` — el enum.
- `Prisma` — el namespace, del que sale `Prisma.VehicleWhereInput` (línea 16) y `Prisma.VehicleCreateInput` (línea 71).

🔴 **`import type`, no `import`.** La palabra `type` indica que solo se importan **tipos**, no valores. El import completo se **borra** al compilar, sin generar ningún `require` ni `import` en el JavaScript final. Es importante porque evita cargar módulos innecesariamente y porque es obligatorio bajo `isolatedModules`.

### 4.5.6. Cómo un tipo generado atrapa un error real

Miremos los tipos que el proyecto realmente usa, en `vehicles.repository.ts:16`:

```ts
function buildWhere(filters: VehicleFilters): Prisma.VehicleWhereInput {
  return {
    deletedAt: null,
    status: filters.status,
    ...(filters.search ? { OR: [ { licensePlate: { contains: filters.search } }, ... ] } : {}),
  };
}
```

`Prisma.VehicleWhereInput` es un tipo generado que se ve, simplificado, así:

```ts
// — reconstrucción simplificada del tipo generado —
export type VehicleWhereInput = {
  AND?: VehicleWhereInput | VehicleWhereInput[]
  OR?: VehicleWhereInput[]
  NOT?: VehicleWhereInput | VehicleWhereInput[]
  id?: IntFilter<"Vehicle"> | number
  licensePlate?: StringFilter<"Vehicle"> | string
  model?: StringFilter<"Vehicle"> | string
  year?: IntFilter<"Vehicle"> | number
  status?: EnumVehicleStatusFilter<"Vehicle"> | $Enums.VehicleStatus
  deletedAt?: DateTimeNullableFilter<"Vehicle"> | Date | string | null
  trips?: TripListRelationFilter          // ← se puede filtrar por relación
  maintenances?: MaintenanceListRelationFilter
}
```

Y `StringFilter` (en `commonInputTypes.ts`) es:

```ts
export type StringFilter<$PrismaModel = never> = {
  equals?: string | StringFieldRefInput<$PrismaModel>
  in?: string[]
  notIn?: string[]
  lt?: string
  lte?: string
  gt?: string
  gte?: string
  contains?: string
  startsWith?: string
  endsWith?: string
  not?: NestedStringFilter<$PrismaModel> | string
}
```

**Los cuatro errores que este tipo hace imposibles:**

| Error | Qué dice el compilador |
|:--|:--|
| `{ statuss: 'AVAILABLE' }` | `Object literal may only specify known properties` |
| `{ status: 'DISPONIBLE' }` | `Type '"DISPONIBLE"' is not assignable to type 'VehicleStatus'` |
| `{ year: { contains: '2020' } }` | `contains` no existe en `IntFilter` |
| `{ deletedAt: 'ayer' }` | `Type 'string' is not assignable to 'Date \| null'`… |

⚠️ **El cuarto caso tiene un matiz.** `DateTimeNullableFilter` acepta `Date | string | null`, porque Prisma admite fechas ISO 8601 como string. Entonces `{ deletedAt: 'ayer' }` **sí compila** y falla en tiempo de ejecución al parsear. Es un recordatorio de que la seguridad de tipos tiene límites: el tipo `string` no puede expresar "una fecha ISO válida".

**Y lo que sigue siendo posible pese a los tipos:** una consulta perfectamente tipada pero **semánticamente incorrecta**. `{ status: 'AVAILABLE' }` sin `deletedAt: null` compila sin problemas y devuelve vehículos dados de baja. Los tipos protegen contra errores de forma, no contra errores de lógica de negocio. Por eso el filtro de borrado lógico está codificado dentro de `buildWhere` y no se deja a criterio de quien escriba la consulta.

---

## 4.6. Migraciones

### 4.6.1. Qué es una migración y por qué existe

Una **migración** es un archivo SQL versionado que describe un cambio en la estructura de la base de datos.

**El problema que resuelve.** Un desarrollador agrega una columna en su máquina. Los otros tres desarrolladores tienen bases sin esa columna. El servidor de pruebas también. Y el de producción, con datos reales que no se pueden perder. ¿Cómo se sincronizan todos?

**Sin migraciones:** alguien escribe el `ALTER TABLE` en un chat, cada uno lo ejecuta cuando se acuerda, alguien se olvida, y una semana después hay cuatro bases distintas y nadie sabe cuál es la correcta.

**Con migraciones:** el `ALTER TABLE` es un archivo en Git. Cada entorno ejecuta `prisma migrate deploy` y aplica exactamente las migraciones que le faltan, en el orden correcto, sin repetir ninguna.

💡 **Una migración es a la base de datos lo que un commit es al código.** Ordenada, versionada, revisable en un *pull request*, y con un historial que permite entender cómo se llegó al estado actual.

### 4.6.2. La estructura de una migración

```
backend/prisma/migrations/
├── 20260714023014_init/
│   └── migration.sql
└── migration_lock.toml
```

**El nombre de la carpeta: `20260714023014_init`**

| Parte | Valor | Qué es |
|:--|:--|:--|
| `2026` | año | |
| `07` | mes | |
| `14` | día | |
| `02` | hora (UTC) | |
| `30` | minuto | |
| `14` | segundo | |
| `_init` | nombre | El que se pasó con `--name init` |

🔴 **El prefijo temporal es lo que define el ORDEN de aplicación**, porque las carpetas se ordenan alfabéticamente y un timestamp `YYYYMMDDHHMMSS` ordena alfabéticamente igual que cronológicamente. Renombrar una carpeta de migración cambia el orden y rompe todo.

⚠️ **Un problema real que esto puede causar en equipo.** Si dos desarrolladores crean migraciones en paralelo en ramas distintas (`20260801_add_a` y `20260802_add_b`) y se mezclan en un orden distinto al de sus timestamps, un entorno que ya aplicó `add_b` no va a aplicar `add_a` en el orden esperado. Prisma detecta el desorden y avisa, pero la resolución es manual. Es la razón por la que muchos equipos exigen que las migraciones se generen solo desde la rama de integración.

**`migration_lock.toml`:**

```toml
provider = "mysql"
```

Registra el proveedor con el que se generaron las migraciones. Si alguien cambiara `provider = "mysql"` a `"postgresql"` en `schema.prisma`, Prisma compararía con este archivo y **abortaría**: las migraciones existentes tienen sintaxis de MySQL y no se pueden aplicar a PostgreSQL. Es una salvaguarda contra un error catastrófico.

### 4.6.3. `migration.sql` línea por línea

El archivo tiene 247 líneas con una estructura muy regular: primero **las 12 tablas** (líneas 1-211), después **las 12 claves foráneas** (líneas 213-247).

💡 **Por qué las claves foráneas van al final, separadas.** Una clave foránea de `trips` a `drivers` no se puede crear si `drivers` todavía no existe. Prisma podría ordenar las tablas topológicamente, pero eso falla con **ciclos** (dos tablas que se referencian mutuamente). Crear primero todas las tablas y después todas las restricciones funciona **siempre**, sin importar el orden ni los ciclos. Es una solución simple a un problema que podría ser complicado.

#### Bloque tipo: `CREATE TABLE users` (líneas 1-16)

```sql
1  -- CreateTable
2  CREATE TABLE `users` (
3      `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
4      `name` VARCHAR(100) NOT NULL,
5      `email` VARCHAR(150) NOT NULL,
6      `password_hash` VARCHAR(60) NOT NULL,
7      `role` ENUM('ADMIN', 'OPERATOR', 'DRIVER') NOT NULL,
8      `is_active` BOOLEAN NOT NULL DEFAULT true,
9      `deleted_at` DATETIME(3) NULL,
10     `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
11     `updated_at` DATETIME(3) NOT NULL,
12
13     UNIQUE INDEX `uq_users_email`(`email`),
14     INDEX `idx_users_role_active`(`role`, `is_active`),
15     PRIMARY KEY (`id`)
16 ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

| Línea | Análisis |
|:--:|:--|
| 1 | Comentario que Prisma inserta antes de cada bloque. Sirve para leer el archivo, no tiene efecto. |
| 2 | Los backticks (`` ` ``) son el delimitador de identificadores de MySQL. Protegen contra colisiones con palabras reservadas: una tabla llamada `order` sin backticks sería un error de sintaxis. Prisma los pone siempre por seguridad. |
| 3 | `AUTO_INCREMENT` implica `NOT NULL` y exige que la columna sea clave (por eso funciona junto con la línea 15). MySQL mantiene un contador interno por tabla que **nunca reutiliza valores**, ni siquiera después de borrar filas. |
| 7 | El `ENUM` de MySQL almacena internamente un entero de 1-2 bytes y una tabla de correspondencia. Ocupa mucho menos que un `VARCHAR` y **valida** el valor al insertar. |
| 8 | `BOOLEAN` en MySQL es un **alias** de `TINYINT(1)`. No existe un tipo booleano real. `true` se guarda como `1`, `false` como `0`. El driver los convierte de vuelta. |
| 9 | `DATETIME(3)` — el `(3)` es la precisión fraccional: 3 dígitos de segundo, es decir milisegundos. Sin él sería `DATETIME` con precisión de segundo. |
| 10 | `DEFAULT CURRENT_TIMESTAMP(3)` — **MySQL** evalúa esto al insertar. Genera `@default(now())` de Prisma. |
| 11 | **Sin `DEFAULT`, pero `NOT NULL`.** Es la traducción de `@updatedAt`, que maneja Prisma, no MySQL. 🔴 **Consecuencia: un `INSERT INTO users (...)` manual que no especifique `updated_at` FALLA.** La tabla solo es escribible a través de Prisma, o especificando la columna a mano. |
| 13 | `UNIQUE INDEX` — restricción **e** índice a la vez. |
| 14 | Índice compuesto, con el orden que importa (§3.5). |
| 15 | `PRIMARY KEY` — MySQL/InnoDB lo implementa como **índice agrupado**: las filas se almacenan físicamente en disco ordenadas por este valor. Buscar por `id` es la operación más rápida posible. |
| 16 | Ver abajo. |

**Línea 16 en detalle — `utf8mb4` y `utf8mb4_unicode_ci`:**

⚙️ **`utf8mb4` significa "UTF-8 de verdad", y el nombre tiene una historia.** MySQL introdujo un tipo llamado `utf8` que en realidad solo soportaba hasta **3 bytes** por carácter — suficiente para el plano básico de Unicode, pero **no** para emojis, ni para varios ideogramas CJK, ni para símbolos matemáticos, que necesitan 4 bytes. Cuando lo arreglaron, no pudieron cambiar el significado de `utf8` sin romper la compatibilidad, así que crearon `utf8mb4` (*multi-byte 4*). **`utf8` en MySQL es una trampa histórica; `utf8mb4` es el UTF-8 correcto.**

**La colación `utf8mb4_unicode_ci`** define cómo se comparan y ordenan las cadenas:

| Sufijo | Significa | Efecto |
|:--|:--|:--|
| `_ci` | *case-insensitive* | `'ADMIN' = 'admin'` es **verdadero** |
| `_ai` (implícito) | *accent-insensitive* | `'José' = 'Jose'` es **verdadero** |
| `unicode` | Algoritmo de colación Unicode | `'ñ'` ordena entre `'n'` y `'o'`, como en español |

🔴 **Consecuencias reales de `_ci` en este proyecto:**

1. **Positiva:** `admin@empresa.com` y `Admin@Empresa.com` colisionan en `uq_users_email`, evitando cuentas duplicadas por diferencia de mayúsculas. Es lo correcto para emails.
2. **Positiva:** buscar "perez" encuentra "Pérez" en el filtro de búsqueda de choferes.
3. 🔴 **Riesgosa:** si una patente fuera `AA111` y otra `aa111`, el índice único las consideraría **la misma**. En este proyecto no es problema porque `licensePlateSchema` (`vehicles.schemas.ts:11`) hace `.transform(v => v.toUpperCase().trim())`, normalizando antes de guardar. Pero la protección está en la aplicación, no en la base.
4. 🔴 **Sutil y peligrosa:** una comparación en SQL no se comporta como `===` en JavaScript. `WHERE license_plate = 'aaa111'` encuentra `AAA111`. Si algún código asumiera lo contrario, tendría un bug difícil de encontrar.

💡 **La alternativa `utf8mb4_bin`** compararía byte a byte, distinguiendo mayúsculas y acentos. Sería peor para emails y búsquedas, y mejor para identificadores estrictos. La elección correcta depende de la columna, y MySQL permite fijarla por columna — pero eso complicaría el esquema. Una colación uniforme y sensata es el intercambio razonable.

#### Las 12 claves foráneas (líneas 213-247)

Todas siguen el mismo formato:

```sql
213 -- AddForeignKey
214 ALTER TABLE `refresh_tokens` ADD CONSTRAINT `fk_refresh_tokens_user`
      FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE;
```

**Inventario completo:**

| # | Línea | Restricción | Origen → Destino | ON DELETE |
|:-:|:-:|:--|:--|:--|
| 1 | 214 | `fk_refresh_tokens_user` | `refresh_tokens.user_id` → `users.id` | **CASCADE** |
| 2 | 217 | `fk_drivers_user` | `drivers.user_id` → `users.id` | RESTRICT |
| 3 | 220 | `fk_driver_documents_driver` | `driver_documents.driver_id` → `drivers.user_id` | RESTRICT |
| 4 | 223 | `fk_maintenances_vehicle` | `maintenances.vehicle_id` → `vehicles.id` | RESTRICT |
| 5 | 226 | `fk_maintenances_type` | `maintenances.maintenance_type_id` → `maintenance_types.id` | RESTRICT |
| 6 | 229 | `fk_maintenance_attachments_maintenance` | `maintenance_attachments.maintenance_id` → `maintenances.id` | **CASCADE** |
| 7 | 232 | `fk_trips_operator` | `trips.operator_id` → `users.id` | RESTRICT |
| 8 | 235 | `fk_trips_driver` | `trips.driver_id` → `drivers.user_id` | RESTRICT |
| 9 | 238 | `fk_trips_vehicle` | `trips.vehicle_id` → `vehicles.id` | RESTRICT |
| 10 | 241 | `fk_trips_finished_by` | `trips.finished_by_id` → `users.id` | RESTRICT |
| 11 | 244 | `fk_alerts_resolved_by` | `alerts.resolved_by_id` → `users.id` | RESTRICT |
| 12 | 247 | `fk_audit_logs_user` | `audit_logs.user_id` → `users.id` | RESTRICT |

⚙️ **Efecto secundario de crear una clave foránea en InnoDB: se crea un índice automáticamente.** MySQL exige que la columna de una clave foránea esté indexada (para poder verificar la integridad sin recorrer la tabla). Si no existe un índice adecuado, lo crea solo. Por eso `trips.operator_id` tiene el índice explícito `idx_trips_operator` (`schema.prisma:242`) **y** habría tenido uno de todas formas — el explícito solo le da un nombre reconocible.

### 4.6.4. `migrate dev` vs `migrate deploy` — la distinción crítica

| | `prisma migrate dev` | `prisma migrate deploy` |
|:--|:--|:--|
| **Para** | Desarrollo local | **Producción** |
| Genera migraciones nuevas | ✅ Sí | ❌ No |
| Usa base *shadow* | ✅ Sí | ❌ No |
| **Puede borrar la base** | ⚠️ **Sí**, si detecta divergencia | ❌ **Nunca** |
| Ejecuta el seed | ✅ Sí, tras un reset | ❌ No |
| Regenera el cliente | ✅ Sí | ❌ No |
| Es interactivo | ✅ Pregunta y confirma | ❌ No, apto para automatización |

🔴 **Ejecutar `migrate dev` en producción puede destruir todos los datos.** Si detecta que la base no coincide con lo que las migraciones esperan, ofrece resetearla — y en un entorno no interactivo, esa oferta puede aceptarse sola. `migrate deploy` solo aplica las migraciones pendientes y falla si algo no cuadra, sin tocar nada.

**El comando de producción correcto sería:**

```bash
npx prisma migrate deploy && node dist/server.js
```

⚠️ **Este proyecto no documenta el flujo de producción.** El `README.md` solo indica `npx prisma migrate dev --name init`, que es correcto para desarrollo. No hay Dockerfile, ni script de despliegue, ni mención de `migrate deploy`. Es coherente con el alcance académico del proyecto, pero es una omisión que hay que señalar: alguien que intentara desplegarlo siguiendo el README podría perder datos.

### 4.6.5. La tabla `_prisma_migrations`

Prisma crea automáticamente esta tabla en la base:

| Columna | Contenido |
|:--|:--|
| `id` | UUID de la migración. |
| `checksum` | **Hash SHA-256 del contenido de `migration.sql`.** |
| `finished_at` | Cuándo terminó de aplicarse. |
| `migration_name` | `20260714023014_init` |
| `logs` | Errores, si los hubo. |
| `rolled_back_at` | Si se marcó como revertida. |
| `started_at` | Cuándo empezó. |
| `applied_steps_count` | Cuántas sentencias se ejecutaron. |

🔴 **El `checksum` es la salvaguarda más importante.** Si alguien **edita** un `migration.sql` ya aplicado, el hash deja de coincidir y Prisma **se niega a continuar**. Y con razón: los entornos que ya aplicaron la versión anterior tienen una estructura distinta de la que dice el archivo, y nadie puede saber cuál es correcta.

💡 **La regla de oro: una migración aplicada es inmutable.** Si algo está mal, se crea una migración nueva que lo corrija. Nunca se edita una existente. Es exactamente la misma regla que "no reescribas commits ya publicados".

---

## 4.7. `seed.ts` línea por línea

373 líneas que pueblan la base con datos coherentes y realistas. Es, con diferencia, el archivo más largo escrito a mano del backend, y es el que hace que el sistema sea demostrable.

### 4.7.1. Cabecera e imports (líneas 1-19)

```ts
1  /**
2   * Integral database seed (F-1) — coherent sample data that exercises every
3   * module: users (all roles), drivers with varied license states, a fleet in
4   * different statuses, documents with varied expiries, maintenances (history
5   * and in-progress) and trips (completed, in-progress, pending).
6   *
7   * Dates are relative to "today" so the alert evaluator and the reports have
8   * meaningful data whenever the seed is run.
9   *
10  * Idempotent: catalog/users/drivers/vehicles are upserted by natural keys;
11  * transactional sample data (documents, maintenances, trips) is cleared for
12  * the sample entities and recreated, so the seed is safe to re-run.
13  */
14 import bcrypt from 'bcryptjs';
15 import { prisma } from '../src/database/prisma-client';
16 import { encrypt } from '../src/shared/utils/crypto';
17 import { FIXED_TRIP_ORIGIN } from '../src/config/constants';
18
19 const BCRYPT_ROUNDS = 10;
```

**El comentario declara tres propiedades de diseño**, y las tres son decisiones no triviales:

1. **Cobertura completa** (líneas 2-5): los datos ejercitan **todos** los módulos. Un seed que solo cree un usuario y un vehículo dejaría media aplicación con pantallas vacías, imposible de demostrar.
2. **Fechas relativas** (líneas 7-8): se explica en §4.7.2.
3. **Idempotencia** (líneas 10-12): se explica en §4.7.4.

**Línea 15 — `import { prisma } from '../src/database/prisma-client'`**

El seed **reutiliza la misma instancia** que la aplicación, con el mismo adaptador y el mismo pool. No crea un cliente propio. Consecuencia práctica: el seed hereda toda la configuración de conexión, incluida la validación de entorno de `config/env.ts` (que se ejecuta como efecto secundario del import en cadena).

**Línea 16 — `import { encrypt }`**

El seed cifra las contraseñas de choferes con **exactamente la misma función** que usa la aplicación en producción. Si `encrypt` cambiara de algoritmo, los datos sembrados seguirían siendo descifrables. Reimplementar el cifrado en el seed sería un error clásico que produce datos que la aplicación no puede leer.

**Línea 17 — `import { FIXED_TRIP_ORIGIN }`**

Igual: el origen fijo se toma de la constante compartida, no se copia. (Aunque, como se señaló en §3.4.9, esa constante **está duplicada** con el `@default` de `schema.prisma:215`.)

**Línea 19 — `const BCRYPT_ROUNDS = 10`**

El **factor de coste** de bcrypt. El número es un exponente: 10 significa 2¹⁰ = 1.024 iteraciones internas.

| Coste | Iteraciones | Tiempo aproximado |
|:--:|--:|--:|
| 8 | 256 | ~25 ms |
| **10** | **1.024** | **~100 ms** |
| 12 | 4.096 | ~400 ms |
| 14 | 16.384 | ~1,6 s |

💡 **Por qué 10 y no más.** El seed hashea 6 contraseñas. Con coste 10 son ~600 ms; con 14 serían ~10 segundos. Pero el argumento real no es el seed: es el **login**. bcrypt es síncrono en su núcleo, y en Node —de un solo hilo— cada verificación **bloquea el event loop** durante ese tiempo. Con coste 14, diez logins simultáneos congelarían el servidor 16 segundos.

🔴 **10 es el mínimo aceptable hoy, y va a quedar corto.** La recomendación de OWASP es coste 10 como piso, y la potencia de cálculo crece. El valor debería ser configurable por variable de entorno, para poder subirlo sin tocar código. Además, esta constante **está solo en el seed**: la aplicación tiene su propio valor en `auth.service.ts` / `users.service.ts`. Si divergen, no pasa nada malo (bcrypt guarda el coste dentro del hash y lo respeta al verificar), pero es duplicación innecesaria.

### 4.7.2. Las funciones de fecha (líneas 21-30)

```ts
21 /** Date offsets from today (UTC midnight), for readable relative dates. */
22 function daysFromNow(days: number): Date {
23   const d = new Date();
24   d.setUTCHours(0, 0, 0, 0);
25   d.setUTCDate(d.getUTCDate() + days);
26   return d;
27 }
28 function hoursAgo(hours: number): Date {
29   return new Date(Date.now() - hours * 3600 * 1000);
30 }
```

**Línea 23 — `new Date()`** — el instante actual, con hora, minutos, segundos y milisegundos.

**Línea 24 — `d.setUTCHours(0, 0, 0, 0)`**

Pone hora, minuto, segundo y milisegundo a cero **en UTC**.

🔴 **`setUTCHours`, no `setHours`. La diferencia es la causa de una clase entera de bugs.**

En Argentina (UTC−3), a las 21:00 del 3 de agosto hora local son las 00:00 del 4 de agosto en UTC.

| Método | Resultado |
|:--|:--|
| `setHours(0,0,0,0)` | `2026-08-03T00:00:00` **local** = `2026-08-03T03:00:00Z` |
| `setUTCHours(0,0,0,0)` | `2026-08-03T00:00:00Z` ✅ |

Las columnas `DATE` de MySQL vuelven de Prisma como **medianoche UTC** del día calendario. Para comparar contra ellas hay que construir también medianoche UTC. Si se usara `setHours`, todas las comparaciones estarían desplazadas 3 horas, y una licencia que vence hoy figuraría como vencida.

Esto es exactamente lo que documenta `shared/utils/dates.ts:1-10` en su comentario de diez líneas:

> *"To compare them against 'today' the reference must ALSO be midnight UTC of the local calendar date — building local midnight would shift the boundary by the timezone offset (UTC-3 in Argentina) and make a license expiring today read as already expired (violating RN-1: valid through its expiry date)."*

💡 **Que este razonamiento esté documentado tanto en `dates.ts` como implícito en `seed.ts` es señal de que alguien ya se quemó con esto.** Los comentarios largos suelen ser cicatrices de bugs reales.

⚠️ **Duplicación menor.** `daysFromNow` reimplementa parcialmente lo que hace `utcStartOfToday()` en `shared/utils/dates.ts:11`. Podría importarlo y sumarle días. Es duplicación de tres líneas, pero es duplicación de **lógica delicada** — precisamente la que no conviene tener en dos lugares.

**Línea 25 — `d.setUTCDate(d.getUTCDate() + days)`**

Suma días. `setUTCDate` acepta valores fuera del rango 1-31 y **normaliza automáticamente**: `setUTCDate(35)` en agosto da el 4 de septiembre. Y maneja bisiestos y fines de mes sin código adicional.

🔴 **Lo que NO maneja: el horario de verano.** Sumar 30 días a una fecha atravesando un cambio de DST puede dar una diferencia de 23 o 25 horas si se trabaja en hora local. Como todo aquí es UTC —que no tiene DST— el problema no se presenta. **Es otra razón para trabajar siempre en UTC internamente y convertir a hora local solo al mostrar.**

**Líneas 28-30 — `hoursAgo`**

```ts
return new Date(Date.now() - hours * 3600 * 1000);
```

`Date.now()` devuelve milisegundos desde el 1 de enero de 1970 UTC (*epoch*). Restar `hours * 3600 * 1000` da el instante N horas atrás. Aritmética simple sobre un número, sin ambigüedad de zona horaria.

**Por qué dos funciones distintas.** `daysFromNow` produce **medianoche UTC** (para columnas `DATE`: vencimientos). `hoursAgo` produce un **instante exacto** (para columnas `DATETIME`: cuándo salió un viaje). Usar la equivocada produce datos que se ven bien pero se comportan mal.

### 4.7.3. `seedCatalog` (líneas 32-70)

```ts
32 async function seedCatalog(): Promise<void> {
33   await prisma.maintenanceType.upsert({
34     where: { name: 'Preventivo menor' },
35     update: {},
36     create: {
37       name: 'Preventivo menor',
38       description: 'Cambio de aceite, filtros y engrase',
39       kmAlert: 10000,
40       kmTarget: 20000,
41       monthsAlert: 3,
42       monthsTarget: 6,
43     },
44   });
```

**`upsert` — la operación clave del seed.** Es una fusión de *update* e *insert*:

```mermaid
graph TD
    A["upsert({ where, update, create })"] --> B{"¿Existe una fila<br/>que cumpla 'where'?"}
    B -->|"Sí"| C["Aplica 'update'"]
    B -->|"No"| D["Aplica 'create'"]
    C --> E["Devuelve la fila"]
    D --> E

    style B fill:#fff9c4,stroke:#f57f17
```

**Línea 34 — `where: { name: 'Preventivo menor' }`**

🔴 **Esto solo funciona porque `name` tiene `@unique`** (`schema.prisma:163`). El tipo `MaintenanceTypeWhereUniqueInput` **solo admite campos únicos**. Intentar `where: { description: '...' }` sería un error de compilación. Prisma hace imposible un `upsert` ambiguo.

**Línea 35 — `update: {}` — un objeto vacío, y es deliberado**

Significa: *"si ya existe, no cambies nada"*. El efecto es **"crear si no existe"**.

💡 **Por qué no actualizar.** Si un administrador ajustó `kmAlert` a 12.000 para su operación, volver a correr el seed **no debe pisarle la configuración**. El seed provee datos iniciales, no impone un estado.

⚠️ **Contrástese con `upsertUser` (línea 85), que sí actualiza** (`update: { name, role }`). Ahí la decisión es la inversa: los usuarios de demostración deben tener siempre el nombre y el rol esperados, porque son parte del guion de la demo. **Son dos políticas distintas para dos propósitos distintos, y ambas son correctas en su contexto.**

**Líneas 39-42 — los umbrales**

`kmAlert: 10000, kmTarget: 20000` — avisar a los 10.000 km, exigir a los 20.000. `monthsAlert: 3, monthsTarget: 6` — o a los 3 meses, exigir a los 6. Valores realistas para un service de rutina.

**Líneas 58-69 — `companySettings`**

```ts
await prisma.companySettings.upsert({
  where: { id: 1 },
  update: {},
  create: { id: 1, companyName: 'Empresa de Servicios Logísticos', ... },
});
```

El patrón *singleton table* de §3.4.12 en acción: `where: { id: 1 }` y `create` con `id: 1` explícito.

⚠️ **`timezone`, `language` y `dateFormat` no se especifican en el `create`.** Toman sus valores por defecto del esquema (`America/Argentina/Cordoba`, `es-AR`, `DD/MM/YYYY`). Es correcto, pero implícito: quien lea solo el seed no sabe qué zona horaria queda configurada.

### 4.7.4. Las funciones auxiliares de usuario (líneas 72-110)

```ts
72 interface SeededUser {
73   id: number;
74 }
75
76 async function upsertUser(
77   name: string,
78   email: string,
79   role: 'ADMIN' | 'OPERATOR' | 'DRIVER',
80   password: string,
81 ): Promise<SeededUser> {
82   const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
83   return prisma.user.upsert({
84     where: { email },
85     update: { name, role },
86     create: { name, email, passwordHash, role },
87     select: { id: true },
88   });
89 }
```

**Líneas 72-74 — una interfaz de una sola propiedad**

Podría ser `{ id: number }` en línea. Tener el nombre `SeededUser` documenta la intención: *"esto es un usuario recién sembrado, del que solo nos interesa el id"*.

**Línea 79 — el tipo de `role` escrito a mano**

```ts
role: 'ADMIN' | 'OPERATOR' | 'DRIVER',
```

🔴 **Debería ser `role: Role`, importando el enum generado.** Escribir la unión a mano significa que agregar un rol nuevo al esquema **no produce ningún error** aquí: el seed simplemente no lo soportaría, en silencio. Es la tercera aparición del mismo antipatrón (junto con los `z.enum` de los schemas de Zod). El arreglo es un import.

**Línea 82 — `await bcrypt.hash(password, BCRYPT_ROUNDS)`**

⚙️ **Qué hace bcrypt internamente:**

1. Genera una **sal** aleatoria de 16 bytes.
2. Ejecuta 2¹⁰ = 1.024 rondas del algoritmo Eksblowfish (una variante de Blowfish con expansión de clave costosa).
3. Devuelve el string de 60 caracteres que contiene versión, coste, sal y hash (§3.4.1).

🔴 **`bcrypt.hash` es asíncrono, pero su trabajo es CPU-bound.** El `await` no libera el event loop de la misma forma que una operación de I/O: `bcryptjs` es una implementación **pura en JavaScript**, y el cálculo ocurre en el hilo principal, troceado en fragmentos. Bloquea de todas formas, solo que en pedazos.

⚠️ **`bcryptjs` vs `bcrypt`.** El proyecto usa `bcryptjs` (JavaScript puro). La alternativa `bcrypt` es un módulo nativo en C++ que corre en el *thread pool* de libuv y **no bloquea** el hilo principal, además de ser ~30% más rápido. Su desventaja: requiere compilación durante `npm install`, lo que genera problemas de instalación en algunos entornos (Windows sin herramientas de compilación, imágenes Docker Alpine). Para este proyecto, `bcryptjs` es la elección pragmática. Para una aplicación con muchos logins concurrentes, `bcrypt` nativo sería mejor.

**Línea 84 — `where: { email }`**

El email es la **clave natural** del usuario: el identificador que tiene significado de negocio, a diferencia del `id` autoincremental que es artificial. En un seed hay que usar claves naturales, porque los ids no se conocen de antemano y cambian entre ejecuciones.

**Línea 86 — `create: { name, email, passwordHash, role }`**

Nótese que el `create` incluye `passwordHash` pero el `update` (línea 85) **no**.

💡 **Es deliberado y muy razonable: si el usuario ya existe y cambió su contraseña, el seed no se la pisa.** Solo sincroniza nombre y rol, que son datos del guion de la demo. Es respeto por el estado del usuario.

**Línea 87 — `select: { id: true }`**

Pide **solo** la columna `id`. Sin esto, Prisma devolvería las 9 columnas del usuario, incluido `passwordHash`.

**Tres beneficios concretos:**
1. Menos datos por la red.
2. **El hash de contraseña nunca llega a la memoria del proceso** cuando no hace falta.
3. El tipo de retorno es `{ id: number }` exacto, que encaja con `SeededUser`.

⚙️ **Prisma traduce esto a `SELECT id FROM users WHERE ...`**, no a `SELECT *`. La reducción de datos es real, no cosmética. Este patrón se repite en todo el proyecto (`vehicles.repository.ts:57`, `:65`, `:66`).

**Líneas 91-110 — `upsertDriver`**

```ts
async function upsertDriver(
  user: SeededUser, dni: string, licenseCategory: 'A'|'B'|'C'|'E',
  licenseExpiryDate: Date, password: string,
): Promise<number> {
  await prisma.driver.upsert({
    where: { userId: user.id },
    update: { dni, licenseCategory, licenseExpiryDate },
    create: { userId: user.id, dni, licenseCategory, licenseExpiryDate,
              encryptedPassword: encrypt(password) },
  });
  return user.id;
}
```

**`where: { userId: user.id }`** — funciona porque `userId` es la clave primaria de `Driver` (§3.4.3).

🔴 **`encryptedPassword` está en `create` pero NO en `update`.** Consecuencia: si el chofer ya existe, la contraseña cifrada **no se regenera**. Coherente con la política de `upsertUser` (no pisar contraseñas), pero crea una posible incoherencia: si alguien cambió `passwordHash` en `users` por otro camino, `encryptedPassword` en `drivers` seguiría teniendo la vieja. El sistema tendría dos versiones de la contraseña que no coinciden — y el administrador vería la equivocada.

**`return user.id`** — devuelve el id para que el llamador lo use como `driverId`. Refuerza que en este modelo, el id del chofer **es** el id del usuario.

### 4.7.5. `main` — el guion completo (líneas 112-325)

#### Usuarios y choferes (líneas 115-137)

```ts
115 // --- Users: admin + operator ---
116 const admin = await upsertUser('Administrador General', 'admin@empresa.com', 'ADMIN', 'Admin1234!');
117 const operator = await upsertUser('Operador de Logística', 'operador@empresa.com', 'OPERATOR', 'Operator1234!');
118
124 // --- Drivers with varied license states ---
125 const juanUser = await upsertUser('Juan Pérez', 'chofer@empresa.com', 'DRIVER', 'Driver1234!');
126 const juanId = await upsertDriver(juanUser, '30123456', 'C', daysFromNow(400), 'Driver1234!');
127
128 const mariaUser = await upsertUser('María Gómez', 'maria@empresa.com', 'DRIVER', 'Driver1234!');
129 const mariaId = await upsertDriver(mariaUser, '28111222', 'B', daysFromNow(300), 'Driver1234!');
130
131 const carlosUser = await upsertUser('Carlos Ruiz', 'carlos@empresa.com', 'DRIVER', 'Driver1234!');
132 // License expiring within 10 days → LICENSE_EXPIRING alert.
133 const carlosId = await upsertDriver(carlosUser, '32333444', 'C', daysFromNow(10), 'Driver1234!');
134
135 const luciaUser = await upsertUser('Lucía Fernández', 'lucia@empresa.com', 'DRIVER', 'Driver1234!');
136 // License expired 5 days ago → LICENSE_EXPIRED; not assignable (RN-1).
137 await upsertDriver(luciaUser, '27555666', 'E', daysFromNow(-5), 'Driver1234!');
```

**Los cuatro choferes son cuatro casos de prueba, no cuatro nombres al azar:**

| Chofer | Vencimiento | Días | Escenario que ejercita |
|:--|:--|--:|:--|
| Juan Pérez | `daysFromNow(400)` | +400 | ✅ Normal, asignable. |
| María Gómez | `daysFromNow(300)` | +300 | ✅ Normal, tiene un viaje en curso. |
| Carlos Ruiz | `daysFromNow(10)` | +10 | ⚠️ Dentro de los 14 días de `EXPIRY_ALERT_LEAD_DAYS` → **genera alerta**. |
| Lucía Fernández | `daysFromNow(-5)` | −5 | 🔴 Vencida → **no asignable** (RN-1) + alerta. |

💡 **Este es el rasgo más valioso del seed.** Cada dato existe para **demostrar un comportamiento**. Un seed con cuatro choferes idénticos no probaría nada; con estos cuatro se puede recorrer toda la lógica de licencias sin tocar la base a mano.

**Nótese la relación entre `daysFromNow(10)` y `EXPIRY_ALERT_LEAD_DAYS = 14`** (`config/constants.ts:13`). El 10 no es arbitrario: está elegido para caer **dentro** de la ventana de aviso. Si alguien cambiara la constante a 7, Carlos dejaría de generar alerta y la demostración se rompería en silencio.

🔴 **Todos los choferes comparten la contraseña `Driver1234!`.** Aceptable en datos de demostración, catastrófico si alguien corriera el seed contra producción. `README.md` publica esas credenciales, con lo cual quedan en el repositorio. **El seed debería negarse a ejecutarse si `NODE_ENV === 'production'`.** Es una guarda de tres líneas que hoy no está, y es una omisión con consecuencias severas:

```ts
// — mejora propuesta —
if (process.env.NODE_ENV === 'production') {
  throw new Error('El seed no debe ejecutarse en producción');
}
```

#### La flota (líneas 139-211)

Cinco vehículos, cada uno con un propósito distinto:

| Patente | Modelo | Estado | km acum. | Seguro | Qué demuestra |
|:--|:--|:--|--:|:--|:--|
| `AAA111` | Mercedes Sprinter | `AVAILABLE` | 45.000 | +200 d | ✅ Caso normal, asignable. |
| `BBB222` | Iveco Daily | `AVAILABLE` | 95.000 | **+7 d** | ⚠️ 15.000 km desde el último mantenimiento → alerta de km. Y seguro por vencer → segunda alerta. |
| `CCC333` | Ford Transit | `INACTIVE` | 120.000 | **−15 d** | 🔴 Inactivo (alerta) + seguro **vencido** (alerta). |
| `DDD444` | VW Crafter | `ON_TRIP` | 30.000 | +180 d | 🔵 Ocupado: lleva el viaje en curso de María. |
| `EEE555` | Renault Master | `IN_WORKSHOP` | 60.000 | +150 d | 🔧 En taller: tiene un mantenimiento en curso. |

**Los cinco estados posibles de `VehicleStatus` están representados**… salvo que hay dos `AVAILABLE` y ningún caso adicional. En realidad son los 4 estados del enum, con `AVAILABLE` duplicado a propósito para tener uno "limpio" y uno "con alertas".

**Línea 163 — el comentario más informativo del archivo:**

```ts
accumulatedKm: 95000, // 15000 km since last maintenance → MAINTENANCE_KM_EXCEEDED
```

Se conecta con la línea 260, donde el mantenimiento completado de `BBB222` registró `km: 80000`. La diferencia 95.000 − 80.000 = 15.000 supera el `kmAlert` de 10.000 del tipo "Preventivo menor". **El dato está calculado para disparar exactamente esa alerta.**

🔴 **Y ahí está la fragilidad: esa coherencia es puramente manual.** Si alguien cambia `kmAlert` a 20.000 en la línea 39, el vehículo `BBB222` deja de generar alerta y nada avisa. El seed no verifica sus propias invariantes. Un seed más robusto tendría aserciones al final (`assert(alertas.length === 7)`).

**Líneas 140, 155, 170… — `select: { id: true }`** en todos los `upsert` de vehículo. Mismo patrón de eficiencia y seguridad que en `upsertUser`.

#### El reset de datos transaccionales (líneas 213-220)

```ts
213 // --- Reset transactional sample data (idempotent re-run) ---
214 const sampleDriverIds = [juanId, mariaId, carlosId, luciaUser.id];
215 const sampleVehicleIds = [vAAA.id, vBBB.id, vCCC.id, vDDD.id, vEEE.id];
216 await prisma.trip.deleteMany({
217   where: { OR: [{ driverId: { in: sampleDriverIds } }, { operatorId: operator.id }] },
218 });
219 await prisma.maintenance.deleteMany({ where: { vehicleId: { in: sampleVehicleIds } } });
220 await prisma.driverDocument.deleteMany({ where: { driverId: { in: sampleDriverIds } } });
```

**Este bloque es la clave de la idempotencia**, y merece un análisis detallado.

**El problema.** Los viajes, mantenimientos y documentos **no tienen clave natural**. No hay un campo único por el cual hacer `upsert`. Correr el seed dos veces crearía duplicados: 6 viajes en vez de 3, 12 documentos en vez de 6.

**La solución.** Borrar los de las entidades de demostración y recrearlos.

**Línea 214 — nótese la asimetría:** `juanId`, `mariaId` y `carlosId` vienen de `upsertDriver` (que devuelve `user.id`), pero Lucía usa `luciaUser.id` directamente, porque en la línea 137 no se guardó el retorno. Funcionalmente idéntico, estilísticamente inconsistente.

**Línea 217 — el `OR`, y por qué está**

```ts
where: { OR: [{ driverId: { in: sampleDriverIds } }, { operatorId: operator.id }] }
```

Borra los viajes que **o bien** tienen un chofer de demostración, **o bien** los creó el operador de demostración.

💡 **La segunda condición existe para atrapar el viaje pendiente.** El viaje `PENDING_ASSIGNMENT` de la línea 307 **no tiene chofer** (`driverId` es `NULL`), así que la primera condición no lo encontraría. `NULL in [...]` es `NULL` en SQL, nunca verdadero. Sin `operatorId`, cada ejecución del seed acumularía un viaje pendiente más.

🔴 **Riesgo real y no acotado de este `deleteMany`.** Si un usuario de la aplicación creó viajes usando la cuenta `operador@empresa.com` (que el README publica), **esos viajes se borran** al correr el seed. Y `deleteMany` es un `DELETE` **físico**, no lógico: contradice la política RN-20 de todo el resto del sistema.

**Es defendible en un seed** (son datos de demostración), pero refuerza que el seed **nunca debe correr contra una base con datos reales**. Otra razón para la guarda de `NODE_ENV` propuesta arriba.

⚠️ **Y hay un orden implícito no documentado.** Las líneas 216-220 borran en un orden que respeta las claves foráneas: primero `trips` (que referencia a `drivers` y `vehicles`), después `maintenances`, después `driverDocument`. Invertir el orden no rompería nada aquí porque no hay dependencias entre esos tres, pero si en el futuro `maintenance_attachments` tuviera que borrarse explícitamente, el orden importaría.

**Líneas 223-226 — recuperar el id del tipo de mantenimiento:**

```ts
const minorType = await prisma.maintenanceType.findUniqueOrThrow({
  where: { name: 'Preventivo menor' },
  select: { id: true },
});
```

`findUniqueOrThrow` en vez de `findUnique`: si no existe, **lanza** en lugar de devolver `null`. El tipo de retorno es `{ id: number }` en lugar de `{ id: number } | null`, lo que evita tener que comprobar nulos. Como `seedCatalog()` corrió antes y lo creó, la existencia está garantizada; si no lo estuviera, fallar ruidosamente es mejor que un `null` propagándose.

#### Los documentos (líneas 228-237)

```ts
228 await prisma.driverDocument.createMany({
229   data: [
230     docFor(juanId, 'DNI', daysFromNow(500)),
231     docFor(juanId, 'LICENSE', daysFromNow(400)),
232     docFor(juanId, 'ART', daysFromNow(12)),        // → DOCUMENT_EXPIRING
233     docFor(juanId, 'PSYCHOPHYSICAL', daysFromNow(220)),
234     docFor(mariaId, 'DNI', daysFromNow(480)),
235     docFor(mariaId, 'ART', daysFromNow(-3)),       // → DOCUMENT_EXPIRED
236   ],
237 });
```

**`createMany` vs varios `create`.** `createMany` genera **un solo `INSERT` con múltiples `VALUES`**:

```sql
INSERT INTO driver_documents (driver_id, document_type, ...)
VALUES (?,?,...), (?,?,...), (?,?,...), (?,?,...), (?,?,...), (?,?,...);
```

Seis `create` serían seis idas y vueltas a la base. Uno solo es una. La diferencia con seis filas es despreciable; con seis mil es de segundos a milisegundos.

🔴 **La limitación de `createMany`: no devuelve las filas creadas** (en MySQL). Devuelve `{ count: 6 }`. Si hicieran falta los ids, habría que usar `create` individualmente o consultar después. Acá no hacen falta.

**Los escenarios que codifican los seis documentos:**

| Chofer | Documentos | Estado |
|:--|:--|:--|
| Juan | DNI, LICENSE, ART, PSYCHOPHYSICAL | ✅ Los **cuatro** obligatorios (RN-4) — asignable. Pero ART vence en 12 días → alerta. |
| María | DNI, ART | 🔴 Le **faltan** LICENSE y PSYCHOPHYSICAL. Y su ART está vencido hace 3 días. |
| Carlos | *(ninguno)* | 🔴 Sin documentación: caso extremo. |
| Lucía | *(ninguno)* | 🔴 Sin documentación **y** licencia vencida. |

💡 **María es el caso más interesante del seed.** Tiene documentación incompleta y vencida, **pero tiene un viaje en curso** (línea 290). Eso representa la situación real de un viaje que se asignó antes de que la documentación venciera. Permite demostrar que el sistema no interrumpe viajes en curso, solo impide asignaciones nuevas.

**`docFor` (líneas 327-337)** — una fábrica de objetos:

```ts
function docFor(driverId: number, documentType: 'DNI'|'LICENSE'|'ART'|'PSYCHOPHYSICAL', expiryDate: Date) {
  return {
    driverId, documentType, expiryDate,
    fileName: `${documentType.toLowerCase()}.pdf`,
    filePath: `uploads/documents/sample-${driverId}-${documentType.toLowerCase()}.pdf`,
    mimeType: 'application/pdf',
    fileSize: 1024,
  };
}
```

🔴 **Los archivos referenciados NO EXISTEN en el disco.** `uploads/documents/sample-3-dni.pdf` es una ruta inventada. Los metadatos están en la base, el archivo no está en ningún lado.

**Consecuencia concreta:** intentar descargar un documento sembrado desde la interfaz produce un error de archivo no encontrado. **Es un fallo de la demostración que no está documentado en ninguna parte.** El README no lo menciona, la guía de pruebas E2E tampoco. Alguien que siga el guion se va a encontrar con un error inexplicable.

**Las dos soluciones posibles:** (a) que el seed genere PDFs reales de un byte en esas rutas, (b) documentarlo explícitamente como limitación conocida. Ninguna de las dos está hecha. Es la deuda más concreta que se detecta en este archivo.

**Sin tipo de retorno declarado.** `docFor` no anota su retorno; TypeScript lo infiere. Como se pasa a `createMany`, cualquier incompatibilidad se detectaría ahí. Funciona, pero contradice la convención del proyecto de anotar retornos en funciones exportadas (aunque esta no se exporta).

#### Los mantenimientos (líneas 239-272)

Tres mantenimientos que forman una historia coherente:

| # | Vehículo | Estado | `scheduledAt` | `completedAt` | `km` | `nextMaintenanceKm` |
|:-:|:--|:--|:--|:--|--:|--:|
| 1 | AAA111 | `COMPLETED` | −62 d | −60 d | 40.000 | 50.000 |
| 2 | BBB222 | `COMPLETED` | −122 d | −120 d | 80.000 | 90.000 |
| 3 | EEE555 | `IN_PROGRESS` | hace 6 h | `NULL` | 60.000 | `NULL` |

**Las coherencias que hay que verificar, y que efectivamente se cumplen:**

1. `completedAt` (−60 d) coincide con `vehicles.lastMaintenanceDate` de AAA111 (línea 149: `daysFromNow(-60)`). ✅
2. Ídem para BBB222: −120 días en ambos lados (líneas 164 y 259). ✅
3. El mantenimiento `IN_PROGRESS` de EEE555 justifica su estado `IN_WORKSHOP` (línea 208). ✅
4. `nextMaintenanceKm` = `km` + 10.000, que coincide con `kmAlert`, no con `kmTarget` (20.000). ⚠️

🔴 **El punto 4 revela algo que no es lo que parece a primera vista.** Verificado contra el código: `maintenances.service.ts` **no calcula** `nextMaintenanceKm`. Lo recibe del DTO (`maintenances.service.ts:122` y `:174`), es decir, **lo escribe el usuario a mano** en el formulario. La única validación es que sea mayor o igual que `km` (`maintenances.service.ts:159-161`).

**Consecuencias de ese hallazgo:**

- El campo `maintenance_types.km_target` **no se usa para calcular nada**. Es un dato informativo del catálogo que ninguna lógica consume.
- La coherencia entre `nextMaintenanceKm` y el tipo de mantenimiento depende enteramente de que el usuario cargue bien el número.
- El motor de alertas, por su parte, **tampoco usa `nextMaintenanceKm`**: `alerts.service.ts:133-134` toma el **mínimo `kmAlert` de todos los tipos** y lo compara contra `accumulatedKm − baseline`. Es una heurística global, no una comparación por mantenimiento.

💡 **La conclusión es más incómoda que un simple error del seed.** Hay dos mecanismos de umbral que no se hablan entre sí: uno manual por mantenimiento (`nextMaintenanceKm`) y uno automático global (`min(kmAlert)`). El seed usa el valor de `kmAlert` para `nextMaintenanceKm`, lo que sugiere que quien lo escribió tenía en mente el primer mecanismo, pero el sistema en realidad usa el segundo. Se analiza en detalle en los capítulos 13 y 14.

**Línea 253-262 — el segundo mantenimiento no tiene `notes`.** El campo es opcional. Demuestra que la interfaz debe manejar el caso "sin observaciones" — un detalle pequeño pero que ejercita un camino de código.

#### Los viajes (líneas 274-317)

**Tres viajes completados** (líneas 276-284), vía la fábrica `completedTrip`:

```ts
await prisma.trip.create({ data: completedTrip(operator.id, juanId, vAAA.id, 'Córdoba', 44500, 45000, 30, 26) });
await prisma.trip.create({ data: completedTrip(operator.id, juanId, vAAA.id, 'Santa Fe', 44000, 44500, 12, 20) });
await prisma.trip.create({ data: completedTrip(operator.id, mariaId, vBBB.id, 'Buenos Aires', 94000, 95000, 48, 40) });
```

⚠️ **Hay una inconsistencia temporal en el segundo viaje.** Los parámetros son `hoursAgoDeparture = 12` y `hoursAgoFinish = 20`: **salió hace 12 horas y llegó hace 20**. Es decir, **llegó antes de salir**.

Comparando con el primero (salió hace 30 h, llegó hace 26 h: correcto) y el tercero (salió hace 48 h, llegó hace 40 h: correcto), es evidente que el segundo tiene los argumentos invertidos. Debería ser `(20, 12)`.

**Consecuencia:** cualquier reporte que calcule duración real (`finishedAt − departureAt`) obtendrá **−8 horas** para ese viaje. Un promedio de duración saldría distorsionado, y un gráfico podría mostrar una barra negativa. **Es un bug de datos que nadie detectó porque el sistema no valida esa invariante.**

💡 **Y ahí está la lección más valiosa: el sistema debería rechazar `finishedAt < departureAt`.** No lo hace ni en la base (no hay `CHECK`), ni en el schema de Zod, ni en el servicio. El seed lo expone accidentalmente. Este hallazgo se registra en el capítulo 25 como mejora concreta.

**Verificación de los kilometrajes:**

| Viaje | `departureKm` | `arrivalKm` | Recorrido |
|:--|--:|--:|--:|
| Córdoba | 44.500 | 45.000 | 500 km |
| Santa Fe | 44.000 | 44.500 | 500 km |
| Buenos Aires | 94.000 | 95.000 | 1.000 km |

✅ **Coherencia con la flota:** AAA111 tiene `accumulatedKm: 45000` (línea 148), que es exactamente el `arrivalKm` del último viaje. BBB222 tiene 95.000 (línea 163), idem. **El seed mantiene la invariante `vehicles.accumulatedKm = último arrivalKm`.** Eso es cuidado real.

✅ **Y el orden cronológico también cuadra:** el viaje a Santa Fe (44.000→44.500) es anterior al de Córdoba (44.500→45.000), y efectivamente el de Santa Fe salió hace más tiempo… salvo por la inversión de argumentos ya señalada.

**Líneas 286-287 — las estadísticas desnormalizadas:**

```ts
// Keep denormalized driver stats coherent with the completed trips above.
await prisma.driver.update({ where: { userId: juanId }, data: { completedTrips: 2, avgKm: 500 } });
await prisma.driver.update({ where: { userId: mariaId }, data: { completedTrips: 1, avgKm: 1000 } });
```

**Verificación:** Juan hizo 2 viajes de 500 km cada uno → `completedTrips: 2`, `avgKm: 500`. ✅ María hizo 1 de 1.000 km → `completedTrips: 1`, `avgKm: 1000`. ✅

🔴 **Que el seed tenga que hacer esto A MANO es la prueba viviente del costo de la desnormalización de §3.4.3.** Los campos `completedTrips` y `avgKm` no se derivan solos: hay que mantenerlos. El seed lo hace en dos líneas con un comentario explicativo, pero eso significa que **existe una tercera copia de la fórmula** (además del servicio de viajes y de la definición conceptual). Si la fórmula de `avgKm` cambiara (por ejemplo, a promedio ponderado), habría que actualizarla en dos lugares.

**El viaje en curso** (líneas 290-304):

```ts
await prisma.trip.create({
  data: {
    origin: FIXED_TRIP_ORIGIN,
    destination: 'Mendoza',
    departureAt: hoursAgo(3),
    status: 'IN_PROGRESS',
    estimatedDistanceKm: 700,
    estimatedTimeMin: 600,
    operatorId: operator.id,
    driverId: mariaId,
    vehicleId: vDDD.id,
    departureKm: 30000,
    assignedAt: hoursAgo(3),
  },
});
```

**La coherencia de estado, verificada punto por punto:**

| Invariante | Verificación |
|:--|:--|
| `status = IN_PROGRESS` → `driverId` no nulo | ✅ `mariaId` |
| `status = IN_PROGRESS` → `vehicleId` no nulo | ✅ `vDDD.id` |
| `status = IN_PROGRESS` → `departureKm` no nulo | ✅ 30.000 |
| `status = IN_PROGRESS` → `arrivalKm` nulo | ✅ ausente |
| `status = IN_PROGRESS` → `finishedAt` nulo | ✅ ausente |
| El vehículo debe estar `ON_TRIP` | ✅ DDD444 lo está (línea 194) |
| `departureKm` = km del vehículo | ✅ DDD444 tiene 30.000 (línea 192) |
| María no debe tener otro viaje activo | ✅ sus otros viajes están `COMPLETED` |

**Ocho invariantes, ocho cumplidas.** Este bloque está bien construido.

**El viaje pendiente** (líneas 307-317):

```ts
await prisma.trip.create({
  data: {
    origin: FIXED_TRIP_ORIGIN,
    destination: 'Rosario Centro',
    departureAt: daysFromNow(1),
    status: 'PENDING_ASSIGNMENT',
    estimatedDistanceKm: 15,
    estimatedTimeMin: 25,
    operatorId: operator.id,
  },
});
```

**Lo que NO está es lo importante:** sin `driverId`, sin `vehicleId`, sin `departureKm`, sin `assignedAt`. Es la representación exacta de `PENDING_ASSIGNMENT`.

**`departureAt: daysFromNow(1)`** — mañana. Un viaje pendiente con fecha futura es el caso realista: se planifica antes de que ocurra.

💡 **Este viaje es el que hace demostrable el flujo principal del sistema.** Sin él, no habría nada que asignar y la funcionalidad central quedaría sin probar.

#### El mensaje final (líneas 319-324)

```ts
console.log(
  'Seed completed: 2 maintenance types, settings, 6 users (1 admin, 1 operator, 4 drivers), ' +
    '5 vehicles, 6 documents, 3 maintenances, 5 trips. ' +
    'Run POST /api/v1/alerts/evaluate to generate the sample alerts.',
);
```

**Dos funciones:**
1. **Confirma** qué se creó, con números verificables contra la base.
2. **Instruye** el siguiente paso: las alertas **no se generan solas**. Hay que invocar `POST /api/v1/alerts/evaluate`.

🔴 **Ese último detalle revela una decisión arquitectónica importante: no hay tareas programadas.** La evaluación de alertas es un endpoint que alguien debe llamar manualmente. Sin cron, sin planificador, sin trabajos en segundo plano. En producción esto sería inaceptable (nadie va a acordarse de llamar al endpoint cada mañana); haría falta un `node-cron`, un `setInterval`, o un cron externo del sistema operativo. El capítulo 14 lo analiza en profundidad.

### 4.7.6. El arranque (líneas 367-373)

```ts
367 main()
368   .catch((err) => {
369     console.error(err);
370     process.exit(1);
371   })
372   .finally(() => void prisma.$disconnect());
```

**Línea 367 — `main()` sin `await`.** No se puede: el `await` de nivel superior requiere módulos ES y configuración específica. Se usa el encadenamiento de promesas.

**Líneas 368-371 — `.catch`**

- `console.error(err)` imprime el error completo, con stack.
- `process.exit(1)` termina el proceso con código **1** (error).

💡 **`process.exit(1)` es lo que hace que un seed fallido rompa un pipeline de CI.** Sin él, el proceso terminaría con código 0 (éxito) y el sistema de integración continua creería que todo salió bien. Es una línea que solo importa en automatización, y es exactamente la que se olvida.

**Línea 372 — `.finally(() => void prisma.$disconnect())`**

- `.finally` corre **siempre**, con éxito o con error.
- `prisma.$disconnect()` cierra el pool de conexiones.
- `void` descarta explícitamente la promesa devuelta.

🔴 **Sin el `$disconnect`, el proceso NO TERMINA.** Node mantiene el proceso vivo mientras haya *handles* activos, y un socket TCP abierto contra MySQL es uno. El script imprimiría su mensaje de éxito y **se quedaría colgado** hasta que alguien lo matara con Ctrl+C. En CI, sería un trabajo que nunca termina.

⚠️ **Hay una condición de carrera sutil.** `process.exit(1)` en el `.catch` es **síncrono e inmediato**: mata el proceso ahí mismo. El `.finally` que sigue **puede no llegar a ejecutarse**. En la ruta de error, la desconexión podría no ocurrir. En la práctica no importa (el sistema operativo cierra los sockets de un proceso muerto), pero es un patrón que en otro contexto —con un archivo abierto a medio escribir, por ejemplo— produciría corrupción. El orden correcto sería desconectar y **después** salir.

---

## 4.8. Flujo interno

### 4.8.1. Ciclo completo de desarrollo

```mermaid
sequenceDiagram
    autonumber
    participant D as Desarrollador
    participant S as schema.prisma
    participant CLI as Prisma CLI
    participant SH as Base shadow
    participant DB as Base real
    participant M as _prisma_migrations
    participant G as src/generated/prisma
    participant TS as tsc / editor

    D->>S: agrega un campo al modelo
    D->>CLI: npx prisma migrate dev --name add_field
    CLI->>M: ¿qué migraciones ya se aplicaron?
    M-->>CLI: [20260714023014_init]
    CLI->>SH: CREATE DATABASE shadow
    CLI->>SH: aplica init
    Note over SH: shadow = estado esperado actual
    CLI->>CLI: diff(shadow, schema.prisma)
    CLI->>D: escribe migrations/2026…_add_field/migration.sql
    CLI->>SH: DROP DATABASE shadow
    CLI->>DB: aplica la nueva migración
    CLI->>M: INSERT (nombre, checksum, fecha)
    CLI->>G: prisma generate → reescribe 22.748 líneas
    G-->>TS: tipos nuevos disponibles
    TS-->>D: errores de compilación donde el cambio rompe código
```

**El paso 12 es el más valioso del ciclo.** Al regenerar los tipos, TypeScript señala **inmediatamente** todos los lugares que dejan de compilar. Renombrar una columna deja de ser "buscar y rezar" y pasa a ser "arreglar hasta que compile".

### 4.8.2. Anatomía de una consulta en tiempo de ejecución

```mermaid
sequenceDiagram
    autonumber
    participant R as vehicles.repository
    participant P as PrismaClient
    participant Q as Constructor de consultas (TS)
    participant A as Adaptador MariaDB
    participant PO as Pool
    participant DB as MySQL

    R->>P: prisma.vehicle.findMany({where, orderBy, skip, take})
    P->>Q: traduce el objeto a AST de consulta
    Q->>Q: genera SQL + arreglo de parámetros
    Note over Q: SELECT `id`,`license_plate`,… FROM `vehicles`<br/>WHERE `deleted_at` IS NULL AND `status` = ?<br/>ORDER BY `id` ASC LIMIT ? OFFSET ?<br/>params: ['AVAILABLE', 10, 0]
    Q->>A: execute(sql, params)
    A->>PO: dame una conexión
    PO-->>A: conexión #3
    A->>DB: sentencia preparada + parámetros
    DB->>DB: parsea, optimiza, elige índice idx_vehicles_status
    DB-->>A: filas en formato binario
    A->>A: convierte tipos: TINYINT(1)→boolean, DATETIME→Date, DECIMAL→Decimal
    A->>PO: devuelve la conexión
    A-->>P: filas convertidas
    P->>P: mapea snake_case → camelCase
    P-->>R: Vehicle[] tipado
```

**Las cuatro traducciones que ocurren y que son invisibles desde el código:**

| # | Traducción | Ejemplo |
|:-:|:--|:--|
| 1 | Objeto de consulta → SQL | `{ where: { status: 'AVAILABLE' } }` → `WHERE status = ?` |
| 2 | Valores → parámetros de sentencia preparada | `'AVAILABLE'` viaja **separado** del SQL |
| 3 | Tipos de MySQL → tipos de JavaScript | `TINYINT(1)` → `boolean`, `DATE` → `Date`, `DECIMAL` → objeto `Decimal` |
| 4 | `snake_case` → `camelCase` | `license_plate` → `licensePlate` |

🔴 **El punto 2 es la razón por la que la inyección SQL es imposible con Prisma.** El SQL y los datos viajan por canales **separados** del protocolo de MySQL. Un valor como `'; DROP TABLE users; --` llega como un dato literal de 25 caracteres, nunca como código.

⚠️ **La excepción: `$queryRawUnsafe`.** Prisma ofrece esa función para casos donde hay que construir SQL dinámicamente. Su nombre incluye "Unsafe" a propósito. `$queryRaw` (sin "Unsafe"), en cambio, usa **plantillas etiquetadas** (*tagged templates*) y **sí** parametriza: `` $queryRaw`SELECT ... WHERE id = ${x}` `` convierte `${x}` en un `?` con parámetro, no en interpolación de texto.

✅ **Verificado en este proyecto:** `$queryRawUnsafe` **no se usa en ningún lado**. Las siete apariciones de SQL crudo usan `$queryRaw` con plantillas etiquetadas, y todas están en un contexto muy específico — **bloqueos de concurrencia**, que Prisma no expone de otra forma:

| Archivo | Línea | Qué hace |
|:--|:-:|:--|
| `trips.repository.ts` | 95 | Consulta de solapamiento con `bigint` explícito |
| `trips.repository.ts` | 107 | `SELECT ... FOR UPDATE` sobre `drivers` — bloqueo de fila |
| `trips.repository.ts` | 117 | `SELECT ... FOR UPDATE` sobre `trips` |
| `maintenances.repository.ts` | 81 | `SELECT ... FOR UPDATE` sobre `vehicles` |
| `alerts.service.ts` | 227 | `GET_LOCK` — bloqueo consultivo de MySQL |
| `alerts.service.ts` | 275 | `RELEASE_LOCK` |

💡 **`SELECT ... FOR UPDATE` es un bloqueo pesimista a nivel de fila.** Dentro de una transacción, marca la fila como bloqueada: cualquier otra transacción que intente bloquearla queda esperando hasta el `COMMIT`. Es lo que impide que dos operadores asignen el mismo chofer al mismo viaje simultáneamente. Prisma no tiene una API de alto nivel para esto, y recurrir a SQL crudo es la solución correcta. Se analiza en profundidad en los capítulos 12, 13 y 14.

**Que el proyecto use bloqueos explícitos es señal de madurez.** Muchos proyectos de este tamaño ignoran la concurrencia por completo y descubren los problemas en producción.

---

## 4.9. Ejemplos

### Ejemplo 1 — Diagnosticar el SQL que se está ejecutando

```ts
// — mejora propuesta para database/prisma-client.ts —
export const prisma = new PrismaClient({
  adapter,
  log: isProduction ? ['warn', 'error'] : ['query', 'info', 'warn', 'error'],
});
```

Salida en desarrollo:

```
prisma:query SELECT `logistics_management`.`vehicles`.`id`, … FROM `logistics_management`.`vehicles`
             WHERE (`logistics_management`.`vehicles`.`deleted_at` IS NULL
             AND `logistics_management`.`vehicles`.`status` = ?)
             ORDER BY `logistics_management`.`vehicles`.`id` ASC LIMIT ? OFFSET ?
             +3ms
```

**Los tres diagnósticos que esto habilita de inmediato:**

1. **N+1:** si una sola acción del usuario imprime 40 consultas casi idénticas, hay un bucle con consulta dentro.
2. **Consulta sin índice:** los `+Nms` altos apuntan a un recorrido completo de tabla.
3. **Transacciones largas:** ver `BEGIN` … muchas consultas … `COMMIT` con mucho tiempo en medio indica bloqueos potenciales.

### Ejemplo 2 — Los errores de Prisma más frecuentes, decodificados

| Código | Mensaje | Causa | Solución |
|:--|:--|:--|:--|
| `P1001` | Can't reach database server | MySQL apagado, puerto mal, firewall | Verificar que MySQL corra y el puerto de `DATABASE_URL` |
| `P1003` | Database does not exist | La base no fue creada | `CREATE DATABASE logistics_management;` o `prisma migrate dev` |
| `P1017` | Server has closed the connection | Timeout de inactividad de MySQL | Configurar `idleTimeout` menor que `wait_timeout` de MySQL |
| `P2002` | Unique constraint failed | Email o patente duplicados | Ya traducido a 409 en `error-handler.ts:54` |
| `P2003` | Foreign key constraint failed | Borrar un padre con hijos (`RESTRICT`) | Ya traducido a 409 en `error-handler.ts:64` |
| `P2025` | Record to update not found | `update` sobre un id inexistente | 🔴 **NO está manejado**: cae en el 500 genérico |
| — | `RSA public key is not available` | Falta `allowPublicKeyRetrieval=true` | Agregarlo a la URL (solo desarrollo) |
| — | `Cannot find module '../generated/prisma/client'` | No se corrió `prisma generate` | `npm install` o `npx prisma generate` |
| — | `Do not know how to serialize a BigInt` | Serializar `audit_logs.id` a JSON | Convertir con `Number()` o `.toString()` |
| — | `Drift detected` | Alguien modificó la base a mano | `prisma migrate resolve` o reset |

🔴 **`P2025` merece atención: es un hueco real en el manejo de errores.** Si un servicio hace `repository.update(999, ...)` sobre un id que no existe, Prisma lanza `P2025` y `error-handler.ts` no lo contempla: cae en el `500 INTERNAL_ERROR` de la línea 76. Debería ser un **404**.

**Por qué no ocurre en la práctica:** casi todos los servicios hacen `findById` primero y lanzan `NotFoundError` antes de actualizar. Pero eso es disciplina, no garantía. Basta un método que omita la comprobación previa —o una condición de carrera entre el `findById` y el `update`— para que el usuario reciba un 500 en lugar de un 404. **Agregar el caso a `error-handler.ts` son cuatro líneas.**

### Ejemplo 3 — Verificar el estado sembrado

```sql
-- ¿Cuántas filas hay de cada cosa?
SELECT 'users' t, COUNT(*) n FROM users UNION ALL
SELECT 'drivers', COUNT(*) FROM drivers UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles UNION ALL
SELECT 'driver_documents', COUNT(*) FROM driver_documents UNION ALL
SELECT 'maintenances', COUNT(*) FROM maintenances UNION ALL
SELECT 'trips', COUNT(*) FROM trips UNION ALL
SELECT 'alerts', COUNT(*) FROM alerts;
```

**Esperado tras el seed:** users 6, drivers 4, vehicles 5, driver_documents 6, maintenances 3, trips 5, alerts **0** (hasta llamar a `/alerts/evaluate`).

```sql
-- Verificar la invariante señalada en §4.7.5: ¿algún viaje llegó antes de salir?
SELECT id, destination, departure_at, finished_at,
       TIMESTAMPDIFF(HOUR, departure_at, finished_at) AS horas
  FROM trips
 WHERE finished_at IS NOT NULL AND finished_at < departure_at;
```

**Resultado esperado con el seed actual: una fila** (el viaje a Santa Fe, con −8 horas). Es la confirmación del bug descrito.

```sql
-- Verificar la coherencia de las estadísticas desnormalizadas
SELECT d.user_id, u.name,
       d.completed_trips AS guardado,
       COUNT(t.id)       AS real_count,
       d.avg_km          AS avg_guardado,
       ROUND(AVG(t.arrival_km - t.departure_km), 2) AS avg_real
  FROM drivers d
  JOIN users u ON u.id = d.user_id
  LEFT JOIN trips t ON t.driver_id = d.user_id AND t.status = 'COMPLETED'
 GROUP BY d.user_id, u.name, d.completed_trips, d.avg_km
HAVING guardado <> real_count OR ABS(avg_guardado - COALESCE(avg_real,0)) > 0.01;
```

**Resultado esperado: cero filas.** Cualquier fila indica que las estadísticas desnormalizadas se desincronizaron. Esta consulta debería correrse periódicamente en producción — es la conciliación que el capítulo 25 propone automatizar.

---

## 4.10. Diagramas

### El flujo completo de generación

```mermaid
graph TB
    A["schema.prisma<br/>295 líneas"]
    B["prisma.config.ts<br/>configuración del CLI"]
    C{"npx prisma …"}
    D["migrate dev"]
    E["generate"]
    F["db seed"]
    G["migrations/*/migration.sql<br/>247 líneas"]
    H["src/generated/prisma/<br/>22.748 líneas"]
    I["prisma/seed.ts<br/>373 líneas"]
    J[("MySQL<br/>12 tablas + datos")]
    K["Tipos usados en<br/>13 repositorios"]

    A --> C
    B --> C
    C --> D & E & F
    D --> G --> J
    D -.->|"invoca automáticamente"| E
    E --> H --> K
    F --> I --> J

    style A fill:#e8f5e9,stroke:#2e7d32,stroke-width:3px
    style H fill:#fff3e0,stroke:#ef6c00
    style J fill:#efebe9,stroke:#4e342e
```

### Mapa de datos sembrados y las alertas que producen

```mermaid
graph LR
    subgraph CH["4 choferes"]
        J["Juan<br/>lic +400d<br/>4 docs ✅"]
        M["María<br/>lic +300d<br/>2 docs ⚠️"]
        C["Carlos<br/>lic +10d ⚠️<br/>0 docs"]
        L["Lucía<br/>lic −5d 🔴<br/>0 docs"]
    end
    subgraph FL["5 vehículos"]
        A1["AAA111<br/>AVAILABLE ✅"]
        B1["BBB222<br/>AVAILABLE<br/>+15.000 km ⚠️<br/>seguro +7d ⚠️"]
        C1["CCC333<br/>INACTIVE 🔴<br/>seguro −15d 🔴"]
        D1["DDD444<br/>ON_TRIP"]
        E1["EEE555<br/>IN_WORKSHOP"]
    end
    subgraph AL["Alertas esperadas tras /alerts/evaluate"]
        X1["LICENSE_EXPIRING → Carlos"]
        X2["LICENSE_EXPIRED → Lucía"]
        X3["DOCUMENT_EXPIRING → ART de Juan"]
        X4["DOCUMENT_EXPIRED → ART de María"]
        X5["MAINTENANCE_KM_EXCEEDED → BBB222"]
        X6["INSURANCE_EXPIRING → BBB222"]
        X7["INSURANCE_EXPIRED → CCC333"]
        X8["VEHICLE_INACTIVE → CCC333"]
    end
    C --> X1
    L --> X2
    J --> X3
    M --> X4
    B1 --> X5 & X6
    C1 --> X7 & X8

    style AL fill:#ffebee,stroke:#c62828
    style CH fill:#e3f2fd,stroke:#1565c0
    style FL fill:#e8f5e9,stroke:#2e7d32
```

**Ocho alertas esperadas.** Este diagrama es, de hecho, el caso de prueba del capítulo 14: si tras ejecutar `POST /api/v1/alerts/evaluate` sobre la base sembrada no salen exactamente estas ocho, hay un bug en el motor de alertas o una inconsistencia en el seed.

---

## 4.11. Resumen

1. **Un ORM salva el desajuste entre objetos y tablas.** Prisma sigue el patrón **Data Mapper**: las entidades son objetos planos sin métodos. Esa elección es la causa directa del modelo anémico y de que exista una capa de repositorios.

2. **Prisma 7 eliminó el motor Rust.** Todo es TypeScript, la conexión la maneja un *driver adapter* (aquí `@prisma/adapter-mariadb`), y el cliente generado sale en `src/generated/prisma/` como TypeScript legible.

3. **Una sola instancia de `PrismaClient` para todo el proceso**, garantizada por el caché de módulos de Node. Varias instancias agotarían las conexiones de MySQL.

4. **Las 22.748 líneas generadas son tipos, no lógica.** Existen para que `where: { statuss: 'X' }` sea un error de compilación. Se regeneran con `postinstall` y no están en Git.

5. **El patrón objeto-como-enum** (`as const` + `(typeof X)[keyof typeof X]`) hace que cada enum exista como valor y como tipo, evitando los tres problemas de los `enum` nativos de TypeScript.

6. **Las migraciones son inmutables una vez aplicadas.** El `checksum` en `_prisma_migrations` lo hace cumplir. `migrate dev` es para desarrollo y **puede borrar la base**; `migrate deploy` es para producción y nunca lo hace.

7. **`utf8mb4_unicode_ci` no distingue mayúsculas ni acentos.** Correcto para emails y búsquedas; una trampa si alguien asume que SQL compara como `===`.

8. **El seed es idempotente** por dos mecanismos combinados: `upsert` con claves naturales para los catálogos y entidades maestras, y `deleteMany` + recrear para los datos transaccionales sin clave natural.

9. **Cada dato del seed existe para demostrar un comportamiento.** Cuatro choferes con cuatro estados de licencia, cinco vehículos con cinco situaciones, seis documentos con distintos vencimientos: ocho alertas esperadas.

10. **Cuatro problemas concretos detectados en este capítulo:**
    - Los archivos de documentos sembrados **no existen en disco**: la descarga falla y no está documentado.
    - El viaje a Santa Fe tiene los argumentos temporales invertidos: **llega antes de salir**, y el sistema no valida esa invariante.
    - `nextMaintenanceKm` en el seed usa `kmAlert` en vez de `kmTarget`: hay que verificar cuál usa el servicio real.
    - El seed **no se niega a correr en producción** y borra datos físicamente con `deleteMany`.

11. **`P2025` (registro a actualizar no encontrado) no está manejado** en `error-handler.ts`: produce un 500 donde debería producir un 404.

12. **No hay logging de consultas configurado**, que es la herramienta de diagnóstico más útil de Prisma en desarrollo.

---

## 4.12. Preguntas de repaso

1. ¿Cuál es la diferencia entre Active Record y Data Mapper? ¿Cuál usa Prisma y qué consecuencia tiene eso sobre la arquitectura de todo el backend?
2. ¿Por qué `prisma-client.ts` insiste en tener una sola instancia? Calcular qué pasaría con 13.
3. ¿Por qué el proyecto usa el adaptador de **MariaDB** para una base **MySQL**?
4. ¿Qué es el problema N+1? Escribir código que lo produzca y su versión corregida. ¿Prisma usa `JOIN` para resolverlo?
5. `schema.prisma` no tiene `url` en su `datasource`. ¿De dónde saca la conexión el CLI, y de dónde la aplicación en ejecución?
6. Explicar `export type Role = (typeof Role)[keyof typeof Role]` paso a paso. ¿Por qué no usar `enum Role` de TypeScript?
7. ¿Qué pasa si alguien edita un `migration.sql` ya aplicado? ¿Qué mecanismo lo detecta?
8. ¿Cuál es la diferencia entre `migrate dev` y `migrate deploy`? ¿Cuál se puede usar en producción y por qué?
9. `utf8mb4_unicode_ci` — ¿qué significa cada parte del nombre y qué consecuencia práctica tiene para las patentes de vehículos?
10. En `seedCatalog`, `upsert` usa `update: {}` (vacío), pero `upsertUser` usa `update: { name, role }`. ¿Por qué son distintos y ambos correctos?
11. ¿Por qué el `deleteMany` de la línea 216 necesita el `OR` con `operatorId`? ¿Qué pasaría sin él?
12. ¿Por qué el seed usa `setUTCHours` y no `setHours`? Dar un caso concreto donde la diferencia produzca un bug visible.
13. Encontrar la inconsistencia temporal en el segundo viaje completado del seed. ¿Por qué el sistema no la detecta?
14. Si `process.exit(1)` se ejecuta en el `.catch`, ¿corre el `.finally`? ¿Importa acá? ¿En qué caso importaría?

<details>
<summary><strong>Respuestas</strong></summary>

1. **Active Record**: cada fila es un objeto con métodos que sabe persistirse (`vehiculo.save()`). **Data Mapper**: las entidades son datos planos y un objeto aparte se encarga de la persistencia (`prisma.vehicle.update(...)`). Prisma es Data Mapper. **Consecuencia arquitectónica**: como las entidades no tienen comportamiento, el modelo de dominio es necesariamente **anémico** y toda la lógica de negocio tiene que vivir en los servicios. Además, obliga a escribir una capa de repositorios — que el proyecto aprovecha para centralizar el filtro de borrado lógico y el parámetro `db: DbClient = prisma`.

2. Porque cada `new PrismaClient()` crea su propio pool de conexiones. Con el valor por defecto de 10 conexiones por pool, 13 instancias serían **130 conexiones** contra un MySQL cuyo `max_connections` por defecto es 151. Quedaría casi sin margen, y con dos procesos Node (o un despliegue con réplicas) se agotaría. El caché de módulos de Node garantiza el singleton sin necesidad de un patrón explícito.

3. Porque MariaDB nació como bifurcación de MySQL y mantiene compatibilidad de protocolo binario. El driver `mariadb` de Node habla ese protocolo y es el adaptador que Prisma 7 recomienda para MySQL — tiene más madurez en el ecosistema de adaptadores que `mysql2`. El nombre confunde; la elección es correcta. La compatibilidad es total para CRUD, transacciones y agregaciones; habría que verificar caso por caso si se usara sintaxis específica de MySQL 8 en `$queryRaw`.

4. Es hacer 1 consulta para traer N registros y luego N consultas más para traer un dato relacionado de cada uno. Mal: `findMany()` seguido de un `for` con `findUnique` dentro. Bien: `findMany({ include: { driver: true } })`. **Prisma NO usa `JOIN`**: emite consultas separadas con `WHERE id IN (...)` y las une en memoria, porque un `JOIN` con relaciones "a muchos" duplicaría las filas del lado "uno" y multiplicaría el tráfico de red.

5. El **CLI** (migraciones, seed) la saca de `prisma.config.ts:16` (`process.env['DATABASE_URL']`). La **aplicación en ejecución** la saca de `database/prisma-client.ts:11`, donde se construye `new PrismaMariaDb(env.DATABASE_URL)` — y ese `env` está validado por Zod en `config/env.ts`. Son dos caminos independientes: el CLI falla mal (cadena vacía → error críptico de parseo), la aplicación falla bien (aborta el arranque con mensaje explícito).

6. Paso a paso: `typeof Role` da el tipo del objeto con sus literales exactos (gracias a `as const`); `keyof typeof Role` da la unión de sus **claves** (`"ADMIN" | "OPERATOR" | "DRIVER"`); indexar el tipo con esa unión da la unión de los **valores**, que en este caso coinciden. **No se usa `enum` nativo** porque: (a) genera código JavaScript en tiempo de ejecución, contradiciendo que los tipos se borren al compilar; (b) es incompatible con `isolatedModules`, que el frontend tiene activado; (c) los enums numéricos aceptan cualquier número, perdiendo la seguridad de tipos.

7. Prisma calcula el SHA-256 del archivo y lo compara con el `checksum` guardado en `_prisma_migrations`. Si no coincide, **se niega a continuar**. Y con razón: los entornos que ya aplicaron la versión anterior tienen una estructura distinta de la que ahora describe el archivo, y no hay forma de saber cuál es la correcta. La regla es: una migración aplicada es inmutable; si algo está mal, se crea otra que lo corrija.

8. `migrate dev` genera migraciones nuevas, usa una base *shadow*, regenera el cliente, ejecuta el seed y **puede ofrecer resetear la base** si detecta divergencia. `migrate deploy` solo aplica las migraciones pendientes, no genera nada, no usa shadow y **nunca borra datos**. **Solo `migrate deploy` va en producción**: `migrate dev` en un entorno no interactivo podría aceptar solo la oferta de reset y destruir todos los datos.

9. `utf8mb4` = UTF-8 real de 4 bytes (el `utf8` de MySQL solo soporta 3 y es una trampa histórica). `unicode` = algoritmo de colación Unicode, que ordena `ñ` entre `n` y `o`. `_ci` = *case-insensitive*, no distingue mayúsculas (y por extensión tampoco acentos). **Consecuencia para las patentes**: `AAA111` y `aaa111` colisionan en el índice único — se consideran la misma patente. En este proyecto no es problema porque `licensePlateSchema` normaliza a mayúsculas con `.transform()`, pero la protección está en la aplicación, no en la base.

10. `update: {}` en el catálogo significa "si ya existe, no toques nada": si un administrador ajustó `kmAlert` para su operación, volver a correr el seed **no le pisa la configuración**. `update: { name, role }` en los usuarios significa "sincronizá el nombre y el rol": los usuarios de demostración deben tener siempre los valores del guion. Nótese que `upsertUser` **no** actualiza `passwordHash`, respetando una contraseña cambiada. Son tres políticas distintas, cada una correcta para su propósito.

11. Porque el viaje `PENDING_ASSIGNMENT` de la línea 307 **no tiene chofer**: su `driverId` es `NULL`. En SQL, `NULL IN (1,2,3)` evalúa a `NULL`, que nunca es verdadero, así que la primera condición no lo encontraría. Sin el `OR` con `operatorId`, cada ejecución del seed dejaría el viaje pendiente anterior y crearía uno nuevo, acumulando indefinidamente.

12. Porque las columnas `DATE` de MySQL vuelven de Prisma como **medianoche UTC** del día calendario. Para compararlas contra "hoy", la referencia también tiene que ser medianoche UTC. Caso concreto: en Argentina (UTC−3), `setHours(0,0,0,0)` produce `2026-08-03T03:00:00Z`. Una licencia que vence el 3 de agosto está almacenada como `2026-08-03T00:00:00Z`, que es **menor** que la referencia — el sistema la leería como vencida, violando RN-1 (la licencia es válida **hasta e incluyendo** su fecha de vencimiento). El chofer no podría trabajar el último día de validez de su licencia.

13. `completedTrip(operator.id, juanId, vAAA.id, 'Santa Fe', 44000, 44500, 12, 20)`: `hoursAgoDeparture = 12` y `hoursAgoFinish = 20`, es decir salió hace 12 horas y llegó hace 20. **Llegó 8 horas antes de salir.** Debería ser `(20, 12)`. **El sistema no lo detecta** porque no existe ninguna validación de que `finishedAt > departureAt`: ni un `CHECK` en la base, ni una regla en el schema de Zod, ni una comprobación en `trips.service.ts`. Es un hueco real que el seed expone accidentalmente.

14. **Depende, y es sutil.** `process.exit()` es síncrono e inmediato: termina el proceso en esa línea, y el `.finally` que sigue **puede no llegar a ejecutarse**. Acá **no importa** porque el sistema operativo cierra los sockets de un proceso muerto. **Importaría** si en lugar de cerrar una conexión hubiera que vaciar un buffer a un archivo, confirmar una transacción, o notificar a un servicio externo: se perdería esa operación. El patrón correcto sería `await prisma.$disconnect()` **antes** de `process.exit(1)`.

</details>

---

## 4.13. Ejercicios propuestos

**Nivel 1 — Observación**

1. Ejecutar `npx prisma generate` y medir cuánto tarda. Contar los archivos y las líneas producidas. Abrir `models/Trip.ts` y buscar el tipo `TripWhereInput`: enumerar cuántos filtros distintos ofrece.
2. Activar `log: ['query']` en `prisma-client.ts`, levantar el backend, abrir la pantalla de vehículos y contar las consultas que se emiten. ¿Hay alguna repetida?
3. Ejecutar `SELECT * FROM _prisma_migrations` y explicar cada columna.

**Nivel 2 — Verificación**

4. Ejecutar las tres consultas de verificación de §4.9 (ejemplo 3) contra la base sembrada. ¿Coinciden los conteos? ¿Aparece el viaje con duración negativa?
5. Intentar `INSERT INTO users (name, email, password_hash, role) VALUES ('X','x@x.com','y','ADMIN');` directamente en MySQL. ¿Qué error da y por qué? Relacionarlo con `@updatedAt`.
6. Editar un carácter de `migration.sql` y ejecutar `npx prisma migrate dev`. Documentar exactamente el mensaje de error.
7. Verificar la afirmación de §4.7.5 sobre `nextMaintenanceKm`: abrir `maintenances.service.ts` y determinar si el servicio usa `kmAlert` o `kmTarget`. ¿El seed es coherente con el servicio?

**Nivel 3 — Modificación**

8. Corregir el bug del viaje a Santa Fe en `seed.ts`, y **además** agregar la validación que debería impedirlo: un `.refine()` en el schema de Zod de finalización de viaje y una comprobación en el servicio.
9. Hacer que el seed genere PDFs reales (aunque sean de un byte) en las rutas que declara `docFor`, de modo que la descarga de documentos funcione en la demostración.
10. Agregar la guarda de producción al seed (`if (NODE_ENV === 'production') throw`), y verificar que `npm run prisma:seed` falle con `NODE_ENV=production`.
11. Reemplazar los tipos de rol escritos a mano en `seed.ts` por el enum generado de Prisma. Después agregar un rol `SUPERVISOR` al esquema y verificar que ahora TypeScript señala los lugares que hay que actualizar.
12. Agregar el manejo de `P2025` a `error-handler.ts` para que devuelva 404 en lugar de 500. Escribir un caso de prueba que lo dispare.
13. Escribir la migración manual que agrega las restricciones `CHECK` de `trips` (las ocho invariantes de §3.4.9). Aplicarla y verificar que un `UPDATE` inválido ahora falla en la base.
14. Medir el impacto real de `BCRYPT_ROUNDS`: escribir un script que hashee 100 contraseñas con coste 10, 12 y 14, y graficar el tiempo. Decidir, con datos, qué valor debería usar el proyecto.

---

**Anterior:** [Capítulo 3 — La base de datos](03-base-de-datos.md) · **Siguiente:** Capítulo 5 — Bootstrap del backend *(pendiente)*
