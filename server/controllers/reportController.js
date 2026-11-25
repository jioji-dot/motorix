import { reportExport } from '../services/reportExport.js';
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

// Enlace de descarga de 60 segundos para un reporte.
export function exportLink(req, res) {
  res.json({ data: reportExport.createLink(req.valid.params.name, req.valid.query) });
}

// Descarga pública protegida por el enlace firmado.
export async function download(req, res) {
  const { filename, csv } = await reportExport.csvForToken(req.params.token);
  res
    .status(200)
    .set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' })
    .send(csv);
}
