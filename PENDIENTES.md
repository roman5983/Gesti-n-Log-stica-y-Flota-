# Pendientes — Sistema de Gestión Logística y Flota

Único documento de pendientes del proyecto: todo lo que falta está acá y en ningún otro archivo. Cuando algo se resuelve, se borra de esta lista (el detalle queda en `docs/DEVLOG.md`). El plan de acción del capítulo 25 del manual técnico es una foto del análisis original; los puntos de ese plan que siguen abiertos ya están incluidos acá.

**Estado al 11/10/2026.** Ya resuelto y no aparece en esta lista: build de producción del backend, preparación para Vercel + Render, archivos subidos guardados en MySQL, el selector de fecha único, el sistema de color con contraste WCAG AA, todas las mejoras de UX pedidas (buscador en Viajes, filtros y orden en Alertas y Mantenimiento, alertas como tarjetas, evaluación diaria, carteles aclaratorios, frontend en una carpeta por componente con el código en inglés), lo que trajo Justino en la entrega anterior (la alerta de viaje sin asignar y la regla de que solo se cancelan viajes pendientes) y, de esta vuelta: RN-4 ahora exige documentación completa y vigente para asignar un viaje (antes solo bloqueaba la vencida); no se puede borrar documentación de un chofer con un viaje en curso; confirmación al eliminar un documento; validación de formularios propia de la app en vez de los carteles nativos del navegador; versión de escritorio del layout de Chofer (antes fijo en mobile); y una pasada de evaluación de alertas cada hora, además de la diaria (resuelve el antiguo punto 19, "la alerta casi nunca salta sola"). También quedaron resueltas la evidencia de ejecución de los tests (`docs/EVIDENCIA-TESTS.md`) y la participación (Santiago ya tiene commits y tests propios). En la revisión del 28/09 se corrigió que los formularios con `noValidate` se enviaban aunque tuvieran campos vacíos, fechas incompletas o una dirección no elegida de la lista. También el 28/09 se resolvieron todos los bugs y menores anteriores (el de `SMTP_PORT` lo corrigió Santiago):

- **Bajas:** ya no se puede eliminar un chofer con un viaje en curso, y la baja de vehículos y choferes usa bloqueo de fila.
- **Frontend:** las peticiones tienen tiempo límite, "Asignar viaje" solo ofrece choferes con la documentación completa, y cada pantalla se carga por separado.
- **Auditoría:** registra el inicio y el cierre de sesión.
- **Dependencias:** se actualizaron las que no requieren cambio de versión mayor (de 18 a 9 vulnerabilidades en el backend y de 8 a 4 en el frontend), y el lockfile del frontend quedó sincronizado.
- **Decisiones del equipo (28/09):** las diferencias con la propuesta (vistas de detalle, dos métricas del dashboard, redacción de los CRUD) no se consideran un problema. Una avería de un camión en ruta queda fuera del alcance (se supone que no pasa). La zona horaria, el idioma y el formato de fecha quedan fijos y no se pueden modificar.
- **Aprobación (28/09):** tests de integración contra MySQL (23) y E2E con Playwright (12), los dos pasando; documentación de la API con Swagger (`/api/v1/docs`); links a los PR en `proposal.md`. Los tests de integración encontraron un error real de concurrencia, que ya está corregido (transacciones en READ COMMITTED).
- **Manual técnico:** se puso al día (tests, nueve tipos de alerta, rutas de los capítulos 18 a 22C y hallazgos tabulados de los capítulos 02 a 07).

---

## ✅ Deploy

**Online desde el 11/10/2026:** frontend en https://gesti-n-log-stica-y-flota.vercel.app, backend en Railway (https://gestion-logistica-api-production.up.railway.app, con MySQL de Railway y el seed de demostración cargado). Pasos en el README, sección "Deploy". La IP del usuario (límite de intentos de login) quedó verificada en los logs, y `multer` pasó a la 2.x (11/10).

## 🟠 Falta para cumplir la consigna (aprobación)

1. **Video de demostración.**
2. **Gestión del proyecto:** falta declarar la metodología, las minutas de reuniones y el tracking de tareas en `docs/`.
3. **Links del deploy y credenciales** en la entrega (el deploy ya está online; las credenciales son las del seed, en el README).

## 🟢 Menores / prolijidad

4. **Vulnerabilidades que quedan en las dependencias:** 10 en el backend (`npm audit` del 11/10, después de pasar `multer` a 2.x y actualizar `proxy-addr`, `brace-expansion`, `fast-copy` y `source-map-js`) y 4 en el frontend (28/09). Ninguna se arregla sin un cambio de versión mayor. En el backend vienen de paquetes que Prisma 7 fija internamente (`mariadb`, `mysql2`, `deepmerge-ts`, `valibot` y `@hono/node-server`, estos dos de las herramientas del CLI); `npm audit fix --force` bajaría a Prisma 6, así que **no hay que correrlo**, y `npm audit fix` sin `--force` sube el CLI de Prisma sin el cliente, así que tampoco. Se resuelven cuando Prisma publique una versión que las actualice. La de `nodemailer` se arregla pasando a la versión 10. En el frontend las piden Vite 5 (esbuild) y React Router 6, y solo se arreglan pasando a Vite 8 y React Router 7.

## ⚪ Solo si el proyecto sigue después de la entrega

5. Paquete compartido de esquemas Zod entre backend y frontend, notificaciones al chofer, y un almacén compartido para el límite de intentos de login si hay más de una instancia del backend (capítulo 25, puntos 22, 23 y 25).

---

**Orden sugerido** (primera entrega: 12 al 16 de octubre): el video (1) y los links y credenciales (3). La gestión del proyecto (2) no depende del deploy.
