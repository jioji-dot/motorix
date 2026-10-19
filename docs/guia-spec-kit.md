# Guia de trabajo - Motorix con Spec Kit y CLAUDE

> Como construir el MVP de Motorix sprint por sprint usando Spec Kit y CLAUDE en VSCode.

---

## 0. Requisitos previos (una sola vez)

- Proyecto inicializado con Spec Kit y agente CLAUDE:

      uvx --from git+https://github.com/github/spec-kit.git specify init motorix

- Archivos base en el repo:
  - `docs/project-context.md` - alcance maestro (fuente de verdad).
  - `docs/reglas.md` - constitucion de Motorix.
  - `AGENTS.md` - idioma y convenciones.
  - `docs/sprints/sprint-N-*.md` - insumos por sprint.

---

## 1. Ratificar la constitucion (una sola vez)

En CLAUDE:

    /speckit.constitution Usa las reglas definidas en @docs/reglas.md

Esto genera/actualiza la constitucion en `.specify/memory/constitution.md`.
A partir de aqui, toda spec, plan y tarea debe respetarla.

---

## 2. Ciclo por sprint (repetir 4 veces)

> Regla de oro: no se avanza al siguiente sprint hasta que el flujo
> end-to-end del sprint actual funcione y este probado.

### Sprint 1 - Base, clientes y vehiculos

    /speckit.specify Usa la descripcion de @docs/sprints/sprint-1-base-clientes-vehiculos.md
    /speckit.clarify
    /speckit.plan
    /speckit.tasks
    /speckit.implement

Checklist Sprint 1 (antes de pasar al 2):
- [ ] Login funciona con JWT y bcrypt.
- [ ] Roles ADMIN / RECEPTIONIST / MECHANIC validados en backend.
- [ ] Registrar cliente -> registrar vehiculo -> asociarlo funciona end-to-end.
- [ ] Consultar cliente y su vehiculo devuelve datos reales de MySQL.
- [ ] Permisos por rol respetados en backend (no solo ocultos en UI).
- [ ] Pruebas backend (Jest) y frontend (Flutter) pasan.
- [ ] Sin secretos en el codigo; .env.example actualizado.

### Sprint 2 - Citas y ordenes de servicio

    /speckit.specify Usa la descripcion de @docs/sprints/sprint-2-citas-ordenes.md
    /speckit.clarify
    /speckit.plan
    /speckit.tasks
    /speckit.implement

Checklist Sprint 2:
- [ ] Registrar/consultar/modificar/cancelar cita.
- [ ] Crear orden de servicio asociada a cliente y vehiculo.
- [ ] Mecanico ve sus ordenes asignadas.
- [ ] Mecanico registra diagnostico, servicios y recomendaciones.
- [ ] Cambios de estado respetan RECIBIDO -> DIAGNOSTICO -> EN_REPARACION -> TERMINADO -> ENTREGADO (con ESPERANDO_REFACCION disponible).
- [ ] Kilometraje de entrada registrado y validado (no menor al previo sin correccion explicita).
- [ ] Pruebas pasan; sin secretos.

### Sprint 3 - Historial, mantenimiento e inventario

    /speckit.specify Usa la descripcion de @docs/sprints/sprint-3-historial-inventario.md
    /speckit.clarify
    /speckit.plan
    /speckit.tasks
    /speckit.implement

Checklist Sprint 3:
- [ ] Historial cronologico por vehiculo a partir de ordenes terminadas.
- [ ] Registro de proximo mantenimiento por fecha y/o kilometraje.
- [ ] Consulta de mantenimientos proximos y vencidos.
- [ ] Registrar refacciones y consultar stock.
- [ ] Agregar refaccion a una orden genera salida de inventario.
- [ ] No se permite stock negativo.
- [ ] Alertas de stock bajo visibles.
- [ ] Pruebas pasan; sin secretos.

### Sprint 4 - Pagos, tickets y dashboard

    /speckit.specify Usa la descripcion de @docs/sprints/sprint-4-pagos-tickets-dashboard.md
    /speckit.clarify
    /speckit.plan
    /speckit.tasks
    /speckit.implement

Checklist Sprint 4:
- [ ] Registrar pago asociado a una orden (efectivo, tarjeta, transferencia, Mercado Pago).
- [ ] Mercado Pago en sandbox; sin almacenar datos de tarjeta.
- [ ] Generar ticket con folio, cliente, vehiculo, servicios, refacciones, subtotal, total, metodo y estado del pago.
- [ ] Dashboard con datos reales (no duplicados solo para estadisticas).
- [ ] Pruebas pasan; sin secretos.

---

## 3. Comandos auxiliares (opcionales)

    /speckit.analyze        Verifica coherencia entre spec, plan y tasks.
    /speckit.checklist      Genera listas de verificacion adicionales.
    /speckit.converge       Consolida cuando hay varias specs en curso.

---

## 4. Resumen del flujo

| Fase | Cuando | Comando / accion |
|------|--------|------------------|
| Constitucion | Una vez | /speckit.constitution @docs/reglas.md |
| Spec | Inicio de cada sprint | /speckit.specify @docs/sprints/sprint-N-*.md |
| Aclaracion | Tras la spec | /speckit.clarify |
| Plan | Tras aclarar | /speckit.plan |
| Tareas | Tras planear | /speckit.tasks |
| Implementacion | Tras tareas | /speckit.implement |
| Verificacion | Cierre del sprint | Checklist del sprint correspondiente |

Regla: sprint por sprint, en orden. No se inicia Mercado Pago, dashboard ni tickets antes del Sprint 4.

---

## 5. Convenciones que no se negocian

- Todo en espanol (segun AGENTS.md): chat, docs de Spec Kit, comentarios, pruebas.
- Identificadores en ingles (ServiceOrder, currentMileage).
- Ramas: feature/<nombre-corto>; commits: Conventional Commits con descripcion en espanol.
- Secretos fuera del repo; .env.example sin valores reales.
- Backend en ES Modules (import/export), nunca CommonJS.
- MySQL local; esquema versionado en database/; solo el backend accede a la BD.
