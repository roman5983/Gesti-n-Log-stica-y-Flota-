# Pendientes — Sistema de Gestión Logística y Flota

Documento único de pendientes del proyecto. Reemplaza a `PENDIENTES-EQUIPO.md`, `PENDIENTES-EQUIPO.pdf` y a la versión anterior de este mismo archivo, que quedaron desactualizados y duplicados entre sí.

**Estado al 23/09/2026.** Ya resuelto y no aparece en esta lista: build de producción del backend, preparación para Vercel + Render, archivos subidos guardados en MySQL, el selector de fecha único (dd/mm/aaaa, tipeo o calendario), y el sistema de color (paleta con tokens y contraste WCAG AA verificado por tests, y el gráfico del dashboard con tonos según el valor).

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
9. **Evidencia de ejecución de los tests.** `docs/PLAN-DE-PRUEBAS.md` sigue diciendo "23 / 5 tests"; hoy son 64 en el backend y 81 en el frontend.
10. **Gestión del proyecto:** falta declarar la metodología, las minutas de reuniones y el tracking de tareas en `docs/`.
11. **Links a los pull requests en `proposal.md`.** Ya se piden para la regularidad.
12. **Participación:** cada integrante tiene que tener commits propios y al menos un test de su autoría. Hoy Santiago no tiene commits en el repo oficial.
13. **Links del deploy y credenciales** para la entrega, cuando esté online.

## 🟠 Diferencias entre la propuesta y lo implementado

14. **Vista de detalle de Vehículo.** La consigna exige un detalle al seleccionar un elemento de cada listado. Choferes, Usuarios y Alertas tampoco tienen vista de detalle.
15. **"Historial de mantenimientos por vehículo" en la interfaz.** El backend ya acepta filtrar por vehículo; falta el filtro en la pantalla de Mantenimiento.
16. **Dashboard:** faltan "Kilometraje total por vehículo" y "Alertas abiertas por tipo".
17. **Reescribir "CRUD Auditoría" y "CRUD Alerta" en la propuesta.** La auditoría no se edita a propósito, y las alertas solo se crean y se resuelven. Así escrito, parece que falta algo.

## 🟡 Bugs a corregir

18. **Se puede eliminar un chofer con un viaje en curso.** Desactivarlo está bloqueado, pero eliminarlo no.
19. **Carrera en la baja de vehículos y de choferes.** Falta el bloqueo de fila que ya usan viajes y mantenimientos. Sin él, si la baja coincide con una asignación, puede quedar un vehículo inactivo con un viaje en curso.

## 🟢 Menores / prolijidad

20. **Vulnerabilidades de dependencias:** 18 en el backend y 8 en el frontend. Varias se arreglan con actualizaciones menores. Prisma y Vite requieren cambio de versión mayor, y en ningún caso hay que correr `npm audit fix --force`.
21. **El frontend se carga en un solo archivo de 1,2 MB.** Se puede partir por pantalla con `React.lazy`.
22. **Documentación desactualizada:** el README dice 57 endpoints y son 60. Algunos capítulos del manual técnico dicen que no hay tests de componentes ni de servicios, y ya los hay.
23. **Limpiar la raíz del repo:** `Backend-Gestion-Logistica.docx` (la cátedra no acepta `.docx`) y `CRUD-proposal-ubicacion-codigo.pdf` si ya cumplió su propósito.
24. **Warning de lint pendiente** en `auth/guards.tsx`.
25. **Lockfile del frontend:** con npm 10, `npm ci` lo marca desincronizado. Conviene regenerarlo con la versión de npm que use el equipo.

## 🔵 Mejoras de UX pedidas (Román, 23/09/2026)

26. **Buscador en Viajes (chofer y destino).** Ícono de lupa que filtre por nombre del chofer asignado y por destino. A definir: un campo único o dos separados, y si la búsqueda es server-side (nuevo parámetro en `GET /trips`, preferible por consistencia con los demás filtros) o client-side.

27. **Ordenamiento en Alertas y Mantenimiento.** Hoy ambas pantallas solo filtran, no ordenan.
    - Mantenimiento: por tipo de mantenimiento, por vehículo, por período (fecha programada / finalización), y otros criterios útiles (ej. kilómetro).
    - Alertas: por tipo de alerta, por vehículo, por período (semanal u otro rango).
    - Implica un parámetro `sortBy`/`sortOrder` en `GET /maintenances` y `GET /alerts` (hoy ordenan fijo) y el control en la UI.

