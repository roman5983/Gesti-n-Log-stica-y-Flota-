# Pendientes — Sistema de Gestión Logística y Flota

Documento único de pendientes del proyecto. Reemplaza a `PENDIENTES-EQUIPO.md`, `PENDIENTES-EQUIPO.pdf` y a la versión anterior de este mismo archivo, que quedaron desactualizados y duplicados entre sí.

**Estado al 23/09/2026.** Ya resuelto y no aparece en esta lista: build de producción del backend, preparación para Vercel + Render, archivos subidos guardados en MySQL, el selector de fecha único (dd/mm/aaaa, tipeo o calendario), el sistema de color (paleta con tokens y contraste WCAG AA verificado por tests, gráfico del dashboard con tonos según el valor), y todas las mejoras de UX pedidas: buscador en Viajes, filtros y orden en Alertas y Mantenimiento (incluye el historial por vehículo), alertas como tarjetas, evaluación de alertas diaria, carteles aclaratorios, y el frontend reorganizado en una carpeta por componente con el código en inglés (lo que también eliminó el warning de lint).

---

## 🔴 Deploy (lo que falta para tenerlo online)

1. **Elegir y crear la base de datos MySQL en internet.** Render no ofrece MySQL gratis. La opción gratuita más directa es Aiven, con 1 GB. Exige conexión cifrada, así que probablemente haya que ajustar un poco cómo se conecta el backend.
2. **Crear los servicios** siguiendo el README (sección "Deploy"): el backend en Render con `render.yaml` y el frontend en Vercel. Después, cargar el seed de demostración desde la terminal (*Shell*) del servicio en Render.
3. **Calibrar `TRUST_PROXY`** una vez desplegado, con los logs de Render (está explicado en el README).
4. **Revisar la URL del backend en `frontend/vercel.json`.** Si Render le asigna al servicio un nombre distinto de `gestion-logistica-api`, hay que actualizarla ahí.

## 🟠 Falta para cumplir la consigna (aprobación)

5. **Test de integración del backend contra una base real.** Por ejemplo: crear, asignar y finalizar un viaje con supertest.
6. **Test E2E automatizado** con Playwright o Cypress. La guía E2E actual es manual.
7. **Documentación de la API** con Swagger/OpenAPI.
8. **Video de demostración.**
9. **Evidencia de ejecución de los tests.** `docs/PLAN-DE-PRUEBAS.md` sigue diciendo "23 / 5 tests"; hoy son 94 en el backend y 144 en el frontend.
10. **Gestión del proyecto:** falta declarar la metodología, las minutas de reuniones y el tracking de tareas en `docs/`.
11. **Links a los pull requests en `proposal.md`.** Ya se piden para la regularidad.
12. **Participación:** cada integrante tiene que tener commits propios y al menos un test de su autoría. Hoy Santiago no tiene commits en el repo oficial.
13. **Links del deploy y credenciales** para la entrega, cuando esté online.

## 🟠 Diferencias entre la propuesta y lo implementado

14. **Vista de detalle de Vehículo.** La consigna exige un detalle al seleccionar un elemento de cada listado. Choferes, Usuarios y Alertas tampoco tienen vista de detalle.
15. **Dashboard:** faltan "Kilometraje total por vehículo" y "Alertas abiertas por tipo".
16. **Reescribir "CRUD Auditoría" y "CRUD Alerta" en la propuesta.** La auditoría no se edita a propósito, y las alertas solo se crean y se resuelven. Así escrito, parece que falta algo.

## 🟡 Bugs a corregir

17. **Se puede eliminar un chofer con un viaje en curso.** Desactivarlo está bloqueado, pero eliminarlo no.
18. **Carrera en la baja de vehículos y de choferes.** Falta el bloqueo de fila que ya usan viajes y mantenimientos. Sin él, si la baja coincide con una asignación, puede quedar un vehículo inactivo con un viaje en curso.

## 🟢 Menores / prolijidad

19. **Vulnerabilidades de dependencias:** 18 en el backend y 8 en el frontend. Varias se arreglan con actualizaciones menores. Prisma y Vite requieren cambio de versión mayor, y en ningún caso hay que correr `npm audit fix --force`.
20. **El frontend se carga en un solo archivo de 1,2 MB.** Se puede partir por pantalla con `React.lazy`.
21. **Documentación desactualizada:** el README dice 57 endpoints y son 60. Algunos capítulos del manual técnico dicen que no hay tests de componentes ni de servicios, y ya los hay. Los capítulos 18 a 22C citan las rutas del frontend anteriores a la reorganización; la equivalencia está en §21B, pero conviene actualizar los listados de código cuando se retoquen.
22. **Limpiar la raíz del repo:** `Backend-Gestion-Logistica.docx` (la cátedra no acepta `.docx`) y `CRUD-proposal-ubicacion-codigo.pdf` si ya cumplió su propósito.
23. **Lockfile del frontend:** con npm 10, `npm ci` lo marca desincronizado. Conviene regenerarlo con la versión de npm que use el equipo.

---

**Prioridad sugerida** (primera entrega: 12 al 16 de octubre): primero el deploy (1 a 4), después los tests de integración y E2E junto con la documentación de la API (5 a 7), y después la vista de detalle (14), por ser un requisito explícito de la consigna.
