/**
 * Resync Media.likeCount from Like collection
 * This ensures the Media collection matches the Like collection
 */

const mongoose = require('mongoose');

async function resync() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const Media = mongoose.model('Media', new mongoose.Schema({
      title: String,
      likeCount: { type: Number, default: 0 }
    }));

    const Like = mongoose.model('Like', new mongoose.Schema({
      userId: mongoose.Schema.Types.ObjectId,
      contentId: mongoose.Schema.Types.ObjectId,
      contentType: String
    }));

    console.log('=== Resyncing Media.likeCount from Like collection ===\n');

    // Get all unique content IDs from Like collection
    const contentIds = await Like.distinct('contentId');
    console.log(`Found likes for ${contentIds.length} unique content items\n`);

    let updated = 0;
    for (const contentId of contentIds) {
      // Count likes for this content in Like collection
      const likeCount = await Like.countDocuments({ contentId });
      
      // Update Media collection
      const result = await Media.updateOne(
        { _id: contentId },
        { $set: { likeCount } }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`Updated ${contentId}: ${likeCount} likes`);
        updated++;
      }
    }

    console.log(`\n✅ Resync complete! Updated ${updated} media items`);

    // Verify a few samples
    console.log('\n=== Verification ===');
    const sampleMedia = await Media.find({ likeCount: { $gt: 0 } }, '_id likeCount').limit(5);
    sampleMedia.forEach(m => {
      console.log(`${m._id}: ${m.likeCount} likes`);
    });

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

resync();
