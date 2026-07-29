import { formatComment } from "../comments/comment.formatter";
import { Types } from "mongoose";

describe("formatComment — isLiked + shape", () => {
  const viewerId = new Types.ObjectId().toString();
  const otherId = new Types.ObjectId().toString();

  const base = {
    _id: new Types.ObjectId(),
    content: "Amen 🙏",
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
    replyCount: 0,
    user: {
      _id: new Types.ObjectId(),
      firstName: "Ada",
      lastName: "O",
      avatar: "https://example.com/a.png",
    },
    reactions: {
      like: [new Types.ObjectId(viewerId)],
    },
  };

  it("sets isLiked true when viewer liked", () => {
    const out = formatComment(base, viewerId);
    expect(out.isLiked).toBe(true);
    expect(out.likesCount).toBe(1);
    expect(out.content).toBe("Amen 🙏");
    expect(out.user.firstName).toBe("Ada");
    expect(out.parentCommentId).toBeNull();
  });

  it("sets isLiked false for guests and other users", () => {
    expect(formatComment(base).isLiked).toBe(false);
    expect(formatComment(base, otherId).isLiked).toBe(false);
  });

  it("supports Map reactions", () => {
    const withMap = {
      ...base,
      reactions: new Map([["like", [new Types.ObjectId(viewerId)]]]),
    };
    expect(formatComment(withMap, viewerId).isLiked).toBe(true);
  });
});
