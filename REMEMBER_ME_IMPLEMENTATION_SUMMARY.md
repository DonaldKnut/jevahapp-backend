# Remember Me Feature - Implementation Summary

## Backend Implementation Overview

This document explains what was implemented in the backend and how the frontend can work with it.

---

## What Was Changed in the Backend

### 1. **Token Configuration System** (`src/config/tokenConfig.ts`)

Created a centralized configuration file that defines token expiration times:

```typescript
export const TOKEN_EXPIRATION = {
  REMEMBER_ME: 30 * 24 * 60 * 60,  // 30 days (2,592,000 seconds)
  STANDARD: 7 * 24 * 60 * 60,      // 7 days (604,800 seconds)
}
```

**Why this matters:**
- Single source of truth for token expiration
- Easy to adjust expiration times in the future
- Consistent across the entire application

---

### 2. **Updated Login Service** (`src/service/auth.service.ts`)

#### Changes Made:

**a) Token Expiration Logic**
- **Before:** `rememberMe: true` → 7 days, `rememberMe: false` → 15 minutes
- **After:** `rememberMe: true` → 30 days, `rememberMe: false` → 7 days

**b) Token Payload Enhancement**
The JWT token now includes the `rememberMe` flag:
```typescript
const tokenPayload = {
  userId: user._id.toString(),
  email: user.email,
  rememberMe: rememberMe,  // NEW: Flag included in token
};
```

**c) Response Enhancement**
The service now returns `expiresIn` (expiration time in seconds):
```typescript
return {
  accessToken,
  refreshToken,
  expiresIn,  // NEW: Token expiration in seconds
  user: {...}
};
```

**d) Refresh Token Logic**
When refreshing tokens (using refresh token from cookie), the backend now issues:
- **30-day access tokens** (since refresh tokens are only created when `rememberMe=true`)

---

### 3. **Updated Login Controller** (`src/controllers/auth.controller.ts`)

#### Response Format Changes:

**Before:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "...",
  "accessToken": "...",
  "user": {...},
  "rememberMe": true
}
```

**After:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "...",
  "accessToken": "...",
  "user": {...},
  "expiresIn": 2592000,      // NEW: seconds until expiration
  "tokenType": "bearer",      // NEW: token type
  "rememberMe": true
}
```

---

## How Token Expiration Works Now

### Scenario 1: User Logs In WITH Remember Me (`rememberMe: true`)

```
Request:
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123",
  "rememberMe": true
}

Response:
{
  "token": "eyJhbGci...",
  "expiresIn": 2592000,  // 30 days (2,592,000 seconds)
  "rememberMe": true
}

What Happens:
✅ Access token expires in 30 days
✅ Refresh token created (expires in 90 days)
✅ Refresh token stored in httpOnly cookie
✅ User stays logged in for 30 days without re-authentication
```

### Scenario 2: User Logs In WITHOUT Remember Me (`rememberMe: false`)

```
Request:
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123",
  "rememberMe": false
}

Response:
{
  "token": "eyJhbGci...",
  "expiresIn": 604800,  // 7 days (604,800 seconds)
  "rememberMe": false
}

What Happens:
✅ Access token expires in 7 days
✅ No refresh token created
✅ User needs to log in again after 7 days
```

### Scenario 3: User Doesn't Send `rememberMe` (Backward Compatibility)

```
Request:
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
  // rememberMe not provided
}

Response:
{
  "token": "eyJhbGci...",
  "expiresIn": 604800,  // 7 days (defaults to false)
  "rememberMe": false
}

What Happens:
✅ Defaults to rememberMe: false
✅ Access token expires in 7 days
✅ No refresh token created
✅ Old clients continue to work without changes
```

---

## Frontend Integration Guide

### 1. **Login Request** (No Changes Required)

The frontend already sends `rememberMe` in the login request. This continues to work:

```typescript
// Frontend login request (already implemented)
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: userEmail,
    password: userPassword,
    rememberMe: true  // or false
  })
});

const data = await response.json();
```

### 2. **Using the New Response Fields**

The backend now returns additional information you can use:

```typescript
const loginResponse = await response.json();

// NEW: Token expiration time in seconds
const expiresIn = loginResponse.expiresIn;  // e.g., 2592000 (30 days)

// NEW: Token type (always "bearer")
const tokenType = loginResponse.tokenType;  // "bearer"

// Existing: Remember Me flag (echo of what you sent)
const rememberMe = loginResponse.rememberMe;  // true or false

// Existing: Access token
const accessToken = loginResponse.token;  // or loginResponse.accessToken
```

### 3. **Calculating Token Expiration Date**

You can calculate when the token will expire:

```typescript
const loginResponse = await response.json();
const expiresIn = loginResponse.expiresIn; // seconds

// Calculate expiration date
const expirationDate = new Date();
expirationDate.setSeconds(expirationDate.getSeconds() + expiresIn);

// Store expiration date if needed
localStorage.setItem('tokenExpiresAt', expirationDate.toISOString());

// Check if token is expired
function isTokenExpired() {
  const expiresAt = localStorage.getItem('tokenExpiresAt');
  if (!expiresAt) return true;
  return new Date() > new Date(expiresAt);
}
```

### 4. **Token Refresh Flow** (Already Implemented)

The backend automatically handles token refresh via cookies:

