import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { BlacklistedToken } from "../models/blacklistedToken.model";
import logger from "../utils/logger";
import { redisSafe } from "../lib/redis";
import { JWT_SECRET } from "../config/tokenConfig";

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Try to get token from Authorization header first
  let token: string | undefined;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else {
    // If no Authorization header, try to get refresh token from cookie and auto-refresh
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      try {
        // Dynamic import to avoid circular dependencies
        const authServiceModule = await import("../service/auth.service");
        const authService = authServiceModule.default;
        const refreshResult = await authService.refreshToken(refreshToken);
        
        // Set new access token in response header for client to pick up
        res.setHeader("X-New-Access-Token", refreshResult.accessToken);
        
        // Use the new access token for this request
        token = refreshResult.accessToken;
        
        // Fetch full user info for role checks
        const user = await User.findById(refreshResult.user.id).select(
          "role isVerifiedCreator isVerifiedVendor isVerifiedChurch isBanned banUntil"
        );
        
        if (!user) {
          res.status(401).json({ success: false, message: "User not found" });
          return;
        }

        // Check if user is banned
        if (user.isBanned) {
          if (user.banUntil && new Date() > user.banUntil) {
            await User.findByIdAndUpdate(refreshResult.user.id, {
              isBanned: false,
              banUntil: undefined,
            });
          } else {
            res.status(403).json({
              success: false,
              message: "Account is banned",
            });
            return;
          }
        }
        
        // Attach user info
        req.userId = refreshResult.user.id.toString();
        req.user = {
          role: user.role,
          isVerifiedCreator: user.isVerifiedCreator,
          isVerifiedVendor: user.isVerifiedVendor,
          isVerifiedChurch: user.isVerifiedChurch,
        };
        
        // Continue with the request using the new token
        return next();
      } catch (error) {
        // Refresh token invalid/expired, clear cookie and require login
        res.clearCookie("refreshToken", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
          path: "/",
        });
        res.status(401).json({
          success: false,
          message: "Session expired. Please login again.",
        });
        return;
      }
    }
  }

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Unauthorized: No token provided",
    });
    return;
  }

  try {
    // Verify JWT first (fast, no DB query)
    // Use the same JWT_SECRET constant as the auth service for consistency
    if (!JWT_SECRET) {
      logger.error("JWT_SECRET is not defined in environment variables");
      res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
      return;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
    };

    req.userId = decoded.userId;

    // Always check blacklist in DB (preserves auth behavior)
    const isBlacklisted = await BlacklistedToken.findOne({ token }).lean();

    if (isBlacklisted) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: Token has been invalidated",
      });
      return;
    }

    // Cache user lookup briefly in Redis (optimization only)
    const userCacheKey = `auth:user:${decoded.userId}`;
    const cachedUser = await redisSafe<any | null>(
      "authUserGet",
      async (r) => {
        const u = await r.get<any>(userCacheKey);
        return u || null;
      },
      null
    );

    const user =
      cachedUser ||
      (await User.findById(decoded.userId)
        .select(
          "role isVerifiedCreator isVerifiedVendor isVerifiedChurch isBanned banUntil banReason"
        )
        .lean());

    if (!user) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }

    // Refresh cache (best-effort)
    if (!cachedUser) {
      redisSafe(
        "authUserSet",
        async (r) => {
          await r.set(userCacheKey, user, { ex: 120 }); // 2 minutes
          return true;
        },
        false
      ).catch(() => {});
    }

    // Check if user is banned (non-blocking update if expired)
    if (user.isBanned) {
      // Check if ban has expired
      if (user.banUntil && new Date() > user.banUntil) {
        // Ban expired, unban user (non-blocking - don't wait for update)
        User.findByIdAndUpdate(decoded.userId, {
          isBanned: false,
          banUntil: undefined,
        }).catch(err => logger.warn("Failed to unban user", { userId: decoded.userId, error: err.message }));
      } else {
        res.status(403).json({
          success: false,
          message: "Account is banned",
          banReason: user.banReason || "Violation of community guidelines",
          banUntil: user.banUntil || null,
        });
        return;
      }
    }

    // Attach the user object for role checks
    req.user = {
      role: user.role,
      isVerifiedCreator: user.isVerifiedCreator,
      isVerifiedVendor: user.isVerifiedVendor,
      isVerifiedChurch: user.isVerifiedChurch,
    };

    next();
  } catch (error: any) {
    // Log JWT verification errors for debugging
    const errorMessage = error.message || "Unknown error";
    const isSignatureError = errorMessage.includes("signature") || errorMessage.includes("invalid signature");
    
    if (isSignatureError) {
      logger.error("JWT signature verification failed", {
        error: errorMessage,
        tokenPreview: token ? `${token.substring(0, 20)}...` : "no token",
        url: req.url,
        method: req.method,
      });
    }
    
    res.status(401).json({
      success: false,
      message: "Invalid token",
      detail: errorMessage,
    });
  }
};
