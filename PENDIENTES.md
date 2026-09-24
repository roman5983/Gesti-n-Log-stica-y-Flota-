# Pendientes — Sistema de Gestión Logística y Flota

Único documento de pendientes del proyecto: todo lo que falta está acá y en ningún otro archivo. Cuando algo se resuelve, se borra de esta lista (el detalle queda en `docs/DEVLOG.md`). El plan de acción del capítulo 25 del manual técnico es una foto del análisis original; los puntos de ese plan que siguen abiertos ya están incluidos acá.

**Estado al 24/09/2026.** Ya resuelto y no aparece en esta lista: build de producción del backend, preparación para Vercel + Render, archivos subidos guardados en MySQL, el selector de fecha único, el sistema de color con contraste WCAG AA, todas las mejoras de UX pedidas (buscador en Viajes, filtros y orden en Alertas y Mantenimiento, alertas como tarjetas, evaluación diaria, carteles aclaratorios, frontend en una carpeta por componente con el código en inglés) y lo que trajo Justino: la alerta de viaje sin asignar y la regla de que solo se cancelan viajes pendientes.

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
10. **Evidencia de ejecución de los tests.** `docs/PLAN-DE-PRUEBAS.md` sigue diciendo "23 / 5 tests"; hoy son 97 en el backend y 149 en el frontend.
11. **Gestión del proyecto:** falta declarar la metodología, las minutas de reuniones y el tracking de tareas en `docs/`.
12. **Links a los pull requests en `proposal.md`.** Ya se piden para la regularidad.
13. **Participación:** cada integrante tiene que tener commits propios y al menos un test de su autoría. Hoy Santiago no tiene commits en el repo oficial.
14. **Links del deploy y credenciales** para la entrega, cuando esté online.

## 🟠 Diferencias entre la propuesta y lo implementado

15. **Vista de detalle de Vehículo.** La consigna exige un detalle al seleccionar un elemento de cada listado. Choferes, Usuarios y Alertas tampoco tienen vista de detalle.
16. **Dashboard:** faltan "Kilometraje total por vehículo" y "Alertas abiertas por tipo".
17. **Reescribir "CRUD Auditoría" y "CRUD Alerta" en la propuesta.** La auditoría no se edita a propósito, y las alertas solo se crean y se resuelven. Así escrito, parece que falta algo.

## 🟠 Decisiones de producto

18. **Qué hacer con un camión que se rompe en ruta.** Desde el 24/09 un viaje en curso ya no se puede cancelar, así que la única forma de cerrarlo es "Finalizar", que lo cuenta como completado y suma los km y el viaje al chofer. Opciones: volver a permitir cancelar viajes en curso, o agregar una acción "interrumpir viaje" que libere el vehículo sin sumar estadísticas.
19. **Alerta de viaje sin asignar y evaluación diaria.** La alerta avisa de viajes que salen en menos de 1 hora, pero la evaluación automática corre una vez al día (06:00) y al arrancar. Para los viajes que salen en otro horario, hoy hay que tocar "Evaluar alertas". Se decidió dejarlo así por ahora. Si molesta, se puede ampliar la ventana o evaluar esta alerta cada hora.
20. **Configuración de la empresa:** zona horaria, idioma y formato de fecha se guardan, pero la app no los usa. Hay que decidir si se aplican o se quitan de la pantalla (capítulo 25, punto 19).

## 🟡 Bugs a corregir

21. **Se puede eliminar un chofer con un viaje en curso.** Desactivarlo está bloqueado, pero eliminarlo no.
22. **Carrera en la baja de vehículos y de choferes.** Falta el bloqueo de fila que ya usan viajes y mantenimientos. Sin él, si la baja coincide con una asignación, puede quedar un vehículo inactivo con un viaje en curso.
23. **Las peticiones del frontend no tienen tiempo límite.** Si el servidor no responde, la pantalla queda cargando para siempre. Falta un `timeout` en el cliente Axios (capítulo 19).

## 🟢 Menores / prolijidad

24. **El login y el logout no quedan en la auditoría** (capítulo 15).
25. **Vulnerabilidades de dependencias:** 18 en el backend y 8 en el frontend (conteo anterior; conviene volver a correr `npm audit`). Varias se arreglan con actualizaciones menores. Prisma y Vite requieren cambio de versión mayor, y en ningún caso hay que correr `npm audit fix --force`.
26. **El frontend se carga en un solo archivo de 1,3 MB.** Se puede partir por pantalla con `React.lazy`.
27. **Documentación desactualizada:** algunos capítulos del manual técnico dicen que no hay tests de componentes ni de servicios, y ya los hay. El capítulo 14 habla de "ocho tipos de alerta" y hoy son nueve (hay una nota al final del capítulo). Los capítulos 18 a 22C citan las rutas del frontend anteriores a la reorganización; la equivalencia está en §21B. Falta tabular los hallazgos de los capítulos 02 a 07 (capítulo 25, punto 28).
28. **Lockfile del frontend:** con npm 10, `npm ci` lo marca desincronizado y falla. Conviene regenerarlo con la versión de npm que use el equipo.

## ⚪ Solo si el proyecto sigue después de la entrega

29. Paquete compartido de esquemas Zod entre backend y frontend, notificaciones al chofer, y un almacén compartido para el límite de intentos de login si hay más de una instancia del backend (capítulo 25, puntos 22, 23 y 25).

---

**Prioridad sugerida** (primera entrega: 12 al 16 de octubre): primero el deploy (1 a 5), después los tests de integración y E2E junto con la documentación de la API (6 a 8), y después la vista de detalle (15), por ser un requisito explícito de la consigna. Las decisiones de producto (18 a 20) conviene charlarlas en equipo antes de tocar código.
