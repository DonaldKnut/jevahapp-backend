const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const MediaInteraction = mongoose.model('MediaInteraction', new mongoose.Schema({
    media: mongoose.Schema.Types.ObjectId,
    user: mongoose.Schema.Types.ObjectId,
    interactionType: String,
    isRemoved: Boolean,
    deletedAt: Date
  }));
  
  // Check for likes (not soft deleted)
  const count = await MediaInteraction.countDocuments({ 
    interactionType: 'like',
    $or: [
      { isRemoved: false },
      { isRemoved: { $exists: false } },
      { deletedAt: null }
    ]
  });
  
  console.log('Total active likes in MediaInteraction:', count);
  
  if (count > 0) {
    const sample = await MediaInteraction.findOne({ interactionType: 'like' });
    console.log('Sample like:', JSON.stringify(sample, null, 2));
    
    // Get likes per media
    const likesByMedia = await MediaInteraction.aggregate([
      { $match: { interactionType: 'like', isRemoved: { $ne: true } } },
      { $group: { _id: '$media', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\nLikes per media:');
    likesByMedia.forEach(item => {
      console.log(`  ${item._id}: ${item.count} likes`);
    });
  }
  
  await mongoose.disconnect();
}

check();
