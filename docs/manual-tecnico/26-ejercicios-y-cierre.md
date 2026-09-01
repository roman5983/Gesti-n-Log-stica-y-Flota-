# Capítulo 26 — Banco de ejercicios y cierre

> **Este capítulo no repite los ejercicios de los capítulos anteriores.** Los enhebra.
>
> Los veinticinco capítulos previos dejaron más de doscientos ejercicios sueltos, cada uno
> pegado a su tema. Aquí se organizan en **seis rutas de aprendizaje** con orden y
> propósito, se añade un **proyecto final** que no cabía en ningún capítulo, y se somete el
> manual a **la prueba que él mismo se puso**: ¿alguien que nunca vio este código podría
> reconstruirlo leyendo solo esto?

---

## 26.1 · Introducción

El capítulo 0 declaró un objetivo fuerte:

> *«Al terminar de leer este documento, el lector debe poder reconstruir el sistema entero
> desde cero sin mirar el código original.»*

Es una afirmación verificable, y este capítulo la verifica. No con una declaración de
éxito, sino con **una lista de comprobación honesta** —§26.5— que incluye lo que el manual
cubre y **lo que no**.

Antes de eso, las rutas. Un ejercicio suelto al final de un capítulo enseña una cosa. Los
mismos ejercicios ordenados por objetivo enseñan un oficio: leer código ajeno, encontrar
un bug de concurrencia, decidir qué no arreglar.

---

## 26.2 · Las seis rutas

Cada ruta enhebra ejercicios que ya existen en los capítulos, más los nuevos que hagan
falta. Se indican con `§capítulo.ejercicio`.

### Ruta A — Leer código ajeno · 1 semana

**Para quien se incorpora al proyecto y tiene que ser productivo.**

| # | Qué | Dónde |
|--:|:--|:--|
| 1 | Recorrer un endpoint de punta a punta sin ejecutar nada: `GET /api/v1/vehicles`, de la ruta al SQL | §23.1.1 |
| 2 | Dibujar el flujo completo de **crear un vehículo**, cinco capas, archivo:línea | §23.1.1 |
| 3 | Clasificar los cinco modos de fallo y localizar dónde se lanza y dónde se traduce cada uno | §23.1.2 |
| 4 | Para una pantalla cualquiera, identificar las siete piezas del patrón de listado | §22A.3 |
| 5 | Clasificar los `useState` de un diálogo en formulario / control / servidor | §22B.1.1 |
| 6 | Enumerar qué pantallas ve cada rol y contrastarlo con los `authorize()` del backend | §22C.1.1 |

**Criterio de éxito:** poder responder «¿dónde se valida X?» sin abrir un buscador.

### Ruta B — Encontrar bugs · 2 semanas

**Para quien quiere aprender a auditar, no solo a leer.**

| # | Qué | Dónde |
|--:|:--|:--|
| 1 | Buscar `dayjs` y `@mui/x-date-pickers` en `src/`. Después buscar `toLocaleDateString`. Describir lo que se ve | §24.1.4 |
| 2 | Recorrer los cuatro sitios del bug de fechas y explicar por qué el de `MiDocumentacionPage` es el peor | §22C.1.3 |
| 3 | Aplicar la regla del cierre obsoleto a las siete pantallas del patrón y verificar la correlación | §22C.1.3, §22B.3.1 |
| 4 | Verificar el hueco del seguro de punta a punta: crear un vehículo sin seguro, asignarlo, evaluar alertas | §23.2.4 |
| 5 | Demostrar que la rotación no detecta el robo: usar un token, reutilizarlo, comprobar que las otras sesiones siguen vivas | §23.2.3 |
| 6 | Medir el canal de tiempo del login: cien intentos con cuenta inexistente vs. cien con cuenta real | §23.2.2 |
| 7 | Reproducir la carrera de la asignación con dos peticiones simultáneas, y luego **comentar `lockDriver`** y repetir | §23.2.1 |

**El ejercicio 7 es el más formativo del manual.** Ver el sistema comportarse bien, quitar
una línea, verlo comportarse mal, y entender exactamente por qué — es la única forma de que
`FOR UPDATE` deje de ser una fórmula.

**Criterio de éxito:** encontrar un hallazgo que este manual **no** registró. Existen: los
capítulos 02-07 tienen ~197 marcas inline sin consolidar (§25.2.2).

