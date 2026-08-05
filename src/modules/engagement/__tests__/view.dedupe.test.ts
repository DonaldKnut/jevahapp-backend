import { Types } from "mongoose";

const mockCreate = jest.fn();

jest.mock("../../../models/viewEvent.model", () => ({
  ViewEvent: { create: (...args: unknown[]) => mockCreate(...args) },
}));

function leanChain(value: unknown) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(value),
    }),
  };
}

jest.mock("../../../models/devotional.model", () => ({
  Devotional: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock("../../../models/media.model", () => ({
  Media: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock("../../../socket/socketManager", () => ({ getIO: () => null }));

jest.mock("../../../lib/redisCounters", () => ({
  setPostCounter: jest.fn().mockResolvedValue(undefined),
}));

import viewService from "../view/view.service";
import { Media } from "../../../models/media.model";
import { Devotional } from "../../../models/devotional.model";

describe("ViewService — dedupe & thresholds", () => {
  const userId = new Types.ObjectId().toString();
  const contentId = new Types.ObjectId().toString();

  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({});
    (Devotional.findById as jest.Mock).mockImplementation(() =>
      leanChain({ _id: contentId, viewCount: 2 })
    );
    (Devotional.findByIdAndUpdate as jest.Mock).mockImplementation(() =>
      leanChain({ viewCount: 5 })
    );
    (Media.findById as jest.Mock).mockImplementation(() =>
      leanChain({
        _id: contentId,
        viewCount: 1,
        moderationStatus: "under_review",
        deletedAt: null,
        contentType: "videos",
      })
    );
    (Media.findByIdAndUpdate as jest.Mock).mockImplementation(() =>
      leanChain({ viewCount: 2 })
    );
  });

  it("rejects sub-threshold devotional views", async () => {
    const result = await viewService.recordView({
      userId,
      contentId,
      contentType: "devotional",
      durationMs: 1000,
    });
    expect(result.counted).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("records qualified devotional views", async () => {
    const result = await viewService.recordView({
      userId,
      contentId,
      contentType: "devotional",
      durationMs: 15000,
      progressPct: 0.2,
    });
    expect(result.counted).toBe(true);
    expect(result.isNewView).toBe(true);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("treats duplicate key as deduped view", async () => {
    mockCreate.mockRejectedValueOnce({ code: 11000 });
    (Devotional.findById as jest.Mock).mockImplementation(() =>
      leanChain({ _id: contentId, viewCount: 3 })
    );

    const result = await viewService.recordView({
      userId,
      contentId,
      contentType: "devotional",
      durationMs: 15000,
      isComplete: true,
    });
    expect(result.hasViewed).toBe(true);
    expect(result.counted).toBe(false);
  });

  it("counts views for under_review media (no 500 / no throw)", async () => {
    const result = await viewService.recordView({
      userId,
      contentId,
      contentType: "media",
      durationMs: 5000,
      progressPct: 30,
      deviceId: "device_under_review_test",
      sessionId: "session_under_review_test",
      source: "feed",
    });
    expect(result.counted).toBe(true);
    expect(result.viewCount).toBe(2);
    expect(result.isNewView).toBe(true);
    expect(mockCreate).toHaveBeenCalled();
  });

  it("soft no-ops rejected media", async () => {
    (Media.findById as jest.Mock).mockImplementation(() =>
      leanChain({
        _id: contentId,
        viewCount: 4,
        moderationStatus: "rejected",
        deletedAt: null,
      })
    );
    const result = await viewService.recordView({
      userId,
      contentId,
      contentType: "media",
      durationMs: 5000,
      progressPct: 50,
    });
    expect(result.counted).toBe(false);
    expect(result.viewCount).toBe(4);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("soft no-ops missing / deleted media", async () => {
    (Media.findById as jest.Mock).mockImplementation(() => leanChain(null));
    const result = await viewService.recordView({
      userId,
      contentId,
      contentType: "media",
      durationMs: 5000,
    });
    expect(result.counted).toBe(false);
    expect(result.viewCount).toBe(0);
  });
});
