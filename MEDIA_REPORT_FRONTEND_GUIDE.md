# Media Report Feature - Frontend Integration Guide

**Version:** 1.0  
**Last Updated:** 2024  
**Status:** Production Ready

---

## 📋 Overview

This guide explains how to implement the media reporting feature in your frontend. Users can report inappropriate media content through a form modal that appears when they click the "Report" option in the media component's options menu.

**What happens when a user reports:**
1. ✅ User submits report form with reason and optional description
2. ✅ Report is saved to database
3. ✅ **Admin receives email notification immediately** (on every report)
4. ✅ **Admin receives in-app notification immediately**
5. ✅ Media report count is incremented
6. ✅ If report count reaches 3+, media is auto-flagged for review
7. ✅ Admin can view all reports in admin dashboard

## 🎯 Key Features

- ✅ **Report Option** - Add "Report" to media component options modal
- ✅ **Report Form Modal** - Short form with reason and description
- ✅ **Validation** - Prevents duplicate reports from same user
- ✅ **Admin Email Notifications** - Admins receive email on EVERY report
- ✅ **Admin In-App Notifications** - Admins receive in-app notification on every report
- ✅ **Admin Dashboard** - Admins can view and review all reports
- ✅ **Automatic Flagging** - Media auto-flagged after 3+ reports
- ✅ **Enhanced Threshold Alerts** - Additional alert when report count reaches 3+

---

## 📡 API Endpoint

### Report Media

```
POST /api/media/:id/report
```

**Authentication:** Required (Bearer token)  
**Content-Type:** `application/json`

**URL Parameters:**
- `id` (string, required) - MongoDB ObjectId of the media item

**Request Body:**
```typescript
{
  reason: ReportReason;  // Required
  description?: string;  // Optional, max 1000 characters
}
```

**Report Reason Options:**
- `"inappropriate_content"`
- `"non_gospel_content"`
- `"explicit_language"`
- `"violence"`
- `"sexual_content"`
- `"blasphemy"`
- `"spam"`
- `"copyright"`
- `"other"`

---

## 🎨 UI Implementation

### 1. Add Report Option to Media Options Modal

In your media component, add a "Report" option to the options menu. **Important:** Only show the "Report" option if the current user is NOT the uploader of the media.

```tsx
// MediaOptionsModal.tsx
import React from 'react';
import { View, TouchableOpacity, Text, Modal } from 'react-native';

interface MediaOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  mediaId: string;
  onReport: () => void;
  onShare?: () => void;
  onSave?: () => void;
  // ... other options
}

const MediaOptionsModal: React.FC<MediaOptionsModalProps> = ({
  visible,
  onClose,
  mediaId,
  onReport,
  onShare,
  onSave,
  isOwnContent, // Add this prop to check if user owns the content
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Other options */}
            
            {/* Only show Report option if user doesn't own the content */}
            {!isOwnContent && (
              <TouchableOpacity
                style={styles.option}
                onPress={() => {
                  onClose();
                  onReport();
                }}
              >
                <Text style={styles.optionText}>Report</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};
```

### 2. Create Report Form Modal

Create a report form component with reason selection and description field:

