/**
 * Migration: Move likes from MediaInteraction to Like collection
 * This ensures all likes use the same system going forward
 */

const mongoose = require('mongoose');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const MediaInteraction = mongoose.model('MediaInteraction', new mongoose.Schema({
      media: mongoose.Schema.Types.ObjectId,
      user: mongoose.Schema.Types.ObjectId,
      interactionType: String,
      isRemoved: Boolean,
      deletedAt: Date,
      createdAt: Date
    }));

    const Like = mongoose.model('Like', new mongoose.Schema({
      userId: mongoose.Schema.Types.ObjectId,
      contentId: mongoose.Schema.Types.ObjectId,
      contentType: { type: String, default: 'media' },
      createdAt: Date
    }));

    console.log('=== Migrating likes from MediaInteraction to Like collection ===\n');

    // Find all likes in MediaInteraction that aren't soft-deleted
    const oldLikes = await MediaInteraction.find({
      interactionType: 'like',
      isRemoved: { $ne: true },
      deletedAt: null
    });

    console.log(`Found ${oldLikes.length} likes in MediaInteraction`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const oldLike of oldLikes) {
      try {
        // Check if already migrated
        const exists = await Like.findOne({
          userId: oldLike.user,
          contentId: oldLike.media
        });

        if (exists) {
          skipped++;
          continue;
        }

        // Create in new collection
        await Like.create({
          userId: oldLike.user,
          contentId: oldLike.media,
          contentType: 'media',
          createdAt: oldLike.createdAt || new Date()
        });

        migrated++;
      } catch (err) {
        // Duplicate key error is ok - means already exists
        if (err.code === 11000) {
          skipped++;
        } else {
          console.error(`Error migrating like: ${err.message}`);
          errors++;
        }
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Total old likes: ${oldLikes.length}`);
    console.log(`Migrated: ${migrated}`);
    console.log(`Skipped (already exist): ${skipped}`);
    console.log(`Errors: ${errors}`);

    // Verify
    const newCount = await Like.countDocuments();
    console.log(`\nTotal likes in new collection: ${newCount}`);

    console.log('\n✅ Migration complete!');
    console.log('\nNOTE: You can now safely delete old likes from MediaInteraction if desired.');

    await mongoose.disconnect();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

migrate();
