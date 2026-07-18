const {
  findDuplicateGroups,
  validateDesiredIndexes,
  findLegacyUniqueIndex,
  DESIRED_INDEXES,
} = require("../lib/migrateLikeIndexes");

describe("migrateLikeIndexes helpers", () => {
  it("detects collisions after contentType backfill", () => {
    const groups = findDuplicateGroups([
      { _id: "1", userId: "u", contentId: "c", createdAt: "2020-01-01" }, // missing type → media
      {
        _id: "2",
        userId: "u",
        contentType: "media",
        contentId: "c",
        createdAt: "2020-01-02",
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].keep).toBe("1");
    expect(groups[0].remove).toEqual(["2"]);
  });

  it("keeps oldest deterministically", () => {
    const groups = findDuplicateGroups([
      {
        _id: "b",
        userId: "u",
        contentType: "media",
        contentId: "c",
        createdAt: "2020-01-02",
      },
      {
        _id: "a",
        userId: "u",
        contentType: "media",
        contentId: "c",
        createdAt: "2020-01-01",
      },
    ]);
    expect(groups[0].keep).toBe("a");
    expect(groups[0].remove).toEqual(["b"]);
  });

  it("validateDesiredIndexes fails on key mismatch", () => {
    const indexes = [
      {
        name: "unique_user_content_like",
        key: { contentId: 1, userId: 1 },
        unique: true,
      },
    ];
    const v = validateDesiredIndexes(indexes);
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toMatch(/key mismatch/);
  });

  it("validateDesiredIndexes ok when matching", () => {
    const indexes = DESIRED_INDEXES.map(d => ({
      name: d.options.name,
      key: d.key,
      unique: !!d.options.unique,
    }));
    expect(validateDesiredIndexes(indexes).ok).toBe(true);
  });

  it("findLegacyUniqueIndex finds old compound unique", () => {
    const legacy = findLegacyUniqueIndex([
      { name: "contentId_1_userId_1", key: { contentId: 1, userId: 1 }, unique: true },
      {
        name: "unique_user_content_like",
        key: { userId: 1, contentType: 1, contentId: 1 },
        unique: true,
      },
    ]);
    expect(legacy.name).toBe("contentId_1_userId_1");
  });

  it("rerun with no dupes is a no-op set of groups", () => {
    const groups = findDuplicateGroups([
      {
        _id: "1",
        userId: "u",
        contentType: "media",
        contentId: "c1",
        createdAt: "2020-01-01",
      },
      {
        _id: "2",
        userId: "u",
        contentType: "media",
        contentId: "c2",
        createdAt: "2020-01-01",
      },
    ]);
    expect(groups).toHaveLength(0);
  });
});
