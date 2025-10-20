// start.mjs
import './server.js';

setImmediate(async () => {
  try {
    // Importa el CJS de forma dinámica (ejecuta los side-effects)
    await import('./cron.js');
    console.log('[bootstrap] cron cargado.');
  } catch (err) {
    console.error('[bootstrap] error al cargar cron:', err);
  }
});