28. **Reorganización del frontend por componente + código en inglés.** Cambio de fondo, no cosmético: toca casi todos los archivos del frontend. Conviene una rama propia y discutirlo en equipo antes de arrancar.
    - **Carpeta por componente**, según el estándar de referencia:
      ```
      ComponentName/
      ├─ ComponentName.tsx          # Componente, JSX, hooks, manejadores de eventos
      ├─ ComponentName.scss         # Estilos
      ├─ ComponentName.types.ts     # Props, formas de estado local, enums internos
      ├─ ComponentName.data.ts      # Arrays/objetos fijos (named exports)
      ├─ ComponentName.const.ts     # Constantes primitivas (SCREAMING_SNAKE_CASE)
      ├─ ComponentName.helpers.ts   # Funciones TS puras — sin React, sin hooks
      └─ ComponentName.server.ts    # Llamadas a la API, con callbacks onSuccess/onError
      ```
      Hoy el proyecto usa MUI con `sx` (no SCSS) y `axios`/`async-await` (no callbacks `onSuccess`/`onError`) — definir si se adopta el patrón tal cual o se adapta a esas convenciones (ej. `.styles.ts` en vez de `.scss`, `.api.ts` en vez de `.server.ts`).
    - **Todo el código en inglés**: identificadores, comentarios y nombres de archivo hoy en castellano (`pages/viajes/`, `pages/choferes/`, variables como `chofer`, `vehiculo`). Definir el alcance antes de tocar nada: ¿incluye los **textos que ve el usuario** (labels, mensajes, botones) o solo identificadores/comentarios/nombres de archivo? Los textos de UI están en castellano a propósito, para una empresa argentina — traducirlos cambia la experiencia del usuario final. Confirmar también si el backend (ya en inglés, con mensajes de error en castellano por diseño) sigue el mismo criterio.

29. **Evaluación de alertas: automática una vez al día + botón manual siempre disponible.** Hoy corre cada `ALERTS_EVAL_INTERVAL_MIN` minutos (10 por defecto). Pasarlo a una vez al día (ej. `ALERTS_EVAL_INTERVAL_HOURS` o fijo a 24h en `alerts.scheduler.ts`, actualizar `.env.example`/README) y dejar el botón "Evaluar alertas" (`POST /alerts/evaluate`) sin cambios, para uso manual del Admin/Operador en cualquier momento.

30. **Carteles aclaratorios cuando una acción no se puede hacer.** Reforzar los mensajes visibles al usuario cuando el sistema rechaza algo (ejemplo dado: login con contraseña incorrecta, que ya muestra "Credenciales inválidas"). Revisar que el mismo patrón sea consistente en todo el sistema: reglas de negocio bloqueadas, permisos insuficientes, validaciones de formulario. Definir si alcanza el `Alert` actual o hace falta algo más visible (Snackbar/Toast) para errores hoy silenciosos, relevando pantalla por pantalla.

31. **Rediseño de Alertas: tarjetas con ícono y color por tipo, no una tabla plana.** Hoy `AlertasPage.tsx` renderiza cada alerta como fila de `DataTable` (texto plano, todas iguales visualmente). Cambiar a tarjetas tipo lista (una por alerta) con: ícono identificable por tipo (ej. documento para vencimientos, llave para mantenimiento, persona para disponibilidad de chofer) y color de fondo/acento distinto según severidad o tipo (rojo para vencimientos urgentes, naranja para mantenimiento pendiente, amarillo para disponibilidad, etc. — ver mockup de referencia adjunto por Román el 23/09). Objetivo: que se puedan diferenciar de un vistazo, no solo leyendo el texto. Implica un componente nuevo (`AlertCard` o similar) y un mapeo `alertType` → `{ icon, tone }`. La paleta ya existe (`theme-tokens.ts`, tipo `Tone`): el círculo con ícono puede copiar el de `KpiCard`, y conviene sumar un test del mapeo.

---

**Prioridad sugerida** (primera entrega: 12 al 16 de octubre): primero el deploy (1 a 4), después los tests de integración y E2E junto con la documentación de la API (5 a 7), y después la vista de detalle (14), por ser un requisito explícito de la consigna. Los puntos 26 a 31 son mejoras de UX sin fecha límite de la cátedra — encajan después de lo anterior, o en paralelo si hay integrantes libres.
