# 📊 Comprehensive Analytics System Guide

## 🎯 **Overview**

Your Jevah app now has a **comprehensive analytics system** that provides deep insights into user behavior, content performance, and business metrics. This system is designed for both **admin dashboards** and **user analytics**.

## 🚀 **Key Features**

### **✅ Real-Time Analytics**

- Live user activity tracking
- Current session monitoring
- Real-time interaction counts
- Instant performance metrics

### **✅ Advanced User Analytics**

- Engagement scoring system
- User behavior patterns
- Session duration tracking
- Activity timeline analysis

### **✅ Content Performance Metrics**

- Top performing content identification
- Content type analysis
- Engagement rate calculations
- Viral content detection

### **✅ Business Intelligence**

- User retention analysis
- Conversion funnel tracking
- Revenue metrics (when integrated)
- Growth rate calculations

## 📡 **API Endpoints**

### **1. Analytics Dashboard**

```http
GET /api/analytics/dashboard
```

**Purpose**: Get comprehensive analytics dashboard data
**Access**: Protected (Admin or User)
**Query Parameters**:

- `startDate` (optional): Start date for analytics range
- `endDate` (optional): End date for analytics range
- `timeRange` (optional): Number of days (e.g., 7, 30, 90)

**Response**:

```json
{
  "success": true,
  "message": "Analytics dashboard data retrieved successfully",
  "data": {
    "isAdmin": true,
    "timeRange": {
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-31T23:59:59.999Z"
    },
    "userEngagement": {
      "totalViews": 1250,
      "totalLikes": 340,
      "totalShares": 89,
      "totalDownloads": 156,
      "totalBookmarks": 78,
      "totalComments": 45,
      "averageSessionDuration": 1800000,
      "mostActiveDay": "Sunday",
      "mostActiveHour": 20,
      "engagementScore": 85
    },
    "contentPerformance": {
      "totalContent": 150,
      "contentByType": {
        "videos": 45,
        "audio": 60,
        "books": 30,
        "music": 15
      },
      "topPerformingContent": [...],
      "contentTrends": [...]
    },
    "summary": {
      "totalUsers": 1250,
      "totalContent": 150,
      "totalInteractions": 1858,
      "engagementRate": 85
    }
  }
}
```

### **2. User Engagement Metrics**

```http
GET /api/analytics/user-engagement
```

**Purpose**: Get detailed user engagement metrics
**Access**: Protected
**Query Parameters**:

- `startDate` (optional): Start date for metrics
- `endDate` (optional): End date for metrics

**Response**:

```json
{
  "success": true,
  "message": "User engagement metrics retrieved successfully",
  "data": {
    "totalViews": 1250,
    "totalLikes": 340,
    "totalShares": 89,
    "totalDownloads": 156,
    "totalBookmarks": 78,
    "totalComments": 45,
    "averageSessionDuration": 1800000,
    "mostActiveDay": "Sunday",
    "mostActiveHour": 20,
    "engagementScore": 85
  }
}
```

### **3. Content Performance Metrics**

```http
GET /api/analytics/content-performance
```

**Purpose**: Get content performance analytics
**Access**: Protected
**Query Parameters**:

- `startDate` (optional): Start date for metrics
- `endDate` (optional): End date for metrics
- `userId` (optional): Specific user's content (Admin only)

**Response**:

```json
{
  "success": true,
  "message": "Content performance metrics retrieved successfully",
  "data": {
    "totalContent": 150,
    "contentByType": {
      "videos": 45,
      "audio": 60,
      "books": 30,
      "music": 15
    },
    "topPerformingContent": [
      {
        "id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "title": "Walking in Victory - Pastor Kumuyi",
        "contentType": "videos",
        "views": 1250,
        "likes": 340,
        "shares": 89,
        "engagementRate": 0.34
      }
    ],
    "contentTrends": [
      {
        "date": "2024-01-01",
        "uploads": 5,
        "views": 120,
        "likes": 25
      }
    ]
  }
}
```

### **4. User Activity Analytics (Admin Only)**

```http
GET /api/analytics/user-activity
```

**Purpose**: Get comprehensive user activity analytics
**Access**: Protected (Admin only)
**Query Parameters**:

- `startDate` (optional): Start date for analytics
- `endDate` (optional): End date for analytics

**Response**:

```json
{
  "success": true,
  "message": "User activity analytics retrieved successfully",
  "data": {
    "totalUsers": 1250,
    "activeUsers": 890,
    "newUsers": 45,
    "returningUsers": 845,
    "userRetentionRate": 71.2,
    "averageSessionDuration": 1800000,
    "userEngagementDistribution": {
      "high": 234,
      "medium": 456,
      "low": 200
    },
    "userActivityTimeline": [
      {
        "date": "2024-01-01",
        "activeUsers": 45,
        "newUsers": 5,
        "sessions": 67
      }
    ]
  }
}
```

### **5. Advanced Analytics (Admin Only)**

```http
GET /api/analytics/advanced
```

**Purpose**: Get advanced business intelligence analytics
**Access**: Protected (Admin only)
**Query Parameters**:

- `startDate` (optional): Start date for analytics
- `endDate` (optional): End date for analytics

**Response**:

```json
{
  "success": true,
  "message": "Advanced analytics retrieved successfully",
  "data": {
    "realTimeMetrics": {
      "currentActiveUsers": 45,
      "currentSessions": 67,
      "currentUploads": 3,
      "currentInteractions": 156
    },
    "userBehavior": {
      "averageTimeOnApp": 1800000,
      "mostPopularContentTypes": [
        {
          "type": "audio",
          "count": 60,
          "percentage": 40
        }
      ],
      "userJourneyFunnel": {
        "registered": 1250,
        "firstContent": 890,
        "firstInteraction": 756,
        "firstShare": 234,
        "firstDownload": 156
      },
      "deviceUsage": {
        "mobile": 70,
        "desktop": 25,
        "tablet": 5
      }
    },
    "contentInsights": {
      "viralContent": [
        {
          "id": "64f8a1b2c3d4e5f6a7b8c9d0",
          "title": "Walking in Victory - Pastor Kumuyi",
          "contentType": "videos",
          "viralScore": 85,
          "shares": 89,
          "views": 1250
        }
      ],
      "trendingTopics": [
        {
          "topic": "gospel",
          "count": 150,
          "growth": 25
        }
      ],
      "contentQualityScore": 85,
      "averageContentEngagement": 75
    },
    "businessMetrics": {
      "revenue": 0,
      "conversionRate": 15,
      "userLifetimeValue": 25,
      "churnRate": 5,
      "growthRate": 20
    }
  }
}
```

### **6. Real-Time Analytics**

```http
GET /api/analytics/real-time
```

**Purpose**: Get real-time analytics metrics
**Access**: Protected

**Response**:

```json
{
  "success": true,
  "message": "Real-time analytics retrieved successfully",
  "data": {
    "currentActiveUsers": 45,
    "currentSessions": 67,
    "currentUploads": 3,
    "currentInteractions": 156
  }
}
```

### **7. Export Analytics Data (Admin Only)**

```http
GET /api/analytics/export
```

**Purpose**: Export analytics data in various formats
**Access**: Protected (Admin only)
**Query Parameters**:

- `format` (optional): Export format (json, csv) - default: json
- `startDate` (optional): Start date for export
- `endDate` (optional): End date for export

**Response**:

```json
{
  "success": true,
  "message": "Analytics data exported successfully",
  "data": {
    /* analytics data */
  },
  "exportInfo": {
    "format": "json",
    "timestamp": "2024-01-15T10:00:00.000Z",
    "timeRange": {
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-31T23:59:59.999Z"
    }
  }
}
```

## 🔧 **Frontend Integration**

### **React Native Implementation**

```typescript
// Analytics API service
class AnalyticsAPI {
  private baseURL = 'https://your-api.com/api/analytics';

  async getDashboard(timeRange?: number) {
    const params = timeRange ? `?timeRange=${timeRange}` : '';
    const response = await fetch(`${this.baseURL}/dashboard${params}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  }

  async getUserEngagement(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(`${this.baseURL}/user-engagement?${params}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  }

  async getRealTimeMetrics() {
    const response = await fetch(`${this.baseURL}/real-time`, {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  }
}

// Usage in React component
const AnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [realTime, setRealTime] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [dashboardData, realTimeData] = await Promise.all([
          analyticsAPI.getDashboard(30), // Last 30 days
          analyticsAPI.getRealTimeMetrics(),
        ]);

        setAnalytics(dashboardData.data);
        setRealTime(realTimeData.data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      }
    };

    fetchAnalytics();

    // Update real-time metrics every 30 seconds
    const interval = setInterval(() => {
      analyticsAPI.getRealTimeMetrics().then(data => {
        setRealTime(data.data);
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View>
      <Text>Analytics Dashboard</Text>
      {analytics && (
        <View>
          <Text>Total Users: {analytics.summary.totalUsers}</Text>
          <Text>Total Content: {analytics.summary.totalContent}</Text>
          <Text>Engagement Rate: {analytics.summary.engagementRate}%</Text>
        </View>
      )}
      {realTime && (
        <View>
          <Text>Active Users: {realTime.currentActiveUsers}</Text>
          <Text>Current Sessions: {realTime.currentSessions}</Text>
        </View>
      )}
    </View>
  );
};
```

## 📊 **Analytics Metrics Explained**

### **Engagement Score Calculation**

The engagement score is calculated based on:

- Total interactions per unique content piece
- User activity frequency
- Session duration
- Content consumption patterns

**Formula**: `(Total Interactions / Unique Content) * 10` (capped at 100)

### **Content Performance Metrics**

- **Views**: Number of times content was viewed
- **Likes**: Number of likes received
- **Shares**: Number of times content was shared
- **Engagement Rate**: `(Likes + Shares) / Views`

### **User Activity Tracking**

- **Active Users**: Users who logged in within the time range
- **New Users**: Users who registered within the time range
- **Returning Users**: Active users who are not new users
- **Retention Rate**: `(Active Users / Total Users) * 100`

## 🎯 **Use Cases**

### **For Content Creators**

- Track content performance
- Identify top-performing content
- Monitor engagement trends
- Optimize content strategy

### **For Admins**

- Monitor platform health
- Track user growth
- Analyze user behavior
- Make data-driven decisions

### **For Users**

- View personal engagement metrics
- Track content consumption
- Monitor activity patterns
- Set personal goals

## 🔒 **Security & Rate Limiting**

- **Authentication**: All endpoints require valid JWT token
- **Authorization**: Admin-only endpoints check user role
- **Rate Limiting**: 20 requests per minute for analytics endpoints
- **Export Limiting**: 5 exports per 5 minutes for admin exports

## 🚀 **Performance Optimization**

- **Caching**: Analytics data is cached for 5 minutes
- **Aggregation**: Uses MongoDB aggregation pipelines for efficient queries
- **Pagination**: Large datasets are paginated
- **Real-time**: Real-time metrics are optimized for frequent updates

## 📈 **Future Enhancements**

- **Machine Learning**: Predictive analytics for user behavior
- **A/B Testing**: Built-in A/B testing framework
- **Custom Dashboards**: User-customizable dashboard layouts
- **Advanced Filtering**: More granular filtering options
- **Data Visualization**: Built-in chart and graph generation

Your analytics system is now **production-ready** and provides comprehensive insights into your app's performance and user behavior! 🎉
