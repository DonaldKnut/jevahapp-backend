/**
 * Diagnostic script to verify like count fix
 * Run this to check if the backend is correctly updating Media.likeCount
 */

const mongoose = require('mongoose');

async function testLikeCount() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jevahapp');
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

    // Find the content
    const contentId = '69a1ad9a1c15f8b0841221d3'; // The Crucifixion video
    const media = await Media.findById(contentId);
    
    if (!media) {
      console.log('Media not found');
      return;
    }

    console.log('\n=== Current State ===');
    console.log('Title:', media.title);
    console.log('Media.likeCount:', media.likeCount);

    // Count actual likes in Like collection
    const actualLikes = await Like.countDocuments({ contentId: new mongoose.Types.ObjectId(contentId) });
    console.log('Actual likes in Like collection:', actualLikes);

    if (media.likeCount !== actualLikes) {
      console.log('\n❌ MISMATCH DETECTED!');
      console.log(`Media.likeCount (${media.likeCount}) !== Like count (${actualLikes})`);
      console.log('\nFix: Updating Media.likeCount to match actual likes...');
      
      await Media.updateOne(
        { _id: contentId },
        { $set: { likeCount: actualLikes } }
      );
      
      console.log('✅ Fixed! Media.likeCount updated to:', actualLikes);
    } else {
      console.log('\n✅ Counts match correctly');
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testLikeCount();
