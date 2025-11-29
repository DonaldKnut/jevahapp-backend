# Remember Me / Persistent Login - Frontend Integration Guide

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** Production Ready

---

## 📋 Overview

This guide explains how to implement the "Remember Me" functionality in your frontend. When users check "Remember Me" during login, they will stay logged in for 90 days (like TikTok, Instagram, etc.) without needing to login again. The system uses secure httpOnly cookies for refresh tokens and short-lived access tokens for API calls.

## 🎯 How It Works

### Authentication Flow

1. **User Logs In with Remember Me**
   - Frontend sends `rememberMe: true` in login request
   - Backend generates:
     - **Access Token** (15 minutes) - Sent in response body
     - **Refresh Token** (90 days) - Stored in secure httpOnly cookie
   - Frontend stores access token in memory/localStorage

2. **Automatic Token Refresh**
   - When access token expires, backend automatically uses refresh token from cookie
   - New access token is returned in `X-New-Access-Token` header
   - Frontend should update stored access token

3. **Persistent Session**
   - User stays logged in for 90 days (if Remember Me was checked)
   - No need to login again unless:
     - User explicitly logs out
     - Refresh token expires (90 days)
     - User is banned
     - Refresh token is revoked

---

## 📡 API Endpoints

### 1. Login with Remember Me

```
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "rememberMe": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // Access token (15 min)
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // Same as token
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "avatar": "https://...",
    "role": "user",
    "isProfileComplete": true
  },
  "rememberMe": true
}
```

**Important:**
- If `rememberMe: true`, backend sets `refreshToken` cookie automatically
- Cookie is httpOnly (JavaScript cannot access it - XSS protection)
- Cookie is secure (HTTPS only in production)
- Cookie expires in 90 days

---

### 2. Refresh Token (Automatic)

The backend automatically refreshes tokens when:
- Access token expires
- Request is made without Authorization header but has refresh token cookie

**Response Header:**
```
X-New-Access-Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Manual Refresh Endpoint:**
```
POST /api/auth/refresh
```

**Request Body (optional - cookie is preferred):**
```json
{
  "refreshToken": "abc123..." // Optional if cookie is present
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user123",
      "email": "user@example.com",
      // ... user data
    }
  }
}
```

---

### 3. Logout

```
POST /api/auth/logout
```

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Important:**
- Backend automatically clears refresh token cookie
- All tokens are revoked
- User must login again

---

## 🎨 Frontend Implementation

### React/React Native Example

#### 1. Login Component with Remember Me

```tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Switch, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // IMPORTANT: Include cookies
        body: JSON.stringify({
          email,
          password,
          rememberMe,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Store access token
        await AsyncStorage.setItem('accessToken', data.accessToken);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        await AsyncStorage.setItem('rememberMe', rememberMe.toString());

        // Navigate to home
        navigation.replace('Home');
      } else {
        Alert.alert('Login Failed', data.message);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <View style={styles.rememberMeContainer}>
        <Switch
          value={rememberMe}
          onValueChange={setRememberMe}
        />
        <Text>Remember Me</Text>
      </View>

      <Button
        title={loading ? 'Logging in...' : 'Login'}
        onPress={handleLogin}
        disabled={loading}
      />
    </View>
  );
};
```

#### 2. API Client with Auto-Refresh

```typescript
// apiClient.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://api.jevahapp.com';

class ApiClient {
  private async getAccessToken(): Promise<string | null> {
    return await AsyncStorage.getItem('accessToken');
  }

  private async setAccessToken(token: string): Promise<void> {
    await AsyncStorage.setItem('accessToken', token);
  }

