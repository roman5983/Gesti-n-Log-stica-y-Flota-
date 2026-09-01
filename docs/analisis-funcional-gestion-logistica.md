# Análisis Funcional — Sistema de Gestión Logística y Flota (TP DSW)

**Fecha de análisis:** 2026-07-13
**Analista:** Arquitectura / Análisis Funcional

## Documentos fuente

Toda afirmación de este análisis se referencia a uno de estos documentos:

| ID | Documento | Contenido |
|:-|:-|:-|
| DOC-1 | `proposal-2.md` (Propuesta TP DSW) | Grupo, repositorio, tema, alcance mínimo / aprobación / voluntario (CRUDs, listados, CUU) |
| DOC-2 | `Funcionalidades_Sistema_Gestion_Logistica_Corregido.md` | Funcionalidades por rol (Operador, Administrador, Chofer web), WebSockets, funcionalidades generales |
| DOC-3 | PDF "Proyecto Ampliado" (5 pág.) | Descripción ampliada, entidades nuevas, RNF ampliados, 8 reglas de negocio, roles ampliados, KPIs, modelo de datos resumido, casos de uso críticos |
| DOC-4 | PDF "Descripción del Proyecto" (2 pág.) | Versión base: entidades Chofer/Vehículo/Viaje con atributos, RNF, 3 reglas de negocio core, roles |
| DOC-5 | PDF de mockups (3 pág., imágenes) | 15 pantallas: 5 de Operador, 5 de Administrador, 5 de Chofer (móvil/responsive) |
| DOC-6 | PDF DER (1 pág., imagen) | Diagrama entidad-relación con entidades, atributos y cardinalidades |
| DOC-7 | Descripción del proyecto (metadata de la carpeta de conocimiento) | Resumen ejecutivo de la plataforma |

**Nota metodológica:** DOC-4 describe la versión "base" del TP y DOC-3 la versión "ampliada" que evoluciona sobre ella. Donde se contradicen, se indica explícitamente (sección 12).

---

# 1. Comprensión general

**Objetivo del sistema.** Plataforma web integral para gestionar y optimizar las operaciones logísticas de una empresa de servicios, centralizando en un único entorno la flota vehicular, el personal (choferes) y la ejecución de los servicios (viajes / hojas de ruta) (DOC-4 §1, DOC-7).

**Problema que resuelve.**

- Falta de visibilidad en tiempo real del estado de cada unidad de la flota (disponible, en viaje, en mantenimiento/taller, inactiva) (DOC-7).
- Riesgo de asignaciones indebidas: choferes con licencia o documentación vencida, vehículos sin mantenimiento al día (DOC-3 §4, DOC-4 §4).
- Ausencia de trazabilidad de las operaciones (quién hizo qué y cuándo) → se resuelve con auditoría (DOC-1, DOC-3, DOC-7).
- Gestión reactiva en lugar de proactiva → se resuelve con alertas automáticas por vencimientos y mantenimientos pendientes (DOC-7).
- Falta de datos para decisiones → se resuelve con dashboard de KPIs (DOC-3 §6, DOC-7).

**Usuarios.** Empleados de la empresa con tres roles confirmados: **Administrador**, **Operador** y **Chofer** (DOC-1, DOC-2, DOC-6). Existe un cuarto rol **Supervisor** propuesto como *opcional* solo en DOC-3 §5.

**Cómo interactúan.**

1. El Administrador crea usuarios y les envía credenciales por mail (DOC-1 alcance voluntario, DOC-7); administra alertas, auditoría y configuración (DOC-2).
2. El Operador planifica: crea viajes asignando chofer y vehículo disponibles y con documentación vigente; registra mantenimientos (DOC-2, DOC-3 §5).
3. El Chofer recibe el viaje asignado (en tiempo real vía WebSockets según DOC-2), lo ejecuta, sube su documentación personal y cierra la hoja de ruta registrando el kilometraje final (DOC-2, DOC-5).
4. El sistema genera automáticamente alertas y registros de auditoría a partir de las acciones de todos (DOC-3 regla 7, DOC-7).

---

# 2. Roles del sistema

## 2.1 Administrador

| Aspecto | Detalle | Fuente |
|:-|:-|:-|
| Responsabilidades | Gestión total del sistema: usuarios, flota, choferes, auditoría, alertas, configuración | DOC-2, DOC-3 §5, DOC-4 §5 |
| Permisos | CRUD completo de todas las entidades; gestión de usuarios y roles; acceso a auditoría; modificación de reglas operativas (opcional) | DOC-3 §5 |
| Funcionalidades | Dashboard administrativo (estadísticas generales, totales de vehículos, choferes activos, mantenimientos pendientes, usuarios, alertas recientes); gestión de usuarios (listar, buscar, filtrar por rol/estado, crear, editar, eliminar, activar/desactivar, gestionar roles); auditoría (consultar y filtrar por usuario/acción/entidad/fechas); gestión de alertas (ver pendientes y resueltas, marcar resueltas); configuración (datos de empresa, zona horaria, idioma, formato de fecha) | DOC-2 §Administrador |
| Restricciones | Ninguna documentada | — |

## 2.2 Operador

| Aspecto | Detalle | Fuente |
|:-|:-|:-|
| Responsabilidades | Operación diaria: planificación y cierre de viajes, registro de mantenimientos | DOC-3 §5 |
| Permisos | Crear y asignar viajes; ver alertas; cerrar viajes; registrar mantenimientos | DOC-3 §5 |
| Funcionalidades | Dashboard operativo (viajes en curso/pendientes, vehículos disponibles, alertas activas, gráfico de viajes por mes, alertas recientes); gestión de viajes (listar, buscar, filtrar por estado y fechas, crear, ver detalle, editar, eliminar *según permisos*); crear viaje (origen, destino, fecha/hora, chofer, vehículo, validación de disponibilidad, observaciones); detalle de viaje (mapa, distancia, registrar kilometraje, finalizar hoja de ruta); registrar mantenimiento | DOC-2 §Operador |
| Restricciones | "Eliminar un viaje (según permisos)" — la condición de permiso no está definida (ver §12). No accede a auditoría ni configuración (su menú lateral en DOC-5 no las incluye) | DOC-2, DOC-5 |

## 2.3 Chofer

| Aspecto | Detalle | Fuente |
|:-|:-|:-|
| Responsabilidades | Ejecutar viajes asignados y mantener su documentación personal al día | DOC-2, DOC-3 §5 |
| Permisos | Ver viajes asignados; cerrar hoja de ruta; subir documentación personal | DOC-3 §5, DOC-4 §5 |
| Funcionalidades | Inicio de sesión y recuperación de contraseña; consultar viaje asignado (destino, distancia, vehículo, fecha, recorrido en Google Maps, tiempo estimado); finalizar hoja de ruta (registrar y validar kilometraje final, confirmar); documentación (subir, visualizar, gestionar archivos); historial de viajes realizados | DOC-2 §Chofer, DOC-5 |
| Restricciones | Acceso restringido: solo sus viajes y su documentación (DOC-4 §5). Interfaz web responsive con comunicación en tiempo real por WebSockets (DOC-2) | DOC-2, DOC-4 |

## 2.4 Supervisor (opcional, solo DOC-3)

Validar mantenimientos, aprobar viajes especiales, gestionar incidentes (DOC-3 §5). No aparece en DOC-1, DOC-2, DOC-5 ni DOC-6 → decisión pendiente (§12).

---

# 3. Módulos

