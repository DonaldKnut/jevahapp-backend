import { Types } from "mongoose";
import { parseBatchMetadataBody } from "../metadata/metadata.batchRequest";

describe("parseBatchMetadataBody", () => {
  const validId = new Types.ObjectId().toString();

  it("parses canonical items format", () => {
    const result = parseBatchMetadataBody({
      items: [{ contentType: "media", contentId: validId }],
    });
    expect(result).toEqual([{ contentType: "media", contentId: validId }]);
  });

  it("parses legacy contentIds format", () => {
    const result = parseBatchMetadataBody({
      contentIds: [validId],
      contentType: "devotional",
    });
    expect(result).toEqual([{ contentType: "devotional", contentId: validId }]);
  });

  it("defaults contentType to media for legacy format", () => {
    const result = parseBatchMetadataBody({ contentIds: [validId] });
    expect(result).toEqual([{ contentType: "media", contentId: validId }]);
  });

  it("returns null when no valid items", () => {
    expect(parseBatchMetadataBody({ items: [] })).toBeNull();
    expect(parseBatchMetadataBody({ contentIds: [] })).toBeNull();
    expect(parseBatchMetadataBody({ items: [{ contentType: "media", contentId: "bad" }] })).toBeNull();
    expect(parseBatchMetadataBody({})).toBeNull();
  });
});
