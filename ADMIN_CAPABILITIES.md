# Admin Capabilities - Complete Guide

**Date:** 2025-01-27  
**Status:** Comprehensive Admin Feature List

---

## 🎯 What Can an Admin Do?

Admins have **full platform management capabilities** across 8 major areas:

---

## 1. 📊 Platform Analytics & Insights

### View Platform Statistics
**Endpoint:** `GET /api/admin/dashboard/analytics`

**What admins can see:**
- ✅ **User Metrics:**
  - Total users
  - New users (24h, 7d, 30d)
  - Active users (30d)
  - Banned users count
  - Role distribution

- ✅ **Content Metrics:**
  - Total content items
  - New content (24h, 7d, 30d)
  - Content by type (music, videos, podcasts, etc.)
  - Content type distribution

- ✅ **Moderation Metrics:**
  - Pending moderation count
  - Rejected content count
  - Moderation status distribution

- ✅ **Report Metrics:**
  - Total reports
  - Pending reports

### Advanced Analytics
**Endpoints:** `GET /api/analytics/*` (admin-only endpoints)

- ✅ User activity analytics
- ✅ Content performance metrics
- ✅ Export analytics data

---

## 2. 👥 User Management

### View All Users
**Endpoint:** `GET /api/admin/users`

**Capabilities:**
- ✅ List all users with pagination
- ✅ Search by email, firstName, lastName
- ✅ Filter by:
  - Role (learner, parent, educator, moderator, admin, content_creator, vendor, church_admin, artist)
  - Ban status (banned/not banned)
  - Email verification status
- ✅ Sort and paginate results

### View User Details
**Endpoint:** `GET /api/admin/users/:id`

**What admins can see:**
- ✅ Full user profile information
- ✅ User activity statistics
- ✅ Media upload count
- ✅ Reports count
- ✅ Account status
- ✅ Verification status

### Ban Users
**Endpoint:** `POST /api/admin/users/:id/ban`

**Capabilities:**
- ✅ Ban users temporarily (specify duration in days)
- ✅ Ban users permanently (no duration)
- ✅ Add ban reason
- ✅ Automatic unban when duration expires
- ✅ **Security:** Cannot ban themselves
- ✅ **Security:** Cannot ban other admins

**Example:**
```json
{
  "reason": "Spam content",
  "duration": 7  // 7 days, or omit for permanent
}
```

### Unban Users
**Endpoint:** `POST /api/admin/users/:id/unban`

**Capabilities:**
- ✅ Remove ban from users
- ✅ Restore user access immediately

### Change User Roles
**Endpoint:** `PATCH /api/admin/users/:id/role`

**Capabilities:**
- ✅ Change user roles to:
  - `learner`
  - `parent`
  - `educator`
  - `moderator`
  - `admin`
  - `content_creator`
  - `vendor`
  - `church_admin`
  - `artist`
- ✅ **Security:** Cannot remove own admin role
- ✅ **Security:** Cannot remove other admins' roles

**Example:**
```json
{
  "role": "content_creator"
}
```

### Delete Users
**Endpoint:** `DELETE /api/users/:userId`

**Capabilities:**
- ✅ Permanently delete user accounts
- ✅ Remove all user data

---

## 3. 🎬 Content Moderation

### View Moderation Queue
**Endpoint:** `GET /api/admin/moderation/queue`

**Capabilities:**
- ✅ View all content pending moderation
- ✅ Filter by status:
  - `pending` - Awaiting review
  - `under_review` - Currently being reviewed
  - `approved` - Already approved
  - `rejected` - Rejected content
- ✅ Paginate results
- ✅ See content details, uploader info, report counts

### Approve/Reject Content
**Endpoint:** `PATCH /api/admin/moderation/:id/status`

**Capabilities:**
- ✅ Approve content (make it visible)
- ✅ Reject content (hide it)
- ✅ Mark as "under review"
- ✅ Add admin notes
- ✅ **Auto-email:** Users receive email when content is rejected
- ✅ **Audit:** All actions logged

**Example:**
```json
{
  "status": "rejected",
  "adminNotes": "Violates community guidelines"
}
```

### View Reports
**Capabilities:**
- ✅ See all user reports
- ✅ View report details
- ✅ Track report counts per content
- ✅ Auto-alerts when content gets 3+ reports

---

## 4. 🎵 Copyright-Free Content Management

### Upload Copyright-Free Songs
**Endpoint:** `POST /api/audio/copyright-free`

**Capabilities:**
- ✅ Upload copyright-free songs to platform library
- ✅ Set title, singer, file URL
- ✅ Add thumbnail image
- ✅ Set duration
- ✅ **Admin-only:** Only admins can upload

**Example:**
```json
{
  "title": "Worship Song",
  "singer": "Artist Name",
  "fileUrl": "https://...",
  "thumbnailUrl": "https://...",
  "duration": 240
}
```

