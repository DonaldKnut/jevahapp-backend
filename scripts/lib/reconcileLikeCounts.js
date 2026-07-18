/**
 * Testable Media.likeCount reconciliation logic.
 * Drive from Media; actual = Like.count for contentType=media.
 */

/**
 * @param {import('mongodb').Collection} media
 * @param {import('mongodb').Collection} likes
 * @param {{ dryRun?: boolean, limit?: number, batchSize?: number, onRepair?: (doc: {contentId: any, stored: number, actual: number}) => Promise<void> }} opts
 */
async function reconcileLikeCounts(media, likes, opts = {}) {
  const dryRun = !!opts.dryRun;
  const limit = opts.limit || 0;
  const batchSize = opts.batchSize || 200;
  const onRepair = opts.onRepair;

  let checked = 0;
  let drifted = 0;
  let repaired = 0;
  const orphans = [];
  const repairs = [];

  // Orphan likes: Like rows with no Media
  const orphanPipeline = [
    { $match: { contentType: "media" } },
    {
      $lookup: {
        from: "media",
        localField: "contentId",
        foreignField: "_id",
        as: "m",
      },
    },
    { $match: { m: { $size: 0 } } },
    { $group: { _id: "$contentId", actual: { $sum: 1 } } },
  ];
  const orphanRows = await likes.aggregate(orphanPipeline).toArray();
  for (const row of orphanRows) {
    orphans.push({ contentId: row._id, actual: row.actual });
  }

  // Media-driven actual counts
  const pipeline = [
    {
      $lookup: {
        from: "likes",
        let: { mid: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$contentId", "$$mid"] },
                  { $eq: ["$contentType", "media"] },
                ],
              },
            },
          },
          { $count: "n" },
        ],
        as: "likeAgg",
      },
    },
    {
      $project: {
        title: 1,
        likeCount: 1,
        actual: { $ifNull: [{ $arrayElemAt: ["$likeAgg.n", 0] }, 0] },
      },
    },
    {
      $match: {
        $expr: {
          $ne: [{ $ifNull: ["$likeCount", 0] }, "$actual"],
        },
      },
    },
  ];

  if (limit > 0) {
    pipeline.push({ $limit: limit });
  }

  const cursor = media.aggregate(pipeline).batchSize(batchSize);
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    checked++;
    const stored = doc.likeCount ?? 0;
    const actual = doc.actual ?? 0;
    drifted++;
    repairs.push({
      contentId: doc._id,
      title: doc.title || "",
      stored,
      actual,
    });
    if (!dryRun) {
      await media.updateOne({ _id: doc._id }, { $set: { likeCount: actual } });
      if (onRepair) {
        await onRepair({ contentId: doc._id, stored, actual });
      }
      repaired++;
    }
  }

  // Also catch negatives that somehow matched equal if NaN — belt and suspenders
  const negatives = await media
    .find({ likeCount: { $lt: 0 } }, { projection: { _id: 1, likeCount: 1, title: 1 } })
    .limit(limit || 1000)
    .toArray();
  for (const doc of negatives) {
    if (repairs.some(r => String(r.contentId) === String(doc._id))) continue;
    checked++;
    drifted++;
    repairs.push({
      contentId: doc._id,
      title: doc.title || "",
      stored: doc.likeCount,
      actual: 0,
    });
    if (!dryRun) {
      await media.updateOne({ _id: doc._id }, { $set: { likeCount: 0 } });
      if (onRepair) {
        await onRepair({ contentId: doc._id, stored: doc.likeCount, actual: 0 });
      }
      repaired++;
    }
  }

  return {
    checked,
    drifted,
    repaired: dryRun ? 0 : repaired,
    wouldRepair: dryRun ? drifted : repaired,
    orphans,
    repairs,
  };
}

module.exports = { reconcileLikeCounts };
