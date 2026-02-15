# Quick Fix - Get Server Running

## Option 1: Test Server Startup Manually

```bash
cd /var/www/backend
node test-server-start.js
```

This will show you exactly where it's failing.

## Option 2: Check if .env is the problem

```bash
cd /var/www/backend

# Check if .env exists
ls -lah .env

# If missing, create minimal .env
cat > .env << EOF
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/jevah
JWT_SECRET=temp-secret-change-me
NODE_ENV=production
EOF

# Then rebuild and restart
npm run build
pm2 restart backend
```

## Option 3: Disable Redis Completely (Temporary)

If Redis is the issue, we can disable it completely:

```bash
# Edit session config to skip Redis entirely
cd /var/www/backend
# The code already has fallback, but if Redis connection is blocking startup,
# we can set REDIS_URL to empty or comment out Redis usage
```

## Option 4: Check MongoDB Connection

```bash
# Test if MongoDB is accessible
mongosh mongodb://127.0.0.1:27017/jevah
# Or
mongo mongodb://127.0.0.1:27017/jevah
```

## Option 5: Run with More Verbose Logging

```bash
cd /var/www/backend
NODE_ENV=development node dist/index.js
```

This will show more detailed error messages.