| Módulo | Propósito | Información que maneja | Relación con otros módulos |
|:-|:-|:-|:-|
| **Usuarios y roles** | Alta/gestión de usuarios del sistema con rol Administrador, Operador o Chofer; activación/desactivación; envío de credenciales por mail | id, nombre, email, contraseña hasheada, rol, estado | Base de todo: Chofer es un tipo de usuario (DOC-6); Auditoría registra acciones de usuarios; Viajes referencian chofer y operador |
| **Choferes** | Administración de conductores, su disponibilidad y aptitud para viajar | dni, estado, viajes_realizados, promedio_km (DOC-6); en DOC-4: nombre, DNI, categoría de licencia (A, B, C, E), vencimiento de licencia, estado Activo/Inactivo | Depende de Usuarios (especialización); 1:N con Viajes y con Documentación |
| **Documentación** | Documentos obligatorios del chofer (licencia, ART, psicofísico, DNI) con vencimientos y archivo adjunto | id_doc, tipo_doc, fecha_vencimiento, archivo_adj (DOC-6) | Depende de Chofer (DOC-1: "CRUD Documentacion {depende de} CRUD Usuario (Chofer)"); dispara Alertas por vencimiento; bloquea Viajes |
| **Vehículos** | Administración de la flota con estado y kilometraje | patente, modelo, año, km_acumulado, fecha_ultimo_mantenimiento, estado (DOC-4, DOC-6) | 1:N con Viajes y con Mantenimientos; su estado depende de Viajes y Mantenimiento |
| **Tipos de mantenimiento** | Catálogo de tipos de intervención | id, descripcion, km_alerta, km_objetivo (DOC-6) | Mantenimiento depende de este catálogo (DOC-1) |
| **Mantenimiento** | Planificar, registrar y controlar intervenciones preventivas/correctivas; historial por unidad | nro, estado, observaciones, fecha_hora_programada, fecha_hora_finalizacion, km, tipo, vehículo, próximo mantenimiento sugerido, comprobantes adjuntos (DOC-2, DOC-5, DOC-6) | Depende de Vehículo y Tipo de mantenimiento (DOC-1); desbloquea vehículo (DOC-3 CUU); genera Alertas |
| **Viajes / Hojas de ruta** | Planificación, asignación, seguimiento y cierre de viajes | origen*, destino, fecha/hora salida, chofer, vehículo, estado, km, distancia, observaciones (*origen no figura en DOC-6 — ver §12) | Vincula Chofer + Vehículo + Operador; validado por Documentación y Mantenimiento; genera Auditoría; actualiza km del vehículo |
| **Alertas** | Notificación proactiva de situaciones críticas (vencimientos, mantenimientos, indisponibilidad) | id, tipo_alerta, entidad_afectada, fecha_alerta, estado Pendiente/Resuelta (DOC-3, DOC-6) | Alimentada por Documentación, Mantenimiento y Vehículos; gestionada por Administrador; visible en dashboards |
| **Auditoría** | Trazabilidad de acciones críticas de los usuarios | id, usuario, acción, entidad, fecha, datos previos y posteriores (DOC-3, DOC-6) | Transversal: registra altas, bajas, asignaciones y cambios de estado de todos los módulos (DOC-3 regla 7) |
| **Listados operativos** | Consulta rápida del estado de la operación | Viajes por estado, vehículos por estado, choferes disponibles, alertas pendientes, auditorías, historial de mantenimientos por vehículo | Lee de todos los módulos (DOC-1) |
| **Dashboard** | KPIs del negocio | Vehículos disponibles vs. en taller, choferes activos vs. inactivos, viajes por mes, km total por vehículo, alertas abiertas por tipo, mantenimientos pendientes (DOC-1, DOC-3 §6) | Lee de todos los módulos |
| **Configuración** | Parámetros de la empresa y del sistema | Datos de empresa (nombre, CUIT, dirección, teléfono, email), zona horaria, idioma, formato de fecha (DOC-2, DOC-5) | Transversal. Solo aparece en DOC-2/DOC-5 (ver §12) |
| **Notificaciones en tiempo real** | Recepción instantánea de asignaciones y cambios de estado vía WebSockets | Eventos de asignación, cambio de estado de viajes, notificaciones | Transversal a Viajes y Alertas. Solo en DOC-2 (ver §12) |

---

# 4. CRUDs

Según DOC-1 (alcance de la propuesta, que es el contrato con la cátedra):

| # | Entidad | Tipo | Operaciones | Validaciones documentadas | Dependencias | Reglas de negocio asociadas |
|:-|:-|:-|:-|:-|:-|:-|
| 1 | **Usuario** (Chofer, Operador o Administrador) | CRUD simple | Crear, listar, buscar, filtrar (rol, estado), editar, eliminar, activar/desactivar (DOC-2) | Email, contraseña hasheada (DOC-3); campos obligatorios no detallados | — | Envío de credenciales por mail al crear (DOC-1 voluntario); un chofer inactivo no debería ser asignable (implícito, no documentado formalmente — §12) |
| 2 | **Vehículo** | CRUD simple | Crear, listar con filtro por estado, editar, eliminar (DOC-1, DOC-2 general) | Patente, modelo, año, km acumulado, estado | — | No asignable si En Taller / En Viaje (DOC-4); bloqueo por mantenimiento vencido (DOC-3/DOC-4 regla 3); vuelve a Disponible solo con cierre correcto del viaje (DOC-3 regla 8) |
| 3 | **Tipo de mantenimiento** | CRUD simple | CRUD completo (DOC-1) | descripcion, km_alerta, km_objetivo (DOC-6) | — | Define umbrales de alerta/objetivo de km |
| 4 | **Mantenimiento** | CRUD dependiente | Crear (registrar), listar, historial por vehículo (DOC-1 voluntario) | Vehículo*, tipo*, fecha*, kilometraje*, descripción, próximo mantenimiento sugerido, adjuntos (DOC-5) | Tipo de mantenimiento y Vehículo (DOC-1) | Registrar mantenimiento desbloquea el vehículo (DOC-3 CUU); estados Pendiente/Realizado (DOC-3) |
| 5 | **Documentación** | CRUD dependiente | Subir, visualizar, gestionar archivos (DOC-2 Chofer) | tipo (licencia, ART, psicofísico), fecha de vencimiento, archivo adjunto (DOC-3); formatos PDF/JPG/PNG (DOC-5) | Usuario-Chofer (DOC-1) | Subir documentación vencida → genera alerta (DOC-3 CUU); documentación vencida bloquea inicio de viaje (DOC-3 regla 4) |
| 6 | **Auditoría** | CRUD (adicional aprobación) | Registrar (automático), listar, filtrar por usuario/acción/entidad/fechas (DOC-2) | usuario, acción, entidad, fecha, datos previos/posteriores | Usuario | Registro automático para altas, bajas, asignaciones, cambios de estado (DOC-3 regla 7). *Que sea "CRUD" completo es dudoso — ver §12* |
| 7 | **Alerta** | CRUD (adicional aprobación) | Emitir (automático), listar pendientes/resueltas, marcar como resuelta (DOC-2) | tipo, entidad afectada, fecha, estado | Entidades afectadas (chofer, vehículo, documentación, mantenimiento) | Generación automática ante licencia vencida, mantenimiento pendiente, doc por vencer, etc. (DOC-3) |
| 8 | **Viaje / Hoja de ruta** | Entidad de relación (CUU, no listada como CRUD en DOC-1) | Crear, listar, buscar, filtrar, ver detalle, editar, eliminar según permisos (DOC-2) | Ver §10 | Chofer, Vehículo, Operador | Ver §7 |

**Nota:** DOC-2 agrega para Viaje operaciones de CRUD completo (crear/editar/eliminar) que DOC-1 no lista explícitamente como "CRUD Viaje"; DOC-3 lo lista como entidad base con CRUD obligatorio. Se unifica: Viaje tiene CRUD completo + casos de uso propios.

---

# 5. Pantallas

Fuente: DOC-5 (mockups) complementado con DOC-2 (funcionalidades por pantalla). No se inventan elementos: lo ilegible en el mockup se marca como tal.

## 5.1 Interfaz Operador (web, layout con sidebar oscuro)

**Menú lateral del Operador:** Dashboard, Viajes, Vehículos, Choferes, Mantenimiento, Alertas, Cerrar sesión. Header con campana de notificaciones y usuario "Operador".

### P-OP-1 Dashboard
- **Propósito:** estado general de la operación (DOC-2).
- **Componentes:** 4 tarjetas KPI: "Viajes en curso" (con enlace *Ver viajes*), "Viajes pendientes" (*Ver viajes*), "Vehículos disponibles" (*Ver vehículos*), "Alertas activas" (*Ver alertas*); gráfico de barras "Viajes por mes" con selector de período ("Este mes"); panel "Alertas recientes" (ej.: licencia vencida de chofer, mantenimiento vencido de vehículo, documentación por vencer) con enlace *Ver todas las alertas*.
- **Navegación:** accesos rápidos a cada módulo (DOC-2).

