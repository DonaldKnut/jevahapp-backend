import { Expo } from "expo-server-sdk";
import { PushDelivery } from "../models/pushDelivery.model";
import { PushDevice } from "../models/pushDevice.model";
import { User } from "../../../models/user.model";
import logger from "../../../utils/logger";

const DEFAULT_BATCH = 100;
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface PollExpoReceiptsOptions {
  limit?: number;
  maxAgeMs?: number;
}

function createExpoClient(): Expo {
  return new Expo({
    accessToken: process.env.EXPO_ACCESS_TOKEN,
    useFcmV1: true,
  });
}

/**
 * Remove a dead Expo token from User.pushNotifications.deviceTokens and
 * mark the matching PushDevice as invalid.
 */
export async function deactivateDeviceToken(
  token: string,
  reason: string
): Promise<void> {
  if (!token) return;

  await Promise.all([
    PushDevice.updateOne(
      { expoToken: token },
      {
        $set: {
          status: "invalid",
          lastError: reason,
          lastSeenAt: new Date(),
        },
      }
    ),
    User.updateMany(
      { "pushNotifications.deviceTokens": token },
      { $pull: { "pushNotifications.deviceTokens": token } }
    ),
  ]);

  logger.info("Deactivated push device token", {
    token: token.substring(0, 20) + "...",
    reason,
  });
}

/**
 * Poll Expo for receipts on deliveries that have a ticket but no receipt yet.
 * Deactivates tokens with DeviceNotRegistered / InvalidCredentials.
 */
export async function pollExpoReceipts(
  opts: PollExpoReceiptsOptions = {}
): Promise<{ checked: number; errors: number; deactivated: number }> {
  const limit = opts.limit ?? DEFAULT_BATCH;
  const maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const since = new Date(Date.now() - maxAgeMs);

  const pending = await PushDelivery.find({
    ticketId: { $exists: true, $ne: "" },
    $or: [{ receiptStatus: { $exists: false } }, { receiptStatus: null }],
    createdAt: { $gte: since },
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();

  if (!pending.length) {
    return { checked: 0, errors: 0, deactivated: 0 };
  }

  const expo = createExpoClient();
  const ticketIds = pending.map(d => d.ticketId);
  const chunks = expo.chunkPushNotificationReceiptIds(ticketIds);

  let errors = 0;
  let deactivated = 0;
  const receiptById: Record<
    string,
    { status: string; message?: string; details?: { error?: string } }
  > = {};

  for (const chunk of chunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      Object.assign(receiptById, receipts);
    } catch (err: any) {
      errors++;
      logger.error("Expo receipt poll chunk failed", {
        chunkSize: chunk.length,
        error: err?.message,
      });
    }
  }

  for (const delivery of pending) {
    const receipt = receiptById[delivery.ticketId];
    if (!receipt) continue;

    const receiptStatus = receipt.status;
    const errorCode =
      receipt.details?.error ||
      (typeof receipt.message === "string" ? receipt.message : undefined);

    await PushDelivery.updateOne(
      { _id: delivery._id },
      {
        $set: {
          receiptStatus,
          status: receiptStatus === "ok" ? "ok" : "error",
        },
        $inc: { attempts: 1 },
      }
    );

    if (
      receiptStatus === "error" &&
      errorCode &&
      (/DeviceNotRegistered/i.test(String(errorCode)) ||
        /InvalidCredentials/i.test(String(errorCode)))
    ) {
      await deactivateDeviceToken(
        delivery.token,
        String(errorCode)
      );
      deactivated++;
    }
  }

  logger.info("Expo receipt poll completed", {
    checked: pending.length,
    receiptCount: Object.keys(receiptById).length,
    errors,
    deactivated,
  });

  return { checked: pending.length, errors, deactivated };
}

/** Start a lightweight interval poller (used by the worker process). */
export function startExpoReceiptPoller(intervalMs = 60_000): NodeJS.Timeout {
  const tick = () => {
    pollExpoReceipts().catch(err => {
      logger.error("Expo receipt poller tick failed", {
        error: (err as Error).message,
      });
    });
  };
  // Delay first run so boot settles
  const handle = setInterval(tick, intervalMs);
  setTimeout(tick, Math.min(15_000, intervalMs));
  return handle;
}
