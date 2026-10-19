import { jest } from '@jest/globals';
import { createOrderService } from '../../services/orderService.js';
import { updateOrderSchema } from '../../validators/orderValidator.js';

const MECANICO = { id: 3, role: 'MECHANIC' };
const OTRO = { id: 4, role: 'MECHANIC' };
const ADMIN = { id: 1, role: 'ADMIN' };
const RECEPCION = { id: 2, role: 'RECEPTIONIST' };

function crearEntorno(orden = {}) {
  const base = { id: 9, status: 'EN_REPARACION', mechanicId: 3, vehicleId: 5, entryMileage: 40000, ...orden };
  const orderModel = {
    lockOrder: jest.fn(async () => base),
    updateFields: jest.fn(async () => {}),
    findDetail: jest.fn(async () => ({ ...base })),
  };
  const vehicleModel = { raiseMileage: jest.fn(async () => {}) };
  const servicio = createOrderService({ orderModel, vehicleModel, transaction: async (trabajo) => trabajo({}) });
  return { servicio, orderModel, vehicleModel };
}

describe('Kilometraje del servicio', () => {
  test('el_esquema_acepta_enteros_de_0_a_1500000_y_rechaza_decimales_y_texto', () => {
    const con = (serviceMileage) => updateOrderSchema.safeParse({ serviceMileage });
    expect(con(40500).success).toBe(true);
    expect(con(1500000).success).toBe(true);
    expect(con(1500001).success).toBe(false);
    expect(con(-1).success).toBe(false);
    expect(con(100.5).success).toBe(false);
    expect(con('abc').success).toBe(false);
  });

  test('el_mecanico_asignado_lo_registra_y_sube_el_kilometraje_del_vehiculo', async () => {
    const { servicio, orderModel, vehicleModel } = crearEntorno();
    await servicio.update(9, { serviceMileage: 40800 }, MECANICO);
    expect(orderModel.updateFields).toHaveBeenCalled();
    expect(vehicleModel.raiseMileage).toHaveBeenCalledWith(5, 40800, {});
  });

  test('rechaza_un_kilometraje_menor_al_de_entrada_sin_modificar_nada', async () => {
    const { servicio, orderModel, vehicleModel } = crearEntorno();
    await expect(servicio.update(9, { serviceMileage: 39999 }, MECANICO)).rejects.toMatchObject({
      status: 400,
      details: [{ field: 'serviceMileage', message: expect.stringContaining('40000') }],
    });
    expect(orderModel.updateFields).not.toHaveBeenCalled();
    expect(vehicleModel.raiseMileage).not.toHaveBeenCalled();
  });

  test('acepta_un_kilometraje_igual_al_de_entrada', async () => {
    const { servicio } = crearEntorno();
    await expect(servicio.update(9, { serviceMileage: 40000 }, ADMIN)).resolves.toBeDefined();
  });

  test('otro_mecanico_y_recepcion_no_pueden_registrarlo', async () => {
    const { servicio } = crearEntorno();
    await expect(servicio.update(9, { serviceMileage: 41000 }, OTRO)).rejects.toMatchObject({ status: 403 });
    await expect(servicio.update(9, { serviceMileage: 41000 }, RECEPCION)).rejects.toMatchObject({ status: 403 });
  });

  test('solo_se_registra_con_la_orden_en_curso', async () => {
    const { servicio } = crearEntorno({ status: 'TERMINADO' });
    await expect(servicio.update(9, { serviceMileage: 41000 }, MECANICO)).rejects.toMatchObject({
      code: 'ORDER_NOT_EDITABLE',
    });
  });
});
