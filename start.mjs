// start.mjs
import './server.js';
setImmediate(async () => {
  try {
    const mod = await import('./cron.mjs'); // usa cron.mjs
    if (mod?.default && typeof mod.default === 'function') {
      await mod.default();
    }
    console.log('[bootstrap] cron cargado.');
  } catch (err) {
    console.error('[bootstrap] error al cargar cron:', err);
  }
});
