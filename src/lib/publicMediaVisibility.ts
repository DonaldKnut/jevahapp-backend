/**
 * Public feed / search / trending / playback visibility.
 * Unpublished, rejected, or hidden media must never appear in public surfaces.
 */
export const PUBLIC_MEDIA_FILTER = {
  moderationStatus: "approved" as const,
  isHidden: { $ne: true },
  // Missing publicationState = legacy live docs; exclude non-live states
  publicationState: {
    $nin: ["draft", "staged", "publishing", "tombstoned"],
  },
};

const NON_LIVE_STATES = ["draft", "staged", "publishing", "tombstoned"] as const;

/**
 * Catalog visibility: approved user uploads PLUS HQ/default rows that were
 * seeded without moderationStatus (missing key must not hide sermons/ebooks).
 * Never includes rejected / under_review / hidden / unpublished.
 */
export function publicCatalogFilter(
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const { $or: extraOr, $and: extraAnd, ...rest } = extra;
  const and: Record<string, unknown>[] = [
    {
      isHidden: { $ne: true },
      publicationState: {
        $nin: ["draft", "staged", "publishing", "tombstoned"],
      },
      $or: [
        { moderationStatus: "approved" },
        {
          isDefaultContent: true,
          moderationStatus: { $nin: ["rejected", "under_review"] },
        },
      ],
    },
    rest,
  ];
  if (extraOr) and.push({ $or: extraOr });
  if (Array.isArray(extraAnd) && extraAnd.length) {
    and.push(...(extraAnd as Record<string, unknown>[]));
  }
  return {
    $and: and.filter((clause) => clause && Object.keys(clause).length > 0),
  };
}

export function isPubliclyVisibleMedia(doc: {
  moderationStatus?: string | null;
  isHidden?: boolean | null;
  publicationState?: string | null;
  deletedAt?: Date | string | null;
  isDefaultContent?: boolean | null;
}): boolean {
  if (doc?.isHidden === true) {
    return false;
  }
  if (doc?.deletedAt) {
    return false;
  }
  if (
    doc?.publicationState &&
    NON_LIVE_STATES.includes(doc.publicationState as (typeof NON_LIVE_STATES)[number])
  ) {
    return false;
  }
  if (doc?.moderationStatus === "approved") {
    return true;
  }
  // HQ catalog seeded before moderationStatus existed
  if (
    doc?.isDefaultContent &&
    doc?.moderationStatus !== "rejected" &&
    doc?.moderationStatus !== "under_review"
  ) {
    return true;
  }
  return false;
}
