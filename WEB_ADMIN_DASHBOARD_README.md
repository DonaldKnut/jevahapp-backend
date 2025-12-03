# Web Admin Dashboard - Frontend Implementation Guide

**For:** Frontend Developer (Cursor AI)  
**Purpose:** Build complete web admin dashboard for Jevah App  
**Date:** 2025-01-27

---

## 🎯 Overview

This document provides everything needed to build a **complete web admin dashboard** that allows:
- ✅ **Admins** - Full platform management (highest priority)
- ✅ **Content Creators** - Content management capabilities
- ✅ **Artists** - Artist-specific features

**Single Source of Truth:** All data comes from the backend API. MongoDB is the database, but frontend should **never connect directly** to MongoDB. Always use the backend API endpoints.

---

## 🔐 Authentication

### Authentication Flow

**Backend uses JWT (JSON Web Tokens) for authentication.**

#### 1. Login Endpoint
```
POST /api/auth/login
Content-Type: application/json

Body:
{
  "email": "admin@jevah.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "user_id",
    "email": "admin@jevah.com",
    "firstName": "Admin",
    "lastName": "User",
    "role": "admin",  // ← Check this for access control
    "isVerifiedCreator": false,
    "isVerifiedVendor": false,
    "isVerifiedChurch": false
  }
}
```

#### 2. Using the Token

**Include token in all authenticated requests:**
```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

#### 3. Role-Based Access

**Check user role to determine access:**
- `role === "admin"` → Full admin dashboard access
- `role === "content_creator"` → Content creator dashboard
- `role === "artist"` → Artist dashboard

#### 4. Token Storage

**Store token securely:**
- Use `localStorage` or `sessionStorage` for web
- Include token in all API requests
- Handle token expiration (401 responses)

---

## 📡 API Base URL

**Base URL:** `https://your-backend-domain.com/api` (or `http://localhost:4000/api` for development)

**All endpoints below are relative to this base URL.**

---

## 🎨 Dashboard Structure

### Priority Order (Access Control)

1. **Admin Dashboard** (Highest Priority)
   - Full platform management
   - All features below

2. **Content Creator Dashboard**
   - Content upload/management
   - Analytics (own content)

3. **Artist Dashboard**
   - Artist profile management
   - Content management

---

## 📊 Admin Dashboard Features

### 1. Platform Analytics

#### Get Platform Analytics
```
GET /admin/dashboard/analytics
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "users": {
      "total": 1000,
      "new24h": 10,
      "new7d": 50,
      "new30d": 200,
      "active30d": 800,
      "banned": 5,
      "roleDistribution": [
        { "_id": "learner", "count": 500 },
        { "_id": "artist", "count": 100 }
      ]
    },
    "content": {
      "total": 5000,
      "new24h": 20,
      "new7d": 150,
      "new30d": 600,
      "byType": [
        { "_id": "music", "count": 2000 },
        { "_id": "videos", "count": 1500 }
      ]
    },
    "moderation": {
      "pending": 25,
      "rejected": 100,
      "statusDistribution": [...]
    },
    "reports": {
      "total": 50,
      "pending": 10
    }
  }
}
```

**UI Components Needed:**
- Dashboard cards showing key metrics
- Charts/graphs for trends
- Role distribution pie chart
- Content type distribution chart

---

### 2. User Management

#### Get All Users
```
GET /admin/users?page=1&limit=20&search=john&role=artist&isBanned=false
Headers: Authorization: Bearer {token}

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- search: string (searches email, firstName, lastName)
- role: string (filter by role)
- isBanned: boolean (filter by ban status)
- isEmailVerified: boolean (filter by verification)

Response:
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "user_id",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "artist",
        "isBanned": false,
        "isEmailVerified": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "lastLoginAt": "2024-01-27T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1000,
      "pages": 50
    }
  }
}
```

**UI Components Needed:**
- User table with sorting/filtering
- Search bar
- Role filter dropdown
- Ban status filter
- Pagination controls
- User detail modal/page

#### Get User Details
```
GET /admin/users/:userId
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "user": {
      "_id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "artist",
      "isBanned": false,
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "stats": {
      "mediaCount": 25,
      "reportsCount": 2,
      "activityCount": 150
    }
  }
}
```

