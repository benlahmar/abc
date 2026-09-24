import type { Db } from './db/index.js';
import { runScheduledTransitions } from './admin/contents.js';

/** Vérifie toutes les 30 s les publications programmées et les expirations. */
export function startScheduler(db: Db, intervalMs = 30_000) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { published, archived } = await runScheduledTransitions(db);
      if (published || archived) console.log(`[planificateur] ${published} publié(s), ${archived} archivé(s)`);
    } catch (error) {
      console.error('[planificateur]', error);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
