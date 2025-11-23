# AI Description Generation API - Frontend Integration Guide

## Overview
This endpoint helps users generate engaging, AI-powered descriptions for their media content during the creation process. Users can click a button to get a professionally written description that they can use or edit before submitting their media.

## Endpoint

**POST** `/api/media/generate-description`

### Authentication
- **Required**: Yes (Bearer token)
- Users must be authenticated to generate descriptions

### Request Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body

```typescript
{
  title: string;                    // Required - The title of the media
  contentType: string;              // Required - Type of content
  category?: string;                 // Optional - Category of the content
  topics?: string[] | string;       // Optional - Topics or tags
}
```

#### Valid `contentType` Values
- `"music"`
- `"videos"`
- `"books"`
- `"live"`
- `"audio"`
- `"sermon"`
- `"devotional"`
- `"ebook"`
- `"podcast"`

#### Valid `category` Values (Optional)
- `"worship"`
- `"inspiration"`
- `"youth"`
- `"teachings"`
- `"marriage"`
- `"counselling"`

### Example Request

```javascript
const generateDescription = async (title, contentType, category, topics) => {
  try {
    const token = localStorage.getItem('token'); // or your auth method
    
    const response = await fetch('https://your-api.com/api/media/generate-description', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title,
        contentType: contentType,
        category: category || undefined,
        topics: topics || undefined,
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      return data.description; // Use this to populate the description field
    } else {
      console.error('Failed to generate description:', data.message);
      return null;
    }
  } catch (error) {
    console.error('Error generating description:', error);
    return null;
  }
};
```

### Success Response (200)

```json
{
  "success": true,
  "description": "An inspiring worship video that will uplift your spirit and strengthen your faith through powerful biblical teachings and heartfelt praise.",
  "bibleVerses": ["Psalm 100:1-2", "Ephesians 5:19"],
  "enhancedDescription": "An inspiring worship video that will uplift your spirit and strengthen your faith through powerful biblical teachings and heartfelt praise. This content is designed to help you connect with God through worship and deepen your spiritual journey.",
  "message": "Description generated successfully"
}
```

### Error Responses

#### 400 Bad Request - Missing Title
```json
{
  "success": false,
  "message": "Title is required"
}
```

#### 400 Bad Request - Invalid Content Type
```json
{
  "success": false,
  "message": "Valid contentType is required (music, videos, books, live, audio, sermon, devotional, ebook, podcast)"
}
```

#### 401 Unauthorized - No Token
```json
{
  "success": false,
  "message": "Unauthorized: No token provided"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to generate description",
  "error": "Error details"
}
```

## Frontend Implementation Example

### React/TypeScript Example

```typescript
import { useState } from 'react';
import { useAuth } from './hooks/useAuth'; // Your auth hook

interface MediaFormData {
  title: string;
  contentType: 'music' | 'videos' | 'books' | 'live';
  category?: string;
  topics?: string[];
  description: string;
}

const MediaCreationForm = () => {
  const { token } = useAuth();
  const [formData, setFormData] = useState<MediaFormData>({
    title: '',
    contentType: 'music',
    description: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateDescription = async () => {
    if (!formData.title.trim()) {
      alert('Please enter a title first');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/media/generate-description', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          contentType: formData.contentType,
          category: formData.category,
          topics: formData.topics,
        }),
      });

      const data = await response.json();

      if (data.success && data.description) {
        // Insert the generated description into the description field
        setFormData(prev => ({
          ...prev,
          description: data.description,
        }));
        
        // Optional: Show a success message
        alert('Description generated! You can edit it if needed.');
      } else {
        alert('Failed to generate description. Please try again.');
      }
    } catch (error) {
      console.error('Error generating description:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <form>
      <div>
        <label>Title *</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Enter media title"
          required
        />
      </div>

      <div>
        <label>Content Type *</label>
        <select
          value={formData.contentType}
          onChange={(e) => setFormData(prev => ({ ...prev, contentType: e.target.value as any }))}
        >
          <option value="music">Music</option>
          <option value="videos">Videos</option>
          <option value="books">Books</option>
          <option value="live">Live</option>
        </select>
      </div>

      <div>
        <label>Description</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Enter description or click 'Generate with AI' to get suggestions"
            rows={4}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={handleGenerateDescription}
            disabled={isGenerating || !formData.title.trim()}
            style={{
              padding: '8px 16px',
              backgroundColor: isGenerating ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
            }}
          >
            {isGenerating ? 'Generating...' : '✨ Generate with AI'}
          </button>
        </div>
        <small style={{ color: '#666' }}>
          {isGenerating 
            ? 'AI is generating a description...' 
            : 'Click the button to get AI-generated description suggestions'}
        </small>
      </div>

      {/* Rest of your form fields */}
    </form>
  );
};

export default MediaCreationForm;
```