### Ruta C — Corregir con red · 2 semanas

**Para quien va a tocar el código de verdad.**

| # | Qué | Dónde |
|--:|:--|:--|
| 1 | Montar la infraestructura de pruebas: MySQL efímero, migración y siembra, limpieza entre casos | §24.3.3 |
| 2 | Escribir la prueba que **falla** para los tres cierres obsoletos, antes de corregirlos | §22B.3.6 |
| 3 | Ejecutar la fase 0 completa del plan y medir el tiempo real de cada punto | §25.2.1 |
| 4 | Instalar ESLint, guardar la salida **antes** de corregir, y clasificar cada aviso | §25.2.3 |
| 5 | Centralizar el formateo de fechas y verificar con un documento que vence **hoy** | §25.2.4 |
| 6 | Escribir la prueba de la carrera de `assign` y hacerla pasar | §24.3.3 |

**Criterio de éxito:** que la fase 0 esté cerrada y cubierta por pruebas que fallaban antes.

### Ruta D — Decidir · 1 semana

**Para quien tiene que responder ante alguien.** Ninguno de estos ejercicios se resuelve
leyendo código.

| # | Qué | Dónde |
|--:|:--|:--|
| 1 | Propuesta de la política del seguro: tres opciones, coste, recomendación. **Una página** | §25.3.1 |
| 2 | Diseño de la cancelación de viajes: quién, en qué estados, qué pasa con vehículo, chofer y kilómetros | §25.3.2 |
| 3 | Decidir sobre los ocho campos de configuración: implementar, deshabilitar o eliminar | §25.3.3 |
| 4 | Decidir sobre `@mui/x-date-pickers`: usarlo o desinstalarlo, con las dos ramas implementadas | §24.3.1 |
| 5 | Reordenar el plan para un contexto distinto: producción en dos semanas, 15 vehículos | §25.3.4 |
| 6 | Construir el argumento **contrario** al capítulo 25 | §25.3.5 |
| 7 | Informe ejecutivo de una página, sin jerga, para quien paga | §25.3.7 |

**El 6 y el 7 son los más difíciles del manual**, y no por técnica. El 6 obliga a defender
lo que uno acaba de criticar; el 7, a resumir doscientos hallazgos en tres respuestas.

### Ruta E — Construir · 3 semanas

**Para quien quiere extender el sistema.**

| # | Qué | Dónde |
|--:|:--|:--|
| 1 | Cerrar el camino muerto de `estimatedDistanceKm` usando el `geometry` que ya se paga | §22B.3.1 |
| 2 | Llevar la pestaña de mantenimiento a la URL con `useSearchParams` | §22B.3.3 |
| 3 | Convertir la documentación del chofer en lista de verificación | §22C.3.5 |
| 4 | Notificaciones al chofer: evaluar sondeo / SSE / WebSocket / *push* e implementar una | §22C.3.1 |
| 5 | Exportación del informe a CSV con `utils/blob.ts` | §22C.3.4 |
| 6 | Evaluación automática de alertas, considerando dos instancias del backend | §23.3.6 |
| 7 | Auditoría de la superficie de datos: los 13 endpoints, qué envían que no se muestra | §22C.3.7 |

### Ruta F — Rediseñar · abierta

**Para quien se pregunta si esto se podría haber hecho de otra forma.**

| # | Qué | Dónde |
|--:|:--|:--|
| 1 | Paquete compartido de esquemas Zod; evaluar qué se complica en el despliegue | §24.3.6 |
| 2 | Migrar una pantalla a TanStack Query y comparar honestamente | §24.3.5 |
| 3 | Hook `useDialogForm` que absorba lo repetido en los seis diálogos — **y evaluar si mejora** | §22B.3.4 |
| 4 | Sustituir los tres `limit: 100` por `Autocomplete` con búsqueda en el servidor | §22B.3.5 |
| 5 | Esquema de códigos de error para resolver el problema de idioma | §23.3.7 |
| 6 | Política de dependencias, aplicada retroactivamente a las 50 actuales | §24.3.7 |

**Los ejercicios 2 y 3 comparten una trampa deliberada:** ambos piden *evaluar
honestamente si el resultado es mejor*, y en los dos casos la respuesta defendible puede
ser que no. Aprender a no refactorizar es tan importante como aprender a refactorizar.