#### Ban User
```
POST /admin/users/:userId/ban
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "reason": "Spam content",
  "duration": 7  // Optional: days (omit for permanent ban)
}

Response:
{
  "success": true,
  "message": "User banned successfully"
}
```

**UI Components Needed:**
- Ban user modal with reason input
- Duration selector (temporary/permanent)
- Confirmation dialog

#### Unban User
```
POST /admin/users/:userId/unban
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "User unbanned successfully"
}
```

#### Update User Role
```
PATCH /admin/users/:userId/role
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "role": "content_creator"  // Valid roles: learner, parent, educator, moderator, admin, content_creator, vendor, church_admin, artist
}

Response:
{
  "success": true,
  "message": "User role updated successfully",
  "data": {
    "userId": "user_id",
    "oldRole": "learner",
    "newRole": "content_creator"
  }
}
```

**UI Components Needed:**
- Role selector dropdown
- Confirmation dialog
- Success/error notifications

---

### 3. Content Moderation

#### Get Moderation Queue
```
GET /admin/moderation/queue?page=1&limit=20&status=pending
Headers: Authorization: Bearer {token}

Query Parameters:
- page: number
- limit: number
- status: string (pending, under_review, approved, rejected)

Response:
{
  "success": true,
  "data": {
    "media": [
      {
        "_id": "media_id",
        "title": "Content Title",
        "contentType": "music",
        "uploadedBy": {
          "_id": "user_id",
          "firstName": "John",
          "lastName": "Doe"
        },
        "moderationStatus": "pending",
        "reportCount": 3,
        "createdAt": "2024-01-27T00:00:00.000Z",
        "thumbnailUrl": "https://...",
        "fileUrl": "https://..."
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    }
  }
}
```

**UI Components Needed:**
- Moderation queue table
- Status filter tabs (Pending, Under Review, Approved, Rejected)
- Content preview modal
- Media player for audio/video
- Report details display

#### Update Moderation Status
```
PATCH /admin/moderation/:mediaId/status
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "status": "approved",  // or "rejected" or "under_review"
  "adminNotes": "Optional admin notes"
}

Response:
{
  "success": true,
  "message": "Moderation status updated successfully"
}
```

**UI Components Needed:**
- Action buttons (Approve/Reject/Under Review)
- Admin notes textarea
- Confirmation dialog
- Success notifications

---

### 4. Copyright-Free Songs Management

#### Upload Copyright-Free Song
```
POST /audio/copyright-free
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "title": "Worship Song Title",
  "singer": "Artist Name",
  "fileUrl": "https://storage.example.com/song.mp3",
  "thumbnailUrl": "https://storage.example.com/thumb.jpg",  // Optional
  "duration": 240  // Optional: seconds
}

Response:
{
  "success": true,
  "data": {
    "_id": "song_id",
    "title": "Worship Song Title",
    "singer": "Artist Name",
    "fileUrl": "https://...",
    "thumbnailUrl": "https://...",
    "duration": 240,
    "likeCount": 0,
    "viewCount": 0,
    "createdAt": "2024-01-27T00:00:00.000Z"
  }
}
```

**UI Components Needed:**
- Upload form with file picker
- Title input
- Singer/Artist input
- Thumbnail upload
- Duration input (or auto-detect)
- File upload progress indicator
- Preview before upload

#### Update Copyright-Free Song
```
PUT /audio/copyright-free/:songId
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "title": "Updated Title",  // Optional
  "singer": "Updated Artist",  // Optional
  "thumbnailUrl": "https://...",  // Optional
  "duration": 250  // Optional
}

Response:
{
  "success": true,
  "data": { /* Updated song object */ }
}
```

#### Delete Copyright-Free Song
```
DELETE /audio/copyright-free/:songId
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Song deleted successfully"
}
```

**UI Components Needed:**
- Song list/grid view
- Edit song modal/form
- Delete confirmation dialog
- Search/filter songs

---

### 5. Activity & Audit Logs

