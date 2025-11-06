# Polls & Surveys - Frontend Integration Guide

**Version:** 1.0  
**Last Updated:** 2024-01-15  
**Status:** Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Reference](#quick-reference)
3. [Authentication](#authentication)
4. [API Endpoints](#api-endpoints)
5. [Implementation Guide](#implementation-guide)
6. [Complete Examples](#complete-examples)
7. [Error Handling](#error-handling)
8. [UI/UX Best Practices](#uiux-best-practices)
9. [Testing](#testing)

---

## Overview

Users can **create, vote on, update, and delete polls/surveys**. This guide provides clear, comprehensive documentation for implementing poll functionality in your frontend application.

### Key Features

- ✅ **Create Polls**: Users can create polls with multiple options
- ✅ **Single or Multi-Select**: Support for single-choice and multi-choice polls
- ✅ **Vote on Polls**: Users can vote on any poll
- ✅ **Manage Own Polls**: Creators can update and delete their own polls
- ✅ **View Results**: Real-time vote counts and percentages
- ✅ **Expiration Dates**: Optional closing dates for polls
- ✅ **Pagination**: List all polls with pagination support

### Ownership Rules

- ✅ **Create**: All authenticated users can create polls
- ✅ **Vote**: All authenticated users can vote on polls
- ✅ **Update**: Only poll creator or admin can update
- ✅ **Delete**: Only poll creator or admin can delete

---

## Quick Reference

### All Poll Endpoints

```typescript
// Create
POST   /api/community/polls

// Read
GET    /api/community/polls              // List all polls
GET    /api/community/polls/my           // Get current user's polls
GET    /api/community/polls/:id          // Get single poll

// Vote
POST   /api/community/polls/:id/vote     // Vote on poll

// Update (Creator/Admin only)
PUT    /api/community/polls/:id           // Update poll

// Delete (Creator/Admin only)
DELETE /api/community/polls/:id           // Delete poll
```

---

## Authentication

All endpoints (except public GET) require authentication:

```typescript
Headers: {
  'Authorization': 'Bearer {token}',
  'Content-Type': 'application/json'
}
```

---

## API Endpoints

### 1. Create Poll

**Endpoint:** `POST /api/community/polls`  
**Alias:** `POST /api/community/polls/create`  
**Access:** Authenticated users  
**Rate Limit:** 20 requests per 15 minutes

**Request Body:**

```typescript
{
  question: string;           // Required - The poll question (min 5 chars)
  options: string[];         // Required - Array of 2+ options
  multiSelect?: boolean;      // Optional - Allow multiple selections (default: false)
  closesAt?: string;         // Optional - ISO date string for expiration
  description?: string;       // Optional - Additional poll description
}
```

**Example Request:**

```typescript
POST /api/community/polls
{
  "question": "What is your favorite worship style?",
  "options": [
    "Contemporary",
    "Traditional",
    "Gospel",
    "Acoustic"
  ],
  "multiSelect": false,
  "description": "Help us understand worship preferences"
}
```

**Success Response (201):**

```typescript
{
  success: true,
  poll: {
    id: "poll-id",
    question: "What is your favorite worship style?",
    options: ["Contemporary", "Traditional", "Gospel", "Acoustic"],
    multiSelect: false,
    author: {
      id: "user-id",
      firstName: "John",
      lastName: "Doe"
    },
    votes: [],
    totalVotes: 0,
    createdAt: "2024-01-15T10:00:00Z"
  }
}
```

---

### 2. List All Polls

**Endpoint:** `GET /api/community/polls`  
**Access:** Public (no auth required)  
**Query Parameters:**

| Parameter | Type   | Default | Description                     |
| --------- | ------ | ------- | ------------------------------- |
| `page`    | number | 1       | Page number                     |
| `limit`   | number | 20      | Items per page (max 100)        |
| `status`  | string | "all"   | Filter: "all", "open", "closed" |

**Example Request:**

```typescript
GET /api/community/polls?page=1&limit=20&status=open
```

**Success Response (200):**

```typescript
{
  success: true,
  items: [
    {
      id: "poll-id",
      question: "What is your favorite worship style?",
      options: [
        { text: "Contemporary", votesCount: 10, percentage: 40 },
        { text: "Traditional", votesCount: 8, percentage: 32 },
        { text: "Gospel", votesCount: 5, percentage: 20 },
        { text: "Acoustic", votesCount: 2, percentage: 8 }
      ],
      totalVotes: 25,
      isActive: true,
      userVoted: false,
      createdAt: "2024-01-15T10:00:00Z"
    }
  ],
  page: 1,
  pageSize: 20,
  total: 50
}
```

---

### 3. Get My Polls

**Endpoint:** `GET /api/community/polls/my`  
**Access:** Authenticated users only  
**Query Parameters:** Same as list polls

**Example Request:**

```typescript
GET /api/community/polls/my?page=1&limit=20
```

**Success Response (200):**

```typescript
{
  success: true,
  items: [...], // Array of polls created by current user
  page: 1,
  pageSize: 10,
  total: 5,
  pagination: {
    page: 1,
    limit: 20,
    total: 5,
    pages: 1
  }
}
```

---

### 4. Get Single Poll

**Endpoint:** `GET /api/community/polls/:id`  
**Access:** Public (no auth required)

**Success Response (200):**

```typescript
{
  success: true,
  poll: {
    id: "poll-id",
    question: "What is your favorite worship style?",
    options: [
      {
        _id: "poll-id_0",
        text: "Contemporary",
        votesCount: 10,
        percentage: 40
      },
      // ... more options
    ],
    totalVotes: 25,
    isActive: true,
    userVoted: true,
    userVoteOptionId: "poll-id_0",
    createdAt: "2024-01-15T10:00:00Z",
    createdByUser: {
      _id: "user-id",
      username: "john_doe",
      avatarUrl: "url"
    }
  }
}
```

---

### 5. Vote on Poll

**Endpoint:** `POST /api/community/polls/:id/vote`  
**Alias:** `POST /api/community/polls/:id/votes`  
**Access:** Authenticated users  
**Rate Limit:** 60 requests per 5 minutes

**Request Body:**

```typescript
{
  optionIndex: number | number[];  // Required - Single index or array of indices
}
```

**Example Request (Single Choice):**

```typescript
POST /api/community/polls/123/vote
{
  "optionIndex": 0  // Vote for first option
}
```

**Example Request (Multi-Select):**

```typescript
POST /api/community/polls/123/vote
{
  "optionIndex": [0, 2]  // Vote for first and third options
}
```

**Success Response (200):**

```typescript
{
  success: true,
  poll: {
    // Updated poll with new vote counts
    options: [
      { text: "Contemporary", votesCount: 11, percentage: 42 }, // Updated
      // ...
    ],
    totalVotes: 26,
    userVoted: true
  }
}
```

**Note:** If user already voted, their previous vote is replaced with the new selection.

---

### 6. Update Poll

**Endpoint:** `PUT /api/community/polls/:id`  
**Access:** Poll creator or admin only  
**Rate Limit:** 10 requests per hour

**Request Body:**

```typescript
{
  question?: string;      // Optional - Update question (min 5 chars)
  options?: string[];     // Optional - Update options (must have 2+)
  multiSelect?: boolean;  // Optional - Update multi-select setting
  closesAt?: string | null; // Optional - Update expiration date (null to remove)
  description?: string | null; // Optional - Update description
}
```

**Example Request:**

```typescript
PUT /api/community/polls/123
{
  "question": "Updated question text",
  "closesAt": "2024-12-31T23:59:59Z"
}
```

**Success Response (200):**

```typescript
{
  success: true,
  data: {
    // Updated poll object
  }
}
```

---

### 7. Delete Poll

**Endpoint:** `DELETE /api/community/polls/:id`  
**Access:** Poll creator or admin only  
**Rate Limit:** 10 requests per hour

**Example Request:**

```typescript
DELETE / api / community / polls / 123;
```

**Success Response (200):**

```typescript
{
  success: true,
  message: "Poll deleted successfully"
}
```

---

## Implementation Guide

### Step 1: Create API Service

```typescript
// services/pollService.ts
import axios from "axios";
import * as SecureStore from "expo-secure-store";

const API_BASE_URL = "https://your-api-domain.com/api/community/polls";

interface PollOption {
  _id: string;
  text: string;
  votesCount: number;
  percentage: number;
}

interface Poll {
  _id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  isActive: boolean;
  userVoted: boolean;
  userVoteOptionId?: string;
  multiSelect: boolean;
  closesAt?: string;
  createdAt: string;
  createdByUser?: {
    _id: string;
    username: string;
    avatarUrl?: string;
  };
}

interface CreatePollData {
  question: string;
  options: string[];
  multiSelect?: boolean;
  closesAt?: string;
  description?: string;
}

interface VoteData {
  optionIndex: number | number[];
}

/**
 * Get authentication token
 */
const getAuthToken = async (): Promise<string> => {
  const token = await SecureStore.getItemAsync("authToken");
  if (!token) throw new Error("Authentication required");
  return token;
};

/**
 * Create a new poll
 */
export const createPoll = async (data: CreatePollData): Promise<Poll> => {
  const token = await getAuthToken();

  const response = await axios.post<{ success: boolean; poll: Poll }>(
    `${API_BASE_URL}`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.data.success) {
    throw new Error("Failed to create poll");
  }

  return response.data.poll;
};

/**
 * List all polls
 */
export const listPolls = async (params?: {
  page?: number;
  limit?: number;
  status?: "all" | "open" | "closed";
}): Promise<{
  items: Poll[];
  page: number;
  pageSize: number;
  total: number;
}> => {
  const response = await axios.get<{
    success: boolean;
    items: Poll[];
    page: number;
    pageSize: number;
    total: number;
  }>(`${API_BASE_URL}`, {
    params: {
      page: params?.page || 1,
      limit: params?.limit || 20,
      status: params?.status || "all",
    },
  });

  return {
    items: response.data.items,
    page: response.data.page,
    pageSize: response.data.pageSize,
    total: response.data.total,
  };
};

/**
 * Get current user's polls
 */
export const getMyPolls = async (params?: {
  page?: number;
  limit?: number;
}): Promise<{
  items: Poll[];
  page: number;
  pageSize: number;
  total: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}> => {
  const token = await getAuthToken();

  const response = await axios.get<{
    success: boolean;
    items: Poll[];
    page: number;
    pageSize: number;
    total: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>(`${API_BASE_URL}/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params: {
      page: params?.page || 1,
      limit: params?.limit || 20,
    },
  });

  return response.data;
};

/**
 * Get single poll by ID
 */
export const getPoll = async (pollId: string): Promise<Poll> => {
  const response = await axios.get<{ success: boolean; poll: Poll }>(
    `${API_BASE_URL}/${pollId}`
  );

  if (!response.data.success) {
    throw new Error("Poll not found");
  }

  return response.data.poll;
};

/**
 * Vote on a poll
 */
export const voteOnPoll = async (
  pollId: string,
  optionIndex: number | number[]
): Promise<Poll> => {
  const token = await getAuthToken();

  const response = await axios.post<{ success: boolean; poll: Poll }>(
    `${API_BASE_URL}/${pollId}/vote`,
    { optionIndex },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.data.success) {
    throw new Error("Failed to vote");
  }

  return response.data.poll;
};

/**
 * Update poll (creator or admin only)
 */
export const updatePoll = async (
  pollId: string,
  data: Partial<CreatePollData>
): Promise<Poll> => {
  const token = await getAuthToken();

  const response = await axios.put<{ success: boolean; data: Poll }>(
    `${API_BASE_URL}/${pollId}`,
    data,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.data.success) {
    throw new Error("Failed to update poll");
  }

  return response.data.data;
};

/**
 * Delete poll (creator or admin only)
 */
export const deletePoll = async (pollId: string): Promise<void> => {
  const token = await getAuthToken();

  const response = await axios.delete<{ success: boolean; message: string }>(
    `${API_BASE_URL}/${pollId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "Failed to delete poll");
  }
};
```

---

### Step 2: Create React Hooks

```typescript
// hooks/usePolls.ts
import { useState, useEffect } from "react";
import {
  listPolls,
  getPoll,
  voteOnPoll,
  createPoll,
  deletePoll,
  updatePoll,
} from "../services/pollService";

export const usePolls = (params?: { status?: "all" | "open" | "closed" }) => {
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    hasMore: false,
  });

  const fetchPolls = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPolls({ page, limit: 20, ...params });
      setPolls(page === 1 ? result.items : [...polls, ...result.items]);
      setPagination({
        page,
        total: result.total,
        hasMore:
          result.items.length === 20 &&
          polls.length + result.items.length < result.total,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls(1);
  }, [params?.status]);

  return {
    polls,
    loading,
    error,
    pagination,
    fetchPolls,
    refresh: () => fetchPolls(1),
  };
};

export const usePoll = (pollId: string) => {
  const [poll, setPoll] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPoll = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPoll(pollId);
      setPoll(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const vote = async (optionIndex: number | number[]) => {
    try {
      const updatedPoll = await voteOnPoll(pollId, optionIndex);
      setPoll(updatedPoll);
      return updatedPoll;
    } catch (err: any) {
      throw err;
    }
  };

  useEffect(() => {
    if (pollId) fetchPoll();
  }, [pollId]);

  return { poll, loading, error, vote, refresh: fetchPoll };
};

export const useCreatePoll = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (data: any) => {
    setLoading(true);
    setError(null);
    try {
      const poll = await createPoll(data);
      return poll;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { create, loading, error };
};

export const useDeletePoll = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async (pollId: string) => {
    setLoading(true);
    setError(null);
    try {
      await deletePoll(pollId);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { remove, loading, error };
};
```

---

### Step 3: Create Poll Components

```typescript
// components/PollCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { usePoll } from '../hooks/usePolls';

interface PollCardProps {
  pollId: string;
  currentUserId: string;
}

export const PollCard: React.FC<PollCardProps> = ({ pollId, currentUserId }) => {
  const { poll, loading, vote } = usePoll(pollId);

  if (loading) return <Text>Loading poll...</Text>;
  if (!poll) return null;

  const isOwner = poll.createdByUser?._id === currentUserId;
  const canVote = !poll.userVoted && poll.isActive;

  const handleVote = async (optionIndex: number) => {
    try {
      await vote(poll.multiSelect ? [optionIndex] : optionIndex);
    } catch (error) {
      console.error('Vote failed:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.question}>{poll.question}</Text>
        {isOwner && (
          <View style={styles.ownerBadge}>
            <Text style={styles.ownerText}>Your Poll</Text>
          </View>
        )}
      </View>

      <View style={styles.options}>
        {poll.options.map((option, index) => (
          <TouchableOpacity
            key={option._id}
            style={[
              styles.option,
              poll.userVoted && option.votesCount > 0 && styles.votedOption,
            ]}
            onPress={() => canVote && handleVote(index)}
            disabled={!canVote}
          >
            <View style={styles.optionContent}>
              <Text style={styles.optionText}>{option.text}</Text>
              {poll.userVoted && (
                <View style={styles.stats}>
                  <Text style={styles.voteCount}>{option.votesCount} votes</Text>
                  <Text style={styles.percentage}>{option.percentage}%</Text>
                </View>
              )}
            </View>
            {poll.userVoted && (
              <View
                style={[
                  styles.progressBar,
                  { width: `${option.percentage}%` },
                ]}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.voteTotal}>{poll.totalVotes} total votes</Text>
        {poll.userVoted && (
          <Text style={styles.votedText}>✓ You voted</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  question: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    color: '#333',
  },
  ownerBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ownerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  options: {
    gap: 8,
  },
  option: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    overflow: 'hidden',
  },
  votedOption: {
    backgroundColor: '#e3f2fd',
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
  },
  voteCount: {
    fontSize: 14,
    color: '#666',
  },
  percentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#2196F3',
    opacity: 0.2,
    zIndex: -1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  voteTotal: {
    fontSize: 14,
    color: '#666',
  },
  votedText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
});
```

---

### Step 4: Create Poll Form Component

```typescript
// components/CreatePollForm.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useCreatePoll } from '../hooks/usePolls';

interface CreatePollFormProps {
  onSuccess?: (poll: any) => void;
  onCancel?: () => void;
}

export const CreatePollForm: React.FC<CreatePollFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const { create, loading } = useCreatePoll();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiSelect, setMultiSelect] = useState(false);
  const [description, setDescription] = useState('');

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async () => {
    // Validation
    if (!question.trim() || question.length < 5) {
      Alert.alert('Error', 'Question must be at least 5 characters');
      return;
    }

    const validOptions = options.filter(opt => opt.trim().length > 0);
    if (validOptions.length < 2) {
      Alert.alert('Error', 'Please provide at least 2 options');
      return;
    }

    try {
      const poll = await create({
        question: question.trim(),
        options: validOptions.map(opt => opt.trim()),
        multiSelect,
        description: description.trim() || undefined,
      });

      Alert.alert('Success', 'Poll created successfully!');
      onSuccess?.(poll);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create poll');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Question *</Text>
      <TextInput
        style={styles.input}
        value={question}
        onChangeText={setQuestion}
        placeholder="Enter your poll question..."
        multiline
        maxLength={200}
      />
      <Text style={styles.helperText}>
        {question.length}/200 characters
      </Text>

      <Text style={styles.label}>Options * (Minimum 2)</Text>
      {options.map((option, index) => (
        <View key={index} style={styles.optionRow}>
          <TextInput
            style={styles.optionInput}
            value={option}
            onChangeText={(value) => updateOption(index, value)}
            placeholder={`Option ${index + 1}`}
          />
          {options.length > 2 && (
            <TouchableOpacity
              onPress={() => removeOption(index)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {options.length < 10 && (
        <TouchableOpacity onPress={addOption} style={styles.addButton}>
          <Text style={styles.addText}>+ Add Option</Text>
        </TouchableOpacity>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.label}>Allow Multiple Selections</Text>
        <TouchableOpacity
          onPress={() => setMultiSelect(!multiSelect)}
          style={[
            styles.switch,
            multiSelect && styles.switchActive,
          ]}
        >
          <View
            style={[
              styles.switchThumb,
              multiSelect && styles.switchThumbActive,
            ]}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Description (Optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Add more context about your poll..."
        multiline
        maxLength={500}
      />

      <View style={styles.buttonRow}>
        {onCancel && (
          <TouchableOpacity
            onPress={onCancel}
            style={[styles.button, styles.cancelButton]}
            disabled={loading}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.button, styles.submitButton]}
          disabled={loading}
        >
          <Text style={styles.submitText}>
            {loading ? 'Creating...' : 'Create Poll'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  removeButton: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ff6b6b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
  },
  addText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  switch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    padding: 2,
  },
  switchActive: {
    backgroundColor: '#4CAF50',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    transform: [{ translateX: 0 }],
  },
  switchThumbActive: {
    transform: [{ translateX: 22 }],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelText: {
    color: '#333',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#2196F3',
  },
  submitText: {
    color: '#fff',
    fontWeight: '600',
  },
});
```

---

## Complete Examples

### Example: Poll List Screen

```typescript
// screens/PollsScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { usePolls } from '../hooks/usePolls';
import { PollCard } from '../components/PollCard';
import { CreatePollForm } from '../components/CreatePollForm';

export const PollsScreen: React.FC = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const { polls, loading, error, pagination, refresh, fetchPolls } = usePolls({
    status: statusFilter,
  });

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    refresh();
  };

  if (showCreateForm) {
    return (
      <View style={styles.container}>
        <CreatePollForm
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreateForm(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Polls & Surveys</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateForm(true)}
        >
          <Text style={styles.createButtonText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'open', 'closed'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              statusFilter === status && styles.filterButtonActive,
            ]}
            onPress={() => setStatusFilter(status)}
          >
            <Text
              style={[
                styles.filterText,
                statusFilter === status && styles.filterTextActive,
              ]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={polls}
        renderItem={({ item }) => (
          <PollCard pollId={item._id} currentUserId="current-user-id" />
        )}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} />
        }
        onEndReached={() => {
          if (pagination.hasMore && !loading) {
            fetchPolls(pagination.page + 1);
          }
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No polls found</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  createButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterText: {
    color: '#666',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#fee',
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: '#c00',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
```

---

## Error Handling

### Error Response Codes

| Status Code | Meaning      | User Message                          |
| ----------- | ------------ | ------------------------------------- |
| `200`       | Success      | Operation completed                   |
| `201`       | Created      | Poll created successfully             |
| `400`       | Bad Request  | Validation error - check your input   |
| `401`       | Unauthorized | Please log in to continue             |
| `403`       | Forbidden    | You can only modify polls you created |
| `404`       | Not Found    | Poll not found                        |
| `429`       | Rate Limited | Too many requests - please slow down  |
| `500`       | Server Error | Server error - please try again later |

### Error Response Format

```typescript
// Error Response
{
  success: false,
  error: string,
  message?: string
}
```

### Error Handling Example

```typescript
try {
  const poll = await createPoll(data);
  // Success
} catch (error: any) {
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message || error.response.data?.error;

    switch (status) {
      case 400:
        Alert.alert("Validation Error", message || "Please check your input");
        break;
      case 401:
        Alert.alert("Authentication Required", "Please log in to create polls");
        // Redirect to login
        break;
      case 403:
        Alert.alert(
          "Permission Denied",
          "You can only modify polls you created"
        );
        break;
      case 429:
        Alert.alert("Rate Limit", "Too many requests. Please wait a moment.");
        break;
      default:
        Alert.alert("Error", message || "Something went wrong");
    }
  } else {
    Alert.alert("Network Error", "Please check your internet connection");
  }
}
```

---

## UI/UX Best Practices

### 1. Show Delete/Edit Only for User's Own Polls

```typescript
const isOwner = poll.createdByUser?._id === currentUserId;

{isOwner && (
  <View style={styles.actions}>
    <TouchableOpacity onPress={() => handleEdit(poll._id)}>
      <Text>Edit</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={() => handleDelete(poll._id)}>
      <Text>Delete</Text>
    </TouchableOpacity>
  </View>
)}
```

### 2. Visual Feedback for Voting

```typescript
// Show checkmark for user's vote
{poll.userVoted && (
  <View style={styles.votedIndicator}>
    <Icon name="check" color="#4CAF50" />
    <Text>You voted</Text>
  </View>
)}

// Highlight user's selected option
{poll.options.map((option, index) => {
  const isUserVote = poll.userVoteOptionId === option._id;
  return (
    <View
      style={[
        styles.option,
        isUserVote && styles.userVoteOption,
      ]}
    >
      {/* Option content */}
    </View>
  );
})}
```

### 3. Progress Bars for Results

```typescript
// Show progress bar with percentage
<View style={styles.progressContainer}>
  <View
    style={[
      styles.progressBar,
      { width: `${option.percentage}%` },
    ]}
  />
  <Text style={styles.percentage}>{option.percentage}%</Text>
</View>
```

### 4. Confirmation for Delete

```typescript
const handleDelete = (pollId: string) => {
  Alert.alert(
    "Delete Poll",
    "Are you sure you want to delete this poll? This action cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePoll(pollId);
            refresh();
          } catch (error) {
            Alert.alert("Error", "Failed to delete poll");
          }
        },
      },
    ]
  );
};
```

### 5. Loading States

```typescript
{loading ? (
  <ActivityIndicator size="large" />
) : (
  <FlatList data={polls} renderItem={...} />
)}
```

---

## Testing

### Test Cases

1. **Create Poll**

   - ✅ Valid poll with 2+ options
   - ✅ Multi-select poll
   - ✅ Poll with expiration date
   - ❌ Invalid: Less than 2 options
   - ❌ Invalid: Empty question
   - ❌ Invalid: Question too short

2. **Vote on Poll**

   - ✅ Single choice vote
   - ✅ Multi-select vote
   - ✅ Change vote (replace previous)
   - ❌ Invalid: Vote on closed poll
   - ❌ Invalid: Invalid option index

3. **Update Poll**

   - ✅ Creator can update their poll
   - ✅ Admin can update any poll
   - ❌ Other users cannot update
   - ❌ Invalid: Update closed poll

4. **Delete Poll**

   - ✅ Creator can delete their poll
   - ✅ Admin can delete any poll
   - ❌ Other users cannot delete

5. **List Polls**
   - ✅ Filter by status (all/open/closed)
   - ✅ Pagination works
   - ✅ Get user's own polls

---

## Summary

### Quick Reference

```typescript
// Create
POST /api/community/polls

// Read
GET /api/community/polls              // All polls
GET /api/community/polls/my           // User's polls
GET /api/community/polls/:id          // Single poll

// Vote
POST /api/community/polls/:id/vote    // Vote on poll

// Update (Creator/Admin)
PUT /api/community/polls/:id

// Delete (Creator/Admin)
DELETE /api/community/polls/:id
```

### Key Points

✅ **Users CAN create polls** - All authenticated users  
✅ **Users CAN vote** - All authenticated users  
✅ **Only creators can update/delete** - Ownership enforced  
✅ **Multi-select supported** - Single or multiple choices  
✅ **Expiration dates** - Optional closing dates  
✅ **Real-time results** - Vote counts and percentages  
✅ **Pagination** - Efficient list loading

---

## Support

For issues or questions:

- Check error messages in response
- Verify authentication token is valid
- Ensure poll ID format is correct (MongoDB ObjectId)
- Contact backend team for API issues

---

**Last Updated:** 2024-01-15  
**Version:** 1.0
