const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Import compiled models
const { Poll } = require("../dist/models/poll.model");
const { User } = require("../dist/models/user.model");

// Read the JSON file from backend root directory
const jsonFilePath = path.join(__dirname, "../polls-seed-data.json");

// Set to true to delete all existing polls and reseed from scratch
const CLEAR_EXISTING_POLLS =
  process.argv.includes("--clear") || process.argv.includes("-c");

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
      console.log(
        `✅ Loaded ${seedData.polls.length} active polls and ${seedData.expiredPolls?.length || 0} expired polls from JSON file\n`
      );
    } catch (error) {
      console.error("❌ Error reading JSON file:", error.message);
      throw error;
    }

    // Find or create admin user for polls authored by admin
    console.log("📋 Setting up admin user...");
    let adminUser = await User.findOne({
      $or: [{ email: "admin@jevah.com" }, { role: "admin" }],
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

    // Clear existing polls if requested
    if (CLEAR_EXISTING_POLLS) {
      console.log("\n🗑️  Clearing all existing polls...");
      const deletedCount = await Poll.deleteMany({});
      console.log(`✅ Deleted ${deletedCount.deletedCount} existing polls\n`);
    }

    // Seed active polls
    console.log("🌱 Seeding polls...");
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const allPolls = [...seedData.polls, ...(seedData.expiredPolls || [])];

    for (const pollData of allPolls) {
      // Check if poll already exists (by question or title)
      const existing = await Poll.findOne({
        $or: [
          { question: pollData.question || pollData.title },
          { question: pollData.title || pollData.question },
        ],
      });

      // Extract option texts from the options array
      // Options in JSON are objects with {text, votesCount, percentage}
      // But we store them as strings in the database
      const optionTexts = pollData.options.map(opt => {
        if (typeof opt === "string") {
          // If it's already a string, check if it's generic (like "option 1", "option 2")
          const lowerOpt = opt.toLowerCase().trim();
          if (lowerOpt.match(/^option\s*\d+$/i)) {
            throw new Error(
              `Poll "${pollData.title || pollData.question}" has generic option name: "${opt}". Please use meaningful option names.`
            );
          }
          return opt;
        }
        // Validate option has text field
        if (!opt.text || typeof opt.text !== "string") {
          throw new Error(
            `Invalid option structure in poll "${pollData.title || pollData.question}": ${JSON.stringify(opt)}`
          );
        }
        // Validate it's not a generic option name
        const lowerText = opt.text.toLowerCase().trim();
        if (lowerText.match(/^option\s*\d+$/i)) {
          throw new Error(
            `Poll "${pollData.title || pollData.question}" has generic option name: "${opt.text}". Please use meaningful option names.`
          );
        }
        return opt.text;
      });

      // Validate minimum 2 options
      if (optionTexts.length < 2) {
        console.log(
          `⚠️  Skipped: "${(pollData.title || pollData.question).substring(0, 50)}..." (less than 2 options)`
        );
        skippedCount++;
        continue;
      }

      // Map expiresAt to closesAt (the model uses closesAt)
      const closesAt = pollData.expiresAt ? new Date(pollData.expiresAt) : null;

      // Validate date
      if (pollData.expiresAt && isNaN(new Date(pollData.expiresAt).getTime())) {
        console.log(
          `⚠️  Skipped: "${(pollData.title || pollData.question).substring(0, 50)}..." (invalid date)`
        );
        skippedCount++;
        continue;
      }

      if (existing) {
        // Update existing poll to ensure it has the correct structure
        existing.question = pollData.question || pollData.title;
        existing.description = pollData.description || undefined;
        existing.options = optionTexts;
        existing.multiSelect = pollData.multiSelect || false;
        existing.closesAt = closesAt;
        await existing.save();
        console.log(
          `🔄 Updated: "${(pollData.title || pollData.question).substring(0, 50)}..." (${optionTexts.length} options)`
        );
        updatedCount++;
      } else {
        // Create new poll
        const poll = await Poll.create({
          question: pollData.question || pollData.title,
          description: pollData.description || undefined,
          options: optionTexts, // Store as array of strings
          multiSelect: pollData.multiSelect || false,
          authorId: adminUser._id,
          votes: [], // Initialize with empty votes
          closesAt: closesAt, // Map expiresAt to closesAt
        });

        console.log(
          `✅ Created: "${(pollData.title || pollData.question).substring(0, 50)}..." (${optionTexts.length} options)`
        );
        createdCount++;
      }
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 Seeding Summary:");
    console.log(`   ✅ Created: ${createdCount} polls`);
    console.log(`   🔄 Updated: ${updatedCount} polls`);
    console.log(`   ⏭️  Skipped: ${skippedCount} polls`);
    console.log(`   📝 Total processed: ${allPolls.length} polls`);
    console.log("=".repeat(50));

    // Display recent polls with sample options
    const recentPolls = await Poll.find()
      .populate("authorId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(10);

    console.log("\n📋 Recent Polls (showing first 10):");
    recentPolls.forEach((poll, index) => {
      const sampleOptions = poll.options
        .slice(0, 2)
        .map(opt => `"${opt.substring(0, 30)}${opt.length > 30 ? "..." : ""}"`)
        .join(", ");
      console.log(
        `   ${index + 1}. ${poll.question.substring(0, 60)}${poll.question.length > 60 ? "..." : ""}`
      );
      console.log(
        `      Options (${poll.options.length}): ${sampleOptions}${poll.options.length > 2 ? "..." : ""}`
      );
      console.log(`      Votes: ${poll.votes.length}`);
    });

    // Get stats
    const totalPolls = await Poll.countDocuments();
    const totalVotes = await Poll.aggregate([
      { $project: { voteCount: { $size: "$votes" } } },
      { $group: { _id: null, total: { $sum: "$voteCount" } } },
    ]);
    const totalVotesCount = totalVotes[0]?.total || 0;

    console.log("\n📈 Poll Statistics:");
    console.log(`   Total Polls: ${totalPolls}`);
    console.log(`   Total Votes: ${totalVotesCount}`);
    console.log(
      `   Average Votes per Poll: ${totalPolls > 0 ? Math.round(totalVotesCount / totalPolls) : 0}`
    );

    // Validate that polls don't have generic option names
    const genericPolls = await Poll.find({
      $or: [
        { options: { $regex: /^option\s*[0-9]+$/i } },
        { options: { $regex: /^option\s*[0-9]+$/i } },
        { question: { $regex: /^option\s*[0-9]+$/i } },
      ],
    });

    if (genericPolls.length > 0) {
      console.log(
        `\n⚠️  Warning: Found ${genericPolls.length} polls with generic option names. Consider running with --clear flag to reseed.`
      );
    } else {
      console.log("\n✅ All polls have proper option names!");
    }

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
  .catch(error => {
    console.error("\n💥 Script failed:", error);
    process.exit(1);
  });
