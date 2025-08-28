# Default Content Implementation Guide

## Overview

This guide explains how to implement a default content system for new user onboarding, similar to how Samsung phones come with pre-loaded content. The system provides Nigerian gospel content (videos, books, and audio) that users see immediately when they join the app.

## Features

### 1. **Pre-loaded Content Categories**
- **Gospel Music**: Popular Nigerian gospel songs (Sinach, Kefee, etc.)
- **Sermons**: Messages from Nigerian pastors (Adeboye, Kumuyi, Oyedepo)
- **Devotionals**: Daily prayer and reflection content
- **E-books**: Christian literature and prayer guides
- **Short Audio Clips**: Quick encouragement (2-5 minutes, like Samsung's Horizon)

### 2. **Content Organization**
- **Welcome Section**: First 3 items for new users
- **Quick Start**: Short content (≤5 minutes) for immediate engagement
- **Featured Content**: Popular gospel music and sermons
- **Daily Devotionals**: Morning and evening prayer content

## Implementation Steps

### Step 1: Database Schema Updates

The media model has been updated with new fields:

```typescript
// Default content fields
isDefaultContent?: boolean;    // Marks content as default/pre-loaded
isOnboardingContent?: boolean; // Marks content for onboarding experience
```

### Step 2: Seed Default Content

Run the seeder script to populate the database with default content:

```bash
# Build the project first
npm run build

# Run the seeder
node scripts/seed-default-content.js
```

**Content Included:**
- **5 Gospel Songs**: Sinach's hits (Great Are You Lord, Way Maker, etc.)
- **3 Sermons**: Messages from Nigerian pastors
- **2 Devotionals**: Morning and evening prayer content
- **2 E-books**: Christian literature and prayer guides
- **3 Short Audio Clips**: Quick encouragement and Bible verses

### Step 3: API Endpoints

#### Public Endpoint (No Authentication Required)
```http
GET /api/media/default
```

**Query Parameters:**
- `contentType`: Filter by content type (music, videos, audio, books)
- `limit`: Number of items to return (default: 10)

**Response:**
```json
{
  "success": true,
  "message": "Default content retrieved successfully",
  "data": {
    "total": 15,
    "grouped": {
      "music": [...],
      "videos": [...],
      "audio": [...],
      "books": [...],
      "shortClips": [...]
    },
    "all": [...]
  }
}
```

#### Protected Endpoint (Requires Authentication)
```http
GET /api/media/onboarding
```

**Response:**
```json
{
  "success": true,
  "message": "Onboarding content retrieved successfully",
  "data": {
    "welcome": {
      "title": "Welcome to Jevah",
      "subtitle": "Your spiritual journey starts here",
      "content": [...]
    },
    "quickStart": {
      "title": "Quick Start",
      "subtitle": "Short content to get you started",
      "content": [...]
    },
    "featured": {
      "title": "Featured Content",
      "subtitle": "Popular gospel content",
      "content": [...]
    },
    "devotionals": {
      "title": "Daily Devotionals",
      "subtitle": "Start your day with prayer",
      "content": [...]
    }
  }
}
```

## Frontend Integration

### React Native Implementation

```typescript
// Fetch default content for onboarding
const fetchOnboardingContent = async () => {
  try {
    const response = await fetch('/api/media/onboarding', {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Display onboarding content sections
      setOnboardingData(data.data);
    }
  } catch (error) {
    console.error('Error fetching onboarding content:', error);
  }
};

// Fetch public default content (no auth required)
const fetchDefaultContent = async (contentType?: string) => {
  try {
    const url = contentType 
      ? `/api/media/default?contentType=${contentType}`
      : '/api/media/default';
      
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    }
  } catch (error) {
    console.error('Error fetching default content:', error);
  }
};
```

### Onboarding Screen Example

```typescript
const OnboardingScreen = () => {
  const [onboardingData, setOnboardingData] = useState(null);
  
  useEffect(() => {
    fetchOnboardingContent();
  }, []);
  
  return (
    <ScrollView>
      {/* Welcome Section */}
      <Section title={onboardingData?.welcome.title}>
        {onboardingData?.welcome.content.map(item => (
          <MediaCard key={item._id} item={item} />
        ))}
      </Section>
      
      {/* Quick Start Section */}
      <Section title={onboardingData?.quickStart.title}>
        {onboardingData?.quickStart.content.map(item => (
          <MediaCard key={item._id} item={item} />
        ))}
      </Section>
      
      {/* Featured Content */}
      <Section title={onboardingData?.featured.title}>
        {onboardingData?.featured.content.map(item => (
          <MediaCard key={item._id} item={item} />
        ))}
      </Section>
      
      {/* Devotionals */}
      <Section title={onboardingData?.devotionals.title}>
        {onboardingData?.devotionals.content.map(item => (
          <MediaCard key={item._id} item={item} />
        ))}
      </Section>
    </ScrollView>
  );
};
```

## Content Management

### Adding New Default Content

1. **Update the seeder script** (`scripts/seed-default-content.js`)
2. **Add new content items** to the `defaultContent` array
3. **Run the seeder** to add to database
4. **Set appropriate flags**:
   - `isDefaultContent: true` - Makes it available as default content
   - `isOnboardingContent: true` - Includes it in onboarding experience

### Content Categories

**Music:**
- Nigerian gospel artists (Sinach, Kefee, etc.)
- Worship songs
- Praise and thanksgiving

**Sermons:**
- Nigerian pastors (Adeboye, Kumuyi, Oyedepo)
- Faith and miracles
- Christian living
- Prayer teachings

**Devotionals:**
- Morning prayers
- Evening reflections
- Daily Bible verses
- Gratitude practices

**E-books:**
- Prayer guides
- Christian literature
- Biblical principles
- Spiritual growth

**Short Audio:**
- Quick encouragement (2-5 minutes)
- Bible verse of the day
- Prayer for peace
- Motivational messages

## Best Practices

### 1. **Content Quality**
- Ensure all content is high-quality and properly licensed
- Include diverse Nigerian gospel content
- Maintain appropriate content ratings

### 2. **Performance**
- Use CDN for media files
- Implement proper caching
- Optimize images and thumbnails

### 3. **User Experience**
- Show loading states while fetching content
- Provide offline access to default content
- Allow users to skip onboarding if desired

### 4. **Analytics**
- Track which default content is most popular
- Monitor user engagement with onboarding content
- Use insights to improve content selection

## Testing

### Test the Seeder
```bash
# Run seeder
node scripts/seed-default-content.js

# Verify content was added
# Check MongoDB for items with isDefaultContent: true
```

### Test API Endpoints
```bash
# Test public endpoint
curl http://localhost:3000/api/media/default

# Test onboarding endpoint (requires auth)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/media/onboarding
```

### Test Frontend Integration
- Verify onboarding screen displays correctly
- Test content playback
- Check offline functionality
- Validate user interactions

## Future Enhancements

### 1. **Personalization**
- Track user preferences during onboarding
- Recommend content based on initial interactions
- Allow users to customize their experience

### 2. **Content Rotation**
- Regularly update default content
- Seasonal content (Christmas, Easter)
- Featured content from trending creators

### 3. **Offline Support**
- Download default content for offline access
- Sync progress across devices
- Background content updates

### 4. **Social Features**
- Share favorite default content
- Create playlists with default content
- Community recommendations

## Troubleshooting

### Common Issues

1. **Seeder fails to run**
   - Check MongoDB connection
   - Verify environment variables
   - Ensure Media model is properly imported

2. **API returns empty results**
   - Verify content exists in database
   - Check `isDefaultContent` and `isOnboardingContent` flags
   - Validate query parameters

3. **Frontend doesn't display content**
   - Check API response format
   - Verify authentication tokens
   - Debug network requests

### Debug Commands

```bash
# Check if default content exists
mongo your-database --eval "db.media.find({isDefaultContent: true}).count()"

# View default content
mongo your-database --eval "db.media.find({isDefaultContent: true}).pretty()"

# Check onboarding content
mongo your-database --eval "db.media.find({isOnboardingContent: true}).pretty()"
```

## Conclusion

This default content system provides new users with immediate access to high-quality Nigerian gospel content, creating a welcoming and engaging onboarding experience. The system is scalable, maintainable, and can be easily extended with new content and features.