  async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getAccessToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // IMPORTANT: Include cookies
    });

    // If 401 and we have a refresh token cookie, try to refresh
    if (response.status === 401) {
      const newToken = response.headers.get('X-New-Access-Token');
      
      if (newToken) {
        // Backend auto-refreshed, update stored token
        await this.setAccessToken(newToken);
        
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
          credentials: 'include',
        });
      } else {
        // No refresh token or refresh failed - user needs to login
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('user');
        // Navigate to login screen
        throw new Error('Session expired. Please login again.');
      }
    }

    return response;
  }

  async get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint: string, body?: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async put(endpoint: string, body?: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export default new ApiClient();
```

#### 3. Check Authentication on App Start

```tsx
// App.tsx or useAuth hook
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      const storedToken = await AsyncStorage.getItem('accessToken');
      const rememberMe = await AsyncStorage.getItem('rememberMe');

      if (storedUser && storedToken) {
        // Try to make an authenticated request to verify token
        try {
          const response = await apiClient.get('/api/users/me');
          
          if (response.ok) {
            const data = await response.json();
            setUser(data.user || JSON.parse(storedUser));
            setIsAuthenticated(true);
          } else {
            // Token invalid, clear storage
            await clearAuth();
          }
        } catch (error) {
          // If error is "Session expired", backend will auto-refresh via cookie
          // If refresh fails, clearAuth will be called
          const response = await apiClient.get('/api/users/me');
          if (response.ok) {
            const data = await response.json();
            setUser(data.user || JSON.parse(storedUser));
            setIsAuthenticated(true);
          } else {
            await clearAuth();
          }
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const clearAuth = async () => {
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('rememberMe');
    setUser(null);
    setIsAuthenticated(false);
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await clearAuth();
    }
  };

  return {
    user,
    isAuthenticated,
    loading,
    logout,
    checkAuth,
  };
};
```

#### 4. Logout Component

```tsx
const LogoutButton = () => {
  const { logout } = useAuth();
  const navigation = useNavigation();

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  return <Button title="Logout" onPress={handleLogout} />;
};
```

---

## 🔒 Security Features

### Cookie Security

- **httpOnly**: JavaScript cannot access the cookie (XSS protection)
- **secure**: Only sent over HTTPS in production
- **sameSite**: CSRF protection (strict in production, lax in development)
- **Path**: Available for all routes (`/`)
- **MaxAge**: 90 days (7,776,000 seconds)

### Token Strategy

- **Access Token**: Short-lived (15 minutes) - reduces risk if compromised
- **Refresh Token**: Long-lived (90 days) - stored securely in httpOnly cookie
- **Automatic Refresh**: Backend handles refresh automatically
- **Token Revocation**: Logout revokes all tokens

---

## ⚠️ Important Notes

### 1. Credentials: Include

**CRITICAL**: Always include `credentials: 'include'` in fetch requests to send cookies:

```typescript
fetch(url, {
  method: 'POST',
  credentials: 'include', // REQUIRED for cookies
  headers: { ... },
  body: JSON.stringify(data),
});
```

### 2. Cookie Domain

- Cookies are set for the API domain
- In development: `localhost` or your dev server
- In production: Your API domain (e.g., `api.jevahapp.com`)

### 3. CORS Configuration

Backend is already configured with:
```typescript
credentials: true, // Allows cookies in CORS requests
```

Frontend must send credentials in requests.

### 4. Token Storage

- **Access Token**: Store in AsyncStorage (React Native) or localStorage (Web)
- **Refresh Token**: NEVER store manually - it's in httpOnly cookie
- **User Data**: Store in AsyncStorage/localStorage

### 5. Error Handling

When you get a 401:
1. Check for `X-New-Access-Token` header (auto-refresh happened)
2. Update stored access token
3. Retry the request
4. If no header, redirect to login

---

## 🧪 Testing

### Test Remember Me Flow

1. **Login with Remember Me checked**
   - Verify access token is received
   - Verify refresh token cookie is set (check browser DevTools)
   - Verify user stays logged in after app restart

2. **Login without Remember Me**
   - Verify access token is received
   - Verify NO refresh token cookie is set
   - Verify user must login again after token expires

3. **Auto-Refresh**
   - Wait for access token to expire (15 minutes)
   - Make an API request
   - Verify `X-New-Access-Token` header is present
   - Verify request succeeds

4. **Logout**
   - Call logout endpoint
   - Verify refresh token cookie is cleared
   - Verify user cannot make authenticated requests

---

## 📱 React Native Specific

### For React Native (Expo/RN)

React Native doesn't automatically handle cookies like browsers. You may need:

1. **Cookie Manager** (if using fetch):
   ```bash
   npm install @react-native-cookies/cookies
   ```

2. **Or use axios with cookie support**:
   ```bash
   npm install axios
   ```

3. **Example with axios**:
   ```typescript
   import axios from 'axios';
   import CookieManager from '@react-native-cookies/cookies';

   // Configure axios to handle cookies
   axios.defaults.withCredentials = true;

   // Or manually set cookies
   await CookieManager.set('http://api.jevahapp.com', {
     name: 'refreshToken',
     value: refreshToken,
     // ... other cookie options
   });
   ```

---

## 🌐 Web (React) Specific

### For Web Applications

Web browsers automatically handle cookies, but ensure:

1. **CORS Configuration**: Backend allows credentials
2. **Same-Origin or CORS**: API domain must allow your frontend domain
3. **HTTPS in Production**: Cookies with `secure` flag require HTTPS

### Example with Fetch

```typescript
const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // REQUIRED
  body: JSON.stringify({ email, password, rememberMe: true }),
});
```

---

## 🔄 Token Refresh Flow Diagram

```
User Login (rememberMe: true)
    ↓
Backend generates:
  - Access Token (15 min) → Response body
  - Refresh Token (90 days) → httpOnly Cookie
    ↓
User makes API request
    ↓
Access Token valid?
    ├─ Yes → Request succeeds
    └─ No → Backend checks refresh token cookie
            ├─ Valid → Auto-refresh
            │   ├─ Generate new access token
            │   ├─ Return in X-New-Access-Token header
            │   └─ Request succeeds
            └─ Invalid/Expired → 401, redirect to login
```

---

## 💡 Best Practices

1. **Always use `credentials: 'include'`** in fetch requests
2. **Check for `X-New-Access-Token` header** on 401 responses
3. **Update stored access token** when you see the header
4. **Handle token expiration gracefully** - don't show errors, auto-refresh
5. **Clear tokens on logout** - both AsyncStorage and cookies
6. **Check authentication on app start** - verify user is still logged in
7. **Show loading state** during auth checks

---

## 🐛 Troubleshooting

### Issue: Cookies not being sent

**Solution:**
- Ensure `credentials: 'include'` is set
- Check CORS configuration allows credentials
- Verify cookie domain matches API domain

### Issue: Token refresh not working

**Solution:**
- Check if refresh token cookie exists (browser DevTools)
- Verify cookie hasn't expired (90 days)
- Check backend logs for refresh token errors

### Issue: User logged out unexpectedly

**Possible Causes:**
- Refresh token expired (90 days passed)
- User was banned
- Refresh token was revoked
- Cookie was cleared manually

---

## 📝 Summary

- ✅ **Remember Me** = 90 days persistent login
- ✅ **Access Token** = 15 minutes (stored in AsyncStorage)
- ✅ **Refresh Token** = 90 days (stored in httpOnly cookie)
- ✅ **Auto-Refresh** = Backend handles automatically
- ✅ **Secure** = httpOnly, secure, sameSite cookies
- ✅ **TikTok-like** = Login once, stay logged in

**Questions?** Contact the backend team or refer to the API documentation.

