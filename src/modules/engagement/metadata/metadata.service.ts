import { BatchMetadataItem, ContentMetadata } from "../shared/engagement.types";
import { MetadataSingleService } from "./metadata.single";
import { MetadataBatchService } from "./metadata.batch";
import {
  getCachedBatchMetadata,
  getCachedContentMetadata,
} from "./metadata.cache";

export class MetadataService {
  private readonly single = new MetadataSingleService();
  private readonly batch = new MetadataBatchService();

  getContentMetadata(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<ContentMetadata> {
    return getCachedContentMetadata(userId, contentId, contentType, () =>
      this.single.getContentMetadata(userId, contentId, contentType)
    );
  }

  getBatchContentMetadata(
    userId: string | undefined,
    contentIds: string[],
    contentType: string = "media"
  ): Promise<BatchMetadataItem[]> {
    return getCachedBatchMetadata(userId, contentIds, contentType, missing =>
      this.batch.getBatchContentMetadata(userId, missing, contentType)
    );
  }
}

export default new MetadataService();