#### Get Admin Activity Log
```
GET /admin/activity?page=1&limit=50&adminId=admin_user_id
Headers: Authorization: Bearer {token}

Query Parameters:
- page: number
- limit: number
- adminId: string (optional: filter by admin)

Response:
{
  "success": true,
  "data": {
    "activities": [
      {
        "action": "admin_action",
        "resourceType": "admin",
        "resourceId": "target_user_id",
        "metadata": {
          "adminAction": "ban_user",
          "reason": "Spam content",
          "duration": 7
        },
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "timestamp": "2024-01-27T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 500,
      "pages": 10
    }
  }
}
```

**UI Components Needed:**
- Activity log table
- Filter by admin
- Date range filter
- Action type filter
- IP address display
- Timestamp formatting

---

### 6. Advanced Analytics

#### Get User Activity Analytics
```
GET /analytics/user-activity?startDate=2024-01-01&endDate=2024-01-27
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "totalActivities": 10000,
    "activitiesByType": [...],
    "topUsers": [...],
    "trends": [...]
  }
}
```

#### Get Advanced Analytics
```
GET /analytics/advanced?startDate=2024-01-01&endDate=2024-01-27
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "userGrowth": [...],
    "contentPerformance": [...],
    "engagementMetrics": [...]
  }
}
```

#### Export Analytics Data
```
GET /analytics/export?format=csv&startDate=2024-01-01&endDate=2024-01-27
Headers: Authorization: Bearer {token}

Response: CSV/JSON file download
```

**UI Components Needed:**
- Analytics dashboard with charts
- Date range picker
- Export button
- Trend visualizations

---

### 7. Church Management

#### Create Church
```
POST /admin/churches
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "name": "Church Name",
  "address": "Church Address",
  // ... other church fields
}

Response:
{
  "success": true,
  "data": { /* Church object */ }
}
```

#### Create Church Branch
```
POST /admin/churches/:churchId/branches
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "name": "Branch Name",
  "address": "Branch Address"
}

Response:
{
  "success": true,
  "data": { /* Branch object */ }
}
```

#### Bulk Upload Churches
```
POST /admin/churches/bulk
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "churches": [
    { "name": "Church 1", "address": "..." },
    { "name": "Church 2", "address": "..." }
  ]
}

Response:
{
  "success": true,
  "data": {
    "created": 10,
    "updated": 5,
    "failed": 0
  }
}
```

**UI Components Needed:**
- Church list/table
- Create church form
- Add branch form
- Bulk upload (CSV/JSON import)
- Church detail view

---

## 🎨 UI/UX Guidelines

### Dashboard Layout

```
┌─────────────────────────────────────────┐
│  Header: Logo | User Menu | Logout     │
├─────────────────────────────────────────┤
│  Sidebar Navigation                     │
│  ├─ Dashboard (Admin only)             │
│  ├─ Users (Admin only)                 │
│  ├─ Moderation (Admin only)            │
│  ├─ Copyright Songs (Admin only)       │
│  ├─ Churches (Admin only)              │
│  ├─ Analytics (Admin only)             │
│  ├─ Activity Logs (Admin only)         │
│  ├─ My Content (Creator/Artist)         │
│  └─ Profile                             │
├─────────────────────────────────────────┤
│  Main Content Area                      │
│  └─ [Page Content]                     │
└─────────────────────────────────────────┘
```

### Design Principles

1. **Responsive Design**
   - Mobile-first approach
   - Works on tablets and desktops
   - Collapsible sidebar on mobile

2. **Color Scheme**
   - Primary: Use your brand colors
   - Success: Green for approved/positive actions
   - Warning: Orange for pending/under review
   - Danger: Red for rejected/banned
   - Info: Blue for informational messages

3. **Components Needed**
   - Data tables with sorting/filtering
   - Modals for forms and confirmations
   - Toast notifications for success/error
   - Loading spinners
   - Pagination controls
   - Search bars
   - Filter dropdowns
   - Charts/graphs (use Chart.js, Recharts, or similar)
   - File upload components
   - Media preview components

4. **User Experience**
   - Show loading states during API calls
   - Display error messages clearly
   - Confirm destructive actions (ban, delete)
   - Success feedback for all actions
   - Breadcrumb navigation
   - Quick actions where appropriate

---

## 🔧 Technical Stack Recommendations

