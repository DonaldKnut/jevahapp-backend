# Quick Diagnostic Commands for Server

Run these commands on your server to diagnose the 404 issue:

```bash
# 1. Check if build actually created the files
ls -lah dist/index.js dist/app.js
ls -lah dist/routes/media.route.js

# 2. Check if route exists in compiled code
grep -i "public/all-content" dist/routes/media.route.js

# 3. Check what PM2 is actually running
pm2 info backend

# 4. Check PM2 working directory
pm2 info backend | grep "exec cwd"

# 5. Check if PM2 is running from correct location
pm2 describe backend

# 6. Check PM2 logs for errors
pm2 logs backend --lines 30 --nostream

# 7. Verify the file PM2 is running actually has the route
# (Replace with actual path from pm2 info)
cat $(pm2 info backend | grep "script path" | awk '{print $4}') | grep -i "media" | head -5
```

