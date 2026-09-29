# Pendientes — Sistema de Gestión Logística y Flota

Único documento de pendientes del proyecto: todo lo que falta está acá y en ningún otro archivo. Cuando algo se resuelve, se borra de esta lista (el detalle queda en `docs/DEVLOG.md`). El plan de acción del capítulo 25 del manual técnico es una foto del análisis original; los puntos de ese plan que siguen abiertos ya están incluidos acá.

**Estado al 28/09/2026.** Ya resuelto y no aparece en esta lista: build de producción del backend, preparación para Vercel + Render, archivos subidos guardados en MySQL, el selector de fecha único, el sistema de color con contraste WCAG AA, todas las mejoras de UX pedidas (buscador en Viajes, filtros y orden en Alertas y Mantenimiento, alertas como tarjetas, evaluación diaria, carteles aclaratorios, frontend en una carpeta por componente con el código en inglés), lo que trajo Justino en la entrega anterior (la alerta de viaje sin asignar y la regla de que solo se cancelan viajes pendientes) y, de esta vuelta: RN-4 ahora exige documentación completa y vigente para asignar un viaje (antes solo bloqueaba la vencida); no se puede borrar documentación de un chofer con un viaje en curso; confirmación al eliminar un documento; validación de formularios propia de la app en vez de los carteles nativos del navegador; versión de escritorio del layout de Chofer (antes fijo en mobile); y una pasada de evaluación de alertas cada hora, además de la diaria (resuelve el antiguo punto 19, "la alerta casi nunca salta sola"). También quedaron resueltas la evidencia de ejecución de los tests (`docs/EVIDENCIA-TESTS.md`) y la participación (Santiago ya tiene commits y tests propios). En la revisión del 28/09 se corrigió que los formularios con `noValidate` se enviaban aunque tuvieran campos vacíos, fechas incompletas o una dirección no elegida de la lista. También el 28/09 se resolvieron todos los bugs y menores anteriores (el de `SMTP_PORT` lo corrigió Santiago):

- **Bajas:** ya no se puede eliminar un chofer con un viaje en curso, y la baja de vehículos y choferes usa bloqueo de fila.
- **Frontend:** las peticiones tienen tiempo límite, "Asignar viaje" solo ofrece choferes con la documentación completa, y cada pantalla se carga por separado.
- **Auditoría:** registra el inicio y el cierre de sesión.
- **Dependencias:** se actualizaron las que no requieren cambio de versión mayor (de 18 a 9 vulnerabilidades en el backend y de 8 a 4 en el frontend), y el lockfile del frontend quedó sincronizado.
- **Decisiones del equipo (28/09):** las diferencias con la propuesta (vistas de detalle, dos métricas del dashboard, redacción de los CRUD) no se consideran un problema. Una avería de un camión en ruta queda fuera del alcance (se supone que no pasa). La zona horaria, el idioma y el formato de fecha quedan fijos y no se pueden modificar.
- **Aprobación (28/09):** tests de integración contra MySQL (23) y E2E con Playwright (12), los dos pasando; documentación de la API con Swagger (`/api/v1/docs`); links a los PR en `proposal.md`. Los tests de integración encontraron un error real de concurrencia, que ya está corregido (transacciones en READ COMMITTED).
- **Manual técnico:** se puso al día (tests, nueve tipos de alerta, rutas de los capítulos 18 a 22C y hallazgos tabulados de los capítulos 02 a 07).

---

## 🔴 Deploy (lo que falta para tenerlo online)

1. **Elegir y crear la base de datos MySQL en internet.** Render no ofrece MySQL gratis. La opción gratuita más directa es Aiven, con 1 GB. Exige conexión cifrada, así que probablemente haya que ajustar un poco cómo se conecta el backend.
2. **Crear los servicios** siguiendo el README (sección "Deploy"): el backend en Render con `render.yaml` y el frontend en Vercel. Después, cargar el seed de demostración desde la terminal (*Shell*) del servicio en Render.
3. **Calibrar `TRUST_PROXY`** una vez desplegado, con los logs de Render (está explicado en el README).
4. **Revisar la URL del backend en `frontend/vercel.json`.** Si Render le asigna al servicio un nombre distinto de `gestion-logistica-api`, hay que actualizarla ahí.
5. **Actualizar `multer` a la versión 2.x antes de producción.** Hoy está en 1.4.5, con vulnerabilidades conocidas (capítulo 25, punto 27).

## 🟠 Falta para cumplir la consigna (aprobación)

6. **Video de demostración.**
7. **Gestión del proyecto:** falta declarar la metodología, las minutas de reuniones y el tracking de tareas en `docs/`.
8. **Links del deploy y credenciales** para la entrega, cuando esté online.

## 🟢 Menores / prolijidad

9. **Vulnerabilidades que quedan en las dependencias:** 10 en el backend y 4 en el frontend (`npm audit` del 28/09). Todas requieren un cambio de versión mayor o una corrección de terceros, así que no se tocan antes de la entrega. En el backend vienen de versiones que Prisma 7 fija internamente (`mariadb`, `mysql2` y las herramientas del CLI); `npm audit fix --force` bajaría a Prisma 6, así que **no hay que correrlo**. Se resuelven cuando Prisma publique una versión que las actualice. La de `nodemailer` (un aviso nuevo, que solo afecta a quien usa varios transportes SMTP a la vez) se arregla pasando a la versión 10. En el frontend las piden Vite 5 (esbuild) y React Router 6, y solo se arreglan pasando a Vite 8 y React Router 7.

## ⚪ Solo si el proyecto sigue después de la entrega

10. Paquete compartido de esquemas Zod entre backend y frontend, notificaciones al chofer, y un almacén compartido para el límite de intentos de login si hay más de una instancia del backend (capítulo 25, puntos 22, 23 y 25).

---

**Orden sugerido** (primera entrega: 12 al 16 de octubre): el deploy (1 a 5) es lo más urgente. Después, el video (6) y los links y credenciales (8), que dependen de tenerlo online. La gestión del proyecto (7) no depende del deploy.
