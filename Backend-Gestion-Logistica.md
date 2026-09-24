# Sistema de Gestión Logística

**Resumen técnico del backend**

API REST para gestionar la operación logística de una empresa de flota: administra vehículos, choferes, viajes y mantenimientos, con alertas automáticas, registro de auditoría, reportes y un panel de indicadores. Centraliza en un único sistema todos los procesos vinculados a la flota, el personal y la ejecución de los servicios.

## Tecnología y arquitectura

| | |
|:--|:--|
| **Stack** | Node.js + TypeScript (modo estricto), Express 4, Prisma 7 ORM, MySQL 8 |
| **Seguridad / soporte** | JWT + bcrypt, Zod (validación), Helmet, Pino (logging), Multer (archivos), Nodemailer (email) |
| **Arquitectura** | 13 módulos en capas: routes → controller → service → repository (+ schemas Zod) |
| **Superficie de API** | 60 endpoints REST |
| **Base de datos** | 12 tablas (MySQL) |
| **Estado** | Completo y probado de punta a punta contra MySQL, con seed de demostración |

Cada módulo sigue la misma estructura en capas. El **controller** solo traduce HTTP; la lógica de negocio vive en el **service**; el acceso a datos queda aislado en el **repository** (un repositorio por agregado). La validación de entrada se hace con **Zod** en el borde, y todos los errores se serializan con un formato único desde un manejador global.

**Módulos:** autenticación, usuarios, choferes, documentos de choferes, vehículos, tipos de mantenimiento, mantenimientos, viajes, alertas, auditoría, reportes, dashboard de indicadores y configuración de empresa.

## Decisiones de ingeniería destacables

### Autenticación robusta

- Access token JWT de vida corta (15 min) + refresh token opaco guardado solo como hash SHA-256, en cookie httpOnly, con rotación y detección de reuso: si se reutiliza un token ya rotado, se revocan todas las sesiones del usuario.
- Login con error indistinguible para evitar enumeración de cuentas, y rate limiting contra ataques de fuerza bruta.

### Concurrencia con bloqueos a nivel de base de datos

- Los flujos críticos (asignar y finalizar viajes, evaluar alertas, registrar mantenimientos) usan transacciones con `SELECT ... FOR UPDATE` y `FOR UPDATE SKIP LOCKED` para serializar operaciones concurrentes sin condiciones de carrera.
- Ejemplos: la selección automática del vehículo disponible con menor kilometraje, y la garantía de que un chofer no tenga dos viajes activos a la vez.

### Auditoría transaccional e inmutable

- Cada mutación registra su traza (quién, qué acción, datos antes/después) dentro de la misma transacción que el cambio de negocio: el log confirma o revierte junto con la operación.
- El registro es inmutable (solo `INSERT` y `SELECT`, nunca `UPDATE`/`DELETE`) y redacta automáticamente los campos sensibles (contraseñas, tokens).

### Reglas de negocio explícitas

- Máquinas de estado para viajes (pendiente → en curso → finalizado, o cancelado mientras está pendiente) y mantenimientos, con transiciones validadas que no se pueden saltear.
- Baja lógica (soft-delete) con "tombstones" para respetar las restricciones de unicidad de la base, y validaciones cruzadas (km de llegada > km de salida, umbrales de mantenimiento).

### Seguridad de datos sensibles

- Las contraseñas de choferes se almacenan con bcrypt (para el login) y además cifradas con AES-256-GCM (para consulta del administrador, requisito del negocio).
- La clave de cifrado vive en variable de entorno, validada al arranque: la aplicación no inicia con configuración inválida (fail-fast).

### Validación y consistencia

- Todo input se valida y normaliza con Zod antes de llegar al service, y las fechas se manejan de forma consistente en UTC en todo el sistema.

## Estado del proyecto

El backend está completo y verificado de punta a punta contra MySQL. Incluye un **seed** que genera datos de demostración coherentes: flota en todos sus estados, viajes en distintas etapas, mantenimientos, y datos preparados para disparar cada tipo de alerta del sistema.
