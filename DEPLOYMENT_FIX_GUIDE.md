# 🚨 PRODUCTION DEPLOYMENT FIX GUIDE

## Problem Diagnosis

**Symptom:** 404 errors on routes that exist in code:
```bash
curl http://127.0.0.1:4000/api/media/public/all-content
# Returns: {"success":false,"message":"Route not found","path":"/api/media/public/all-content"}
```

**Root Cause:** Production server is running **outdated compiled code** (old `dist/` folder).

**Why:** TypeScript must be compiled to JavaScript before running. The server is running old JavaScript that doesn't have the new routes.

---

## ✅ SOLUTION: Rebuild and Restart

### Step 1: SSH into Your Contabo VPS

```bash
ssh jevah@vmi2739709.contaboserver.net
```

### Step 2: Navigate to Backend Directory

```bash
cd ~/jevahapp-backend
# OR wherever your backend code is located
```

### Step 3: Pull Latest Code (if using Git)

```bash
git pull origin main
# OR
git pull origin master
```

### Step 4: Install Dependencies (if package.json changed)

```bash
npm install
```

### Step 5: **CRITICAL: Build TypeScript to JavaScript**

```bash
npm run build
```

This runs:
- `tsc` - Compiles TypeScript to JavaScript in `dist/` folder
- `npm run copy-templates` - Copies email templates

**Expected Output:**
```
> tsc
> npm run copy-templates
> cp -r src/emails dist/
```

### Step 6: Verify Build Output

```bash
# Check that dist/ folder exists and has recent files
ls -lah dist/

# Verify the main entry point exists
ls -lah dist/index.js
ls -lah dist/app.js
```

### Step 7: Restart PM2 Process

```bash
# Check current PM2 status
pm2 list

# Restart your backend (replace 'jevahapp-backend' with your actual PM2 name)
pm2 restart jevahapp-backend

# OR if you don't know the name:
pm2 restart all

# OR restart by process ID
pm2 restart 0
```

### Step 8: Verify Routes Are Working

```bash
# Test the route directly on backend
curl -i http://127.0.0.1:4000/api/media/public/all-content

# Should return 200 OK (not 404)
```

### Step 9: Check PM2 Logs

```bash
# View logs to ensure no errors
pm2 logs jevahapp-backend --lines 50

# OR
pm2 logs --lines 50
```

---

## 🔍 DIAGNOSTIC COMMANDS

Run these to diagnose the issue:

### Check PM2 Status

```bash
pm2 list
pm2 info jevahapp-backend
```

### Check What Code is Running

```bash
# See when dist/ files were last modified
ls -lah dist/index.js dist/app.js

# Check if dist/ folder exists
ls -lah dist/

# Compare with source code modification time
ls -lah src/index.ts src/app.ts
```

### Check PM2 Working Directory

```bash
pm2 info jevahapp-backend | grep "exec cwd"
```

**Important:** PM2 must be running from the correct directory where `dist/` folder exists.

### Test Backend Directly

```bash
# Test health endpoint (should work)
curl http://127.0.0.1:4000/health

# Test problematic route
curl http://127.0.0.1:4000/api/media/public/all-content
```

---

## 🛠️ COMPLETE DEPLOYMENT SCRIPT

Save this as `deploy.sh` on your server:

```bash
#!/bin/bash
set -e  # Exit on error

echo "🚀 Starting deployment..."

# Navigate to backend directory
cd ~/jevahapp-backend

# Pull latest code (if using Git)
echo "📥 Pulling latest code..."
git pull origin main || echo "⚠️  Git pull failed or not a git repo"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Verify build
if [ ! -f "dist/index.js" ]; then
    echo "❌ Build failed! dist/index.js not found"
    exit 1
fi

# Restart PM2
echo "🔄 Restarting PM2..."
pm2 restart jevahapp-backend || pm2 restart all

# Wait a moment for server to start
sleep 3

# Test health endpoint
echo "🏥 Testing health endpoint..."
if curl -f http://127.0.0.1:4000/health > /dev/null 2>&1; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed!"
    pm2 logs jevahapp-backend --lines 20
    exit 1
fi

echo "✅ Deployment complete!"
```

**Make it executable:**
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 🔧 PM2 CONFIGURATION CHECK

### Check PM2 Ecosystem File (if exists)

