import cacheService from "../../../service/cache.service";
import { CACHE_TTL } from "../../../lib/cacheKeys";
import { normalizeContentType } from "../shared/contentType.resolver";
import type { BatchMetadataItem, ContentMetadata } from "../shared/engagement.types";

const META_TTL = CACHE_TTL.mediaMeta; // 60s

function metaKey(contentType: string, contentId: string, userId?: string): string {
  const type =
    (contentType || "").trim().toLowerCase() === "devotional"
      ? "devotional"
      : normalizeContentType(contentType || "media");
  const scope = userId && userId.length > 0 ? userId : "anon";
  return `eng:meta:v1:${scope}:${type}:${contentId}`;
}

export async function getCachedContentMetadata(
  userId: string,
  contentId: string,
  contentType: string,
  loader: () => Promise<ContentMetadata>
): Promise<ContentMetadata> {
  const key = metaKey(contentType, contentId, userId);
  const hit = await cacheService.getJSON<ContentMetadata>(key);
  if (hit) return hit;

  const fresh = await loader();
  await cacheService.setJSON(key, fresh, META_TTL);
  return fresh;
}

export async function getCachedBatchMetadata(
  userId: string | undefined,
  contentIds: string[],
  contentType: string,
  loader: (missingIds: string[]) => Promise<BatchMetadataItem[]>
): Promise<BatchMetadataItem[]> {
  if (contentIds.length === 0) return [];

  const results: BatchMetadataItem[] = [];
  const missing: string[] = [];

  await Promise.all(
    contentIds.map(async id => {
      const key = metaKey(contentType, id, userId);
      const hit = await cacheService.getJSON<BatchMetadataItem>(key);
      if (hit) {
        results.push(hit);
      } else {
        missing.push(id);
      }
    })
  );

  if (missing.length > 0) {
    const loaded = await loader(missing);
    await Promise.all(
      loaded.map(item =>
        cacheService.setJSON(metaKey(contentType, item.id, userId), item, META_TTL)
      )
    );
    results.push(...loaded);
  }

  // Preserve request order
  const byId = new Map(results.map(r => [r.id, r]));
  return contentIds.map(id => byId.get(id)).filter((x): x is BatchMetadataItem => x != null);
}

/** Drop cached metadata after engagement mutations (like/unlike, etc.). */
export async function invalidateContentMetadataCache(
  contentId: string,
  contentType: string,
  userId?: string
): Promise<void> {
  const type =
    (contentType || "").trim().toLowerCase() === "devotional"
      ? "devotional"
      : normalizeContentType(contentType || "media");

  const keys = [
    `eng:meta:v1:anon:${type}:${contentId}`,
    userId ? `eng:meta:v1:${userId}:${type}:${contentId}` : null,
  ].filter(Boolean) as string[];

  await Promise.all(keys.map(k => cacheService.del(k)));
}
