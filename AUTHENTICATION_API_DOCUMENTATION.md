# 🔐 Jevah Authentication API Documentation

## 📋 Overview

This document provides complete API endpoints and usage examples for the Jevah authentication system. All endpoints are designed to work seamlessly with React Native applications.

**Base URL**: `https://jevahapp-backend.onrender.com/api/auth`

---

## 🚀 Quick Start

### 1. User Registration

```javascript
// Register a new user
const registerUser = async userData => {
  try {
    const response = await fetch(
      "https://jevahapp-backend.onrender.com/api/auth/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "user@example.com",
          password: "SecurePassword123!",
          firstName: "John",
          lastName: "Doe",
          desiredRole: "learner", // Optional: learner, parent, educator, content_creator, vendor, church_admin
        }),
      }
    );

    const data = await response.json();

    if (data.success) {
      console.log("Registration successful! Check email for verification.");
      return data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("Registration failed:", error.message);
    throw error;
  }
};
```

### 2. Email Verification

```javascript
// Verify email with code
const verifyEmail = async (email, code) => {
  try {
    const response = await fetch(
      "https://jevahapp-backend.onrender.com/api/auth/verify-email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          code: code, // 6-character verification code from email
        }),
      }
    );

    const data = await response.json();

    if (data.success) {
      console.log("Email verified successfully!");
      return data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("Email verification failed:", error.message);
    throw error;
  }
};
```

### 3. User Login

```javascript
// Login user
const loginUser = async (email, password) => {
  try {
    const response = await fetch(
      "https://jevahapp-backend.onrender.com/api/auth/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      }
    );

    const data = await response.json();

    if (data.success) {
      // Store JWT token securely
      await SecureStore.setItemAsync("jwt_token", data.token);
      console.log("Login successful!");
      return data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error("Login failed:", error.message);
    throw error;
  }
};
```

---

## 📡 Complete API Endpoints

### 🔐 Authentication Endpoints

### **Multi-Step Registration Flow**

The authentication system follows a **3-step registration process**:

1. **Step 1**: Basic Registration (Required)
   - First name, last name, email, password
   - User gets `learner` role by default
   - Email verification code sent

2. **Step 2**: Email Verification (Required)
   - Verify email with 6-character code
   - Required before login

3. **Step 3**: Profile Completion (Optional)
   - Additional user details (age, location, interests, etc.)
   - Can be completed later after login

---

### 1. **User Registration (Step 1)**
**POST** `/api/auth/register`

Register a new user with basic information. This is the first step in the registration process.

#### Request Body:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "securepassword123"
}
```

#### Required Fields:
- `firstName` (string) - User's first name
- `lastName` (string) - User's last name
- `email` (string) - Valid email address
- `password` (string) - Minimum 6 characters

#### Response (Success - 201):
```json
{
  "success": true,
  "message": "User registered successfully. Please verify your email.",
  "user": {
    "id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "avatar": null,
    "role": "learner"
  }
}
```

#### React Native Implementation:
```javascript
const registerUser = async userData => {
  try {
    const response = await fetch(
      "https://your-api-domain.com/api/auth/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          password: userData.password,
        }),
      }
    );

    const data = await response.json();

    if (data.success) {
      // Registration successful, show email verification message
      console.log("Registration successful:", data.user);
      return { success: true, user: data.user };
    } else {
      // Handle registration error
      console.error("Registration failed:", data.message);
      return { success: false, error: data.message };
    }
  } catch (error) {
    console.error("Network error:", error);
    return { success: false, error: "Network error occurred" };
  }
};
```

---

#### 2. **POST** `/verify-email`

**Description**: Verify user's email address with verification code

**Request Body**:

```json
{
  "email": "user@example.com",
  "code": "ABC123"
}
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "message": "Email verified successfully",
  "user": {
    "id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "email": "user@example.com",
    "isEmailVerified": true
  }
}
```

**Response (Error - 400)**:

```json
{
  "success": false,
  "message": "Invalid verification code"
}
```

---

#### 3. **POST** `/login`

**Description**: Authenticate user with email and password

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "learner",
    "isEmailVerified": true,
    "avatar": "https://example.com/avatar.jpg"
  }
}
```

**Response (Error - 401)**:

```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

#### 4. **POST** `/resend-verification-email`

**Description**: Resend verification email to user

**Request Body**:

```json
{
  "email": "user@example.com"
}
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "message": "Verification email resent successfully"
}
```

---

#### 5. **POST** `/reset-password`

**Description**: Reset user password using reset token

**Request Body**:

```json
{
  "token": "reset_token_here",
  "newPassword": "NewSecurePassword123!"
}
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

