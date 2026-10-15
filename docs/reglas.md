<!--
Reporte de Impacto de la Sincronización
- Cambio de versión: (sin versionar) → 1.0.0
- Principios modificados: todos nuevos (contenido inicial derivado de MOTORIX_PROJECT_CONTEXT.md)
- Secciones añadidas: "Tecnologías y Dependencias", "Flujo de Desarrollo", "Decisiones Pendientes", "Gobernanza"
- Ajuste previo a la ratificación (2026-10-05): la base de datos del MVP pasa de MongoDB/Mongoose
  a MySQL local, con esquema en la carpeta `database/`. Se actualizan los principios II y III,
  "Tecnologías y Dependencias" y "Decisiones Pendientes". La versión se mantiene en 1.0.0 porque
  la constitución aún no ha sido ratificada.
- Ajuste previo a la ratificación (2026-10-06): se precisa como NO NEGOCIABLE en el Principio III
  que el código JavaScript del backend usa ES Modules (`import`/`export`) y no CommonJS
  (`require`/`module.exports`); `package.json` del backend DEBE declarar `"type": "module"`.
  Se refleja también en "Tecnologías y Dependencias" y se anota en "Decisiones Pendientes" que
  la elección de driver/ORM debe ser compatible con ESM. La versión se mantiene en 1.0.0 porque
  la constitución aún no ha sido ratificada.
- Ajuste previo a la ratificación (2026-10-08): se añade el sistema de diseño de UI en
  `docs/design-system.md` como documento complementario. El Principio VIII incorpora la
  regla de que toda pantalla debe seguir ese documento. No cambia el alcance ni el stack;
  la versión se mantiene en 1.0.0 porque la constitución aún no ha sido ratificada.
- Ajuste previo a la ratificación (2026-10-10): se alinea el Principio III con el login
  por usuario o correo; el Principio VII con Jest + supertest y base `motorix_test`; el
  formato de ramas a `NNN-<nombre-en-minusculas>`; y se depura "Decisiones Pendientes"
  moviendo las resueltas a una subsección. La versión se mantiene en 1.0.0 porque la
  constitución aún no ha sido ratificada.
- Secciones eliminadas: ninguna
- Pendientes: ratificación por el equipo; decisiones listadas en "Decisiones Pendientes"
-->

# Constitución de Motorix

Motorix es el Sistema de Gestión para Taller Mecánico: un proyecto académico cuyo MVP
se construye en cuatro sprints. El detalle de requisitos, módulos, entidades, reglas de
negocio y sprints vive en `docs/project-context.md` (MOTORIX_PROJECT_CONTEXT.md), que es
la fuente de verdad del alcance. Esta constitución define las reglas que NO se rompen al
desarrollarlo, tanto por el equipo como por el agente de IA.

## Principios Fundamentales

### I. Alcance, MVP y Fuente de Verdad (NO NEGOCIABLE)

- El agente DEBE leer `docs/project-context.md` antes de implementar cualquier sprint.
- NO se permite agregar funcionalidades fuera del alcance sin indicarlo y obtener
  aprobación del equipo.
- El desarrollo DEBE seguir los sprints en orden (1 → 4); NO se implementa todo el
  sistema de una sola vez. No iniciar por Mercado Pago, dashboard o tickets.
- El chatbot de WhatsApp está FUERA del MVP; solo puede tratarse como integración
  externa futura.
- DEBE mantenerse la trazabilidad: requisito de alto nivel → historia de usuario →
  sprint → implementación.
- Si cambia una regla de negocio, rol, entidad, requisito o sprint, DEBE actualizarse
  `docs/project-context.md` para que el código y la planeación no se contradigan.
- Justificación: el objetivo es un MVP funcional y demostrable de extremo a extremo antes
  de incorporar funciones adicionales.

### II. Arquitectura con Responsabilidades Separadas (NO NEGOCIABLE)

