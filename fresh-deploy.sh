#!/bin/bash
# Fresh Deployment Script - Complete Clean Install
# This script deletes the old codebase and clones fresh from the correct repo

set -e  # Exit on any error

echo "🚀 FRESH DEPLOYMENT - CLEAN INSTALL"
echo "===================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BACKEND_DIR="/var/www/backend"
REPO_URL="https://github.com/DonaldKnut/jevahapp-backend.git"
BRANCH="main"
PM2_NAME="backend"
PM2_SCRIPT="dist/index.js"

# Step 1: Confirm action
echo -e "${YELLOW}⚠️  WARNING: This will DELETE the entire codebase and clone fresh!${NC}"
echo "Directory: $BACKEND_DIR"
echo "Repository: $REPO_URL"
echo ""
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Step 2: Stop PM2 process
echo "🛑 Step 1: Stopping PM2 process..."
if pm2 list | grep -q "$PM2_NAME"; then
    pm2 stop "$PM2_NAME" || true
    pm2 delete "$PM2_NAME" || true
    echo -e "${GREEN}✅ PM2 process stopped${NC}"
else
    echo -e "${YELLOW}⚠️  PM2 process '$PM2_NAME' not found${NC}"
fi
echo ""

# Step 3: Backup .env file if it exists
echo "💾 Step 2: Backing up .env file..."
if [ -f "$BACKEND_DIR/.env" ]; then
    cp "$BACKEND_DIR/.env" "$BACKEND_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
    ENV_BACKUP="$BACKEND_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✅ .env backed up to $ENV_BACKUP${NC}"
else
    echo -e "${YELLOW}⚠️  No .env file found${NC}"
    ENV_BACKUP=""
fi
echo ""

# Step 4: Navigate to parent directory
echo "📁 Step 3: Navigating to parent directory..."
cd /var/www || { echo -e "${RED}❌ Failed to navigate to /var/www${NC}"; exit 1; }
echo -e "${GREEN}✅ Current directory: $(pwd)${NC}"
echo ""

# Step 5: Remove old backend directory
echo "🗑️  Step 4: Removing old backend directory..."
if [ -d "$BACKEND_DIR" ]; then
    rm -rf "$BACKEND_DIR"
    echo -e "${GREEN}✅ Old backend directory removed${NC}"
else
    echo -e "${YELLOW}⚠️  Backend directory doesn't exist${NC}"
fi
echo ""

# Step 6: Clone fresh repository
echo "📥 Step 5: Cloning fresh repository..."
git clone -b "$BRANCH" "$REPO_URL" backend
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Clone failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Repository cloned${NC}"
echo ""

# Step 7: Navigate to backend directory
echo "📁 Step 6: Navigating to backend directory..."
cd "$BACKEND_DIR" || { echo -e "${RED}❌ Failed to navigate to $BACKEND_DIR${NC}"; exit 1; }
echo -e "${GREEN}✅ Current directory: $(pwd)${NC}"
echo ""

# Step 8: Restore .env file if it was backed up
if [ -n "$ENV_BACKUP" ] && [ -f "$ENV_BACKUP" ]; then
    echo "📋 Step 7: Restoring .env file..."
    cp "$ENV_BACKUP" "$BACKEND_DIR/.env"
    echo -e "${GREEN}✅ .env file restored${NC}"
else
    echo "📋 Step 7: Setting up .env file..."
    if [ -f "$BACKEND_DIR/env.example" ]; then
        cp "$BACKEND_DIR/env.example" "$BACKEND_DIR/.env"
        echo -e "${YELLOW}⚠️  Created .env from env.example - PLEASE UPDATE WITH YOUR VALUES!${NC}"
    else
        echo -e "${YELLOW}⚠️  No env.example found - you'll need to create .env manually${NC}"
    fi
fi
echo ""

# Step 9: Install dependencies
echo "📦 Step 8: Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ npm install failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 10: Build TypeScript
echo "🔨 Step 9: Building TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Step 11: Verify build output
echo "✅ Step 10: Verifying build output..."
if [ ! -f "$BACKEND_DIR/dist/index.js" ]; then
    echo -e "${RED}❌ dist/index.js not found!${NC}"
    exit 1
