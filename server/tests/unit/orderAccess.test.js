import { jest } from '@jest/globals';
import { createOrderService } from '../../services/orderService.js';
import { orderListQuerySchema } from '../../validators/orderValidator.js';

const FILTROS = { page: 1, pageSize: 20 };

function crearEntorno({ orden = null } = {}) {
  const orderModel = {
    list: jest.fn(async () => ({ items: [], total: 0 })),
    findDetail: jest.fn(async () => orden),
  };
  return { servicio: createOrderService({ orderModel }), orderModel };
}

describe('Validación de los filtros de órdenes', () => {
  test('acepta_estado_mecanico_y_rango_de_fechas_y_aplica_paginacion_por_defecto', () => {
    const q = orderListQuerySchema.parse({ status: 'EN_REPARACION', mechanicId: '4', from: '2030-01-01', to: '2030-01-31' });
    expect(q).toMatchObject({ status: 'EN_REPARACION', mechanicId: 4, page: 1, pageSize: 20 });
  });

  test('rechaza_estados_y_fechas_invalidos', () => {
    expect(orderListQuerySchema.safeParse({ status: 'OTRO' }).success).toBe(false);
    expect(orderListQuerySchema.safeParse({ from: '2030-13-01' }).success).toBe(false);
    expect(orderListQuerySchema.safeParse({ mechanicId: 'abc' }).success).toBe(false);
  });
});

describe('orderService.list', () => {
  test('el_mecanico_siempre_se_filtra_por_su_propio_id_aunque_envie_otro', async () => {
    const { servicio, orderModel } = crearEntorno();
    await servicio.list({ ...FILTROS, mechanicId: 99, search: 'x' }, { id: 3, role: 'MECHANIC' });
    expect(orderModel.list).toHaveBeenCalledWith(expect.objectContaining({ mechanicId: 3, search: 'x' }));
  });

  test('el_mecanico_sin_filtro_tambien_queda_limitado_a_sus_ordenes', async () => {
    const { servicio, orderModel } = crearEntorno();
    await servicio.list(FILTROS, { id: 3, role: 'MECHANIC' });
    expect(orderModel.list.mock.calls[0][0].mechanicId).toBe(3);
  });

  test.each(['RECEPTIONIST', 'ADMIN'])('el_rol_%s_ve_todas_y_puede_filtrar_por_mecanico', async (role) => {
    const { servicio, orderModel } = crearEntorno();
    await servicio.list(FILTROS, { id: 2, role });
    expect(orderModel.list.mock.calls[0][0].mechanicId).toBeUndefined();
    await servicio.list({ ...FILTROS, mechanicId: 7 }, { id: 2, role });
    expect(orderModel.list.mock.calls[1][0].mechanicId).toBe(7);
  });

  test('devuelve_la_paginacion_en_meta', async () => {
    const { servicio, orderModel } = crearEntorno();
    orderModel.list.mockResolvedValue({ items: [{ id: 1 }], total: 41 });
    const resultado = await servicio.list({ page: 2, pageSize: 20 }, { id: 2, role: 'ADMIN' });
    expect(resultado.meta).toEqual({ page: 2, pageSize: 20, total: 41 });
  });
});

describe('orderService.get', () => {
  const orden = { id: 9, mechanicId: 3, status: 'RECIBIDO', services: [], labor: [], history: [] };

  test('el_mecanico_asignado_ve_su_orden', async () => {
    const { servicio } = crearEntorno({ orden });
    const resultado = await servicio.get(9, { id: 3, role: 'MECHANIC' });
    expect(resultado.id).toBe(9);
    expect(Array.isArray(resultado.allowedTransitions)).toBe(true);
  });

  test('otro_mecanico_recibe_FORBIDDEN', async () => {
    const { servicio } = crearEntorno({ orden });
    await expect(servicio.get(9, { id: 4, role: 'MECHANIC' })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  test.each(['RECEPTIONIST', 'ADMIN'])('el_rol_%s_ve_cualquier_orden', async (role) => {
    const { servicio } = crearEntorno({ orden });
    await expect(servicio.get(9, { id: 2, role })).resolves.toMatchObject({ id: 9 });
  });

  test('devuelve_404_si_la_orden_no_existe', async () => {
    const { servicio } = crearEntorno({ orden: null });
    await expect(servicio.get(9, { id: 2, role: 'ADMIN' })).rejects.toMatchObject({ status: 404 });
  });
});