### Update Copyright-Free Songs
**Endpoint:** `PUT /api/audio/copyright-free/:songId`

**Capabilities:**
- ✅ Update song title
- ✅ Update singer name
- ✅ Update thumbnail
- ✅ Update duration

### Delete Copyright-Free Songs
**Endpoint:** `DELETE /api/audio/copyright-free/:songId`

**Capabilities:**
- ✅ Remove songs from platform library

---

## 5. 🏛️ Church Management

### Create Churches
**Endpoint:** `POST /api/admin/churches`

**Capabilities:**
- ✅ Add new churches to platform
- ✅ Set church details

### Create Church Branches
**Endpoint:** `POST /api/admin/churches/:id/branches`

**Capabilities:**
- ✅ Add branches to existing churches

### Bulk Church Operations
**Endpoint:** `POST /api/admin/churches/bulk`

**Capabilities:**
- ✅ Bulk upload/update churches
- ✅ Efficient mass operations

### Reindex Churches
**Endpoint:** `POST /api/admin/churches/reindex`

**Capabilities:**
- ✅ Rebuild search indexes
- ✅ Optimize church search

---

## 6. 📝 Devotional Management

### Create Devotionals
**Endpoint:** `POST /api/devotionals/create-devotional`

**Capabilities:**
- ✅ Create devotionals (admin or verified creators)
- ✅ Publish devotional content

---

## 7. 📋 Activity & Audit Logs

### View Admin Activity Log
**Endpoint:** `GET /api/admin/activity`

**Capabilities:**
- ✅ View all admin actions
- ✅ Filter by admin ID
- ✅ See:
  - Who performed the action
  - What action was performed
  - When it happened
  - IP address
  - User agent
  - Target user/content
  - Action metadata

### View System Logs
**Endpoint:** `GET /api/logs`

**Capabilities:**
- ✅ View system-wide logs
- ✅ Debug issues
- ✅ Monitor system health

---

## 8. 🔍 Advanced Features

### User Statistics
**Endpoint:** `GET /api/users/stats`

**Capabilities:**
- ✅ View platform user statistics
- ✅ See aggregated user data

### Get All Users (Alternative)
**Endpoint:** `GET /api/users` (admin-only)

**Capabilities:**
- ✅ Alternative endpoint for user listing
- ✅ Full user access

---

## 🔒 Security Protections

### What Admins CANNOT Do

- ❌ **Cannot ban themselves** (protected)
- ❌ **Cannot ban other admins** (protected)
- ❌ **Cannot remove their own admin role** (protected)
- ❌ **Cannot remove other admins' roles** (protected)
- ❌ **Cannot access user passwords** (never exposed)
- ❌ **Cannot bypass rate limiting** (all endpoints rate-limited)

### What Gets Logged

All admin actions are logged with:
- ✅ Admin ID
- ✅ Action type
- ✅ Target user/content
- ✅ Timestamp
- ✅ IP address
- ✅ User agent
- ✅ Action metadata

---

## 📊 Summary

### Admin Capabilities by Category

| Category | Actions Available |
|----------|------------------|
| **Analytics** | View platform stats, user metrics, content metrics |
| **User Management** | View, search, filter, ban, unban, change roles, delete |
| **Content Moderation** | Review queue, approve, reject, add notes |
| **Copyright-Free Content** | Upload, update, delete songs |
| **Church Management** | Create churches, branches, bulk operations |
| **Devotionals** | Create and publish |
| **Audit & Logs** | View activity logs, system logs |
| **Advanced** | User stats, analytics export |

### Total Admin Endpoints

**~40+ admin-protected endpoints** across 8 major areas

---

## 🎯 Quick Reference

### Most Common Admin Tasks

1. **Moderate Content:**
   - `GET /api/admin/moderation/queue` → View pending
   - `PATCH /api/admin/moderation/:id/status` → Approve/reject

2. **Manage Users:**
   - `GET /api/admin/users` → Find user
   - `POST /api/admin/users/:id/ban` → Ban user
   - `PATCH /api/admin/users/:id/role` → Change role

3. **View Analytics:**
   - `GET /api/admin/dashboard/analytics` → Platform stats

4. **Upload Content:**
   - `POST /api/audio/copyright-free` → Add copyright-free song

5. **Audit Trail:**
   - `GET /api/admin/activity` → View admin actions

---

## ✅ All Actions Are:

- ✅ **Authenticated** - Requires valid JWT token
- ✅ **Authorized** - Requires admin role
- ✅ **Rate Limited** - Protected against abuse
- ✅ **Audited** - All actions logged
- ✅ **Secure** - Self-protection in place

---

**Status:** ✅ **COMPREHENSIVE ADMIN SYSTEM**

Admins have full platform management capabilities with proper security, logging, and controls in place!

