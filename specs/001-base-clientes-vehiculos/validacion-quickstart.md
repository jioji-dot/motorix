# Validación de extremo a extremo: Sprint 1

Resultado de ejecutar los escenarios de [quickstart.md](quickstart.md) contra la **API real en ejecución**, conectada a la base local `motorix_sdd` (MySQL 8.0, puerto 3307), con los datos de ejemplo cargados por `npm run seed`.

- **Fecha**: 2026-10-19
- **Método**: script que llama a la API con las cuentas iniciales (las contraseñas se leen del `.env` local y no se imprimen) y comprueba el código HTTP y el contenido de cada respuesta.
- **Limpieza**: los datos temporales creados por la validación (prefijo `QS`) se eliminaron al terminar; la base quedó con los datos de ejemplo (3 usuarios, 6 clientes, 8 vehículos).

## Resultados

| # | Escenario | Resultado | Detalle |
|---|-----------|-----------|---------|
| 1 | Inicio con usuario (recepcion) | CORRECTO | HTTP 200, rol RECEPTIONIST |
| 2 | Inicio con correo en el mismo campo | CORRECTO | HTTP 200 |
| 3 | Credenciales incorrectas → mensaje genérico | CORRECTO | HTTP 401: "Usuario o contraseña incorrectos." |
| 4 | 5 intentos fallidos → cuenta bloqueada 15 min | CORRECTO | 6.º intento: HTTP 423, retryAfterSeconds=900 |
| 5 | Flujo: cliente → vehículo → asociar → consultar | CORRECTO | cliente 201, vehículo 201, el detalle lista 1 vehículo |
| 6 | Vehículo sin propietario → rechazo | CORRECTO | HTTP 400: "El propietario es obligatorio." |
| 7 | Placas duplicadas → rechazo con mensaje claro | CORRECTO | HTTP 409: "Ya existe un vehículo con esas placas." |
| 8 | Teléfono repetido → aviso y confirmación | CORRECTO | sin confirmar: HTTP 409; confirmado: HTTP 201 |
| 9 | Mecánico no escribe (403) pero sí consulta (200) | CORRECTO | POST: HTTP 403; GET: HTTP 200 |
| 10 | Crear mecánico, desactivarlo y cortar su acceso al instante | CORRECTO | alta 201, entra 200; tras desactivar: su token HTTP 403, nuevo login HTTP 403 |
| 11 | No se puede desactivar al único administrador | CORRECTO | HTTP 409: LAST_ADMIN |
| 12 | Cambio de contraseña: solo si cumple la política | CORRECTO | débil HTTP 400; válida HTTP 204; la anterior HTTP 401; la nueva HTTP 200 |
| 13 | Cierre de sesión con confirmación | CORRECTO | Es una acción de la interfaz (no hay endpoint); la cubre la prueba de widgets `login_screen_test.dart` |
| S1 | Sin token → 401 y errores sin trazas internas | CORRECTO | GET /clients sin token: HTTP 401; ruta inexistente: HTTP 404 |

**Total: 14/14 correctos.**

## Qué no cubre esta validación

- Las pantallas de Flutter se verificaron con pruebas de widgets (`flutter test`, incluida una prueba de diseño adaptable a distintos anchos), **no** con una revisión visual manual en una ventana real.
- No se ejecutó la aplicación Flutter conectada a esta API en un navegador o en Windows de escritorio.

## Actualización posterior (19-oct-2026)

Después de esta validación ejecuté la aplicación Flutter en Chrome (http://localhost:8080) conectada a la API real y tomé capturas de los flujos principales, guardadas en `docs/evidencias/captura-*.png`. Esto reemplaza lo dicho arriba sobre no haber ejecutado la aplicación; sigue sin hacerse una prueba con personas ni en otros navegadores.
