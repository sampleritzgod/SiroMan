import { processDueReminders } from "../services/reminderService.js";

const INTERVAL_MS = 30_000;

/** Lightweight in-process reminder tick — inbox channel only (no push services). */
export function startReminderWorker() {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const delivered = await processDueReminders(40);
      if (delivered > 0) {
        console.log(`[reminders] delivered ${delivered} inbox notification(s)`);
      }
    } catch (error) {
      console.error("[reminders] worker tick failed", error);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => {
    void tick();
  }, INTERVAL_MS);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return () => clearInterval(timer);
}
