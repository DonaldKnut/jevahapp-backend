import cacheService from "../service/cache.service";
import { authUserKey } from "./cacheKeys";

/** Drop JWT auth snapshot after ban/role/verification mutations. */
export async function invalidateAuthUserCache(userId: string): Promise<void> {
  if (!userId) return;
  await cacheService.del(authUserKey(userId));
}
