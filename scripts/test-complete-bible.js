const mongoose = require("mongoose");
const axios = require("axios");

// Load environment variables
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
);

// Import models
const {
  BibleBook,
  BibleChapter,
  BibleVerse,
} = require("../dist/models/bible.model");

// Test configuration
const TEST_CONFIG = {
  BASE_URL: process.env.API_BASE_URL || "http://localhost:3000",
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  errors: [],
  startTime: null,
};

async function testCompleteBibleAPI() {
  try {
    testResults.startTime = new Date();
    console.log("🧪 Starting COMPLETE Bible API Testing...");
    console.log("📊 Testing all Bible endpoints with full dataset");
    console.log(`🌐 API Base URL: ${TEST_CONFIG.BASE_URL}\n`);

    // Test database connectivity and data
    await testDatabaseConnectivity();

    // Test all Bible API endpoints
    await testBooksEndpoints();
    await testChaptersEndpoints();
    await testVersesEndpoints();
    await testSearchEndpoints();
    await testAdvancedEndpoints();

    // Performance testing
    await testPerformance();

    // Final results
    printTestResults();
  } catch (error) {
    console.error("❌ Critical test error:", error);
    testResults.errors.push({ type: "critical", message: error.message });
  } finally {
    await mongoose.connection.close();
  }
}

async function testDatabaseConnectivity() {
  console.log("🔍 Testing Database Connectivity...");

  try {
    const stats = await getBibleStats();
    console.log(`✅ Database connected successfully`);
    console.log(
      `📊 Current data: ${stats.totalBooks} books, ${stats.totalChapters} chapters, ${stats.totalVerses} verses`
    );

    if (stats.totalVerses < 1000) {
      console.log(
        "⚠️  WARNING: Low verse count detected. Consider running seed script first."
      );
    }

    testResults.passed++;
  } catch (error) {
    console.log(`❌ Database connection failed: ${error.message}`);
    testResults.failed++;
    testResults.errors.push({ test: "database", error: error.message });
  }

  testResults.total++;
}

async function testBooksEndpoints() {
  console.log("\n📚 Testing Books Endpoints...");

  const bookTests = [
    {
      name: "Get all books",
      endpoint: "/api/bible/books",
      expectedFields: [
        "name",
        "abbreviation",
        "testament",
        "order",
        "chapters",
      ],
    },
    {
      name: "Get Old Testament books",
      endpoint: "/api/bible/books/testament/old",
      expectedCount: 39,
    },
    {
      name: "Get New Testament books",
      endpoint: "/api/bible/books/testament/new",
      expectedCount: 27,
    },
    {
      name: "Get specific book (Genesis)",
      endpoint: "/api/bible/books/Genesis",
      expectedFields: ["name", "chapters", "testament"],
    },
    {
      name: "Get specific book (John)",
      endpoint: "/api/bible/books/John",
      expectedFields: ["name", "chapters", "testament"],
    },
  ];

  for (const test of bookTests) {
    await runAPITest(test);
  }
}

async function testChaptersEndpoints() {
  console.log("\n📖 Testing Chapters Endpoints...");

  const chapterTests = [
    {
      name: "Get Genesis chapters",
      endpoint: "/api/bible/books/Genesis/chapters",
      expectedFields: ["bookName", "chapterNumber", "verses"],
    },
    {
      name: "Get John chapters",
      endpoint: "/api/bible/books/John/chapters",
      expectedFields: ["bookName", "chapterNumber", "verses"],
    },
    {
      name: "Get Genesis chapter 1",
      endpoint: "/api/bible/books/Genesis/chapters/1",
      expectedFields: ["bookName", "chapterNumber", "verses"],
    },
    {
      name: "Get John chapter 3",
      endpoint: "/api/bible/books/John/chapters/3",
      expectedFields: ["bookName", "chapterNumber", "verses"],
    },
  ];

  for (const test of chapterTests) {
    await runAPITest(test);
  }
}

