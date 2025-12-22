# Upstash TCP Setup - Complete Response Caching

## ✅ **Current Status**

You have:
- ✅ `UPSTASH_REDIS_REST_URL` - SET ✓
- ✅ `UPSTASH_REDIS_REST_TOKEN` - SET ✓
- ❌ `REDIS_URL` - MISSING ✗ (needed for response caching)

## 🔧 **What You Need**

Your Upstash dashboard shows:
- **Endpoint**: `your-database-name.upstash.io` (example)
- **Port**: `6379`
- **TLS/SSL**: Enabled
- **Token**: (you have this)

## 📝 **How to Get TCP Connection String**

### **Option 1: From Upstash Dashboard** (Easiest)

1. Go to your Upstash dashboard
2. Click on your Redis database
3. Look for a section that says **"Connect"** or **"Connection String"**
4. You should see something like:
   ```
   rediss://default:YOUR_TOKEN@your-database-name.upstash.io:6379
   ```
5. Copy that entire string

### **Option 2: Manual Construction**

If you can't find the connection string, build it manually:

**Format**: `rediss://default:TOKEN@ENDPOINT:PORT`

**Important**: Use `rediss://` (with double 's') because TLS is enabled!

**Example**:
```
rediss://default:YOUR_TOKEN_HERE@cunning-grackle-43906.upstash.io:6379
```

Replace `YOUR_TOKEN_HERE` with your actual token from the dashboard.

## 🔑 **Add to .env File**

Add this line to your `.env` file:

```env
# Upstash Redis (REST) - for counters/rate limiting (already set)
UPSTASH_REDIS_REST_URL=https://your-database-name.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_REST_TOKEN

# Upstash Redis (TCP) - for response caching and BullMQ queues
REDIS_URL=rediss://default:YOUR_TCP_TOKEN@your-database-name.upstash.io:6379
```

**Note**: The TCP token might be the same as your REST token, or it might be different. Check your Upstash dashboard.

## ✅ **Verify Setup**

After adding `REDIS_URL`, restart your server and check the logs. You should see:

```
✅ Redis connected successfully
✅ Redis ready to accept commands
```

If you see errors, double-check:
1. Token is correct
2. Using `rediss://` (not `redis://`) because TLS is enabled
3. Port is `6379`
4. Endpoint is correct

## 🚀 **What This Enables**

Once `REDIS_URL` is set:

1. ✅ **Response Caching** - All 77+ endpoints will cache responses
2. ✅ **BullMQ Queues** - Background job processing will work
3. ✅ **Full Performance** - 70-95% faster responses

## 📊 **Current vs Full Setup**

### **Current (REST only)**:
- ✅ Counters (likes, views, comments)
- ✅ Rate limiting
- ✅ Feed caching (IDs)
- ✅ Auth caching
- ❌ Response caching (needs TCP)
- ❌ BullMQ queues (needs TCP)

### **After Adding TCP**:
- ✅ Everything above PLUS
- ✅ Response caching (all endpoints)
- ✅ BullMQ queues
- ✅ **Full performance optimization**

## 🔍 **Troubleshooting**

### **Error: "Connection refused"**
- Check if TLS is enabled (use `rediss://` not `redis://`)
- Verify port is `6379`
- Check token is correct

### **Error: "Authentication failed"**
- Token might be wrong
- Make sure you're using the TCP token (might be different from REST token)

### **Error: "Host not found"**
- Verify endpoint: `cunning-grackle-43906.upstash.io`
- Check for typos

## ✅ **Quick Test**

After setting `REDIS_URL`, test with:

```bash
npm run test:redis
```

Or check server logs for:
```
✅ Redis connected successfully
```

---

**Last Updated**: 2025-12-20
