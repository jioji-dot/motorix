# Constitución de Motorix

Motorix es el Sistema de Gestión para Taller Mecánico: un proyecto académico cuyo MVP se
construye en cuatro sprints. El detalle de requisitos, módulos, entidades, reglas de negocio
y sprints vive en `docs/project-context.md`, que es la fuente de verdad del alcance. Esta
constitución define las reglas que NO se rompen al desarrollarlo, tanto por el equipo como
por el agente de IA.

## Principios fundamentales

### I. Alcance, MVP y fuente de verdad (NO NEGOCIABLE)

- El agente DEBE leer `docs/project-context.md` antes de implementar cualquier sprint.
- NO se permite agregar funcionalidades fuera del alcance sin indicarlo y obtener
  aprobación del equipo.
- El desarrollo DEBE seguir los sprints en orden (1 → 4); NO se implementa todo el sistema
  de una sola vez. No se inicia por Mercado Pago, dashboard o tickets.
- El chatbot de WhatsApp está FUERA del MVP; solo puede tratarse como integración externa
  futura.
- DEBE mantenerse la trazabilidad: requisito de alto nivel → historia de usuario → sprint →
  implementación.
- Si cambia una regla de negocio, rol, entidad, requisito o sprint, DEBE actualizarse
  `docs/project-context.md` para que el código y la planeación no se contradigan.
- Justificación: el objetivo es un MVP funcional y demostrable de extremo a extremo antes de
  incorporar funciones adicionales.

### II. Arquitectura con responsabilidades separadas (NO NEGOCIABLE)

- El proyecto DEBE separar frontend (`client/`), backend (`server/`), persistencia
  (`database/`) e integraciones externas.
- El backend DEBE organizarse en `config/`, `controllers/`, `models/`, `routes/`,
  `services/`, `middlewares/`, `validators/` y `utils/`.
- La lógica de negocio DEBE vivir en `services/`, NUNCA en controladores ni en widgets.
- La lógica de integración con Mercado Pago DEBE mantenerse aislada del dominio principal.
- La estructura puede ajustarse solo ante una necesidad técnica real, conservando una
  separación equivalente de responsabilidades.
- Justificación: separar capas permite que cada módulo se pruebe, cambie y revise sin romper
  los demás.

### III. Stack tecnológico y base de datos local del MVP

- Frontend: Flutter con Dart, interfaz responsiva y consumo de API REST.
- Backend: Node.js (versión LTS) con Express y JavaScript.
- **Sistema de módulos del backend (NO NEGOCIABLE):** todo el código JavaScript del backend
  DEBE usar ES Modules (`import`/`export`). NO se usa CommonJS (`require`/`module.exports`).
  El `package.json` del backend DEBE declarar `"type": "module"`.
- Base de datos: MySQL, ejecutada de forma LOCAL durante los cuatro sprints del MVP. Cada
  integrante DEBE usar su propia instancia; NO se usa base de datos en la nube ni hosting de
  base de datos dentro del MVP.
- Autenticación: JWT con contraseñas cifradas mediante bcrypt. El login acepta usuario
  (`username`) o correo electrónico (`email`) en el mismo campo, para todos los roles.
- El esquema y los datos iniciales DEBEN definirse con scripts SQL versionados en
  `database/` (`migrations/`, `seeds/`, `scripts/` y un `README.md`), de modo que la base
  pueda recrearse desde cero. Los cambios de esquema se agregan como nuevos scripts
  numerados; NO se editan scripts de sprints ya aplicados.
- Los seeds DEBEN ser idempotentes e incluir datos de ejemplo suficientes para que la
  aplicación muestre información al arrancar; la base no puede quedar vacía tras la
  instalación inicial.
- Los archivos físicos de datos de MySQL NO se versionan; si se usa un directorio de datos
  dentro del proyecto (por ejemplo `database/data/`), DEBE estar en `.gitignore`.
- La conexión DEBE configurarse solo con variables de entorno (`DB_HOST`, `DB_PORT`,
  `DB_USER`, `DB_PASSWORD`, `DB_NAME`) y la aplicación DEBE usar un usuario de MySQL
  dedicado al proyecto, NUNCA `root`. El `.env.example` incluye las variables sin secretos.
- Se DEBE usar InnoDB, llaves foráneas, restricciones `NOT NULL` y `UNIQUE` donde
  corresponda, y codificación `utf8mb4`.
