# Etapa 2 (parte 2) — Modelo Relacional
## Sistema de Gestión Logística y Flota (TP DSW)

Derivado del DER definitivo aprobado. Notación: **PK subrayada** → `_atributo_`, FK → `#atributo`.

---

## 1. Esquema relacional

```
usuario        (_id_usuario_, nombre, email, password_hash, rol, activo,
                fecha_eliminacion, created_at, updated_at)

refresh_token  (_id_refresh_token_, #usuario_id, token_hash, fecha_expiracion,
                revocado, created_at)

chofer         (_#usuario_id_, dni, categoria_licencia, fecha_vencimiento_licencia,
                password_cifrada, viajes_realizados, promedio_km)
                -- PK = FK: especialización 1:1 de usuario

documentacion  (_id_documentacion_, #chofer_id, tipo_documento, fecha_vencimiento,
                nombre_archivo, ruta_archivo, mime_type, tamano_bytes,
                fecha_subida, fecha_eliminacion)

vehiculo       (_id_vehiculo_, patente, modelo, anio, km_inicial, km_acumulado,
                fecha_ultimo_mantenimiento, fecha_vencimiento_seguro, estado,
                fecha_eliminacion, created_at, updated_at)

tipo_mantenimiento (_id_tipo_mantenimiento_, nombre, descripcion,
                km_alerta, km_objetivo, meses_alerta, meses_objetivo)

mantenimiento  (_id_mantenimiento_, #vehiculo_id, #tipo_mantenimiento_id, estado,
                fecha_hora_programada, fecha_hora_finalizacion, km, observaciones,
                proximo_mantenimiento_km, created_at, updated_at)

mantenimiento_adjunto (_id_adjunto_, #mantenimiento_id, nombre_archivo,
                ruta_archivo, mime_type, tamano_bytes, fecha_subida)

viaje          (_id_viaje_, origen, destino, fecha_hora_salida, estado,
                distancia_estimada_km, tiempo_estimado_min, observaciones,
                #operador_id, #chofer_id, #vehiculo_id, km_salida, km_llegada,
                fecha_asignacion, fecha_finalizacion, #finalizado_por_id,
                created_at, updated_at)

alerta         (_id_alerta_, tipo_alerta, descripcion, entidad_tipo, entidad_id,
                fecha_alerta, estado, #resuelta_por_id, fecha_resolucion)
                -- entidad_tipo + entidad_id: referencia polimórfica sin FK física

auditoria      (_id_auditoria_, #usuario_id, accion, entidad, entidad_id, fecha,
                datos_anteriores, datos_nuevos)

configuracion  (_id_ = 1, nombre_empresa, cuit, direccion, telefono, email,
                zona_horaria, idioma, formato_fecha, updated_at)
```

## 2. Restricciones de integridad

| Restricción | Tabla | Regla que implementa |
|:-|:-|:-|
| UNIQUE `email` | usuario | Email como dato de acceso |
| UNIQUE `dni` | chofer | — |
| UNIQUE `patente` | vehiculo | — |
| UNIQUE `nombre` | tipo_mantenimiento | Catálogo sin duplicados |
| UNIQUE `token_hash` | refresh_token | Un token = una sesión |
| CHECK `tamano_bytes ≤ 1.048.576` | documentacion, mantenimiento_adjunto | F-9 (1 MB) |
| CHECK `km_acumulado ≥ km_inicial` | vehiculo | Coherencia de odómetro |
| CHECK `km_objetivo ≥ km_alerta` (y meses) | tipo_mantenimiento | RN-13 |
| CHECK `km_llegada > km_salida` | viaje | **RN-5** |
| CHECK estado EN_VIAJE/FINALIZADO ⇒ campos de asignación/cierre completos | viaje | **A-1/A-2** (consistencia estado↔datos) |
| CHECK FINALIZADO ⇒ `fecha_hora_finalizacion` | mantenimiento | C-6 |
| CHECK RESUELTA ⇒ `resuelta_por` + `fecha_resolucion` | alerta | — |
| CHECK `id = 1` | configuracion | Fila única |
| ENUMs de estado | vehiculo, viaje, mantenimiento, alerta, usuario.rol | C-1, A-2, C-6 — dominios cerrados inviolables |
| FK `ON DELETE RESTRICT` (todas salvo adjuntos y tokens) | — | RN-20: baja lógica; la BD impide borrados físicos con historia |
| FK `ON DELETE CASCADE` | mantenimiento_adjunto, refresh_token | Hijos sin valor propio fuera del padre |

**Reglas en la capa de servicios (imposibles o inapropiadas en SQL):** RN-6 (solapamiento entre filas), RN-12 (selección automática), RN-16 (permiso de Admin), RN-19 (disponibilidad derivada del chofer), transiciones de estado válidas, deduplicación de alertas pendientes, validación de MIME real de archivos.

## 3. Índices y justificación

| Índice | Consulta que optimiza |
|:-|:-|
| `usuario (rol, activo)` | Listado de usuarios con filtros por rol/estado (P-AD-2) |
| `chofer (fecha_vencimiento_licencia)` | Job de alertas: licencias que vencen en ≤ 2 semanas (RN-17) |
| `documentacion (chofer_id)` / `(fecha_vencimiento)` | Docs por chofer; job de vencimientos |
| `vehiculo (estado)` | Selección de Disponibles para asignación automática (RN-12); listado por estado |
| `vehiculo (fecha_vencimiento_seguro)` | Alerta SEGURO_VENCIDO |
| `mantenimiento (vehiculo_id, estado)` | Historial por vehículo; Programados vs. Historial (C-6) |
| `viaje (estado)` / `(fecha_hora_salida)` | Listado con filtros por estado y rango de fechas (P-OP-2); reportes por período (A-11) |
| `viaje (chofer_id, estado)` | Chequeo "sin viaje activo" de RN-19/RN-6 — consulta más frecuente del sistema |
| `viaje (vehiculo_id, estado)` | Liberación y trazabilidad del vehículo |
| `alerta (estado, fecha_alerta)` | Pestañas Pendientes/Resueltas ordenadas (P-AD-4) |
| `auditoria (usuario_id, fecha)` / `(entidad, entidad_id)` / `(fecha)` | Filtros de P-AD-3 (usuario, entidad, rango de fechas) |

No se indexa lo que no se consulta: cada índice cuesta en escritura; solo se crean los que responden a pantallas o reglas documentadas.

## 4. Seeds incluidos en `schema.sql`

Solo catálogo estructural: los 2 tipos de mantenimiento (C-7) y la fila de configuración. Los seeds de datos de ejemplo (F-1: usuarios, choferes, vehículos, viajes, mantenimientos, documentación) se implementan en `prisma/seed.ts` (Etapa 3), porque requieren lógica de aplicación (hash bcrypt, cifrado AES, estados coherentes).

## 5. Verificación

Script validado sintácticamente contra el dialecto MySQL (16 sentencias, sin errores). Requiere **MySQL Server 8.0.16+** (CHECK constraints aplicadas; en versiones anteriores se ignoran silenciosamente).

---

**Próximo paso (tras tu aprobación):** Etapa 3, módulo 1 — Backend: setup del proyecto (Express + TypeScript + Prisma, `schema.prisma` espejo de este modelo, middlewares base) y módulo de **Autenticación**.
