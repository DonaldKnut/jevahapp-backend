const mongoose = require('mongoose');

async function diagnose() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const Media = mongoose.model('Media', new mongoose.Schema({ 
    title: String, 
    likeCount: Number 
  }));
  
  const Like = mongoose.model('Like', new mongoose.Schema({ 
    contentId: mongoose.Schema.Types.ObjectId 
  }));
  
  console.log('=== Current State ===\n');
  
  // Check Media items
  const media = await Media.find({}, 'title likeCount');
  console.log('Media items with like counts:');
  media.forEach(m => console.log(`  ${m.title}: ${m.likeCount} likes`));
  
  // Check Like collection
  const totalLikes = await Like.countDocuments();
  console.log(`\nTotal documents in Like collection: ${totalLikes}`);
  
  // Check for negative counts
  const negative = await Media.countDocuments({ likeCount: { $lt: 0 } });
  console.log(`Media with negative likeCount: ${negative}`);
  
  // Check for null/undefined counts
  const nullCounts = await Media.countDocuments({ likeCount: null });
  console.log(`Media with null likeCount: ${nullCounts}`);
  
  await mongoose.disconnect();
}

diagnose();
