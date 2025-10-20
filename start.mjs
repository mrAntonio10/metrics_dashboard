// start.mjs: levanta el server Next standalone y luego carga el cron
// Nota: en .next/standalone, Next genera un server.js en la raíz copiada.
import './server.js';

// retrasa un tick para asegurar que el server exportó handlers
setImmediate(async () => {
  try {
    const mod = await import('./cron.js');
    if (mod?.default && typeof mod.default === 'function') {
      await mod.default(); // por si exportas una función de init opcional
    }
    console.log('[bootstrap] cron cargado.');
  } catch (err) {
    console.error('[bootstrap] error al cargar cron:', err);
  }
});