### Frontend Framework
- **React** (recommended) or **Vue.js** or **Next.js**
- Use TypeScript for type safety

### State Management
- **React Query / TanStack Query** (for API calls)
- **Zustand** or **Redux** (for global state)

### UI Library
- **Material-UI (MUI)** or **Ant Design** or **Chakra UI**
- **Tailwind CSS** for styling

### HTTP Client
- **Axios** or **Fetch API**
- Create an API service layer

### Example API Service Structure

```typescript
// api/admin.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Admin API functions
export const adminAPI = {
  // Analytics
  getAnalytics: () => api.get('/admin/dashboard/analytics'),
  
  // Users
  getUsers: (params) => api.get('/admin/users', { params }),
  getUserDetails: (userId) => api.get(`/admin/users/${userId}`),
  banUser: (userId, data) => api.post(`/admin/users/${userId}/ban`, data),
  unbanUser: (userId) => api.post(`/admin/users/${userId}/unban`),
  updateUserRole: (userId, role) => api.patch(`/admin/users/${userId}/role`, { role }),
  
  // Moderation
  getModerationQueue: (params) => api.get('/admin/moderation/queue', { params }),
  updateModerationStatus: (mediaId, data) => 
    api.patch(`/admin/moderation/${mediaId}/status`, data),
  
  // Copyright-Free Songs
  uploadSong: (data) => api.post('/audio/copyright-free', data),
  updateSong: (songId, data) => api.put(`/audio/copyright-free/${songId}`, data),
  deleteSong: (songId) => api.delete(`/audio/copyright-free/${songId}`),
  
  // Activity Logs
  getActivityLog: (params) => api.get('/admin/activity', { params }),
  
  // Analytics
  getUserActivityAnalytics: (params) => api.get('/analytics/user-activity', { params }),
  getAdvancedAnalytics: (params) => api.get('/analytics/advanced', { params }),
  exportAnalytics: (params) => api.get('/analytics/export', { params }),
  
  // Churches
  createChurch: (data) => api.post('/admin/churches', data),
  createBranch: (churchId, data) => api.post(`/admin/churches/${churchId}/branches`, data),
  bulkUploadChurches: (data) => api.post('/admin/churches/bulk', data),
};
```

---

## 🗄️ Database Connection

**IMPORTANT:** Frontend should **NEVER connect directly to MongoDB**.

**Single Source of Truth:**
- ✅ Backend API is the only interface to MongoDB
- ✅ Frontend makes HTTP requests to backend endpoints
- ✅ Backend handles all database operations
- ✅ All data flows through the API

**Why:**
- Security (no database credentials in frontend)
- Centralized business logic
- Consistent data validation
- Easier to maintain

**MongoDB Connection String:**
- Only needed for backend configuration
- Frontend doesn't need it
- Backend handles all database operations

---

## 🔐 Authentication Flow Implementation

```typescript
// auth.ts
export const authService = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data;
    
    // Store token
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    return { token, user };
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Redirect to login
  },
  
  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
  
  isAdmin: () => {
    const user = authService.getCurrentUser();
    return user?.role === 'admin';
  },
  
  isContentCreator: () => {
    const user = authService.getCurrentUser();
    return user?.role === 'content_creator';
  },
  
  isArtist: () => {
    const user = authService.getCurrentUser();
    return user?.role === 'artist';
  },
};
```

---

## 🛡️ Route Protection

```typescript
// ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { authService } from './auth';

export const ProtectedRoute = ({ 
  children, 
  requiredRole 
}: { 
  children: React.ReactNode;
  requiredRole?: 'admin' | 'content_creator' | 'artist';
}) => {
  const user = authService.getCurrentUser();
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/unauthorized" />;
  }
  
  return <>{children}</>;
};

// Usage in routes
<Route 
  path="/admin/*" 
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminDashboard />
    </ProtectedRoute>
  } 
/>
```

---

## 📋 Complete Feature Checklist

### Admin Dashboard (Priority 1)
- [ ] Login page
- [ ] Dashboard overview (analytics cards)
- [ ] User management (list, search, filter, ban, unban, change role)
- [ ] Moderation queue (view, approve, reject)
- [ ] Copyright-free songs (upload, edit, delete, list)
- [ ] Activity logs (view, filter)
- [ ] Advanced analytics (charts, export)
- [ ] Church management (create, branches, bulk upload)