async function testVersesEndpoints() {
  console.log("\n📝 Testing Verses Endpoints...");

  const verseTests = [
    {
      name: "Get Genesis 1 verses",
      endpoint: "/api/bible/books/Genesis/chapters/1/verses",
      expectedFields: ["bookName", "chapterNumber", "verseNumber", "text"],
    },
    {
      name: "Get John 3 verses",
      endpoint: "/api/bible/books/John/chapters/3/verses",
      expectedFields: ["bookName", "chapterNumber", "verseNumber", "text"],
    },
    {
      name: "Get Genesis 1:1",
      endpoint: "/api/bible/books/Genesis/chapters/1/verses/1",
      expectedFields: ["bookName", "chapterNumber", "verseNumber", "text"],
    },
    {
      name: "Get John 3:16",
      endpoint: "/api/bible/books/John/chapters/3/verses/16",
      expectedFields: ["bookName", "chapterNumber", "verseNumber", "text"],
    },
    {
      name: "Get verse range (Psalm 23:1-6)",
      endpoint: "/api/bible/verses/range/Psalm%2023:1-6",
      expectedFields: ["verses"],
    },
    {
      name: "Get verse range (John 3:16-18)",
      endpoint: "/api/bible/verses/range/John%203:16-18",
      expectedFields: ["verses"],
    },
  ];

  for (const test of verseTests) {
    await runAPITest(test);
  }
}

async function testSearchEndpoints() {
  console.log("\n🔍 Testing Search Endpoints...");

  const searchTests = [
    {
      name: "Search for 'love'",
      endpoint: "/api/bible/search?q=love&limit=10",
      expectedFields: ["results", "total", "query"],
    },
    {
      name: "Search for 'faith'",
      endpoint: "/api/bible/search?q=faith&limit=5",
      expectedFields: ["results", "total", "query"],
    },
    {
      name: "Search for 'Jesus'",
      endpoint: "/api/bible/search?q=Jesus&limit=10",
      expectedFields: ["results", "total", "query"],
    },
    {
      name: "Search for 'God' in Old Testament",
      endpoint: "/api/bible/search?q=God&testament=old&limit=5",
      expectedFields: ["results", "total", "query"],
    },
    {
      name: "Search for 'salvation' in New Testament",
      endpoint: "/api/bible/search?q=salvation&testament=new&limit=5",
      expectedFields: ["results", "total", "query"],
    },
    {
      name: "Search for 'love' in specific book",
      endpoint: "/api/bible/search?q=love&book=John&limit=5",
      expectedFields: ["results", "total", "query"],
    },
  ];

  for (const test of searchTests) {
    await runAPITest(test);
  }
}

async function testAdvancedEndpoints() {
  console.log("\n⭐ Testing Advanced Endpoints...");

  const advancedTests = [
    {
      name: "Get random verse",
      endpoint: "/api/bible/verses/random",
      expectedFields: ["bookName", "chapterNumber", "verseNumber", "text"],
    },
    {
      name: "Get verse of the day",
      endpoint: "/api/bible/verses/daily",
      expectedFields: ["bookName", "chapterNumber", "verseNumber", "text"],
    },
    {
      name: "Get popular verses",
      endpoint: "/api/bible/verses/popular?limit=10",
      expectedFields: ["verses"],
    },
    {
      name: "Get Bible statistics",
      endpoint: "/api/bible/stats",
      expectedFields: ["totalBooks", "totalChapters", "totalVerses"],
    },
    {
      name: "Get reading plans",
      endpoint: "/api/bible/reading-plans",
      expectedFields: ["plans"],
    },
  ];

  for (const test of advancedTests) {
    await runAPITest(test);
  }
}

async function testPerformance() {
  console.log("\n⚡ Testing Performance...");

  const performanceTests = [
    {
      name: "Search performance (100 results)",
      endpoint: "/api/bible/search?q=love&limit=100",
      maxTime: 2000, // 2 seconds
    },
    {
      name: "Large chapter performance (Psalm 119)",
      endpoint: "/api/bible/books/Psalm/chapters/119/verses",
      maxTime: 1000, // 1 second
    },
    {
      name: "All books endpoint performance",
      endpoint: "/api/bible/books",
      maxTime: 500, // 0.5 seconds
    },
  ];

  for (const test of performanceTests) {
    await runPerformanceTest(test);
  }
}