```bash
cat ecosystem.config.js
# OR
cat pm2.config.js
```

### Verify PM2 is Running Correct Command

```bash
pm2 info jevahapp-backend
```

**Should show:**
```
script path     : /home/jevah/jevahapp-backend/dist/index.js
exec cwd        : /home/jevah/jevahapp-backend
```

### If PM2 is Running Wrong Command

```bash
# Stop current process
pm2 stop jevahapp-backend
pm2 delete jevahapp-backend

# Start with correct command
cd ~/jevahapp-backend
pm2 start dist/index.js --name jevahapp-backend

# Save PM2 configuration
pm2 save
pm2 startup  # Follow instructions to enable on boot
```

---

## 📤 FIX: 413 Request Entity Too Large (Uploads)

**Symptom:** Uploads fail with `413 Request Entity Too Large` (e.g. 60MB or 300MB files). Response body shows `nginx/1.24.0`.

**Cause:** Nginx (reverse proxy) has a default request body limit of **1MB**. The app allows up to 300MB for sermons/videos.

**Fix on the server (Ubuntu with nginx):**

1. **Locate your nginx config** that proxies to the backend, e.g.:
   ```bash
   sudo nano /etc/nginx/sites-available/your-site
   # or
   sudo nano /etc/nginx/nginx.conf
   ```

2. **Inside the `server { }` block** that proxies to the Node backend (or in the `location` that handles `/api/`), add:
   ```nginx
   client_max_body_size 300M;
   ```

   Example:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       client_max_body_size 300M;   # allow uploads up to 300MB

       location /api/ {
           proxy_pass http://127.0.0.1:4000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_read_timeout 300s;
           proxy_send_timeout 300s;
       }
   }
   ```

3. **Test config and reload nginx:**
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

A reference snippet is in `nginx-upload-limit.conf.example` in this repo.

---

## 🐛 TROUBLESHOOTING

### Issue: Build Fails

```bash
# Check TypeScript errors
npm run build

# If TypeScript errors, fix them first
npm run lint
```

### Issue: PM2 Won't Restart

```bash
# Check PM2 logs
pm2 logs jevahapp-backend --err

# Kill and restart
pm2 kill
pm2 start dist/index.js --name jevahapp-backend
```

### Issue: Routes Still 404 After Rebuild

1. **Verify dist/ folder has latest code:**
   ```bash
   # Check modification time
   ls -lah dist/app.js
   
   # Should be recent (just now)
   ```

2. **Check if PM2 is using correct file:**
   ```bash
   pm2 info jevahapp-backend | grep "script path"
   ```

3. **Verify routes in compiled code:**
   ```bash
   # Search for route in compiled JavaScript
   grep -n "public/all-content" dist/app.js
   ```

4. **Check for multiple PM2 processes:**
   ```bash
   pm2 list
   # Kill all and restart one
   ```

### Issue: Port 4000 Already in Use

```bash
# Find what's using port 4000
sudo lsof -i :4000

# Kill the process
kill -9 <PID>
```

---

## 📋 POST-DEPLOYMENT CHECKLIST

- [ ] Code pulled from Git (if applicable)
- [ ] Dependencies installed (`npm install`)
- [ ] TypeScript compiled (`npm run build`)
- [ ] `dist/` folder exists and is recent
- [ ] PM2 restarted
- [ ] Health endpoint works: `curl http://127.0.0.1:4000/health`
- [ ] Test route works: `curl http://127.0.0.1:4000/api/media/public/all-content`
- [ ] Nginx proxy works: `curl https://api.jevahapp.com/api/media/public/all-content`
- [ ] PM2 logs show no errors
- [ ] Server responds with 200 (not 404)

---

## 🎯 QUICK FIX (Copy-Paste)

```bash
cd ~/jevahapp-backend && \
git pull origin main && \
npm install && \
npm run build && \
pm2 restart jevahapp-backend && \
sleep 3 && \
curl -i http://127.0.0.1:4000/health
```

---

## 📝 NOTES

- **Always run `npm run build` after code changes** - TypeScript doesn't auto-compile
- **PM2 must restart** after rebuild to load new code
- **Check `dist/` folder modification time** to verify build succeeded
- **PM2 working directory matters** - must be in project root where `dist/` exists

---

**Last Updated:** December 28, 2025

