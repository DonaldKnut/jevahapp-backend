// MongoDB initialization script for Jevah application
// This script runs when the MongoDB container starts for the first time

// Switch to the jevah database
db = db.getSiblingDB('jevah');

// Create collections with proper indexes
print('Creating collections and indexes for Jevah application...');

// Users collection
db.createCollection('users');
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "clerkId": 1 }, { unique: true, sparse: true });
db.users.createIndex({ "role": 1 });
db.users.createIndex({ "section": 1 });
db.users.createIndex({ "isProfileComplete": 1 });
db.users.createIndex({ "createdAt": -1 });

// Media collection
db.createCollection('media');
db.media.createIndex({ "uploadedBy": 1 });
db.media.createIndex({ "contentType": 1 });
db.media.createIndex({ "category": 1 });
db.media.createIndex({ "topics": 1 });
db.media.createIndex({ "isLive": 1 });
db.media.createIndex({ "createdAt": -1 });
db.media.createIndex({ "viewCount": -1 });
db.media.createIndex({ "title": "text", "description": "text" });

// Comments collection
db.createCollection('comments');
db.comments.createIndex({ "mediaId": 1 });
db.comments.createIndex({ "userId": 1 });
db.comments.createIndex({ "parentCommentId": 1 });
db.comments.createIndex({ "createdAt": -1 });

// Interactions collection
db.createCollection('interactions');
db.interactions.createIndex({ "mediaId": 1 });
db.interactions.createIndex({ "userId": 1 });
db.interactions.createIndex({ "interactionType": 1 });
db.interactions.createIndex({ "createdAt": -1 });

// Live streams collection
db.createCollection('livestreams');
db.livestreams.createIndex({ "streamId": 1 }, { unique: true });
db.livestreams.createIndex({ "userId": 1 });
db.livestreams.createIndex({ "status": 1 });
db.livestreams.createIndex({ "scheduledStart": 1 });

// Recordings collection
db.createCollection('recordings');
db.recordings.createIndex({ "streamId": 1 });
db.recordings.createIndex({ "userId": 1 });
db.recordings.createIndex({ "status": 1 });
db.recordings.createIndex({ "createdAt": -1 });

// AI Chatbot messages collection
db.createCollection('chatbot_messages');
db.chatbot_messages.createIndex({ "userId": 1 });
db.chatbot_messages.createIndex({ "sessionId": 1 });
db.chatbot_messages.createIndex({ "createdAt": -1 });

// Trending analytics collection
db.createCollection('trending_analytics');
db.trending_analytics.createIndex({ "userId": 1 });
db.trending_analytics.createIndex({ "date": 1 });
db.trending_analytics.createIndex({ "type": 1 });

// User profiles collection
db.createCollection('user_profiles');
db.user_profiles.createIndex({ "userId": 1 }, { unique: true });
db.user_profiles.createIndex({ "role": 1 });
db.user_profiles.createIndex({ "location": 1 });

// Bookmarks collection
db.createCollection('bookmarks');
db.bookmarks.createIndex({ "userId": 1 });
db.bookmarks.createIndex({ "mediaId": 1 });
db.bookmarks.createIndex({ "createdAt": -1 });

// Notifications collection
db.createCollection('notifications');
db.notifications.createIndex({ "userId": 1 });
db.notifications.createIndex({ "isRead": 1 });
db.notifications.createIndex({ "createdAt": -1 });

// Sessions collection
db.createCollection('sessions');
db.sessions.createIndex({ "userId": 1 });
db.sessions.createIndex({ "token": 1 }, { unique: true });
db.sessions.createIndex({ "expiresAt": 1 });

// Logs collection
db.createCollection('logs');
db.logs.createIndex({ "level": 1 });
db.logs.createIndex({ "timestamp": -1 });
db.logs.createIndex({ "userId": 1 });

// Create admin user if not exists
const adminUser = db.users.findOne({ "email": "admin@jevah.com" });
if (!adminUser) {
    db.users.insertOne({
        firstName: "Admin",
        lastName: "User",
        email: "admin@jevah.com",
        role: "admin",
        section: "adults",
        isProfileComplete: true,
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
    });
    print('Admin user created successfully');
}

// Create default categories
const categories = [
    "worship",
    "inspiration", 
    "youth",
    "teachings",
    "marriage",
    "counselling"
];

// Create default topics
const topics = [
    "prayer",
    "faith",
    "family",
    "relationships",
    "healing",
    "forgiveness",
    "purpose",
    "leadership",
    "worship",
    "evangelism"
];

print('MongoDB initialization completed successfully!');
print('Collections created: users, media, comments, interactions, livestreams, recordings, chatbot_messages, trending_analytics, user_profiles, bookmarks, notifications, sessions, logs');
print('Indexes created for optimal query performance');
print('Admin user created: admin@jevah.com');
