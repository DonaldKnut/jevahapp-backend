
const mongoose = require('mongoose');
require('dotenv').config();

// Define Schemas to match the app
const mediaSchema = new mongoose.Schema({
  title: String,
  description: String,
  contentType: String,
  category: String,
  uploadedBy: mongoose.Schema.Types.ObjectId,
  moderationStatus: { type: String, default: 'pending' },
  isHidden: { type: Boolean, default: false },
  likeCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'media' });

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  avatar: String,
  role: String
}, { collection: 'users' });

const Media = mongoose.model('Media', mediaSchema);
const User = mongoose.model('User', userSchema);

async function diagnose() {
  console.log('🔍 Starting Diagnostics...');
  
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment variables.');
    return;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // 1. Check if Media collection exists and has documents
    const mediaCount = await Media.countDocuments();
    console.log(`📊 Media count: ${mediaCount}`);

    // 2. Check for approved content
    const approvedCount = await Media.countDocuments({ 
        moderationStatus: 'approved',
        isHidden: { $ne: true } 
    });
    console.log(`📊 Approved/Visible media count: ${approvedCount}`);

    // 3. Test the exact aggregation pipeline
    console.log('🧪 Testing aggregation pipeline...');
    
    const matchQuery = {
      isHidden: { $ne: true },
      moderationStatus: "approved",
    };

    const sortObj = { createdAt: -1 };
    
    const pipeline = [
        { $match: matchQuery },
        {
          $lookup: {
            from: "users",
            localField: "uploadedBy",
            foreignField: "_id",
            as: "author",
          },
        },
        // The service uses $unwind: "$author", which might fail if no author is found
        // unless it's handled. But wait, if uploadedBy is null or missing, it might cause issues.
        { $unwind: "$author" },
        {
          $addFields: {
            totalLikes: { $ifNull: ["$likeCount", 0] },
            totalShares: { $ifNull: ["$shareCount", 0] },
            totalViews: { $ifNull: ["$viewCount", 0] },
            authorInfo: {
              _id: "$author._id",
              firstName: "$author.firstName",
              lastName: "$author.lastName",
              fullName: {
                $concat: [
                  { $ifNull: ["$author.firstName", ""] },
                  " ",
                  { $ifNull: ["$author.lastName", ""] },
                ],
              },
              avatar: "$author.avatar",
              section: "$author.section",
            },
            formattedCreatedAt: {
              $dateToString: {
                format: "%Y-%m-%dT%H:%M:%S.%LZ",
                date: "$createdAt",
              },
            },
            thumbnail: "$thumbnailUrl",
            videoUrl: {
              $cond: {
                if: { $ne: ["$fileUrl", null] },
                then: "$fileUrl",
                else: {
                  $cond: {
                    if: { $ne: ["$playbackUrl", null] },
                    then: "$playbackUrl",
                    else: "$hlsUrl",
                  },
                },
              },
            },
          },
        },
        {
          $project: {
            _id: 1,
            id: "$_id",
            title: 1,
            description: 1,
            contentType: 1,
            category: 1,
            fileUrl: 1,
            playbackUrl: 1,
            hlsUrl: 1,
            thumbnailUrl: 1,
            imageUrl: "$coverImageUrl",
            topics: 1,
            duration: 1,
            fileSize: 1,
            width: 1,
            height: 1,
            bitrate: 1,
            authorInfo: 1,
            uploadedBy: 1,
            totalLikes: 1,
            totalShares: 1,
            totalViews: 1,
            likeCount: 1,
            shareCount: 1,
            viewCount: 1,
            commentCount: 1,
            createdAt: 1,
            formattedCreatedAt: 1,
            updatedAt: 1,
            thumbnail: 1,
            videoUrl: 1,
          },
        },
        { $sort: sortObj },
        { $limit: 10 }
    ];

    try {
      const result = await Media.aggregate(pipeline);
      console.log(`✅ Aggregation successful. Found ${result.length} items.`);
    } catch (aggError) {
      console.error('❌ Aggregation FAILED:', aggError);
    }

    // 4. Check for orphaned media (no uploader)
    const orphanedMediaCount = await Media.countDocuments({
        uploadedBy: { $exists: false }
    });
    console.log(`📊 Orphaned media (no uploadedBy field): ${orphanedMediaCount}`);

    // 5. Check if any media has uploadedBy that doesn't exist in users
    // This is hard with just Mongoose, but we can check if any uploadedBy is not an ObjectId
    const invalidUploaders = await Media.find({
        uploadedBy: { $not: { $type: "objectId" } }
    }).limit(5);
    console.log(`📊 Media with non-ObjectId uploadedBy count: ${invalidUploaders.length}`);

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

diagnose();
