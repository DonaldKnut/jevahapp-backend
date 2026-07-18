import { Types } from "mongoose";

const mockToggleLike = jest.fn();

jest.mock("../like/like.service", () => ({
  __esModule: true,
  default: {
    toggleLike: (...args: unknown[]) => mockToggleLike(...args),
  },
}));

jest.mock("../../../lib/engagementEvents", () => ({
  publishEngagementEvent: jest.fn(),
}));

jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import { toggleContentLike } from "../interactions.controller";
import { LikeOperationError } from "../like/like.errors";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("toggleContentLike — HTTP contract", () => {
  const contentId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns durable success shape", async () => {
    mockToggleLike.mockResolvedValue({
      contentId,
      contentType: "media",
      liked: true,
      likeCount: 3,
      updatedAt: "2026-07-18T00:00:00.000Z",
    });

    const req: any = {
      params: { contentId, contentType: "videos" },
      userId: new Types.ObjectId().toString(),
      requestId: "req-1",
    };
    const res = mockRes();

    await toggleContentLike(req, res);

    expect(mockToggleLike).toHaveBeenCalledWith(req.userId, contentId, "media");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Content liked",
      data: {
        contentId,
        contentType: "media",
        liked: true,
        likeCount: 3,
        updatedAt: "2026-07-18T00:00:00.000Z",
      },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const req: any = { params: { contentId, contentType: "media" } };
    const res = mockRes();
    await toggleContentLike(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "AUTHENTICATION_REQUIRED", success: false })
    );
  });

  it("returns 400 for invalid content type", async () => {
    const req: any = {
      params: { contentId, contentType: "not-a-type" },
      userId: new Types.ObjectId().toString(),
    };
    const res = mockRes();
    await toggleContentLike(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "INVALID_CONTENT_TYPE", success: false })
    );
  });

  it("maps CONTENT_NOT_FOUND from service", async () => {
    mockToggleLike.mockRejectedValue(
      new LikeOperationError("CONTENT_NOT_FOUND", "Content not found", 404, { contentId })
    );
    const req: any = {
      params: { contentId, contentType: "media" },
      userId: new Types.ObjectId().toString(),
    };
    const res = mockRes();
    await toggleContentLike(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CONTENT_NOT_FOUND", success: false })
    );
  });
});
