# Socket.IO WebSocket Transport Fix Guide

## 🔍 Problem: WebSocket Transport Failing

When you see this error:
```
🔄 WebSocket transport failed, Socket.IO will fallback to polling...
```

This means Socket.IO cannot establish a WebSocket connection and is falling back to HTTP long-polling, which is:
- ❌ **Slower** - Higher latency
- ❌ **Less efficient** - More HTTP requests
- ❌ **Higher server load** - More connections to manage

---

## 🎯 Root Causes

### 1. **Nginx Not Configured for Socket.IO** (Most Common)

Socket.IO uses the `/socket.io/` path by default, and Nginx needs a specific location block to handle WebSocket upgrades.

### 2. **Missing WebSocket Upgrade Headers**

Nginx must pass the `Upgrade` and `Connection` headers for WebSocket connections.

### 3. **Proxy Timeout Issues**

WebSocket connections are long-lived, but Nginx might have short timeouts.

### 4. **Cloudflare Proxy Issues**

If using Cloudflare, the proxy might interfere with WebSocket connections.

---

## ✅ Solution 1: Fix Nginx Configuration (Recommended)

### Current Issue

Your Nginx config likely only has:
```nginx
location /api/ {
    proxy_pass http://127.0.0.1:4000;
    # ... basic headers ...
}
```

This doesn't handle Socket.IO's `/socket.io/` path properly.

### Fixed Nginx Configuration

Add a **dedicated Socket.IO location block** before your `/api/` block:

```nginx
server {
    server_name api.jevahapp.com;
    listen 443 ssl;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.jevahapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.jevahapp.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # ============================================================================
    # Socket.IO WebSocket Support (MUST come before /api/ block)
    # ============================================================================
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        
        # WebSocket upgrade headers (CRITICAL)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket-specific settings
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;  # 24 hours (WebSocket connections are long-lived)
        proxy_send_timeout 86400s;
        
        # Disable buffering for real-time communication
        proxy_buffering off;
    }

    # ============================================================================
    # API Routes
    # ============================================================================
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location = /health {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Block everything else
    location / {
        return 404;
    }
}

# HTTP to HTTPS redirect
server {
    if ($host = api.jevahapp.com) {
        return 301 https://$host$request_uri;
    }
    
    listen 80;
    server_name api.jevahapp.com;
    return 404;
}
```

### Key Points:

1. **Socket.IO location block MUST come before `/api/`** - Nginx matches locations in order
2. **Long timeouts** - `proxy_read_timeout 86400s` (24 hours) for persistent connections
3. **Disable buffering** - `proxy_buffering off` for real-time communication
4. **WebSocket headers** - `Upgrade` and `Connection: upgrade` are critical

### Apply the Fix:

```bash
# 1. Edit Nginx config
sudo nano /etc/nginx/sites-available/api.jevahapp.com

# 2. Add the Socket.IO location block (copy from above)

# 3. Test configuration
sudo nginx -t

# 4. Reload Nginx
sudo systemctl reload nginx

# 5. Restart your backend (to ensure Socket.IO is ready)
pm2 restart backend
```

---

## ✅ Solution 2: Improve Socket.IO Server Configuration

Update your Socket.IO server configuration for better WebSocket support:

```typescript
// src/service/socket.service.ts
constructor(server: HTTPServer) {
  this.io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"], // WebSocket first, then polling fallback
    allowEIO3: true, // Allow Engine.IO v3 clients (backward compatibility)
    pingTimeout: 60000, // How long to wait for pong before considering connection closed
    pingInterval: 25000, // How often to send ping packets
    upgradeTimeout: 10000, // How long to wait for upgrade handshake
    maxHttpBufferSize: 1e6, // 1MB max message size
    // Path configuration (must match Nginx location)
    path: "/socket.io/",
    // Connection configuration
    connectTimeout: 45000,
    // Enable compression
    compression: true,
    // CORS for Socket.IO
    allowRequest: (req, callback) => {
      // Additional security checks can go here
      callback(null, true);
    },
  });

  this.setupMiddleware();
  this.setupEventHandlers();
  logger.info("Socket.IO service initialized with WebSocket support");
}
```

### Key Configuration Options:

- **`transports: ["websocket", "polling"]`** - Try WebSocket first, fallback to polling
- **`pingTimeout: 60000`** - 60 seconds - how long to wait for client response
- **`pingInterval: 25000`** - 25 seconds - how often to ping client
- **`path: "/socket.io/"`** - Must match Nginx location block
- **`compression: true`** - Enable message compression

---

## ✅ Solution 3: Frontend Configuration

Ensure your frontend is configured correctly:

```typescript
import { io } from 'socket.io-client';

const socket = io('https://api.jevahapp.com', {
  // Transport configuration
  transports: ['websocket', 'polling'], // Try WebSocket first
  upgrade: true, // Allow transport upgrades
  rememberUpgrade: true, // Remember successful transport
  
  // Authentication
  auth: {
    token: await getAuthToken(),
  },
  
  // Connection options
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  
  // Path must match backend
  path: '/socket.io/',
  
  // Timeouts
  timeout: 20000,
  
  // Force WebSocket (optional - for testing)
  // forceNew: true,
});

// Listen for connection events
socket.on('connect', () => {
  console.log('✅ Connected via:', socket.io.engine.transport.name);
  // Should log: "websocket" not "polling"
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
});

// Check transport type
socket.io.on('upgrade', () => {
  console.log('🔄 Upgraded to:', socket.io.engine.transport.name);
});
```

