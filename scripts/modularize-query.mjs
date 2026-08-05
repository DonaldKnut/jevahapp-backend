/**
 * Split media/query.service.ts into src/service/media/query/*
 */
import fs from "fs";
import path from "path";
import { extractClassMethod } from "./extract-ts-method.mjs";

const root = process.cwd();
const bakPath = path.join(root, "src/service/media/query.service.ts.bak");

function write(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r\n/g, "\n"));
  console.log("wrote", rel, content.split("\n").length);
}

const lines = fs.readFileSync(bakPath, "utf8").split(/\r?\n/);

function toExportedFunction(name) {
  let body = extractClassMethod(lines, name).map(l =>
    l.startsWith("  ") ? l.slice(2) : l
  );
  let first = body[0]
    .replace(/^private\s+async\s+/, "export async function ")
    .replace(/^private\s+/, "export function ")
    .replace(/^async\s+/, "export async function ");
  if (!first.startsWith("export ")) first = "export " + first;
  body[0] = first;
  let text = body
    .join("\n")
    .replace(/this\.buildAggregationPipeline\(/g, "buildAggregationPipeline(");
  console.log("extracted", name, text.split("\n").length);
  return text + "\n";
}

function joinMethods(names) {
  return names.map(toExportedFunction).join("\n");
}

write(
  "src/service/media/query/getAllMedia.ts",
  `import { Media } from "../../../models/media.model";
import { User } from "../../../models/user.model";
import { DurationRangeKey } from "../types";
import { buildMediaVisibilityQuery } from "./visibility";
import { enrichMediaPlaybackFields } from "../playbackFields";

` + joinMethods(["getAllMedia"])
);

write(
  "src/service/media/query/aggregationPipeline.ts",
  `import { Types } from "mongoose";
import { PUBLIC_MEDIA_FILTER } from "../../../lib/publicMediaVisibility";

` + joinMethods(["buildAggregationPipeline"])
);

write(
  "src/service/media/query/allContentFeed.ts",
  `import { Media } from "../../../models/media.model";
import { UserViewedMedia } from "../../../models/userViewedMedia.model";
import { Types } from "mongoose";
import enhancedMediaService from "../../enhancedMedia.service";
import logger from "../../../utils/logger";
import { LeanUserViewedMedia } from "../types";
import { enrichMediaPlaybackFields } from "../playbackFields";
import { buildAggregationPipeline } from "./aggregationPipeline";

` + joinMethods(["getAllContentForAllTab"])
);

write(
  "src/service/media/query/recommendations.ts",
  `import { Media } from "../../../models/media.model";
import { UserViewedMedia } from "../../../models/userViewedMedia.model";
import { Types } from "mongoose";
import enhancedMediaService from "../../enhancedMedia.service";
import { recommendationEngineService } from "../../recommendationEngine.service";
import logger from "../../../utils/logger";
import { LeanUserViewedMedia } from "../types";
import { enrichMediaPlaybackFields } from "../playbackFields";
import { PUBLIC_MEDIA_FILTER } from "../../../lib/publicMediaVisibility";

` + joinMethods(["getRecommendationsForAllContent"])
);

write(
  "src/service/media/query/getById.ts",
  `import { Media } from "../../../models/media.model";
import { Types } from "mongoose";
import { enrichMediaPlaybackFields } from "../playbackFields";

` + joinMethods(["getMediaByIdentifier", "getRecentMedia"])
);

write(
  "src/service/media/query.service.ts",
  `import { getAllMedia } from "./query/getAllMedia";
import { getAllContentForAllTab } from "./query/allContentFeed";
import { getRecommendationsForAllContent } from "./query/recommendations";
import { getMediaByIdentifier, getRecentMedia } from "./query/getById";

export class MediaQueryService {
  async getAllMedia(
    filters: any = {},
    options: { enforceModeration?: boolean; actingUserId?: string } = {
      enforceModeration: true,
    }
  ) {
    return getAllMedia(filters, options);
  }

  async getAllContentForAllTab(options?: any) {
    return getAllContentForAllTab(options);
  }

  async getRecommendationsForAllContent(
    userId?: string,
    options?: { limitPerSection?: number; mood?: string }
  ) {
    return getRecommendationsForAllContent(userId, options);
  }

  async getMediaByIdentifier(
    mediaIdentifier: string,
    options: { actingUserId?: string; userRole?: string } = {}
  ) {
    return getMediaByIdentifier(mediaIdentifier, options);
  }

  async getRecentMedia(limit: number) {
    return getRecentMedia(limit);
  }
}

export const mediaQueryService = new MediaQueryService();
`
);

console.log("done query");
