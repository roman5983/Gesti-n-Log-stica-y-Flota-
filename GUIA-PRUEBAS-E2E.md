# Guía de prueba end-to-end — Sistema de Gestión Logística

Guion paso a paso para validar el sistema completo en el navegador, exercitando el ciclo de negocio de punta a punta y los tres roles (Administrador, Operador, Chofer).

---

## 1. Preparación

Necesitás **dos terminales** abiertas al mismo tiempo:

**Terminal A — Backend**
```bash
mysql -u root -p -e "SELECT 1;"
cd ~/DSWTP/backend && npm run dev
```
Esperá el mensaje `API listening on http://localhost:3000`.

**Terminal B — Frontend**
```bash
cd ~/DSWTP/frontend && npm run dev
```
Esperá el mensaje de Vite y abrí **http://localhost:5173** en el navegador.

**Base de datos limpia (recomendado antes de empezar):** para partir de datos coherentes de demostración, reseteá y resembrá:
```bash
cd ~/DSWTP/backend && npx prisma migrate reset && npx prisma db seed
```
(Confirmá con `y`. El reset borra todo; el seed carga la empresa de demostración. Volver a correr solo `npx prisma db seed` también deja todo como al principio.)

**Qué trae el seed:** una empresa que opera hace ~200 días — más de 400 viajes finalizados (el gráfico del dashboard muestra 6 meses), cancelaciones, historial de mantenimientos, documentos con vencimientos variados, alertas ya resueltas y más de 1.500 registros de auditoría. Las **alertas pendientes** las genera el job automático unos 15 segundos después de levantar el backend.

> Si el login se cuelga o da `pool timeout`, MySQL no está respondiendo: `brew services restart mysql`, esperá 5 segundos, y reiniciá el backend.

---

## 2. Credenciales del seed

| Rol | Email | Contraseña | Notas |
|-----|-------|-----------|-------|
| Administrador | `admin@empresa.com` | `Admin1234!` | Acceso total |
| Operador | `operador@empresa.com` | `Operator1234!` | Operación diaria |
| Operadora (Sofía Martínez) | `sofia@empresa.com` | `Operator1234!` | Segunda operadora |
| Chofer (Juan Pérez) | `chofer@empresa.com` | `Driver1234!` | Licencia vigente — **disponible** |
| Chofer (María Gómez) | `maria@empresa.com` | `Driver1234!` | Con viaje en curso (Mendoza, DDD444) |
| Chofer (Carlos Ruiz) | `carlos@empresa.com` | `Driver1234!` | Licencia **por vencer** (10 días) — asignable |
| Chofer (Lucía Fernández) | `lucia@empresa.com` | `Driver1234!` | Licencia **vencida** — no asignable |
| Chofer (Valentina Ríos) | `valentina@empresa.com` | `Driver1234!` | Disponible |
| Chofer (Diego Sosa) | `diego@empresa.com` | `Driver1234!` | Disponible (ingresó hace 4 meses) |
| Chofer (Roberto Díaz) | `roberto@empresa.com` | `Driver1234!` | **Dado de baja** — no puede iniciar sesión |

> El token de sesión dura 15 minutos; si algo deja de responder con "no autorizado", volvé a iniciar sesión.

---

## 3. Escenario guiado (camino principal)

Este recorrido sigue el ciclo completo de un viaje, tocando los tres roles. Hacelo en orden.

### 3.1 — Como ADMINISTRADOR: puesta a punto