---

## 26.3 · El proyecto final

No cabía en ningún capítulo porque los cruza todos.

> **Añadir al sistema el módulo de cargas: qué transporta cada viaje.**

Un viaje hoy tiene origen, destino, chofer y vehículo. No tiene **carga**. La empresa
necesita registrar qué se transporta, cuánto pesa, quién es el cliente y si se entregó.

**Lo que hay que producir, en orden:**

**1 · Modelo de datos.** Tabla `cargos`: peso, descripción, cliente, estado de entrega.
¿Relación uno-a-uno con `trips` o uno-a-muchos? ¿Qué política de borrado en la FK? ¿Qué
índices? ¿Entra en el borrado lógico de RN-20? Escribir la migración a mano y contrastarla
con la que genera Prisma.

**2 · Reglas de negocio.** Redactarlas con el estilo del proyecto (RN-*n*):

- ¿Se puede añadir carga a un viaje `IN_PROGRESS`? ¿Y a uno `COMPLETED`?
- ¿El peso total limita qué vehículo se puede asignar? Si sí, **`pickAvailableVehicle`
  cambia** — y con él el `SKIP LOCKED` del §23.4.3.
- ¿Cancelar un viaje (que hay que implementar antes, §25.3-causa 5) qué hace con la carga?

**3 · Backend.** Los cinco archivos del módulo, siguiendo la arquitectura por capas sin
excepciones. **Con bloqueo donde corresponda** — y justificando dónde no.

**4 · Auditoría.** ¿`entity: 'CARGO'` o bajo `TRIP`? Contrastar con el hallazgo de §12.9
sobre la auditoría del vehículo que queda bajo `entity='TRIP'`.

**5 · Alertas.** ¿Una carga sin entregar tras la finalización del viaje genera alerta? Si
sí, integrarla en el reconciliador **sin romper la idempotencia**.

**6 · Frontend.** Pantalla o pestaña, con el patrón de §22A.3. **Sin repetir los tres
cierres obsoletos.** Fechas con el helper centralizado, no con `toLocaleDateString`.

**7 · Pruebas.** Al menos una de esquema, una de servicio con base de datos, y una de
concurrencia si se añadió bloqueo.

**8 · Documentación.** El capítulo del manual, con las diez secciones y su tabla de
hallazgos — **incluidos los propios**.

**Criterio de aprobación, y es exigente:** que un lector del manual **no pueda distinguir**
el módulo nuevo de los trece originales. Mismas convenciones, mismos patrones, misma
calidad de comentarios. Y que el capítulo 26 del manual —este— siga siendo cierto después
de añadirlo.

---

## 26.4 · Las diez preguntas que resumen el sistema

Si alguien afirma haber entendido este proyecto, estas diez lo comprueban. Cada una exige
cruzar al menos dos capítulos.

<details>
<summary><b>1. Un operador asigna un viaje. Enumere las siete validaciones, diga cuáles están dentro de la transacción y por qué.</b></summary>

**Fuera** (lecturas baratas, fallan rápido, no cuestan cerrojo):

1. El viaje está `PENDING_ASSIGNMENT` — `trips.service.ts:173`
2. El chofer existe — `:179`

**Dentro** (todas pueden cambiar entre la lectura previa y la escritura):

3. El chofer está activo — `:192`
4. Licencia vigente, RN-1 — `:196`
5. Sin documentación vencida, RN-4 — `:204`
6. Sin otro viaje activo, RN-19 — `:208`
7. Hay vehículo disponible, RN-12 — `:214`

La razón está en el comentario de `:187-189`: *«the pre-lock read could be stale if the
driver was deactivated in the meantime»*. Validar sobre la lectura previa sería validar
sobre nada.

El paso 7 usa `FOR UPDATE SKIP LOCKED`, no `FOR UPDATE`: diez operadores obtienen diez
vehículos distintos **en paralelo** en vez de esperarse en fila (§23.4.3).
</details>

<details>
<summary><b>2. ¿Por qué el token de acceso es un JWT y el de refresco no?</b></summary>

Porque tienen requisitos **opuestos**.