### P-OP-2 Viajes — Listado
- **Propósito:** listar, buscar y filtrar viajes (DOC-2).
- **Componentes:** botón primario **+ Crear viaje**; filtros: Estado (combo, "Todos"), Fecha desde, Fecha hasta; botón **Buscar**; tabla con columnas: N° Viaje (formato `VJ-00045`), Fecha, Origen, Destino, Chofer, Vehículo, Estado (badge *En curso* / *Finalizado*), Acciones (ver detalle; ícono de edición visible en filas en curso); paginación.
- **Acciones:** crear, ver detalle, editar, (eliminar según permisos, DOC-2).

### P-OP-3 Crear viaje
- **Propósito:** planificar un viaje asignando recursos (DOC-2).
- **Componentes:** botón *Volver*; botón primario de guardado (esquina superior derecha); campos: Origen\*, Destino\*, Fecha salida\* (datepicker), Hora salida\*, Chofer\* (combo con nombre y DNI; debajo, texto de validación en verde sobre licencia vigente y su vencimiento), Vehículo\* (combo patente/nombre; debajo, texto en verde "Disponible"), Observaciones (textarea opcional).
- **Validaciones:** disponibilidad de chofer y vehículo (DOC-2); licencia vigente (DOC-4 regla 1).

### P-OP-4 Detalle del viaje
- **Propósito:** seguimiento y cierre del viaje (DOC-2).
- **Componentes:** *Volver*; badge de estado (*En curso*); N° de viaje; Origen y Destino; Fecha/hora de salida; Chofer (con DNI); Vehículo y Patente; Distancia estimada (km); mapa con el recorrido y tiempo estimado; kilometraje; botón rojo **Finalizar hoja de ruta**.
- **Acciones:** registrar kilometraje, finalizar hoja de ruta (DOC-2).

### P-OP-5 Registrar mantenimiento
- **Propósito:** registrar intervención sobre un vehículo (DOC-2).
- **Componentes:** *Volver*; botón **Guardar**; campos: Vehículo\* (combo), Tipo de mantenimiento\* (combo, ej. *Preventivo*), Fecha\*, Kilometraje\*, Descripción/Observaciones (textarea), Próximo mantenimiento sugerido (km), zona de carga "Documentos/Comprobantes" (arrastrar o seleccionar archivos; formatos PDF/JPG/PNG).

## 5.2 Interfaz Administrador (web, mismo layout)

**Menú lateral del Administrador:** Dashboard, Usuarios, Viajes, Vehículos, Choferes, Mantenimiento, Alertas, Auditoría, Reportes, Configuración, Cerrar sesión (un ítem del mockup es de baja legibilidad; "Reportes" aparece en el sidebar pero no tiene pantalla propia en los mockups — ver §12).

### P-AD-1 Dashboard administrativo
- **Componentes:** mismas 4 tarjetas KPI que el operador (viajes en curso, pendientes, vehículos disponibles, alertas activas); gráfico "Viajes por mes"; "Alertas recientes"; fila adicional de totales: **Vehículos totales**, **Choferes activos**, **Mantenimientos pendientes**, **Usuarios del sistema** (DOC-2, DOC-5).

### P-AD-2 Usuarios
- **Componentes:** botón **+ Nuevo usuario**; filtros: Rol (Todos), Estado (Todos), búsqueda por texto; tabla: ID, Nombre, Email, Rol (badge Administrador/Operador/Chofer), Estado (badge Activo/Inactivo), Acciones (editar, eliminar); paginación.
- **Acciones:** crear, editar, eliminar, activar/desactivar, gestionar roles (DOC-2).

### P-AD-3 Auditoría
- **Componentes:** filtros: Usuario, Acción, Entidad, Desde, Hasta, búsqueda; tabla: Fecha y hora, Usuario, Acción (badges tipo CREAR/EDITAR/ELIMINAR), Entidad (Viaje, Vehículo, Alerta, Mantenimiento, Chofer…), Detalle (texto descriptivo); paginación.
- **Solo lectura** en el mockup (no hay botones de alta/edición).

### P-AD-4 Alertas
- **Componentes:** pestañas **Pendientes (n)** / **Resueltas**; tabla: Tipo (ícono), Descripción (ej.: licencia de chofer vencida, vehículo superó km de mantenimiento, documentación por vencer, seguro del vehículo vencido, próximo mantenimiento), Entidad (Chofer X / Vehículo Y con patente), Fecha, Estado (badge *Pendiente*), Acción para marcar como resuelta; selector de filas por página y paginación.

### P-AD-5 Configuración
- **Componentes:** pestañas (Generales y otras de baja legibilidad en el mockup); sección "Información de la empresa": Nombre, CUIT, Dirección, Teléfono, Email; sección "Preferencias del sistema": Zona horaria, Formato de fecha, Idioma; botón **Guardar cambios** (DOC-2, DOC-5).

## 5.3 Interfaz Chofer (web responsive, presentación tipo móvil, con bottom-nav: Viaje / Documentación / Historial)

### P-CH-1 Login
- **Componentes:** logo, título LOGIN, campos Usuario y Contraseña (con mostrar/ocultar), botón **Iniciar sesión**, enlace **¿Olvidaste tu contraseña?** (DOC-2, DOC-5).

### P-CH-2 Mi viaje actual
- **Componentes:** badge de estado (*EN CURSO*); ficha con N° de viaje (`VJ-000125`), Destino, Distancia (km), Vehículo, Patente, Fecha; mapa Google Maps con el recorrido, distancia y tiempo estimado; botón rojo **Cerrar Hoja de Ruta**; campana de notificaciones (DOC-2, DOC-5).

### P-CH-3 Documentación
- **Componentes:** zona de carga (arrastrar o presionar para seleccionar; formatos permitidos PDF, JPG, PNG); lista "Documentos cargados" con nombre de archivo (ej.: DNI.pdf, Carnet de conducir.pdf, Psicofisico.pdf, ART.pdf), fecha de subida y menú contextual por documento (DOC-2, DOC-5).

### P-CH-4 Finalizar viaje (modal "Cerrar Hoja de Ruta")
- **Componentes:** modal sobre "Mi viaje actual"; título **Cerrar Hoja de Ruta**; instrucción "Ingresa el kilometraje final del vehículo para finalizar el viaje"; input *Kilometraje final (km)*; aviso informativo: "El kilometraje debe ser mayor al inicial (actual: 125.000 km)"; botones **Cancelar** y **Finalizar viaje** (DOC-2, DOC-5).

### P-CH-5 Historial
- **Componentes:** lista de viajes realizados: N° de viaje, badge *FINALIZADO*, fecha, destino, vehículo, patente (DOC-2, DOC-5).

**Pantallas mencionadas pero sin mockup:** Vehículos (listado con filtro por estado), Choferes (listado de disponibles), CRUD de Tipo de Mantenimiento, alta/edición de usuario (formulario), historial de mantenimientos por vehículo, recuperación de contraseña. Existen como funcionalidad (DOC-1/DOC-2) pero sin diseño de interfaz (ver §12).

---

# 6. Flujos

## F-1 Alta de usuario (Administrador)
1. Admin ingresa a Usuarios → **+ Nuevo usuario** (DOC-5).
2. Carga nombre, email, rol (Administrador/Operador/Chofer) y estado (DOC-2, DOC-6).
3. La contraseña se almacena hasheada (DOC-3 RNF).
4. El sistema envía las credenciales de acceso por mail al empleado (DOC-1 alcance voluntario, DOC-7).
5. Se registra auditoría del alta (DOC-3 regla 7).

## F-2 Inicio de sesión
1. Usuario ingresa usuario y contraseña en la pantalla de login (DOC-5 P-CH-1; el login de Operador/Admin no tiene mockup propio pero se infiere el mismo mecanismo — marcado en §12).
2. Autenticación con JWT + Refresh Tokens (DOC-3 RNF).
3. Según rol, se accede a la interfaz correspondiente.
4. Opción "¿Olvidaste tu contraseña?" → flujo de recuperación (DOC-2; pasos no especificados — §12).

