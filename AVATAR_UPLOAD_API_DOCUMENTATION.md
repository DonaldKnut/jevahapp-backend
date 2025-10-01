# Avatar Upload API Documentation

## Overview

This document provides comprehensive documentation for the Avatar Upload API endpoint in the Jevah App backend. This endpoint allows authenticated users to upload and update their profile avatar images.

## Base URL

```
Production: https://jevahapp-backend.onrender.com
Development: http://localhost:4000
```

## Endpoint Details

### Upload User Avatar

**Endpoint:** `POST /api/auth/avatar`

**Description:** Uploads and updates the current user's profile avatar image. The endpoint automatically deletes the user's previous avatar (if any) before uploading the new one.

**Authentication:** Required (Bearer Token)

**Content-Type:** `multipart/form-data`

---

## Request Format

### Headers

```http
Authorization: Bearer <your_jwt_token>
Content-Type: multipart/form-data
```

### Form Data

| Field Name | Type | Required | Description                    |
| ---------- | ---- | -------- | ------------------------------ |
| `avatar`   | File | Yes      | Image file (JPEG, PNG, or GIF) |

### File Requirements

- **Supported Formats:** `image/jpeg`, `image/png`, `image/gif`
- **Maximum File Size:** 5MB (5,242,880 bytes)
- **Storage:** Files are processed in memory and uploaded to Cloudflare R2

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Avatar updated successfully",
  "data": {
    "avatarUrl": "https://your-cloudflare-r2-domain.com/user-avatars/1234567890-abc123def.jpg",
    "userId": "507f1f77bcf86cd799439011"
  }
}
```

### Error Responses

#### 400 Bad Request - Missing File

```json
{
  "success": false,
  "message": "Avatar image is required"
}
```

#### 400 Bad Request - Invalid File Type

```json
{
  "success": false,
  "message": "Invalid image type: image/webp"
}
```

#### 400 Bad Request - File Size Exceeded

```json
{
  "success": false,
  "message": "File size exceeds the 5MB limit"
}
```

#### 400 Bad Request - Unexpected Field

```json
{
  "success": false,
  "message": "Unexpected field in file upload. Expected field name: 'avatar'"
}
```

#### 401 Unauthorized - Missing Token

```json
{
  "success": false,
  "message": "Unauthorized: User ID missing"
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

## Frontend Implementation Examples

### React Native (Expo)

```typescript
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

interface AvatarUploadResponse {
  success: boolean;
  message: string;
  data?: {
    avatarUrl: string;
    userId: string;
  };
}

const uploadAvatar = async (token: string): Promise<AvatarUploadResponse> => {
  try {
    // Request permission to access media library
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      throw new Error("Permission to access camera roll is required!");
    }

    // Pick an image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];

      // Validate file size (5MB limit)
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        throw new Error("File size exceeds the 5MB limit");
      }

      // Create form data
      const formData = new FormData();

      formData.append("avatar", {
        uri: asset.uri,
        type: asset.type || "image/jpeg",
        name: asset.fileName || "avatar.jpg",
      } as any);

      // Upload to backend
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

      if (!response.ok) {
        throw new Error(data.message || "Upload failed");
      }

      return data;
    } else {
      throw new Error("No image selected");
    }
  } catch (error) {
    console.error("Avatar upload error:", error);
    throw error;
  }
};

// Usage
const handleAvatarUpload = async () => {
  try {
    const result = await uploadAvatar(userToken);
    if (result.success) {
      console.log("Avatar uploaded:", result.data?.avatarUrl);
      // Update UI with new avatar URL
    }
  } catch (error) {
    console.error("Failed to upload avatar:", error);
    // Show error message to user
  }
};
```

### React (Web)

```typescript
interface AvatarUploadResponse {
  success: boolean;
  message: string;
  data?: {
    avatarUrl: string;
    userId: string;
  };
}

const uploadAvatar = async (token: string, file: File): Promise<AvatarUploadResponse> => {
  try {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      throw new Error(`Invalid file type: ${file.type}`);
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File size exceeds the 5MB limit');
    }

    // Create form data
    const formData = new FormData();
    formData.append('avatar', file);

    // Upload to backend
    const response = await fetch('https://jevahapp-backend.onrender.com/api/auth/avatar', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Upload failed');
    }

    return data;
  } catch (error) {
    console.error('Avatar upload error:', error);
    throw error;
  }
};

// Usage with file input
const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const result = await uploadAvatar(userToken, file);
    if (result.success) {
      console.log('Avatar uploaded:', result.data?.avatarUrl);
      // Update UI with new avatar URL
    }
  } catch (error) {
    console.error('Failed to upload avatar:', error);
    // Show error message to user
  }
};

// JSX
<input
  type="file"
  accept="image/jpeg,image/png,image/gif"
  onChange={handleFileSelect}
/>
```

### JavaScript (Vanilla)

```javascript
const uploadAvatar = async (token, file) => {
  try {
    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      throw new Error(`Invalid file type: ${file.type}`);
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("File size exceeds the 5MB limit");
    }

    // Create form data
    const formData = new FormData();
    formData.append("avatar", file);

    // Upload to backend
    const response = await fetch(
      "https://jevahapp-backend.onrender.com/api/auth/avatar",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Upload failed");
    }

    return data;
  } catch (error) {
    console.error("Avatar upload error:", error);
    throw error;
  }
};

// Usage
document
  .getElementById("avatar-input")
  .addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const result = await uploadAvatar(userToken, file);
      if (result.success) {
        console.log("Avatar uploaded:", result.data.avatarUrl);
        // Update UI with new avatar URL
      }
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      // Show error message to user
    }
  });
```

---

## Important Notes

### Security Features

1. **Authentication Required:** All avatar uploads require a valid JWT token
2. **File Type Validation:** Only JPEG, PNG, and GIF images are accepted
3. **File Size Limit:** Maximum 5MB per upload
4. **Automatic Cleanup:** Previous avatar is automatically deleted when uploading a new one

### Storage Details

- **Storage Provider:** Cloudflare R2
- **Folder Structure:** `user-avatars/`
- **URL Format:** `https://your-cloudflare-r2-domain.com/user-avatars/{filename}`
- **File Naming:** Automatic generation with unique identifiers

### Error Handling

- Always check the `success` field in the response
- Handle network errors and timeouts gracefully
- Provide user-friendly error messages
- Validate file size and type on the frontend before uploading

### Rate Limiting

- Avatar uploads are subject to authentication rate limiting
- No specific rate limits for avatar uploads, but general auth rate limits apply

### CORS

- CORS is configured for frontend domains
- Ensure your frontend domain is whitelisted in the CORS configuration

---

## Testing

### Using cURL

```bash
curl -X POST \
  https://jevahapp-backend.onrender.com/api/auth/avatar \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "avatar=@/path/to/your/image.jpg"
```

### Using Postman

1. Set method to `POST`
2. Set URL to `https://jevahapp-backend.onrender.com/api/auth/avatar`
3. Add header: `Authorization: Bearer YOUR_JWT_TOKEN`
4. Go to Body tab, select `form-data`
5. Add key `avatar` with type `File`
6. Select your image file
7. Send the request

---

## Related Endpoints

- `GET /api/auth/me` - Get current user profile (includes avatar URL)
- `GET /api/auth/user/profile-picture` - Get user's profile picture
- `POST /api/auth/complete-profile` - Complete user profile (can include avatarUpload field)
