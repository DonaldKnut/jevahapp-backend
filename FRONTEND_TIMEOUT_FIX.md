# Frontend Timeout Fix - Complete Guide

## 🔴 Problem
Frontend getting `AbortError` because:
- **Frontend timeout:** 45 seconds
- **Render.com cold start:** 30-60 seconds
- **Result:** Requests abort before backend wakes up

---

## ✅ Solution: 3-Step Fix

### Step 1: Call Warmup Endpoint First (CRITICAL)

**On app start, call `/api/health/warmup` BEFORE any auth requests:**

```typescript
// app/utils/backendWarmup.ts
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'https://jevahapp-backend.onrender.com';

export const warmupBackend = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
    
    const response = await fetch(`${BACKEND_URL}/api/health/warmup`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      console.log('✅ Backend warmed up');
      return true;
    }
    return false;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('⚠️ Backend warmup timed out (may still be waking up)');
      // Don't fail - backend might still wake up
      return false;
    }
    console.error('❌ Backend warmup failed:', error);
    return false;
  }
};
```

---

### Step 2: Increase Timeout for Auth Endpoints

**Update your API client to use 60-second timeout for auth endpoints:**

```typescript
// app/utils/dataFetching.ts (or your API client)

class ApiClient {
  private getTimeout(endpoint: string): number {
    // Auth endpoints need longer timeout for cold starts
    const authEndpoints = ['/auth/me', '/auth/login', '/auth/register', '/auth/refresh'];
    const isAuthEndpoint = authEndpoints.some(path => endpoint.includes(path));
    
    return isAuthEndpoint ? 60000 : 30000; // 60s for auth, 30s for others
  }

  async getUserProfile(): Promise<any> {
    const endpoint = '/api/auth/me';
    const timeout = this.getTimeout(endpoint);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await this.getToken()}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Backend may be waking up. Please try again.');
      }
      throw error;
    }
  }
}
```

---

### Step 3: Add Retry Logic with Exponential Backoff

**Retry auth requests up to 3 times:**

```typescript
// app/utils/retryWithBackoff.ts

export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.message?.includes('401') || error.message?.includes('403')) {
        throw error;
      }
      
      // Last attempt - throw error
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`⏳ Retry attempt ${attempt + 1}/${maxRetries} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Retry failed');
};
```

**Use it in your API client:**

```typescript
import { retryWithBackoff } from './retryWithBackoff';

async getUserProfile(): Promise<any> {
  return retryWithBackoff(async () => {
    // Your existing getUserProfile code here
    const endpoint = '/api/auth/me';
    // ... rest of code
  }, 3, 1000); // 3 retries, 1s base delay
}
```

---

## 🚀 Complete Implementation

### 1. Update App Entry Point (_layout.tsx or App.tsx)

```typescript
import { useEffect, useState } from 'react';
import { warmupBackend } from './utils/backendWarmup';
import { getUserProfile } from './utils/dataFetching';

export default function RootLayout() {
  const [isWarmingUp, setIsWarmingUp] = useState(true);
  const [warmupError, setWarmupError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Step 1: Warm up backend first
        console.log('🔥 Warming up backend...');
        const warmed = await warmupBackend();
        
        if (!warmed) {
          console.warn('⚠️ Backend warmup failed, but continuing...');
          setWarmupError('Backend is waking up. This may take a moment...');
        }
        
        setIsWarmingUp(false);
        
        // Step 2: Now make auth requests (they'll use longer timeout)
        // Your existing auth logic here
        await getUserProfile();
        
      } catch (error) {
        console.error('App initialization error:', error);
        setWarmupError('Failed to connect to server. Please check your connection.');
      }
    };

    initializeApp();
  }, []);

  if (isWarmingUp) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text>Waking up server...</Text>
        {warmupError && <Text style={styles.error}>{warmupError}</Text>}
      </View>
    );
  }

  // Your normal app content
  return <YourAppContent />;
}
```

---

## 📋 Quick Checklist

- [ ] **Step 1:** Add `warmupBackend()` function
- [ ] **Step 2:** Call warmup on app start BEFORE auth requests
- [ ] **Step 3:** Increase timeout to 60s for `/auth/me` endpoint
- [ ] **Step 4:** Add retry logic with exponential backoff
- [ ] **Step 5:** Show "Waking up server..." message during warmup
- [ ] **Step 6:** Test with backend in cold start state

---

## 🧪 Testing

### Test Cold Start:
1. Stop backend (or wait 15+ minutes for Render.com to sleep it)
2. Start frontend app
3. Should see "Waking up server..." message
4. Should successfully connect within 60 seconds
5. Should retry if first attempt fails

### Expected Flow:
```
App Start
  ↓
Call /api/health/warmup (60s timeout)
  ↓
Backend wakes up (30-60s)
  ↓
Warmup succeeds
  ↓
Call /api/auth/me (60s timeout)
  ↓
Auth succeeds
```

---

## 🎯 Key Points

1. **Warmup endpoint is lightweight** - No database queries, just wakes up the server
2. **Call warmup FIRST** - Before any auth requests
3. **60-second timeout** - Matches Render.com cold start time
4. **Retry logic** - Handles transient failures
5. **User feedback** - Show "Waking up server..." message

---

## 📝 Notes

- **Backend already optimized** ✅ (parallel queries, `.lean()`, connection pooling)
- **Backend has self-ping** ✅ (pings `/health` every 10 minutes)
- **Frontend needs these changes** ⚠️ (timeout + warmup + retry)

---

**Last Updated:** 2024
**Status:** Backend ready ✅ | Frontend needs implementation


