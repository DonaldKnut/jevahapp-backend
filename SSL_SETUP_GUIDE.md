# SSL/HTTPS Setup Guide for api.jevahapp.com

## Prerequisites
- ✅ Server is running on port 4000
- ✅ Nginx is installed
- ✅ Domain `api.jevahapp.com` points to your server IP
- ✅ Port 80 and 443 are open in firewall

---

## Step 1: Install Certbot (Let's Encrypt)

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

---

## Step 2: Get SSL Certificate

```bash
# Get certificate and automatically configure Nginx
sudo certbot --nginx -d api.jevahapp.com

# Follow the prompts:
# - Enter your email
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

This will:
- Get SSL certificate from Let's Encrypt
- Automatically update your Nginx config
- Set up auto-renewal

---

## Step 3: Verify Nginx Config

After certbot runs, check your Nginx config:

```bash
sudo nano /etc/nginx/sites-available/api.jevahapp.com
```

It should look something like this:

```nginx
server {
    server_name api.jevahapp.com;

    # SSL Configuration (added by certbot)
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/api.jevahapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.jevahapp.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # API Routes
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

    # Health check (not under /api)
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

# HTTP to HTTPS redirect (added by certbot)
server {
    if ($host = api.jevahapp.com) {
        return 301 https://$host$request_uri;
    }
    
    listen 80;
    server_name api.jevahapp.com;
    return 404;
}
```

---

## Step 4: Test Nginx Config

```bash
sudo nginx -t
```

Should show: `syntax is ok` and `test is successful`

---

## Step 5: Reload Nginx

```bash
sudo systemctl reload nginx
```

---

## Step 6: Test HTTPS Endpoints

```bash
# Test health endpoint
curl https://api.jevahapp.com/health

# Test media endpoint
curl https://api.jevahapp.com/api/media/public/all-content

# Test with verbose to see SSL details
curl -v https://api.jevahapp.com/health
```

---

## Step 7: Verify Auto-Renewal

Certbot sets up auto-renewal automatically. Test it:

```bash
# Test renewal (dry run)
sudo certbot renew --dry-run

# Check renewal status
sudo systemctl status certbot.timer
```

---

## Troubleshooting

### Issue: Certificate not issued

**Check DNS:**
```bash
# Verify domain points to your server
dig api.jevahapp.com
nslookup api.jevahapp.com
```

**Check firewall:**
```bash
# Port 80 and 443 must be open
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Issue: Nginx config errors

```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check Nginx access logs
sudo tail -f /var/log/nginx/access.log
```

### Issue: 502 Bad Gateway

This means Nginx can't reach the backend:

```bash
# Check if backend is running
curl http://127.0.0.1:4000/health

# Check Nginx proxy settings
sudo nginx -t
```

### Issue: Mixed Content Warnings

If your frontend is on HTTPS but calling HTTP API, update your frontend to use `https://api.jevahapp.com`

---

## Manual Certificate Setup (if certbot fails)

If certbot doesn't work automatically:

```bash
# 1. Get certificate only (no auto-config)
sudo certbot certonly --nginx -d api.jevahapp.com

# 2. Manually update Nginx config
sudo nano /etc/nginx/sites-available/api.jevahapp.com

# Add SSL lines:
# listen 443 ssl;
# ssl_certificate /etc/letsencrypt/live/api.jevahapp.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/api.jevahapp.com/privkey.pem;

# 3. Reload Nginx
sudo systemctl reload nginx
```

---

## Security Headers (Optional but Recommended)

Add these to your Nginx config for better security:

```nginx
server {
    # ... existing config ...
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # ... rest of config ...
}
```

---

## Final Checklist

- [ ] Certbot installed
- [ ] SSL certificate obtained
- [ ] Nginx config updated with SSL
- [ ] Nginx test passes
- [ ] Nginx reloaded
- [ ] HTTPS endpoint works: `curl https://api.jevahapp.com/health`
- [ ] API endpoint works: `curl https://api.jevahapp.com/api/media/public/all-content`
- [ ] HTTP redirects to HTTPS
- [ ] Auto-renewal configured

---

**After setup, your API will be accessible at:**
- ✅ `https://api.jevahapp.com/api/media/public/all-content`
- ✅ `https://api.jevahapp.com/api/media/default`
- ✅ `https://api.jevahapp.com/api/notifications/stats` (with auth)
- ✅ `https://api.jevahapp.com/health`

