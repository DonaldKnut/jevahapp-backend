import { Request, Response, NextFunction, Router, RequestHandler } from "express";
import { verifyToken } from "../../../middleware/auth.middleware";
import { verifyTokenOptional } from "../../../middleware/optionalAuth.middleware";
import { commentRateLimiter as redisCommentRateLimiter } from "../../../middleware/commentRateLimiter.middleware";
import { idempotencyMiddleware } from "../../../middleware/idempotency.middleware";
import { deprecatedEndpoint } from "../../../middleware/deprecation.middleware";
import {
  addContentComment,
  removeContentComment,
  getContentComments,
  getCommentReplies,
  editContentComment,
  reportContentComment,
  hideContentComment,
  toggleCommentReaction,
} from "../comments/comments.controller";
import {
  parseCommentMultipartIfNeeded,
  commentImageUploadMiddleware,
  uploadCommentImage,
} from "../comments/comment.upload";

/** Set req.params.contentType when the route omits it (FE type-omitted fallbacks). */
export function defaultContentType(fallback: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.params.contentType) {
      (req.params as Record<string, string>).contentType = fallback;
    }
    next();
  };
}

/** Map :mediaId → :contentId and default contentType to media (media shim paths). */
export function mapMediaIdToContentParams(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const mediaId = req.params.mediaId || req.params.id;
    if (mediaId && !req.params.contentId) {
      (req.params as Record<string, string>).contentId = mediaId;
    }
    if (!req.params.contentType) {
      (req.params as Record<string, string>).contentType = "media";
    }
    next();
  };
}

export type BindContentCommentsOptions = {
  /** Register type-omitted /:contentId/comment(s) aliases (default true for content router) */
  typeOmittedAliases?: boolean;
  /** Register comment-id mutation routes (edit/delete/report/hide/reaction/replies) */
  commentIdRoutes?: boolean;
  /** Include POST reaction on this router */
  reaction?: boolean;
};

/**
 * Register the content-comments HTTP surface once.
 * Call on contentRouter for the full surface; use subsets for legacy/media aliases.
 */
export function bindContentComments(
  router: Router,
  options: BindContentCommentsOptions = {}
): void {
  const {
    typeOmittedAliases = true,
    commentIdRoutes = true,
    reaction = true,
  } = options;

  // Dedicated upload-then-JSON path (must be before /comments/:commentId/*)
  router.post(
    "/comments/upload-image",
    verifyToken,
    redisCommentRateLimiter,
    commentImageUploadMiddleware,
    uploadCommentImage as RequestHandler
  );

  const addCommentChain: RequestHandler[] = [
    verifyToken,
    idempotencyMiddleware(),
    redisCommentRateLimiter,
    parseCommentMultipartIfNeeded,
    addContentComment as RequestHandler,
  ];

  router.post("/:contentType/:contentId/comment", ...addCommentChain);

  router.get(
    "/:contentType/:contentId/comments",
    verifyTokenOptional,
    getContentComments as RequestHandler
  );

  if (typeOmittedAliases) {
    router.post(
      "/:contentId/comment",
      defaultContentType("media"),
      ...addCommentChain
    );
    router.get(
      "/:contentId/comments",
      defaultContentType("media"),
      verifyTokenOptional,
      getContentComments as RequestHandler
    );
  }

  if (commentIdRoutes) {
    router.get(
      "/comments/:commentId/replies",
      verifyTokenOptional,
      getCommentReplies as RequestHandler
    );
    router.patch(
      "/comments/:commentId",
      verifyToken,
      redisCommentRateLimiter,
      parseCommentMultipartIfNeeded,
      editContentComment as RequestHandler
    );
    router.delete(
      "/comments/:commentId",
      verifyToken,
      redisCommentRateLimiter,
      removeContentComment as RequestHandler
    );
    router.post(
      "/comments/:commentId/report",
      verifyToken,
      redisCommentRateLimiter,
      reportContentComment as RequestHandler
    );
    router.post(
      "/comments/:commentId/hide",
      verifyToken,
      redisCommentRateLimiter,
      hideContentComment as RequestHandler
    );
  }

  if (reaction) {
    router.post(
      "/comments/:commentId/reaction",
      verifyToken,
      idempotencyMiddleware(),
      redisCommentRateLimiter,
      toggleCommentReaction as RequestHandler
    );
  }
}

/**
 * FE fallback under /api/media/:mediaId/comments|comment.
 * Same handlers; deprecation headers point at canonical content paths.
 */
export function bindMediaCommentShims(router: Router): void {
  router.get(
    "/:mediaId/comments",
    verifyTokenOptional,
    deprecatedEndpoint("GET /api/content/media/:contentId/comments"),
    mapMediaIdToContentParams(),
    getContentComments as RequestHandler
  );

  router.post(
    "/:mediaId/comment",
    verifyToken,
    idempotencyMiddleware(),
    redisCommentRateLimiter,
    deprecatedEndpoint("POST /api/content/media/:contentId/comment"),
    mapMediaIdToContentParams(),
    parseCommentMultipartIfNeeded,
    addContentComment as RequestHandler
  );
}

/**
 * Thin aliases under /api/interactions for older clients.
 * Prefer /api/content/… — Deprecation headers point at successors.
 */
export function bindInteractionsCommentAliases(router: Router): void {
  router.delete(
    "/comments/:commentId",
    deprecatedEndpoint("DELETE /api/content/comments/:commentId"),
    verifyToken,
    redisCommentRateLimiter,
    removeContentComment as RequestHandler
  );
  router.post(
    "/comments/:commentId/reaction",
    deprecatedEndpoint("POST /api/content/comments/:commentId/reaction"),
    verifyToken,
    idempotencyMiddleware(),
    redisCommentRateLimiter,
    toggleCommentReaction as RequestHandler
  );
  router.get(
    "/:contentType/:contentId/comments",
    deprecatedEndpoint("GET /api/content/:contentType/:contentId/comments"),
    verifyTokenOptional,
    getContentComments as RequestHandler
  );
}