- Solo el backend accede a la base de datos; el frontend NUNCA se conecta directamente.
- NO se introducen tecnologías o dependencias grandes sin justificar su necesidad.
- Justificación: un conjunto de tecnologías acotado y conocido por el equipo reduce riesgos
  en un proyecto con tiempo limitado.

### IV. Seguridad (NO NEGOCIABLE)

- Las contraseñas NUNCA se almacenan en texto plano.
- Los secretos y credenciales DEBEN manejarse con variables de entorno; `.env` DEBE estar en
  `.gitignore` y DEBE existir un `.env.example` sin secretos.
- NO se almacenan datos de tarjeta ni credenciales sensibles de Mercado Pago.
- Los permisos por rol DEBEN validarse en el backend; ocultar botones en el frontend no es
  seguridad suficiente.
- Las entradas DEBEN validarse y sanitizarse en el backend, sin confiar solo en el frontend.
- NUNCA se exponen trazas internas ni trazas de pila (stack traces) al usuario final.
- Justificación: el sistema maneja datos de clientes y pagos; una falla de seguridad invalida
  el proyecto.

### V. Integridad de las reglas de negocio (NO NEGOCIABLE)

- NO se crea un vehículo sin propietario ni una orden para un vehículo inexistente.
- Toda orden DEBE registrar el kilometraje de entrada; un kilometraje nuevo NO puede ser
  menor al registrado sin una corrección explícita.
- El uso de una refacción en una orden DEBE reflejar su salida de inventario, y NO se
  permite stock negativo salvo que el equipo defina otra política.
- Una orden entregada DEBE conservarse como historial y NO se elimina de forma ordinaria.
- Todo pago DEBE estar relacionado con una orden.
- Los intervalos de mantenimiento son configurables; NO se asumen valores universales.
- El historial del vehículo DEBE derivarse de la información registrada, evitando
  duplicación innecesaria.
- Justificación: estas reglas protegen la consistencia de inventario, historial y pagos.

### VI. API consistente y manejo de errores

- Las rutas DEBEN ser coherentes, con respuestas JSON consistentes y códigos HTTP
  apropiados.
- DEBE existir middleware de autenticación y de autorización, y validación de payloads.
- El manejo de errores DEBE estar centralizado y devolver mensajes claros y accionables.
- Justificación: una API predecible facilita la integración entre frontend y backend.

### VII. Pruebas

- El backend DEBE probarse con Jest (unitarias) y con Jest + supertest (integración y
  contrato); el frontend con las pruebas propias de Flutter (`flutter test`).
- Las pruebas de integración del backend DEBEN ejecutarse contra una base de datos de prueba
  (`motorix_test`), nunca contra la base principal.
- Toda lógica de negocio (transiciones de estado de órdenes, stock, mantenimientos,
  permisos) DEBE tener pruebas.
- NO se marca una historia como terminada solo porque existe la interfaz: DEBE funcionar de
  extremo a extremo cuando requiera persistencia o lógica de backend.
- Justificación: las reglas de inventario y de estados son propensas a regresiones
  silenciosas.

### VIII. UX/UI profesional y sencilla (NO NEGOCIABLE)

- La interfaz DEBE ser profesional, minimalista, consistente y fácil de usar por personal no
  técnico, con prioridad en escritorio.
- Toda pantalla, componente y decisión visual DEBE seguir el sistema de diseño definido en
  `docs/design-system.md`. Si una decisión de ese documento cambia, se actualiza antes de
  modificar la interfaz.
- Base de UI: Flutter con Material Design 3 (`useMaterial3: true`) y un `ThemeData` propio.
  NO se usa el tema por defecto de Material.
- Convención de colores: verde para correcto o completado, ámbar para advertencia o próximo,
  rojo para error, vencido o stock crítico. Paleta sobria, sin degradados ni elementos
  decorativos.
- Colores, tipografía, espaciados y radios DEBEN venir de los tokens del sistema de diseño;
  NO se escriben valores sueltos en las pantallas.
- Las operaciones destructivas DEBEN pedir confirmación y las acciones DEBEN mostrar
  mensajes de éxito o error.
- Se permite como máximo UNA librería complementaria de componentes de UI, además de las de
  apoyo listadas en `docs/design-system.md`. Toda dependencia nueva se justifica antes de
  agregarse.
