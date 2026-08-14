/**
 * Compact public author for feed / Reels / comments fallbacks.
 * FE reads uploadedBy (object) first; ID-only triggers GET /api/users/:id.
 */
export type PublicAuthor = {
  _id: string | null;
  id: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  avatar: string | null;
  avatarUrl: string | null;
  avatarUpload: string | null;
};

function idFrom(raw: any): string | null {
  if (raw == null) return null;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number") return String(raw);
  if (typeof raw !== "object") return null;
  if (raw._bsontype === "ObjectId" && typeof raw.toString === "function") {
    return raw.toString();
  }
  const v = raw._id ?? raw.id;
  if (v == null) return null;
  return typeof v === "string" ? v : v.toString?.() || null;
}

function isPopulatedUser(raw: any): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  if (raw._bsontype === "ObjectId") return false;
  return Boolean(
    raw.firstName ||
      raw.lastName ||
      raw.first_name ||
      raw.last_name ||
      raw.name ||
      raw.fullName ||
      raw.avatar ||
      raw.avatarUpload ||
      raw.avatarUrl
  );
}

export function shapePublicAuthor(raw: any): PublicAuthor | null {
  if (raw == null || raw === "") return null;

  if (typeof raw === "string" || raw?._bsontype === "ObjectId") {
    const id = idFrom(raw);
    if (!id) return null;
    return {
      _id: id,
      id,
      firstName: null,
      lastName: null,
      name: null,
      avatar: null,
      avatarUrl: null,
      avatarUpload: null,
    };
  }

  if (typeof raw !== "object") return null;

  const id = idFrom(raw);
  const firstName = raw.firstName || raw.first_name || null;
  const lastName = raw.lastName || raw.last_name || null;
  const nameRaw =
    raw.name ||
    raw.fullName ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    null;
  const avatarRaw =
    raw.avatar ||
    raw.avatarUpload ||
    raw.avatarUrl ||
    raw.imageUrl ||
    raw.profileImage ||
    raw.profilePicture ||
    null;
  const avatar = avatarRaw ? String(avatarRaw) : null;

  if (!id && !firstName && !lastName && !nameRaw && !avatar) return null;

  return {
    _id: id,
    id,
    firstName: firstName ? String(firstName) : null,
    lastName: lastName ? String(lastName) : null,
    name: nameRaw ? String(nameRaw) : null,
    avatar,
    avatarUrl: avatar,
    avatarUpload: raw.avatarUpload ? String(raw.avatarUpload) : avatar,
  };
}

/** Prefer a populated author object over a bare ObjectId. */
export function pickAuthorSource(item: any): any {
  if (!item || typeof item !== "object") return null;
  const candidates = [item.authorInfo, item.author, item.uploadedBy];
  for (const c of candidates) {
    if (isPopulatedUser(c)) return c;
  }
  return item.uploadedBy ?? item.authorInfo ?? item.author ?? null;
}

export function attachPublicAuthor<T extends Record<string, any>>(doc: T): T {
  const shaped = shapePublicAuthor(pickAuthorSource(doc));
  if (!shaped) return doc;
  return {
    ...doc,
    uploadedBy: shaped,
    author: shaped,
    authorInfo: {
      ...shaped,
      fullName: shaped.name,
    },
  };
}