### Content Creator Dashboard (Priority 2)
- [ ] Content upload
- [ ] My content list
- [ ] Content analytics
- [ ] Profile management

### Artist Dashboard (Priority 3)
- [ ] Artist profile
- [ ] Content management
- [ ] Analytics

### Common Features
- [ ] Authentication (login, logout)
- [ ] Profile page
- [ ] Settings
- [ ] Notifications
- [ ] Error handling
- [ ] Loading states

---

## 🚀 Getting Started

### 1. Environment Setup

Create `.env` file:
```
REACT_APP_API_URL=http://localhost:4000/api
# or production URL
REACT_APP_API_URL=https://your-backend-domain.com/api
```

### 2. Install Dependencies

```bash
npm install axios react-query @tanstack/react-query
# or
yarn add axios react-query @tanstack/react-query
```

### 3. Create API Service Layer

See example above in "Technical Stack Recommendations"

### 4. Implement Authentication

See "Authentication Flow Implementation" above

### 5. Build Dashboard Pages

Start with Admin Dashboard (highest priority), then Content Creator, then Artist.

---

## 📚 API Endpoint Summary

### Admin Endpoints (All require `Authorization: Bearer {token}`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/dashboard/analytics` | GET | Platform analytics |
| `/admin/users` | GET | List users |
| `/admin/users/:id` | GET | User details |
| `/admin/users/:id/ban` | POST | Ban user |
| `/admin/users/:id/unban` | POST | Unban user |
| `/admin/users/:id/role` | PATCH | Change user role |
| `/admin/moderation/queue` | GET | Moderation queue |
| `/admin/moderation/:id/status` | PATCH | Update moderation |
| `/admin/activity` | GET | Activity logs |
| `/audio/copyright-free` | POST | Upload song |
| `/audio/copyright-free/:id` | PUT | Update song |
| `/audio/copyright-free/:id` | DELETE | Delete song |
| `/analytics/user-activity` | GET | User activity analytics |
| `/analytics/advanced` | GET | Advanced analytics |
| `/analytics/export` | GET | Export analytics |
| `/admin/churches` | POST | Create church |
| `/admin/churches/:id/branches` | POST | Add branch |
| `/admin/churches/bulk` | POST | Bulk upload |

---

## ⚠️ Important Notes

1. **Error Handling**
   - Always handle 401 (unauthorized) - redirect to login
   - Handle 403 (forbidden) - show unauthorized message
   - Handle 400 (bad request) - show validation errors
   - Handle 500 (server error) - show generic error

2. **Rate Limiting**
   - Backend has rate limiting
   - Handle 429 (too many requests) gracefully
   - Show user-friendly messages

3. **File Uploads**
   - For copyright-free songs, you may need to upload files first
   - Get file URL from storage service
   - Then send URL to backend API

4. **Real-time Updates**
   - Consider WebSocket for real-time notifications
   - Or polling for moderation queue updates

5. **Pagination**
   - All list endpoints support pagination
   - Always implement pagination controls

---

## 🎯 Success Criteria

The dashboard is complete when:

- ✅ Admin can log in and access all features
- ✅ All admin endpoints are integrated
- ✅ User management works (view, ban, unban, change role)
- ✅ Moderation queue works (view, approve, reject)
- ✅ Copyright-free songs can be uploaded/managed
- ✅ Analytics display correctly
- ✅ Activity logs are viewable
- ✅ Responsive design works on all devices
- ✅ Error handling is comprehensive
- ✅ Loading states are shown
- ✅ Success/error notifications work

---

## 📞 Support

For backend API questions or issues:
- Check backend API documentation
- Review endpoint responses
- Test endpoints with Postman/curl first
- Backend is single source of truth

---

## 🎉 Ready to Build!

You now have everything needed to build a complete web admin dashboard. Start with the Admin Dashboard (highest priority), implement authentication, then build out each feature systematically.

**Remember:** Backend API is your single source of truth. Never connect directly to MongoDB from the frontend.

Good luck! 🚀