- Justificación: la claridad para el personal del taller pesa más que los efectos visuales,
  y una UI genérica o recargada resta credibilidad al sistema.

## Tecnologías y dependencias

- Núcleo permitido: Flutter/Dart, Node.js, Express, MySQL (local en el MVP), JWT, bcrypt,
  Jest.
- Frontend: Material Design 3 con tema propio y Provider para el estado. Librerías de apoyo
  permitidas: `google_fonts`, `fl_chart`, `data_table_2` y un único set de íconos.
- Integración externa: Mercado Pago (modo sandbox/pruebas en etapas tempranas).
- Se priorizan alternativas gratuitas o de bajo costo cuando sean suficientes.
- NO se agregan librerías para lo que se pueda resolver con pocas líneas de código.
- Toda dependencia nueva DEBE justificarse antes de agregarse.

## Flujo de desarrollo

- Para implementar un sprint, el agente DEBE: leer el contexto completo, revisar el estado
  del repositorio, identificar qué historias ya existen, proponer un plan e implementar
  únicamente el alcance acordado.
- Si una decisión técnica no está definida, el agente DEBE proponer opciones antes de asumir
  una solución irreversible.
- Una historia está terminada cuando: la funcionalidad está implementada, frontend y backend
  están integrados, los datos se guardan y consultan bien, se validan entradas y permisos,
  se manejan errores previsibles, no se rompen flujos existentes, se hizo una prueba
  funcional, no hay secretos en el código y la documentación se actualizó si hubo una
  decisión relevante.
- Al terminar, el agente DEBE reportar: archivos modificados, historias cubiertas, pruebas
  realizadas, pendientes y riesgos o decisiones abiertas.
- Cada sprint DEBE terminar con seeds que permitan ver su funcionalidad con datos reales en
  la interfaz, sin capturarlos a mano.
- Ramas: una por funcionalidad con el formato `NNN-<nombre-en-minusculas>` (por ejemplo
  `001-base-clientes-vehiculos`), alineado con Spec Kit; para correcciones puntuales,
  `fix-<nombre>`. NO se trabaja directamente sobre `main`. Excepción: el reporte académico
  de SDD con Spec Kit se desarrolla en la rama única `sdd-speckit`, sin squash ni force-push.
- Commits: Conventional Commits con tipo y alcance en inglés y descripción en español;
  pequeños, enfocados, sin mezclar funcionalidades no relacionadas. NUNCA se suben secretos.
- La documentación, los comentarios y los mensajes visibles al usuario DEBEN escribirse en
  español, conservando en inglés solo términos técnicos e identificadores (por ejemplo
  `ServiceOrder` o `currentMileage`).

## Decisiones pendientes

Estas decisiones aún no están tomadas; el agente puede proponer opciones, pero NO asumirlas
como definitivas:

- Servicio de hosting y proveedor de almacenamiento.
- Implementación concreta de PDF/tickets.
- Alcance exacto de Mercado Pago para la demostración.
- Librería complementaria de componentes de UI en Flutter (u ninguna) y set de íconos
  definitivo.
- Modo oscuro (por ahora solo tema claro en el MVP) y logotipo e identidad visual.

Decisiones ya resueltas (acceso a datos con `mysql2` sin ORM, migraciones SQL numeradas,
MySQL nativo, validación con `zod`, `bcryptjs`, Jest + supertest, estructura del backend sin
`src/`) se registran en `docs/project-context.md`, sección 27.

## Gobernanza

- Esta constitución tiene prioridad sobre cualquier otra práctica o convención del
  repositorio.
- Las enmiendas DEBEN aprobarse por el equipo, coordinadas por el director del proyecto
  (Jorge Francisco Domínguez Ramírez), y documentarse actualizando la versión (SemVer), la
  fecha de última enmienda y el reporte de impacto del encabezado.
- Versionado: MAJOR para eliminar o redefinir principios; MINOR para añadir principios o
  secciones; PATCH para aclaraciones y correcciones de redacción.
- El cumplimiento se revisa en cada contribución; cualquier desviación DEBE justificarse
  explícitamente o descartarse.
- Guía de trabajo complementaria: `docs/guia-spec-kit.md` y `CLAUDE.md`.

**Versión**: 1.0.0 | **Ratificada**: 2026-10-18 | **Última enmienda**: 2026-10-18