```typescript
// When making API requests, the backend middleware automatically:
// 1. Checks if access token is valid
// 2. If expired but refresh token exists in cookie, auto-refreshes
// 3. Returns new access token in X-New-Access-Token header

// Frontend can check for new token:
fetch('/api/user/profile', {
  headers: {
    'Authorization': `Bearer ${currentToken}`
  }
}).then(response => {
  const newToken = response.headers.get('X-New-Access-Token');
  if (newToken) {
    // Update stored token
    AsyncStorage.setItem('token', newToken);
  }
});
```

### 5. **Displaying Token Expiration Info** (Optional)

You can show users how long they'll stay logged in:

```typescript
function formatExpirationTime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours > 1 ? 's' : ''}`;
}

// Usage
const expiresIn = loginResponse.expiresIn;
const expirationText = formatExpirationTime(expiresIn);
// "30 days" or "7 days"
```

### 6. **Handling Different Expiration Times**

You can adjust UI behavior based on expiration:

```typescript
const loginResponse = await response.json();
const expiresIn = loginResponse.expiresIn;

// Remember Me tokens last 30 days (2,592,000 seconds)
const REMEMBER_ME_EXPIRATION = 30 * 24 * 60 * 60;

if (expiresIn >= REMEMBER_ME_EXPIRATION) {
  // Long-lived session
  console.log('Long session: User will stay logged in for 30 days');
  // Maybe show a different UI indicator
} else {
  // Standard session
  console.log('Standard session: User will stay logged in for 7 days');
}
```

---

## Backward Compatibility

### ✅ What Still Works

1. **Old Login Requests**
   - Clients that don't send `rememberMe` → defaults to `false` → 7-day token
   - No breaking changes

2. **Old Tokens**
   - Tokens issued before this update still work
   - Middleware only reads `userId` from token, so missing `rememberMe` field is fine

3. **Existing Frontend Code**
   - All existing frontend code continues to work
   - New fields are optional to use

### ⚠️ What Changed

1. **Token Expiration Times**
   - `rememberMe: false` tokens now last 7 days (was 15 minutes)
   - `rememberMe: true` tokens now last 30 days (was 7 days)

2. **Response Structure**
   - Added `expiresIn` field (optional to use)
   - Added `tokenType` field (optional to use)

---

## Security Considerations

### ✅ Security Features Maintained

1. **Refresh Tokens**
   - Still stored in httpOnly cookies (XSS protection)
   - Still expire after 90 days
   - Still can be revoked

2. **Token Blacklisting**
   - Still works for logout/revocation
   - Tokens can still be invalidated

3. **User Ban Checks**
   - Still checked on every request
   - Banned users' tokens are still invalidated

### 🔒 Security Best Practices

1. **Long-lived tokens** (`rememberMe: true`) are only issued when explicitly requested
2. **Refresh tokens** are only created for `rememberMe: true` sessions
3. **Token expiration** is clearly communicated via `expiresIn` field
4. **All tokens** can be revoked via logout endpoint

---

## Testing the Implementation

### Test Case 1: Login with Remember Me

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "rememberMe": true
  }'

# Expected Response:
# {
#   "success": true,
#   "token": "...",
#   "expiresIn": 2592000,  // 30 days
#   "rememberMe": true
# }
```

### Test Case 2: Login without Remember Me

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "rememberMe": false
  }'

# Expected Response:
# {
#   "success": true,
#   "token": "...",
#   "expiresIn": 604800,  // 7 days
#   "rememberMe": false
# }
```

### Test Case 3: Decode Token to Verify Payload

```typescript
import jwt from 'jsonwebtoken';

const token = loginResponse.token;
const decoded = jwt.decode(token);

console.log(decoded);
// Should include:
// {
//   userId: "...",
//   email: "...",
//   rememberMe: true/false,
//   iat: ...,
//   exp: ...
// }
```

---

## Summary for Frontend Developers

### What You Get

1. **Longer Token Expiration**
   - `rememberMe: true` → 30 days (was 7 days)
   - `rememberMe: false` → 7 days (was 15 minutes)

2. **New Response Fields**
   - `expiresIn`: Know exactly when token expires
   - `tokenType`: Always "bearer" (for consistency)

3. **Better User Experience**
   - Users stay logged in longer when they choose "Remember Me"
   - Less frequent re-authentication required

### What You Need to Do

1. **Nothing Required** - Existing code continues to work
2. **Optional Enhancements:**
   - Use `expiresIn` to show users when their session expires
   - Use `expiresIn` to proactively refresh tokens before expiration
   - Display different UI for long vs short sessions

### Example: Complete Login Flow

```typescript
async function login(email: string, password: string, rememberMe: boolean) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, rememberMe })
    });

    const data = await response.json();

    if (data.success) {
      // Store token
      await AsyncStorage.setItem('token', data.token);
      
      // Store expiration info (optional)
      const expirationDate = new Date();
      expirationDate.setSeconds(expirationDate.getSeconds() + data.expiresIn);
      await AsyncStorage.setItem('tokenExpiresAt', expirationDate.toISOString());
      
      // Store rememberMe flag (optional, for UI)
      await AsyncStorage.setItem('rememberMe', String(data.rememberMe));
      
      // Calculate and log expiration time
      const days = Math.floor(data.expiresIn / (24 * 60 * 60));
      console.log(`Token expires in ${days} days`);
      
      return data.user;
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}
```

---

## Questions?

If you have questions about:
- Token expiration logic
- Refresh token behavior
- Backward compatibility
- Frontend integration

Refer to this document or check the implementation in:
- `src/config/tokenConfig.ts` - Token configuration
- `src/service/auth.service.ts` - Login logic
- `src/controllers/auth.controller.ts` - API endpoint

---

**Last Updated:** Implementation completed
**Status:** ✅ Ready for production use
