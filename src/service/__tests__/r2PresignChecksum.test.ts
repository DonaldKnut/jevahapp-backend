import {
  createR2S3Client,
  requiredBrowserPutHeaders,
  signBrowserPutUrl,
} from "../fileUpload.service";

const dummyCreds = {
  accessKeyId: "AKIAFAKE",
  secretAccessKey: "secretfake",
};

describe("R2 browser presign checksums", () => {
  const prev = {
    endpoint: process.env.R2_ENDPOINT,
    key: process.env.R2_ACCESS_KEY_ID,
    secret: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
  };

  beforeAll(() => {
    process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.R2_ACCESS_KEY_ID = dummyCreds.accessKeyId;
    process.env.R2_SECRET_ACCESS_KEY = dummyCreds.secretAccessKey;
    process.env.R2_BUCKET = "jevah";
  });

  afterAll(() => {
    if (prev.endpoint === undefined) delete process.env.R2_ENDPOINT;
    else process.env.R2_ENDPOINT = prev.endpoint;
    if (prev.key === undefined) delete process.env.R2_ACCESS_KEY_ID;
    else process.env.R2_ACCESS_KEY_ID = prev.key;
    if (prev.secret === undefined) delete process.env.R2_SECRET_ACCESS_KEY;
    else process.env.R2_SECRET_ACCESS_KEY = prev.secret;
    if (prev.bucket === undefined) delete process.env.R2_BUCKET;
    else process.env.R2_BUCKET = prev.bucket;
  });

  it("does not sign empty CRC32 on browser PUTs", async () => {
    const url = await signBrowserPutUrl({
      client: createR2S3Client({
        endpoint: "https://example.r2.cloudflarestorage.com",
        credentials: dummyCreds,
      }),
      bucket: "jevah",
      key: "audio/artist/demo/original.mp3",
      mimeType: "audio/mpeg",
      sizeBytes: 1024,
      expiresInSeconds: 900,
    });
    expect(url).not.toMatch(/x-amz-checksum/i);
    expect(url).not.toMatch(/x-amz-sdk-checksum-algorithm/i);
    expect(url).not.toMatch(/AAAAAA==/);

    const signed =
      new URL(url).searchParams.get("X-Amz-SignedHeaders") || "";
    expect(signed).not.toContain("x-amz-checksum");
  });

  it("returns Content-Type for the browser to send", () => {
    expect(requiredBrowserPutHeaders("audio/mpeg")).toEqual({
      "Content-Type": "audio/mpeg",
    });
  });
});
