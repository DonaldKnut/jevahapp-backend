# AI Description Generation - Media Creation Integration Guide

## Overview
This guide shows how to integrate the AI description generation endpoint into your media creation flow. Users can click a button to generate descriptions, which are then inserted into the description field before submitting the media upload.

## Complete Integration Flow

```
User fills form → Clicks "Generate with AI" → Description appears → User edits (optional) → Submits media
```

## API Endpoint

**POST** `/api/media/generate-description`

### Request
```json
{
  "title": "Finding Peace in Difficult Times",
  "contentType": "videos",
  "category": "teachings",
  "topics": ["peace", "faith", "encouragement"]
}
```

### Response
```json
{
  "success": true,
  "description": "Watch this inspiring teaching video that will guide you through finding peace in difficult times. Experience powerful biblical insights and visual storytelling that will strengthen your faith.",
  "bibleVerses": ["Romans 10:17", "Proverbs 4:20-22"],
  "enhancedDescription": "Watch this inspiring teaching video that will guide you through finding peace in difficult times. Experience powerful biblical insights and visual storytelling that will strengthen your faith and uplift your spirit.",
  "message": "Description generated successfully"
}
```

## Complete React/TypeScript Implementation

### Full Media Creation Form with AI Description

```typescript
import { useState, useRef } from 'react';
import { useAuth } from './hooks/useAuth'; // Your auth hook

interface MediaFormData {
  title: string;
  contentType: 'music' | 'videos' | 'books' | 'live' | 'audio' | 'sermon' | 'devotional' | 'ebook' | 'podcast';
  category?: string;
  topics?: string[];
  description: string;
  file: File | null;
  thumbnail: File | null;
  duration?: number;
}

const MediaCreationForm = () => {
  const { token } = useAuth();
  const [formData, setFormData] = useState<MediaFormData>({
    title: '',
    contentType: 'music',
    description: '',
    file: null,
    thumbnail: null,
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Step 1: Generate AI Description
  const handleGenerateDescription = async () => {
    // Validate title is present
    if (!formData.title.trim()) {
      setGenerateError('Please enter a title first');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

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
        
        // Optional: Show success notification
        console.log('Description generated successfully!');
      } else {
        setGenerateError(data.message || 'Failed to generate description');
      }
    } catch (error) {
      console.error('Error generating description:', error);
      setGenerateError('An error occurred. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 2: Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, file }));
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, thumbnail: file }));
    }
  };

  // Step 3: Submit Media with Generated Description
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }

    if (!formData.file) {
      alert('Please select a file to upload');
      return;
    }

    if (!formData.thumbnail) {
      alert('Please select a thumbnail');
      return;
    }

    setIsUploading(true);

    try {
      // Create FormData for file upload
      const uploadFormData = new FormData();
      uploadFormData.append('title', formData.title);
      uploadFormData.append('contentType', formData.contentType);
      
      // Add description (AI-generated or user-written)
      if (formData.description.trim()) {
        uploadFormData.append('description', formData.description.trim());
      }
      
      if (formData.category) {
        uploadFormData.append('category', formData.category);
      }
      
      if (formData.topics && formData.topics.length > 0) {
        uploadFormData.append('topics', JSON.stringify(formData.topics));
      }
      
      if (formData.duration) {
        uploadFormData.append('duration', formData.duration.toString());
      }
      
      uploadFormData.append('file', formData.file);
      uploadFormData.append('thumbnail', formData.thumbnail);

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - browser will set it with boundary for FormData
        },
        body: uploadFormData,
      });

      const data = await response.json();

      if (data.success) {
        alert('Media uploaded successfully!');
        // Reset form
        setFormData({
          title: '',
          contentType: 'music',
          description: '',
          file: null,
          thumbnail: null,
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
      } else {
        alert(data.message || 'Failed to upload media');
      }
    } catch (error) {
      console.error('Error uploading media:', error);
      alert('An error occurred while uploading. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="media-creation-form">
      <h2>Create New Media</h2>
      
      <form onSubmit={handleSubmit}>
        {/* Title Field */}
        <div className="form-group">
          <label htmlFor="title">
            Title <span className="required">*</span>
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter media title"
            required
            className="form-input"
          />
        </div>

        {/* Content Type */}
        <div className="form-group">
          <label htmlFor="contentType">
            Content Type <span className="required">*</span>
          </label>
          <select
            id="contentType"
            value={formData.contentType}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              contentType: e.target.value as MediaFormData['contentType'] 
            }))}
            className="form-select"
            required
          >
            <option value="music">Music</option>
            <option value="videos">Videos</option>
            <option value="books">Books</option>
            <option value="audio">Audio</option>
            <option value="sermon">Sermon</option>
            <option value="devotional">Devotional</option>
            <option value="ebook">eBook</option>
            <option value="podcast">Podcast</option>
            <option value="live">Live</option>
          </select>
        </div>

        {/* Category (Optional) */}
        <div className="form-group">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            value={formData.category || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              category: e.target.value || undefined 
            }))}
            className="form-select"
          >
            <option value="">Select category (optional)</option>
            <option value="worship">Worship</option>
            <option value="inspiration">Inspiration</option>
            <option value="youth">Youth</option>
            <option value="teachings">Teachings</option>
            <option value="marriage">Marriage</option>
            <option value="counselling">Counselling</option>
          </select>
        </div>

        {/* Description Field with AI Generation */}
        <div className="form-group">
          <label htmlFor="description">
            Description
            <span className="help-text">(Optional - you can write your own or generate with AI)</span>
          </label>
          
          <div className="description-container">
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter description or click 'Generate with AI' to get suggestions"
              rows={4}
              className="form-textarea"
            />
            
            <button
              type="button"
              onClick={handleGenerateDescription}
              disabled={isGenerating || !formData.title.trim()}
              className={`generate-button ${isGenerating ? 'loading' : ''}`}
              title={!formData.title.trim() ? 'Enter a title first' : 'Generate AI description'}
            >
              {isGenerating ? (
                <>
                  <span className="spinner"></span>
                  Generating...
                </>
              ) : (
                <>
                  <span className="icon">✨</span>
                  Generate with AI
                </>
              )}
            </button>
          </div>
          
          {generateError && (
            <div className="error-message">{generateError}</div>
          )}
          
          <small className="help-text">
            {isGenerating 
              ? 'AI is generating a description based on your title and content type...' 
              : 'Click the button to get AI-generated description suggestions. You can edit it after generation.'}
          </small>
        </div>

        {/* Topics (Optional) */}
        <div className="form-group">
          <label htmlFor="topics">Topics (comma-separated)</label>
          <input
            type="text"
            id="topics"
            value={formData.topics?.join(', ') || ''}
            onChange={(e) => {
              const topics = e.target.value
                .split(',')
                .map(t => t.trim())
                .filter(t => t.length > 0);
              setFormData(prev => ({ ...prev, topics: topics.length > 0 ? topics : undefined }));
            }}
            placeholder="e.g., peace, faith, encouragement"
            className="form-input"
          />
        </div>

        {/* File Upload */}
        <div className="form-group">
          <label htmlFor="file">
            Media File <span className="required">*</span>
          </label>
          <input
            type="file"
            id="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            required
            className="form-input"
            accept="audio/*,video/*,application/pdf"
          />
          {formData.file && (
            <div className="file-info">
              Selected: {formData.file.name} ({(formData.file.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          )}
        </div>

        {/* Thumbnail Upload */}
        <div className="form-group">
          <label htmlFor="thumbnail">
            Thumbnail <span className="required">*</span>
          </label>
          <input
            type="file"
            id="thumbnail"
            ref={thumbnailInputRef}
            onChange={handleThumbnailChange}
            required
            className="form-input"
            accept="image/*"
          />
          {formData.thumbnail && (
            <div className="file-info">
              Selected: {formData.thumbnail.name}
              <img 
                src={URL.createObjectURL(formData.thumbnail)} 
                alt="Thumbnail preview" 
                className="thumbnail-preview"
              />
            </div>
          )}
        </div>

        {/* Duration (Optional) */}
        <div className="form-group">
          <label htmlFor="duration">Duration (seconds)</label>
          <input
            type="number"
            id="duration"
            value={formData.duration || ''}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              duration: e.target.value ? parseInt(e.target.value) : undefined 
            }))}
            placeholder="e.g., 300 (for 5 minutes)"
            className="form-input"
            min="0"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isUploading || !formData.title.trim() || !formData.file || !formData.thumbnail}
          className="submit-button"
        >
          {isUploading ? 'Uploading...' : 'Upload Media'}
        </button>
      </form>
    </div>
  );
};

export default MediaCreationForm;
```