- El proyecto DEBE separar frontend (`client/`), backend (`server/`), persistencia
  (`database/`) e integraciones externas.
- El backend DEBE organizarse en `config/`, `controllers/`, `models/`, `routes/`,
  `services/`, `middlewares/`, `validators/` y `utils/`.
- La lógica de negocio DEBE vivir en `services/`, NUNCA en controladores ni en widgets.
- La lógica de integración con Mercado Pago DEBE mantenerse aislada del dominio
  principal.
- La estructura puede ajustarse solo ante una necesidad técnica real, conservando una
  separación equivalente de responsabilidades.
- Justificación: separar capas permite que cada módulo se pruebe, cambie y revise sin
  romper los demás.

### III. Stack Tecnológico y Base de Datos Local del MVP

- Los seeds DEBEN incluir datos de ejemplo suficientes para que la aplicacion 
  muestre informacion al arrancar. La base no puede quedar vacia tras la instalacion inicial.
- Frontend: Flutter con Dart, interfaz responsiva y consumo de API REST.
- Backend: Node.js (versión LTS) con Express y JavaScript.
- **Sistema de módulos del backend (NO NEGOCIABLE):** todo el código JavaScript del
  backend DEBE usar ES Modules (`import`/`export`). NO se usa CommonJS
  (`require`/`module.exports`). `package.json` del backend DEBE declarar
  `"type": "module"`.
- Base de datos: MySQL, ejecutada de forma LOCAL durante los cuatro sprints del MVP.
- Autenticación: JWT con contraseñas cifradas mediante bcrypt.
- Login: acepta usuario (`username`) o correo electrónico (`email`) en el mismo campo, para todos los roles.
- NO se introducen tecnologías o dependencias grandes sin justificar su necesidad.
- Cada integrante DEBE usar su propia instancia local de MySQL; NO se usa base de datos en
  la nube ni hosting de base de datos dentro del MVP.
- El esquema y los datos iniciales DEBEN definirse con scripts SQL versionados en la carpeta
  `database/` (`migrations/`, `seeds/`, `scripts/` y un `README.md`), de modo que la base
  pueda recrearse desde cero. Los cambios de esquema se agregan como nuevos scripts
  numerados; NO se editan scripts de sprints ya aplicados.
- Los archivos físicos de datos de MySQL NO se versionan; si se usa un directorio de datos
  dentro del proyecto (por ejemplo `database/data/`), DEBE estar en `.gitignore`.
- La conexión DEBE configurarse solo con variables de entorno (`DB_HOST`, `DB_PORT`,
  `DB_USER`, `DB_PASSWORD`, `DB_NAME`) y la aplicación DEBE usar un usuario de MySQL
  dedicado al proyecto, NUNCA `root`. `.env.example` incluye las variables sin secretos.
- Se DEBE usar InnoDB, llaves foráneas para mantener la integridad referencial y
  codificación `utf8mb4`.
- Solo el backend accede a la base de datos; el frontend NUNCA se conecta directamente.
- Justificación: un conjunto de tecnologías acotado y conocido por el equipo reduce
  riesgos en un proyecto con tiempo limitado.

### IV. Seguridad (NO NEGOCIABLE)

- Las contraseñas NUNCA se almacenan en texto plano.
- Los secretos y credenciales DEBEN manejarse con variables de entorno; `.env` DEBE estar
  en `.gitignore` y DEBE existir un `.env.example` sin secretos.
- NO se almacenan datos de tarjeta ni credenciales sensibles de Mercado Pago.
- Los permisos por rol DEBEN validarse en el backend; ocultar botones en el frontend no
  es seguridad suficiente.
- Las entradas DEBEN validarse y sanitizarse en el backend, sin confiar solo en el
  frontend.
- NUNCA se exponen trazas internas ni trazas de pila (stack traces) al usuario final.
- Justificación: el sistema maneja datos de clientes y pagos; una falla de seguridad
  invalida el proyecto.

### V. Integridad de las Reglas de Negocio (NO NEGOCIABLE)

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