```tsx
// ReportMediaModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';

interface ReportMediaModalProps {
  visible: boolean;
  onClose: () => void;
  mediaId: string;
  onSubmit: (reason: string, description: string) => Promise<void>;
}

const REPORT_REASONS = [
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
  { value: 'non_gospel_content', label: 'Non-Gospel Content' },
  { value: 'explicit_language', label: 'Explicit Language' },
  { value: 'violence', label: 'Violence' },
  { value: 'sexual_content', label: 'Sexual Content' },
  { value: 'blasphemy', label: 'Blasphemy' },
  { value: 'spam', label: 'Spam' },
  { value: 'copyright', label: 'Copyright Violation' },
  { value: 'other', label: 'Other' },
];

const ReportMediaModal: React.FC<ReportMediaModalProps> = ({
  visible,
  onClose,
  mediaId,
  onSubmit,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for reporting');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(selectedReason, description);
      // Reset form
      setSelectedReason('');
      setDescription('');
      onClose();
      Alert.alert('Success', 'Your report has been submitted. Thank you for keeping our community safe.');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to submit report. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedReason('');
      setDescription('');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Report Content</Text>
            <TouchableOpacity onPress={handleClose} disabled={isSubmitting}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.label}>
              Why are you reporting this content? *
            </Text>
            
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.value}
                style={[
                  styles.reasonOption,
                  selectedReason === reason.value && styles.reasonOptionSelected,
                ]}
                onPress={() => setSelectedReason(reason.value)}
                disabled={isSubmitting}
              >
                <View style={styles.radioButton}>
                  {selectedReason === reason.value && (
                    <View style={styles.radioButtonSelected} />
                  )}
                </View>
                <Text style={styles.reasonText}>{reason.label}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>Additional Details (Optional)</Text>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Please provide more details about why you're reporting this content..."
              placeholderTextColor="#999"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={1000}
              editable={!isSubmitting}
            />
            <Text style={styles.charCount}>
              {description.length}/1000 characters
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                (!selectedReason || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
  },
  content: {
    padding: 20,
    maxHeight: 400,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  reasonOptionSelected: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2196f3',
  },
  reasonText: {
    fontSize: 16,
    color: '#333',
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#f44336',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
};

export default ReportMediaModal;
```

### 3. Integrate Report Functionality

Connect the report modal to your media component and API:

```tsx
// MediaComponent.tsx
import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import MediaOptionsModal from './MediaOptionsModal';
import ReportMediaModal from './ReportMediaModal';
import { reportMedia } from '../services/api';

const MediaComponent: React.FC<{ mediaId: string }> = ({ mediaId }) => {
  const [showOptions, setShowOptions] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const handleReport = async (reason: string, description: string) => {
    try {
      await reportMedia(mediaId, reason, description);
    } catch (error: any) {
      throw error; // Let the modal handle the error display
    }
  };

  return (
    <View>
      {/* Media content */}
      
      <TouchableOpacity onPress={() => setShowOptions(true)}>
        {/* Options icon */}
      </TouchableOpacity>

      <MediaOptionsModal
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        mediaId={mediaId}
        onReport={() => setShowReportModal(true)}
      />

      <ReportMediaModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        mediaId={mediaId}
        onSubmit={handleReport}
      />
    </View>
  );
};
```

### 4. API Service Function

Create the API service function to call the backend:

```typescript
// services/api.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://your-api-domain.com/api';

export interface ReportMediaRequest {
  reason: string;
  description?: string;
}

export const reportMedia = async (
  mediaId: string,
  reason: string,
  description?: string
): Promise<void> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await axios.post(
      `${API_BASE_URL}/media/${mediaId}/report`,
      {
        reason,
        description: description?.trim(),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to report media');
    }

    return response.data;
  } catch (error: any) {
    if (error.response) {
      // Handle specific error responses
      const errorMessage = error.response.data?.message || 'Failed to report media';
      
      if (error.response.status === 400) {
        throw new Error(errorMessage);
      } else if (error.response.status === 401) {
        throw new Error('Please log in to report content');
      } else if (error.response.status === 404) {
        throw new Error('Media not found');
      } else {
        throw new Error(errorMessage);
      }
    }
    
    throw new Error(error.message || 'Network error. Please try again.');
  }
};
```

---

## 📋 Response Formats

### Success Response (201 Created)

