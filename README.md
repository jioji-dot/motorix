# Motorix

Sistema de gestión para taller mecánico. Proyecto académico cuyo MVP se construye en cuatro sprints.
El alcance completo, las entidades y las reglas de negocio están en
[`docs/project-context.md`](docs/project-context.md); las reglas del proyecto, en la
[constitución](.specify/memory/constitution.md).

## Estado

**Sprint 1 — Base del sistema, clientes y vehículos**: inicio de sesión por usuario o correo con roles
(administrador, recepcionista y mecánico), gestión de usuarios, clientes y vehículos asociados a su
propietario, con datos de ejemplo para demostrar el flujo completo.

**Sprint 2 — Citas y órdenes de servicio**: recepción registra, modifica, confirma y cancela citas y crea
órdenes de servicio (con folio, kilometraje de entrada validado y mecánico asignado); el mecánico ve solo
sus órdenes, registra diagnóstico, servicios, mano de obra, observaciones y recomendaciones, y avanza el
estado `RECIBIDO → DIAGNOSTICO → EN_REPARACION → TERMINADO → ENTREGADO` (con `ESPERANDO_REFACCION` cuando
aplica). Las órdenes y citas nunca se eliminan y una orden entregada queda como historial.

**Sprint 3 — Historial, mantenimiento e inventario**: cualquier rol consulta el historial de servicios
de un vehículo (derivado de sus órdenes terminadas o entregadas, con el kilometraje de servicio); el mecánico
agrega las refacciones usadas a su orden (cada una genera una salida de inventario y nunca deja la existencia en
negativo) y programa el próximo mantenimiento por fecha, por kilometraje o por ambos; recepción consulta los
mantenimientos próximos y vencidos con el teléfono del cliente para avisarle; y el administrador mantiene el
catálogo de refacciones, registra entradas y ajustes, consulta los movimientos y ve las alertas de stock bajo
(una insignia junto a "Inventario" y un aviso en la pantalla). Los umbrales de aviso (30 días y 1 000 km) se
configuran en la base de datos (ver [`database/README.md`](database/README.md)).

**Sprint 4 — Pagos, tickets y panel de control**: recepción y administración registran los pagos de las
órdenes terminadas o entregadas en efectivo (con cambio), tarjeta o transferencia (con referencia opcional) y
con Mercado Pago (enlace de pago en modo de pruebas); admiten abonos, el saldo se recalcula siempre y un
cobro de Mercado Pago pendiente reserva su importe hasta que se actualice su estado, se cancele o se rechace.
Los pagos nunca se eliminan: solo administración puede anular un pago aprobado, con motivo. Cada orden
terminada o entregada genera un ticket de servicio (folio `TK-` + 6 dígitos) que se ve en pantalla y se
imprime o guarda como PDF. El administrador inicia en un panel de control con las órdenes por estado, las
citas, los mantenimientos vencidos y próximos, las alertas de inventario y lo cobrado. El mecánico no ve pagos,
tickets ni el panel. El sistema nunca pide ni guarda datos de tarjeta.

Flujo demostrable del Sprint 4: terminar la orden → registrar un abono → cobrar el resto con Mercado Pago →
actualizar el estado → generar e imprimir el ticket → entregar la orden → revisar el panel. La guía paso a paso
está en [`specs/004-pagos-tickets-dashboard/quickstart.md`](specs/004-pagos-tickets-dashboard/quickstart.md).

Flujo demostrable del Sprint 3: finalizar el servicio → conservarlo en el historial → registrar el próximo
mantenimiento → usar refacciones en la orden → actualizar el inventario → mostrar las alertas de stock. La guía
paso a paso está en [`specs/003-historial-inventario/quickstart.md`](specs/003-historial-inventario/quickstart.md).

Flujo demostrable del Sprint 2: registrar cita → recibir el vehículo → crear la orden → asignar al mecánico
→ diagnóstico → servicios → actualizar estado → terminar y entregar. La guía paso a paso está en
[`specs/002-citas-ordenes-servicio/quickstart.md`](specs/002-citas-ordenes-servicio/quickstart.md).

## Estructura del repositorio

```text
client/      Aplicación Flutter (Windows de escritorio)
server/      API REST en Node.js + Express (ES Modules)
database/    Migraciones, seeds y scripts de MySQL
docs/        Contexto del proyecto, sistema de diseño y contrato de la API (docs/api.md)
specs/       Especificación, plan y tareas de cada funcionalidad (Spec Kit)
```

