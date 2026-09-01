# Plan de continuación del manual técnico

> Archivo de trabajo, no forma parte del manual. Sirve para retomar la escritura
> desde cero en una conversación nueva sin perder criterio ni contexto.

---

## Estado

| Capítulos | Estado | Cobertura de código |
|:--|:--|:--|
| 00–21 | ✅ Completos (~26.000 líneas) | **Todo el backend** (6.802 líneas) + `prisma/` + el frontend salvo `pages/` |
| **22A** | ✅ **Completo** | `vehiculos/` (2), `usuarios/` (2), `choferes/` (4) — 8 archivos, 1.261 líneas |
| **22B** | ✅ **Completo** | `viajes/` (5), `mantenimiento/` (6) + `AddressAutocomplete`, `RouteMap` — 13 archivos, 1.230 líneas |
| **22C** | ✅ **Completo** | `chofer/` (3), `dashboard/`, `reportes/`, `alertas/`, `auditoria/` (2), `configuracion/` — 9 archivos, 897 líneas |
| **23** | ✅ **Completo** | Los 6 flujos end-to-end, 5 capas, archivo:línea verificados |
| **24** | ✅ **Completo** | Las **50** dependencias (no 44), una por una, con versiones resueltas verificadas |
| **25** | ✅ **Completo** | **208 hallazgos** censados → **10 causas raíz** → plan en 4 fases |
| 26 | ⏳ Pendiente | Banco de ejercicios, índice final, cierre |

> **Censo exacto (verificado por grep sobre las tablas):**
> 🔴 Alta **49** · ⚠️ Media **75** · ⚠️ Baja **84** · ✅ Positivos **28** = 236 filas.
>
> ⚠️ **Hueco declarado:** los caps. **02-07 NO tienen tabla de hallazgos** (el formato de
> 10 secciones se estabilizó en el cap. 08). Tienen ~197 marcas 🔴/⚠️ inline sin
> consolidar. El censo de 208 es **un piso, no un techo**. Cerrarlo = ejercicio 25.3.6.

> ✅ **EL FRONTEND ESTÁ COMPLETO.** Las 29 pantallas, los 8 componentes, los hooks,
> el estado, la capa de API y el bootstrap: todo cubierto entre los capítulos 18 y 22C.
> Junto con el backend (caps. 05-17) y la BD (caps. 03-04), **todo el código del
> proyecto está documentado**. Lo que queda (23-26) es integración, no lectura de código
> nueva.

> **El patrón de pantalla de listado ya está explicado línea por línea en 22A (§22A.3).**
> 22B y 22C deben **referenciarlo, no repetirlo**, y cubrir solo lo específico de cada pantalla.

---

## Orden de trabajo aprobado

1. ~~**Cap. 22A** — El patrón de pantalla de listado + ABM~~ ✅ **HECHO**
2. ~~**Cap. 22B** — Viajes y mantenimiento (los flujos complejos)~~ ✅ **HECHO**
3. ~~**Cap. 22C** — Chofer, tableros y consulta~~ ✅ **HECHO**
4. ~~**Cap. 23** — Flujos end-to-end (los 6 casos de uso, del clic al píxel)~~ ✅ **HECHO**
5. ~~**Cap. 24** — Dependencias una por una~~ ✅ **HECHO** (son **50**, no 44)
6. ~~**Cap. 25** — Consolidación de hallazgos + plan de acción~~ ✅ **HECHO**
7. **Cap. 26 + cierre** — Banco de ejercicios, índice final actualizado, informe ejecutivo ← **SIGUIENTE Y ÚLTIMO**

---

## 📌 DIRECTIVA DE PROFUNDIDAD (aprobada por el usuario)

**Para los capítulos 22A/B/C, NO aplicar línea por línea exhaustivo a las 29 pantallas.**

Las pantallas son muy repetitivas: siete son el mismo patrón de listado con distintas
columnas. El criterio acordado:

| Tratamiento | A qué se aplica |
|:--|:--|
| **Línea por línea completo** | El patrón de listado, **explicado UNA vez** en 22A. Y los diálogos de viajes y mantenimiento, donde vive la lógica de negocio del cliente. |
| **Solo lo específico** | Cada pantalla restante: sus reglas propias, sus diálogos, sus decisiones de interfaz y sus bugs. Sin repetir lo ya explicado. |

**Se mantiene sin cambios:**

- ✅ El **tono crítico** con hallazgos verificados contra el código real
- ✅ La estructura de 10 secciones por capítulo
- ✅ Los diagramas Mermaid
- ✅ Las preguntas de repaso con respuestas desplegables
- ✅ Los ejercicios en tres niveles
- ✅ La tabla de hallazgos con gravedad al final de cada capítulo
- ✅ **Verificar cada afirmación contra el código** antes de escribirla (ya hubo un
  hallazgo retirado por incorrecto: §9.6.1, `sanitize` sí existe)

