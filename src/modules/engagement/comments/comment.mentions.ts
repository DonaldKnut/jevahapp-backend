import { Types } from "mongoose";
import { User } from "../../../models/user.model";
import { isAllowedCdnUrl } from "../../../service/fileUpload.service";

export type MentionInput = { userId: string; displayName?: string };
export type ResolvedMention = {
  userId: Types.ObjectId;
  displayName?: string;
};

/** Parse mentions from JSON body or multipart stringified JSON. */
export function parseMentionsInput(raw: unknown): MentionInput[] {
  let value = raw;
  if (value == null || value === "") return [];
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const out: MentionInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const userId = String((item as any).userId || (item as any)._id || "").trim();
    if (!userId || !Types.ObjectId.isValid(userId)) continue;
    const displayName = String((item as any).displayName || "").trim() || undefined;
    out.push({ userId, displayName });
  }
  return out;
}

/**
 * Drop unknown / duplicate userIds. Never throws — missing users are skipped.
 */
export async function resolveMentions(
  inputs: MentionInput[]
): Promise<ResolvedMention[]> {
  if (!inputs.length) return [];

  const seen = new Set<string>();
  const resolved: ResolvedMention[] = [];

  for (const m of inputs) {
    if (seen.has(m.userId)) continue;
    seen.add(m.userId);

    const user = (await User.findById(m.userId)
      .select("_id firstName lastName")
      .lean()) as { _id: Types.ObjectId; firstName?: string; lastName?: string } | null;
    if (!user) continue;

    const fallbackName =
      `${user.firstName || ""} ${user.lastName || ""}`.trim() || undefined;

    resolved.push({
      userId: user._id,
      displayName: m.displayName || fallbackName,
    });
  }

  return resolved;
}

/** Comment imageUrl must be on our CDN (not arbitrary https). */
export function isAllowedImageUrl(url: string): boolean {
  return isAllowedCdnUrl(url);
}