async function runAPITest(test) {
  try {
    const startTime = Date.now();
    const response = await axios.get(
      `${TEST_CONFIG.BASE_URL}${test.endpoint}`,
      {
        timeout: TEST_CONFIG.TIMEOUT,
        headers: {
          Accept: "application/json",
          "User-Agent": "Jevah-Bible-Test/1.0",
        },
      }
    );

    const duration = Date.now() - startTime;

    // Check response status
    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check response data
    if (!response.data) {
      throw new Error("No data in response");
    }

    // Check expected fields
    if (test.expectedFields) {
      const missingFields = test.expectedFields.filter(
        field => !hasField(response.data, field)
      );
      if (missingFields.length > 0) {
        throw new Error(`Missing fields: ${missingFields.join(", ")}`);
      }
    }

    // Check expected count
    if (test.expectedCount) {
      const actualCount = Array.isArray(response.data)
        ? response.data.length
        : response.data.results
          ? response.data.results.length
          : 0;
      if (actualCount < test.expectedCount) {
        throw new Error(
          `Expected at least ${test.expectedCount} items, got ${actualCount}`
        );
      }
    }

    console.log(`✅ ${test.name} (${duration}ms)`);
    testResults.passed++;
  } catch (error) {
    console.log(`❌ ${test.name}: ${error.message}`);
    testResults.failed++;
    testResults.errors.push({
      test: test.name,
      endpoint: test.endpoint,
      error: error.message,
    });
  }

  testResults.total++;
}

async function runPerformanceTest(test) {
  try {
    const startTime = Date.now();
    const response = await axios.get(
      `${TEST_CONFIG.BASE_URL}${test.endpoint}`,
      {
        timeout: TEST_CONFIG.TIMEOUT,
      }
    );

    const duration = Date.now() - startTime;

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (duration > test.maxTime) {
      throw new Error(`Too slow: ${duration}ms (max: ${test.maxTime}ms)`);
    }

    console.log(`✅ ${test.name}: ${duration}ms (max: ${test.maxTime}ms)`);
    testResults.passed++;
  } catch (error) {
    console.log(`❌ ${test.name}: ${error.message}`);
    testResults.failed++;
    testResults.errors.push({
      test: test.name,
      endpoint: test.endpoint,
      error: error.message,
    });
  }

  testResults.total++;
}

function hasField(obj, field) {
  if (Array.isArray(obj)) {
    return obj.length > 0 && hasField(obj[0], field);
  }

  if (typeof obj === "object" && obj !== null) {
    return field in obj;
  }

  return false;
}

async function getBibleStats() {
  const [
    totalBooks,
    totalChapters,
    totalVerses,
    oldTestamentBooks,
    newTestamentBooks,
  ] = await Promise.all([
    BibleBook.countDocuments({ isActive: true }),
    BibleChapter.countDocuments({ isActive: true }),
    BibleVerse.countDocuments({ isActive: true }),
    BibleBook.countDocuments({ testament: "old", isActive: true }),
    BibleBook.countDocuments({ testament: "new", isActive: true }),
  ]);

  return {
    totalBooks,
    totalChapters,
    totalVerses,
    oldTestamentBooks,
    newTestamentBooks,
  };
}

function printTestResults() {
  const duration = new Date() - testResults.startTime;
  const minutes = Math.round(duration / 60000);
  const successRate = Math.round(
    (testResults.passed / testResults.total) * 100
  );

  console.log("\n📊 TEST RESULTS SUMMARY");
  console.log("=======================");
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Total: ${testResults.total}`);
  console.log(`📈 Success Rate: ${successRate}%`);
  console.log(`⏱️  Duration: ${minutes} minutes`);

  if (testResults.errors.length > 0) {
    console.log("\n❌ FAILED TESTS:");
    testResults.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.test || "Unknown"}: ${error.error}`);
      if (error.endpoint) {
        console.log(`     Endpoint: ${error.endpoint}`);
      }
    });
  }

  if (successRate >= 90) {
    console.log("\n🎉 EXCELLENT! Bible API is working great!");
  } else if (successRate >= 70) {
    console.log("\n✅ GOOD! Bible API is mostly working with some issues.");
  } else {
    console.log("\n⚠️  NEEDS ATTENTION! Bible API has significant issues.");
  }
}

