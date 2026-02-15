#!/bin/bash
# Quick fix for server issues: Redis import and logs permissions

set -e

echo "🔧 Fixing Server Issues"
echo "======================"
echo ""

# 1. Fix logs directory permissions
echo "📁 Step 1: Fixing logs directory permissions..."
mkdir -p /var/www/backend/logs
chmod 755 /var/www/backend/logs
chown -R jevah:jevah /var/www/backend/logs 2>/dev/null || sudo chown -R jevah:jevah /var/www/backend/logs
echo "✅ Logs directory permissions fixed"
echo ""

# 2. Pull latest code (with Redis fix)
echo "📥 Step 2: Pulling latest code..."
cd /var/www/backend
git pull origin main || echo "⚠️  Git pull failed - continuing anyway"
echo ""

# 3. Rebuild
echo "🔨 Step 3: Rebuilding..."
npm run build
echo "✅ Build complete"
echo ""

# 4. Restart PM2
echo "🔄 Step 4: Restarting PM2..."
pm2 restart backend
sleep 5
echo "✅ PM2 restarted"
echo ""

# 5. Test
echo "🧪 Step 5: Testing..."
curl -i http://127.0.0.1:4000/health && echo "" || echo "❌ Health check failed"
curl -i http://127.0.0.1:4000/api/media/public/all-content | head -5 || echo "❌ Route test failed"
echo ""

echo "✅ Fix complete!"

