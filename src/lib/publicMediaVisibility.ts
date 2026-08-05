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

export function isPubliclyVisibleMedia(doc: {
  moderationStatus?: string | null;
  isHidden?: boolean | null;
  publicationState?: string | null;
  deletedAt?: Date | string | null;
}): boolean {
  if (doc?.moderationStatus !== "approved" || doc?.isHidden === true) {
    return false;
  }
  if (doc?.deletedAt) {
    return false;
  }
  if (
    doc?.publicationState &&
    ["draft", "staged", "publishing", "tombstoned"].includes(
      doc.publicationState
    )
  ) {
    return false;
  }
  return true;
}
