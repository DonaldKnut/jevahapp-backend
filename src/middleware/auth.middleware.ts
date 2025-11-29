import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { BlacklistedToken } from "../models/blacklistedToken.model";

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
    // Check if token is blacklisted
    const isBlacklisted = await BlacklistedToken.findOne({ token });
    if (isBlacklisted) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: Token has been invalidated",
      });
      return;
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
    };

    req.userId = decoded.userId;

    // Fetch user and attach full user to request
    const user = await User.findById(decoded.userId).select(
      "role isVerifiedCreator isVerifiedVendor isVerifiedChurch isBanned banUntil"
    );
    if (!user) {
      res.status(401).json({ success: false, message: "User not found" });
      return;
    }

    // Check if user is banned
    if (user.isBanned) {
      // Check if ban has expired
      if (user.banUntil && new Date() > user.banUntil) {
        // Ban expired, unban user
        await User.findByIdAndUpdate(decoded.userId, {
          isBanned: false,
          banUntil: undefined,
        });
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
    res.status(401).json({
      success: false,
      message: "Invalid token",
      detail: error.message,
    });
  }
};
