const https = require("https");

async function testEnhancedAIFeatures() {
  console.log("🤖 Testing Enhanced AI Features with Bible Verses...\n");

  const options = {
    hostname: "localhost",
    port: 443,
    path: "/api/media/public/all-content",
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  };

  const req = https.request(options, res => {
    let data = "";

    res.on("data", chunk => {
      data += chunk;
    });

    res.on("end", () => {
      try {
        const response = JSON.parse(data);

        if (response.success && response.media) {
          console.log("✅ Successfully fetched enhanced content");
          console.log(`📊 Total items: ${response.total}`);
          console.log(`📋 Media items: ${response.media.length}\n`);

          // Analyze enhanced features
          const sampleItems = response.media.slice(0, 3);

          console.log("🔍 Enhanced AI Features Analysis:\n");

          sampleItems.forEach((item, index) => {
            console.log(`📋 Item ${index + 1}:`);
            console.log(`   Title: "${item.title}"`);
            console.log(
              `   Description: "${item.description || "No description"}"`
            );
            console.log(
              `   Enhanced Description: "${item.enhancedDescription || "No enhanced description"}"`
            );
            console.log(
              `   Bible Verses: ${item.bibleVerses ? item.bibleVerses.join(", ") : "No verses"}`
            );
            console.log(`   Author: ${item.authorInfo?.fullName || "Unknown"}`);
            console.log(`   Category: ${item.category || "N/A"}`);
            console.log(`   Type: ${item.contentType}`);
            console.log(`   Topics: ${item.topics?.join(", ") || "None"}`);
            console.log("");
          });

          // Count enhanced features
          const itemsWithDescriptions = response.media.filter(
            item => item.description && item.description.trim().length > 0
          );

          const itemsWithEnhancedDescriptions = response.media.filter(
            item =>
              item.enhancedDescription &&
              item.enhancedDescription.trim().length > 0
          );

          const itemsWithBibleVerses = response.media.filter(
            item => item.bibleVerses && item.bibleVerses.length > 0
          );

          console.log("📈 Enhanced Features Summary:");
          console.log("=".repeat(60));
          console.log(`Total Items: ${response.media.length}`);
          console.log(
            `Items with Descriptions: ${itemsWithDescriptions.length}`
          );
          console.log(
            `Items with Enhanced Descriptions: ${itemsWithEnhancedDescriptions.length}`
          );
          console.log(
            `Items with Bible Verses: ${itemsWithBibleVerses.length}`
          );
          console.log(
            `Description Coverage: ${((itemsWithDescriptions.length / response.media.length) * 100).toFixed(1)}%`
          );
          console.log(
            `Enhanced Description Coverage: ${((itemsWithEnhancedDescriptions.length / response.media.length) * 100).toFixed(1)}%`
          );
          console.log(
            `Bible Verses Coverage: ${((itemsWithBibleVerses.length / response.media.length) * 100).toFixed(1)}%`
          );

          // Analyze Bible verses
          console.log("\n📖 Bible Verses Analysis:");
          console.log("=".repeat(60));

          const allVerses = response.media
            .filter(item => item.bibleVerses && item.bibleVerses.length > 0)
            .flatMap(item => item.bibleVerses);

          const uniqueVerses = [...new Set(allVerses)];
          console.log(`Total Bible Verse References: ${allVerses.length}`);
          console.log(`Unique Bible Verses: ${uniqueVerses.length}`);

          if (uniqueVerses.length > 0) {
            console.log("\nTop Bible Verses:");
            const verseCounts = {};
            allVerses.forEach(verse => {
              verseCounts[verse] = (verseCounts[verse] || 0) + 1;
            });

            const sortedVerses = Object.entries(verseCounts)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5);

            sortedVerses.forEach(([verse, count]) => {
              console.log(`   ${verse}: ${count} times`);
            });
          }

          // Test specific examples
          console.log("\n🎯 Detailed Examples:");
          console.log("=".repeat(60));

          sampleItems.forEach((item, index) => {
            console.log(`\n📋 Example ${index + 1}: "${item.title}"`);
            console.log(
              `   👤 Author: ${item.authorInfo?.fullName || "Unknown"}`
            );
            console.log(`   📂 Category: ${item.category || "N/A"}`);
            console.log(`   🎯 Type: ${item.contentType}`);

            if (item.description) {
              console.log(`   📝 Description: "${item.description}"`);
              console.log(
                `   📏 Description Length: ${item.description.length} characters`
              );
            }

            if (item.enhancedDescription) {
              console.log(
                `   ✨ Enhanced Description: "${item.enhancedDescription}"`
              );
              console.log(
                `   📏 Enhanced Length: ${item.enhancedDescription.length} characters`
              );
            }

            if (item.bibleVerses && item.bibleVerses.length > 0) {
              console.log(
                `   📖 Bible Verses: ${item.bibleVerses.length} verses`
              );
              item.bibleVerses.forEach((verse, verseIndex) => {
                console.log(`      ${verseIndex + 1}. ${verse}`);
              });
            }
          });

          // Check for AI-generated content patterns
          console.log("\n🤖 AI Content Quality Check:");
          console.log("=".repeat(60));

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
            "divine wisdom",
            "through God's grace",
            "inspired by the Holy Spirit",
          ];

          let aiGeneratedCount = 0;
          response.media.forEach(item => {
            if (item.description) {
              const lowerDescription = item.description.toLowerCase();
              if (
                aiIndicators.some(indicator =>
                  lowerDescription.includes(indicator)
                )
              ) {
                aiGeneratedCount++;
              }
            }
          });

          console.log(
            `AI-Generated Content Detected: ${aiGeneratedCount}/${response.media.length} items`
          );
          console.log(
            `AI Generation Rate: ${((aiGeneratedCount / response.media.length) * 100).toFixed(1)}%`
          );
        } else {
          console.log("❌ Failed to fetch enhanced content");
          console.log("Response:", response);
        }
      } catch (error) {
        console.error("❌ Error parsing response:", error.message);
      }
    });
  });

  req.on("error", error => {
    console.error("❌ Request error:", error.message);
  });

  req.end();
}

testEnhancedAIFeatures();
