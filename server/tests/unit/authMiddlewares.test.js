import { jest } from '@jest/globals';
import { authorize } from '../../middlewares/authorize.js';
import { createAuthenticate } from '../../middlewares/authenticate.js';

function ejecutar(middleware, req) {
  return new Promise((resolve) => {
    middleware(req, {}, (error) => resolve(error));
  });
}

describe('middleware authorize', () => {
  test('test_permite_un_rol_incluido_en_la_lista', async () => {
    const error = await ejecutar(authorize('ADMIN', 'RECEPTIONIST'), { user: { role: 'RECEPTIONIST' } });
    expect(error).toBeUndefined();
  });

  test('test_rechaza_un_rol_no_permitido_con_403_forbidden', async () => {
    const error = await ejecutar(authorize('ADMIN'), { user: { role: 'MECHANIC' } });
    expect(error.status).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
  });

  test('test_rechaza_cuando_no_hay_usuario_autenticado', async () => {
    const error = await ejecutar(authorize('ADMIN'), {});
    expect(error.status).toBe(401);
    expect(error.code).toBe('UNAUTHENTICATED');
  });
});

describe('middleware authenticate', () => {
  const usuarioActivo = { id: 7, role: 'ADMIN', active: 1 };

  function crear({ usuario = usuarioActivo, payload = { sub: '7' }, falla = false } = {}) {
    return createAuthenticate({
      findUserById: jest.fn().mockResolvedValue(usuario),
      verifyToken: jest.fn(() => {
        if (falla) throw new Error('token inválido');
        return payload;
      })
    });
  }

  test('test_carga_el_usuario_de_la_base_en_la_peticion', async () => {
    const req = { headers: { authorization: 'Bearer token' } };
    const error = await ejecutar(crear(), req);
    expect(error).toBeUndefined();
    expect(req.user).toEqual(usuarioActivo);
  });

  test('test_rechaza_cuando_falta_la_cabecera_authorization', async () => {
    const error = await ejecutar(crear(), { headers: {} });
    expect(error.code).toBe('UNAUTHENTICATED');
  });

  test('test_rechaza_un_token_que_no_se_puede_verificar', async () => {
    const error = await ejecutar(crear({ falla: true }), { headers: { authorization: 'Bearer x' } });
    expect(error.code).toBe('UNAUTHENTICATED');
  });

  test('test_rechaza_a_un_usuario_desactivado_despues_de_emitir_el_token', async () => {
    const error = await ejecutar(crear({ usuario: { ...usuarioActivo, active: 0 } }), {
      headers: { authorization: 'Bearer token' }
    });
    expect(error.status).toBe(401);
    expect(error.code).toBe('UNAUTHENTICATED');
  });

  test('test_rechaza_a_un_usuario_que_ya_no_existe', async () => {
    const error = await ejecutar(crear({ usuario: null }), {
      headers: { authorization: 'Bearer token' }
    });
    expect(error.code).toBe('UNAUTHENTICATED');
  });
});