```json
{
  "success": true,
  "message": "Media reported successfully",
  "report": {
    "_id": "507f1f77bcf86cd799439011",
    "mediaId": "507f1f77bcf86cd799439012",
    "reason": "inappropriate_content",
    "status": "pending",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Responses

#### Already Reported (400 Bad Request)
```json
{
  "success": false,
  "message": "You have already reported this media"
}
```

#### Own Content (400 Bad Request)
```json
{
  "success": false,
  "message": "You cannot report your own content"
}
```

#### Unauthorized (401)
```json
{
  "success": false,
  "message": "Unauthorized: User not authenticated"
}
```

#### Media Not Found (404)
```json
{
  "success": false,
  "message": "Media not found"
}
```

#### Invalid Media ID (400)
```json
{
  "success": false,
  "message": "Invalid media ID"
}
```

---

## 🔧 Error Handling

### Handle Specific Errors

```typescript
try {
  await reportMedia(mediaId, reason, description);
} catch (error: any) {
  if (error.message.includes('already reported')) {
    Alert.alert(
      'Already Reported',
      'You have already reported this content. Our team will review it.'
    );
  } else if (error.message.includes('cannot report your own')) {
    Alert.alert(
      'Cannot Report',
      'You cannot report your own content.'
    );
  } else if (error.message.includes('Authentication')) {
    Alert.alert(
      'Login Required',
      'Please log in to report content.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => navigateToLogin() },
      ]
    );
  } else {
    Alert.alert('Error', error.message);
  }
}
```

---

## 🎨 UI/UX Best Practices

### 1. Visual Feedback

- Show loading indicator while submitting
- Disable form during submission
- Clear visual indication of selected reason
- Character counter for description field

### 2. User Messages

**Success Message:**
```
"Your report has been submitted. Thank you for keeping our community safe."
```

**Already Reported:**
```
"You have already reported this content. Our team will review it."
```

**Error:**
```
"Failed to submit report. Please try again."
```

### 3. Accessibility

- Use clear labels for all form fields
- Ensure sufficient color contrast
- Make buttons large enough to tap easily
- Support screen readers

---

## 📱 React Native Example (Complete)

```tsx
// Complete example with all functionality
import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, Alert } from 'react-native';
import { reportMedia } from '../services/api';

const ReportMediaScreen = ({ mediaId, visible, onClose }) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      Alert.alert('Error', 'Please select a reason');
      return;
    }

    setLoading(true);
    try {
      await reportMedia(mediaId, reason, description);
      Alert.alert(
        'Success',
        'Your report has been submitted. Thank you!',
        [{ text: 'OK', onPress: onClose }]
      );
      // Reset form
      setReason('');
      setDescription('');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      {/* Modal content from previous examples */}
    </Modal>
  );
};
```

---

## 🔐 Admin Endpoints

### Get All Pending Reports (Admin Only)

```
GET /api/media/reports/pending?page=1&limit=20
```

**Query Parameters:**
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "reports": [
    {
      "_id": "...",
      "mediaId": {
        "_id": "...",
        "title": "Media Title",
        "contentType": "music",
        "thumbnailUrl": "..."
      },
      "reportedBy": {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "reason": "inappropriate_content",
      "description": "User's description",
      "status": "pending",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### Get Reports for Specific Media (Admin Only)

```
GET /api/media/:id/reports
```

### Review Report (Admin Only)

```
POST /api/media/reports/:reportId/review
Body: {
  "status": "reviewed" | "resolved" | "dismissed",
  "adminNotes": "Optional admin notes"
}
```

---

## ✅ Testing Checklist

- [ ] Report option appears in media options modal
- [ ] Report modal opens when "Report" is clicked
- [ ] User can select a reason
- [ ] User can add optional description
- [ ] Form validates required fields
- [ ] Submit button disabled during submission
- [ ] Success message shows after submission
- [ ] Error handling works for all error cases
- [ ] Duplicate report prevention works
- [ ] Character limit enforced (1000 chars)
- [ ] Modal closes on success
- [ ] Form resets after submission

---

## 📚 Related Documentation

- `CONTENT_MODERATION_IMPLEMENTATION.md` - Backend implementation details
- `PRE_UPLOAD_VERIFICATION_FRONTEND_GUIDE.md` - Pre-upload verification guide

---

**Last Updated:** 2024  
**Status:** ✅ Ready for Frontend Integration

