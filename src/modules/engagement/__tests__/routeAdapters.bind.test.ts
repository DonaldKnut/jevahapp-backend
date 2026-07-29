/**
 * Smoke: binders register the paths FE / docs expect (stack inspection only).
 * Mock auth/rate-limit imports so JWT_SECRET is not required at load time.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-route-bind";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test-refresh-secret-for-route-bind";

jest.mock("../../../middleware/auth.middleware", () => ({
  verifyToken: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock("../../../middleware/optionalAuth.middleware", () => ({
  verifyTokenOptional: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock("../../../middleware/commentRateLimiter.middleware", () => ({
  commentRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock("../../../middleware/idempotency.middleware", () => ({
  idempotencyMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock("../../../middleware/deprecation.middleware", () => ({
  deprecatedEndpoint: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock("../comments/comments.controller", () => ({
  addContentComment: jest.fn(),
  removeContentComment: jest.fn(),
  getContentComments: jest.fn(),
  getCommentReplies: jest.fn(),
  editContentComment: jest.fn(),
  reportContentComment: jest.fn(),
  hideContentComment: jest.fn(),
  toggleCommentReaction: jest.fn(),
}));

import express from "express";
import {
  bindContentComments,
  bindInteractionsCommentAliases,
} from "../shared/routeAdapters";

describe("bindContentComments / bindInteractionsCommentAliases", () => {
  function layerPaths(router: express.Router): string[] {
    const stack = (router as any).stack || [];
    return stack
      .filter((l: any) => l.route)
      .map((l: any) => {
        const methods = Object.keys(l.route.methods)
          .filter((m) => l.route.methods[m])
          .map((m) => m.toUpperCase())
          .join(",");
        return `${methods} ${l.route.path}`;
      });
  }

  it("registers canonical content comment surface including reaction", () => {
    const router = express.Router();
    bindContentComments(router);
    const paths = layerPaths(router);

    expect(paths).toEqual(
      expect.arrayContaining([
        "POST /comments/upload-image",
        "POST /:contentType/:contentId/comment",
        "GET /:contentType/:contentId/comments",
        "POST /:contentId/comment",
        "GET /:contentId/comments",
        "GET /comments/:commentId/replies",
        "PATCH /comments/:commentId",
        "DELETE /comments/:commentId",
        "POST /comments/:commentId/report",
        "POST /comments/:commentId/hide",
        "POST /comments/:commentId/reaction",
      ])
    );
  });

  it("registers interactions aliases with reaction parity", () => {
    const router = express.Router();
    bindInteractionsCommentAliases(router);
    const paths = layerPaths(router);

    expect(paths).toEqual(
      expect.arrayContaining([
        "DELETE /comments/:commentId",
        "POST /comments/:commentId/reaction",
        "GET /:contentType/:contentId/comments",
      ])
    );
  });
});
