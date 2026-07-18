const saves: any[] = [];

jest.mock("../../models/notification.model", () => {
  class MockNotification {
    _id = { toString: () => `notif_${saves.length + 1}` };
    dedupeKey?: string;
    constructor(data: any) {
      Object.assign(this, data);
    }
    async save() {
      if (this.dedupeKey && saves.some(s => s.dedupeKey === this.dedupeKey)) {
        const err: any = new Error("duplicate");
        err.code = 11000;
        throw err;
      }
      saves.push(this);
      return this;
    }
  }
  return { Notification: MockNotification };
});

jest.mock("../../models/user.model", () => ({
  User: { findById: jest.fn() },
}));

jest.mock("../../models/media.model", () => ({
  Media: { findById: jest.fn() },
}));

jest.mock("../../models/devotional.model", () => ({
  Devotional: { findById: jest.fn() },
}));

jest.mock("../pushNotification.service", () => ({
  __esModule: true,
  default: {
    sendToUser: jest.fn().mockResolvedValue(undefined),
  },
}));

import { NotificationService } from "../notification.service";
import { Media } from "../../models/media.model";
import { User } from "../../models/user.model";

describe("notifyContentLike dedupe lifecycle", () => {
  beforeEach(() => {
    saves.length = 0;
    (Media.findById as jest.Mock).mockResolvedValue({
      _id: { toString: () => "media1" },
      title: "Song",
      thumbnailUrl: null,
      likeCount: 2,
      uploadedBy: "owner1",
    });
    (User.findById as jest.Mock).mockImplementation(async (id: string) => ({
      _id: { toString: () => String(id) },
      firstName: "Ada",
      email: "ada@example.com",
      avatar: null,
    }));
  });

  it("uses like:{likeId} so retries suppress duplicates", async () => {
    const likeId = "aaaaaaaaaaaaaaaaaaaaaaaa";
    await NotificationService.notifyContentLike("liker1", "media1", "media", likeId);
    await NotificationService.notifyContentLike("liker1", "media1", "media", likeId);
    expect(saves).toHaveLength(1);
    expect(saves[0].dedupeKey).toBe(`like:${likeId}`);
  });

  it("allows a new notification after unlike/relike (new likeId)", async () => {
    await NotificationService.notifyContentLike(
      "liker1",
      "media1",
      "media",
      "bbbbbbbbbbbbbbbbbbbbbbbb"
    );
    await NotificationService.notifyContentLike(
      "liker1",
      "media1",
      "media",
      "cccccccccccccccccccccccc"
    );
    expect(saves).toHaveLength(2);
  });
});