### VI. API Consistente y Manejo de Errores

- Las rutas DEBEN ser coherentes, con respuestas JSON consistentes y códigos HTTP
  apropiados.
- DEBE existir middleware de autenticación y de autorización, y validación de payloads
  (cuerpos de las peticiones).
- El manejo de errores DEBE estar centralizado y devolver mensajes claros y accionables.
- Justificación: una API predecible facilita la integración entre frontend y backend.

### VII. Pruebas

- El backend DEBE probarse con Jest (unitarias) y con Jest + supertest (integración y 
  contrato); el frontend con las pruebas propias de Flutter.
- Las pruebas de integración del backend DEBEN ejecutarse contra una base de datos 
  de prueba (`motorix_test`), nunca contra la base principal.
- Toda lógica de negocio (transiciones de estado de órdenes, stock, mantenimientos,
  permisos) DEBE tener pruebas.
- NO se marca una historia como terminada solo porque existe la interfaz: DEBE funcionar
  de extremo a extremo cuando requiera persistencia o lógica de backend.
- Justificación: las reglas de inventario y de estados son propensas a regresiones
  silenciosas.

### VIII. UX/UI Profesional y Sencilla (NO NEGOCIABLE)

- La interfaz DEBE ser profesional, minimalista, consistente y fácil de usar por
  personal no técnico, con prioridad en escritorio.
- Toda pantalla, componente y decisión visual DEBE seguir el sistema de diseño definido
  en `docs/design-system.md`. Si una decisión de ese documento cambia, actualizarlo
  antes de modificar la interfaz.
- Base de UI: Flutter con Material Design 3 (`useMaterial3: true`) y un `ThemeData`
  propio. NO se usa el tema por defecto de Material.
- Convención de colores (según `docs/design-system.md`): verde para correcto o
  completado, ámbar para advertencia o próximo, rojo para error, vencido o stock
  crítico. La paleta de marca es sobria y sin degradados. Nada decorativo.
- Todos los colores, tipografía, espaciados y radios DEBEN venir de los tokens del
  sistema de diseño; NO se escriben valores sueltos en las pantallas.
- Las operaciones destructivas DEBEN pedir confirmación y las acciones DEBEN mostrar
  mensajes de éxito o error.
- Se permite como máximo **una** librería complementaria de componentes de UI, además
  de las de apoyo listadas en `docs/design-system.md`. Toda dependencia nueva se
  justifica antes de agregarse.
- Justificación: la claridad para el personal del taller pesa más que los efectos
  visuales, y una UI genérica o recargada resta credibilidad al sistema.

## Tecnologías y Dependencias

- Núcleo permitido: Flutter/Dart, Node.js, Express, MySQL (local en el MVP), JWT, bcrypt, Jest.
- Sistema de módulos del backend (NO NEGOCIABLE): ES Modules (`import`/`export`), nunca
  CommonJS. `package.json` del backend DEBE declarar `"type": "module"`.
- Frontend: Material Design 3 con tema propio (`docs/design-system.md`) y Provider para
  estado. Librerías de apoyo permitidas: `google_fonts`, `fl_chart`, `data_table_2` y un
  único set de íconos.
- Sistema de diseño: ver `docs/design-system.md`. Es de cumplimiento obligatorio para
  cualquier pantalla del frontend.
- Integración externa: Mercado Pago (modo sandbox/pruebas en etapas tempranas).
- Priorizar alternativas gratuitas o de bajo costo cuando sean suficientes.
- NO agregar librerías para lo que se pueda resolver con pocas líneas de código.
- Toda dependencia nueva DEBE justificarse antes de agregarse.

## Flujo de Desarrollo

- Para implementar un sprint, el agente DEBE: leer el contexto completo, revisar el
  estado del repositorio, identificar qué historias ya existen, proponer un plan e
  implementar únicamente el alcance acordado.
