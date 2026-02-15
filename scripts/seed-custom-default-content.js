const mongoose = require("mongoose");
require("dotenv").config();

const { Media } = require("../dist/models/media.model");
const { User } = require("../dist/models/user.model");

// Creator profiles to upsert (fallbackAvatar is used only if avatar is missing)
const creators = [
  {
    _id: new mongoose.Types.ObjectId("68aff175fde13033bed89d10"),
    firstName: "Prophet Ayo",
    lastName: "Jegede",
    email: "prophet.ayo.jegede@jevahapp.com",
    username: "prophet_ayo_jegede",
    role: "content_creator",
    isVerifiedCreator: true,
    fallbackAvatar:
      "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1758677253/jevah-hq_tcqmxl.jpg",
  },
  {
    _id: new mongoose.Types.ObjectId("68aff175fde13033bed89d11"),
    firstName: "Bishop David",
    lastName: "Oyedepo",
    email: "bishop.oyedepo@jevahapp.com",
    username: "bishop_david_oyedepo",
    role: "content_creator",
    isVerifiedCreator: true,
    fallbackAvatar:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-videos/62f61a86cec74b72ef009b551de6c754.jpg",
  },
  {
    _id: new mongoose.Types.ObjectId("68aff175fde13033bed89d12"),
    firstName: "Chandler",
    lastName: "Moore",
    email: "chandler.moore@jevahapp.com",
    username: "chandler_moore",
    role: "content_creator",
    isVerifiedCreator: true,
    fallbackAvatar:
      "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1758677253/jevah-hq_tcqmxl.jpg",
  },
  {
    _id: new mongoose.Types.ObjectId("68aff175fde13033bed89d13"),
    firstName: "Evangelist Godman",
    lastName: "Chuks",
    email: "evangelist.godman.chuks@jevahapp.com",
    username: "evangelist_godman_chuks",
    role: "content_creator",
    isVerifiedCreator: true,
    fallbackAvatar:
      "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1758677253/jevah-hq_tcqmxl.jpg",
  },
];

// Helper map for readability
const C = {
  ayo: creators[0]._id,
  oyedepo: creators[1]._id,
  chandler: creators[2]._id,
  godman: creators[3]._id,
};

