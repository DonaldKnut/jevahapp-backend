const mongoose = require("mongoose");
require("dotenv").config();

// Import compiled models
const { Forum } = require("../dist/models/forum.model");
const { User } = require("../dist/models/user.model");

// Default forum categories for a gospel/Christian community platform
const forumCategories = [
  {
    title: "Bible Study & Teaching",
    description: "Deep dive into scripture, biblical teachings, and theological discussions. Share insights, ask questions, and learn together from God's word.",
  },
  {
    title: "Prayer Requests",
    description: "Share prayer requests and lift up others in prayer. Post your needs, celebrate answered prayers, and support the community through intercession.",
  },
  {
    title: "Testimonies & Praise Reports",
    description: "Share what God has done in your life! Post testimonies, miracles, and praise reports to encourage and inspire others in their faith journey.",
  },
  {
    title: "Worship & Music",
    description: "Discuss worship songs, share favorite gospel music, talk about worship experiences, and discover new Christian artists and hymns.",
  },
  {
    title: "Youth & Young Adults",
    description: "A space for young people to discuss faith, relationships, career, identity, and navigating life as a Christian in today's world.",
  },
  {
    title: "Marriage & Relationships",
    description: "Biblical guidance on marriage, dating, family relationships, and building healthy connections based on Christian principles.",
  },
  {
    title: "Christian Living",
    description: "Practical discussions on living out your faith daily. Topics include work, finances, health, habits, and spiritual disciplines.",
  },
  {
    title: "Healing & Deliverance",
    description: "Share testimonies of healing, pray for physical and emotional healing, and discuss the power of God's healing in our lives.",
  },
  {
    title: "Discipleship & Growth",
    description: "Learn and grow together in your walk with Christ. Discuss spiritual disciplines, mentorship, and how to become more like Jesus.",
  },
  {
    title: "Evangelism & Outreach",
    description: "Share ideas, experiences, and encouragement for spreading the gospel. Discuss evangelism strategies and outreach opportunities.",
  },
  {
    title: "Church & Ministry",
    description: "Discuss church life, ministry involvement, leadership, serving, and being part of the body of Christ effectively.",
  },
  {
    title: "Questions & Answers",
    description: "Ask questions about faith, Christianity, the Bible, or Christian living. Get answers from the community and learn together.",
  },
  {
    title: "Fellowship & Community",
    description: "Connect with other believers, share life updates, celebrate milestones, and build genuine Christian community and friendship.",
  },
  {
    title: "Resources & Recommendations",
    description: "Share and discover Christian books, podcasts, sermons, apps, tools, and other resources that have helped you grow in faith.",
  },
  {
    title: "General Discussion",
    description: "Open forum for general Christian discussions, current events from a Christian perspective, and topics that don't fit other categories.",
  },
];

async function seedForumCategories() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to MongoDB");

    // Find or create admin user
    console.log("\n📋 Setting up admin user...");
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
      console.log("✅ Using existing admin user:", adminUser.email);
    }

    // Seed forum categories
    console.log("\n🌱 Seeding forum categories...");
    let createdCount = 0;
    let skippedCount = 0;

    for (const category of forumCategories) {
      // Check if category already exists (by title)
      const existing = await Forum.findOne({ 
        title: category.title 
      });

      if (existing) {
        console.log(`⏭️  Skipped: "${category.title}" (already exists)`);
        skippedCount++;
        continue;
      }

      // Create new forum category
      const forum = await Forum.create({
        title: category.title,
        description: category.description,
        createdBy: adminUser._id,
        isActive: true,
        postsCount: 0,
        participantsCount: 0,
      });

      console.log(`✅ Created: "${forum.title}"`);
      createdCount++;
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 Seeding Summary:");
    console.log(`   ✅ Created: ${createdCount} categories`);
    console.log(`   ⏭️  Skipped: ${skippedCount} categories (already exist)`);
    console.log(`   📝 Total: ${forumCategories.length} categories`);
    console.log("=".repeat(50));

    // Display all active forums
    const allForums = await Forum.find({ isActive: true })
      .populate("createdBy", "firstName lastName email")
      .sort({ createdAt: 1 });

    console.log("\n📚 All Active Forum Categories:");
    allForums.forEach((forum, index) => {
      console.log(`   ${index + 1}. ${forum.title}`);
      console.log(`      ${forum.description.substring(0, 60)}...`);
    });

    console.log("\n✅ Forum categories seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding forum categories:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the seeding function
seedForumCategories()
  .then(() => {
    console.log("\n🎉 Script completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Script failed:", error);
    process.exit(1);
  });

