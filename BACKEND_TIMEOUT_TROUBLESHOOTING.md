# Backend Timeout Troubleshooting Guide

## 🔴 Problem: Frontend Getting AbortError / Timeouts

**Symptoms:**
- `AbortError: Aborted` errors in frontend
- `GET /auth/me` requests timing out
- Backend warmup timing out after 45 seconds
- Network errors: "Please check your connection"

---

## 🔍 Root Causes

### 1. **Render.com Cold Starts** (Most Likely)
- **Free tier** cold starts take **30-60 seconds**
- Backend sleeps after inactivity
- First request wakes up the server (slow)
- Frontend timeout (30s) < Backend wake time (30-60s)

### 2. **Database Connection Slow**
- MongoDB connection takes time on cold start
- Multiple database queries in auth flow
- Network latency to MongoDB Atlas

### 3. **Multiple Database Queries**
- `verifyToken` middleware: 2 queries (blacklist + user)
- `getCurrentUser`: 1 query
- Total: 3 sequential queries = slow

---

## ✅ Solutions Implemented

### 1. **Optimized Auth Middleware**
- ✅ Parallelized database queries (blacklist + user)
- ✅ Used `.lean()` for faster queries
- ✅ Non-blocking ban updates

### 2. **Optimized getCurrentUser**
- ✅ Used `.lean()` for faster query
- ✅ Returns all needed fields in one query

### 3. **Database Connection Pooling**
- ✅ Already configured with connection pooling
- ✅ Min pool size: 2 (keeps connections warm)

---

## 🚀 Additional Recommendations

### For Frontend (Immediate Fix):

**1. Increase Timeout for Auth Endpoints:**
```typescript
// In your API client
const AUTH_TIMEOUT = 60000; // 60 seconds for auth endpoints
const DEFAULT_TIMEOUT = 30000; // 30 seconds for others

// Use longer timeout for /auth/me
if (endpoint.includes('/auth/me')) {
  timeout = AUTH_TIMEOUT;
}
```

**2. Add Retry Logic:**
```typescript
// Retry auth endpoints up to 3 times with exponential backoff
const retryAuthRequest = async (fn, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
};
```

**3. Handle Cold Start Gracefully:**
```typescript
// Show loading state longer for first request
const [isColdStart, setIsColdStart] = useState(true);

useEffect(() => {
  // Assume cold start on app launch
  const timer = setTimeout(() => setIsColdStart(false), 60000);
  return () => clearTimeout(timer);
}, []);

// Show "Waking up server..." message during cold start
```

---

### For Backend (Long-term):

**1. Keep Backend Warm (Render.com):**
- Use Render.com **paid tier** (no cold starts)
- Or set up **UptimeRobot** to ping `/health` every 5 minutes
- Or use **cron job** to ping backend regularly

**2. Add Health Check Endpoint:**
```typescript
// GET /api/health/warmup
// Call this on app start to wake backend
router.get('/warmup', (req, res) => {
  res.json({ status: 'warm', timestamp: Date.now() });
});
```

**3. Optimize Database Queries:**
- ✅ Already using `.lean()` (implemented)
- ✅ Connection pooling (already configured)
- Consider adding **Redis cache** for user data

**4. Add Request Timeout Middleware:**
```typescript
// Add timeout to prevent hanging requests
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 second timeout
  res.setTimeout(30000);
  next();
});
```

---

## 🧪 Testing

### Test Cold Start:
1. Stop backend (or wait for Render.com to sleep it)
2. Make request to `/api/auth/me`
3. Measure response time
4. Should be < 60 seconds with optimizations

### Test Database Connection:
```bash
# Check MongoDB connection time
node -e "
const mongoose = require('mongoose');
const start = Date.now();
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected in:', Date.now() - start, 'ms'))
  .catch(err => console.error('Error:', err));
"
```

---

## 📊 Expected Performance

**Before Optimization:**
- Cold start: 30-60 seconds
- Auth request: 2-5 seconds (when warm)
- Database queries: 500-2000ms each

**After Optimization:**
- Cold start: 30-60 seconds (Render.com limitation)
- Auth request: 500-1000ms (when warm)
- Database queries: 100-500ms each (with `.lean()`)

---

## 🎯 Quick Wins

1. **Frontend:** Increase timeout to 60s for auth endpoints
2. **Frontend:** Add retry logic (3 retries)
3. **Backend:** Already optimized ✅
4. **Infrastructure:** Keep backend warm (UptimeRobot or paid tier)

---

## 📝 Notes

- **Render.com Free Tier:** Always has cold starts
- **Solution:** Either upgrade to paid tier OR use external ping service
- **Frontend timeout:** Must be longer than cold start time
- **Database:** Already optimized with connection pooling

---

**Last Updated:** 2024
**Status:** Backend optimized ✅ | Frontend timeout needs adjustment


