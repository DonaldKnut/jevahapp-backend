const { reconcileLikeCounts } = require("../lib/reconcileLikeCounts");
const { ObjectId } = require("mongodb");

function memoryCollection(docs) {
  let data = docs.map(d => ({ ...d }));
  return {
    _data: () => data,
    async findOne(filter) {
      return data.find(d => String(d._id) === String(filter._id)) || null;
    },
    async updateOne(filter, update) {
      const doc = data.find(d => String(d._id) === String(filter._id));
      if (!doc) return { modifiedCount: 0 };
      if (update.$set) Object.assign(doc, update.$set);
      return { modifiedCount: 1 };
    },
    find(filter) {
      const matched = data.filter(d => {
        if (filter.likeCount && filter.likeCount.$lt != null) {
          return (d.likeCount ?? 0) < filter.likeCount.$lt;
        }
        return true;
      });
      return {
        limit() {
          return {
            async toArray() {
              return matched.map(d => ({ ...d }));
            },
          };
        },
        async toArray() {
          return matched.map(d => ({ ...d }));
        },
      };
    },
    aggregate(pipeline) {
      // Minimal support for our reconcile pipelines
      const isOrphanPipeline = pipeline.some(p => p.$lookup && p.$lookup.from === "media");
      if (isOrphanPipeline) {
        return {
          async toArray() {
            return [];
          },
        };
      }
      // Media drift pipeline — compute against injected likes via this.__likes
      const likes = this.__likes || [];
      let rows = data.map(m => {
        const actual = likes.filter(
          l =>
            l.contentType === "media" &&
            String(l.contentId) === String(m._id)
        ).length;
        return {
          _id: m._id,
          title: m.title,
          likeCount: m.likeCount,
          actual,
        };
      });
      const matchNe = pipeline.find(p => p.$match && p.$match.$expr);
      if (matchNe) {
        rows = rows.filter(r => (r.likeCount ?? 0) !== r.actual);
      }
      const lim = pipeline.find(p => p.$limit);
      if (lim) rows = rows.slice(0, lim.$limit);

      let i = 0;
      return {
        batchSize() {
          return this;
        },
        async hasNext() {
          return i < rows.length;
        },
        async next() {
          return rows[i++];
        },
        async toArray() {
          return rows;
        },
      };
    },
  };
}

describe("reconcileLikeCounts", () => {
  it("repairs stale positive counts with zero likes", async () => {
    const id = new ObjectId();
    const media = memoryCollection([{ _id: id, title: "A", likeCount: 5 }]);
    media.__likes = [];
    const likesCol = {
      aggregate() {
        return { toArray: async () => [] };
      },
    };

    const result = await reconcileLikeCounts(media, likesCol, { dryRun: false });
    expect(result.drifted).toBe(1);
    expect(result.repaired).toBe(1);
    expect(media._data()[0].likeCount).toBe(0);
  });

  it("repairs ordinary drift", async () => {
    const id = new ObjectId();
    const media = memoryCollection([{ _id: id, title: "B", likeCount: 1 }]);
    media.__likes = [
      { contentId: id, contentType: "media" },
      { contentId: id, contentType: "media" },
    ];
    const likesCol = {
      aggregate() {
        return { toArray: async () => [] };
      },
    };
    const result = await reconcileLikeCounts(media, likesCol, { dryRun: false });
    expect(result.repaired).toBe(1);
    expect(media._data()[0].likeCount).toBe(2);
  });

  it("repairs negatives", async () => {
    const id = new ObjectId();
    const media = memoryCollection([{ _id: id, title: "C", likeCount: -3 }]);
    media.__likes = [];
    const likesCol = {
      aggregate() {
        return { toArray: async () => [] };
      },
    };
    const result = await reconcileLikeCounts(media, likesCol, { dryRun: false });
    expect(result.repaired).toBeGreaterThanOrEqual(1);
    expect(media._data()[0].likeCount).toBe(0);
  });

  it("skips correct counts", async () => {
    const id = new ObjectId();
    const media = memoryCollection([{ _id: id, title: "D", likeCount: 2 }]);
    media.__likes = [
      { contentId: id, contentType: "media" },
      { contentId: id, contentType: "media" },
    ];
    const likesCol = {
      aggregate() {
        return { toArray: async () => [] };
      },
    };
    const result = await reconcileLikeCounts(media, likesCol, { dryRun: false });
    expect(result.drifted).toBe(0);
    expect(result.repaired).toBe(0);
  });

  it("dry-run does not mutate", async () => {
    const id = new ObjectId();
    const media = memoryCollection([{ _id: id, title: "E", likeCount: 9 }]);
    media.__likes = [];
    const likesCol = {
      aggregate() {
        return { toArray: async () => [] };
      },
    };
    const result = await reconcileLikeCounts(media, likesCol, { dryRun: true });
    expect(result.wouldRepair).toBe(1);
    expect(result.repaired).toBe(0);
    expect(media._data()[0].likeCount).toBe(9);
  });
});
