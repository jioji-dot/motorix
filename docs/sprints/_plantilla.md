<!--
Plantilla de insumo para /speckit.specify.
Copia este archivo como docs/sprints/sprint-N-<nombre-corto>.md y completalo.
NO lo pongas dentro de specs/ (esa carpeta la genera Spec Kit).
-->

# Insumo de especificacion - Sprint N: <Titulo del sprint>

> **Referencias obligatorias para el agente:**
> - Contexto maestro: `docs/project-context.md`
> - Constitucion: `docs/reglas.md` (y `.specify/memory/constitution.md` una vez ratificada)
> - Este documento describe unicamente el alcance de este sprint.

## 1. Contexto del sprint

<2-4 lineas explicando por que este sprint va aqui, que resuelve y con que sprints previos se relaciona.>

## 2. Objetivo

<Copiado o derivado de la seccion del sprint en project-context.md. Una sola idea clara.>

## 3. Historias de usuario del sprint

> Formato: "Como [rol], quiero [accion] para [beneficio]".

- **US1** - Como ..., quiero ..., para ...
- **US2** - Como ..., quiero ..., para ...
- **US3** - ...

## 4. Flujo demostrable al cierre del sprint

    Paso 1
    -> Paso 2
    -> Paso 3
    -> Resultado esperado

## 5. Entidades y tablas que toca este sprint

> Basado en la seccion 14.1 de `project-context.md`.

| Entidad / tabla | Accion en este sprint |
|-----------------|-----------------------|
| `users`         | crear / leer / ...    |
| ...             | ...                   |

## 6. Reglas de negocio aplicables

> Listar solo las reglas de la seccion 13 de `project-context.md` que aplican a este sprint, no todas.

- RN-...
- RN-...

## 7. Criterios de aceptacion

- [ ] CA-1 ...
- [ ] CA-2 ...
- [ ] CA-3 ...

## 8. Fuera de alcance de este sprint

> Explicitar para evitar que el agente se disperse.

- ...
- ...

## 9. Decisiones pendientes que deben resolverse en /speckit.clarify

> Cosas que NO deben asumirse sin confirmacion.

- ...
- ...

## 10. Restricciones tecnicas heredadas

- Backend en ES Modules, nunca CommonJS.
- Solo el backend accede a MySQL; el frontend nunca se conecta directo.
- Permisos validados en backend, no solo en UI.
- Sin secretos en el repositorio.
- Idioma: espanol en chat, docs, comentarios y pruebas.
- MySQL local, InnoDB, llaves foraneas, `utf8mb4`.
- Login acepta usuario o correo electronico en el mismo campo.
- Toda pantalla del frontend sigue `docs/design-system.md`.
- Pruebas de integracion contra `motorix_test`, nunca contra la base principal.
- Los seeds del sprint DEBEN incluir datos de ejemplo suficientes para que la aplicacion muestre informacion al arrancar. La base no puede quedar vacia tras la instalacion.
- Los seeds DEBEN ser idempotentes: si se corren de nuevo, no duplican registros.