### Debug Transport Type:

```typescript
// Check what transport is being used
console.log('Current transport:', socket.io.engine.transport.name);

// Listen for transport changes
socket.io.on('upgrade', () => {
  console.log('Upgraded to:', socket.io.engine.transport.name);
});

socket.io.on('upgradeError', (error) => {
  console.error('Upgrade failed:', error);
  console.log('Falling back to:', socket.io.engine.transport.name);
});
```

---

## ✅ Solution 4: Cloudflare Configuration (If Using Cloudflare)

If you're using Cloudflare proxy (orange cloud), you need to configure it for WebSockets:

### 1. Enable WebSocket in Cloudflare Dashboard

1. Go to Cloudflare Dashboard → Your Domain → Network
2. Enable **"WebSockets"** toggle
3. Save changes

### 2. Configure Cloudflare Page Rules (Optional)

Create a page rule for Socket.IO:
- **URL Pattern:** `api.jevahapp.com/socket.io/*`
- **Settings:**
  - Cache Level: Bypass
  - WebSockets: On

### 3. SSL/TLS Mode

Ensure SSL/TLS mode is **"Full"** or **"Full (strict)"** (not "Flexible")

---

## 🔧 Alternative: Use Native WebSocket (More Stable)

If Socket.IO continues to have issues, consider using native WebSocket with a simpler protocol:

### Backend (Native WebSocket)

```typescript
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const wss = new WebSocketServer({ 
  server,
  path: '/ws',
});

wss.on('connection', (ws, req) => {
  // Handle connection
  ws.on('message', (message) => {
    // Handle message
  });
});
```

### Frontend (Native WebSocket)

```typescript
const ws = new WebSocket('wss://api.jevahapp.com/ws', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

ws.onopen = () => {
  console.log('✅ WebSocket connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle message
};
```

**Pros:**
- ✅ More stable
- ✅ Lower overhead
- ✅ Better browser support
- ✅ Simpler protocol

**Cons:**
- ❌ No automatic reconnection (need to implement)
- ❌ No room/namespace support (need to implement)
- ❌ More manual work

---

## 🧪 Testing WebSocket Connection

### Test from Command Line:

```bash
# Install wscat
npm install -g wscat

# Test WebSocket connection
wscat -c wss://api.jevahapp.com/socket.io/?EIO=4&transport=websocket

# Should connect successfully
```

### Test with curl:

```bash
# Test WebSocket upgrade
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://api.jevahapp.com/socket.io/?EIO=4&transport=websocket

# Should return 101 Switching Protocols
```

### Browser Console Test:

```javascript
// Open browser console on your frontend
const socket = io('https://api.jevahapp.com', {
  transports: ['websocket'],
  path: '/socket.io/',
});

socket.on('connect', () => {
  console.log('Transport:', socket.io.engine.transport.name);
  // Should log: "websocket"
});
```

---

## 📊 Monitoring & Debugging

### Check Nginx Logs:

```bash
# Real-time access logs
sudo tail -f /var/log/nginx/access.log | grep socket.io

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### Check Backend Logs:

```bash
# PM2 logs
pm2 logs backend | grep -i socket

# Or direct logs
tail -f /var/www/backend/logs/app.log | grep -i socket
```

### Common Log Patterns:

**Successful WebSocket:**
```
GET /socket.io/?EIO=4&transport=websocket HTTP/1.1 101
```

**Failed WebSocket (falling back to polling):**
```
GET /socket.io/?EIO=4&transport=websocket HTTP/1.1 400
GET /socket.io/?EIO=4&transport=polling HTTP/1.1 200
```

---

## ✅ Verification Checklist

After applying fixes, verify:

- [ ] Nginx config has `/socket.io/` location block
- [ ] Nginx config includes WebSocket upgrade headers
- [ ] Nginx timeouts are set to 86400s (24 hours)
- [ ] Backend Socket.IO path matches Nginx (`/socket.io/`)
- [ ] Frontend uses correct path (`/socket.io/`)
- [ ] Cloudflare WebSocket enabled (if using Cloudflare)
- [ ] SSL/TLS mode is "Full" or "Full (strict)"
- [ ] Test connection shows "websocket" not "polling"
- [ ] No errors in Nginx logs
- [ ] No errors in backend logs

---

## 🎯 Quick Fix Summary

**Most Common Issue:** Missing Socket.IO location block in Nginx

**Quick Fix:**
1. Add `/socket.io/` location block to Nginx (before `/api/`)
2. Include WebSocket upgrade headers
3. Set long timeouts (86400s)
4. Reload Nginx
5. Restart backend

**Expected Result:**
- ✅ WebSocket connection succeeds
- ✅ No fallback to polling
- ✅ Lower latency
- ✅ Better performance

---

## 📞 Still Having Issues?

If WebSocket still fails after these fixes:

1. **Check firewall** - Ensure ports 80, 443 are open
2. **Check DNS** - Verify domain resolves correctly
3. **Check SSL** - Ensure certificate is valid
4. **Test direct connection** - Bypass Nginx temporarily
5. **Check Cloudflare** - Disable proxy temporarily to test
6. **Review logs** - Check both Nginx and backend logs

---

**After applying these fixes, WebSocket should work reliably! 🚀**

