// Reportes del administrador: se calculan al consultar, con importes en centavos enteros (Sprint 7, FR-009 a FR-015).
import * as modeloReportes from '../models/reportModel.js';
import { aCentavos, deCentavos } from '../utils/money.js';

export function createReportService({ reportModel = modeloReportes } = {}) {
  async function income(rango) {
    const filas = await reportModel.income(rango);
    const porMetodo = new Map();
    const porPeriodo = new Map();
    let total = 0;
    for (const f of filas) {
      const c = aCentavos(f.total);
      total += c;
      porMetodo.set(f.method, (porMetodo.get(f.method) ?? 0) + c);
      porPeriodo.set(f.period, (porPeriodo.get(f.period) ?? 0) + c);
    }
    return {
      total: deCentavos(total),
      byMethod: [...porMetodo].sort(([a], [b]) => a.localeCompare(b)).map(([method, c]) => ({ method, total: deCentavos(c) })),
      byPeriod: [...porPeriodo].sort(([a], [b]) => a.localeCompare(b)).map(([period, c]) => ({ period, total: deCentavos(c) })),
    };
  }

  async function services(rango) {
    const filas = await reportModel.services(rango);
    return { items: filas.map((f) => ({ name: f.name, typed: f.typed, count: f.count, amount: deCentavos(aCentavos(f.amount)) })) };
  }

  async function productivity(rango) {
    const filas = await reportModel.productivity(rango);
    return {
      items: filas.map((f) => ({ mechanic: { id: f.id, name: f.name }, orders: f.orders, laborAmount: deCentavos(aCentavos(f.labor)) })),
      totalOrders: filas.reduce((t, f) => t + f.orders, 0),
      totalLabor: deCentavos(filas.reduce((t, f) => t + aCentavos(f.labor), 0)),
    };
  }

  // Costo = precio de compra vigente por unidades; con precio de compra 0 la refacción es «sin costo» y no entra en los
  // totales de costo y margen (decisión D-05).
  async function parts(rango) {
    const filas = await reportModel.parts(rango);
    let totalSale = 0;
    let totalCost = 0;
    let totalMargin = 0;
    const items = filas.map((f) => {
      const sale = aCentavos(f.sale);
      totalSale += sale;
      const noCost = aCentavos(f.purchasePrice) === 0;
      const base = { part: { id: f.id, code: f.code, name: f.name }, units: f.units, sale: deCentavos(sale), noCost };
      if (noCost) return { ...base, cost: null, margin: null };
      const cost = aCentavos(f.purchasePrice) * f.units;
      totalCost += cost;
      totalMargin += sale - cost;
      return { ...base, cost: deCentavos(cost), margin: deCentavos(sale - cost) };
    });
    return { items, totalSale: deCentavos(totalSale), totalCost: deCentavos(totalCost), totalMargin: deCentavos(totalMargin) };
  }

  // Rotación = unidades salidas por órdenes en el rango entre la existencia actual (nula si no hay existencia).
  async function rotation(rango) {
    const filas = await reportModel.rotation(rango);
    return {
      items: filas.map((f) => ({
        part: { id: f.id, code: f.code, name: f.name },
        unitsOut: f.unitsOut,
        stock: f.stock,
        rotation: f.stock > 0 ? Math.round((f.unitsOut / f.stock) * 100) / 100 : null,
      })),
    };
  }

  return { income, services, productivity, parts, rotation };
}

export const reportService = createReportService();