1. Iniciá sesión con `admin@empresa.com`. **Esperado:** entrás al **Dashboard** con sidebar oscuro. Ves las tarjetas KPI (viajes en curso, pendientes, vehículos disponibles, alertas activas), la fila extra de totales de admin, y el gráfico de viajes por mes.
2. Andá a **Usuarios**. **Esperado:** ves solo cuentas administrativas (el admin y los dos operadores), **ningún chofer** en la lista. El filtro de rol solo ofrece Administrador/Operador.
3. Creá un usuario: *Nuevo usuario* → nombre "Test Operador", email `test@empresa.com`, contraseña `Test1234!`, rol Operador → *Crear*. **Esperado:** aparece en la tabla. (En la **Terminal A** del backend deberías ver la línea `[mailer:dev] credentials email for test@empresa.com`.)
4. Editá ese usuario, desactivalo con el toggle y volvé a activarlo. Luego eliminalo (baja lógica). **Esperado:** cada acción se refleja al instante.
5. Andá a **Choferes**. **Esperado:** ves los 7 choferes del seed. Lucía aparece con el vencimiento de licencia en **rojo** y "Disponible: No"; Roberto tiene el chip **Inactivo** (dado de baja).
6. En Juan Pérez, abrí **Credenciales** (ícono de llave) → *Ver contraseña*. **Esperado:** muestra la contraseña en claro (A-9). Esto queda registrado en auditoría.
7. En **Diego Sosa**, abrí **Documentación** (ícono de documento). Subí un archivo: tipo **Psicofísico** (es el único que le falta), un vencimiento futuro, elegí un PDF/JPG/PNG (< 1 MB). **Esperado:** el documento aparece listado; podés abrirlo con el ícono de "abrir". (Los documentos que ya trae el seed son de muestra: el archivo en sí no existe en disco, así que abrirlos da error.)

### 3.2 — Como OPERADOR: crear y asignar el viaje

1. Cerrá sesión y entrá con `operador@empresa.com`. **Esperado:** Dashboard (sin la fila de totales de admin; el sidebar no muestra Usuarios/Auditoría/Reportes/Configuración).
2. Andá a **Vehículos**. **Esperado:** ves la flota, pero **sin botones de acción** (crear/editar/eliminar) — el operador solo consulta.
3. Andá a **Viajes** → *Crear viaje*. Destino "Buenos Aires", fecha y hora de salida a una hora puntual (ej. mañana 08:00), observaciones opcionales → *Crear*. **Esperado:** el viaje aparece con estado **Pendiente de asignación**. El origen es fijo (Ciudad Industria...), no editable.
4. **Verificación de zona horaria:** anotá la hora que pusiste. Abrí *Editar* en ese viaje. **Esperado:** el campo de fecha muestra **la misma hora** que pusiste (no corrida). Cerrá sin guardar.
5. En ese viaje, clic en **Asignar**. **Esperado:** el selector lista solo choferes disponibles (Juan Pérez sí; Lucía **no** aparece por licencia vencida). Elegí a Juan → *Asignar*.
6. **Esperado:** el viaje pasa a **En viaje**, con Juan y un vehículo asignado automáticamente. Si mirás **Vehículos**, ese vehículo quedó **En viaje** (ON_TRIP).

### 3.3 — Como CHOFER: cerrar el viaje

1. Cerrá sesión y entrá con `chofer@empresa.com` (Juan Pérez). **Esperado:** app estilo **mobile** con barra de navegación inferior (Viaje / Documentación / Historial) — no el sidebar de admin.
2. En **Mi viaje**: **Esperado:** ves la hoja de ruta del viaje que asignó el operador (origen, destino, vehículo, salida).
3. Clic en **Cerrar hoja de ruta**. Ingresá un kilometraje final **mayor** al inicial que muestra el diálogo → *Finalizar viaje*. **Esperado:** el viaje se cierra. (Probá poner un km menor: el botón queda deshabilitado y avisa que debe ser mayor — RN-5.)
4. Andá a **Mi historial**. **Esperado:** el viaje recién cerrado aparece en tu historial.
5. Andá a **Mi documentación**. **Esperado:** ves tus documentos con sus vencimientos (el ART de Juan figura por vencer). Es solo consulta: **no hay botón para subir ni para eliminar** — la documentación la carga el administrador.

### 3.4 — Como ADMINISTRADOR: alertas, reportes y auditoría

