// Pruebas de integración de migraciones y seeds (US6) sobre la base `motorix_test`.
import request from 'supertest';
import { createApp } from '../../app.js';
import { openConnection, runMigrations } from '../../scripts/migrate.js';
import { runSeeds } from '../../scripts/seed.js';
import { cleanTables, closePool, pool } from '../helpers/testDb.js';

const app = createApp();
let conexion;

const contar = async (tabla) => {
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${tabla}`);
  return total;
};

beforeAll(async () => {
  conexion = await openConnection();
});

beforeEach(cleanTables);

afterAll(async () => {
  await conexion.end();
  await closePool();
});

describe('seeds de datos de ejemplo', () => {
  test('test_crea_tres_usuarios_ocho_clientes_y_doce_vehiculos', async () => {
    const resultado = await runSeeds(conexion);

    expect(resultado.usuariosCreados).toBe(3);
    expect(await contar('users')).toBe(3);
    expect(await contar('clients')).toBe(8);
    expect(await contar('vehicles')).toBe(12);
  });

  test('test_crea_un_usuario_por_rol_con_la_contrasena_cifrada', async () => {
    await runSeeds(conexion);

    const [usuarios] = await pool.query(
      'SELECT username, role, password_hash FROM users ORDER BY username'
    );

    expect(usuarios.map((u) => `${u.username}:${u.role}`)).toEqual([
      'admin:ADMIN',
      'mecanico:MECHANIC',
      'recepcion:RECEPTIONIST'
    ]);
    for (const usuario of usuarios) {
      expect(usuario.password_hash).toMatch(/^\$2[aby]\$/);
      for (const clave of [
        process.env.SEED_ADMIN_PASSWORD,
        process.env.SEED_RECEPTION_PASSWORD,
        process.env.SEED_MECHANIC_PASSWORD
      ]) {
        expect(usuario.password_hash).not.toContain(clave);
      }
    }
  });

  test('test_las_tres_cuentas_iniciales_pueden_iniciar_sesion_con_usuario_y_con_correo', async () => {
    await runSeeds(conexion);

    const casos = [
      ['admin', process.env.SEED_ADMIN_PASSWORD, 'ADMIN'],
      ['recepcion@motorix.local', process.env.SEED_RECEPTION_PASSWORD, 'RECEPTIONIST'],
      ['mecanico', process.env.SEED_MECHANIC_PASSWORD, 'MECHANIC']
    ];
    for (const [identifier, password, role] of casos) {
      const res = await request(app).post('/api/auth/login').send({ identifier, password });
      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe(role);
    }
  });

  test('test_la_aplicacion_muestra_informacion_sin_capturar_nada_a_mano', async () => {
    await runSeeds(conexion);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ identifier: 'recepcion', password: process.env.SEED_RECEPTION_PASSWORD });
    const auth = `Bearer ${login.body.data.token}`;

    const clientes = await request(app).get('/api/clients').set('Authorization', auth);
    const vehiculos = await request(app).get('/api/vehicles').set('Authorization', auth);

    expect(clientes.body.meta.total).toBe(8);
    expect(vehiculos.body.meta.total).toBe(12);
  });

  test('test_todos_los_vehiculos_de_ejemplo_tienen_propietario_y_hay_un_cliente_sin_vehiculos', async () => {
    await runSeeds(conexion);

    const [[{ sinPropietario }]] = await pool.query(
      `SELECT COUNT(*) AS sinPropietario FROM vehicles v
       LEFT JOIN clients c ON c.id = v.client_id WHERE c.id IS NULL`
    );
    const [porCliente] = await pool.query(
      `SELECT c.name, COUNT(v.id) AS vehiculos FROM clients c
       LEFT JOIN vehicles v ON v.client_id = c.id GROUP BY c.id`
    );

    expect(sinPropietario).toBe(0);
    expect(porCliente.some((c) => Number(c.vehiculos) === 0)).toBe(true);
    expect(porCliente.some((c) => Number(c.vehiculos) >= 2)).toBe(true);
  });

  test('test_cargar_los_seeds_varias_veces_deja_las_mismas_cantidades', async () => {
    await runSeeds(conexion);
    const segunda = await runSeeds(conexion);
    await runSeeds(conexion);

    expect(segunda.usuariosCreados).toBe(0);
    expect(await contar('users')).toBe(3);
    expect(await contar('clients')).toBe(8);
    expect(await contar('vehicles')).toBe(12);
  });

  test('test_no_sobrescribe_la_contrasena_cambiada_de_un_usuario_existente', async () => {
    await runSeeds(conexion);
    await pool.query("UPDATE users SET password_hash = 'hash-cambiado' WHERE username = 'admin'");

    await runSeeds(conexion);

    const [[fila]] = await pool.query("SELECT password_hash FROM users WHERE username = 'admin'");
    expect(fila.password_hash).toBe('hash-cambiado');
  });

  test('test_no_duplica_los_datos_si_un_cliente_de_ejemplo_ya_tiene_mas_vehiculos', async () => {
    await runSeeds(conexion);
    const [[cliente]] = await pool.query("SELECT id FROM clients WHERE name = 'Roberto Díaz Castillo'");
    await pool.query(
      `INSERT INTO vehicles (client_id, brand, model, year, license_plate) VALUES (?, 'Seat', 'Ibiza', 2020, 'EXT001X')`,
      [cliente.id]
    );

    await runSeeds(conexion);

    expect(await contar('vehicles')).toBe(13);
    expect(await contar('clients')).toBe(8);
  });

  test('test_falla_con_un_mensaje_claro_si_falta_una_contrasena_inicial', async () => {
    const original = process.env.SEED_ADMIN_PASSWORD;
    delete process.env.SEED_ADMIN_PASSWORD;
    try {
      await expect(runSeeds(conexion)).rejects.toThrow(/SEED_ADMIN_PASSWORD/);
      expect(await contar('users')).toBe(0);
    } finally {
      process.env.SEED_ADMIN_PASSWORD = original;
    }
  });
});

describe('migraciones', () => {
  test('test_volver_a_aplicar_las_migraciones_no_cambia_nada', async () => {
    const nuevas = await runMigrations(conexion);

    expect(nuevas).toEqual([]);
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM schema_migrations');
    expect(total).toBeGreaterThanOrEqual(1);
  });

  test('test_registra_cada_migracion_con_su_checksum_sha256', async () => {
    const [filas] = await pool.query('SELECT filename, checksum FROM schema_migrations');

    expect(filas.map((f) => f.filename)).toContain('001_sprint1_users_clients_vehicles.sql');
    for (const fila of filas) expect(fila.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  test('test_rechaza_una_migracion_ya_aplicada_que_fue_modificada', async () => {
    const [[original]] = await pool.query(
      "SELECT checksum FROM schema_migrations WHERE filename = '001_sprint1_users_clients_vehicles.sql'"
    );
    await pool.query(
      "UPDATE schema_migrations SET checksum = REPEAT('0', 64) WHERE filename = '001_sprint1_users_clients_vehicles.sql'"
    );
    try {
      await expect(runMigrations(conexion)).rejects.toThrow(/inmutables|modificada/);
    } finally {
      await pool.query(
        "UPDATE schema_migrations SET checksum = ? WHERE filename = '001_sprint1_users_clients_vehicles.sql'",
        [original.checksum]
      );
    }
  });

  test('test_el_esquema_usa_innodb_utf8mb4_y_llaves_foraneas', async () => {
    const [tablas] = await pool.query(
      `SELECT table_name AS nombre, engine AS motor, table_collation AS collation
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name IN ('users', 'clients', 'vehicles')`
    );
    const [llaves] = await pool.query(
      `SELECT constraint_name AS nombre, delete_rule AS regla
       FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE()`
    );

    expect(tablas).toHaveLength(3);
    for (const tabla of tablas) {
      expect(tabla.motor).toBe('InnoDB');
      expect(tabla.collation).toMatch(/^utf8mb4_/);
    }
    expect(llaves.find((l) => l.nombre === 'fk_vehicles_client').regla).toBe('RESTRICT');
  });
});
