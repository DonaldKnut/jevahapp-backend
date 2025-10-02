const axios = require("axios");

// Test configuration
const BASE_URL = "http://localhost:3000"; // Change to your server URL

async function testBibleFactsAPI() {
  console.log("📖 Testing Bible Facts API...\n");

  try {
    // Test 1: Get random Bible fact
    console.log("1️⃣ Testing random Bible fact...");
    try {
      const randomResponse = await axios.get(`${BASE_URL}/api/bible-facts/random`);

      if (randomResponse.data.success) {
        console.log("✅ Random Bible fact retrieved successfully:");
        console.log(`   📖 Title: ${randomResponse.data.data.title}`);
        console.log(`   💡 Fact: ${randomResponse.data.data.fact}`);
        console.log(`   📜 Scripture: ${randomResponse.data.data.scripture}`);
        console.log(`   🏷️ Category: ${randomResponse.data.data.category}`);
        console.log(`   📚 Difficulty: ${randomResponse.data.data.difficulty}`);
      } else {
        console.log("❌ Failed to get random Bible fact");
      }
    } catch (error) {
      console.log(
        "❌ Random Bible fact error:",
        error.response?.data?.message || error.message
      );
    }

    // Test 2: Get daily Bible fact
    console.log("\n2️⃣ Testing daily Bible fact...");
    try {
      const dailyResponse = await axios.get(`${BASE_URL}/api/bible-facts/daily`);

      if (dailyResponse.data.success) {
        console.log("✅ Daily Bible fact retrieved successfully:");
        console.log(`   📖 Title: ${dailyResponse.data.data.title}`);
        console.log(`   💡 Fact: ${dailyResponse.data.data.fact}`);
        console.log(`   📜 Scripture: ${dailyResponse.data.data.scripture}`);
      } else {
        console.log("❌ Failed to get daily Bible fact");
      }
    } catch (error) {
      console.log(
        "❌ Daily Bible fact error:",
        error.response?.data?.message || error.message
      );
    }

    // Test 3: Get Bible facts by category
    console.log("\n3️⃣ Testing Bible facts by category...");
    const categories = ["faith", "love", "miracles", "wisdom"];
    
    for (const category of categories) {
      try {
        const categoryResponse = await axios.get(
          `${BASE_URL}/api/bible-facts/category/${category}?limit=3`
        );

        if (categoryResponse.data.success) {
          console.log(`✅ ${category} facts retrieved successfully:`);
          categoryResponse.data.data.forEach((fact, index) => {
            console.log(`   ${index + 1}. ${fact.title} - ${fact.scripture}`);
          });
        } else {
          console.log(`❌ Failed to get ${category} facts`);
        }
      } catch (error) {
        console.log(
          `❌ ${category} facts error:`,
          error.response?.data?.message || error.message
        );
      }
    }

    // Test 4: Get Bible facts by difficulty
    console.log("\n4️⃣ Testing Bible facts by difficulty...");
    const difficulties = ["beginner", "intermediate", "advanced"];
    
    for (const difficulty of difficulties) {
      try {
        const difficultyResponse = await axios.get(
          `${BASE_URL}/api/bible-facts/difficulty/${difficulty}?limit=2`
        );

        if (difficultyResponse.data.success) {
          console.log(`✅ ${difficulty} facts retrieved successfully:`);
          difficultyResponse.data.data.forEach((fact, index) => {
            console.log(`   ${index + 1}. ${fact.title} - ${fact.scripture}`);
          });
        } else {
          console.log(`❌ Failed to get ${difficulty} facts`);
        }
      } catch (error) {
        console.log(
          `❌ ${difficulty} facts error:`,
          error.response?.data?.message || error.message
        );
      }
    }

    // Test 5: Search Bible facts by tags
    console.log("\n5️⃣ Testing Bible facts search by tags...");
    const tagSearches = [
      "jesus,faith",
      "love,forgiveness",
      "miracles,healing",
      "wisdom,proverbs"
    ];
    
    for (const tags of tagSearches) {
      try {
        const searchResponse = await axios.get(
          `${BASE_URL}/api/bible-facts/search?tags=${tags}&limit=2`
        );

        if (searchResponse.data.success) {
          console.log(`✅ Search for "${tags}" successful:`);
          searchResponse.data.data.forEach((fact, index) => {
            console.log(`   ${index + 1}. ${fact.title} - ${fact.scripture}`);
          });
        } else {
          console.log(`❌ Failed to search for "${tags}"`);
        }
      } catch (error) {
        console.log(
          `❌ Search for "${tags}" error:`,
          error.response?.data?.message || error.message
        );
      }
    }

    // Test 6: Get personalized Bible fact (requires authentication)
    console.log("\n6️⃣ Testing personalized Bible fact...");
    try {
      const personalizedResponse = await axios.get(
        `${BASE_URL}/api/bible-facts/personalized`,
        {
          headers: {
            Authorization: `Bearer ${process.env.TEST_TOKEN || "your-test-token"}`,
          },
        }
      );

      if (personalizedResponse.data.success) {
        console.log("✅ Personalized Bible fact retrieved successfully:");
        console.log(`   📖 Title: ${personalizedResponse.data.data.fact.title}`);
        console.log(`   💡 Fact: ${personalizedResponse.data.data.fact.fact}`);
        console.log(`   📜 Scripture: ${personalizedResponse.data.data.fact.scripture}`);
        console.log(`   🎯 Reason: ${personalizedResponse.data.data.reason}`);
        console.log(`   📊 Relevance: ${personalizedResponse.data.data.relevance}%`);
      } else {
        console.log("❌ Failed to get personalized Bible fact");
      }
    } catch (error) {
      console.log(
        "❌ Personalized Bible fact error:",
        error.response?.data?.message || error.message
      );
    }

    // Test 7: Get Bible facts statistics (Admin only)
    console.log("\n7️⃣ Testing Bible facts statistics...");
    try {
      const statsResponse = await axios.get(
        `${BASE_URL}/api/bible-facts/stats`,
        {
          headers: {
            Authorization: `Bearer ${process.env.TEST_TOKEN || "your-test-token"}`,
          },
        }
      );

      if (statsResponse.data.success) {
        console.log("✅ Bible facts statistics retrieved successfully:");
        console.log(`   📊 Total Facts: ${statsResponse.data.data.totalFacts}`);
        console.log(`   ✅ Active Facts: ${statsResponse.data.data.activeFacts}`);
        console.log("   📚 Facts by Category:");
        Object.entries(statsResponse.data.data.factsByCategory).forEach(([category, count]) => {
          console.log(`      ${category}: ${count} facts`);
        });
        console.log("   📖 Facts by Difficulty:");
        Object.entries(statsResponse.data.data.factsByDifficulty).forEach(([difficulty, count]) => {
          console.log(`      ${difficulty}: ${count} facts`);
        });
      } else {
        console.log("❌ Failed to get Bible facts statistics (may require admin role)");
      }
    } catch (error) {
      console.log(
        "❌ Bible facts statistics error:",
        error.response?.data?.message || error.message
      );
    }

    // Test 8: Create new Bible fact (Admin only)
    console.log("\n8️⃣ Testing create Bible fact...");
    try {
      const newFact = {
        title: "Test Bible Fact",
        fact: "This is a test Bible fact created by the API test script.",
        scripture: "Test 1:1",
        category: "faith",
        tags: ["test", "api", "automation"],
        difficulty: "beginner"
      };

      const createResponse = await axios.post(
        `${BASE_URL}/api/bible-facts`,
        newFact,
        {
          headers: {
            Authorization: `Bearer ${process.env.TEST_TOKEN || "your-test-token"}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (createResponse.data.success) {
        console.log("✅ Bible fact created successfully:");
        console.log(`   📖 Title: ${createResponse.data.data.title}`);
        console.log(`   💡 Fact: ${createResponse.data.data.fact}`);
        console.log(`   📜 Scripture: ${createResponse.data.data.scripture}`);
        console.log(`   🏷️ Category: ${createResponse.data.data.category}`);
      } else {
        console.log("❌ Failed to create Bible fact");
      }
    } catch (error) {
      console.log(
        "❌ Create Bible fact error:",
        error.response?.data?.message || error.message
      );
    }

    console.log("\n🎉 Bible Facts API testing completed!");
    console.log("\n📖 How Bible Facts Work in Re-Engagement:");
    console.log("   1. 🤖 AI analyzes user's interests and preferences");
    console.log("   2. 📚 System selects relevant Bible fact categories");
    console.log("   3. 🎯 Personalized fact is chosen based on user profile");
    console.log("   4. 📱 Bible fact is sent as push notification");
    console.log("   5. 💡 User receives spiritual encouragement");

    console.log("\n🎯 Bible Fact Categories Available:");
    console.log("   • 📖 Creation & Nature");
    console.log("   • ❤️ Faith & Trust");
    console.log("   • 💕 Love & Relationships");
    console.log("   • ✨ Miracles & Healing");
    console.log("   • 🧠 Wisdom & Proverbs");
    console.log("   • 🙏 Prayer & Worship");
    console.log("   • 🎁 Salvation & Grace");
    console.log("   • 🌟 Hope & Encouragement");
    console.log("   • 👼 Angels & Spiritual Beings");
    console.log("   • 🔮 End Times & Prophecy");
    console.log("   • 👨‍👩‍👧‍👦 Family & Relationships");
    console.log("   • 💰 Money & Work");
    console.log("   • 🏥 Health & Healing");
    console.log("   • 🔬 Science & Nature");
    console.log("   • 🌍 Culture & Society");
    console.log("   • 🤝 Forgiveness & Mercy");
    console.log("   • 📜 Covenants & Law");
    console.log("   • ⛪ Church & Ministry");

    console.log("\n📊 Difficulty Levels:");
    console.log("   • 🟢 Beginner: Simple, easy-to-understand facts");
    console.log("   • 🟡 Intermediate: Moderate complexity facts");
    console.log("   • 🔴 Advanced: Complex theological concepts");

  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
    console.log("\n🔧 Troubleshooting:");
    console.log("   1. Make sure your server is running");
    console.log("   2. Check your authentication token");
    console.log("   3. Ensure Bible facts are seeded in database");
    console.log("   4. Verify API endpoints are properly configured");
  }
}

// Run the test
if (require.main === module) {
  testBibleFactsAPI();
}

module.exports = { testBibleFactsAPI };















