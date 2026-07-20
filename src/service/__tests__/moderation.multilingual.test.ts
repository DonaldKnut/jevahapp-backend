import { matchModerationBlocklist } from "../../config/moderationBlocklist";
import { ContentModerationService } from "../../service/contentModeration.service";
import { isPubliclyVisibleMedia, PUBLIC_MEDIA_FILTER } from "../../lib/publicMediaVisibility";

describe("Nigerian multilingual moderation fixtures", () => {
  const svc = new ContentModerationService();

  // Force offline path by stubbing model if present
  beforeAll(() => {
    (svc as any).model = null;
    (svc as any).genAI = null;
  });

  const moderate = (input: {
    title?: string;
    description?: string;
    transcript?: string;
    contentType?: string;
  }) =>
    svc.moderateContent({
      title: input.title,
      description: input.description,
      transcript: input.transcript,
      contentType: input.contentType || "sermon",
    });

  it("does not hard-reject theophoric / Christian names (Godwin, Chukwu*, Oluwa*)", async () => {
    expect(matchModerationBlocklist("Pastor Godwin preached tonight")).toBeNull();
    expect(matchModerationBlocklist("Testimony from Chukwuemeka")).toBeNull();
    expect(matchModerationBlocklist("Sister Oluwaseun shared")).toBeNull();

    const r = await moderate({
      title: "Godwin's testimony",
      transcript: "My name is Godwin. Jesus saved me.",
    });
    expect(r.isApproved).toBe(false);
    expect(r.requiresReview).toBe(true);
  });

  it("quarantines Yoruba / Igbo / Hausa / Pidgin gospel-like offline content", async () => {
    const yo = await moderate({
      title: "Adura",
      transcript: "Oluwa mo dupe. Jesu ni Oluwa.",
    });
    expect(yo.requiresReview).toBe(true);
    expect(yo.flags).toEqual(expect.arrayContaining(["possible_gospel"]));

    const ig = await moderate({
      title: "Ekpere",
      transcript: "Chukwu mere ebere. Jisos bu onye nzoputa.",
    });
    expect(ig.requiresReview).toBe(true);

    const ha = await moderate({
      title: "Addu'a",
      transcript: "Yesu Ubangiji ya yi magana a cikin Littafi Mai Tsarki.",
    });
    expect(ha.requiresReview).toBe(true);

    const pcm = await moderate({
      title: "Wetin God do",
      transcript: "Jesus dey do wonders. Make we praise am.",
    });
    expect(pcm.requiresReview).toBe(true);
  });

  it("hard-rejects severe slang phrases but treats soft English tokens as signals", async () => {
    expect(matchModerationBlocklist("ashawo party video")?.severity).toBe("hard");
    expect(matchModerationBlocklist("this is fucking trash")?.severity).toBe("hard");
    expect(matchModerationBlocklist("Brother Dick shared Romans 8")?.severity).toBe("soft");

    const soft = await moderate({
      title: "Dick's Bible study",
      transcript: "We read Romans together.",
    });
    expect(soft.isApproved).toBe(false);
    expect(soft.requiresReview).toBe(true);
  });

  it("never auto-approves on provider outage via short substrings like god/mark/john", async () => {
    const r = await moderate({
      title: "Mark and John hung out",
      description: "godwin birthday party secular vibes",
      transcript: "just chilling",
    });
    expect(r.isApproved).toBe(false);
    expect(r.requiresReview).toBe(true);
  });

  it("PUBLIC_MEDIA_FILTER / visibility helper match approved + not hidden", () => {
    expect(PUBLIC_MEDIA_FILTER).toEqual({
      moderationStatus: "approved",
      isHidden: { $ne: true },
    });
    expect(isPubliclyVisibleMedia({ moderationStatus: "approved", isHidden: false })).toBe(true);
    expect(isPubliclyVisibleMedia({ moderationStatus: "under_review", isHidden: false })).toBe(
      false
    );
    expect(isPubliclyVisibleMedia({ moderationStatus: "approved", isHidden: true })).toBe(false);
  });
});
