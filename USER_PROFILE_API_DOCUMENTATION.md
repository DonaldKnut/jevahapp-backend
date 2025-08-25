# User Profile API Documentation

## Overview

This document provides comprehensive documentation for the User Profile API endpoints in the Jevah App backend. These endpoints allow authenticated users to retrieve their profile information including full name, section (kids/adults), avatar, and other profile details.

## Base URL

```
Production: https://jevahapp-backend.onrender.com
Development: http://localhost:3000
```

## Endpoint Details

### 1. Get Current User Profile (Complete)

**Endpoint:** `GET /api/users/me`

**Description:** Retrieves the complete profile information of the currently authenticated user.

**Authentication:** Required (Bearer Token)

**Content-Type:** `application/json`

---

## Request Format

### Headers

```http
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "avatar": "https://your-cloudflare-r2-domain.com/user-avatars/1234567890-abc123def.jpg",
    "avatarUpload": "https://your-cloudflare-r2-domain.com/user-avatars/1234567890-abc123def.jpg",
    "section": "adults",
    "role": "learner",
    "isProfileComplete": true,
    "isEmailVerified": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Error Responses

#### 401 Unauthorized - Missing Token

```json
{
  "success": false,
  "message": "Unauthorized: User ID missing"
}
```

#### 401 Unauthorized - Invalid Token

```json
{
  "success": false,
  "message": "Invalid token"
}
```

#### 404 Not Found - User Not Found

```json
{
  "success": false,
  "message": "User not found"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Alternative Endpoints

### 2. Get Current User Profile (Simplified)

**Endpoint:** `GET /api/auth/me`

**Description:** Retrieves basic profile information of the currently authenticated user.

**Response:**

```json
{
  "success": true,
  "data": {
    "firstName": "John",
    "lastName": "Doe",
    "avatar": "https://your-cloudflare-r2-domain.com/user-avatars/1234567890-abc123def.jpg",
    "section": "adults"
  }
}
```

### 3. Get User Profile by ID

**Endpoint:** `GET /api/user-profile/:userId`

**Description:** Retrieves profile information of a specific user by their ID.

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "avatar": "https://your-cloudflare-r2-domain.com/user-avatars/1234567890-abc123def.jpg",
    "firstName": "John",
    "lastName": "Doe",
    "fullName": "John Doe",
    "section": "adults",
    "email": "john.doe@example.com",
    "username": "johndoe"
  }
}
```

### 4. Get Profile Picture Only

**Endpoint:** `GET /api/auth/profile-picture`

**Description:** Retrieves only the profile picture URL of the current user.

**Response:**

```json
{
  "success": true,
  "data": {
    "profilePicture": "https://your-cloudflare-r2-domain.com/user-avatars/1234567890-abc123def.jpg",
    "hasProfilePicture": true
  }
}
```

---

## Implementation Examples

### React Native with Expo

```javascript
import AsyncStorage from "@react-native-async-storage/async-storage";

const getUserProfile = async () => {
  try {
    // Get token from storage
    const token = await AsyncStorage.getItem("userToken");

    if (!token) {
      throw new Error("No authentication token found");
    }

    const response = await fetch(
      "https://jevahapp-backend.onrender.com/api/users/me",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (data.success) {
      console.log("User profile:", data.data);
      return data.data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    throw error;
  }
};

// Usage
const loadUserProfile = async () => {
  try {
    const userProfile = await getUserProfile();

    // Extract the data you need
    const { firstName, lastName, avatar, section } = userProfile;

    // Update your app state
    setUserProfile(userProfile);
    setFullName(`${firstName} ${lastName}`);
    setAvatarUrl(avatar);
    setUserSection(section);
  } catch (error) {
    // Handle error (show alert, redirect to login, etc.)
    console.error("Error loading profile:", error);
  }
};
```

### React Native with Axios

```javascript
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Create axios instance with base URL
const api = axios.create({
  baseURL: "https://jevahapp-backend.onrender.com",
  timeout: 10000,
});

// Add request interceptor to include token
api.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem("userToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      console.log("Token expired, redirecting to login");
    }
    return Promise.reject(error);
  }
);

const getUserProfile = async () => {
  try {
    const response = await api.get("/api/users/me");
    return response.data.data;
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    throw error;
  }
};

// Usage with React hooks
const useUserProfile = () => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const profile = await getUserProfile();
      setUserProfile(profile);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return { userProfile, loading, error, refetch: fetchProfile };
};
```

### React Native with React Query

```javascript
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

const fetchUserProfile = async () => {
  const token = await AsyncStorage.getItem("userToken");

  const response = await fetch(
    "https://jevahapp-backend.onrender.com/api/users/me",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch user profile");
  }

  const data = await response.json();
  return data.data;
};

