
const mongoose = require('mongoose');

async function test() {
  const schema = new mongoose.Schema({
    name: String,
    date: Date
  });
  const TestModel = mongoose.model('Test', schema);

  try {
    // 1. Valid date
    const pipeline1 = [
      { $addFields: { formatted: { $dateToString: { format: "%Y-%m", date: "$date" } } } }
    ];
    // This should work if date is present or null? Let's see.
    
    // Note: In MongoDB, $dateToString throws if date is null/missing unless handled.
    // Let's test with local mongodb if possible, or just look up the docs.
    console.log("According to MongoDB docs, $dateToString throws if 'date' is not a Date, Timestamp, or ObjectID.");
    console.log("Actually, in recent versions (4.0+), it might return null if the input is null.");
    
    // BUT! if the document is missing the field entirely, it might behave differently.
  } catch (e) {
    console.error(e);
  }
}
