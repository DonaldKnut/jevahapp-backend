import jwt from "jsonwebtoken";
import { User } from "../../models/user.model";
import { BlacklistedToken } from "../../models/blacklistedToken.model";
import logger from "../../utils/logger";
import { AuthenticatedUser } from "../types";

export function createSocketAuthMiddleware(
  connectedUsers: Map<string, AuthenticatedUser>
) {
  return async (socket: any, next: (err?: Error) => void) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "") ||
        socket.handshake.query.token;

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      const { JWT_SECRET } = await import("../../config/tokenConfig");
      if (!JWT_SECRET) {
        return next(new Error("Server configuration error: JWT_SECRET not defined"));
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const isBlacklisted = await BlacklistedToken.findOne({ token });
      if (isBlacklisted) {
        return next(new Error("Token has been invalidated"));
      }

      const user = await User.findById(decoded.userId).select(
        "email firstName lastName role"
      );
      if (!user) {
        return next(new Error("User not found"));
      }

      const authenticatedUser: AuthenticatedUser = {
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };

      socket.data.user = authenticatedUser;
      connectedUsers.set(socket.id, authenticatedUser);

      logger.info("User connected via Socket.IO", {
        userId: authenticatedUser.userId,
        email: authenticatedUser.email,
      });

      next();
    } catch (error) {
      logger.error("Socket authentication failed", {
        error: (error as Error).message,
      });
      next(new Error("Authentication failed"));
    }
  };
}
