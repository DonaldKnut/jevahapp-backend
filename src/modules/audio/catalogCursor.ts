import { Types } from "mongoose";

/**
 * Opaque cursor helpers for catalog pagination (no deep skip).
 * Payload: { t: ISO date|string sort value, i: objectId }
 */
export function encodeCatalogCursor(payload: {
  t: string;
  i: string;
}): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCatalogCursor(
  raw?: string | null
): { t: string; i: string } | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    );
    if (!parsed?.t || !parsed?.i) return null;
    return { t: String(parsed.t), i: String(parsed.i) };
  } catch {
    return null;
  }
}

/** Mongo filter for (sortField, _id) descending/ascending cursor pages */
export function catalogCursorFilter(
  cursor: { t: string; i: string } | null,
  sortField: "publishedAt" | "createdAt" | "displayName",
  direction: "desc" | "asc" = "desc"
): Record<string, unknown> | null {
  if (!cursor) return null;
  if (!Types.ObjectId.isValid(cursor.i)) return null;
  const id = new Types.ObjectId(cursor.i);
  const tDate = new Date(cursor.t);
  const useDate = !Number.isNaN(tDate.getTime()) && sortField !== "displayName";
  const tVal = useDate ? tDate : cursor.t;
  if (direction === "asc") {
    return {
      $or: [
        { [sortField]: { $gt: tVal } },
        { [sortField]: tVal, _id: { $gt: id } },
      ],
    };
  }
  return {
    $or: [
      { [sortField]: { $lt: tVal } },
      { [sortField]: tVal, _id: { $lt: id } },
    ],
  };
}

export function nextCatalogCursorFromDoc(
  doc: any,
  sortField: "publishedAt" | "createdAt" | "displayName"
): string | null {
  if (!doc?._id) return null;
  const raw = doc[sortField] ?? doc.createdAt;
  const t =
    raw instanceof Date
      ? raw.toISOString()
      : raw
        ? String(raw)
        : new Date(0).toISOString();
  return encodeCatalogCursor({ t, i: doc._id.toString() });
}
