/**
 * Migration script to fix existing Media documents with incorrect likeCount
 * Run this to sync Media.likeCount with actual Like collection counts
 */

const mongoose = require('mongoose');

async function fixExistingLikeCounts() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('Error: MONGODB_URI environment variable not set');
      console.log('Usage: MONGODB_URI=mongodb://... node fix-existing-like-counts.js');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const Media = mongoose.model('Media', new mongoose.Schema({
      title: String,
      likeCount: { type: Number, default: 0 }
    }));

    const Like = mongoose.model('Like', new mongoose.Schema({
      userId: mongoose.Schema.Types.ObjectId,
      contentId: mongoose.Schema.Types.ObjectId,
      contentType: String
    }));

    console.log('\n=== Syncing Media.likeCount with Like collection ===\n');

    // Get all media items
    const mediaItems = await Media.find({}, '_id title likeCount');
    console.log(`Found ${mediaItems.length} media items`);

    let fixedCount = 0;
    let alreadyCorrectCount = 0;

    for (const media of mediaItems) {
      // Count actual likes for this content
      const actualLikes = await Like.countDocuments({ 
        contentId: media._id 
      });

      if (media.likeCount !== actualLikes) {
        console.log(`Fixing: "${media.title}"`);
        console.log(`  Media.likeCount: ${media.likeCount} → ${actualLikes}`);
        
        await Media.updateOne(
          { _id: media._id },
          { $set: { likeCount: actualLikes } }
        );
        
        fixedCount++;
      } else {
        alreadyCorrectCount++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total media items: ${mediaItems.length}`);
    console.log(`Fixed: ${fixedCount}`);
    console.log(`Already correct: ${alreadyCorrectCount}`);
    console.log('\n✅ Migration complete!');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixExistingLikeCounts();