### React Native Example

```typescript
import { useState } from 'react';
import { View, TextInput, Button, Text, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from './hooks/useAuth';

const MediaCreationScreen = () => {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState('music');
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateDescription = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title first');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('https://your-api.com/api/media/generate-description', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          contentType,
        }),
      });

      const data = await response.json();

      if (data.success && data.description) {
        setDescription(data.description);
        Alert.alert('Success', 'Description generated! You can edit it if needed.');
      } else {
        Alert.alert('Error', 'Failed to generate description. Please try again.');
      }
    } catch (error) {
      console.error('Error generating description:', error);
      Alert.alert('Error', 'An error occurred. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <TextInput
        placeholder="Enter media title"
        value={title}
        onChangeText={setTitle}
        style={{ borderWidth: 1, padding: 8, marginBottom: 16 }}
      />

      <TextInput
        placeholder="Description (or generate with AI)"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        style={{ borderWidth: 1, padding: 8, marginBottom: 8 }}
      />

      <Button
        title={isGenerating ? 'Generating...' : '✨ Generate with AI'}
        onPress={handleGenerateDescription}
        disabled={isGenerating || !title.trim()}
      />

      {isGenerating && <ActivityIndicator style={{ marginTop: 8 }} />}
    </View>
  );
};

export default MediaCreationScreen;
```

## UI/UX Best Practices

### 1. Button Placement
- Place the "Generate with AI" button next to or below the description textarea
- Use an icon (✨ or 🤖) to make it visually appealing
- Show loading state while generating

### 2. User Experience
- **Require title first**: Disable the button if title is empty
- **Show feedback**: Display a loading spinner or "Generating..." text
- **Allow editing**: Always allow users to edit the generated description
- **Optional feature**: Make it clear this is optional - users can write their own description

### 3. Error Handling
- Show user-friendly error messages
- If AI generation fails, provide a fallback message
- Don't block form submission if generation fails

### 4. Visual Design
```css
/* Example button styles */
.generate-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  transition: transform 0.2s;
}

.generate-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.generate-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

## Response Fields Explained

- **`description`**: The main AI-generated description (2-3 sentences, ~180 characters)
- **`bibleVerses`**: Array of relevant Bible verse references (optional to display)
- **`enhancedDescription`**: A longer, more detailed description (3-4 sentences, ~250 characters) - useful if you want to show a "more detailed" option
- **`message`**: Success or informational message

## Rate Limiting

This endpoint is rate-limited to prevent abuse. If you receive a 429 (Too Many Requests) response, wait a few seconds before trying again.

## Notes

1. **AI Service**: The endpoint uses Google's Gemini AI. If the AI service is unavailable, it will return a fallback description.
2. **User Context**: If the user is authenticated, the AI can personalize descriptions using the user's name.
3. **Content Quality**: Generated descriptions are optimized for Christian/gospel content and include appropriate biblical references.
4. **Editable**: Always allow users to edit the generated description before submitting.

## Testing

### Test Case 1: Basic Generation
```javascript
POST /api/media/generate-description
{
  "title": "Amazing Grace",
  "contentType": "music"
}
```

### Test Case 2: With Category and Topics
```javascript
POST /api/media/generate-description
{
  "title": "Finding Peace in Difficult Times",
  "contentType": "videos",
  "category": "teachings",
  "topics": ["peace", "faith", "encouragement"]
}
```

### Test Case 3: Missing Title (Should Fail)
```javascript
POST /api/media/generate-description
{
  "contentType": "music"
}
// Expected: 400 Bad Request
```

## Support

If you encounter any issues or have questions about integrating this endpoint, please contact the backend team.