## F-3 Crear viaje (Operador)
1. Operador → Viajes → **+ Crear viaje** (DOC-5).
2. Completa origen, destino, fecha y hora de salida (DOC-2).
3. Selecciona chofer: el sistema valida disponibilidad y licencia/documentación vigente (DOC-2, DOC-3 reglas 1 y 4, DOC-4 regla 1). Si la licencia está vencida a la fecha del viaje → **se bloquea la creación** y se genera alerta (DOC-3 regla 1, DOC-3 §8 "Crear viaje con validación de licencia → falla").
4. Selecciona vehículo: solo asignable si está *Disponible* (bloqueantes: En Viaje, En Taller, Inactivo — DOC-3 regla 2; DOC-4 regla 2). Si superó 10.000 km desde el último mantenimiento, está bloqueado (DOC-3/DOC-4 regla 3, DOC-3 §8 "Asignar vehículo con mantenimiento vencido → falla").
5. Valida que el chofer no tenga viajes solapados en fechas (DOC-3 regla 6).
6. Agrega observaciones (opcional) y guarda (DOC-2).
7. El viaje queda **Pendiente** (estado inicial inferido de los listados por estado de DOC-1 — §12).
8. Se registra auditoría de la asignación (DOC-3 regla 7). El chofer recibe la asignación en tiempo real vía WebSockets (DOC-2).

## F-4 Confirmar viaje (CUU de DOC-1)
1. CUU "Confirmar viaje para un chofer y vehículo" (DOC-1).
2. Interpretación respaldada: la confirmación fija chofer y vehículo, y el vehículo pasa a *En Viaje* y el viaje a *En curso*. **El detalle paso a paso no está documentado ni tiene pantalla asociada** (ver §12: relación entre "crear" y "confirmar", y disparador de Pendiente → En curso).

## F-5 Finalizar viaje / Cerrar hoja de ruta (Chofer u Operador)
1. Desde "Mi viaje actual" (Chofer, DOC-5) o desde "Detalle del viaje" (Operador, DOC-5), se acciona **Cerrar Hoja de Ruta / Finalizar hoja de ruta**.
2. Se ingresa el kilometraje final (DOC-2, DOC-5).
3. Validación: el viaje no puede cerrarse sin kilometraje de llegada, y este debe ser **mayor** al de salida (DOC-3 regla 5, DOC-5 P-CH-4).
4. Al confirmar: se actualiza el kilometraje del vehículo, el vehículo se libera (vuelve a *Disponible* solo si el cierre fue correcto — DOC-3 reglas 8 y §8), el viaje pasa a *Finalizado* y se genera auditoría (DOC-3 §8 "Cerrar viaje → actualiza km, libera vehículo, genera auditoría").
5. El cambio de estado se propaga en tiempo real (DOC-2).

## F-6 Registrar mantenimiento (Operador)
1. Operador → Mantenimiento → Registrar (DOC-5).
2. Selecciona vehículo y tipo de mantenimiento; registra fecha, kilometraje, descripción, próximo mantenimiento sugerido, y adjunta comprobantes (DOC-2, DOC-5).
3. Guarda. El mantenimiento queda registrado en el historial del vehículo (DOC-1 voluntario).
4. Efecto: **desbloquea el vehículo** si estaba bloqueado por mantenimiento vencido (DOC-3 §8) y actualiza `fecha_ultimo_mantenimiento` (DOC-4, DOC-6).
5. Se registra auditoría (DOC-3 regla 7).

## F-7 Subir documentación (Chofer)
1. Chofer → Documentación → arrastra o selecciona archivo (PDF/JPG/PNG) (DOC-5).
2. Indica tipo de documento y vencimiento (DOC-3, DOC-6: tipo_doc, fecha_vencimiento, archivo_adj).
3. Si el documento subido está vencido → se genera alerta (DOC-3 §8 "Subir documentación vencida → genera alerta").
4. El documento queda visible en "Documentos cargados" con fecha de subida (DOC-5).

## F-8 Emitir alerta (automático — CUU de DOC-1)
Disparadores documentados: licencia vencida (DOC-3 regla 1), documentación vencida o por vencer (DOC-2, DOC-5), mantenimiento pendiente / km superado (DOC-3 regla 3), indisponibilidad de recursos / vehículo inactivo (DOC-3 §1, DOC-7), seguro del vehículo vencido (DOC-5 P-AD-4).
1. El sistema detecta la condición y crea la alerta con tipo, entidad afectada, fecha y estado *Pendiente* (DOC-3, DOC-6).
2. La alerta aparece en dashboards y en el módulo de Alertas (DOC-2, DOC-5).
3. El Administrador la revisa y la **marca como resuelta** (DOC-2).

## F-9 Generar auditoría (automático — CUU de DOC-1)
1. Ante altas, bajas, asignaciones y cambios de estado, el sistema registra usuario, acción, entidad, fecha y datos previos/posteriores (DOC-3 regla 7 y §2, DOC-6).
2. El Administrador consulta el registro con filtros por usuario, acción, entidad y rango de fechas (DOC-2).

## F-10 Consulta de listados operativos
- Viajes filtrados por estado (en curso, pendientes, finalizados) con datos completos de viaje, vehículo y chofer (DOC-1).
- Vehículos filtrados por estado (Disponible, Inactivo, En Taller, En Viaje) con datos completos (DOC-1).
- Choferes disponibles para viaje (DOC-1).
- Alertas pendientes; auditorías; historial de mantenimientos por vehículo (DOC-1).

---

# 7. Reglas de negocio

| # | Regla | Detalle | Fuente |
|:-|:-|:-|:-|
| RN-1 | Licencia vencida → viaje bloqueado | No se permite crear un viaje si la licencia del chofer está vencida **a la fecha del viaje**. Además se genera alerta automática | DOC-4 regla 1, DOC-3 regla 1 |
| RN-2 | Vehículo no disponible → no asignable | Estados bloqueantes: *En Viaje*, *En Taller*, *Inactivo* | DOC-4 regla 2, DOC-3 regla 2 |
| RN-3 | Mantenimiento vencido → bloqueo | Si el km actual supera los **10.000 km** desde el último mantenimiento: alerta + bloqueo de disponibilidad del vehículo + creación de mantenimiento programado | DOC-4 regla 3, DOC-3 regla 3 |
| RN-4 | Documentación vencida → chofer no puede iniciar viaje | Aplica a psicofísico, ART, etc., además de la licencia | DOC-3 regla 4 |
| RN-5 | Cierre de viaje requiere km de llegada | El viaje no puede cerrarse sin kilometraje de llegada, y debe ser mayor al de salida | DOC-3 regla 5, DOC-5 P-CH-4 |
| RN-6 | Sin viajes simultáneos por chofer | Un chofer no puede tener dos viajes con fechas solapadas | DOC-3 regla 6 |
| RN-7 | Auditoría automática | Registro automático de altas, bajas, asignaciones y cambios de estado | DOC-3 regla 7 |
| RN-8 | Liberación del vehículo | El vehículo vuelve a *Disponible* solo si el viaje se cerró correctamente | DOC-3 regla 8 |
| RN-9 | Registrar mantenimiento desbloquea el vehículo | Caso de uso crítico explícito | DOC-3 §8 |
| RN-10 | Subir documentación vencida genera alerta | Caso de uso crítico explícito | DOC-3 §8 |
| RN-11 | Cierre de viaje: efectos encadenados | Actualiza km del vehículo, libera el vehículo y genera auditoría | DOC-3 §8 |
| RN-12 | Asignación automática de vehículo disponible según reglas | Funcionalidad operativa nueva propuesta (convive con la selección manual de los mockups — ver §12) | DOC-3 §2 |
| RN-13 | Umbrales por tipo de mantenimiento | El catálogo define `km_alerta` y `km_objetivo` por tipo (posible parametrización del umbral fijo de 10.000 km — ver §12) | DOC-6 |

---

# 8. Modelo de dominio

