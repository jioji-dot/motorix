import { reportService } from '../services/reportService.js';

// Un controlador por reporte: todos reciben el rango validado y devuelven `{ data }`.
const reporte = (nombre) => async (req, res) => {
  res.json({ data: await reportService[nombre](req.valid.query) });
};

export const income = reporte('income');
export const services = reporte('services');
export const productivity = reporte('productivity');
export const parts = reporte('parts');
export const rotation = reporte('rotation');
