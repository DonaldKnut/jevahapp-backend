# Playlist System - Frontend Integration Guide

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** Production Ready

---

## 📋 Overview

This guide explains how to implement the comprehensive playlist system in your frontend. Users can create playlists, add/remove tracks, reorder tracks, and manage their music collections just like Spotify or Apple Music.

## 🎯 Key Features

- ✅ **Create Playlists** - Users can create custom playlists with names and descriptions
- ✅ **Delete Playlists** - Users can delete their own playlists
- ✅ **Add Tracks** - Add any media (songs, audio) to playlists
- ✅ **Remove Tracks** - Remove tracks from playlists
- ✅ **Reorder Tracks** - Drag-and-drop to reorder tracks in playlists
- ✅ **Public/Private Playlists** - Make playlists public or keep them private
- ✅ **Playlist Details** - View playlist information, tracks, and statistics
- ✅ **Play Tracking** - Track how many times a playlist is played
- ✅ **Playlist Cover Images** - Custom cover images for playlists
- ✅ **Tags** - Categorize playlists with tags

---

## 📡 API Endpoints

### 1. Create Playlist

Create a new playlist.

```
POST /api/playlists
```

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "name": "My Worship Playlist",
  "description": "Favorite worship songs",
  "isPublic": false,
  "coverImageUrl": "https://...",
  "tags": ["worship", "favorites"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Playlist created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "My Worship Playlist",
    "description": "Favorite worship songs",
    "userId": "user123",
    "isPublic": false,
    "tracks": [],
    "totalTracks": 0,
    "playCount": 0,
    "coverImageUrl": "https://...",
    "tags": ["worship", "favorites"],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 2. Get User Playlists

Get all playlists for the authenticated user.

```
GET /api/playlists?page=1&limit=20
```

**Authentication:** Required (Bearer token)

**Query Parameters:**
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "My Worship Playlist",
      "description": "Favorite worship songs",
      "userId": "user123",
      "isPublic": false,
      "totalTracks": 15,
      "playCount": 42,
      "coverImageUrl": "https://...",
      "tags": ["worship", "favorites"],
      "lastPlayedAt": "2024-01-20T08:15:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-20T08:15:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

---

### 3. Get Playlist by ID

Get detailed information about a specific playlist including all tracks.

```
GET /api/playlists/:playlistId
```

**Authentication:** Required (Bearer token)  
**Access:** Own playlists or public playlists

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "My Worship Playlist",
    "description": "Favorite worship songs",
    "userId": {
      "_id": "user123",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://..."
    },
    "isPublic": false,
    "tracks": [
      {
        "mediaId": {
          "_id": "media123",
          "title": "Amazing Grace",
          "contentType": "music",
          "thumbnailUrl": "https://...",
          "duration": 240,
          "uploadedBy": {
            "_id": "artist123",
            "firstName": "Jane",
            "lastName": "Artist",
            "avatar": "https://..."
          }
        },
        "addedAt": "2024-01-15T10:35:00.000Z",
        "addedBy": {
          "_id": "user123",
          "firstName": "John",
          "lastName": "Doe"
        },
        "order": 0,
        "notes": "My favorite version"
      }
    ],
    "totalTracks": 15,
    "totalDuration": 3600,
    "playCount": 42,
    "lastPlayedAt": "2024-01-20T08:15:00.000Z",
    "coverImageUrl": "https://...",
    "tags": ["worship", "favorites"],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T08:15:00.000Z"
  }
}
```

---

### 4. Update Playlist

Update playlist details (name, description, privacy, etc.).

```
PUT /api/playlists/:playlistId
```

**Authentication:** Required (Bearer token)  
**Access:** Own playlists only

**Request Body:**
```json
{
  "name": "Updated Playlist Name",
  "description": "Updated description",
  "isPublic": true,
  "coverImageUrl": "https://...",
  "tags": ["worship", "gospel"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Playlist updated successfully",
  "data": {
    // Updated playlist object
  }
}
```

---

### 5. Delete Playlist

Delete a playlist.

```
DELETE /api/playlists/:playlistId
```

**Authentication:** Required (Bearer token)  
**Access:** Own playlists only

**Response:**
```json
{
  "success": true,
  "message": "Playlist deleted successfully"
}
```

---

### 6. Add Track to Playlist

Add a track (media item) to a playlist.

```
POST /api/playlists/:playlistId/tracks
```

**Authentication:** Required (Bearer token)  
**Access:** Own playlists only

**Request Body:**
```json
{
  "mediaId": "media123",
  "notes": "Optional notes about this track",
  "position": 5
}
```

**Parameters:**
- `mediaId` (string, required) - MongoDB ObjectId of the media item
- `notes` (string, optional) - Optional notes about the track
- `position` (number, optional) - Position to insert at (default: end of playlist)

**Response:**
```json
{
  "success": true,
  "message": "Track added to playlist successfully",
  "data": {
    // Updated playlist with new track
  }
}
```

---

### 7. Remove Track from Playlist

Remove a track from a playlist.

```
DELETE /api/playlists/:playlistId/tracks/:mediaId
```

**Authentication:** Required (Bearer token)  
**Access:** Own playlists only

**Response:**
```json
{
  "success": true,
  "message": "Track removed from playlist successfully",
  "data": {
    // Updated playlist without removed track
  }
}
```

---

### 8. Reorder Playlist Tracks

Reorder tracks in a playlist (for drag-and-drop functionality).

```
PUT /api/playlists/:playlistId/tracks/reorder
```

**Authentication:** Required (Bearer token)  
**Access:** Own playlists only

**Request Body:**
```json
{
  "tracks": [
    { "mediaId": "media1", "order": 0 },
    { "mediaId": "media2", "order": 1 },
    { "mediaId": "media3", "order": 2 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Playlist tracks reordered successfully",
  "data": {
    // Updated playlist with reordered tracks
  }
}
```

---

### 9. Track Playlist Play

Increment play count when a playlist is played.

```
POST /api/playlists/:playlistId/play
```

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "success": true,
  "message": "Playlist play tracked",
  "data": {
    "playCount": 43,
    "lastPlayedAt": "2024-01-20T10:30:00.000Z"
  }
}
```

---

## 🎨 Frontend Implementation Examples

### React/React Native Components

#### Create Playlist Component

```tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { useAuth } from '../hooks/useAuth';

const CreatePlaylistModal = ({ visible, onClose, onSuccess }) => {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Playlist name is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/playlists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          isPublic,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Success', 'Playlist created successfully');
        onSuccess(data.data);
        onClose();
        // Reset form
        setName('');
        setDescription('');
        setIsPublic(false);
      } else {
        throw new Error(data.message || 'Failed to create playlist');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onRequestClose={onClose}>
      <View style={styles.container}>
        <TextInput
          placeholder="Playlist name"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />
        <TextInput
          placeholder="Description (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          style={styles.input}
        />
        <Switch
          value={isPublic}
          onValueChange={setIsPublic}
          label="Make playlist public"
        />
        <Button
          title={loading ? 'Creating...' : 'Create Playlist'}
          onPress={handleCreate}
          disabled={loading}
        />
        <Button title="Cancel" onPress={onClose} />
      </View>
    </Modal>
  );
};
```

#### Playlist List Component

```tsx
import React, { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Text, Image } from 'react-native';
import { useAuth } from '../hooks/useAuth';

const PlaylistListScreen = ({ navigation }) => {
  const { token } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async (pageNum = 1) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/playlists?page=${pageNum}&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        if (pageNum === 1) {
          setPlaylists(data.data);
        } else {
          setPlaylists([...playlists, ...data.data]);
        }
        setHasMore(data.data.length === 20);
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaylistPress = (playlistId) => {
    navigation.navigate('PlaylistDetail', { playlistId });
  };

  const renderPlaylistItem = ({ item }) => (
    <TouchableOpacity
      style={styles.playlistItem}
      onPress={() => handlePlaylistPress(item._id)}
    >
      {item.coverImageUrl && (
        <Image source={{ uri: item.coverImageUrl }} style={styles.coverImage} />
      )}
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistName}>{item.name}</Text>
        <Text style={styles.trackCount}>{item.totalTracks} tracks</Text>
        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={playlists}
        renderItem={renderPlaylistItem}
        keyExtractor={(item) => item._id}
        onEndReached={() => {
          if (hasMore && !loading) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchPlaylists(nextPage);
          }
        }}
        onEndReachedThreshold={0.5}
        refreshing={loading && page === 1}
        onRefresh={() => {
          setPage(1);
          fetchPlaylists(1);
        }}
      />
    </View>
  );
};
```

#### Add Track to Playlist

```tsx
const AddToPlaylistModal = ({ mediaId, visible, onClose }) => {
  const { token } = useAuth();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchPlaylists();
    }
  }, [visible]);

  const fetchPlaylists = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/playlists`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setPlaylists(data.data);
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
    }
  };

  const handleAddToPlaylist = async (playlistId) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/playlists/${playlistId}/tracks`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mediaId }),
        }
      );

      const data = await response.json();

      if (data.success) {
        Alert.alert('Success', 'Track added to playlist');
        onClose();
      } else {
        if (data.message.includes('already in')) {
          Alert.alert('Already Added', 'This track is already in the playlist');
        } else {
          throw new Error(data.message);
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>Add to Playlist</Text>
        {playlists.map((playlist) => (
          <TouchableOpacity
            key={playlist._id}
            style={styles.playlistItem}
            onPress={() => handleAddToPlaylist(playlist._id)}
            disabled={loading}
          >
            <Text style={styles.playlistName}>{playlist.name}</Text>
            <Text style={styles.trackCount}>{playlist.totalTracks} tracks</Text>
          </TouchableOpacity>
        ))}
        <Button title="Cancel" onPress={onClose} />
      </View>
    </Modal>
  );
};
```

#### Playlist Detail with Track Management

```tsx
const PlaylistDetailScreen = ({ route, navigation }) => {
  const { playlistId } = route.params;
  const { token } = useAuth();
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlaylist();
  }, [playlistId]);

  const fetchPlaylist = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/playlists/${playlistId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setPlaylist(data.data);
      }
    } catch (error) {
      console.error('Error fetching playlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTrack = async (mediaId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/playlists/${playlistId}/tracks/${mediaId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        // Refresh playlist
        fetchPlaylist();
      }
    } catch (error) {
      console.error('Error removing track:', error);
    }
  };

  const handleReorder = async (newOrder) => {
    try {
      const tracks = newOrder.map((track, index) => ({
        mediaId: track.mediaId._id || track.mediaId,
        order: index,
      }));

      const response = await fetch(
        `${API_BASE_URL}/api/playlists/${playlistId}/tracks/reorder`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tracks }),
        }
      );

      const data = await response.json();

      if (data.success) {
        fetchPlaylist();
      }
    } catch (error) {
      console.error('Error reordering tracks:', error);
    }
  };

  const handlePlayPlaylist = async () => {
    // Track playlist play
    await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/play`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    // Start playing playlist (use your audio player)
    // playPlaylist(playlist.tracks);
  };

  if (loading || !playlist) {
    return <ActivityIndicator />;
  }

  return (
    <ScrollView style={styles.container}>
      <Image
        source={{ uri: playlist.coverImageUrl || defaultCover }}
        style={styles.coverImage}
      />
      <Text style={styles.playlistName}>{playlist.name}</Text>
      <Text style={styles.description}>{playlist.description}</Text>
      <Text style={styles.info}>
        {playlist.totalTracks} tracks • {playlist.playCount} plays
      </Text>

      <Button title="Play" onPress={handlePlayPlaylist} />

      {/* Track List with drag-and-drop */}
      <FlatList
        data={playlist.tracks}
        renderItem={({ item, index }) => (
          <View style={styles.trackItem}>
            <Text style={styles.trackNumber}>{index + 1}</Text>
            <Image
              source={{ uri: item.mediaId.thumbnailUrl }}
              style={styles.trackThumbnail}
            />
            <View style={styles.trackInfo}>
              <Text style={styles.trackTitle}>{item.mediaId.title}</Text>
              <Text style={styles.trackArtist}>
                {item.mediaId.uploadedBy?.firstName}{' '}
                {item.mediaId.uploadedBy?.lastName}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemoveTrack(item.mediaId._id)}>
              <Text style={styles.removeButton}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
        keyExtractor={(item, index) =>
          item.mediaId._id?.toString() || index.toString()
        }
      />
    </ScrollView>
  );
};
```

---

## ⚠️ Error Handling

### Common Errors

#### Playlist Name Already Exists (400)
```json
{
  "success": false,
  "message": "You already have a playlist with this name"
}
```

#### Track Already in Playlist (400)
```json
{
  "success": false,
  "message": "This track is already in the playlist"
}
```

#### Access Denied (403)
```json
{
  "success": false,
  "message": "You can only edit your own playlists"
}
```

#### Playlist Not Found (404)
```json
{
  "success": false,
  "message": "Playlist not found"
}
```

---

## 💡 Best Practices

1. **Caching** - Cache playlist data for 5-10 minutes
2. **Optimistic Updates** - Update UI immediately, sync with backend
3. **Error Recovery** - Handle errors gracefully, allow retry
4. **Loading States** - Show loading indicators for all async operations
5. **Validation** - Validate playlist names on frontend before API call
6. **Drag-and-Drop** - Use libraries like `react-native-draggable-flatlist` for reordering

---

## 🎯 UI/UX Recommendations

1. **Playlist Cards** - Show cover image, name, track count
2. **Quick Actions** - Swipe to delete, long-press for options
3. **Empty States** - Show helpful messages when playlists are empty
4. **Search/Filter** - Allow users to search their playlists
5. **Batch Operations** - Allow adding multiple tracks at once

---

**Questions?** Contact the backend team or refer to the API documentation.