Un JWT se verifica solo con criptografía, sin tocar la base — rápido, sin estado. Pero por
eso mismo **no se puede revocar**: si la firma es válida y no ha caducado, se acepta. Por
eso el de acceso dura **quince minutos**: esa es la ventana de daño si se roba.

El de refresco dura **siete días**, así que revocarlo tiene que ser posible. Es un valor
opaco de 32 bytes aleatorios que **siempre se consulta contra la base**, donde una columna
`revoked` lo mata al instante.

Y se guarda **hasheado con SHA-256** (`auth.service.ts:46`): si la base se filtra, los
hashes no sirven para autenticarse.

La división del trabajo cubre las dos amenazas: **lo que un XSS podría robar dura quince
minutos; lo que dura una semana, un XSS no puede leerlo** (cookie `httpOnly`).
</details>

<details>
<summary><b>3. Un chofer con el token caducado hace nueve horas pulsa «Cerrar hoja de ruta». ¿Qué ve?</b></summary>

**Nada. Funciona.**

El `POST` sale con el token caducado → 401 → el interceptor de respuesta de `api/axios.ts`
lo captura y comprueba tres cosas: es un 401, no es un endpoint de auth, no se reintentó ya.
Entonces `refreshPromise ??= axios.post('/auth/refresh')` con la cookie, obtiene un par
nuevo, marca `_retried = true` y **reintenta la petición original**.

Las tres protecciones importan:

- **`isAuthEndpoint`** evita que un 401 del refresco dispare otro refresco: recursión
  infinita.
- **`_retried`** evita el bucle si sigue dando 401.
- **`??=`** es el crítico: con diez peticiones fallando a la vez, se envía **un** refresco.
  Y como el backend **rota** —cada refresco revoca el anterior—, diez refrescos paralelos
  harían que nueve presentaran un token ya revocado. **Sesión perdida.** Rotar y deduplicar
  están acopladas.
</details>

<details>
<summary><b>4. ¿Qué conecta finalizar un viaje con una alerta de mantenimiento?</b></summary>

**Una columna.** `vehicles.accumulated_km`.

`trips.service.ts:296` la actualiza al finalizar. En la siguiente evaluación, el motor de
alertas compara ese número contra `min(kmAlert)` global y, si lo cruzó, crea una alerta de
tipo `MAINTENANCE_KM_EXCEEDED`.

**Los módulos no se llaman entre sí.** `trips` no sabe que existe `alerts`; `alerts` no sabe
que existe `maintenances`. El acoplamiento es por datos compartidos, no por invocación.

Eso tiene una ventaja —los módulos se modifican por separado— y un coste: **el ciclo no está
escrito en ningún archivo**. Nadie que lea `trips.service.ts` sospecha que alimenta al motor
de alertas. El diagrama de §23.8.3 es el único sitio donde el ciclo completo es visible.
</details>

<details>
<summary><b>5. ¿Por qué una alerta resuelta vuelve a aparecer?</b></summary>

Porque el motor es un **reconciliador**, no un sistema de eventos. En cada ejecución
recalcula desde cero qué alertas **deberían** existir según el mundo, y ajusta: crea las que
faltan, resuelve las que ya no corresponden, deja las que siguen.

Si se resuelve «Seguro vencido» **sin renovar el seguro**, la condición sigue siendo cierta
y la siguiente evaluación la crea de nuevo.

**Es correcto por diseño:** el sistema no debe olvidar un problema real porque alguien cerró
la ventana. Y da idempotencia: diez evaluaciones dan el mismo resultado que una, y tres días
de caída se ponen al día en la primera ejecución al volver.

**El problema es de comunicación**, no de lógica: la interfaz no lo explica (§22C, hallazgo
7).
</details>

<details>
<summary><b>6. Enuncie la regla del cierre obsoleto y aplíquela a las siete pantallas.</b></summary>

> Un `useMemo` de columnas con dependencias incompletas es seguro **si y solo si** los
> manejadores usan exclusivamente identidades estables: setters de `useState`, `dispatch`,
> funciones de módulo.

En cuanto un manejador llame a algo derivado del estado —`reload`, que `usePaginatedList`
define con `useCallback(..., [fetchFn, page, limit])`— el cierre queda congelado con la
página del render en que se memorizó.

