# Guía de validación rápida: Sprint 6

Guion para comprobar de extremo a extremo el centro de notificaciones y la lista de clientes por avisar. Los comandos de la API se ejecutan contra la API real; el detalle de cada ruta y de los errores está en [contracts/api.md](contracts/api.md) y el de las tablas en [data-model.md](data-model.md).

## Requisitos previos

- MySQL 8.0 local con las bases de desarrollo y de pruebas (`motorix_sdd` y `motorix_sdd_test` en este entorno) y el archivo `.env` creado (ver `database/README.md`).
- Migraciones 001 a 005 aplicadas y seeds cargados (`npm run seed`): `powershell -ExecutionPolicy Bypass -File database/scripts/aplicar-migraciones.ps1 -Puerto 3307 -Base motorix_sdd_test` y lo mismo con la base de desarrollo.
- Cuentas de ejemplo de administrador, recepción y mecánico (contraseñas en el `.env`, solo local).

## 1. Preparar y ejecutar

```powershell
cd server
npm install
npm start        # API en http://localhost:3000/api
```

En otra terminal: `cd client` y `flutter run -d chrome`.

## 2. Escenarios de validación

Usa una base de pruebas (`motorix_test`) para no gastar los datos de demostración, o restaura los seeds al terminar.

| # | Escenario | Resultado esperado |
|---|-----------|--------------------|
| 1 | Administrador consulta `GET /notifications` con los datos de ejemplo | Recibe un grupo de cada tipo (mantenimiento vencido y próximo, cita del día, stock bajo y agotado, orden detenida) con `unread` igual al total |
| 2 | Recepción consulta lo mismo | No recibe grupos de stock ni `stockAlerts`; recibe mantenimientos, citas y órdenes detenidas de todas las órdenes |
| 3 | Mecánico consulta lo mismo | Solo recibe el grupo `ORDER_STALLED` con las órdenes detenidas asignadas a él; ni citas, ni mantenimientos, ni stock |
| 4 | Marcar un aviso como leído y volver a consultar | `unread` baja en uno y el aviso trae `read: true`; otro usuario lo sigue viendo no leído; sigue leído tras iniciar sesión de nuevo |
| 5 | Atender el mantenimiento leído y volver a consultar | El aviso desaparece; una lectura de un aviso inexistente responde `200` con `read: false` |
| 6 | Un mantenimiento próximo leído pasa a vencido (cambia su fecha) | Aparece otro aviso (`MANT:id:VENCIDO`) como no leído |
| 7 | Editar una nota de una orden detenida sin cambiar su estado | La orden sigue como aviso (la antigüedad se mide por el último cambio de estado); al cambiar de estado, desaparece |
| 8 | Mecánico marca un aviso de stock como leído | `404 NOT_FOUND`; la lectura no se guarda |
| 9 | Recepción consulta `GET /client-notices` | Ve al cliente de la orden Terminada sin entregar con su teléfono, el vehículo y el motivo; la lista viene ordenada por fecha del hecho |
| 10 | Recepción marca avisado al cliente con la nota «no contestó» | `201`; sale de la lista y queda `noticedBy`, `noticedAt` y la nota; repetir la solicitud responde `200` con el mismo registro |
| 11 | Entregar la orden y luego marcarla avisada | `409 NOTICE_NOT_APPLICABLE` y no se registra nada |
| 12 | Mecánico consulta o marca en `/client-notices` | `403 FORBIDDEN` |
| 13 | Comparar las cifras con `GET /dashboard`, `GET /maintenance` y `GET /parts/summary` | Los totales de mantenimientos, citas de hoy y stock bajo o agotado coinciden con los del centro |
| 14 | Medir `GET /notifications` con los datos de ejemplo y con 500 mantenimientos pendientes, 500 refacciones y 500 órdenes abiertas | Menos de 1 segundo con los datos de ejemplo y menos de 3 segundos con el volumen grande |
| 15 | Cargar los seeds dos veces | No se duplica ningún registro |

## 3. Comprobaciones en la interfaz (las hace una persona)

- Como administrador: la campana muestra el número de avisos no leídos; el panel los agrupa por tipo; abrir un aviso lleva al detalle de la orden, de la cita o de la refacción, o a Mantenimientos con la placa escrita en el buscador; la insignia de Inventario coincide con las alertas de stock.
- Como recepción: la campana no muestra avisos de stock; la sección «Clientes por avisar» muestra su insignia y permite marcar a un cliente como avisado; el contador se actualiza solo en un minuto.
- Como mecánico: la campana solo muestra avisos de sus órdenes y no aparece la sección «Clientes por avisar».
- Cronometrar a recepción: abrir «Clientes por avisar», ubicar al cliente de una orden terminada con su teléfono y marcarlo avisado en menos de 1 minuto (SC-004).

## 4. Ejecutar las pruebas automatizadas

```powershell
cd server
npm test            # backend completo; línea base antes del sprint: 90 suites y 1332 pruebas
cd ../client
flutter test        # frontend completo; línea base antes del sprint: 256 pruebas
flutter analyze lib
```

Ninguna prueba de los Sprints 1 a 5 debe pasar de verde a rojo, salvo las que cambien por un contrato declarado, que se registran como hallazgo.
