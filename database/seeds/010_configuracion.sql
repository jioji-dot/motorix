-- Seed 010 (Sprint 7): configuración inicial, tipos de servicio con intervalos y la versión 1 de los términos y condiciones.
-- Los pagos, órdenes, refacciones y movimientos de los seeds anteriores alimentan los reportes.
-- Idempotente: cada fila se inserta solo si todavía no existe.
-- Requiere los seeds 004 y 008 (órdenes y pagos).
-- Los usuarios de ejemplo aceptan los términos en su siguiente ingreso (no se siembra ninguna aceptación).

-- 1. Configuración inicial: datos del taller del ticket y márgenes de «Próximo» -------------------------------------
INSERT INTO settings (settingKey, settingValue)
SELECT d.k, d.v
FROM (
  SELECT 'workshop.name' AS k, 'Motorix Taller Mecánico' AS v
  UNION ALL SELECT 'workshop.address', 'Av. Principal 123, Col. Centro'
  UNION ALL SELECT 'workshop.phone', '5512345678'
  UNION ALL SELECT 'maintenance.warnDays', '15'
  UNION ALL SELECT 'maintenance.warnKm', '500'
) AS d
WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.settingKey = d.k);

-- 2. Tipos de servicio con su intervalo en días y en kilómetros ---------------------------------------------------
INSERT INTO service_types (name, intervalDays, intervalKm)
SELECT d.name, d.days, d.km
FROM (
  SELECT 'Cambio de aceite' AS name, 180 AS days, 5000 AS km
  UNION ALL SELECT 'Frenos', 365, 20000
  UNION ALL SELECT 'Afinación', 365, 15000
  UNION ALL SELECT 'Cambio de batería', 730, NULL
  UNION ALL SELECT 'Diagnóstico general', 180, NULL
) AS d
WHERE NOT EXISTS (SELECT 1 FROM service_types t WHERE t.name = d.name);

-- 3. Algunas líneas de servicio de las órdenes de ejemplo enlazadas con su tipo (el resto queda sin tipo) -----------
UPDATE order_services s
JOIN service_types t ON t.name = 'Cambio de batería'
SET s.serviceTypeId = t.id
WHERE s.serviceTypeId IS NULL AND s.description = 'Batería nueva 12V';

UPDATE order_services s
JOIN service_types t ON t.name = 'Diagnóstico general'
SET s.serviceTypeId = t.id
WHERE s.serviceTypeId IS NULL AND s.description IN ('Diagnóstico de la fuga', 'Lectura y borrado de códigos');

-- 4. Versión 1 de los términos y condiciones y del aviso de privacidad (plantilla en español: el taller debe revisarla) --
INSERT INTO terms_versions (version, termsText, privacyText)
SELECT 1,
'TÉRMINOS Y CONDICIONES DE USO DE MOTORIX

1. Uso permitido. El sistema es una herramienta de trabajo del taller. Solo se debe usar para gestionar clientes, vehículos, citas, órdenes de servicio, mantenimientos, inventario y cobros del taller. Queda prohibido usarlo para fines personales, ajenos al taller o contrarios a la ley.

2. Confidencialidad. Los datos de los clientes y de sus vehículos (nombres, teléfonos, correos, placas e historial de servicios) son confidenciales. No se deben copiar, compartir ni divulgar fuera de las necesidades del trabajo.

3. Cuentas personales. Cada persona es responsable de su cuenta y de su contraseña. No debe compartirla ni dejar su sesión abierta sin atención. Toda acción realizada con una cuenta se atribuye a su titular y las acciones sensibles se registran en una bitácora.

4. Seguridad. La sesión se cierra por inactividad. Cualquier uso indebido o sospecha de acceso no autorizado debe avisarse de inmediato al administrador.

5. Cambios. El taller puede publicar nuevas versiones de estos términos; al ingresar se pedirá aceptar la versión vigente.

Este texto es una plantilla: el taller debe revisarlo con quien corresponda. No constituye asesoría legal.',
'AVISO DE PRIVACIDAD

Responsable. El taller que opera Motorix es responsable del tratamiento de los datos personales que se capturan en el sistema.

Datos que se tratan. Nombre, teléfono y correo de los clientes; datos y placas de sus vehículos; historial de servicios, órdenes, pagos y avisos hechos al cliente. El sistema no guarda números de tarjeta ni credenciales de pago.

Finalidad. Atender citas y órdenes de servicio, dar seguimiento a los mantenimientos, cobrar los servicios y recordar a los clientes sus próximos servicios. Los datos no se venden ni se usan para otros fines.

Protección. El acceso está limitado por roles, las contraseñas se guardan cifradas, las acciones sensibles se registran en una bitácora y las sesiones inactivas se cierran.

Derechos. Cada persona puede pedir al taller que consulte, corrija o elimine sus datos.

Este texto es una plantilla: el taller debe revisarlo con quien corresponda. No constituye asesoría legal.'
WHERE NOT EXISTS (SELECT 1 FROM terms_versions WHERE version = 1);