### 🔒 Protected Endpoints (Require JWT Token)

#### 6. **GET** `/me`

**Description**: Get current user profile

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "user": {
    "id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "learner",
    "avatar": "https://example.com/avatar.jpg",
    "isEmailVerified": true,
    "isProfileComplete": false,
    "age": 25,
    "section": "adults"
  }
}
```

---

#### 7. **POST** `/avatar`

**Description**: Update user avatar

**Headers**:

```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body** (FormData):

```javascript
const formData = new FormData();
formData.append("avatar", {
  uri: imageUri,
  type: "image/jpeg",
  name: "avatar.jpg",
});
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "message": "Avatar updated successfully",
  "data": {
    "avatarUrl": "https://r2.cloudflare.com/jevah/user-avatars/1234567890.jpg",
    "userId": "64f8a1b2c3d4e5f6a7b8c9d0"
  }
}
```

---

#### 8. **POST** `/complete-profile` (Step 3)

**Description**: Complete user profile with additional information (Optional - can be done after login)

**Headers**:

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "age": 25,
  "isKid": false,
  "section": "adults",
  "role": "learner",
  "location": "Lagos, Nigeria",
  "interests": ["gospel", "music", "prayer"],
  "hasConsentedToPrivacyPolicy": true,
  "parentalControlEnabled": false
}
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "message": "Profile completed successfully",
  "user": {
    "id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "isProfileComplete": true,
    "age": 25,
    "role": "learner"
  }
}
```

---

#### 9. **POST** `/logout`

**Description**: Logout user (blacklist JWT token)

**Headers**:

```
Authorization: Bearer <jwt_token>
```

**Response (Success - 200)**:

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 🎨 Artist-Specific Endpoints

#### 10. **POST** `/artist/register`

**Description**: Register a new artist account with avatar

**Request Body** (FormData):

```javascript
const formData = new FormData();
formData.append("email", "artist@example.com");
formData.append("password", "SecurePassword123!");
formData.append("firstName", "John");
formData.append("lastName", "Doe");
formData.append("artistName", "Gospel Artist");
formData.append("genre", JSON.stringify(["gospel", "worship"]));
formData.append("bio", "Professional gospel artist");
formData.append("avatar", {
  uri: imageUri,
  type: "image/jpeg",
  name: "avatar.jpg",
});
```

**Response (Success - 201)**:

```json
{
  "success": true,
  "message": "Artist registered successfully. Please verify your email.",
  "user": {
    "id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "email": "artist@example.com",
    "firstName": "John",
    "artistName": "Gospel Artist",
    "role": "artist"
  }
}
```

---

## 🔧 React Native Implementation Examples

### Complete Authentication Flow

```javascript
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import * as SecureStore from "expo-secure-store";

const AuthScreen = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        "https://jevahapp-backend.onrender.com/api/auth/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            firstName: email.split("@")[0],
            desiredRole: "learner",
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          "Registration Successful!",
          "Please check your email for verification code.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert("Registration Failed", data.message);
      }
    } catch (error) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        "https://jevahapp-backend.onrender.com/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await response.json();

      if (data.success) {
        await SecureStore.setItemAsync("jwt_token", data.token);
        Alert.alert("Login Successful!", "Welcome to Jevah!");
        // Navigate to main app
      } else {
        Alert.alert("Login Failed", data.message);
      }
    } catch (error) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, padding: 10, marginBottom: 20 }}
      />
      <TouchableOpacity onPress={handleRegister} disabled={isLoading}>
        <Text>Register</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleLogin} disabled={isLoading}>
        <Text>Login</Text>
      </TouchableOpacity>
    </View>
  );
};

export default AuthScreen;
```

### Avatar Upload Example

```javascript
import * as ImagePicker from "expo-image-picker";

const uploadAvatar = async token => {
  try {
    // Pick image from gallery
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const formData = new FormData();
      formData.append("avatar", {
        uri: result.assets[0].uri,
        type: "image/jpeg",
        name: "avatar.jpg",
      });

      const response = await fetch(
        "https://jevahapp-backend.onrender.com/api/auth/avatar",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (data.success) {
        console.log("Avatar uploaded:", data.data.avatarUrl);
        return data.data.avatarUrl;
      } else {
        throw new Error(data.message);
      }
    }
  } catch (error) {
    console.error("Avatar upload failed:", error);
    throw error;
  }
};
```

---

## 🚨 Error Handling

### Common Error Responses

```javascript
// Network Error
{
  "success": false,
  "message": "Network error. Please check your connection."
}

