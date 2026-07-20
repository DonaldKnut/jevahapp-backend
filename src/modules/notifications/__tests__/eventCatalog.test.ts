import {
  isPushAllowedByPreferences,
  resolvePushPreferenceKey,
  toSafeBullJobId,
} from "../domain/eventCatalog";

describe("notification eventCatalog", () => {
  it("maps event types to preference keys", () => {
    expect(resolvePushPreferenceKey("like")).toBe("mediaLikes");
    expect(resolvePushPreferenceKey("comment")).toBe("mediaComments");
    expect(resolvePushPreferenceKey("follow")).toBe("newFollowers");
    expect(resolvePushPreferenceKey("message")).toBe("newMessages");
  });

  it("respects disabled preferences except mandatory events", () => {
    expect(
      isPushAllowedByPreferences("like", { mediaLikes: false })
    ).toBe(false);
    expect(
      isPushAllowedByPreferences("security", { securityAlerts: false })
    ).toBe(true);
  });

  it("produces colon-free BullMQ job ids", () => {
    expect(toSafeBullJobId("like:abc123", "notify")).toBe("notify-like-abc123");
    expect(toSafeBullJobId("media:id:transcode", "media")).not.toContain(":");
  });
});