Fuente principal: DOC-6 (DER), complementado con DOC-3 §7 y DOC-4 §2.

## Entidades y atributos

| Entidad | Atributos (DER, DOC-6) | Atributos adicionales en otros docs |
|:-|:-|:-|
| **Usuario** | id_usuario (PK), email, nombre, contraseña | rol, estado activo/inactivo (DOC-2, DOC-3); contraseña hasheada (DOC-3) |
| **Chofer** (subtipo de Usuario) | dni, estado, viajes_realizados, promedio_km | nombre completo, DNI, categoría de licencia (A, B, C, E), fecha de vencimiento de licencia, estado Activo/Inactivo (DOC-4 — ver §12: la licencia no figura en el DER como atributo del chofer) |
| **Operador** (subtipo de Usuario) | sin atributos propios en el DER | — |
| **Administrador** (subtipo de Usuario) | sin atributos propios en el DER | — |
| **Documentación** | id_doc (PK), tipo_doc, fecha_vencimiento, archivo_adj | tipos: licencia, ART, psicofísico (DOC-3); DNI (DOC-5) |
| **Vehículo** | id_vehiculo (PK), patente, modelo, año, fecha_ultimo_mantenimiento, km_acumulado, estado | chofer responsable pre-asignado (solo DOC-4 — ver §12) |
| **Viaje** | id_viaje (PK), destino, km_total, fecha_hora_salida, estado | origen, hora de salida, observaciones, distancia estimada, kilometraje de llegada (DOC-2/DOC-4/DOC-5 — **origen falta en el DER**, ver §12) |
| **Mantenimiento** | nro_mantenimiento (PK), estado, observaciones; en la relación con vehículo: fecha_hora_programada, fecha_hora_finalizacion | fecha, km, descripción, próximo mantenimiento sugerido, adjuntos (DOC-3, DOC-5); estado Pendiente/Realizado (DOC-3) |
| **Tipo de mantenimiento** | id_tipomantenimiento (PK), descripcion, km_alerta, km_objetivo | preventivo / correctivo (DOC-7, DOC-5) |
| **Alerta** | id_alerta (PK), tipo_alerta, entidad_afectada, fecha_alerta, estado | tipos: seguridad, mantenimiento, disponibilidad (DOC-3) / documentación, licencias, mantenimiento (DOC-2) — ver §12 |
| **Auditoría** | id_auditoria (PK), accion, entidad, fecha_auditoria, datos_anteriores, datos_nuevos | — |

## Relaciones y cardinalidades (DER, DOC-6)

| Relación | Cardinalidad | Lectura |
|:-|:-|:-|
| usuario_auditoria | Usuario 1:1 — Auditoría 0:N | Cada registro de auditoría pertenece a un usuario; un usuario tiene 0..N registros |
| Usuario → {Chofer, Operador, Administrador} | Especialización disjunta ("D") | Un usuario es exactamente uno de los tres subtipos |
| chofer_documentacion | Chofer 1:1 — Documentación 0:N | Cada documento pertenece a un chofer |
| chofer_viaje | Chofer 1:1 — Viaje 0:N | Cada viaje tiene un chofer; un chofer tiene 0..N viajes |
| operador_viaje | Operador 1:1 — Viaje 0:N | Cada viaje es creado/gestionado por un operador |
| vehiculo_viaje | Vehículo 1:1 — Viaje 0:N | Cada viaje usa un vehículo |
| vehiculo_mantenimiento | Vehículo 1:1 — Mantenimiento 0:M (con atributos fecha_hora_programada, fecha_hora_finalizacion) | Cada mantenimiento corresponde a un vehículo |
| mantenimiento_tipo | Tipo 1:1 — Mantenimiento 0:N | Cada mantenimiento tiene un tipo del catálogo |
| Alerta | Sin relación gráfica en el DER; usa `entidad_afectada` como referencia genérica | (polimórfica — ver §12) |

DOC-3 §7 coincide: Chofer 1:N Viajes, Vehículo 1:N Viajes, Vehículo 1:N Mantenimientos, Chofer 1:N Documentación, Usuario 1:N Auditoría, y agrega Viaje 1:N Incidentes (opcional).

## Entidades implícitas (no modeladas en el DER)

- **Empresa/Configuración** (DOC-2, DOC-5): datos de la empresa y preferencias del sistema.
- **Incidente** (DOC-3, opcional): registro de incidentes en viaje.
- **Carga de combustible** (DOC-3, opcional).
- **Notificación** (DOC-2): los eventos en tiempo real podrían requerir persistencia; no está definida.
- **Rol** como entidad: en el DER el rol se resuelve por especialización, no por tabla de roles; DOC-2 habla de "gestionar roles".

---

# 9. Estados

## Vehículo
Estados documentados: **Disponible, En Viaje, En Taller, Inactivo** (DOC-1 listado; DOC-4 usa los 3 primeros; DOC-3 declara bloqueantes En Viaje/En Taller/Inactivo; DOC-7 dice "en mantenimiento" como sinónimo de En Taller — ver §12 por la nomenclatura).

| Transición | Disparador | Fuente |
|:-|:-|:-|
| Disponible → En Viaje | Confirmación/inicio de un viaje asignado | DOC-1 CUU, DOC-4 |
| En Viaje → Disponible | Cierre correcto del viaje (km de llegada válido) | DOC-3 regla 8 |
| Disponible → En Taller | Registro/planificación de mantenimiento; bloqueo por superar 10.000 km sin mantenimiento | DOC-3/DOC-4 regla 3 |
| En Taller → Disponible | Registro de mantenimiento realizado (desbloquea el vehículo) | DOC-3 §8 |
| ↔ Inactivo | No documentado quién ni cuándo lo activa/inactiva (ver §12) | — |

## Viaje
Estados documentados: **Pendiente, En curso, Finalizado** (DOC-1, DOC-7, DOC-5 badges "En curso"/"Finalizado"/"EN CURSO"/"FINALIZADO").

| Transición | Disparador | Fuente |
|:-|:-|:-|
| (alta) → Pendiente | Creación del viaje planificado | DOC-1, DOC-3 (planificación de viajes futuros) |
| Pendiente → En curso | No documentado explícitamente; presumiblemente el CUU "Confirmar viaje" (ver §12) | DOC-1 |
| En curso → Finalizado | Cierre de hoja de ruta con km de llegada válido | DOC-3 regla 5, DOC-5 |
| Cancelación | No existe estado "Cancelado" documentado (ver §12) | — |

## Chofer
Estados: **Activo / Inactivo** (DOC-4). Adicionalmente el concepto operativo "disponible para viaje" (DOC-1 listado): un chofer está apto si está activo, con documentación vigente y sin viaje en curso/solapado (composición de RN-1, RN-4, RN-6).

## Mantenimiento
Estados: **Pendiente / Realizado** (DOC-3 "Mantenimientos Programados"). El DER agrega `estado` y fechas programada/finalización (DOC-6). Transición Pendiente → Realizado al registrarse la intervención.

## Alerta
Estados: **Pendiente / Resuelta** (DOC-3, DOC-2). Transición: el Administrador marca como resuelta (DOC-2); nace Pendiente al emitirse automáticamente.

## Usuario
Estados: **Activo / Inactivo** — el Administrador activa/desactiva usuarios (DOC-2).

---

# 10. Validaciones

| Ámbito | Validación | Fuente |
|:-|:-|:-|
| Crear viaje | Origen, destino, fecha salida, hora salida, chofer y vehículo obligatorios (marcados con * en mockup); observaciones opcional | DOC-5 |
| Crear viaje | Licencia del chofer vigente a la fecha del viaje | DOC-4 regla 1 |
| Crear viaje | Documentación del chofer (psicofísico, ART) vigente | DOC-3 regla 4 |
| Crear viaje | Vehículo en estado Disponible (no En Viaje / En Taller / Inactivo) | DOC-4 regla 2, DOC-3 |
| Crear viaje | Vehículo sin bloqueo por mantenimiento (≤ 10.000 km desde el último) | DOC-3/DOC-4 regla 3 |
| Crear viaje | Sin solapamiento de fechas con otros viajes del chofer | DOC-3 regla 6 |
| Cerrar viaje | Kilometraje final obligatorio y estrictamente mayor al inicial | DOC-3 regla 5, DOC-5 |
| Mantenimiento | Vehículo, tipo, fecha y kilometraje obligatorios (marcados con * en mockup) | DOC-5 |
| Documentación | Formatos de archivo permitidos: PDF, JPG, PNG | DOC-5 |
| Documentación | Fecha de vencimiento por documento; documento vencido genera alerta | DOC-3, DOC-6 |
| Usuarios | Email como dato de acceso; contraseña almacenada con hash (bcrypt) | DOC-3, DOC-6 |
| Permisos | Autorización por rol en cada operación (middlewares de autenticación/autorización) | DOC-3 RNF |
| General | Validaciones centralizadas (Joi/Zod) | DOC-3 RNF |

