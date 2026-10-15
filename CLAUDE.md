# Instrucciones del proyecto

## Idioma general

- Responde siempre en español, incluso si el prompt, el comando o la plantilla de Spec Kit está en inglés.
- Todo texto que generes para una persona debe estar en español: respuestas en el chat, explicaciones, preguntas de aclaración, resúmenes, listas de verificación y mensajes de error o advertencia.
- Usa español claro y neutro, con tildes y signos de apertura (¿ ¡) correctos.

## Spec Kit (documentos generados)

Aplica a todos los archivos que producen los comandos `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.analyze`, `/speckit.checklist` e `/speckit.implement`:

- Escribe en español todo el contenido de `constitution.md`, `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `tasks.md`, los checklists y los archivos dentro de `contracts/`.
- Traduce los títulos y encabezados de las plantillas. Ejemplos:
  - "User Scenarios & Testing" → "Escenarios de usuario y pruebas"
  - "Functional Requirements" → "Requisitos funcionales"
  - "Key Entities" → "Entidades clave"
  - "Success Criteria" → "Criterios de éxito"
  - "Edge Cases" → "Casos límite"
  - "Implementation Plan" → "Plan de implementación"
  - "Technical Context" → "Contexto técnico"
  - "Phase" → "Fase"
- Redacta las historias de usuario como "Como [rol], quiero [acción] para [beneficio]".
- Redacta los escenarios de aceptación con "Dado / Cuando / Entonces" en lugar de "Given / When / Then".
- Escribe en español las preguntas de `/speckit.clarify`, sus opciones de respuesta y las recomendaciones.
- No traduzcas estos marcadores estructurales, porque los comandos y scripts los buscan tal cual:
  - `[NEEDS CLARIFICATION]`, `[P]`, `[US1]`, `[US2]`, etc.
  - Los IDs como `FR-001`, `SC-001` y `T001`.
  - Los nombres de archivo y carpeta (`spec.md`, `plan.md`, `tasks.md`, `specs/`, `.specify/`).
- Los nombres de rama y carpetas de feature van en minúsculas, con guiones y sin tildes ni eñes (por ejemplo `001-gestion-de-tareas`).

## Código

- Escribe en español todos los comentarios, docstrings y mensajes que ve el usuario final (salida de la CLI, errores, ayuda de comandos).
- Mantén en inglés los identificadores del código: nombres de variables, funciones, clases, módulos, archivos de código, rutas y endpoints.
- Mantén en inglés los términos técnicos sin traducción establecida, como commit, branch, pull request, endpoint, middleware, framework, token y hash.
- Escribe el `README.md` y la documentación del proyecto en español.

## Commits

- Usa Conventional Commits: el tipo y el alcance en inglés, y la descripción en español.
- Formato: `tipo(alcance): descripción en español, en infinitivo y en minúsculas`.
- Tipos permitidos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
- Ejemplo: `feat(tasks): agregar comando para listar tareas pendientes`.
- Si el commit lleva cuerpo, escríbelo en español.

## Pruebas

- Escribe en español los nombres descriptivos de las pruebas, por ejemplo `test_agrega_tarea_con_titulo_valido`.
- Escribe en español los mensajes de las aserciones y los textos de los casos de prueba.