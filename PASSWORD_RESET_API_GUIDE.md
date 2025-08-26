# Password Reset & Forgot Password API Guide

## Overview

This guide provides comprehensive documentation for implementing password reset and forgot password functionality in your React Native frontend application using the Jevah backend API.

## Base URL

```
https://your-backend-domain.com/api
```

## Authentication Flow

### 1. Forgot Password (Step 1: Request Reset)

**Endpoint:** `POST /auth/forgot-password`

**Purpose:** Initiates the password reset process by sending a verification code to the user's email.

#### Request

```typescript
interface ForgotPasswordRequest {
  email: string;
}
```

#### Example Request

```javascript
const forgotPassword = async (email: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (response.ok) {
      // Success - verification code sent to email
      return { success: true, message: data.message };
    } else {
      // Handle errors
      return { success: false, message: data.message };
    }
  } catch (error) {
    return { success: false, message: 'Network error occurred' };
  }
};
```

#### Response Examples

**Success (200):**

```json
{
  "success": true,
  "message": "Password reset code sent to your email"
}
```

**User Not Found (404):**

```json
{
  "success": false,
  "message": "User not found"
}
```

**Rate Limited (429):**

```json
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```

### 2. Verify Reset Code (Step 2: Validate Code)

**Endpoint:** `POST /auth/verify-reset-code`

**Purpose:** Validates the verification code sent to the user's email.

#### Request

```typescript
interface VerifyResetCodeRequest {
  email: string;
  verificationCode: string;
}
```

#### Example Request

```javascript
const verifyResetCode = async (email: string, code: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify-reset-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        verificationCode: code
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Success - code is valid, proceed to reset password
      return { success: true, message: data.message };
    } else {
      // Handle errors
      return { success: false, message: data.message };
    }
  } catch (error) {
    return { success: false, message: 'Network error occurred' };
  }
};
```

#### Response Examples

**Success (200):**

```json
{
  "success": true,
  "message": "Verification code is valid"
}
```

**Invalid Code (400):**

```json
{
  "success": false,
  "message": "Invalid verification code"
}
```

**Expired Code (400):**

```json
{
  "success": false,
  "message": "Verification code has expired"
}
```

### 3. Reset Password (Step 3: Set New Password)

**Endpoint:** `POST /auth/reset-password`

**Purpose:** Sets the new password after successful code verification.

#### Request

```typescript
interface ResetPasswordRequest {
  email: string;
  verificationCode: string;
  newPassword: string;
}
```

#### Example Request

```javascript
const resetPassword = async (email: string, code: string, newPassword: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        verificationCode: code,
        newPassword
      }),
    });

    const data = await response.json();

    if (response.ok) {
      // Success - password reset complete
      return { success: true, message: data.message };
    } else {
      // Handle errors
      return { success: false, message: data.message };
    }
  } catch (error) {
    return { success: false, message: 'Network error occurred' };
  }
};
```

#### Response Examples

**Success (200):**

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Invalid Code (400):**

```json
{
  "success": false,
  "message": "Invalid verification code"
}
```

**Weak Password (400):**

```json
{
  "success": false,
  "message": "Password must be at least 8 characters long"
}
```

## Complete React Native Implementation

### 1. API Service Class

```typescript
// services/authService.ts
class AuthService {
  private baseURL: string;

  constructor() {
    this.baseURL = "https://your-backend-domain.com/api";
  }

  async forgotPassword(email: string) {
    try {
      const response = await fetch(`${this.baseURL}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }

  async verifyResetCode(email: string, code: string) {
    try {
      const response = await fetch(`${this.baseURL}/auth/verify-reset-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, verificationCode: code }),
      });

      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    try {
      const response = await fetch(`${this.baseURL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          verificationCode: code,
          newPassword,
        }),
      });

      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      return { success: false, error: "Network error" };
    }
  }
}