Campos obligatorios de Usuario, Vehículo, Chofer y Tipo de mantenimiento: no especificados más allá de sus listas de atributos (ver §12).

---

# 11. Requerimientos no funcionales

| Categoría | Requerimiento | Fuente |
|:-|:-|:-|
| Arquitectura | Implementación por capas: Controllers, Services, Repositories, Models | DOC-4 |
| Arquitectura | API REST agnóstica, con versionado (v1, v2) | DOC-4, DOC-3 |
| Arquitectura | Middlewares de autenticación, autorización, logging y manejo de errores | DOC-3 |
| Arquitectura | Validaciones centralizadas (Joi/Zod); rate limiting en endpoints sensibles | DOC-3 |
| Backend | Node.js + Express | DOC-3, DOC-4 |
| Persistencia | ORM: Prisma (recomendado en DOC-3) o Sequelize (DOC-4 admite ambos) | DOC-3, DOC-4 |
| Seguridad | JWT + Refresh Tokens; hash de contraseñas con bcrypt | DOC-3 |
| Frontend | React (DOC-3; DOC-4 admite Vue.js) + React Router + Zustand/Redux; UI con Material UI o Tailwind; diseño Mobile-First / responsive; consumo de API con Fetch/Axios | DOC-3, DOC-4, DOC-2 |
| Dashboard | Gráficas con Recharts o Chart.js | DOC-3 |
| Tiempo real | WebSockets: recepción instantánea de asignaciones, actualización automática de estados, notificaciones y sincronización entre usuarios | DOC-2 |
| Mapas | Visualización del recorrido en Google Maps (chofer) y mapa en detalle de viaje (operador) | DOC-2, DOC-5 |
| Email | Envío de credenciales de ingreso por mail | DOC-1 |
| Infraestructura (opcional) | Docker para backend y base de datos; migraciones automáticas; seeds iniciales | DOC-3 |
| Geolocalización | Solo registro de coordenadas de origen/destino, sin mapas en tiempo real (DOC-3) — contradice parcialmente a DOC-2/DOC-5 (ver §12) | DOC-3 |

---

# 12. Inconsistencias, ambigüedades e información faltante

**Contradicciones entre documentos**

| # | Tema | Detalle |
|:-|:-|:-|
| C-1 | Estados del vehículo | DOC-1: Disponible/Inactivo/En Taller/En Viaje. DOC-4: solo Disponible/En Viaje/En Taller. DOC-3: bloqueantes En Viaje/En Taller/Inactivo. DOC-7 llama "en mantenimiento" a lo que los demás llaman "En Taller". Decidir nomenclatura y set definitivo. |
| C-2 | Dónde vive la licencia del chofer | DOC-4 la define como atributos del Chofer (categoría + vencimiento). DOC-6 (DER) no la incluye en Chofer; la documentación (con tipo y vencimiento) es una entidad aparte. ¿La licencia es un atributo o un documento más? |
| C-3 | Mapas | DOC-3 acota geolocalización a "solo registro de coordenadas, sin mapas en tiempo real"; DOC-2 y DOC-5 muestran recorrido en Google Maps con distancia y tiempo estimado. |
| C-4 | Tipos de alerta | DOC-3: seguridad / mantenimiento / disponibilidad. DOC-2: documentación / licencias / mantenimiento. DOC-5 agrega ejemplo "seguro del vehículo vencido". Unificar taxonomía. |
| C-5 | Stack | DOC-4 admite Sequelize o Prisma y React o Vue; DOC-3 recomienda Prisma y fija React. No es contradicción dura pero requiere decisión. |
| C-6 | Modelado del mantenimiento | DOC-3 propone dos entidades (Mantenimientos Programados + Historial); DOC-1/DOC-6 modelan una sola entidad Mantenimiento con estado y fechas programada/finalización. |
| C-7 | Umbral de mantenimiento | Regla fija de 10.000 km (DOC-3/DOC-4) vs. catálogo con `km_alerta`/`km_objetivo` por tipo (DOC-6). ¿Umbral global o parametrizado por tipo? |
| C-8 | Asignación de vehículo | DOC-3 propone "asignación automática de vehículo disponible según reglas"; DOC-5 muestra selección manual por combo. ¿Cuál aplica, o ambas? |
| C-9 | Vehículo con "chofer responsable pre-asignado" | Solo en DOC-4; no existe en el DER ni en mockups ni funcionalidades. |

**Ambigüedades**

| # | Tema | Detalle |
|:-|:-|:-|
| A-1 | "Confirmar viaje" vs. "Crear viaje" | DOC-1 define el CUU "Confirmar viaje para un chofer y vehículo"; DOC-2/DOC-5 solo muestran "Crear viaje". ¿Confirmar es un paso posterior a crear (Pendiente → En curso)? ¿Quién confirma y cuándo? Sin flujo documentado. |
| A-2 | Transición Pendiente → En curso | Ningún documento define el disparador (¿confirmación del operador?, ¿llegada de la fecha/hora?, ¿acción del chofer?). |
| A-3 | Doble vía de cierre de viaje | El operador puede "Finalizar hoja de ruta" (DOC-5 detalle) y el chofer "Cerrar Hoja de Ruta" (DOC-5 móvil). ¿Ambos roles pueden cerrar cualquier viaje? ¿Misma validación? |
| A-4 | "Eliminar un viaje (según permisos)" | DOC-2 no define qué permisos ni en qué estados un viaje es eliminable. |
| A-5 | CRUD Auditoría | DOC-1 lo lista como CRUD, pero la auditoría es de registro automático y en DOC-5 es de solo lectura. ¿Se requieren realmente alta/edición/baja manuales? |
| A-6 | Origen del viaje | El DER (DOC-6) tiene `destino` y `km_total` pero **no `origen`** ni km inicial/final por separado; el resto de los documentos usa origen y kilometraje de llegada. El DER parece desactualizado. |
| A-7 | Chofer "disponible" | El listado de choferes disponibles (DOC-1) no define el criterio exacto (¿activo + documentación vigente + sin viaje en curso?). Se infiere de RN-1/4/6 pero no está escrito. |
| A-8 | Estado Inactivo del vehículo | No se documenta quién lo establece ni con qué criterio. |
| A-9 | Recuperar contraseña | Mencionado solo para el chofer (DOC-2, DOC-5); flujo (mail, token, expiración) sin especificar. ¿Aplica a todos los roles? |
| A-10 | Login de Operador/Administrador | Sin mockup propio; se asume igual mecanismo que el del chofer. |
| A-11 | "Reportes" en el sidebar del Admin | Aparece en el mockup (DOC-5) pero no hay pantalla ni funcionalidad documentada. |
| A-12 | Alerta "documentación por vencer" | Existe la alerta anticipada (DOC-5 "Documentación por vencer") pero no se define la antelación (¿días antes?). |
| A-13 | Kilometraje en crear/confirmar viaje | No se documenta si el km inicial del viaje se toma automáticamente del vehículo o se ingresa. |
| A-14 | Rol Supervisor | Opcional solo en DOC-3. ¿Se implementa? |
| A-15 | Funcionalidades opcionales de DOC-3 | Incidentes en viaje, carga de combustible, modificación de reglas operativas por el admin: sin decisión de inclusión. |

**Información faltante**