// Usage in component
const UserProfileScreen = () => {
  const {
    data: userProfile,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["userProfile"],
    queryFn: fetchUserProfile,
    retry: 3,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error.message} onRetry={refetch} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>
        {userProfile.firstName} {userProfile.lastName}
      </Text>
      <Text style={styles.section}>Section: {userProfile.section}</Text>
      {userProfile.avatar && (
        <Image source={{ uri: userProfile.avatar }} style={styles.avatar} />
      )}
    </View>
  );
};
```

---

## Data Structure

### User Profile Object

| Field               | Type           | Description                  | Example                      |
| ------------------- | -------------- | ---------------------------- | ---------------------------- |
| `id`                | string         | User's unique identifier     | `"507f1f77bcf86cd799439011"` |
| `firstName`         | string         | User's first name            | `"John"`                     |
| `lastName`          | string         | User's last name             | `"Doe"`                      |
| `email`             | string         | User's email address         | `"john.doe@example.com"`     |
| `avatar`            | string \| null | User's avatar URL            | `"https://..."`              |
| `avatarUpload`      | string \| null | Alternative avatar URL       | `"https://..."`              |
| `section`           | string         | User's section (kids/adults) | `"adults"`                   |
| `role`              | string         | User's role in the platform  | `"learner"`                  |
| `isProfileComplete` | boolean        | Whether profile is complete  | `true`                       |
| `isEmailVerified`   | boolean        | Whether email is verified    | `true`                       |
| `createdAt`         | string         | Account creation date        | `"2024-01-01T00:00:00.000Z"` |
| `updatedAt`         | string         | Last update date             | `"2024-01-01T00:00:00.000Z"` |

### Section Values

- `"kids"` - User is in the kids section
- `"adults"` - User is in the adults section

### Role Values

- `"learner"` - Regular user
- `"parent"` - Parent account
- `"educator"` - Educator account
- `"moderator"` - Moderator account
- `"admin"` - Administrator account
- `"content_creator"` - Content creator
- `"vendor"` - Vendor account
- `"church_admin"` - Church administrator
- `"artist"` - Artist account

---

## Error Handling Best Practices

### Frontend Implementation

```javascript
const handleProfileError = error => {
  if (error.response?.status === 401) {
    // Token expired or invalid
    AsyncStorage.removeItem("userToken");
    // Navigate to login screen
    navigation.navigate("Login");
  } else if (error.response?.status === 404) {
    // User not found (shouldn't happen for current user)
    console.error("User profile not found");
  } else if (error.response?.status >= 500) {
    // Server error
    Alert.alert("Server Error", "Please try again later");
  } else {
    // Network or other error
    Alert.alert(
      "Error",
      "Failed to load profile. Please check your connection."
    );
  }
};

const loadUserProfile = async () => {
  try {
    setLoading(true);
    const profile = await getUserProfile();
    setUserProfile(profile);
  } catch (error) {
    handleProfileError(error);
  } finally {
    setLoading(false);
  }
};
```

---

## Authentication Flow

### Token Management

```javascript
// Store token after login
const storeToken = async token => {
  try {
    await AsyncStorage.setItem("userToken", token);
  } catch (error) {
    console.error("Failed to store token:", error);
  }
};

// Get token for API calls
const getToken = async () => {
  try {
    return await AsyncStorage.getItem("userToken");
  } catch (error) {
    console.error("Failed to get token:", error);
    return null;
  }
};

// Remove token on logout
const removeToken = async () => {
  try {
    await AsyncStorage.removeItem("userToken");
  } catch (error) {
    console.error("Failed to remove token:", error);
  }
};
```

---

## Testing

### cURL Examples

```bash
# Get current user profile
curl -X GET \
  https://jevahapp-backend.onrender.com/api/users/me \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json'

# Get simplified profile
curl -X GET \
  https://jevahapp-backend.onrender.com/api/auth/me \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json'

# Get profile picture only
curl -X GET \
  https://jevahapp-backend.onrender.com/api/auth/profile-picture \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json'
```

---

## Integration Notes

### State Management

Consider using a global state management solution (Redux, Zustand, Context API) to store user profile data:

```javascript
// Example with Context API
const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  const updateProfile = newProfile => {
    setUserProfile(newProfile);
  };

  const clearProfile = () => {
    setUserProfile(null);
  };

  return (
    <UserContext.Provider
      value={{ userProfile, loading, updateProfile, clearProfile }}
    >
      {children}
    </UserContext.Provider>
  );
};
```

### Caching Strategy

Implement local caching for better performance:

```javascript
const CACHE_KEY = "userProfile";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCachedProfile = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch (error) {
    console.error("Failed to get cached profile:", error);
  }
  return null;
};

const cacheProfile = async profile => {
  try {
    const cacheData = {
      data: profile,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error("Failed to cache profile:", error);
  }
};
```

---

## Support

For technical support or questions about this API:

- **Backend Team:** [Contact Information]
- **Documentation:** [Link to full API docs]
- **GitHub Issues:** [Repository link]

---

_Last Updated: [Current Date]_
_Version: 1.0_
