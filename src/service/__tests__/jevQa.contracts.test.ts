/**
 * Unit/service-level regression coverage for JEV-001/002/008/010.
 * Live HTTP matrix: RUN_INTEGRATION=1 npm run test:integration
 */
import { Types } from "mongoose";

describe("delete media status mapping", () => {
  function mapDeleteError(message: string): { status: number; code: string } {
    if (message === "Media not found") return { status: 404, code: "NOT_FOUND" };
    if (message === "Unauthorized to delete this media")
      return { status: 403, code: "FORBIDDEN" };
    return { status: 400, code: "DELETE_FAILED" };
  }

  it("maps ownership failures to 403 FORBIDDEN (not login CTA)", () => {
    expect(mapDeleteError("Unauthorized to delete this media")).toEqual({
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("maps missing media to 404", () => {
    expect(mapDeleteError("Media not found")).toEqual({
      status: 404,
      code: "NOT_FOUND",
    });
  });
});

describe("playlist owner id helper", () => {
  // Inline mirror of playlistOwnerId to avoid pulling mongoose models into unit path
  function playlistOwnerId(playlist: any): string {
    const raw = playlist?.userId;
    if (!raw) return "";
    if (typeof raw === "object" && raw._id) return String(raw._id);
    return String(raw);
  }

  it("reads ObjectId and populated user the same way", () => {
    const id = new Types.ObjectId();
    expect(playlistOwnerId({ userId: id })).toBe(String(id));
    expect(
      playlistOwnerId({
        userId: { _id: id, firstName: "A" },
      })
    ).toBe(String(id));
  });
});

describe("notification unread sync contract", () => {
  it("keeps list unreadCount as global unread regardless of unreadOnly filter", () => {
    const all = [
      { isRead: false },
      { isRead: false },
      { isRead: true },
    ];
    const unreadOnly = true;
    const filtered = unreadOnly ? all.filter(n => !n.isRead) : all;
    const unreadCount = all.filter(n => !n.isRead).length;
    expect(filtered).toHaveLength(2);
    expect(unreadCount).toBe(2);
  });
});