| Pantalla | Deps | ¿Toca `reload`? | |
|:--|:--|:--:|:--:|
| `ViajesPage` | `[]` | No | ✅ |
| `TiposMantenimientoTab` | `[canManage]` | No | ✅ |
| `AuditoriaPage` | `[]` | No | ✅ |
| `ChoferesPage` | `[canManage]` | No | ✅ |
| `VehiculosPage` | `[canManage]` | **Sí** | 🔴 |
| `MaintenanceListTab` | `[]` | **Sí** | 🔴 |
| `AlertasPage` | `[isAdmin, status]` | **Sí** | 🔴 |

**Correlación perfecta.** Y la regla `react-hooks/exhaustive-deps` detecta los tres — pero
ESLint no está instalado, y de las tres supresiones que hay en el código, dos tapan un bug
real y una marca un caso correcto (§25.3, causa 1).
</details>

<details>
<summary><b>7. Un vehículo sin seguro cargado, ¿puede salir de viaje?</b></summary>

**Sí, y nada lo señala.** Hacen falta cuatro archivos para verlo:

| Capa | Qué hace |
|:--|:--|
| `pickAvailableVehicle` | Filtra `status` y `deleted_at`. **Nada sobre el seguro** |
| `alerts.service.ts:149` | **No alerta** si `insuranceExpiryDate` es `NULL` |
| `VehiculosPage:90` | Muestra `—`, sin distintivo |
| `vehicles.service.ts:20` | El comentario afirma que se *«surfaces as alertable»* |

**Cada uno es defendible leído solo.** El repositorio elige un vehículo disponible; el motor
evita ruido sobre datos que no existen; la pantalla usa el guion de cualquier campo vacío;
el comentario describe lo que su autor creía.

**Juntos dejan un vehículo sin cobertura en la calle.** Es el mejor ejemplo de por qué la
lectura archivo por archivo no basta: el fallo no está en ningún archivo, está en el hueco
entre cuatro.
</details>

<details>
<summary><b>8. El odómetro se actualiza con <code>accumulatedKm = arrivalKm</code>, no con un incremento. ¿Bug o decisión?</b></summary>

**Decisión, y correcta** — aunque el código no lo diga.

En el camino feliz dan lo mismo: en la asignación, `:228` hizo
`departureKm: vehicle.accumulatedKm`, así que sumar `arrivalKm - departureKm` da
`arrivalKm`.

La diferencia aparece si algo modificó el odómetro durante el viaje: la asignación lo pisa,
el incremento lo habría respetado.

**Y la asignación es lo correcto porque el odómetro es una lectura del mundo real, no un
agregado calculado.** Si el chofer escribe 152.340 porque eso marca el tablero, ese es el
valor bueno aunque no cuadre con la suma de los tramos registrados. La asignación toma la
realidad como autoridad; el incremento tomaría la contabilidad interna.

**Lo único que falta es el comentario que lo diga.** Tal como está, se lee como si pudiera
ser un descuido — y alguien que lo «corrija» a un incremento empeoraría el sistema. Por eso
está en la lista de «qué NO hacer» de §25.4.5.

*(Este manual afirmó lo contrario en su primera versión de §22B.6.2 y tuvo que corregirse.)*
</details>

<details>
<summary><b>9. ¿Por qué el manual insiste en que «un comentario incorrecto es peor que ninguno»?</b></summary>

Porque **desactiva la verificación**.

Un archivo sin comentarios invita a leer el código. Uno con un comentario falso invita a no
leerlo.

El caso central es `auth.service.ts:73-77`:

> *«A replayed (already-revoked) token is treated as theft and revokes every session.»*

No es cierto: `findValidByHash` filtra `revoked: false`, así que un token revocado sale por
la misma puerta que uno inventado. El único `revokeAllForUser` del archivo cubre la baja de
usuario, no el robo.

El hueco son **seis líneas**. Lo caro es que el comentario lo declara resuelto: quien audite
leerá que el mecanismo existe y no lo comprobará. La única forma de encontrarlo es abrir
`findValidByHash`, que está en otro archivo.

Hay tres comentarios así (§25.3, causa 6). Los tres describen una implementación que se
pensó y no llegó — que es, en miniatura, el diagnóstico del proyecto entero.
</details>

