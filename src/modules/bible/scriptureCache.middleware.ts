import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

const ONE_YEAR_SECONDS = 31536000;
const ONE_DAY_SECONDS = 86400;
const ONE_WEEK_SECONDS = 604800;

/**
 * Cache-buster carried by clients from `corpusVersion` in the translation
 * catalog. It is a cache key only and never selects data: a request with a
 * stale `v` still gets current text, it just lands on an abandoned cache entry.
 */
export const CORPUS_VERSION_QUERY_PARAM = "v";

/**
 * `immutable` for a year is only honest when the URL changes with the content.
 * Scripture text is stable, but the rows behind it are not: a re-import or a
 * corrected verse changes the response at a fixed URL, and an immutable edge
 * entry would pin the wrong text for a year with no lever but a manual purge.
 *
 * So the promise is tied to the URL, not the endpoint:
 *   - `?v=<corpusVersion>` present → versioned URL, safe to freeze for a year.
 *   - no `v`                       → one day, then revalidate against the ETag,
 *                                    servable stale for a week while doing so.
 *
 * Either way an ETag is emitted and `If-None-Match` returns a bodyless 304.
 *
 * Register this BEFORE cacheMiddleware on a route: res.json wrappers run in
 * reverse registration order, so the earliest-registered wrapper sets the
 * final Cache-Control/ETag values.
 */
export function scriptureCacheHeaders() {
  const versionedCacheControl = `public, max-age=${ONE_YEAR_SECONDS}, immutable`;
  const unversionedCacheControl = `public, max-age=${ONE_DAY_SECONDS}, stale-while-revalidate=${ONE_WEEK_SECONDS}`;

  return (request: Request, response: Response, next: NextFunction) => {
    if (request.method !== "GET") return next();

    const versioned = Boolean(
      String(request.query[CORPUS_VERSION_QUERY_PARAM] || "").trim()
    );

    const originalJson = response.json.bind(response);
    response.json = function patchedJson(body: any) {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return originalJson(body);
      }

      const etag = `"${crypto
        .createHash("sha1")
        .update(JSON.stringify(body) || "")
        .digest("base64")}"`;

      response.setHeader("ETag", etag);
      response.setHeader(
        "Cache-Control",
        versioned ? versionedCacheControl : unversionedCacheControl
      );
      response.setHeader("Vary", "Accept-Encoding");

      const ifNoneMatch = request.headers["if-none-match"];
      if (
        typeof ifNoneMatch === "string" &&
        ifNoneMatch
          .split(",")
          .some(tag => tag.trim().replace(/^W\//, "") === etag)
      ) {
        response.status(304).end();
        return response;
      }

      return originalJson(body);
    } as typeof response.json;

    next();
  };
}