- Si una decisión técnica no está definida, DEBE proponer opciones antes de asumir una
  solución irreversible.
- Una historia está terminada cuando: la funcionalidad está implementada, frontend y
  backend están integrados, los datos se guardan y consultan bien, se validan entradas y
  permisos, se manejan errores previsibles, no se rompen flujos existentes, se hizo una
  prueba funcional, no hay secretos en el código y la documentación se actualizó si
  hubo una decisión relevante.
- Al terminar, el agente DEBE reportar: archivos modificados, historias cubiertas,
  pruebas realizadas, pendientes y riesgos o decisiones abiertas.
- Ramas: una por funcionalidad con el formato `NNN-<nombre-en-minusculas>` (por ejemplo
  `001-base-clientes-vehiculos`), alineado con Spec Kit. Para correcciones puntuales:
  `fix-<nombre>`. NO se trabaja directamente sobre `main`.
- Commits: pequeños, enfocados y escritos en español; NO se mezclan funcionalidades no
  relacionadas en un mismo cambio. NUNCA se suben secretos.
- La documentación, los comentarios y los mensajes de commit DEBEN escribirse en español,
  conservando en inglés solo términos técnicos e identificadores (entidades y campos
  como `ServiceOrder` o `currentMileage`).
- Cada sprint DEBE terminar con seeds que permitan ver la funcionalidad del sprint 
  con datos reales en la interfaz, sin capturarlos a mano.

## Decisiones Pendientes

Estas decisiones aún no están tomadas; el agente puede proponer opciones, pero NO
asumirlas como definitivas:

- Servicio de hosting y proveedor de almacenamiento.
- Implementación concreta de PDF/tickets.
- Alcance exacto de Mercado Pago para la demostración.
- Librería complementaria de componentes de UI en Flutter (`shadcn_ui` u otra, o ninguna).
- Set de íconos definitivo del frontend.
- Modo oscuro (por ahora solo tema claro en el MVP).
- Logotipo e identidad visual de Motorix.

### Decisiones resueltas durante el Sprint 1

- **Frontend**: Flutter + Dart con Provider para estado. Se descartó React porque el
  stack del MVP ya fijaba Flutter.
- **Manejo de estado y validación**: Provider y validación de formularios en Flutter.
- **Acceso a datos desde Node.js**: driver `mysql2` directo, sin ORM ni query builder.
- **MySQL local**: instalación nativa, no Docker.
- **Herramienta de migraciones**: scripts SQL numerados e inmutables en
  `database/migrations/`, ejecutados por scripts idempotentes con registro en
  `schema_migrations`.
- **Pruebas automatizadas**: Jest + supertest en backend (unit, integración y contrato
  contra `motorix_test`); `flutter test` en frontend.
- **Ramas y commits**: `NNN-<nombre-en-minusculas>` por feature y Conventional Commits
  con la descripción en español.
- **Login**: acepta usuario o correo electrónico en el mismo campo, para todos los roles.
- **Estructura del backend**: sin carpeta `src/` intermedia; las capas (`config`,
  `models`, `services`, `controllers`, `routes`, `middlewares`, `validators`, `utils`)
  viven directamente en `server/`.

## Gobernanza

- Esta constitución tiene prioridad sobre cualquier otra práctica o convención del repo.
- Las enmiendas DEBEN aprobarse por el equipo, coordinadas por el director del proyecto
  (Jorge Francisco Domínguez Ramírez), y documentarse actualizando la versión (SemVer),
  la fecha de última enmienda y el reporte de impacto del encabezado.
- Versionado: MAJOR para eliminar o redefinir principios; MINOR para añadir principios
  o secciones; PATCH para aclaraciones y correcciones de redacción.
- El cumplimiento se revisa en cada contribución; cualquier desviación DEBE justificarse
  explícitamente o descartarse.

**Versión**: 1.0.0 | **Redactada**: 2026-10-01 | **Ratificación**: pendiente del equipo | **Última enmienda**: 2026-10-10