## Requisitos

- Node.js LTS (22 o superior).
- MySQL 8 instalado de forma nativa.
- Flutter estable con soporte para Windows de escritorio.

## Instalación

1. **Base de datos**: crea las bases y el usuario dedicado siguiendo [`database/README.md`](database/README.md).
2. **Entorno**: copia `.env.example` a `.env` y completa los valores (nunca subas `.env`). Para las
   pruebas crea también `.env.test` con `DB_NAME=motorix_test`.
3. **Servidor**: desde `server/` ejecuta `npm install`.
4. **Esquema y datos de ejemplo**: desde `server/` ejecuta `npm run db:migrate` y `npm run db:seed`
   (o `npm run db:reset` para recrear todo desde cero).
5. **Cliente**: desde `client/` ejecuta `flutter pub get`.

## Ejecución

```text
# API (desde server/)
npm start                      # escucha en el puerto definido en PORT (3000 por defecto)

# Aplicación (desde client/)
flutter run -d windows
flutter run -d windows --dart-define=API_URL=http://localhost:3000/api   # otra URL de la API
```

### En el navegador (Chrome o Edge)

No requiere Visual Studio. Con la API corriendo (`npm start` en `server/`), desde `client/`:

```text
flutter run -d chrome --web-port 5000
flutter run -d edge --web-port 5000      # alternativa con Edge
```

La API permite por defecto cualquier origen `localhost` fuera de producción (CORS). Si usas otro puerto
o dominio, defínelo en `CORS_ORIGIN` dentro de `.env`. Si la API no está en `http://localhost:3000/api`,
agrega `--dart-define=API_URL=<url>`. Para una versión estática: `flutter build web` (genera `client/build/web`).

### Mercado Pago (opcional, modo de pruebas)

Los pagos en efectivo, tarjeta y transferencia no requieren configuración. Para cobrar con Mercado Pago:

1. Crea una aplicación en el panel de desarrolladores de Mercado Pago y copia el **token de acceso de las
   credenciales de PRUEBAS** (no uses credenciales de producción).
2. Defínelo en `.env` como `MP_ACCESS_TOKEN` (`MP_MODE=sandbox` usa el enlace de pruebas; `MP_API_URL` y
   `MP_TIMEOUT_MS` son opcionales). Reinicia la API. El token nunca se sube al repositorio ni aparece en las
   respuestas, los errores ni los registros.
3. Sin token, el cobro digital responde «Mercado Pago no está configurado» y no registra ningún pago; los demás
   métodos siguen funcionando.

Como el MVP corre en una máquina local sin dirección pública, el estado del cobro no llega por notificación:
tras pagar en la página de Mercado Pago, usa **Actualizar estado** en la tabla de pagos de la orden. Las
pruebas automáticas usan un servidor simulado y no necesitan credenciales.

Cuentas iniciales (usuario o correo y la contraseña definida en tu `.env`): `admin`, `recepcion` y
`mecanico`. Los valores del estándar del MVP están en `docs/project-context.md`.

## Pruebas

```text
# Backend (desde server/): unitarias, integración y contrato contra motorix_test
npm test

# Frontend (desde client/)
flutter test
flutter analyze
```

Las pruebas de integración y contrato nunca se ejecutan contra la base principal: el ejecutor se
niega a correr si `DB_NAME` no termina en `_test`.

## Documentación

- [Contrato de la API](docs/api.md)
- [Sistema de diseño de la interfaz](docs/design-system.md)
- [Base de datos](database/README.md)
- [Guía de validación del Sprint 1](specs/001-base-clientes-vehiculos/quickstart.md)
- [Guía de validación del Sprint 2](specs/002-citas-ordenes-servicio/quickstart.md)
- [Guía de validación del Sprint 3](specs/003-historial-inventario/quickstart.md)
- [Guía de validación del Sprint 4](specs/004-pagos-tickets-dashboard/quickstart.md)

## Convenciones

- Documentación, comentarios y mensajes al usuario en español; identificadores de código en inglés.
- Ramas `NNN-nombre-en-minusculas` (una por funcionalidad); no se trabaja directamente sobre `main`.
- Commits con Conventional Commits: `tipo(alcance): descripción en español`.
- Sin secretos en el repositorio.
