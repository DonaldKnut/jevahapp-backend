#!/bin/bash
# Server Diagnostic Script
# Run this on your Contabo VPS to diagnose route issues

echo "🔍 Jevah Backend Server Diagnostic"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the backend root directory."
    exit 1
fi

echo "📁 Current Directory: $(pwd)"
echo ""

# Check PM2 status
echo "📊 PM2 Status:"
pm2 list
echo ""

# Check PM2 process details
PM2_NAME=$(pm2 jlist | jq -r '.[0].name' 2>/dev/null || echo "jevahapp-backend")
echo "🔍 PM2 Process Details for: $PM2_NAME"
pm2 info $PM2_NAME 2>/dev/null || echo "⚠️  Could not get PM2 info"
echo ""

# Check if dist/ folder exists
echo "📦 Build Status:"
if [ -d "dist" ]; then
    echo "✅ dist/ folder exists"
    echo "   Latest file: $(ls -t dist/*.js 2>/dev/null | head -1 | xargs ls -lh 2>/dev/null | awk '{print $6, $7, $8, $9}')"
    
    # Check if main files exist
    if [ -f "dist/index.js" ]; then
        echo "✅ dist/index.js exists"
        INDEX_TIME=$(stat -c %y dist/index.js 2>/dev/null || stat -f "%Sm" dist/index.js 2>/dev/null)
        echo "   Modified: $INDEX_TIME"
    else
        echo "❌ dist/index.js MISSING!"
    fi
    
    if [ -f "dist/app.js" ]; then
        echo "✅ dist/app.js exists"
        APP_TIME=$(stat -c %y dist/app.js 2>/dev/null || stat -f "%Sm" dist/app.js 2>/dev/null)
        echo "   Modified: $APP_TIME"
    else
        echo "❌ dist/app.js MISSING!"
    fi
else
    echo "❌ dist/ folder MISSING! Run 'npm run build'"
fi
echo ""

# Check source code modification time
echo "📝 Source Code Status:"
if [ -f "src/app.ts" ]; then
    SRC_TIME=$(stat -c %y src/app.ts 2>/dev/null || stat -f "%Sm" src/app.ts 2>/dev/null)
    echo "   src/app.ts modified: $SRC_TIME"
fi

if [ -f "src/routes/media.route.ts" ]; then
    ROUTE_TIME=$(stat -c %y src/routes/media.route.ts 2>/dev/null || stat -f "%Sm" src/routes/media.route.ts 2>/dev/null)
    echo "   src/routes/media.route.ts modified: $ROUTE_TIME"
fi
echo ""

# Check if route exists in compiled code
echo "🔍 Route Check in Compiled Code:"
if [ -f "dist/app.js" ]; then
    if grep -q "public/all-content" dist/app.js 2>/dev/null; then
        echo "✅ Route '/api/media/public/all-content' found in dist/app.js"
    else
        echo "❌ Route '/api/media/public/all-content' NOT found in dist/app.js"
        echo "   ⚠️  Code needs to be rebuilt!"
    fi
else
    echo "⚠️  Cannot check - dist/app.js not found"
fi
echo ""

# Test backend endpoints
echo "🌐 Backend Endpoint Tests:"
echo ""

echo "1. Testing /health:"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/health 2>/dev/null)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "   ✅ /health returns 200"
else
    echo "   ❌ /health returns $HEALTH_RESPONSE"
fi
echo ""

echo "2. Testing /api/media/public/all-content:"
MEDIA_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/media/public/all-content 2>/dev/null)
if [ "$MEDIA_RESPONSE" = "200" ]; then
    echo "   ✅ /api/media/public/all-content returns 200"
elif [ "$MEDIA_RESPONSE" = "404" ]; then
    echo "   ❌ /api/media/public/all-content returns 404 (Route not found)"
    echo "   ⚠️  This indicates outdated compiled code!"
else
    echo "   ⚠️  /api/media/public/all-content returns $MEDIA_RESPONSE"
fi
echo ""

echo "3. Testing /api/notifications/stats:"
NOTIF_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/notifications/stats 2>/dev/null)
if [ "$NOTIF_RESPONSE" = "200" ] || [ "$NOTIF_RESPONSE" = "401" ]; then
    echo "   ✅ /api/notifications/stats returns $NOTIF_RESPONSE (200=OK, 401=needs auth)"
elif [ "$NOTIF_RESPONSE" = "404" ]; then
    echo "   ❌ /api/notifications/stats returns 404 (Route not found)"
    echo "   ⚠️  This indicates outdated compiled code!"
else
    echo "   ⚠️  /api/notifications/stats returns $NOTIF_RESPONSE"
fi
echo ""

# Check Node.js version
echo "🟢 Node.js Version:"
node --version
echo ""

# Check if TypeScript is installed
echo "📘 TypeScript Check:"
if command -v tsc &> /dev/null; then
    echo "   ✅ TypeScript compiler available"
    tsc --version
else
    echo "   ⚠️  TypeScript compiler not found in PATH (may be in node_modules)"
fi
echo ""

# Summary and recommendations
echo "📋 SUMMARY & RECOMMENDATIONS:"
echo "=============================="

if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
    echo "❌ CRITICAL: dist/ folder missing or incomplete"
    echo "   → Run: npm run build"
elif [ "$MEDIA_RESPONSE" = "404" ] || [ "$NOTIF_RESPONSE" = "404" ]; then
    echo "❌ CRITICAL: Routes returning 404 - code is outdated"
    echo "   → Run: npm run build && pm2 restart $PM2_NAME"
elif [ "$HEALTH_RESPONSE" != "200" ]; then
    echo "❌ CRITICAL: Backend not responding"
    echo "   → Check PM2 logs: pm2 logs $PM2_NAME"
    echo "   → Check if backend is running: pm2 list"
else
    echo "✅ Backend appears to be working correctly"
fi

echo ""
echo "💡 Quick Fix Command:"
echo "   cd $(pwd) && npm run build && pm2 restart $PM2_NAME"
echo ""

