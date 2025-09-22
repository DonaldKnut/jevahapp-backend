const axios = require("axios");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const API_URL = `${BASE_URL}/api/media/public/all-content`;

async function testAIContentDescriptions() {
  console.log("🧪 Testing AI Content Description Generation...\n");

  try {
    console.log("📡 Fetching all content from endpoint...");
    const response = await axios.get(API_URL);

    if (response.data.success) {
      console.log("✅ Successfully fetched content");
      console.log(`📊 Total items: ${response.data.total}`);
      console.log(`📋 Media items: ${response.data.media.length}\n`);

      // Analyze descriptions
      const mediaItems = response.data.media;
      let itemsWithDescriptions = 0;
      let itemsWithoutDescriptions = 0;
      let itemsWithAIDescriptions = 0;

      console.log("🔍 Analyzing descriptions:\n");

      mediaItems.forEach((item, index) => {
        const hasDescription =
          item.description && item.description.trim().length > 0;

        if (hasDescription) {
          itemsWithDescriptions++;

          // Check if it looks like an AI-generated description
          const isAIDescription = isLikelyAIDescription(item.description);
          if (isAIDescription) {
            itemsWithAIDescriptions++;
          }

          console.log(`✅ Item ${index + 1}: "${item.title}"`);
          console.log(`   📝 Description: "${item.description}"`);
          console.log(`   🤖 AI Generated: ${isAIDescription ? "Yes" : "No"}`);
          console.log(
            `   👤 Author: ${item.authorInfo?.fullName || "Unknown"}`
          );
          console.log(`   📂 Category: ${item.category || "N/A"}`);
          console.log(`   🎯 Type: ${item.contentType}`);
          console.log("");
        } else {
          itemsWithoutDescriptions++;
          console.log(`❌ Item ${index + 1}: "${item.title}" - NO DESCRIPTION`);
          console.log(
            `   👤 Author: ${item.authorInfo?.fullName || "Unknown"}`
          );
          console.log(`   📂 Category: ${item.category || "N/A"}`);
          console.log(`   🎯 Type: ${item.contentType}`);
          console.log("");
        }
      });

      // Summary
      console.log("📈 SUMMARY:");
      console.log("=".repeat(50));
      console.log(`Total Items: ${mediaItems.length}`);
      console.log(`Items with Descriptions: ${itemsWithDescriptions}`);
      console.log(`Items without Descriptions: ${itemsWithoutDescriptions}`);
      console.log(`Items with AI Descriptions: ${itemsWithAIDescriptions}`);
      console.log(
        `Items with Manual Descriptions: ${itemsWithDescriptions - itemsWithAIDescriptions}`
      );
      console.log(
        `Coverage: ${((itemsWithDescriptions / mediaItems.length) * 100).toFixed(1)}%`
      );
      console.log(
        `AI Enhancement Rate: ${((itemsWithAIDescriptions / mediaItems.length) * 100).toFixed(1)}%`
      );

      // Test specific examples
      console.log("\n🎯 Testing Specific Examples:");
      console.log("=".repeat(50));

      const sampleItems = mediaItems.slice(0, 3);
      sampleItems.forEach((item, index) => {
        console.log(`\n📋 Example ${index + 1}:`);
        console.log(`Title: "${item.title}"`);
        console.log(`Description: "${item.description || "No description"}"`);
        console.log(`Author: ${item.authorInfo?.fullName || "Unknown"}`);
        console.log(`Category: ${item.category || "N/A"}`);
        console.log(`Type: ${item.contentType}`);
        console.log(`Topics: ${item.topics?.join(", ") || "None"}`);
      });
    } else {
      console.log("❌ Failed to fetch content");
      console.log("Response:", response.data);
    }
  } catch (error) {
    console.error("❌ Error testing AI content descriptions:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

function isLikelyAIDescription(description) {
  if (!description) return false;

  const aiIndicators = [
    "will uplift your spirit",
    "strengthen your faith",
    "spiritual journey",
    "connect with God",
    "biblical wisdom",
    "spiritual growth",
    "worship experience",
    "encourage and inspire",
    "bless and encourage",
    "faith journey",
    "spiritual benefits",
    "biblical insights",
  ];

  const lowerDescription = description.toLowerCase();
  return aiIndicators.some(indicator => lowerDescription.includes(indicator));
}

// Run the test
testAIContentDescriptions().catch(console.error);