## CSS Styling

```css
.media-creation-form {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #333;
}

.required {
  color: #e74c3c;
}

.help-text {
  font-size: 0.875rem;
  color: #666;
  font-weight: normal;
  margin-left: 0.5rem;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

/* Description Container with AI Button */
.description-container {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.description-container .form-textarea {
  flex: 1;
}

.generate-button {
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: transform 0.2s, box-shadow 0.2s;
  white-space: nowrap;
  height: fit-content;
}

.generate-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.generate-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.generate-button.loading {
  background: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%);
}

.generate-button .icon {
  font-size: 1.2rem;
}

.generate-button .spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background-color: #fee;
  color: #c33;
  border-radius: 4px;
  font-size: 0.875rem;
}

.file-info {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 0.875rem;
  color: #666;
}

.thumbnail-preview {
  display: block;
  margin-top: 0.5rem;
  max-width: 200px;
  max-height: 200px;
  border-radius: 4px;
  object-fit: cover;
}

.submit-button {
  width: 100%;
  padding: 1rem;
  background-color: #27ae60;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-button:hover:not(:disabled) {
  background-color: #229954;
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

## React Native Implementation

```typescript
import { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { useAuth } from './hooks/useAuth';

const MediaCreationScreen = () => {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState('music');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [topics, setTopics] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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
          category: category || undefined,
          topics: topics ? topics.split(',').map(t => t.trim()) : undefined,
        }),
      });

      const data = await response.json();

      if (data.success && data.description) {
        setDescription(data.description);
        Alert.alert('Success', 'Description generated! You can edit it if needed.');
      } else {
        Alert.alert('Error', data.message || 'Failed to generate description');
      }
    } catch (error) {
      console.error('Error generating description:', error);
      Alert.alert('Error', 'An error occurred. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async () => {
    // Your media upload logic here
    // Use description (AI-generated or user-written) in the upload
  };

  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
        Create New Media
      </Text>

      {/* Title */}
      <Text style={{ marginBottom: 8, fontWeight: '500' }}>
        Title <Text style={{ color: 'red' }}>*</Text>
      </Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Enter media title"
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          borderRadius: 6,
          padding: 12,
          marginBottom: 16,
        }}
      />

      {/* Content Type */}
      <Text style={{ marginBottom: 8, fontWeight: '500' }}>
        Content Type <Text style={{ color: 'red' }}>*</Text>
      </Text>
      {/* Use Picker or similar component for dropdown */}
      
      {/* Description with AI Button */}
      <Text style={{ marginBottom: 8, fontWeight: '500' }}>
        Description
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Enter description or generate with AI"
          multiline
          numberOfLines={4}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#ddd',
            borderRadius: 6,
            padding: 12,
          }}
        />
        <TouchableOpacity
          onPress={handleGenerateDescription}
          disabled={isGenerating || !title.trim()}
          style={{
            backgroundColor: isGenerating || !title.trim() ? '#ccc' : '#667eea',
            padding: 12,
            borderRadius: 6,
            justifyContent: 'center',
            alignItems: 'center',
            minWidth: 100,
          }}
        >
          {isGenerating ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: 'white', fontWeight: '500' }}>
              ✨ AI
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Rest of form fields */}
      
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isUploading}
        style={{
          backgroundColor: isUploading ? '#ccc' : '#27ae60',
          padding: 16,
          borderRadius: 6,
          alignItems: 'center',
          marginTop: 20,
        }}
      >
        <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
          {isUploading ? 'Uploading...' : 'Upload Media'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default MediaCreationScreen;
```

## User Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Media Creation Form                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User enters Title: "Finding Peace"                      │
│  2. User selects Content Type: "videos"                     │
│  3. User selects Category: "teachings" (optional)            │
│  4. User enters Topics: "peace, faith" (optional)            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Description:                                          │  │
│  │ [Textarea - empty or user-written]                   │  │
│  │                                                       │  │
│  │ [✨ Generate with AI] ← User clicks here              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  5. Frontend calls: POST /api/media/generate-description    │
│     Body: { title, contentType, category, topics }          │
│                                                              │
│  6. Backend generates AI description                        │
│                                                              │
│  7. Frontend receives response:                             │
│     { description: "Watch this inspiring..." }             │
│                                                              │
│  8. Description field is auto-filled with AI text           │
│                                                              │
│  9. User can edit description if needed                     │
│                                                              │
│  10. User selects file and thumbnail                        │
│                                                              │
│  11. User clicks "Upload Media"                              │
│                                                              │
│  12. Frontend calls: POST /api/media/upload                 │
│      FormData includes: title, contentType, description,    │
│      category, topics, file, thumbnail                      │
│                                                              │
│  13. Media is uploaded with AI-generated description         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Integration Points

### 1. **Generate Description Button**
- Place next to or below the description textarea
- Disable if title is empty
- Show loading state during generation
- Handle errors gracefully

### 2. **Description Field**
- Allow user to edit AI-generated description
- Show placeholder text when empty
- Auto-populate when AI generation succeeds

### 3. **Form Submission**
- Include the description (AI-generated or user-written) in the upload
- Description is optional but recommended
- Use FormData for file uploads

## Best Practices

### 1. **User Experience**
- ✅ Make AI generation optional (users can write their own)
- ✅ Show clear feedback during generation
- ✅ Allow editing after generation
- ✅ Don't block form submission if generation fails

### 2. **Error Handling**
```typescript
try {
  const response = await fetch('/api/media/generate-description', {...});
  const data = await response.json();
  
  if (!response.ok) {
    // Handle HTTP errors (400, 401, 500, etc.)
    if (response.status === 401) {
      // Redirect to login
    } else if (response.status === 429) {
      // Rate limited - show message
      alert('Too many requests. Please wait a moment.');
    } else {
      // Other errors
      alert(data.message || 'Failed to generate description');
    }
    return;
  }
  
  // Success
  if (data.success && data.description) {
    setDescription(data.description);
  }
} catch (error) {
  // Network errors
  console.error('Network error:', error);
  alert('Connection error. Please check your internet and try again.');
}
```

### 3. **Loading States**
- Show spinner or "Generating..." text
- Disable button during generation
- Don't allow multiple simultaneous requests

### 4. **Validation**
- Require title before allowing AI generation
- Validate contentType matches expected values
- Ensure description length is reasonable (backend handles this)

## Testing Checklist

- [ ] Generate description with title only
- [ ] Generate description with title + contentType
- [ ] Generate description with title + contentType + category
- [ ] Generate description with all fields (title, contentType, category, topics)
- [ ] Handle AI generation error gracefully
- [ ] Edit AI-generated description
- [ ] Submit media with AI-generated description
- [ ] Submit media with user-written description
- [ ] Submit media without description (should work)
- [ ] Test with different content types (videos, music, books, etc.)
- [ ] Test rate limiting (multiple rapid requests)

## Example API Calls

### Generate Description
```bash
curl -X POST https://your-api.com/api/media/generate-description \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Finding Peace in Difficult Times",
    "contentType": "videos",
    "category": "teachings",
    "topics": ["peace", "faith", "encouragement"]
  }'
```

### Upload Media (with generated description)
```bash
curl -X POST https://your-api.com/api/media/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Finding Peace in Difficult Times" \
  -F "contentType=videos" \
  -F "description=Watch this inspiring teaching video that will guide you through finding peace in difficult times. Experience powerful biblical insights and visual storytelling that will strengthen your faith." \
  -F "category=teachings" \
  -F "topics=[\"peace\",\"faith\",\"encouragement\"]" \
  -F "file=@/path/to/video.mp4" \
  -F "thumbnail=@/path/to/thumbnail.jpg"
```

## Support

For issues or questions about this integration, contact the backend team or refer to the main API documentation.