| # | Faltante |
|:-|:-|
| F-1 | Formulario de alta/edición de Usuario, Vehículo, Chofer y Tipo de mantenimiento (campos, validaciones, mockups). |
| F-2 | Estado "Cancelado" u operación de cancelación de viaje. |
| F-3 | Reglas de edición: qué campos de un viaje/mantenimiento son editables y en qué estados. |
| F-4 | Detalle del envío de credenciales (contenido del mail, cuándo se dispara, proveedor SMTP). |
| F-5 | Política de bajas: ¿eliminación física o lógica? (usuarios "activar/desactivar" sugiere lógica, pero también existe "eliminar"). |
| F-6 | Especificación de WebSockets: eventos, canales, qué recibe cada rol. |
| F-7 | Requisitos de performance, concurrencia, backup (la pestaña "Respaldo" del mockup de Configuración no tiene especificación). |
| F-8 | Imagen `img/gestion-logistica-der.png` referida por DOC-1: no está en la carpeta (el DER disponible es DOC-6, presumiblemente el mismo). |
| F-9 | Tamaño máximo de archivos adjuntos y almacenamiento (¿filesystem, S3, DB?). |
| F-10 | Definición de "viajes especiales" (mencionados solo para el rol Supervisor opcional). |

---

# 13. Lista maestra de funcionalidades (checklist)

**Autenticación y seguridad**
- [ ] Inicio de sesión (todos los roles) con JWT + refresh tokens
- [ ] Recuperación de contraseña
- [ ] Hash de contraseñas (bcrypt)
- [ ] Autorización por rol (middlewares)
- [ ] Rate limiting en endpoints sensibles
- [ ] Cerrar sesión

**Usuarios (Admin)**
- [ ] CRUD Usuario (crear, listar, editar, eliminar)
- [ ] Buscar usuarios; filtrar por rol y estado
- [ ] Activar / desactivar usuarios
- [ ] Gestión de roles (Administrador, Operador, Chofer)
- [ ] Envío de credenciales de acceso por mail

**Vehículos**
- [ ] CRUD Vehículo
- [ ] Listado de flota filtrado por estado (Disponible, Inactivo, En Taller, En Viaje) con detalle completo
- [ ] Gestión de estados del vehículo y bloqueos automáticos
- [ ] Kilometraje acumulado por vehículo

**Choferes**
- [ ] Gestión de choferes (alta como usuario rol Chofer, estado, datos)
- [ ] Listado de choferes disponibles para viaje
- [ ] Historial de viajes por chofer (viajes_realizados, promedio_km)

**Documentación**
- [ ] CRUD Documentación (dependiente de Chofer)
- [ ] Subida de archivos (PDF/JPG/PNG) por el chofer
- [ ] Visualización y gestión de documentos cargados
- [ ] Control de vencimientos (licencia, ART, psicofísico, DNI)
- [ ] Alerta por documentación vencida o por vencer

**Tipos de mantenimiento**
- [ ] CRUD Tipo de Mantenimiento (descripcion, km_alerta, km_objetivo)

**Mantenimiento**
- [ ] CRUD Mantenimiento (dependiente de Vehículo y Tipo)
- [ ] CUU Registrar mantenimiento de un vehículo (con adjuntos y próximo mantenimiento sugerido)
- [ ] Mantenimientos programados (estado Pendiente/Realizado)
- [ ] Historial de mantenimientos por vehículo
- [ ] Desbloqueo del vehículo al registrar mantenimiento
- [ ] Bloqueo automático por superar umbral de km (10.000 km / km_alerta)

**Viajes / Hojas de ruta**
- [ ] Crear viaje (origen, destino, fecha/hora, chofer, vehículo, observaciones)
- [ ] Validaciones de creación (licencia, documentación, disponibilidad, solapamiento, mantenimiento)
- [ ] CUU Confirmar viaje para un chofer y vehículo
- [ ] Listado de viajes filtrado por estado y rango de fechas, con detalle completo (viaje + vehículo + chofer)
- [ ] Detalle de viaje con mapa, distancia y tiempo estimado
- [ ] Editar viaje; eliminar viaje (según permisos)
- [ ] CUU Finalizar viaje / cerrar hoja de ruta con registro y validación de kilometraje final
- [ ] Efectos del cierre: actualizar km del vehículo, liberar vehículo, auditar
- [ ] Vista del chofer: viaje asignado, recorrido en mapa, historial de viajes

**Alertas**
- [ ] CUU Emitir alerta (automática: licencia, documentación, mantenimiento, disponibilidad, seguro)
- [ ] CRUD Alerta; listado de alertas pendientes / resueltas
- [ ] Marcar alerta como resuelta (Admin)
- [ ] Alertas recientes en dashboards

**Auditoría**
- [ ] CUU Generar auditoría de acciones de un usuario (automática, con datos previos y posteriores)
- [ ] CRUD/Listado de auditorías con filtros (usuario, acción, entidad, fechas)

**Dashboard**
- [ ] Dashboard Operador (viajes en curso/pendientes, vehículos disponibles, alertas activas, viajes por mes, alertas recientes)
- [ ] Dashboard Administrador (+ vehículos totales, choferes activos, mantenimientos pendientes, usuarios del sistema)
- [ ] KPIs: vehículos disponibles vs. en taller; choferes activos vs. inactivos; viajes por mes; km total por vehículo; alertas abiertas por tipo; mantenimientos pendientes

**Configuración (Admin)**
- [ ] Datos de la empresa (nombre, CUIT, dirección, teléfono, email)
- [ ] Preferencias: zona horaria, idioma, formato de fecha

**Tiempo real**
- [ ] WebSockets: recepción instantánea de asignaciones de viaje
- [ ] Actualización automática de estados de viajes
- [ ] Notificaciones en tiempo real (choferes y operadores)
- [ ] Sincronización de cambios entre usuarios

**Opcionales (DOC-3 / decisión pendiente)**
- [ ] Rol Supervisor (validar mantenimientos, aprobar viajes especiales, incidentes)
- [ ] Registro de incidentes en viaje
- [ ] Carga de combustible
- [ ] Asignación automática de vehículo
- [ ] Geolocalización por coordenadas
- [ ] Docker + migraciones + seeds

---

# 14. Roadmap de desarrollo

El orden respeta las dependencias declaradas en DOC-1 (CRUDs simples → dependientes → listados → CUU) y las dependencias funcionales entre módulos.

**Etapa 0 — Fundaciones técnicas**
Repositorio, arquitectura por capas (Controllers/Services/Repositories/Models), Express + ORM (decidir Prisma vs. Sequelize — C-5), esquema de BD según DER (resolviendo A-6/C-2), migraciones y seeds, middlewares de errores y logging, esqueleto React con router y UI kit. *Justificación: todo lo demás se construye encima; conviene resolver aquí las decisiones pendientes de modelado (§12).*

**Etapa 1 — Autenticación y Usuarios**
Login JWT + refresh, hash bcrypt, autorización por rol, CRUD Usuario con filtros y activar/desactivar, recuperación de contraseña. *Justificación: los tres roles condicionan todas las pantallas; Chofer es subtipo de Usuario y Documentación/Viajes dependen de él.*

**Etapa 2 — CRUDs simples restantes: Vehículos y Tipos de mantenimiento**
CRUD Vehículo + listado por estado; CRUD Tipo de Mantenimiento. *Justificación: son CRUD sin dependencias (DOC-1) y prerrequisito de Mantenimiento y Viajes.*

**Etapa 3 — CRUDs dependientes: Documentación y Mantenimiento**
CRUD Documentación (subida de archivos, vencimientos) dependiente de Chofer; CRUD Mantenimiento dependiente de Vehículo + Tipo; CUU Registrar mantenimiento con su efecto de desbloqueo; historial por vehículo. *Justificación: dependen de Etapas 1–2 y son insumo de las validaciones de Viajes (RN-1, RN-3, RN-4).*

**Etapa 4 — Viajes (núcleo del negocio)**
Crear viaje con todas las validaciones (RN-1 a RN-6), CUU Confirmar viaje (previa resolución de A-1/A-2), listados con filtros y detalle, interfaz del chofer (viaje asignado, historial), CUU Finalizar viaje con efectos encadenados (RN-5, RN-8, RN-11). *Justificación: requiere choferes, vehículos, documentación y mantenimiento ya operativos para aplicar las reglas.*

