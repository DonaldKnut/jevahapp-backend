# 🔐 Authentication Issues - Backend Response

## 🚨 **Critical Issues Identified**

### **1. REST Endpoint Authentication Issues**

#### **✅ REST Endpoints DO Require Bearer Token**
All notification endpoints correctly require `Authorization: Bearer <token>`:

```typescript
// src/routes/notification.routes.ts
router.get("/", verifyToken, notificationController.getUserNotifications.bind(notificationController));
router.patch("/:notificationId/read", verifyToken, notificationController.markAsRead.bind(notificationController));
router.patch("/mark-all-read", verifyToken, notificationController.markAllAsRead.bind(notificationController));
router.get("/preferences", verifyToken, notificationController.getNotificationPreferences.bind(notificationController));
router.put("/preferences", verifyToken, notificationController.updateNotificationPreferences.bind(notificationController));
router.get("/stats", verifyToken, notificationController.getNotificationStats.bind(notificationController));
```

#### **✅ Authentication Middleware is Correct**
```typescript
// src/middleware/auth.middleware.ts
export const verifyToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      message: "Unauthorized: No token provided",
    });
    return;
  }
  
  const token = authHeader.split(" ")[1];
  // ... JWT verification logic
};
```

#### **✅ Response Format is Correct**
```json
{
  "success": true,
  "data": { ... }
}
```

**401 Response:**
```json
{
  "success": false,
  "message": "Unauthorized: No token provided"
}
```

---

### **2. Socket.IO Authentication Issues**

#### **❌ CRITICAL BUG: Incorrect verifyToken Usage**
The Socket.IO service is incorrectly calling the `verifyToken` middleware function:

```typescript
// ❌ WRONG - This is the issue!
const decoded = await verifyToken(token, {} as any, {} as any);
```

**Problem**: `verifyToken` is an Express middleware function that expects `(req, res, next)` parameters, but it's being called with a raw token.

#### **✅ CORRECT Socket.IO Authentication Fix**

```typescript
// src/service/socket.service.ts - FIXED VERSION
private setupMiddleware(): void {
  this.io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "") ||
        socket.handshake.query.token;

      if (!token) {
        return next(new Error("Authentication token required"));
      }

      // ✅ FIXED: Direct JWT verification instead of middleware call
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      
      // Check if token is blacklisted
      const isBlacklisted = await BlacklistedToken.findOne({ token });
      if (isBlacklisted) {
        return next(new Error("Token has been invalidated"));
      }

      const user = await User.findById(decoded.userId).select("email firstName lastName role");
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
      this.connectedUsers.set(socket.id, authenticatedUser);

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
  });
}
```

#### **✅ Socket.IO Accepts Multiple Token Locations**
The fixed code accepts tokens from:
1. `socket.handshake.auth.token`
2. `socket.handshake.headers.authorization` (as "Bearer <token>")
3. `socket.handshake.query.token`

---

### **3. Token Refresh Endpoint**

#### **❌ MISSING: No Refresh Endpoint**
The `/api/auth/refresh` endpoint does **NOT** exist in your backend.

#### **✅ Current Token Expiry**
```typescript
// src/service/auth.service.ts
const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
  expiresIn: "7d", // ✅ Tokens are long-lived (7 days)
});
```

#### **✅ RECOMMENDED: Implement Token Refresh**

Add this to `src/routes/auth.route.ts`:

```typescript
// POST /refresh
// Refreshes an existing JWT token
router.post(
  "/refresh",
  authRateLimiter,
  asyncHandler(authController.refreshToken)
);
```

Add this to `src/controllers/auth.controller.ts`:

```typescript
async refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
      return;
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as { userId: string };
    
    // Check if user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Generate new access token
    const newToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.json({
      success: true,
      token: newToken,
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
}
```

---

### **4. CORS Configuration**

#### **✅ CORS is Properly Configured**
```typescript
// src/app.ts
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
```

---

## 🛠️ **Immediate Fixes Required**

### **Fix 1: Socket.IO Authentication**
Replace the incorrect `verifyToken` call in `src/service/socket.service.ts`:

```typescript
// Replace line 89 with direct JWT verification
const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
```

### **Fix 2: Add Required Imports**
Add to `src/service/socket.service.ts`:

```typescript
import jwt from "jsonwebtoken";
import { BlacklistedToken } from "../models/blacklistedToken.model";
```

### **Fix 3: Implement Token Refresh (Optional)**
Add the refresh endpoint as shown above.

---

## 📋 **Frontend Implementation Confirmation**

### **✅ REST Endpoints - Correct Usage**
```typescript
// ✅ CORRECT - This should work after Socket.IO fix
const response = await fetch(`${API_BASE_URL}/api/notifications`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### **✅ Socket.IO - Correct Usage**
```typescript
// ✅ CORRECT - This will work after the fix
const socket = io(API_BASE_URL, {
  auth: {
    token: userToken
  }
});

// OR
const socket = io(API_BASE_URL, {
  extraHeaders: {
    'Authorization': `Bearer ${userToken}`
  }
});

// OR
const socket = io(`${API_BASE_URL}?token=${userToken}`);
```

---

## 🔍 **Debugging Steps**

### **1. Test REST Endpoints**
```bash
# Test with curl
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/notifications
```

### **2. Test Socket.IO Connection**
```javascript
// Test in browser console
const socket = io('http://localhost:3000', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => console.log('Connected!'));
socket.on('connect_error', (error) => console.error('Connection failed:', error));
```

### **3. Check JWT Token Validity**
```javascript
// Decode JWT to check expiry
const token = 'YOUR_JWT_TOKEN';
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Token expires:', new Date(payload.exp * 1000));
console.log('Current time:', new Date());
```

---

## 🎯 **Summary**

1. **REST endpoints**: ✅ Working correctly, require Bearer token
2. **Socket.IO**: ❌ **CRITICAL BUG** - Incorrect `verifyToken` usage
3. **Token refresh**: ❌ Not implemented (tokens are 7-day long-lived)
4. **CORS**: ✅ Properly configured
5. **Response format**: ✅ Correct

**Primary Issue**: The Socket.IO authentication is calling Express middleware incorrectly, causing all Socket.IO connections to fail with "Authentication failed".

**Fix Required**: Replace the `verifyToken` middleware call with direct JWT verification in the Socket.IO service.
