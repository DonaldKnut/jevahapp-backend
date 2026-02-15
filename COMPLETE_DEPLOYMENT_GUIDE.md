# 🚀 COMPLETE PRODUCTION DEPLOYMENT GUIDE

## Problem
Server has outdated code with uncommitted local changes. Routes are missing from compiled code, causing 404 errors.

## Solution
Complete deployment script that ensures ALL routes are registered and working.

---

## Quick Deploy (One Command)

On your Contabo VPS, run:

```bash
cd /var/www/backend
./deploy-production.sh
```

This script will:
1. ✅ Reset ALL local changes to match remote
2. ✅ Pull latest code from GitHub
3. ✅ Install dependencies
4. ✅ Clean build (removes old dist/)
5. ✅ Compile TypeScript → JavaScript
6. ✅ Verify routes exist in compiled code
7. ✅ Restart PM2
8. ✅ Test all endpoints
9. ✅ Show deployment summary

---

## Manual Deployment (Step-by-Step)

If you prefer to do it manually:

### Step 1: Navigate to Backend Directory
```bash
cd /var/www/backend
```

### Step 2: Reset All Local Changes
```bash
# WARNING: This discards ALL local changes
git reset --hard origin/main
git clean -fd
```

### Step 3: Pull Latest Code
```bash
git fetch origin
git pull origin main
```

### Step 4: Install Dependencies
```bash
npm install
```

### Step 5: Clean Build
```bash
rm -rf dist/
npm run build
```

### Step 6: Verify Routes
```bash
# Check if routes exist in compiled code
grep -q "public/all-content" dist/routes/media.route.js && echo "✅ Route found" || echo "❌ Route missing"
grep -q "/stats" dist/routes/notification.routes.js && echo "✅ Route found" || echo "❌ Route missing"
grep -q "/default" dist/routes/media.route.js && echo "✅ Route found" || echo "❌ Route missing"
```

### Step 7: Restart PM2
```bash
pm2 restart backend
sleep 5
```

### Step 8: Test Endpoints
```bash
# Health check
curl -i http://127.0.0.1:4000/health

# Media public route
curl -i http://127.0.0.1:4000/api/media/public/all-content

# Media default route
curl -i http://127.0.0.1:4000/api/media/default

# Notifications stats (should be 401 without auth, not 404)
curl -i http://127.0.0.1:4000/api/notifications/stats
```

---

## Verification Checklist

After deployment, verify:

- [ ] `git status` shows "working tree clean"
- [ ] `dist/index.js` exists and is recent
- [ ] `dist/routes/media.route.js` contains "public/all-content"
- [ ] `dist/routes/notification.routes.js` contains "/stats"
- [ ] PM2 process is "online"
- [ ] `/health` returns 200
- [ ] `/api/media/public/all-content` returns 200 (not 404)
- [ ] `/api/media/default` returns 200 (not 404)
- [ ] `/api/notifications/stats` returns 401 or 200 (not 404)

---

## Troubleshooting

### Issue: Routes Still 404 After Deployment

1. **Check PM2 is running correct file:**
   ```bash
   pm2 info backend | grep "script path"
   # Should show: /var/www/backend/dist/index.js
   ```

2. **Check PM2 working directory:**
   ```bash
   pm2 describe backend | grep "cwd"
   # Should show: /var/www/backend
   ```

3. **Check PM2 logs:**
   ```bash
   pm2 logs backend --lines 50
   ```

4. **Verify routes in compiled code:**
   ```bash
   grep -n "public/all-content" dist/routes/media.route.js
   ```

### Issue: Build Fails

1. **Check TypeScript errors:**
   ```bash
   npm run build 2>&1 | grep -i error
   ```

2. **Check Node.js version:**
   ```bash
   node --version
   # Should be Node 18+ or 20+
   ```

3. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Issue: PM2 Won't Restart

1. **Kill and restart:**
   ```bash
   pm2 kill
   cd /var/www/backend
   pm2 start dist/index.js --name backend
   pm2 save
   ```

---

## Post-Deployment

After successful deployment:

1. **Monitor PM2:**
   ```bash
   pm2 monit
   ```

2. **Check logs:**
   ```bash
   pm2 logs backend --lines 100
   ```

3. **Test from external:**
   ```bash
   curl https://api.jevahapp.com/api/media/public/all-content
   ```

4. **Verify Nginx is proxying correctly:**
   ```bash
   curl -i https://api.jevahapp.com/health
   ```

---

## Important Notes

- ⚠️ **The deployment script resets ALL local changes** - make sure you don't have important uncommitted work
- ✅ **Always test endpoints after deployment** to ensure routes are working
- 📋 **Keep PM2 logs monitored** for the first few minutes after deployment
- 🔄 **If routes still 404**, check PM2 is running from correct directory and file

---

**Last Updated:** December 28, 2025