// Default content items to upsert
const defaultContent = [
  // 1) Video song by Prophet Ayo Jegede
  {
    title: "JUGULAR JUGULAR",
    description:
      "This is a warrior chant! Every believer is called to rise above fear, oppression, and the lies of the enemy. We've been called to step boldly in the authority we’ve been given and crush everything that stands against the light of God's word. Jugular is the sound of victory, the sound of spiritual warfare, and the sound of a generation that refuses to bow. If you’ve ever felt surrounded, this is your reminder. You’re not fighting from defeat but from victory. Heaven backs you, fire surrounds you, and you have the power to overcome. Raise your voice. Take your stand. Break the jugular!!!",
    contentType: "videos",
    category: "worship",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-videos/JUGULAR%20JUGULAR%20-%20Lawrence%20Oyor%20ft%20Greatman%20Takit.mp4",
    fileMimeType: "video/mp4",
    thumbnailUrl:
      "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1758677253/jevah-hq_tcqmxl.jpg",
    topics: ["warfare", "worship", "victory", "christian"],
    uploadedBy: C.ayo,
    isDefaultContent: true,
    isOnboardingContent: true,
  },

  // 2) Sermon by Bishop David Oyedepo
  {
    title: "Winners Mantle",
    description:
      "🚨 Are you struggling to break through in life? Do you feel like you’re going in circles, praying and waiting for a change? Bishop David Oyedepo exposes the hidden key to unlocking your next level! Don’t let delayed obedience keep you from divine blessings—watch till the end and receive your turnaround!",
    contentType: "sermon",
    category: "teachings",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-videos/WHY%20MANY%20BELIEVERS%20REMAIN%20STAGNANT%20DESPITE%20PRAYERS!%20_%20BISHOP%20DAVID%20OYEDEPO.mp4",
    fileMimeType: "video/mp4",
    thumbnailUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-videos/62f61a86cec74b72ef009b551de6c754.jpg",
    topics: [
      "obedience",
      "breakthrough",
      "Winners Mantle",
      "sermon",
      "christian",
    ],
    uploadedBy: C.oyedepo,
    isDefaultContent: true,
    isOnboardingContent: true,
  },

  // 3) Video by Chandler Moore
  {
    title: "Omemma | Chandler Moore | Live In Los Angeles",
    description:
      'OMEMMA Always on time You can’t do no wrong OMEMMA Leave the ninety nine Always for the one and Official Music Video for "Omemma" By: Chandler Moore Listen to Chandler\'s new album Live In Los Angeles: https://chandlermoore.komi.io/music/c... "Omemma" was written by: Chandler Moore and Tim Godfrey',
    contentType: "videos",
    category: "worship",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-videos/1755589056172-h0dwmr4dw.mp4",
    fileMimeType: "video/mp4",
    thumbnailUrl:
      "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1758677253/jevah-hq_tcqmxl.jpg",
    topics: ["worship", "praise", "live", "videos"],
    uploadedBy: C.chandler,
    isDefaultContent: true,
    isOnboardingContent: true,
  },

  // 4) Sermon posted by Evangelist Godman Chuks
  {
    title:
      "YOU WILL TAKE FASTING & PRAYER SERIOUSLY AFTER HEARING THIS - POWER OF FASTING - APOSTLE AROME OSAYI",
    description:
      "The power of fasting and prayer that you need to know and listen to now. What does fasting and prayer do to you? These are what will happen as you engage in it. What an instructive message that shows the necessity of prayer and fasting. The way of the kingdom has been set for our advantage and one of the ways to take advantage of what belongs to us in the kingdom as a result of what Christ did is by continual fasting and prayer. Prayer and fasting help one to get bold in the things of God especially in the face of opposition. It weakens the power of the flesh which always lust against the spirit. The consciousness level of a Believer who gives himself to fasting and prayer is always at a heightened level - the more we engage in these spiritual activities, the more we are transformed and the more we have confidence and trust to do the will of God. It's as important as anything, a Believer must fast, pray, study the word, and fellowship with the brethren - these are the activities of God's kingdom - it's says this is the era of spiritual men. Men who will do the will of God, men who will put to nothing the power of darkness, and men who will stand for Jesus everywhere.",
    contentType: "sermon",
    category: "teachings",
    fileUrl:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-videos/YOU%20WILL%20TAKE%20FASTING%20%26%20PRAYER%20SERIOUSLY%20AFTER%20HEARING%20THIS%20-%20POWER%20OF%20FASTING%20-%20APOSTLE%20AROME%20OSAYI.mp4",
    fileMimeType: "video/mp4",
    thumbnailUrl:
      "https://res.cloudinary.com/ddgzzjp4x/image/upload/v1758677253/jevah-hq_tcqmxl.jpg",
    topics: ["fasting", "prayer", "discipleship", "sermon"],
    uploadedBy: C.godman,
    isDefaultContent: true,
    isOnboardingContent: true,
  },
];

async function upsertCreatorsWithFallback() {
  console.log("Upserting creator profiles (with fallback avatars)...");
  for (const c of creators) {
    // Ensure core profile exists
    await User.updateOne(
      { _id: c._id },
      {
        $set: {
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          provider: "email",
          role: c.role,
          isVerifiedCreator: true,
          username: c.username,
        },
      },
      { upsert: true }
    );

    // Only set avatar fields if currently missing/empty
    await User.updateOne(
      {
        _id: c._id,
        $or: [{ avatar: { $exists: false } }, { avatar: null }, { avatar: "" }],
      },
      { $set: { avatar: c.fallbackAvatar } }
    );

    await User.updateOne(
      {
        _id: c._id,
        $or: [
          { avatarUpload: { $exists: false } },
          { avatarUpload: null },
          { avatarUpload: "" },
        ],
      },
      { $set: { avatarUpload: c.fallbackAvatar } }
    );
  }
  console.log(`Creator profiles ready: ${creators.length}`);
}

async function upsertDefaultContent() {
  console.log("Upserting custom default media items by title...");
  let upsertedCount = 0;
  for (const item of defaultContent) {
    const res = await Media.updateOne(
      { title: item.title },
      { $set: item },
      { upsert: true }
    );
    // Count as upsert if inserted or modified
    if (
      (res.upsertedCount && res.upsertedCount > 0) ||
      (res.modifiedCount && res.modifiedCount > 0)
    ) {
      upsertedCount += 1;
    }
  }
  console.log(`Upserted ${upsertedCount} items (inserted or updated)`);
}

async function seedCustomDefaultContent() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    console.log("Connected to MongoDB");

    await upsertCreatorsWithFallback();
    await upsertDefaultContent();

    console.log("\n✅ Custom default content seeding completed successfully!");
  } catch (err) {
    console.error("Error seeding custom default content:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

// Run the seeder
if (require.main === module) {
  seedCustomDefaultContent();
}

module.exports = { seedCustomDefaultContent };
