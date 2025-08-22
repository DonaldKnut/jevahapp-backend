# Jevah API Documentation v2.0.0

**Base URL**: https://jevahapp-backend.onrender.com

**API Documentation**: https://jevahapp-backend.onrender.com/api-docs

**Environment**: Production (Render)

## Quick Start

### Authentication

All protected endpoints require a JWT token:

```javascript
const headers = {
  Authorization: "Bearer YOUR_JWT_TOKEN",
  "Content-Type": "application/json",
};
```

### Base Configuration

```http
GET /
```

Returns API information and available endpoints.

## Core Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/complete-profile` - Complete user profile
- `POST /api/auth/logout` - Logout user

### Media Management

- `GET /api/media` - Get all media with filters
- `POST /api/media/upload` - Upload new media
- `GET /api/media/{id}` - Get specific media
- `POST /api/media/{id}/bookmark` - Bookmark media
- `POST /api/media/{id}/interact` - Record interaction
- `GET /api/media/live` - Get live streams

### AI Chatbot

- `GET /api/ai-chatbot/info` - Get chatbot info
- `POST /api/ai-chatbot/message` - Send message
- `GET /api/ai-chatbot/history` - Get chat history
- `DELETE /api/ai-chatbot/history` - Clear history

### Bookmarks

- `GET /api/bookmarks/get-bookmarked-media` - Get user's bookmarks
- `POST /api/bookmarks/{mediaId}` - Add bookmark
- `DELETE /api/bookmarks/{mediaId}` - Remove bookmark

### Trending Analytics

- `GET /api/trending/trending` - Get trending users
- `GET /api/trending/analytics` - Get analytics

### Health & Status

- `GET /health` - Health check
- `GET /api/test` - Test endpoint

## JavaScript Integration

```javascript
const API_BASE_URL = "https://jevahapp-backend.onrender.com";

class JevahAPI {
  constructor(token = null) {
    this.baseURL = API_BASE_URL;
    this.token = token;
  }

  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "API request failed");
      }

      return data;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  // Authentication
  async login(email, password) {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData) {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  // Media
  async getMedia(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/api/media?${queryString}`);
  }

  async bookmarkMedia(mediaId) {
    return this.request(`/api/bookmarks/${mediaId}`, {
      method: "POST",
    });
  }

  // AI Chatbot
  async sendMessage(message) {
    return this.request("/api/ai-chatbot/message", {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  }

  async getChatHistory() {
    return this.request("/api/ai-chatbot/history");
  }
}

// Usage
const api = new JevahAPI("your_jwt_token");

// Login
const loginResponse = await api.login("user@example.com", "password");
const token = loginResponse.token;

// Update API instance with token
const authenticatedAPI = new JevahAPI(token);

// Get media
const media = await authenticatedAPI.getMedia({ contentType: "music" });

// Send AI message
const aiResponse = await authenticatedAPI.sendMessage("I need prayer guidance");
```

## React Hook Example

```javascript
import { useState, useEffect } from "react";

const useJevahAPI = token => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiRequest = async (endpoint, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://jevahapp-backend.onrender.com${endpoint}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          ...options,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Request failed");
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { apiRequest, loading, error };
};

// Usage in component
const MediaLibrary = ({ token }) => {
  const { apiRequest, loading, error } = useJevahAPI(token);
  const [media, setMedia] = useState([]);

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const data = await apiRequest("/api/media");
        setMedia(data.media);
      } catch (err) {
        console.error("Failed to fetch media:", err);
      }
    };

    fetchMedia();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {media.map(item => (
        <div key={item.id}>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </div>
      ))}
    </div>
  );
};
```

## File Upload Example

```javascript
const uploadMedia = async (file, mediaData) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("thumbnail", thumbnailFile);
  formData.append("title", mediaData.title);
  formData.append("description", mediaData.description);
  formData.append("contentType", mediaData.contentType);
  formData.append("category", mediaData.category);

  const response = await fetch(
    "https://jevahapp-backend.onrender.com/api/media/upload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  return response.json();
};
```

## Error Handling

Standard error response format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message (development only)"
}
```

Common HTTP status codes:

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `429`: Rate Limited
- `500`: Internal Server Error

## Rate Limiting

- Authentication: 5 requests per 15 minutes
- Media Uploads: 10 requests per hour
- Media Interactions: 100 requests per 15 minutes
- AI Chatbot: 20 messages per minute
- General API: 100 requests per 15 minutes

## Testing

1. Visit: https://jevahapp-backend.onrender.com/api-docs
2. Use interactive Swagger documentation
3. Test endpoints directly from browser

## Support

- Email: support@jevahapp.com
- Documentation: https://jevahapp-backend.onrender.com/api-docs
- GitHub: https://github.com/DonaldKnut/jevahapp-backend

**Last Updated**: August 14, 2025  
**Version**: 2.0.0  
**Environment**: Production (Render)