// Function to test specific search functionality
async function testSearchFunctionality() {
  console.log("\n🔍 Testing Search Functionality in Detail...");

  const searchQueries = [
    { query: "love", minResults: 10, description: "Common word search" },
    { query: "faith", minResults: 5, description: "Theological term search" },
    { query: "Jesus", minResults: 20, description: "Name search" },
    { query: "salvation", minResults: 5, description: "Doctrinal term search" },
    { query: "peace", minResults: 5, description: "Concept search" },
    { query: "hope", minResults: 5, description: "Emotional term search" },
  ];

  for (const search of searchQueries) {
    try {
      const response = await axios.get(
        `${TEST_CONFIG.BASE_URL}/api/bible/search?q=${encodeURIComponent(search.query)}&limit=50`,
        { timeout: TEST_CONFIG.TIMEOUT }
      );

      if (response.status === 200 && response.data) {
        const resultCount = response.data.results
          ? response.data.results.length
          : 0;
        const totalCount = response.data.total || 0;

        if (resultCount >= search.minResults) {
          console.log(
            `✅ "${search.query}": ${resultCount} results (${totalCount} total) - ${search.description}`
          );
        } else {
          console.log(
            `⚠️  "${search.query}": Only ${resultCount} results (expected ${search.minResults}+) - ${search.description}`
          );
        }
      } else {
        console.log(`❌ "${search.query}": Search failed`);
      }
    } catch (error) {
      console.log(`❌ "${search.query}": ${error.message}`);
    }
  }
}

// Function to test edge cases
async function testEdgeCases() {
  console.log("\n🧪 Testing Edge Cases...");

  const edgeCases = [
    {
      name: "Non-existent book",
      endpoint: "/api/bible/books/NonExistentBook",
      expectedStatus: 404,
    },
    {
      name: "Invalid chapter number",
      endpoint: "/api/bible/books/Genesis/chapters/999",
      expectedStatus: 404,
    },
    {
      name: "Invalid verse number",
      endpoint: "/api/bible/books/Genesis/chapters/1/verses/999",
      expectedStatus: 404,
    },
    {
      name: "Empty search query",
      endpoint: "/api/bible/search?q=",
      expectedStatus: 400,
    },
    {
      name: "Very long search query",
      endpoint: `/api/bible/search?q=${"a".repeat(1000)}`,
      expectedStatus: 400,
    },
  ];

  for (const test of edgeCases) {
    try {
      const response = await axios.get(
        `${TEST_CONFIG.BASE_URL}${test.endpoint}`,
        {
          timeout: TEST_CONFIG.TIMEOUT,
          validateStatus: () => true, // Don't throw on non-200 status
        }
      );

      if (response.status === test.expectedStatus) {
        console.log(`✅ ${test.name}: Correctly returned ${response.status}`);
      } else {
        console.log(
          `❌ ${test.name}: Expected ${test.expectedStatus}, got ${response.status}`
        );
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--search-only")) {
    testSearchFunctionality();
  } else if (args.includes("--edge-cases")) {
    testEdgeCases();
  } else if (args.includes("--help")) {
    console.log(`
🧪 Complete Bible API Testing Script

Usage:
  node test-complete-bible.js              # Run all tests
  node test-complete-bible.js --search-only # Test search functionality only
  node test-complete-bible.js --edge-cases  # Test edge cases only
  node test-complete-bible.js --help        # Show this help

Tests:
  ✅ Database connectivity
  ✅ Books endpoints
  ✅ Chapters endpoints  
  ✅ Verses endpoints
  ✅ Search endpoints
  ✅ Advanced endpoints
  ✅ Performance testing
  ✅ Edge case handling
    `);
  } else {
    testCompleteBibleAPI();
  }
}

module.exports = {
  testCompleteBibleAPI,
  testSearchFunctionality,
  testEdgeCases,
};











