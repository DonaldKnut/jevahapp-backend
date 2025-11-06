const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Import compiled models
const { Poll } = require("../dist/models/poll.model");
const { User } = require("../dist/models/user.model");

// Read the JSON file from frontend directory
const jsonFilePath = path.join(__dirname, "../../jevahapp_frontend/backend-seeding-data/polls-seed-data.json");

async function seedPolls() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to MongoDB\n");

    // Read JSON file
    console.log("📖 Reading polls seed data from JSON file...");
    let seedData;
    try {
      const jsonData = fs.readFileSync(jsonFilePath, "utf8");
      seedData = JSON.parse(jsonData);
      console.log(`✅ Loaded ${seedData.polls.length} active polls and ${seedData.expiredPolls?.length || 0} expired polls from JSON file\n`);
    } catch (error) {
      console.error("❌ Error reading JSON file:", error.message);
      throw error;
    }

    // Find or create admin user for polls authored by admin
    console.log("📋 Setting up admin user...");
    let adminUser = await User.findOne({ 
      $or: [
        { email: "admin@jevah.com" },
        { role: "admin" }
      ]
    });

    if (!adminUser) {
      // Create admin user if doesn't exist
      adminUser = await User.create({
        firstName: "Admin",
        lastName: "User",
        email: "admin@jevah.com",
        username: "jevah_admin",
        role: "admin",
        password: "TempPassword123!", // Should be changed after first login
        isEmailVerified: true,
        isProfileComplete: true,
      });
      console.log("✅ Created admin user:", adminUser.email);
    } else {
      console.log(`✅ Using existing admin user: ${adminUser.email}`);
    }

    // Seed active polls
    console.log("\n🌱 Seeding active polls...");
    let createdCount = 0;
    let skippedCount = 0;

    const allPolls = [...seedData.polls, ...(seedData.expiredPolls || [])];

    for (const pollData of allPolls) {
      // Check if poll already exists (by question or title)
      const existing = await Poll.findOne({ 
        $or: [
          { question: pollData.question || pollData.title },
          { question: pollData.title || pollData.question }
        ]
      });

      if (existing) {
        console.log(`⏭️  Skipped: "${(pollData.title || pollData.question).substring(0, 50)}..." (already exists)`);
        skippedCount++;
        continue;
      }

      // Extract option texts from the options array
      // Options in JSON are objects with {text, votesCount, percentage}
      // But we store them as strings in the database
      const optionTexts = pollData.options.map(opt => 
        typeof opt === "string" ? opt : opt.text
      );

      // Map expiresAt to closesAt (the model uses closesAt)
      const closesAt = pollData.expiresAt ? new Date(pollData.expiresAt) : null;

      // Create new poll
      const poll = await Poll.create({
        question: pollData.question || pollData.title,
        options: optionTexts, // Store as array of strings
        multiSelect: pollData.multiSelect || false,
        authorId: adminUser._id,
        votes: [], // Initialize with empty votes
        closesAt: closesAt, // Map expiresAt to closesAt
      });

      console.log(`✅ Created: "${(pollData.title || pollData.question).substring(0, 50)}..." (${optionTexts.length} options)`);
      createdCount++;
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 Seeding Summary:");
    console.log(`   ✅ Created: ${createdCount} polls`);
    console.log(`   ⏭️  Skipped: ${skippedCount} polls (already exist)`);
    console.log(`   📝 Total processed: ${allPolls.length} polls`);
    console.log("=".repeat(50));

    // Display recent polls
    const recentPolls = await Poll.find()
      .populate("authorId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(10);

    console.log("\n📋 Recent Polls (showing first 10):");
    recentPolls.forEach((poll, index) => {
      console.log(`   ${index + 1}. ${poll.question.substring(0, 60)}...`);
      console.log(`      Options: ${poll.options.length} | Votes: ${poll.votes.length}`);
    });

    // Get stats
    const totalPolls = await Poll.countDocuments();
    const totalVotes = await Poll.aggregate([
      { $project: { voteCount: { $size: "$votes" } } },
      { $group: { _id: null, total: { $sum: "$voteCount" } } }
    ]);
    const totalVotesCount = totalVotes[0]?.total || 0;

    console.log("\n📈 Poll Statistics:");
    console.log(`   Total Polls: ${totalPolls}`);
    console.log(`   Total Votes: ${totalVotesCount}`);
    console.log(`   Average Votes per Poll: ${totalPolls > 0 ? Math.round(totalVotesCount / totalPolls) : 0}`);

    console.log("\n✅ Polls seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding polls:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the seeding function
seedPolls()
  .then(() => {
    console.log("\n🎉 Script completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Script failed:", error);
    process.exit(1);
  });
