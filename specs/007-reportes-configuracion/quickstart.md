# Guía de validación rápida: Sprint 7

Guion para comprobar de extremo a extremo la configuración, el catálogo, el ticket, los términos, la seguridad y los reportes. Los comandos de la API se ejecutan contra la API real; el detalle de cada ruta y de los errores está en [contracts/api.md](contracts/api.md) y el de las tablas en [data-model.md](data-model.md).

## Requisitos previos

- MySQL 8.0 local con las bases de desarrollo y de pruebas y el archivo `.env` creado (ver `database/README.md`).
- Migraciones 001 a 006 aplicadas y seeds cargados (`npm run seed`): `powershell -ExecutionPolicy Bypass -File database/scripts/aplicar-migraciones.ps1 -Puerto 3307 -Base motorix_sdd_test` y lo mismo con la base de desarrollo.
- Cuentas de ejemplo de administrador, recepción y mecánico (contraseñas en el `.env`, solo local).

## 1. Preparar y ejecutar

```powershell
cd server
npm install
npm start        # API en http://localhost:3000/api
```

En otra terminal: `cd client` y `flutter run -d chrome`.

## 2. Escenarios de validación

Usa la base de pruebas para no gastar los datos de demostración. Los usuarios sembrados deben aceptar los términos (escenario 9) antes de usar otras rutas.

| # | Escenario | Resultado esperado |
|---|-----------|--------------------|
| 1 | Administrador lee y cambia los datos del taller | `GET /settings` trae los valores de respaldo; `PUT /settings` guarda y responde lo nuevo; recepción y mecánico reciben `403` |
| 2 | Generar un ticket, cambiar los datos del taller y generar otro | El primer ticket conserva los datos con los que se generó; el segundo trae los nuevos |
| 3 | Cambiar `warnDays` de 15 a 30 | Un mantenimiento a 25 días pasa de Normal a Próximo en `/maintenance`, en `/dashboard` y en `/notifications`; un valor de 0 o de 400 responde `400` |
| 4 | Crear «Cambio de aceite» con 180 días y 5,000 km, repetir el nombre y desactivarlo | `201`; el repetido responde `409 SERVICE_TYPE_DUPLICATE`; desactivado no se ofrece a recepción pero sigue en las líneas que ya lo usan |
| 5 | Enlazar un servicio de una orden al tipo y pedir la propuesta del próximo mantenimiento | La fecha es hoy más 180 días y el kilometraje el de la orden más 5,000 |
| 6 | Generar el ticket de una orden con y sin tipo con intervalo | Con tipo, `nextService` trae el nombre, la fecha y el kilometraje; sin tipo es `null`; cambiar el catálogo no cambia el ticket ya generado |
| 7 | Consultar `/reports/income` de un mes con pagos | El total y el desglose coinciden con la suma de los pagos Pagados del rango; un rango de más de 366 días responde `400` |
| 8 | Consultar servicios, productividad, refacciones y rotación del mismo rango | Los totales coinciden con las órdenes, la mano de obra, las líneas de refacción y los movimientos de origen; la refacción con precio de compra 0 sale «sin costo» |
| 9 | Un usuario sembrado inicia sesión y llama a cualquier ruta | `403 TERMS_NOT_ACCEPTED`; `GET /terms/current` y `GET /auth/me` responden; tras `POST /terms/accept` ya puede usar el sistema |
| 10 | El administrador publica una versión nueva | Los demás usuarios reciben otra vez `403 TERMS_NOT_ACCEPTED` hasta aceptarla; `GET /terms/acceptances` lista quién aceptó y quién no |
| 11 | Cambiar el rol de un usuario, un precio de refacción y la configuración | `GET /audit-log` muestra quién, qué y cuándo; ninguna entrada contiene contraseñas, hashes ni tokens; recepción recibe `403` |
| 12 | Cinco inicios de sesión fallidos | La bitácora registra los fallos y el bloqueo con el identificador escrito, sin la contraseña |
| 13 | Dejar pasar 30 minutos sin actividad (se simula moviendo la marca en la base de pruebas) | `401 SESSION_INACTIVE`; con menos de 30 minutos la sesión sigue; el sondeo de `/notifications` no la mantiene viva |
| 14 | Revisar los encabezados de cualquier respuesta | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Cache-Control: no-store`; sin `X-Powered-By` |
| 15 | Pedir el enlace de exportación de ingresos y descargarlo | CSV con BOM y las mismas filas y totales que la pantalla; después de 60 segundos el enlace responde `401`; una descripción que empieza con `=` sale neutralizada |
| 16 | Buscar `' OR 1=1 --` en los listados de clientes, vehículos, órdenes y refacciones | Se trata como texto: sin errores ni filas de más |
| 17 | Cargar los seeds dos veces | No se duplica ningún registro y los reportes muestran información |
| 18 | Medir cada reporte con un año de datos | Menos de 3 segundos |

## 3. Comprobaciones en la interfaz (las hace una persona)

- Como administrador: la sección «Configuración» (datos del taller, márgenes, tipos de servicio, términos y bitácora) y la sección «Reportes» con filtro de fechas y botón Exportar; el ticket nuevo muestra el próximo servicio.
- Como cualquier usuario sembrado: al iniciar sesión aparece la pantalla de términos y aviso de privacidad; rechazar cierra la sesión y aceptar entra.
- Con 30 minutos sin tocar la aplicación: la sesión se cierra con el mensaje «Tu sesión se cerró por inactividad».
- Como recepción o mecánico: no aparecen «Configuración» ni «Reportes».

## 4. Ejecutar las pruebas automatizadas

```powershell
cd server
npm test            # backend completo; línea base antes del sprint: 106 suites y 1462 pruebas
cd ../client
flutter test        # frontend completo; línea base antes del sprint: 308 pruebas
flutter analyze lib
```

Ninguna prueba de los Sprints 1 a 6 debe pasar de verde a rojo, salvo las que cambien por un contrato declarado, que se registran como hallazgo.