fi
if [ ! -f "$BACKEND_DIR/dist/app.js" ]; then
    echo -e "${RED}❌ dist/app.js not found!${NC}"
    exit 1
fi
if [ ! -f "$BACKEND_DIR/dist/routes/media.route.js" ]; then
    echo -e "${RED}❌ dist/routes/media.route.js not found!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ All critical files exist${NC}"
echo ""

# Step 12: Verify routes in compiled code
echo "🔍 Step 11: Verifying routes in compiled code..."
if ! grep -q "public/all-content" "$BACKEND_DIR/dist/routes/media.route.js"; then
    echo -e "${RED}❌ Route '/api/media/public/all-content' NOT found!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Route '/api/media/public/all-content' found${NC}"

if ! grep -q "/stats" "$BACKEND_DIR/dist/routes/notification.routes.js"; then
    echo -e "${RED}❌ Route '/api/notifications/stats' NOT found!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Route '/api/notifications/stats' found${NC}"

if ! grep -q "/default" "$BACKEND_DIR/dist/routes/media.route.js"; then
    echo -e "${RED}❌ Route '/api/media/default' NOT found!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Route '/api/media/default' found${NC}"
echo ""

# Step 13: Start PM2
echo "🚀 Step 12: Starting PM2..."
cd "$BACKEND_DIR"
pm2 start "$PM2_SCRIPT" --name "$PM2_NAME"
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ PM2 start failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ PM2 started${NC}"
echo ""

# Step 14: Save PM2 configuration
echo "💾 Step 13: Saving PM2 configuration..."
pm2 save
echo -e "${GREEN}✅ PM2 configuration saved${NC}"
echo ""

# Step 15: Wait for server to start
echo "⏳ Step 14: Waiting for server to start..."
sleep 5
echo ""

# Step 16: Test endpoints
echo "🧪 Step 15: Testing endpoints..."

# Test health
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
    echo -e "${RED}❌ 404 Not Found${NC}"
    echo "Checking PM2 logs..."
    pm2 logs "$PM2_NAME" --lines 20 --nostream
else
    echo -e "${YELLOW}⚠️  $MEDIA_CODE${NC}"
fi

# Test media default
echo -n "Testing /api/media/default... "
DEFAULT_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/media/default 2>/dev/null || echo "000")
if [ "$DEFAULT_CODE" = "200" ]; then
    echo -e "${GREEN}✅ 200 OK${NC}"
else
    echo -e "${YELLOW}⚠️  $DEFAULT_CODE${NC}"
fi

# Test notifications stats
echo -n "Testing /api/notifications/stats... "
NOTIF_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/notifications/stats 2>/dev/null || echo "000")
if [ "$NOTIF_CODE" = "200" ] || [ "$NOTIF_CODE" = "401" ]; then
    echo -e "${GREEN}✅ $NOTIF_CODE (Route exists)${NC}"
elif [ "$NOTIF_CODE" = "404" ]; then
    echo -e "${RED}❌ 404 Not Found${NC}"
else
    echo -e "${YELLOW}⚠️  $NOTIF_CODE${NC}"
fi

echo ""

# Step 17: Show PM2 status
echo "📊 Step 16: PM2 Status..."
pm2 list
echo ""

# Step 18: Show recent logs
echo "📋 Step 17: Recent PM2 logs..."
pm2 logs "$PM2_NAME" --lines 10 --nostream
echo ""

# Final summary
echo "=================================="
echo -e "${GREEN}✅ FRESH DEPLOYMENT COMPLETE${NC}"
echo "=================================="
echo ""
echo "📊 Summary:"
echo "  - Old codebase removed"
echo "  - Fresh clone from: $REPO_URL"
echo "  - Dependencies installed"
echo "  - TypeScript compiled"
echo "  - Routes verified"
echo "  - PM2 started and saved"
echo "  - Endpoints tested"
echo ""
echo "🌐 Test from external:"
echo "  curl https://api.jevahapp.com/api/media/public/all-content"
echo ""
echo "📝 Next steps:"
echo "  1. Verify .env file has all required variables"
echo "  2. Check PM2 logs: pm2 logs $PM2_NAME"
echo "  3. Monitor: pm2 monit"
echo ""