// Validation Error
{
  "success": false,
  "message": "Email and password are required for registration"
}

// Authentication Error
{
  "success": false,
  "message": "Invalid email or password"
}

// Rate Limiting Error
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```

### Error Handling Best Practices

```javascript
const handleApiError = (error, response) => {
  if (!response.ok) {
    switch (response.status) {
      case 400:
        return "Invalid request. Please check your input.";
      case 401:
        return "Authentication failed. Please login again.";
      case 403:
        return "Access denied. You don't have permission.";
      case 404:
        return "Resource not found.";
      case 429:
        return "Too many requests. Please wait and try again.";
      case 500:
        return "Server error. Please try again later.";
      default:
        return "An unexpected error occurred.";
    }
  }
  return error.message || "Network error. Please check your connection.";
};
```

---

## 🔐 Security Best Practices

### 1. Token Storage

```javascript
// Store JWT token securely
import * as SecureStore from "expo-secure-store";

// Save token
await SecureStore.setItemAsync("jwt_token", token);

// Retrieve token
const token = await SecureStore.getItemAsync("jwt_token");

// Remove token on logout
await SecureStore.deleteItemAsync("jwt_token");
```

### 2. API Request Interceptor

```javascript
const apiRequest = async (url, options = {}) => {
  const token = await SecureStore.getItemAsync("jwt_token");

  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  if (response.status === 401) {
    // Token expired or invalid
    await SecureStore.deleteItemAsync("jwt_token");
    // Navigate to login screen
    return;
  }

  return response;
};
```

---

## 📧 Email Verification Flow

### 1. Registration Flow

```javascript
const registrationFlow = async userData => {
  try {
    // 1. Register user
    const registerResponse = await registerUser(userData);

    if (registerResponse.success) {
      // 2. Show verification screen
      setShowVerification(true);
      setUserEmail(userData.email);
    }
  } catch (error) {
    Alert.alert("Registration Failed", error.message);
  }
};
```

### 2. Verification Screen

```javascript
const VerificationScreen = () => {
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerification = async () => {
    setIsVerifying(true);
    try {
      const response = await verifyEmail(userEmail, code);

      if (response.success) {
        Alert.alert("Success", "Email verified! You can now login.");
        // Navigate to login screen
      }
    } catch (error) {
      Alert.alert("Verification Failed", error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    try {
      await resendVerificationEmail(userEmail);
      Alert.alert("Code Sent", "New verification code sent to your email.");
    } catch (error) {
      Alert.alert("Error", "Failed to resend code. Please try again.");
    }
  };

  return (
    <View>
      <Text>Enter verification code sent to {userEmail}</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Enter 6-digit code"
        keyboardType="numeric"
        maxLength={6}
      />
      <TouchableOpacity onPress={handleVerification}>
        <Text>Verify Email</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleResendCode}>
        <Text>Resend Code</Text>
      </TouchableOpacity>
    </View>
  );
};
```

---

## 🎯 Testing Checklist

### ✅ Pre-deployment Testing

- [ ] User registration with email verification
- [ ] Email verification with valid/invalid codes
- [ ] User login with valid/invalid credentials
- [ ] JWT token validation and refresh
- [ ] Avatar upload functionality
- [ ] Profile completion flow
- [ ] Password reset functionality
- [ ] Artist registration with avatar
- [ ] Error handling for all scenarios
- [ ] Rate limiting behavior
- [ ] Network error handling

### ✅ Production Testing

- [ ] Test with real email addresses
- [ ] Verify email delivery to different providers
- [ ] Test avatar upload with various image sizes
- [ ] Test concurrent user registrations
- [ ] Verify JWT token expiration handling
- [ ] Test offline/online scenarios

---

## 📞 Support

For technical support or questions about the authentication API:

1. **Check the logs**: Monitor server logs for detailed error information
2. **Test email configuration**: Use the email test script
3. **Verify environment variables**: Ensure all required variables are set
4. **Check rate limiting**: Monitor for rate limit violations
5. **Review error responses**: Use the error handling examples above

**Email**: support@jevahapp.com  
**Documentation**: Check `RENDER_ENVIRONMENT_SETUP.md` for deployment issues
