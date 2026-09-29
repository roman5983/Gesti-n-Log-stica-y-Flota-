# Propuesta TP DSW

## Grupo
### Integrantes
* 54468 - Gaido, Román
* 55385 - Santos, Justino
* 54140 - Filippini, Santiago

### Repositorios
[Enlace al repositorio](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-) (backend y frontend en el mismo repositorio: carpetas `backend/` y `frontend/`)

### Pull requests
Todo cambio entra a `main` por pull request. Estos son los que se integraron:

|PR|Fecha|Contenido|
|:-|:-|:-|
|[#1](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/1)|09/09/2026|Primeras tareas pendientes (regla del último administrador, "Mis datos", accesos del dashboard)|
|[#2](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/2)|17/09/2026|Alertas: navegación al origen y confirmación al resolver|
|[#3](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/3)|18/09/2026|Selector de fechas con atajos, alertas con polling y viajes sin fecha pasada|
|[#4](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/4)|20/09/2026|Job de evaluación de alertas en el servidor|
|[#5](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/5)|20/09/2026|Baja de choferes, paginador de historial, autocompletado estricto y mensajes en español|
|[#6](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/6)|21/09/2026|Auditoría con sanitize recursivo y asignación solo con seguro vigente|
|[#7](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/7)|21/09/2026|Cancelación de viajes y mantenimientos, y tope de 366 días en informes|
|[#8](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/8)|22/09/2026|Alertas: chofer vinculado, "ir al origen", traducciones y errores al resolver|
|[#9](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/9)|23/09/2026|Alerta de viaje sin asignar y cancelación solo de viajes pendientes|
|[#10](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/10)|24/09/2026|Mejoras de UX: buscador, filtros y orden, alertas en tarjetas, sistema de color, frontend por componente|
|[#11](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/11)|24/09/2026|Resumen técnico del backend en Markdown|
|[#13](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/13)|28/09/2026|Tests unitarios (backend y frontend) y validación de variables de entorno|
|[#14](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/14)|28/09/2026|Documentación completa para asignar (RN-4), evaluación horaria de alertas, validación de formularios y escritorio del chofer|
|[#15](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/15)|28/09/2026|Revisión: validación de formularios con `noValidate`|
|[#16](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/16)|28/09/2026|Puerto SMTP: acepta los puertos de correo (integrado por línea de comandos)|
|[#17](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/17)|28/09/2026|Bajas con bloqueo de fila, tiempo límite, disponibilidad con RN-4, auditoría de sesiones, carga por pantalla|

El [#12](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-/pull/12) se cerró sin integrar: su contenido llegó en el #14.


## Tema
### Descripción
El sistema será una plataforma web para gestionar la logística y operaciones de la empresa, centralizando usuarios, vehículos y documentación. Permitirá administrar viajes asignando choferes y vehículos con seguimiento por estado, junto con la gestión de mantenimientos definidos por tipo e historial por unidad. Incorporará auditoría de acciones para garantizar control y trazabilidad, además de listados operativos con filtros clave sobre viajes, vehículos, choferes y alertas. Finalmente, contará con un dashboard con métricas del negocio, generación de alertas y envío de credenciales a usuarios.

### Modelo
Ver diagrama entidad-relación completo en [docs/etapa-2-der-definitivo.md](docs/etapa-2-der-definitivo.md).



## Alcance Funcional

### Alcance Mínimo
 
Regularidad:
|Req|Detalle|
|:-|:-|
|CRUD simple|1. CRUD Usuario (Chofer, Operador o Administrador)<br>2. CRUD Vehiculo<br>3. CRUD Tipo Mantenimiento|
|CRUD dependiente|1. CRUD Mantenimiento {depende de} CRUD Tipo Mantenimiento y CRUD Vehiculo<br>2. CRUD Documentacion {depende de} CRUD Usuario (Chofer)|
|Listado<br>+<br>detalle| 1. Listado de viajes filtrados según su estado (en curso, pendientes y finalizados.) => Se muestran datos completos del viaje, del vehiculo y chofer involucrados.<br>2. Listado de vehiculos de la flota filtrados según su estado (Disponible, Inactivo, En taller o En Viaje) => Se muestran los datos completos del vehiculo<br>3. Listado de Choferes disponibles para viaje.|
|CUU/Epic|1. Confirmar viaje para un chofer y vehículo<br>2. Finalizar viaje<br>3. Registrar mantenimiento de un vehículo|


### Adicionales para Aprobación

|Req|Detalle|
|:-|:-|
|CRUD |1. CRUD Usuario (Chofer, Operador, Administrador)<br>2. CRUD Documentacion<br>3. CRUD Vehiculo<br>4. CRUD Tipo Mantenimiento<br>5. CRUD Auditoría<br>6. CRUD Mantenimiento<br>7. CRUD Alerta |
|Listado<br>+<br>detalle|1. Listado simple de todas las auditorías generadas.<br>2. Listado de todas las alertas pendientes. |
|CUU/Epic|1. Confirmar viaje para un chofer y vehículo<br>2. Finalizar viaje<br>3. Registrar mantenimiento de un vehículo<br>4. Generar auditoría de acciones de un usuario<br>5. Emitir alerta|


### Alcance Adicional Voluntario

|Req|Detalle|
|:-|:-|
|Listados |1. Historial de mantenimientos para un vehículo de la flota ingresado.|
|CUU/Epic| Sin detalle |
|Otros|1. Envío de credenciales de ingreso a empleados de la empresa por mail<br>2. Dashboard con algunas estadísticas generales del negocio (Vehículos disponibles vs. en taller, Choferes activos vs. inactivos, Viajes realizados por mes, Kilometraje total por vehículo, Alertas abiertas por tipo, Mantenimientos pendientes.)|
