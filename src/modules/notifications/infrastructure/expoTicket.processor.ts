import mongoose from "mongoose";
import { PushDelivery } from "../models/pushDelivery.model";
import logger from "../../../utils/logger";

export interface PersistPushTicketsInput {
  userId: string;
  notificationId: string;
  ticketIds: string[];
  tokens: string[];
}

/**
 * Persist Expo push tickets for later receipt reconciliation.
 * Maps ticketIds[i] → tokens[i] when lengths align; otherwise stores token "".
 */
export async function persistPushTickets(
  input: PersistPushTicketsInput
): Promise<number> {
  const { userId, notificationId, ticketIds, tokens } = input;
  if (!ticketIds?.length) return 0;

  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(notificationId)
  ) {
    logger.warn("persistPushTickets: invalid ids", { userId, notificationId });
    return 0;
  }

  const ops = ticketIds.map((ticketId, i) => ({
    updateOne: {
      filter: { ticketId: String(ticketId) },
      update: {
        $setOnInsert: {
          userId: new mongoose.Types.ObjectId(userId),
          notificationId: new mongoose.Types.ObjectId(notificationId),
          ticketId: String(ticketId),
          token: tokens[i] || "",
          status: "ok" as const,
          attempts: 0,
        },
      },
      upsert: true,
    },
  }));

  const result = await PushDelivery.bulkWrite(ops, { ordered: false });
  const written =
    (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.insertedCount || 0);

  logger.info("Push tickets persisted", {
    userId,
    notificationId,
    ticketCount: ticketIds.length,
    written,
  });

  return written;
}
