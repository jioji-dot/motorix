// Exportación de los reportes a CSV mediante un enlace firmado de 60 segundos (Sprint 7, FR-016).
// Igual que la impresión del ticket: el navegador no envía encabezados de sesión al abrir un enlace.
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { EXPORT_LINK_SECONDS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { toCsv } from '../utils/csv.js';
import { reportService as servicioReportes } from './reportService.js';

export function createReportExport({ reportService = servicioReportes, config = env } = {}) {
  // Clave distinta de la de sesión: un enlace de exportación no sirve como sesión y viceversa.
  const clave = `${config.jwt.secret}:report-export`;

  function createLink(nombre, { from, to, groupBy }) {
    const token = jwt.sign({ rep: nombre, from, to, groupBy }, clave, { expiresIn: EXPORT_LINK_SECONDS });
    return { url: `/api/reports/export/${token}`, expiresInSeconds: EXPORT_LINK_SECONDS };
  }

  const FILAS = {
    async income(rango) {
      const r = await reportService.income(rango);
      return {
        columnas: ['Tipo', 'Concepto', 'Importe'],
        filas: [
          ...r.byPeriod.map((p) => ['Periodo', p.period, p.total]),
          ...r.byMethod.map((m) => ['Método', m.method, m.total]),
          ['Total', '', r.total],
        ],
      };
    },
    async services(rango) {
      const r = await reportService.services(rango);
      return {
        columnas: ['Servicio', 'Del catálogo', 'Cantidad', 'Importe'],
        filas: r.items.map((i) => [i.name, i.typed ? 'Sí' : 'No', i.count, i.amount]),
      };
    },
    async productivity(rango) {
      const r = await reportService.productivity(rango);
      return {
        columnas: ['Mecánico', 'Órdenes', 'Mano de obra'],
        filas: [...r.items.map((i) => [i.mechanic.name, i.orders, i.laborAmount]), ['Total', r.totalOrders, r.totalLabor]],
      };
    },
    async parts(rango) {
      const r = await reportService.parts(rango);
      return {
        columnas: ['Código', 'Refacción', 'Unidades', 'Costo', 'Venta', 'Margen', 'Sin costo'],
        filas: [
          ...r.items.map((i) => [i.part.code, i.part.name, i.units, i.cost, i.sale, i.margin, i.noCost ? 'Sí' : 'No']),
          ['Total', '', '', r.totalCost, r.totalSale, r.totalMargin, ''],
        ],
      };
    },
    async rotation(rango) {
      const r = await reportService.rotation(rango);
      return {
        columnas: ['Código', 'Refacción', 'Unidades salidas', 'Existencia', 'Rotación'],
        filas: r.items.map((i) => [i.part.code, i.part.name, i.unitsOut, i.stock, i.rotation ?? 'Sin existencia']),
      };
    },
  };

  // Devuelve { filename, csv } del reporte al que da acceso un enlace válido.
  async function csvForToken(token) {
    let carga;
    try {
      carga = jwt.verify(token, clave);
    } catch {
      throw HttpError.unauthenticated('El enlace de descarga venció o no es válido. Genera uno nuevo desde Motorix.');
    }
    const generar = FILAS[carga.rep];
    if (!generar) throw HttpError.unauthenticated('El enlace de descarga no es válido.');
    const { columnas, filas } = await generar({ from: carga.from, to: carga.to, groupBy: carga.groupBy });
    return { filename: `reporte-${carga.rep}-${carga.from}-${carga.to}.csv`, csv: toCsv(columnas, filas) };
  }

  return { createLink, csvForToken };
}

export const reportExport = createReportExport();
