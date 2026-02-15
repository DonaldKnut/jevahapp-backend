#!/bin/bash
# Complete Production Deployment Script
# This script ensures ALL routes are registered and the server is fully updated

set -e  # Exit on any error

echo "🚀 COMPLETE PRODUCTION DEPLOYMENT"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="/var/www/backend"
PM2_NAME="backend"

# Step 1: Navigate to backend directory
echo "📁 Step 1: Navigating to backend directory..."
cd "$BACKEND_DIR" || { echo -e "${RED}❌ Failed to navigate to $BACKEND_DIR${NC}"; exit 1; }
echo -e "${GREEN}✅ Current directory: $(pwd)${NC}"
echo ""

# Step 2: Fetch latest from remote
echo "📥 Step 2: Fetching latest code from remote..."
git fetch origin
echo -e "${GREEN}✅ Fetched latest code${NC}"
echo ""

# Step 3: Show current status
echo "📊 Step 3: Current git status..."
git status --short | head -20
echo ""

# Step 4: Reset ALL local changes to match remote (DESTRUCTIVE - but ensures consistency)
echo "🔄 Step 4: Resetting local changes to match remote..."
read -p "⚠️  This will DISCARD all local changes. Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Deployment cancelled${NC}"
    exit 1
fi

# Reset all files to match remote
git reset --hard origin/main
echo -e "${GREEN}✅ Reset all local changes${NC}"
echo ""

# Step 5: Clean untracked files (optional - be careful)
echo "🧹 Step 5: Cleaning untracked files..."
git clean -fd
echo -e "${GREEN}✅ Cleaned untracked files${NC}"
echo ""

# Step 6: Verify we're on latest commit
echo "📋 Step 6: Current commit..."
git log --oneline -1
echo ""

# Step 7: Install/update dependencies
echo "📦 Step 7: Installing dependencies..."
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 8: Remove old build
echo "🗑️  Step 8: Removing old build..."
rm -rf dist/
echo -e "${GREEN}✅ Removed old dist/ folder${NC}"
echo ""

# Step 9: Build TypeScript
echo "🔨 Step 9: Building TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Step 10: Verify critical files exist
echo "✅ Step 10: Verifying build output..."
if [ ! -f "dist/index.js" ]; then
    echo -e "${RED}❌ dist/index.js not found!${NC}"
    exit 1
fi
if [ ! -f "dist/app.js" ]; then
    echo -e "${RED}❌ dist/app.js not found!${NC}"
    exit 1
fi
if [ ! -f "dist/routes/media.route.js" ]; then
    echo -e "${RED}❌ dist/routes/media.route.js not found!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ All critical files exist${NC}"
echo ""

# Step 11: Verify routes are in compiled code
echo "🔍 Step 11: Verifying routes in compiled code..."
if ! grep -q "public/all-content" dist/routes/media.route.js; then
    echo -e "${RED}❌ Route '/api/media/public/all-content' NOT found in compiled code!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Route '/api/media/public/all-content' found${NC}"

if ! grep -q "/stats" dist/routes/notification.routes.js; then
    echo -e "${RED}❌ Route '/api/notifications/stats' NOT found in compiled code!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Route '/api/notifications/stats' found${NC}"

if ! grep -q "/default" dist/routes/media.route.js; then
    echo -e "${RED}❌ Route '/api/media/default' NOT found in compiled code!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Route '/api/media/default' found${NC}"
echo ""

# Step 12: Check PM2 status
echo "📊 Step 12: Checking PM2 status..."
pm2 list
echo ""

# Step 13: Restart PM2
echo "🔄 Step 13: Restarting PM2 process..."
pm2 restart "$PM2_NAME" || pm2 restart all
echo -e "${GREEN}✅ PM2 restarted${NC}"
echo ""

# Step 14: Wait for server to start
echo "⏳ Step 14: Waiting for server to start..."
sleep 5
echo ""

# Step 15: Test endpoints
echo "🧪 Step 15: Testing endpoints..."

# Test health endpoint
echo -n "Testing /health... "
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/health 2>/dev/null || echo "000")
if [ "$HEALTH_CODE" = "200" ]; then
    echo -e "${GREEN}✅ 200 OK${NC}"
else
    echo -e "${RED}❌ $HEALTH_CODE${NC}"
fi

# Test media public route
echo -n "Testing /api/media/public/all-content... "
MEDIA_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/media/public/all-content 2>/dev/null || echo "000")
if [ "$MEDIA_CODE" = "200" ]; then
    echo -e "${GREEN}✅ 200 OK${NC}"
elif [ "$MEDIA_CODE" = "404" ]; then
    echo -e "${RED}❌ 404 Not Found - Route still not registered!${NC}"
    echo "Checking PM2 logs..."
    pm2 logs "$PM2_NAME" --lines 20 --nostream
    exit 1
else
    echo -e "${YELLOW}⚠️  $MEDIA_CODE${NC}"
fi

# Test media default route
echo -n "Testing /api/media/default... "
DEFAULT_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/media/default 2>/dev/null || echo "000")
if [ "$DEFAULT_CODE" = "200" ]; then
    echo -e "${GREEN}✅ 200 OK${NC}"
elif [ "$DEFAULT_CODE" = "404" ]; then
    echo -e "${RED}❌ 404 Not Found${NC}"
else
    echo -e "${YELLOW}⚠️  $DEFAULT_CODE${NC}"
fi

# Test notifications stats (should be 401 without auth, not 404)
echo -n "Testing /api/notifications/stats... "
NOTIF_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/notifications/stats 2>/dev/null || echo "000")
if [ "$NOTIF_CODE" = "200" ] || [ "$NOTIF_CODE" = "401" ]; then
    echo -e "${GREEN}✅ $NOTIF_CODE (Route exists)${NC}"
elif [ "$NOTIF_CODE" = "404" ]; then
    echo -e "${RED}❌ 404 Not Found - Route not registered!${NC}"
    exit 1
else
    echo -e "${YELLOW}⚠️  $NOTIF_CODE${NC}"
fi

echo ""

# Step 16: Show PM2 logs
echo "📋 Step 16: Recent PM2 logs..."
pm2 logs "$PM2_NAME" --lines 10 --nostream
echo ""

# Step 17: Final summary
echo "=================================="
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE${NC}"
echo "=================================="
echo ""
echo "📊 Summary:"
echo "  - Code updated from remote"
echo "  - All local changes reset"
echo "  - Dependencies installed"
echo "  - TypeScript compiled"
echo "  - Routes verified in compiled code"
echo "  - PM2 restarted"
echo "  - Endpoints tested"
echo ""
echo "🌐 Test from external:"
echo "  curl https://api.jevahapp.com/api/media/public/all-content"
echo ""