<details>
<summary><b>10. En una frase: ¿qué le pasa a este proyecto?</b></summary>

**Está bien construido y mal terminado.**

La arquitectura por capas se respeta **sin una sola excepción** en 6.802 líneas de backend.
La concurrencia está pensada de verdad: el patrón *bloquear-releer-validar-escribir* aparece
cinco veces con cuatro mecanismos distintos, y los comentarios explican el porqué. Las
dependencias son buenas elecciones, algunas notables.

Lo que falta es el último tramo:

- el linter que nadie instaló → **tres cierres obsoletos**
- las pruebas que se detuvieron antes de la parte cara → **cero cobertura de servicios**
- los paquetes declarados y sin usar → **el bug de fechas que uno de ellos evitaba**
- los comentarios escritos para una implementación que no llegó → **tres afirmaciones falsas**

**Casi todos los hallazgos altos son cosas que alguien empezó y no cerró.** Es una deuda
mucho más barata que la alternativa —un diseño equivocado— y por eso el plan del capítulo 25
cabe en unos quince días.
</details>

---

## 26.5 · La prueba del manual

El objetivo declarado era que alguien pudiera reconstruir el sistema leyendo solo esto.
Aquí está la comprobación, sin autoindulgencia.

### 26.5.1 · Lo que el manual cubre

| Área | Cobertura | Dónde |
|:--|:--|:--|
| **Base de datos** | ✅ Las 12 tablas, columna por columna, con FKs, índices y políticas de borrado | §3 |
| **Migración y seed** | ✅ `migration.sql` y `seed.ts` línea por línea | §4 |
| **Backend** | ✅ Los 88 archivos, 5.887 líneas, los 13 módulos, los 57 endpoints | §5-17 |
| **Frontend** | ✅ Los 68 archivos, 5.364 líneas, las 29 pantallas, los 8 componentes | §18-22C |
| **Flujos completos** | ✅ Seis casos de uso, cinco capas, archivo:línea | §23 |
| **Dependencias** | ✅ Las 50, con versiones resueltas verificadas | §24 |
| **Auditoría** | ✅ 208 hallazgos → 10 causas → plan en 4 fases | §25 |
| **Conceptos base** | ✅ Desde «qué es un proceso» hasta cierres, genéricos y ACID | §1 |

**Sí se podría reconstruir el esquema, la lógica de negocio, las reglas y la interfaz.**

### 26.5.2 · ⚠️ Lo que el manual NO cubre

Y esto es lo que hay que decir en voz alta:

| Hueco | Consecuencia |
|:--|:--|
| 🔴 **Despliegue** | No hay Dockerfile documentado, ni configuración de proxy inverso, ni la regla de reescritura que `BrowserRouter` exige en producción (§18.9-1). **Reconstruir el código no es poner el sistema en marcha.** |
| 🔴 **Variables de entorno reales** | `config/env.ts` está explicado, pero **no hay un `.env.example` comentado** con qué significa cada valor y cómo generarlo (los secretos JWT, la clave AES, el SMTP) |
| ⚠️ **Los capítulos 02-07 sin tabla de hallazgos** | ~197 marcas inline sin consolidar. El censo de 208 es un piso (§25.2.2) |
| ⚠️ **El cliente Prisma generado** | Las 22.748 líneas se explican **conceptualmente**, no línea por línea. Fue una decisión acordada al empezar, y es la correcta —es código generado— pero es una excepción al «todo línea por línea» |
| ⚠️ **Copia de seguridad y recuperación** | Ninguna mención. Un sistema con auditoría inmutable y borrado lógico necesita una política |
| ⚠️ **Rendimiento medido** | Se señalan riesgos (informes sin tope, N+1 potenciales) pero **no hay una sola medición**. Todo es análisis estático |
| ⚠️ **Accesibilidad** | Se mencionan detalles sueltos (el `title` del iframe, las dos paradas de tabulación) pero no hay una revisión sistemática |

**La conclusión honesta:** el manual permite **entender y reconstruir el software**. No
permite **operar el sistema**. Son cosas distintas, y la segunda necesitaría un documento
propio.

### 26.5.3 · Lista de comprobación del lector

Si se pueden responder las diez de §26.4 y hacer estas seis cosas, el objetivo se cumplió:

- [ ] Explicar por qué `SELECT ... FOR UPDATE` no basta sin releer
- [ ] Localizar dónde se valida una regla de negocio cualquiera, sin buscador
- [ ] Predecir qué ve el usuario ante cada uno de los cinco modos de fallo
- [ ] Añadir un endpoint nuevo respetando las cinco capas, sin mirar otro módulo
- [ ] Encontrar un hallazgo que el manual no registró
- [ ] Defender, ante quien paga, por qué arreglar tres cosas antes que doscientas

---

## 26.6 · Cómo mantener este manual

Un manual de 35.000 líneas sobre un código que cambia se convierte en mentira rápido — que
es, con precisión, el hallazgo que este manual le reprocha al proyecto.

**Cuatro reglas:**

**1. Cada cambio de código toca su capítulo.** No al final del sprint: en el mismo cambio.
Un manual que se actualiza «cuando haya tiempo» no se actualiza.

**2. Cada hallazgo cerrado se tacha, no se borra.** Deja constancia de qué estaba mal y
cuándo se arregló. El historial de correcciones es información.

**3. Toda afirmación se verifica contra el código antes de escribirse.** Es la regla que
este manual siguió y que **falló cuatro veces** (§25.1.1). Las cuatro se corrigieron con
nota visible, precisamente porque un informe que nunca se equivoca es un informe que no se
verificó.

**4. Las correcciones se dejan a la vista.** Sin ellas, el lector no puede calibrar cuánto
fiarse del resto.

---

## 26.7 · Cierre

### 26.7.1 · El manual en números

| | |
|:--|--:|
| Capítulos | 27 (00 a 26) |
| Líneas | **35.421** |
| Palabras | ≈ **284.000** |
| Diagramas Mermaid | **128** |
| Tablas | **441** |
| Preguntas de repaso desplegables | **66** |
| Ejercicios | **> 200** |
| Hallazgos tabulados | **208** + 28 positivos |
| Correcciones al propio manual | **4**, todas visibles |

**Proporción:** ≈ 35.400 líneas de manual para ≈ 12.200 de código escrito a mano. **Casi
tres a uno.** Es lo que pedía el encargo —«prefiero un documento de miles de páginas antes
que omitir información»— y es la razón de que este documento sirva para reconstruir el
sistema y no solo para recordarlo.

### 26.7.2 · Lo que queda dicho del proyecto

Un sistema de gestión de flota de 12.200 líneas, escrito con una arquitectura por capas que
se respeta sin excepciones, con concurrencia pensada de verdad, con dependencias bien
elegidas, y con comentarios que —cuando son ciertos— explican el porqué y no el qué.

Y con 49 hallazgos de gravedad alta que son **diez problemas**, de los cuales **cuatro se
resuelven en poco más de una jornada** y cierran catorce de esos cuarenta y nueve.

**Empezado bien. Terminado a medias.** Que es, para un trabajo académico, un resultado
mucho mejor de lo contrario: es más barato terminar algo bien construido que rehacer algo
mal diseñado.

### 26.7.3 · Lo que queda dicho del método

Este manual auditó el código de una forma concreta: **verificando cada afirmación contra el
código antes de escribirla**. Esa disciplina encontró los hallazgos que importan —los que
viven **entre** archivos, invisibles leyendo cualquiera de ellos por separado— y falló
cuatro veces, que quedaron registradas.

Los tres hallazgos más valiosos del manual comparten esa forma:

- **El vehículo sin seguro** necesita cuatro archivos para verse.
- **El ciclo viaje → odómetro → alerta → mantenimiento** cruza cinco módulos que no se
  llaman entre sí.
- **La detección de robo de tokens** exige leer un comentario en un archivo y una consulta
  en otro para descubrir que se contradicen.

> **Ninguno de los tres es un error en una línea.** Los tres son errores en el espacio entre
> líneas — y ese espacio no lo cubre ningún linter, ninguna prueba unitaria y ninguna
> revisión archivo por archivo.
>
> Solo lo cubre alguien que lea el sistema entero. Que es, exactamente, para lo que sirve
> este documento.

---

> **Anterior:** [Capítulo 25 — Los hallazgos, consolidados y priorizados](./25-hallazgos-plan-de-accion.md)
> **Volver al índice:** [`00-indice.md`](./00-indice.md)