1. Volvé a entrar como `admin@empresa.com`.
2. Andá a **Alertas**. **Esperado:** ya hay **10 alertas pendientes**, generadas solas por el job automático: licencia de Lucía **vencida** y de Carlos **por vencer**; documentos por vencer (ART de Juan y María, licencia de Carlos) y vencido (licencia de Lucía); seguro de BBB222 **por vencer** y de CCC333 **vencido**; BBB222 con **km de mantenimiento superado**; CCC333 **inactivo**. Si apretás *Evaluar alertas* el aviso dice "0 nuevas" (el job ya las creó). La pestaña **Resueltas** trae el historial: renovaciones de licencias y seguros, documentos reemplazados.
3. Marcá una alerta como resuelta (ícono de tilde) y confirmá. **Esperado:** desaparece de "Pendientes" y aparece en "Resueltas". (Si la condición sigue vigente, el job la vuelve a levantar en su próxima pasada: resolver a mano no arregla la causa.)
4. **Auto-resolución:** si corregís la condición (ej. en Choferes, editá a Carlos y ponele una licencia con vencimiento lejano) y volvés a *Evaluar alertas*, esa alerta se **auto-resuelve** (el aviso dirá "... N auto-resueltas").
5. Andá a **Reportes**. Tocá el atajo *Últimos 30 días* → *Generar informe*. **Esperado:** KPIs (viajes finalizados, km totales, distancia promedio, mantenimientos) y tres tablas: por chofer, por vehículo, y destinos más frecuentes, con datos de todo el mes. El viaje que cerró Juan debería figurar. Probá también un rango de más de 366 días: el botón se deshabilita y avisa el límite.
6. Andá a **Auditoría**. **Esperado:** el registro cronológico de meses de uso, todo en castellano. Filtrá por acción *Consulta de credenciales* (ahí está la que hiciste con Juan) y buscá la creación de tu viaje. Abrí el **detalle** (ícono de ver) de una *Modificación* de vehículo o chofer (renovación de seguro o licencia). **Esperado:** "1 campo modificado" con el valor anterior tachado y el nuevo resaltado; los campos sin cambios quedan plegados.
7. Andá a **Configuración**. Cambiá el teléfono de la empresa → *Guardar cambios*. **Esperado:** toast de confirmación. (Si volvés a Auditoría y evaluás, verás el registro del cambio con su antes/después.)

---

## 4. Checklist rápido por rol

**Administrador** — debe poder: ver dashboard completo · CRUD de usuarios (solo admin/operador) · CRUD de choferes + credenciales + documentos · CRUD de vehículos · CRUD de tipos de mantenimiento · operar viajes y mantenimientos · evaluar/resolver alertas · ver reportes · ver auditoría con detalle · editar configuración.

**Operador** — debe poder: ver dashboard (sin totales de admin) · consultar vehículos y choferes (sin mutarlos) · crear/asignar/finalizar/eliminar viajes · registrar y operar mantenimientos · ver alertas (sin evaluar ni resolver). **No** debe ver: Usuarios, Auditoría, Reportes, Configuración.

**Chofer** — debe poder: ver su viaje actual y cerrarlo · ver su historial · ver y subir su documentación (sin borrar). **No** debe ver: nada de la app de escritorio (solo sus tres pantallas mobile).

---

## 5. Validaciones puntuales para verificar (casos borde)

Estas confirman que las reglas de negocio y las correcciones aplicadas siguen firmes:

- **Email/DNI/patente duplicados:** intentá crear un usuario o chofer con un email ya usado, o un vehículo con una patente existente → error 409 claro, no un error genérico.
- **Baja lógica + recreación:** eliminá un usuario y creá otro con el mismo email → debe funcionar (el email se libera con tombstone).
- **Un documento activo por tipo:** subí un segundo DNI al mismo chofer → lo rechaza con conflicto.
- **Chofer no asignable:** intentá asignar un viaje cuando el único chofer "disponible" es Lucía → no aparece en la lista (licencia vencida).
- **Vehículo en viaje:** un vehículo ON_TRIP no se puede desactivar ni eliminar (el botón no aparece / da error).
- **Mantenimiento:** en Mantenimiento → Programados, registrá uno, iniciálo (el vehículo pasa a "En taller") y completalo (vuelve a "Disponible").
- **Permisos cruzados:** como operador, confirmá que no podés navegar a `/usuarios` (te redirige) ni ver botones de mutación en Vehículos.

---

## 6. Notas

- El **envío de credenciales** por email corre en modo desarrollo (no envía, solo registra en la consola del backend). Para envío real, configurar `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` en `~/DSWTP/backend/.env`.
- El **mapa de recorrido** (en el detalle de un viaje) muestra un botón a Google Maps; para embeber el mapa, configurar `VITE_GOOGLE_MAPS_API_KEY` en el `.env` del frontend.
- Si en cualquier momento el frontend queda en blanco o con errores raros tras cambios de dependencias: `cd ~/DSWTP/frontend && rm -rf node_modules package-lock.json && npm install`.