export default new AuthService();
```

### 2. React Native Screens

#### Forgot Password Screen

```typescript
// screens/ForgotPasswordScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import authService from '../services/authService';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.forgotPassword(email);

      if (result.success) {
        Alert.alert(
          'Success',
          'Verification code sent to your email',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('VerifyCode', { email }),
            },
          ]
        );
      } else {
        Alert.alert('Error', result.data?.message || 'Something went wrong');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>
        Enter your email address to receive a verification code
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email Address"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleForgotPassword}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send Verification Code</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backButtonText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});

export default ForgotPasswordScreen;
```

#### Verify Code Screen

```typescript
// screens/VerifyCodeScreen.tsx
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import authService from '../services/authService';

const VerifyCodeScreen = ({ navigation, route }) => {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const handleVerifyCode = async () => {
    if (!code.trim() || code.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.verifyResetCode(email, code);

      if (result.success) {
        navigation.navigate('ResetPassword', { email, code });
      } else {
        Alert.alert('Error', result.data?.message || 'Invalid code');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    try {
      const result = await authService.forgotPassword(email);

      if (result.success) {
        Alert.alert('Success', 'New verification code sent to your email');
      } else {
        Alert.alert('Error', result.data?.message || 'Failed to resend code');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Code</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code sent to {email}
      </Text>

      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="000000"
        value={code}
        onChangeText={setCode}
        keyboardType="numeric"
        maxLength={6}
        autoFocus
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleVerifyCode}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify Code</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.resendButton}
        onPress={handleResendCode}
        disabled={loading}
      >
        <Text style={styles.resendButtonText}>Resend Code</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
  },
  resendButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
});

export default VerifyCodeScreen;
```

#### Reset Password Screen

```typescript
// screens/ResetPasswordScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import authService from '../services/authService';

const ResetPasswordScreen = ({ navigation, route }) => {
  const { email, code } = route.params;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.resetPassword(email, code, newPassword);

      if (result.success) {
        Alert.alert(
          'Success',
          'Password reset successfully',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login'),
            },
          ]
        );
      } else {
        Alert.alert('Error', result.data?.message || 'Failed to reset password');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>
        Enter your new password
      </Text>

      <TextInput
        style={styles.input}
        placeholder="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm New Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleResetPassword}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Reset Password</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ResetPasswordScreen;
```

### 3. Navigation Setup

```typescript
// navigation/AuthNavigator.tsx
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import VerifyCodeScreen from '../screens/VerifyCodeScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

const Stack = createStackNavigator();

const AuthNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
```

## Error Handling

### Common Error Responses

| Status Code | Error Message                                 | Description                     |
| ----------- | --------------------------------------------- | ------------------------------- |
| 400         | "Invalid verification code"                   | Code is incorrect or expired    |
| 400         | "Password must be at least 8 characters long" | Password validation failed      |
| 404         | "User not found"                              | Email doesn't exist in database |
| 429         | "Too many requests. Please try again later."  | Rate limit exceeded             |
| 500         | "Internal server error"                       | Server-side error               |

### Error Handling Best Practices

1. **Show user-friendly messages** instead of technical errors
2. **Implement retry logic** for network errors
3. **Add loading states** during API calls
4. **Validate input** before making API calls
5. **Handle rate limiting** gracefully

## Security Considerations

1. **Code Expiration**: Verification codes expire after 15 minutes
2. **Rate Limiting**: Prevents abuse of the forgot password endpoint
3. **Secure Communication**: Use HTTPS for all API calls
4. **Input Validation**: Validate email format and password strength
5. **Session Management**: Clear any existing sessions after password reset

## Testing Checklist

- [ ] Test with valid email address
- [ ] Test with invalid email address
- [ ] Test with expired verification code
- [ ] Test with incorrect verification code
- [ ] Test password strength validation
- [ ] Test password confirmation matching
- [ ] Test rate limiting behavior
- [ ] Test network error handling
- [ ] Test navigation flow
- [ ] Test UI states (loading, error, success)

## Additional Notes

- Verification codes are 6-digit alphanumeric
- Email templates include Jevah branding and styling
- All endpoints return consistent JSON response format
- Consider implementing biometric authentication for enhanced security
- Add analytics tracking for password reset attempts
