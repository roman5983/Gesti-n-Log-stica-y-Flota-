# Propuesta TP DSW

## Grupo
### Integrantes
* 54468 - Gaido, Román
* 55385 - Santos, Justino
* 54140 - Filippini, Santiago

### Repositorios
[Enlace al repositorio](https://github.com/roman5983/Gesti-n-Log-stica-y-Flota-)


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
