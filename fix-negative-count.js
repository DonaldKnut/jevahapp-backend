const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const Media = mongoose.model('Media', new mongoose.Schema({
    title: String,
    likeCount: Number
  }));

  // Fix negative like counts
  const result = await Media.updateMany(
    { likeCount: { $lt: 0 } },
    { $set: { likeCount: 0 } }
  );

  console.log(`Fixed ${result.modifiedCount} media items with negative like counts`);
  
  await mongoose.disconnect();
}

fix();
