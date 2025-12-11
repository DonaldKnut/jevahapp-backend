# 🔧 Security Quick Fixes - Implementation Guide

**Priority:** Critical fixes that should be implemented immediately

---

## 1. Enable Rate Limiting in All Environments ⚠️ CRITICAL

**File:** `src/middleware/rateLimiter.ts`

**Current Issue:** Rate limiting is completely disabled in development/test

**Fix:**

```typescript
// Replace all rate limiters with this pattern:
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 100 : 1000, // Higher limit in dev
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === "/health";
  },
  handler: (_req: Request, res: Response) =>
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again later",
    }),
});
```

**Apply to:** `apiRateLimiter`, `authRateLimiter`, `sensitiveEndpointRateLimiter`, `mediaUploadRateLimiter`, `mediaInteractionRateLimiter`, `followRateLimiter`, `emailRateLimiter`, `gamesRateLimiter`

---

## 2. Add CSRF Protection for Web Endpoints

**Install:**
```bash
npm install csurf
npm install --save-dev @types/csurf
```

**File:** `src/app.ts`

**Add after cookie parser:**
```typescript
import csrf from "csurf";

// CSRF protection (skip for API routes used by mobile apps)
const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  }
});

// Apply CSRF only to web admin routes
app.use("/api/admin", csrfProtection);
app.use("/api/admin-dashboard", csrfProtection);

// CSRF token endpoint for frontend
app.get("/api/csrf-token", csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

**Note:** Mobile apps (Expo) don't need CSRF tokens, so only apply to web admin routes.

---

## 3. Add Input Sanitization

**Install:**
```bash
npm install dompurify isomorphic-dompurify
npm install --save-dev @types/dompurify
```

**File:** `src/utils/sanitize.util.ts` (new file)

```typescript
import DOMPurify from "isomorphic-dompurify";

export class SanitizeUtil {
  /**
   * Sanitize HTML content - removes all HTML tags
   */
  static sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, { 
      ALLOWED_TAGS: [], 
      ALLOWED_ATTR: [] 
    });
  }

  /**
   * Sanitize text content - removes script tags and dangerous attributes
   */
  static sanitizeText(text: string): string {
    return DOMPurify.sanitize(text, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
      ALLOWED_ATTR: []
    });
  }

  /**
   * Sanitize user input for database queries
   */
  static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, ''); // Remove event handlers
  }
}

export default SanitizeUtil;
```

**Usage in controllers:**
```typescript
import SanitizeUtil from "../utils/sanitize.util";

// In your controller
const sanitizedTitle = SanitizeUtil.sanitizeInput(title);
const sanitizedDescription = SanitizeUtil.sanitizeText(description);
```

---

## 4. Tighten CORS Configuration

**File:** `src/app.ts`

**Replace CORS configuration:**

```typescript
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Production: Strict origin checking
    if (process.env.NODE_ENV === "production") {
      if (allowedOrigins.some(allowed => origin === allowed)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    }

    // Development: Allow localhost and network IPs
    if (
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      /^http:\/\/192\.168\.\d+\.\d+:19006$/.test(origin) ||
      /^http:\/\/10\.\d+\.\d+\.\d+:4000$/.test(origin)
    ) {
      return callback(null, true);
    }

    // Allow Render preview deployments in development
    if (origin.includes(".onrender.com")) {
      return callback(null, true);
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "expo-platform",
    "X-CSRF-Token", // Add for CSRF protection
  ],
};

app.use(cors(corsOptions));
```

---

## 5. Add Security Audit Logging

**File:** `src/utils/auditLogger.ts` (new file)

```typescript
import logger from "./logger";

export enum AuditAction {
  USER_BANNED = "USER_BANNED",
  USER_UNBANNED = "USER_UNBANNED",
  ROLE_CHANGED = "ROLE_CHANGED",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  FILE_UPLOADED = "FILE_UPLOADED",
  PAYMENT_PROCESSED = "PAYMENT_PROCESSED",
  ADMIN_ACTION = "ADMIN_ACTION",
  DATA_EXPORTED = "DATA_EXPORTED",
}

export interface AuditLog {
  action: AuditAction;
  userId?: string;
  targetUserId?: string;
  ip?: string;
  userAgent?: string;
  details?: any;
  timestamp: Date;
}

export class AuditLogger {
  static log(auditLog: AuditLog): void {
    logger.info("AUDIT_LOG", {
      ...auditLog,
      severity: "AUDIT",
    });
  }

  static logSecurityEvent(
    action: AuditAction,
    req: any,
    details?: any
  ): void {
    this.log({
      action,
      userId: req.userId,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      details,
      timestamp: new Date(),
    });
  }
}

export default AuditLogger;
```

**Usage example:**
```typescript
import AuditLogger, { AuditAction } from "../utils/auditLogger";

// In admin controller
AuditLogger.logSecurityEvent(AuditAction.USER_BANNED, req, {
  targetUserId: userId,
  reason: banReason,
});
```

---

## 6. Run Security Audit

**Command:**
```bash
npm audit
npm audit fix
```

**Add to package.json scripts:**
```json
{
  "scripts": {
    "security:audit": "npm audit --audit-level=moderate",
    "security:fix": "npm audit fix"
  }
}
```

---

## 7. Add Request ID Tracking

**File:** `src/app.ts`

**Add after body parsing:**
```typescript
import crypto from "crypto";

app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader("X-Request-ID", req.id);
  next();
});
```

**Update logger to include request ID:**
```typescript
logger.info("Incoming request", {
  requestId: req.id,
  method: req.method,
  url: req.originalUrl,
  // ... rest
});
```

---

## 8. Secure Health Check Endpoint

**File:** `src/app.ts`

**Replace health check:**
```typescript
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    // Don't expose: uptime, version, environment, endpoints
  });
});
```

---

## Implementation Order

1. ✅ **Rate Limiting** (5 minutes) - Critical
2. ✅ **npm audit** (2 minutes) - Critical
3. ✅ **CORS Tightening** (5 minutes) - High
4. ✅ **Input Sanitization** (15 minutes) - High
5. ✅ **CSRF Protection** (10 minutes) - Medium
6. ✅ **Audit Logging** (20 minutes) - Medium
7. ✅ **Request ID** (5 minutes) - Low
8. ✅ **Health Check** (2 minutes) - Low

**Total Time:** ~1 hour for all critical fixes

---

## Testing Checklist

After implementing fixes:

- [ ] Rate limiting works in development
- [ ] CSRF tokens work for admin routes
- [ ] Input sanitization prevents XSS
- [ ] CORS blocks unauthorized origins in production
- [ ] Audit logs are being created
- [ ] `npm audit` shows no critical vulnerabilities
- [ ] Request IDs appear in logs
- [ ] Health check doesn't leak sensitive info

---

## Notes

- **Mobile apps (Expo)** don't need CSRF tokens - only apply to web admin routes
- **Rate limiting** should be enabled everywhere, just with different limits
- **Input sanitization** is most important for user-generated content (comments, posts, etc.)
- **Audit logging** helps with compliance and incident response