**Etapa 5 — Alertas y Auditoría**
Emisión automática de alertas desde los disparadores ya construidos; gestión de alertas (pendientes/resueltas); auditoría automática transversal (RN-7) y su consulta filtrada. *Justificación: son transversales y necesitan que existan los eventos que las disparan; con esto se cubre el alcance de aprobación de DOC-1.*

**Etapa 6 — Dashboard, listados operativos y tiempo real**
Dashboards de Operador y Admin con KPIs, gráfico de viajes por mes; WebSockets (asignaciones, estados, notificaciones); mapa/recorrido en detalle de viaje. *Justificación: consume datos de todos los módulos anteriores.*

**Etapa 7 — Complementos y alcance voluntario**
Envío de credenciales por mail, Configuración del sistema, historial de mantenimientos como listado dedicado, Docker/seeds, y opcionales aprobados (Supervisor, incidentes, combustible, asignación automática). *Justificación: mejoras de valor que no bloquean el alcance mínimo/aprobación.*

| Etapa | Entrega principal | Cubre de DOC-1 |
|:-|:-|:-|
| 0 | Infraestructura | — |
| 1 | Auth + CRUD Usuario | CRUD simple 1 |
| 2 | CRUD Vehículo + Tipo Mantenimiento | CRUD simple 2 y 3 |
| 3 | CRUD Mantenimiento + Documentación | CRUD dependientes 1 y 2; CUU 3 |
| 4 | Viajes completos | Listados 1–3; CUU 1 y 2 |
| 5 | Alertas + Auditoría | CRUD Auditoría/Alerta; listados de aprobación; CUU 4 y 5 |
| 6 | Dashboard + WebSockets | Voluntario (dashboard) |
| 7 | Credenciales por mail + extras | Voluntario (mail, historial mantenimientos) |

---

# Contexto consolidado del proyecto

**Qué es.** TP de Desarrollo de Software (UTN — grupo: Gaido 54468, Santos 55385, Filippini 54140; repo `github.com/roman5983/dsw-gestion-logistica`): plataforma web integral de gestión logística y flota para una empresa de servicios. Centraliza usuarios, choferes, vehículos, documentación, viajes/hojas de ruta, mantenimientos, alertas, auditoría y un dashboard de KPIs.

**Stack definido por la documentación.** Backend Node.js + Express, API REST versionada, arquitectura por capas (Controllers/Services/Repositories/Models), ORM Prisma (recomendado; Sequelize admitido), JWT + refresh tokens, bcrypt, validaciones centralizadas (Joi/Zod), rate limiting. Frontend React + React Router + Zustand/Redux, Material UI o Tailwind, mobile-first/responsive, Recharts o Chart.js. WebSockets para tiempo real. Google Maps para recorridos. Docker/migraciones/seeds opcionales.

**Roles.** Administrador (todo: usuarios, auditoría, alertas, configuración), Operador (crear/asignar/cerrar viajes, registrar mantenimientos, ver alertas), Chofer (ver su viaje asignado, cerrar hoja de ruta, subir documentación, historial; interfaz responsive con notificaciones en tiempo real). Supervisor: opcional, sin confirmar.

**Modelo de dominio (DER).** `Usuario` (id, nombre, email, contraseña) con especialización disjunta en `Chofer` (dni, estado, viajes_realizados, promedio_km), `Operador` y `Administrador`. `Chofer` 1:N `Documentación` (tipo_doc, fecha_vencimiento, archivo_adj) y 1:N `Viaje`. `Operador` 1:N `Viaje`. `Vehículo` (patente, modelo, año, fecha_ultimo_mantenimiento, km_acumulado, estado) 1:N `Viaje` y 1:N `Mantenimiento` (nro, estado, observaciones + fecha_hora_programada/finalizacion), cada mantenimiento con un `Tipo_Mantenimiento` (descripcion, km_alerta, km_objetivo). `Alerta` (tipo, entidad_afectada, fecha, estado) y `Auditoría` (usuario, accion, entidad, fecha, datos_anteriores/nuevos, 1:N desde Usuario). Ojo: el DER omite `origen` del viaje y los atributos de licencia del chofer; el resto de los documentos los exige (decisión de modelado pendiente).

**Estados.** Vehículo: Disponible / En Viaje / En Taller / Inactivo. Viaje: Pendiente / En curso / Finalizado. Chofer y Usuario: Activo / Inactivo. Mantenimiento: Pendiente / Realizado. Alerta: Pendiente / Resuelta.

**Reglas de negocio core (bloqueantes).** (1) Licencia vencida a la fecha del viaje → no se crea el viaje + alerta. (2) Vehículo En Viaje / En Taller / Inactivo → no asignable. (3) Más de 10.000 km desde el último mantenimiento → alerta + bloqueo del vehículo + mantenimiento programado. (4) Documentación del chofer vencida (ART, psicofísico) → no puede iniciar viaje. (5) Cierre de viaje exige km de llegada > km de salida. (6) Un chofer no puede tener viajes solapados. (7) Auditoría automática de altas, bajas, asignaciones y cambios de estado. (8) El vehículo vuelve a Disponible solo con cierre correcto. Efectos del cierre: actualiza km del vehículo, libera vehículo, audita. Registrar mantenimiento desbloquea el vehículo. Subir documentación vencida genera alerta.

**Alcance comprometido (propuesta de cátedra).** CRUDs simples: Usuario, Vehículo, Tipo Mantenimiento. CRUDs dependientes: Mantenimiento (de Tipo + Vehículo), Documentación (de Chofer). Listados: viajes por estado (detalle completo), vehículos por estado, choferes disponibles. CUU: confirmar viaje, finalizar viaje, registrar mantenimiento. Para aprobación se suman: CRUD Auditoría y Alerta, listados de auditorías y alertas pendientes, CUU generar auditoría y emitir alerta. Voluntario: historial de mantenimientos por vehículo, envío de credenciales por mail, dashboard con KPIs (vehículos disponibles vs. taller, choferes activos vs. inactivos, viajes por mes, km por vehículo, alertas por tipo, mantenimientos pendientes).

**Pantallas (15 mockups).** Operador: Dashboard, Viajes-listado (filtros estado/fechas, tabla VJ-xxxxx), Crear viaje (origen, destino, fecha/hora, chofer con validación de licencia visible, vehículo con disponibilidad visible, observaciones), Detalle de viaje (mapa, km, botón Finalizar hoja de ruta), Registrar mantenimiento (vehículo, tipo, fecha, km, descripción, próximo mantenimiento, adjuntos). Admin: Dashboard ampliado, Usuarios (filtros rol/estado, alta/edición/baja/activación), Auditoría (solo lectura con filtros), Alertas (tabs Pendientes/Resueltas, marcar resuelta), Configuración (empresa + preferencias). Chofer (móvil/responsive): Login (+ olvido de contraseña), Mi viaje actual (ficha + Google Maps + Cerrar Hoja de Ruta), Documentación (upload PDF/JPG/PNG + lista), Finalizar viaje (modal km final con validación "> inicial"), Historial.

**Decisiones pendientes antes de codificar (resumen de §12).** Nomenclatura/set de estados del vehículo; licencia como atributo vs. documento; semántica de "confirmar viaje" y disparador Pendiente→En curso; quién puede cerrar un viaje; permisos de eliminación de viajes; alcance real del "CRUD" Auditoría; umbral de mantenimiento global vs. por tipo; taxonomía de alertas; asignación manual vs. automática de vehículos; DER desactualizado (origen del viaje); inclusión de opcionales (Supervisor, incidentes, combustible); flujo de recuperación de contraseña; política de baja lógica vs. física; antelación de alertas "por vencer".

**Orden de construcción.** 0 fundaciones → 1 auth+usuarios → 2 vehículos+tipos de mantenimiento → 3 documentación+mantenimiento → 4 viajes → 5 alertas+auditoría → 6 dashboard+WebSockets → 7 mail de credenciales, configuración y opcionales.
