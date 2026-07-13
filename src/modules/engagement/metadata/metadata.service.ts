import { BatchMetadataItem, ContentMetadata } from "../shared/engagement.types";
import { MetadataSingleService } from "./metadata.single";
import { MetadataBatchService } from "./metadata.batch";

export class MetadataService {
  private readonly single = new MetadataSingleService();
  private readonly batch = new MetadataBatchService();

  getContentMetadata(
    userId: string,
    contentId: string,
    contentType: string
  ): Promise<ContentMetadata> {
    return this.single.getContentMetadata(userId, contentId, contentType);
  }

  getBatchContentMetadata(
    userId: string | undefined,
    contentIds: string[],
    contentType?: string
  ): Promise<BatchMetadataItem[]> {
    return this.batch.getBatchContentMetadata(userId, contentIds, contentType);
  }
}

export default new MetadataService();