---

## Hallazgos confirmados en 22A (ya desarrollados)

1. 🔴 **Los vencimientos se muestran un día antes** — confirmado y desarrollado en §22A.4,
   con las dos reglas fijadas (`DATE` vs `DATETIME`, mostrar vs input). Pendiente de
   verificar en 22B/22C: `MaintenanceListTab:42` y `MiDocumentacionPage:72`.
2. ✅ **Las nueve pantallas usan `useCallback` correctamente** — no hay bucle infinito.
3. 🔴 **Cierre obsoleto en `toggleActive`** por el `useMemo` de columnas (§22A.3.5).
   **Verificar el mismo patrón en las pantallas de 22B/22C** — si usan `useMemo` con
   dependencias incompletas capturando `reload`, tienen el mismo bug.
4. 🔴 **No hay forma de dar de baja a un chofer** desde la interfaz (§22A.5.3).

## Hallazgos confirmados en 22B (ya desarrollados)

5. 🔴 **`...(notes ? { notes } : {})` impide borrar campos opcionales al editar**, aunque
   los esquemas Zod del backend los declaran `.nullable()` justamente para permitirlo.
   Grave en `MaintenanceTypeFormDialog:57-58` (`monthsAlert` alimenta el motor de alertas).
6. 🔴 **`estimatedDistanceKm`/`estimatedTimeMin`: camino muerto de punta a punta.** 7
   archivos, 2 columnas, 2 pantallas que los muestran, **nadie los envía**. Siempre NULL.
   `AddressAutocomplete` ya pide (y paga) `geometry` a Google sin usarlo.
7. 🔴 **Cierre obsoleto en `MaintenanceListTab:38-76`** — confirmado el patrón del
   hallazgo 3. La regla queda fijada en §22B.3.1: el `useMemo` con deps incompletas es
   seguro **si y solo si** los manejadores usan identidades estables (setters). Verificado
   caso por caso: `ViajesPage` ✅, `TiposMantenimientoTab` ✅, `MaintenanceListTab` 🔴.
8. 🔴 **Nueve `eslint-disable` y CERO ESLint instalado.** Tres silencian
   `exhaustive-deps` (`MaintenanceListTab:74`, `AlertasPage:88`, `UsuariosPage:123`), seis
   en el backend. **La recomendación de mayor retorno del cap. 25.**
9. ✅ **`TripFormDialog` y `CreateMaintenanceDialog` usan `isoToLocalInput`/
   `localInputToIso` correctamente.** Único manejo de fechas correcto del frontend.
10. ✅ **`FinishTripDialog` implementa RN-5 en tres capas** — el modelo a seguir.
11. ✅ `MantenimientoPage`: el estado de la pestaña **sí** se pierde al navegar (hallazgo
    10 de 22B), y el remontaje al alternar pestañas ocurre por reconciliación posicional.

## Hallazgos confirmados en 22C (ya desarrollados)

12. 🔴 **`MiHistorialPage` limita al chofer a 50 viajes sin paginador ni aviso.**
13. 🔴 **`MiDocumentacionPage` se contradice**: el distintivo "Vencido" (backend, correcto)
    junto a la fecha un día antes (§22A.4). El peor de los 4 sitios del bug de fechas.
14. 🔴 **`AlertasPage:65-90` es el tercer cierre obsoleto** — predicho al cerrar 22B.
    **Regla verificada en las 7 pantallas del patrón** (tabla en §22C.4.2): las 3 que
    llaman a `reload` desde una columna memorizada tienen el bug, las 4 que solo usan
    setters no. Correlación perfecta.
15. ⚠️ **`timezone`, `language` y `dateFormat` no los lee NADIE.** Verificado por búsqueda
    en los dos repositorios. Tres campos `required` inertes. Funcionalidad aparente.
16. ⚠️ **El operador recibe `users.total`**; `dashboard.service` no consulta el rol.
    §20.4.2 (*los guards son ergonomía*) aplicado a datos en vez de rutas.
17. ⚠️ **El chofer no se entera de que le asignaron un viaje** — sin sondeo ni sockets.
    La mayor carencia funcional del sistema.
18. ⚠️ **`VJ-000042` vs `VJ-00042`** — `padStart(6)` para el chofer, `padStart(5)` para el
    operador. Invisible en revisión de código.

## Hallazgos confirmados en 23 (ya desarrollados)

19. 🔴 **La rotación de tokens NO detecta el robo**, aunque el comentario de
    `auth.service.ts:73-77` afirma que sí. `findValidByHash` filtra `revoked: false`, así
    que un token revocado sale por la misma puerta que uno inventado. **El hallazgo de
    seguridad más importante del manual.**
