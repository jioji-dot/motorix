// Esquemas de validación de tickets.
import { z } from 'zod';
import { listQuery } from './common.js';

export const listTicketsQuery = z.object({ ...listQuery });
