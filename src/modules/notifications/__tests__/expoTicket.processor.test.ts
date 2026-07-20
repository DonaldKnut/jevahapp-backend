import { Types } from "mongoose";

jest.mock("../models/pushDelivery.model", () => ({
  PushDelivery: {
    bulkWrite: jest.fn(),
  },
}));

import { PushDelivery } from "../models/pushDelivery.model";
import { persistPushTickets } from "../infrastructure/expoTicket.processor";

describe("persistPushTickets", () => {
  const userId = new Types.ObjectId().toString();
  const notificationId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
    (PushDelivery.bulkWrite as jest.Mock).mockResolvedValue({
      upsertedCount: 2,
      modifiedCount: 0,
      insertedCount: 0,
    });
  });

  it("upserts one delivery per ticket mapped to tokens", async function () {
    const written = await persistPushTickets({
      userId,
      notificationId,
      ticketIds: ["ticket-a", "ticket-b"],
      tokens: ["ExponentPushToken[aaa]", "ExponentPushToken[bbb]"],
    });

    expect(written).toBe(2);
    expect(PushDelivery.bulkWrite).toHaveBeenCalledTimes(1);
    const ops = (PushDelivery.bulkWrite as jest.Mock).mock.calls[0][0];
    expect(ops).toHaveLength(2);
    expect(ops[0].updateOne.filter).toEqual({ ticketId: "ticket-a" });
    expect(ops[0].updateOne.update.$setOnInsert.token).toBe(
      "ExponentPushToken[aaa]"
    );
    expect(ops[1].updateOne.update.$setOnInsert.token).toBe(
      "ExponentPushToken[bbb]"
    );
  });

  it("no-ops when ticketIds is empty", async function () {
    const written = await persistPushTickets({
      userId,
      notificationId,
      ticketIds: [],
      tokens: [],
    });
    expect(written).toBe(0);
    expect(PushDelivery.bulkWrite).not.toHaveBeenCalled();
  });
});
