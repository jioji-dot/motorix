// Punto de arranque del servidor.
import { env } from './config/env.js';
import { app } from './app.js';

app.listen(env.port, () => {
  console.log(`API de Motorix escuchando en el puerto ${env.port}`);
});
