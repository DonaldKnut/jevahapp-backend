import { Media } from "../models/media.model";
import logger from "../utils/logger";

export function getChatRoomId(userId1: string, userId2: string): string {
  const sortedIds = [userId1, userId2].sort();
  return `chat:${sortedIds[0]}:${sortedIds[1]}`;
}

export async function getContentById(
  contentId: string,
  contentType: string
): Promise<any> {
  try {
    if (contentType === "media") {
      return await Media.findById(contentId).lean();
    }
    return await Media.findById(contentId).lean();
  } catch (error) {
    logger.error("Error getting content by ID", { contentId, contentType, error });
    return null;
  }
}
