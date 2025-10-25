const axios = require("axios");

// Configuration
const BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";
const TIMEOUT = 10000;

// Test endpoints
const ENDPOINTS = [
  // Basic endpoints
  { name: "Bible Statistics", url: "/api/bible/stats", method: "GET" },
  { name: "All Books", url: "/api/bible/books", method: "GET" },
  {
    name: "Old Testament Books",
    url: "/api/bible/books/testament/old",
    method: "GET",
  },
  {
    name: "New Testament Books",
    url: "/api/bible/books/testament/new",
    method: "GET",
  },
  { name: "Genesis Book", url: "/api/bible/books/Genesis", method: "GET" },
  { name: "John Book", url: "/api/bible/books/John", method: "GET" },

  // Chapter endpoints
  {
    name: "Genesis Chapters",
    url: "/api/bible/books/Genesis/chapters",
    method: "GET",
  },
  {
    name: "Genesis Chapter 1",
    url: "/api/bible/books/Genesis/chapters/1",
    method: "GET",
  },
  {
    name: "John Chapters",
    url: "/api/bible/books/John/chapters",
    method: "GET",
  },
  {
    name: "John Chapter 3",
    url: "/api/bible/books/John/chapters/3",
    method: "GET",
  },

  // Verse endpoints
  {
    name: "Genesis 1 Verses",
    url: "/api/bible/books/Genesis/chapters/1/verses",
    method: "GET",
  },
  {
    name: "Genesis 1:1",
    url: "/api/bible/books/Genesis/chapters/1/verses/1",
    method: "GET",
  },
  {
    name: "John 3 Verses",
    url: "/api/bible/books/John/chapters/3/verses",
    method: "GET",
  },
  {
    name: "John 3:16",
    url: "/api/bible/books/John/chapters/3/verses/16",
    method: "GET",
  },

  // Range endpoints
  {
    name: "Psalm 23:1-6",
    url: "/api/bible/verses/range/Psalm%2023:1-6",
    method: "GET",
  },
  {
    name: "John 3:16-18",
    url: "/api/bible/verses/range/John%203:16-18",
    method: "GET",
  },

  // Search endpoints
  {
    name: 'Search "love"',
    url: "/api/bible/search?q=love&limit=5",
    method: "GET",
  },
  {
    name: 'Search "God"',
    url: "/api/bible/search?q=God&limit=3",
    method: "GET",
  },
  {
    name: "Search in John",
    url: "/api/bible/search?q=faith&book=John&limit=3",
    method: "GET",
  },

  // Discovery endpoints
  { name: "Random Verse", url: "/api/bible/verses/random", method: "GET" },
  { name: "Verse of the Day", url: "/api/bible/verses/daily", method: "GET" },
  {
    name: "Popular Verses",
    url: "/api/bible/verses/popular?limit=5",
    method: "GET",
  },

  // Study tools
  { name: "Reading Plans", url: "/api/bible/reading-plans", method: "GET" },
  {
    name: "Cross References (John 3:16)",
    url: "/api/bible/books/John/chapters/3/verses/16/cross-references",
    method: "GET",
  },
  {
    name: "Commentary (John 3:16)",
    url: "/api/bible/books/John/chapters/3/verses/16/commentary",
    method: "GET",
  },
];

async function testBibleEndpoints() {
  console.log("🧪 Testing Bible API Endpoints...");
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📊 Testing ${ENDPOINTS.length} endpoints\n`);

  let successCount = 0;
  let errorCount = 0;
  const results = [];

  for (const endpoint of ENDPOINTS) {
    try {
      console.log(`🔍 Testing: ${endpoint.name}`);
      console.log(`   URL: ${endpoint.url}`);

      const response = await axios.get(`${BASE_URL}${endpoint.url}`, {
        timeout: TIMEOUT,
        headers: {
          "User-Agent": "Bible-API-Test/1.0",
          Accept: "application/json",
        },
      });

      if (response.status === 200 && response.data) {
        console.log(`   ✅ Status: ${response.status}`);
        console.log(
          `   📊 Response: ${JSON.stringify(response.data).substring(0, 100)}...`
        );
        successCount++;
        results.push({
          name: endpoint.name,
          status: "SUCCESS",
          statusCode: response.status,
          data: response.data,
        });
      } else {
        console.log(`   ⚠️  Unexpected response: ${response.status}`);
        errorCount++;
        results.push({
          name: endpoint.name,
          status: "UNEXPECTED",
          statusCode: response.status,
          error: "Unexpected response format",
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`   📊 Status: ${error.response.status}`);
        console.log(
          `   📊 Data: ${JSON.stringify(error.response.data).substring(0, 100)}...`
        );
      }
      errorCount++;
      results.push({
        name: endpoint.name,
        status: "ERROR",
        error: error.message,
        statusCode: error.response?.status || "N/A",
      });
    }

    console.log(""); // Empty line for readability
  }

  // Summary
  console.log("📊 TEST RESULTS SUMMARY");
  console.log("========================");
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log(
    `📈 Success Rate: ${Math.round((successCount / ENDPOINTS.length) * 100)}%`
  );

  if (successCount > 0) {
    console.log("\n🎉 Bible API endpoints are working!");
    console.log("📱 Your frontend can now consume these endpoints:");
    console.log("\n📚 Key Endpoints for Frontend:");
    console.log("   • GET /api/bible/books - Get all Bible books");
    console.log(
      "   • GET /api/bible/books/:bookName/chapters/:chapterNumber/verses - Get chapter verses"
    );
    console.log(
      "   • GET /api/bible/books/:bookName/chapters/:chapterNumber/verses/:verseNumber - Get specific verse"
    );
    console.log("   • GET /api/bible/search?q=query - Search Bible text");
    console.log("   • GET /api/bible/verses/random - Get random verse");
    console.log("   • GET /api/bible/verses/popular - Get popular verses");
    console.log("   • GET /api/bible/stats - Get Bible statistics");
  } else {
    console.log("\n⚠️  No endpoints are working. Check:");
    console.log("   1. Server is running (npm run dev)");
    console.log("   2. Database is connected");
    console.log("   3. Bible data is seeded");
    console.log("   4. Routes are properly registered");
  }

  return results;
}

// Run the tests
if (require.main === module) {
  testBibleEndpoints()
    .then(() => {
      console.log("\n🏁 Testing completed!");
      process.exit(0);
    })
    .catch(error => {
      console.error("❌ Test failed:", error.message);
      process.exit(1);
    });
}

module.exports = { testBibleEndpoints };
