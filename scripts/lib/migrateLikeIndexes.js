/**
 * Testable Like index migration helpers.
 */

function indexesEqual(a, b) {
  const aKeys = Object.keys(a || {}).sort();
  const bKeys = Object.keys(b || {}).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(k => a[k] === b[k]);
}

function findLegacyUniqueIndex(indexes) {
  return indexes.find(
    idx =>
      idx.unique &&
      idx.key &&
      idx.key.contentId === 1 &&
      idx.key.userId === 1 &&
      !idx.key.contentType
  );
}

function findNamedIndex(indexes, name) {
  return indexes.find(i => i.name === name);
}

/**
 * Detect duplicate groups after hypothetical contentType backfill to "media".
 * @param {Array<{_id:any,userId:any,contentType?:string,contentId:any,createdAt?:Date}>} docs
 */
function findDuplicateGroups(docs) {
  const map = new Map();
  for (const d of docs) {
    const contentType = d.contentType || "media";
    const key = `${String(d.userId)}|${contentType}|${String(d.contentId)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(d);
  }
  const groups = [];
  for (const [, group] of map) {
    if (group.length > 1) {
      group.sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (at !== bt) return at - bt;
        return String(a._id).localeCompare(String(b._id));
      });
      groups.push({
        keep: group[0]._id,
        remove: group.slice(1).map(g => g._id),
        userId: group[0].userId,
        contentType: group[0].contentType || "media",
        contentId: group[0].contentId,
      });
    }
  }
  return groups;
}

const DESIRED_INDEXES = [
  {
    key: { userId: 1, contentType: 1, contentId: 1 },
    options: { unique: true, name: "unique_user_content_like" },
  },
  {
    key: { contentType: 1, contentId: 1 },
    options: { name: "content_likes" },
  },
  {
    key: { userId: 1, createdAt: -1 },
    options: { name: "user_likes" },
  },
];

/**
 * Validate existing named indexes match desired key/options.
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateDesiredIndexes(indexes) {
  const errors = [];
  for (const desired of DESIRED_INDEXES) {
    const existing = findNamedIndex(indexes, desired.options.name);
    if (!existing) continue;
    if (!indexesEqual(existing.key, desired.key)) {
      errors.push(
        `Index ${desired.options.name} key mismatch: have ${JSON.stringify(existing.key)} want ${JSON.stringify(desired.key)}`
      );
    }
    if (!!existing.unique !== !!desired.options.unique) {
      errors.push(
        `Index ${desired.options.name} unique mismatch: have ${!!existing.unique} want ${!!desired.options.unique}`
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  indexesEqual,
  findLegacyUniqueIndex,
  findNamedIndex,
  findDuplicateGroups,
  validateDesiredIndexes,
  DESIRED_INDEXES,
};
