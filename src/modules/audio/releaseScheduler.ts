import logger from "../../utils/logger";
import { publishDueScheduledReleases } from "./release.service";

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Periodically publish releases whose scheduledAt has passed.
 * Safe to start on API and worker processes (idempotent updates).
 */
export function startReleaseScheduler(intervalMs?: number): void {
  if (timer) return;
  const ms = Math.max(
    15_000,
    intervalMs ??
      parseInt(process.env.RELEASE_SCHEDULER_INTERVAL_MS || "60000", 10)
  );

  const tick = () => {
    void publishDueScheduledReleases().catch((err: any) => {
      logger.warn("Release scheduler tick failed", { error: err?.message });
    });
  };

  // First tick shortly after boot
  setTimeout(tick, 8_000).unref?.();
  timer = setInterval(tick, ms);
  timer.unref?.();

  logger.info("Release scheduler started", { intervalMs: ms });
}

export function stopReleaseScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
