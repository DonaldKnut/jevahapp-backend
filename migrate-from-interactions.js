/**
 * Migration script to sync Media.likeCount from MediaInteraction collection
 * The old code used MediaInteraction, new code uses Like collection
 */

const mongoose = require('mongoose');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const Media = mongoose.model('Media', new mongoose.Schema({
      title: String,
      likeCount: { type: Number, default: 0 }
    }));

    const MediaInteraction = mongoose.model('MediaInteraction', new mongoose.Schema({
      media: mongoose.Schema.Types.ObjectId,
      user: mongoose.Schema.Types.ObjectId,
      interactionType: String,
      isRemoved: Boolean,
      deletedAt: Date
    }));

    console.log('=== Syncing Media.likeCount from MediaInteraction ===\n');

    // Get all media items
    const mediaItems = await Media.find({}, '_id title likeCount');
    console.log(`Found ${mediaItems.length} media items\n`);

    let fixedCount = 0;
    let alreadyCorrectCount = 0;
    let totalLikes = 0;

    for (const media of mediaItems) {
      // Count likes from MediaInteraction (old collection)
      const actualLikes = await MediaInteraction.countDocuments({
        media: media._id,
        interactionType: 'like',
        $or: [
          { isRemoved: false },
          { isRemoved: { $exists: false } }
        ],
        $or: [
          { deletedAt: null },
          { deletedAt: { $exists: false } }
        ]
      });

      totalLikes += actualLikes;

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
    console.log(`Total likes across all content: ${totalLikes}`);
    console.log('\n✅ Migration complete!');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

migrate();
