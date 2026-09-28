# Pendientes — Sistema de Gestión Logística y Flota

Único documento de pendientes del proyecto: todo lo que falta está acá y en ningún otro archivo. Cuando algo se resuelve, se borra de esta lista (el detalle queda en `docs/DEVLOG.md`). El plan de acción del capítulo 25 del manual técnico es una foto del análisis original; los puntos de ese plan que siguen abiertos ya están incluidos acá.

**Estado al 28/09/2026.** Ya resuelto y no aparece en esta lista: build de producción del backend, preparación para Vercel + Render, archivos subidos guardados en MySQL, el selector de fecha único, el sistema de color con contraste WCAG AA, todas las mejoras de UX pedidas (buscador en Viajes, filtros y orden en Alertas y Mantenimiento, alertas como tarjetas, evaluación diaria, carteles aclaratorios, frontend en una carpeta por componente con el código en inglés), lo que trajo Justino en la entrega anterior (la alerta de viaje sin asignar y la regla de que solo se cancelan viajes pendientes) y, de esta vuelta: RN-4 ahora exige documentación completa y vigente para asignar un viaje (antes solo bloqueaba la vencida); no se puede borrar documentación de un chofer con un viaje en curso; confirmación al eliminar un documento; validación de formularios propia de la app en vez de los carteles nativos del navegador; versión de escritorio del layout de Chofer (antes fijo en mobile); y una pasada de evaluación de alertas cada hora, además de la diaria (resuelve el antiguo punto 19, "la alerta casi nunca salta sola"). También quedaron resueltas la evidencia de ejecución de los tests (`docs/EVIDENCIA-TESTS.md`) y la participación (Santiago ya tiene commits y tests propios). En la revisión del 28/09 se corrigió que los formularios con `noValidate` se enviaban aunque tuvieran campos vacíos, fechas incompletas o una dirección no elegida de la lista. También el 28/09 se resolvieron todos los bugs y menores anteriores (el de `SMTP_PORT` lo corrigió Santiago):

- **Bajas:** ya no se puede eliminar un chofer con un viaje en curso, y la baja de vehículos y choferes usa bloqueo de fila.
- **Frontend:** las peticiones tienen tiempo límite, "Asignar viaje" solo ofrece choferes con la documentación completa, y cada pantalla se carga por separado.
- **Auditoría:** registra el inicio y el cierre de sesión.
- **Dependencias:** se actualizaron las que no requieren cambio de versión mayor (de 18 a 9 vulnerabilidades en el backend y de 8 a 4 en el frontend), y el lockfile del frontend quedó sincronizado.
- **Manual técnico:** se puso al día (tests, nueve tipos de alerta, rutas de los capítulos 18 a 22C y hallazgos tabulados de los capítulos 02 a 07).

---

## 🔴 Deploy (lo que falta para tenerlo online)

1. **Elegir y crear la base de datos MySQL en internet.** Render no ofrece MySQL gratis. La opción gratuita más directa es Aiven, con 1 GB. Exige conexión cifrada, así que probablemente haya que ajustar un poco cómo se conecta el backend.
2. **Crear los servicios** siguiendo el README (sección "Deploy"): el backend en Render con `render.yaml` y el frontend en Vercel. Después, cargar el seed de demostración desde la terminal (*Shell*) del servicio en Render.
3. **Calibrar `TRUST_PROXY`** una vez desplegado, con los logs de Render (está explicado en el README).
4. **Revisar la URL del backend en `frontend/vercel.json`.** Si Render le asigna al servicio un nombre distinto de `gestion-logistica-api`, hay que actualizarla ahí.
5. **Actualizar `multer` a la versión 2.x antes de producción.** Hoy está en 1.4.5, con vulnerabilidades conocidas (capítulo 25, punto 27).

## 🟠 Falta para cumplir la consigna (aprobación)

6. **Test de integración del backend contra una base real.** Por ejemplo: crear, asignar y finalizar un viaje con supertest. Conviene incluir las carreras de concurrencia del capítulo 23.
7. **Test E2E automatizado** con Playwright o Cypress. La guía E2E actual es manual.
8. **Documentación de la API** con Swagger/OpenAPI.
9. **Video de demostración.**
10. **Gestión del proyecto:** falta declarar la metodología, las minutas de reuniones y el tracking de tareas en `docs/`.
11. **Links a los pull requests en `proposal.md`.** Ya se piden para la regularidad.
12. **Links del deploy y credenciales** para la entrega, cuando esté online.

## 🟠 Diferencias entre la propuesta y lo implementado

13. **Vista de detalle de Vehículo.** La consigna exige un detalle al seleccionar un elemento de cada listado. Choferes, Usuarios y Alertas tampoco tienen vista de detalle.
14. **Dashboard:** faltan "Kilometraje total por vehículo" y "Alertas abiertas por tipo".
15. **Reescribir "CRUD Auditoría" y "CRUD Alerta" en la propuesta.** La auditoría no se edita a propósito, y las alertas solo se crean y se resuelven. Así escrito, parece que falta algo.

## 🟠 Decisiones de producto

16. **Qué hacer con un camión que se rompe en ruta.** Desde el 24/09 un viaje en curso ya no se puede cancelar, así que la única forma de cerrarlo es "Finalizar", que lo cuenta como completado y suma los km y el viaje al chofer. Opciones: volver a permitir cancelar viajes en curso, o agregar una acción "interrumpir viaje" que libere el vehículo sin sumar estadísticas.
17. **Configuración de la empresa:** zona horaria, idioma y formato de fecha se guardan, pero la app no los usa. Hay que decidir si se aplican o se quitan de la pantalla (capítulo 25, punto 19).

## 🟢 Menores / prolijidad

18. **Vulnerabilidades que quedan en las dependencias:** 9 en el backend y 4 en el frontend (`npm audit` del 28/09). Todas requieren un cambio de versión mayor o una corrección de terceros, así que no se tocan antes de la entrega. En el backend vienen de versiones que Prisma 7 fija internamente (`mariadb`, `mysql2` y las herramientas del CLI); `npm audit fix --force` bajaría a Prisma 6, así que **no hay que correrlo**. Se resuelven cuando Prisma publique una versión que las actualice. En el frontend las piden Vite 5 (esbuild) y React Router 6, y solo se arreglan pasando a Vite 8 y React Router 7.

## ⚪ Solo si el proyecto sigue después de la entrega

19. Paquete compartido de esquemas Zod entre backend y frontend, notificaciones al chofer, y un almacén compartido para el límite de intentos de login si hay más de una instancia del backend (capítulo 25, puntos 22, 23 y 25).

---

**Prioridad sugerida** (primera entrega: 12 al 16 de octubre): primero el deploy (1 a 5), después los tests de integración y E2E junto con la documentación de la API (6 a 8), y después la vista de detalle (13), por ser un requisito explícito de la consigna. Las decisiones de producto pendientes (16 y 17) conviene charlarlas en equipo antes de tocar código.
