import { Types } from "mongoose";

const mockCreate = jest.fn();

jest.mock("../../../models/viewEvent.model", () => ({
  ViewEvent: { create: (...args: unknown[]) => mockCreate(...args) },
}));

jest.mock("../../../models/devotional.model", () => ({
  Devotional: {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: "d1", viewCount: 2 }),
    }),
    findByIdAndUpdate: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockResolvedValue({ viewCount: 5 }),
    })),
  },
}));

jest.mock("../../../models/media.model", () => ({
  Media: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn().mockResolvedValue({ viewCount: 5 }),
  },
}));

jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock("../../../socket/socketManager", () => ({ getIO: () => null }));

import viewService from "../view/view.service";

describe("ViewService — dedupe & thresholds", () => {
  const userId = new Types.ObjectId().toString();
  const contentId = new Types.ObjectId().toString();

  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({});
    const { Devotional } = require("../../../models/devotional.model");
    Devotional.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: contentId, viewCount: 2 }),
    });
    Devotional.findByIdAndUpdate.mockImplementation(() => ({
      select: jest.fn().mockResolvedValue({ viewCount: 5 }),
    }));
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
    expect(mockCreate).toHaveBeenCalled();
  });

  it("treats duplicate key as deduped view", async () => {
    mockCreate.mockRejectedValueOnce({ code: 11000 });
    const { Devotional } = require("../../../models/devotional.model");
    Devotional.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ viewCount: 3 }),
    });
    Devotional.findByIdAndUpdate.mockResolvedValue({ viewCount: 3 });

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
});