20. 🔴 **Un vehículo sin seguro circula sin señal** — hueco entre 4 archivos
    (`pickAvailableVehicle`, `alerts.service.ts:149`, `VehiculosPage:90`,
    `vehicles.service.ts:20`). Cada uno defendible por separado.
21. ⚠️ **Canal de tiempo en el login**: ≈2 ms sin cuenta vs ≈60 ms con `bcrypt.compare`.
22. ⚠️ **`avgKm` deriva y nadie la reconcilia** (media incremental sobre flotante).
23. ⚠️ **Archivos huérfanos** si el proceso muere entre `storeFile` y `safeUnlink`.

## Hallazgos confirmados en 24 (ya desarrollados)

24. 🔴 **`@mui/x-date-pickers` + `dayjs` instalados y SIN USAR** — y resuelven exactamente
    el bug de fechas de §22A.4. **La herramienta que evitaba el bug estaba en el proyecto.**
25. 🔴 **`@testing-library/react` + `jest-dom` instalados y sin usar.** Ninguna prueba
    renderiza un componente. Habrían detectado los tres cierres obsoletos.
26. 🔴 **ESLint NO instalado** — la dependencia ausente más cara. Confirmado en ambos
    `package.json`.
27. ⚠️ **`multer` en la línea 1.x** (mantenimiento; la 2.x corrige DoS).
28. ⚠️ **`@types/nodemailer` 8.0.1 vs `nodemailer` 9.0.3**, y el runtime no trae tipos
    propios (verificado en `node_modules`).
29. ⚠️ **`postinstall: prisma generate` con `prisma` en devDependencies** → falla con
    `npm ci --omit=dev`.

> **Dato corregido:** son **50 dependencias declaradas** (backend 15+13, frontend 12+10),
> no 44 como decía el plan original.
>
> **Dato verificado:** **28 casos de prueba en 8 archivos** — Vitest SÍ se usa. Lo que no
> se prueba es servicios, repositorios, endpoints, componentes ni concurrencia.

## Correcciones aplicadas a capítulos ya escritos

- **§22B.4.2** decía que `AddressAutocomplete` era *"el único lugar del proyecto"* con
  bandera `cancelled`. **Falso**: hay cinco (`App.tsx:40`, `AddressAutocomplete:29`,
  `DashboardPage:29`, `ConfiguracionPage:28`, `MiDocumentacionPage:30`). Corregido en el
  texto y en la tabla de hallazgos. *(Segundo hallazgo retirado tras verificación; el
  primero fue §9.6.1.)*
- **§22B.6.2** decía que finalizar hace `accumulated_km = accumulated_km + tripKm`.
  **Falso**: `trips.service.ts:298` hace `accumulatedKm: dto.arrivalKm` — una **asignación
  absoluta**. Corregido, con nota remitiendo a §23.5.1, donde se argumenta que la
  asignación es además la decisión correcta (el odómetro es una lectura del mundo real,
  no un agregado calculado). *(Tercera corrección.)*
- **§22B ejercicio 3.6** remitía a un inexistente «§18.7.3» y decía que Vitest y Testing
  Library estaban «instalados y sin usar». **Medio falso**: Vitest se usa (28 casos);
  Testing Library no. Corregido con la referencia real (§20.9, hallazgo 1).

## Datos acumulados para el cap. 25

- **Ternario anidado de doble error**: 6 apariciones idénticas → candidato a `<ErrorBanner>`.
- **Componente etiqueta-valor duplicado 4 veces**: `Field` (TripDetailDialog), `Detail`
  (MaintenanceDetailDialog), `Row` (MiViajePage), `Info` (AuditLogDetailDialog).
- **`StatusChip` reimplementado a mano** en `MiHistorialPage:34` y `MiViajePage:71`.
- **Bug de fechas `DATE`**: 4 sitios (`ChoferesPage:53`, `VehiculosPage:90`,
  `DriverDocumentsDialog:168`, `MiDocumentacionPage:72`).
- **`limit: 100` silencioso**: 3 selectores.
- **Cierres obsoletos**: 3 pantallas.
- **`eslint-disable` sin ESLint**: 9 (3 frontend, 6 backend).

---

## Cómo retomar en una conversación nueva

1. Leer `docs/manual-tecnico/00-indice.md` (estado, convenciones, hallazgos acumulados).
2. Leer este archivo.
3. Leer el capítulo inmediatamente anterior al que toca escribir, para el tono y el formato.
4. Leer el código de los archivos del capítulo que toca.
5. Escribir, verificando cada afirmación contra el código.
6. Actualizar la tabla de estado y los hallazgos acumulados de `00-indice.md`.
