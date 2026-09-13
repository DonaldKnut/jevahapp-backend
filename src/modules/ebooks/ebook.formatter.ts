import { normalizeUrl } from "../../controllers/copyrightFreeSong/shared";
import { publicCatalogFilter } from "../../lib/publicMediaVisibility";

export type EbookCard = {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  fileUrl: string | null;
  pdfUrl: string | null;
  authorName: string | null;
  category: string | null;
  topics: string[];
  publishedAt: string | null;
  readCount: number;
  likeCount: number;
  processingStatus: string;
  moderationStatus: string;
  contentType: "ebook";
};

function asIso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function shapeEbookCard(doc: any): EbookCard {
  const fileRaw = doc.fileUrl || doc.pdfUrl || doc.playbackUrl || null;
  const thumbRaw = doc.thumbnailUrl || doc.coverImageUrl || null;
  const author =
    doc.authorInfo?.name ||
    doc.author?.name ||
    [doc.uploadedBy?.firstName, doc.uploadedBy?.lastName].filter(Boolean).join(" ") ||
    null;
  const rawMod = doc.moderationStatus;
  const moderationStatus =
    typeof rawMod === "string" && rawMod.trim()
      ? rawMod.trim().toLowerCase()
      : "approved";

  return {
    id: doc._id?.toString?.() || doc.id,
    title: doc.title || "",
    description: doc.description || null,
    thumbnailUrl: thumbRaw ? normalizeUrl(thumbRaw) : null,
    fileUrl: fileRaw ? normalizeUrl(fileRaw) : null,
    pdfUrl: fileRaw ? normalizeUrl(fileRaw) : null,
    authorName: author,
    category: doc.category || "teachings",
    topics: Array.isArray(doc.topics) ? doc.topics : [],
    publishedAt: asIso(doc.publishedAt || doc.createdAt),
    readCount: doc.readCount ?? doc.viewCount ?? 0,
    likeCount: doc.likeCount ?? doc.totalLikes ?? 0,
    processingStatus: "ready",
    moderationStatus,
    contentType: "ebook",
  };
}

export function publicEbookFilter(extra: Record<string, unknown> = {}) {
  const extraAnd = Array.isArray(extra.$and)
    ? extra.$and
    : extra.$and
      ? [extra.$and]
      : [];
  const rest = { ...extra };
  delete rest.$and;
  return publicCatalogFilter({
    contentType: { $in: ["ebook", "books"] },
    $and: [
      {
        $or: [
          { fileUrl: { $exists: true, $nin: [null, ""] } },
          { pdfUrl: { $exists: true, $nin: [null, ""] } },
        ],
      },
      { fileUrl: { $not: /^staging:\/\// } },
      ...extraAnd,
    ],
    ...rest,
  });
}
