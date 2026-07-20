import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Configure S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT, // e.g., https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  // Disable checksum calculation to avoid x-amz-decoded-content-length header issues
  forcePathStyle: true,
});

interface UploadApiResponse {
  secure_url: string;
  objectKey: string;
  version?: number;
}

export interface ExactObjectUpload {
  objectKey: string;
  secure_url: string;
}

class FileUploadService {
  /**
   * Upload to an exact key. Required for HLS because playlist-relative segment
   * paths must match object keys exactly.
   */
  async uploadObjectExact(
    objectKey: string,
    body: Buffer | Uint8Array | string,
    mimeType: string,
    cacheControl = "public, max-age=31536000, immutable"
  ): Promise<ExactObjectUpload> {
    const contentLength =
      typeof body === "string" ? Buffer.byteLength(body) : body.byteLength;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: objectKey,
        Body: body,
        ContentType: mimeType,
        ContentLength: contentLength,
        CacheControl: cacheControl,
      })
    );
    return {
      objectKey,
      secure_url: this.generatePublicUrl(objectKey),
    };
  }

  /** Promote a private staging object without downloading it through the API. */
  async copyObject(
    sourceKey: string,
    destinationKey: string,
    mimeType: string,
    cacheControl = "public, max-age=31536000, immutable"
  ): Promise<ExactObjectUpload> {
    const bucket = process.env.R2_BUCKET;
    if (!bucket) throw new Error("R2_BUCKET is required");
    const encodedSource = `${bucket}/${sourceKey
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: destinationKey,
        CopySource: encodedSource,
        ContentType: mimeType,
        CacheControl: cacheControl,
        MetadataDirective: "REPLACE",
      })
    );
    await this.headObject(destinationKey);
    return {
      objectKey: destinationKey,
      secure_url: this.generatePublicUrl(destinationKey),
    };
  }

  /**
   * Upload media file to Cloudflare R2 with immutable URL structure
   * @param fileBuffer - File buffer to upload
   * @param folderPath - Folder path (e.g., "media-videos", "media-thumbnails")
   * @param mimeType - MIME type of the file
   * @param contentId - Optional content ID for immutable URL structure (media/{type}/{contentId}/filename)
   * @param filename - Optional custom filename (without extension). Defaults to standard name based on type
   */
  async uploadMedia(
    fileBuffer: Buffer,
    folderPath: string,
    mimeType: string,
    contentId?: string,
    filename?: string
  ): Promise<UploadApiResponse> {
    try {
      const isVideoOrAudio =
        mimeType.startsWith("video") || mimeType.startsWith("audio");
      const isDocument =
        mimeType === "application/pdf" || mimeType === "application/epub+zip";
      const isImage = mimeType.startsWith("image");

      const extensionMap: { [key: string]: string } = {
        "application/pdf": ".pdf",
        "application/epub+zip": ".epub",
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/ogg": ".ogg",
        "video/avi": ".avi",
        "video/mov": ".mov",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/wav": ".wav",
        "audio/ogg": ".ogg",
        "audio/aac": ".aac",
        "audio/flac": ".flac",
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/jpg": ".jpg",
      };
      const extension = extensionMap[mimeType] || "";

      if (!extension) {
        throw new Error(`Unsupported MIME type: ${mimeType}`);
      }

      // Generate immutable URL structure: {folderPath}/{contentId}-{filename}.ext
      let objectKey: string;
      if (contentId && filename) {
        // Flat structure: media-videos/{contentId}-{filename}.ext
        objectKey = `${folderPath}/${contentId}-${filename}${extension}`;
      } else if (contentId) {
        // Use contentId but default filename
        const defaultFilename = isVideoOrAudio ? "video" : isDocument ? "document" : "image";
        objectKey = `${folderPath}/${contentId}-${defaultFilename}${extension}`;
      } else {
        // Fallback to old structure for backward compatibility
        objectKey = `${folderPath}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}${extension}`;
      }

      console.log("Uploading to Cloudflare R2:", {
        folderPath,
        mimeType,
        objectKey,
      });

      // Prepare optimized headers for streaming media
      const metadata: Record<string, string> = {};
      let cacheControl = "public, max-age=31536000, immutable";

      // Video/Audio streaming optimizations
      if (isVideoOrAudio) {
        // For streaming media, ensure Range requests are supported (R2 supports this by default)
        // Use metadata to mark files as streamable
        metadata["streamable"] = "true";
        metadata["content-type"] = mimeType;
        // Videos and audio benefit from aggressive caching but need to support Range requests
        cacheControl = "public, max-age=31536000, immutable";
      } else if (isDocument) {
        // PDFs and ebooks should be cacheable but with shorter max-age for updates
        cacheControl = "public, max-age=86400"; // 1 day
        metadata["downloadable"] = "true";
      }

      const putCommand = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: objectKey,
        Body: fileBuffer,
        ContentType: mimeType,
        ContentLength: fileBuffer.length,
        // Strong caching for immutable uploaded assets (served directly from R2/Cloudflare).
        // This reduces repeat downloads and improves perceived playback speed.
        CacheControl: cacheControl,
        // Add metadata for Cloudflare optimization hints
        Metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });

      await s3Client.send(putCommand);

      // Generate permanent public URL instead of signed URL
      const publicUrl = this.generatePublicUrl(objectKey);

      console.log("Cloudflare R2 upload success:", {
        secure_url: publicUrl,
        objectKey,
      });

      return {
        secure_url: publicUrl,
        objectKey: objectKey,
        version: Math.floor(Date.now() / 1000),
      };
    } catch (error: any) {
      console.error("Cloudflare R2 upload error:", error);
      throw new Error(
        `Failed to upload ${mimeType.startsWith("video")
          ? "video"
          : mimeType.startsWith("audio")
            ? "audio"
            : mimeType.startsWith("image")
              ? "image"
              : "document"
        }: ${error.message}`
      );
    }
  }

  async deleteMedia(objectKey: string): Promise<void> {
    try {
      console.log("Deleting from Cloudflare R2:", { objectKey });

      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: objectKey,
      });
      await s3Client.send(deleteCommand);

      console.log("Cloudflare R2 deletion success:", { objectKey });
    } catch (error: any) {
      console.error("Cloudflare R2 deletion error:", error);
      throw new Error(
        `Failed to delete media from Cloudflare R2: ${error.message}`
      );
    }
  }

  async getPresignedGetUrl(
    objectKey: string,
    expiresInSeconds: number = 3600 // 1 hour (reverted - not used for video playback)
  ): Promise<string> {
    const signedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: objectKey,
      }),
      { expiresIn: expiresInSeconds }
    );
    return signedUrl;
  }

  /**
   * Generate permanent public URL for R2 object
   * Follows Cloudflare CDN URL structure for optimal caching
   */
  generatePublicUrl(objectKey: string): string {
    const customDomain = process.env.R2_CUSTOM_DOMAIN;

    if (customDomain) {
      return `https://${customDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/${objectKey}`;
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "R2_CUSTOM_DOMAIN is required in production (hard-coded r2.dev URLs are not allowed)"
      );
    }

    const publicDevUrl =
      process.env.R2_PUBLIC_DEV_URL ||
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev";
    // r2.dev and R2 custom domains are already bound to a bucket. Prefixing
    // the bucket name creates a non-existent object path.
    return `${publicDevUrl.replace(/\/+$/, "")}/${objectKey}`;
  }

  /** Presigned PUT for direct-to-R2 client uploads (single-object). */
  async getPresignedPutUrl(
    objectKey: string,
    mimeType: string,
    sizeBytes?: number,
    expiresInSeconds = 3600
  ): Promise<string> {
    return getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: objectKey,
        ContentType: mimeType,
        ...(sizeBytes ? { ContentLength: sizeBytes } : {}),
      }),
      { expiresIn: expiresInSeconds }
    );
  }

  async headObject(objectKey: string) {
    return s3Client.send(
      new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: objectKey,
      })
    );
  }
}

export default new FileUploadService();
