const mongoose = require("mongoose");
require("dotenv").config();

// Import compiled models
const { Poll } = require("../dist/models/poll.model");
const { User } = require("../dist/models/user.model");

// Default polls for a gospel/Christian community platform
const defaultPolls = [
  {
    question: "What is your favorite way to worship God?",
    options: [
      "Through music and singing",
      "Through prayer and meditation",
      "Through reading the Bible",
      "Through serving others",
      "Through fellowship with believers",
      "Through nature and creation"
    ],
    multiSelect: false,
    description: "Share your preferred method of worshiping and connecting with God.",
  },
  {
    question: "Which spiritual discipline do you practice most regularly?",
    options: [
      "Daily Bible reading",
      "Prayer",
      "Fasting",
      "Worship/Singing",
      "Service/Volunteering",
      "Fellowship",
      "Meditation",
      "Tithing/Giving"
    ],
    multiSelect: true,
    description: "Select all spiritual disciplines you practice regularly.",
  },
  {
    question: "How often do you attend church services?",
    options: [
      "Multiple times per week",
      "Once a week (Sunday)",
      "2-3 times per month",
      "Once a month",
      "Rarely",
      "I don't attend church"
    ],
    multiSelect: false,
    description: "Help us understand church attendance patterns in our community.",
  },
  {
    question: "What challenges do you face in your Christian walk? (Select all that apply)",
    options: [
      "Finding time for prayer and Bible study",
      "Dealing with sin and temptation",
      "Maintaining faith during trials",
      "Finding Christian community",
      "Sharing my faith with others",
      "Understanding the Bible",
      "Balancing faith with work/school",
      "Dealing with doubt and questions"
    ],
    multiSelect: true,
    description: "Share the challenges you face so we can support each other better.",
  },
  {
    question: "What type of Christian content do you consume most?",
    options: [
      "Gospel music",
      "Sermons/Preaching",
      "Christian books",
      "Devotionals",
      "Christian podcasts",
      "Bible study videos",
      "Christian movies/films",
      "Testimonies"
    ],
    multiSelect: true,
    description: "Help us understand what content resonates most with our community.",
  },
  {
    question: "How long have you been a Christian?",
    options: [
      "Less than 1 year",
      "1-3 years",
      "3-5 years",
      "5-10 years",
      "10-20 years",
      "More than 20 years",
      "I'm exploring Christianity"
    ],
    multiSelect: false,
    description: "Share your journey length to help us serve you better.",
  },
  {
    question: "What role does prayer play in your daily life?",
    options: [
      "I pray multiple times daily",
      "I pray once daily",
      "I pray a few times per week",
      "I pray occasionally",
      "I rarely pray",
      "I'm learning to pray"
    ],
    multiSelect: false,
    description: "Understanding prayer habits helps us create better resources.",
  },
  {
    question: "What topics would you like to see more content about?",
    options: [
      "Bible study and interpretation",
      "Prayer and spiritual warfare",
      "Relationships and dating",
      "Marriage and family",
      "Career and finances",
      "Mental health and emotional wellness",
      "Evangelism and outreach",
      "Worship and music",
      "Healing and deliverance",
      "Discipleship and growth"
    ],
    multiSelect: true,
    description: "Your input helps us create content that matters to you.",
  },
  {
    question: "How do you prefer to engage with the Christian community?",
    options: [
      "In-person church services",
      "Online services and streaming",
      "Small groups/Bible studies",
      "Social media and forums",
      "One-on-one mentorship",
      "Volunteer and service opportunities",
      "Christian events and conferences",
      "Through apps like Jevah"
    ],
    multiSelect: true,
    description: "Help us understand how you connect with the body of Christ.",
  },
  {
    question: "What is your biggest concern about the Church today?",
    options: [
      "Lack of authenticity",
      "Division and denominational conflicts",
      "Lack of outreach/evangelism",
      "Not addressing real-world issues",
      "Lack of youth engagement",
      "Financial transparency",
      "Leadership accountability",
      "Cultural relevance",
      "None - I'm satisfied with the Church"
    ],
    multiSelect: false,
    description: "Share your concerns so we can pray and work toward solutions.",
  },
  {
    question: "How do you share your faith with others?",
    options: [
      "Through personal conversations",
      "Social media posts",
      "Inviting people to church",
      "Living by example",
      "Sharing testimonies",
      "Mission work/outreach",
      "I don't share my faith",
      "I want to learn how to share"
    ],
    multiSelect: true,
    description: "Understanding evangelism methods helps us equip believers better.",
  },
  {
    question: "What time of day do you prefer to have your quiet time with God?",
    options: [
      "Early morning (5-7 AM)",
      "Morning (7-9 AM)",
      "Midday (12-2 PM)",
      "Afternoon (2-5 PM)",
      "Evening (5-8 PM)",
      "Night (8 PM+)",
      "I don't have a regular quiet time"
    ],
    multiSelect: false,
    description: "Help us understand when believers are most active spiritually.",
  },
  {
    question: "Which area of your life do you need the most prayer support for?",
    options: [
      "Family relationships",
      "Career and finances",
      "Health and healing",
      "Spiritual growth",
      "Relationships and dating",
      "Mental and emotional health",
      "Ministry and calling",
      "Overcoming sin and temptation",
      "Direction and guidance",
      "Peace and rest"
    ],
    multiSelect: true,
    description: "Share your prayer needs so we can support you in prayer.",
  },
  {
    question: "How would you rate your current Bible reading habit?",
    options: [
      "Daily - I read the Bible every day",
      "Regularly - 4-5 times per week",
      "Occasionally - 2-3 times per week",
      "Rarely - Once a week or less",
      "I want to start reading the Bible",
      "I struggle with Bible reading"
    ],
    multiSelect: false,
    description: "Understanding Bible reading habits helps us provide better resources.",
  },
  {
    question: "What would encourage you to be more active in your faith community?",
    options: [
      "More relevant teaching topics",
      "Better small group opportunities",
      "More fellowship events",
      "Clearer ways to serve",
      "Better communication from leadership",
      "More opportunities to use my gifts",
      "More welcoming atmosphere",
      "I'm already very active"
    ],
    multiSelect: true,
    description: "Your feedback helps us create a more engaging community.",
  },
];

async function seedPolls() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("✅ Connected to MongoDB");

    // Find or create admin user for polls authored by admin
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

    // Seed polls
    console.log("\n🌱 Seeding polls...");
    let createdCount = 0;
    let skippedCount = 0;

    for (const pollData of defaultPolls) {
      // Check if poll already exists (by question)
      const existing = await Poll.findOne({ 
        question: pollData.question 
      });

      if (existing) {
        console.log(`⏭️  Skipped: "${pollData.question.substring(0, 50)}..." (already exists)`);
        skippedCount++;
        continue;
      }

      // Create new poll
      const poll = await Poll.create({
        question: pollData.question,
        options: pollData.options,
        multiSelect: pollData.multiSelect || false,
        authorId: adminUser._id,
        votes: [],
        closesAt: undefined, // Open-ended polls
      });

      console.log(`✅ Created: "${poll.question.substring(0, 50)}..."`);
      createdCount++;
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 Seeding Summary:");
    console.log(`   ✅ Created: ${createdCount} polls`);
    console.log(`   ⏭️  Skipped: ${skippedCount} polls (already exist)`);
    console.log(`   📝 Total: ${defaultPolls.length} polls`);
    console.log("=".repeat(50));

    // Display all polls
    const allPolls = await Poll.find()
      .populate("authorId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(10);

    console.log("\n📋 Recent Polls (showing first 10):");
    allPolls.forEach((poll, index) => {
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

