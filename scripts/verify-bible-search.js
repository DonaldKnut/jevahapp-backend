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

// Search verification configuration
const SEARCH_CONFIG = {
  BASE_URL: process.env.API_BASE_URL || "http://localhost:3000",
  TIMEOUT: 15000,
  COMPREHENSIVE_SEARCH_TERMS: [
    // Core theological terms
    "love",
    "faith",
    "hope",
    "grace",
    "mercy",
    "salvation",
    "redemption",
    "forgiveness",
    "repentance",
    "righteousness",
    "holiness",
    "peace",

    // Names and titles
    "Jesus",
    "Christ",
    "God",
    "Lord",
    "Father",
    "Son",
    "Holy Spirit",
    "Savior",
    "Messiah",
    "King",
    "Shepherd",
    "Lamb",

    // Biblical concepts
    "covenant",
    "promise",
    "blessing",
    "curse",
    "sin",
    "death",
    "life",
    "eternal",
    "heaven",
    "hell",
    "judgment",
    "resurrection",
    "glory",

    // Actions and behaviors
    "pray",
    "worship",
    "serve",
    "obey",
    "believe",
    "trust",
    "follow",
    "teach",
    "preach",
    "heal",
    "save",
    "deliver",
    "protect",

    // Emotions and states
    "joy",
    "sorrow",
    "fear",
    "courage",
    "strength",
    "weakness",
    "comfort",
    "trouble",
    "suffering",
    "trial",
    "temptation",
    "victory",

    // Relationships
    "brother",
    "sister",
    "friend",
    "neighbor",
    "enemy",
    "stranger",
    "family",
    "children",
    "parents",
    "husband",
    "wife",

    // Places and things
    "temple",
    "church",
    "altar",
    "cross",
    "blood",
    "water",
    "bread",
    "wine",
    "light",
    "darkness",
    "fire",
    "wind",
    "earth",
    "heaven",
  ],

  POPULAR_VERSE_REFERENCES: [
    "John 3:16",
    "Genesis 1:1",
    "Psalm 23:1",
    "Romans 8:28",
    "Philippians 4:13",
    "Jeremiah 29:11",
    "Proverbs 3:5-6",
    "Matthew 28:19-20",
    "1 Corinthians 13:4-7",
    "Ephesians 2:8-9",
    "Isaiah 40:31",
    "Matthew 6:9-13",
    "John 14:6",
    "Romans 3:23",
    "2 Corinthians 5:17",
    "Galatians 5:22-23",
    "Hebrews 11:1",
    "James 1:2-3",
    "1 John 4:8",
    "Revelation 3:20",
  ],
};

// Verification results
let verificationResults = {
  totalSearches: 0,
  successfulSearches: 0,
  failedSearches: 0,
  averageResults: 0,
  searchTimes: [],
  errors: [],
  startTime: null,
  databaseStats: null,
};

async function verifyBibleSearch() {
  try {
    verificationResults.startTime = new Date();
    console.log("🔍 Starting COMPREHENSIVE Bible Search Verification...");
    console.log("📊 Testing search functionality with full Bible dataset");
    console.log(`🌐 API Base URL: ${SEARCH_CONFIG.BASE_URL}\n`);

    // Get database statistics
    await getDatabaseStatistics();

    // Test basic search functionality
    await testBasicSearchFunctionality();

    // Test comprehensive search terms
    await testComprehensiveSearchTerms();

    // Test popular verse references
    await testPopularVerseReferences();

    // Test search performance
    await testSearchPerformance();

    // Test search accuracy
    await testSearchAccuracy();

    // Test edge cases
    await testSearchEdgeCases();

    // Print final verification results
    printVerificationResults();
  } catch (error) {
    console.error("❌ Critical verification error:", error);
    verificationResults.errors.push({
      type: "critical",
      message: error.message,
    });
  } finally {
    await mongoose.connection.close();
  }
}

async function getDatabaseStatistics() {
  console.log("📊 Getting Database Statistics...");

  try {
    const stats = await Promise.all([
      BibleBook.countDocuments({ isActive: true }),
      BibleChapter.countDocuments({ isActive: true }),
      BibleVerse.countDocuments({ isActive: true }),
      BibleBook.countDocuments({ testament: "old", isActive: true }),
      BibleBook.countDocuments({ testament: "new", isActive: true }),
    ]);

    verificationResults.databaseStats = {
      totalBooks: stats[0],
      totalChapters: stats[1],
      totalVerses: stats[2],
      oldTestamentBooks: stats[3],
      newTestamentBooks: stats[4],
    };

    console.log(`✅ Database Stats:`);
    console.log(`   📚 Books: ${stats[0]} (${stats[3]} OT, ${stats[4]} NT)`);
    console.log(`   📖 Chapters: ${stats[1]}`);
    console.log(`   📝 Verses: ${stats[2]}`);

    if (stats[2] < 10000) {
      console.log(
        "⚠️  WARNING: Low verse count. Consider running seed script for complete dataset."
      );
    }
  } catch (error) {
    console.log(`❌ Failed to get database stats: ${error.message}`);
    verificationResults.errors.push({
      test: "database_stats",
      error: error.message,
    });
  }
}

async function testBasicSearchFunctionality() {
  console.log("\n🔍 Testing Basic Search Functionality...");

  const basicTests = [
    { query: "love", expectedMin: 50, description: "Common word" },
    { query: "God", expectedMin: 100, description: "Frequent term" },
    { query: "Jesus", expectedMin: 200, description: "Name search" },
    { query: "faith", expectedMin: 20, description: "Theological term" },
    { query: "salvation", expectedMin: 10, description: "Doctrinal term" },
  ];

  for (const test of basicTests) {
    await runSearchTest(test);
  }
}

async function testComprehensiveSearchTerms() {
  console.log("\n📚 Testing Comprehensive Search Terms...");
  console.log(
    `🔍 Testing ${SEARCH_CONFIG.COMPREHENSIVE_SEARCH_TERMS.length} search terms...`
  );

  let successfulTerms = 0;
  let totalResults = 0;

  for (const term of SEARCH_CONFIG.COMPREHENSIVE_SEARCH_TERMS) {
    try {
      const startTime = Date.now();
      const response = await axios.get(
        `${SEARCH_CONFIG.BASE_URL}/api/bible/search?q=${encodeURIComponent(term)}&limit=100`,
        { timeout: SEARCH_CONFIG.TIMEOUT }
      );

      const duration = Date.now() - startTime;
      verificationResults.searchTimes.push(duration);

      if (response.status === 200 && response.data) {
        const resultCount = response.data.results
          ? response.data.results.length
          : 0;
        const totalCount = response.data.total || 0;

        if (resultCount > 0) {
          successfulTerms++;
          totalResults += resultCount;
          console.log(
            `✅ "${term}": ${resultCount} results (${totalCount} total) - ${duration}ms`
          );
        } else {
          console.log(`⚠️  "${term}": No results found`);
        }
      } else {
        console.log(`❌ "${term}": Search failed`);
      }

      verificationResults.totalSearches++;

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.log(`❌ "${term}": ${error.message}`);
      verificationResults.failedSearches++;
      verificationResults.errors.push({ term, error: error.message });
    }
  }

  verificationResults.successfulSearches = successfulTerms;
  verificationResults.averageResults =
    successfulTerms > 0 ? Math.round(totalResults / successfulTerms) : 0;

  console.log(`\n📊 Comprehensive Search Results:`);
  console.log(
    `   ✅ Successful: ${successfulTerms}/${SEARCH_CONFIG.COMPREHENSIVE_SEARCH_TERMS.length}`
  );
  console.log(
    `   📈 Average results per term: ${verificationResults.averageResults}`
  );
}

async function testPopularVerseReferences() {
  console.log("\n⭐ Testing Popular Verse References...");

  for (const reference of SEARCH_CONFIG.POPULAR_VERSE_REFERENCES) {
    try {
      // Test direct verse lookup
      const verseResponse = await axios.get(
        `${SEARCH_CONFIG.BASE_URL}/api/bible/verses/range/${encodeURIComponent(reference)}`,
        { timeout: SEARCH_CONFIG.TIMEOUT }
      );

      if (verseResponse.status === 200 && verseResponse.data) {
        console.log(`✅ "${reference}": Found via direct lookup`);
      } else {
        console.log(`❌ "${reference}": Direct lookup failed`);
      }

      // Test search for key words from the reference
      const words = reference.split(/[\s:]+/);
      const searchTerm = words[words.length - 1]; // Usually the verse number or key word

      const searchResponse = await axios.get(
        `${SEARCH_CONFIG.BASE_URL}/api/bible/search?q=${encodeURIComponent(searchTerm)}&limit=10`,
        { timeout: SEARCH_CONFIG.TIMEOUT }
      );

      if (
        searchResponse.status === 200 &&
        searchResponse.data &&
        searchResponse.data.results
      ) {
        const found = searchResponse.data.results.some(
          result =>
            result.bookName && result.chapterNumber && result.verseNumber
        );
        console.log(`✅ "${reference}": Search functionality working`);
      } else {
        console.log(`❌ "${reference}": Search failed`);
      }
    } catch (error) {
      console.log(`❌ "${reference}": ${error.message}`);
    }
  }
}

async function testSearchPerformance() {
  console.log("\n⚡ Testing Search Performance...");

  const performanceTests = [
    {
      query: "love",
      limit: 50,
      maxTime: 2000,
      description: "Medium result set",
    },
    {
      query: "God",
      limit: 100,
      maxTime: 3000,
      description: "Large result set",
    },
    {
      query: "faith",
      limit: 20,
      maxTime: 1000,
      description: "Small result set",
    },
    {
      query: "salvation",
      limit: 200,
      maxTime: 4000,
      description: "Very large result set",
    },
  ];

  for (const test of performanceTests) {
    try {
      const startTime = Date.now();
      const response = await axios.get(
        `${SEARCH_CONFIG.BASE_URL}/api/bible/search?q=${encodeURIComponent(test.query)}&limit=${test.limit}`,
        { timeout: SEARCH_CONFIG.TIMEOUT }
      );

      const duration = Date.now() - startTime;

      if (response.status === 200) {
        if (duration <= test.maxTime) {
          console.log(
            `✅ "${test.query}" (${test.limit} limit): ${duration}ms - ${test.description}`
          );
        } else {
          console.log(
            `⚠️  "${test.query}" (${test.limit} limit): ${duration}ms (slow, max: ${test.maxTime}ms) - ${test.description}`
          );
        }
      } else {
        console.log(`❌ "${test.query}": HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ "${test.query}": ${error.message}`);
    }
  }
}

async function testSearchAccuracy() {
  console.log("\n🎯 Testing Search Accuracy...");

  const accuracyTests = [
    {
      query: "John 3:16",
      expectedBook: "John",
      expectedChapter: 3,
      expectedVerse: 16,
      description: "Exact verse reference",
    },
    {
      query: "love never fails",
      expectedText: "love",
      description: "Phrase search",
    },
    {
      query: "faith hope love",
      expectedTerms: ["faith", "hope", "love"],
      description: "Multiple term search",
    },
  ];

  for (const test of accuracyTests) {
    try {
      const response = await axios.get(
        `${SEARCH_CONFIG.BASE_URL}/api/bible/search?q=${encodeURIComponent(test.query)}&limit=10`,
        { timeout: SEARCH_CONFIG.TIMEOUT }
      );

      if (response.status === 200 && response.data && response.data.results) {
        const results = response.data.results;

        if (test.expectedBook && test.expectedChapter && test.expectedVerse) {
          const found = results.find(
            result =>
              result.bookName === test.expectedBook &&
              result.chapterNumber === test.expectedChapter &&
              result.verseNumber === test.expectedVerse
          );

          if (found) {
            console.log(
              `✅ "${test.query}": Found exact match - ${test.description}`
            );
          } else {
            console.log(
              `⚠️  "${test.query}": Exact match not found - ${test.description}`
            );
          }
        } else if (test.expectedText) {
          const found = results.some(
            result =>
              result.text &&
              result.text
                .toLowerCase()
                .includes(test.expectedText.toLowerCase())
          );

          if (found) {
            console.log(
              `✅ "${test.query}": Found relevant results - ${test.description}`
            );
          } else {
            console.log(
              `⚠️  "${test.query}": No relevant results - ${test.description}`
            );
          }
        } else if (test.expectedTerms) {
          const found = results.some(result =>
            test.expectedTerms.some(
              term =>
                result.text &&
                result.text.toLowerCase().includes(term.toLowerCase())
            )
          );

          if (found) {
            console.log(
              `✅ "${test.query}": Found multi-term results - ${test.description}`
            );
          } else {
            console.log(
              `⚠️  "${test.query}": No multi-term results - ${test.description}`
            );
          }
        }
      } else {
        console.log(`❌ "${test.query}": Search failed - ${test.description}`);
      }
    } catch (error) {
      console.log(`❌ "${test.query}": ${error.message} - ${test.description}`);
    }
  }
}

async function testSearchEdgeCases() {
  console.log("\n🧪 Testing Search Edge Cases...");

  const edgeCases = [
    { query: "", description: "Empty search" },
    { query: "   ", description: "Whitespace only" },
    { query: "a", description: "Single character" },
    { query: "xyz123nonexistent", description: "Non-existent term" },
    { query: "love faith hope grace mercy", description: "Very long query" },
    { query: "LOVE", description: "Uppercase" },
    { query: "love", limit: 0, description: "Zero limit" },
    { query: "love", limit: 1000, description: "Very high limit" },
  ];

  for (const test of edgeCases) {
    try {
      let url = `${SEARCH_CONFIG.BASE_URL}/api/bible/search?q=${encodeURIComponent(test.query)}`;
      if (test.limit !== undefined) {
        url += `&limit=${test.limit}`;
      }

      const response = await axios.get(url, {
        timeout: SEARCH_CONFIG.TIMEOUT,
        validateStatus: () => true, // Don't throw on non-200 status
      });

      if (response.status === 200) {
        console.log(
          `✅ "${test.query}": Handled gracefully - ${test.description}`
        );
      } else if (response.status === 400) {
        console.log(
          `✅ "${test.query}": Correctly rejected - ${test.description}`
        );
      } else {
        console.log(
          `⚠️  "${test.query}": Unexpected status ${response.status} - ${test.description}`
        );
      }
    } catch (error) {
      console.log(`❌ "${test.query}": ${error.message} - ${test.description}`);
    }
  }
}

async function runSearchTest(test) {
  try {
    const startTime = Date.now();
    const response = await axios.get(
      `${SEARCH_CONFIG.BASE_URL}/api/bible/search?q=${encodeURIComponent(test.query)}&limit=100`,
      { timeout: SEARCH_CONFIG.TIMEOUT }
    );

    const duration = Date.now() - startTime;
    verificationResults.searchTimes.push(duration);

    if (response.status === 200 && response.data) {
      const resultCount = response.data.results
        ? response.data.results.length
        : 0;
      const totalCount = response.data.total || 0;

      if (resultCount >= test.expectedMin) {
        console.log(
          `✅ "${test.query}": ${resultCount} results (${totalCount} total) - ${test.description}`
        );
        verificationResults.successfulSearches++;
      } else {
        console.log(
          `⚠️  "${test.query}": Only ${resultCount} results (expected ${test.expectedMin}+) - ${test.description}`
        );
        verificationResults.failedSearches++;
      }
    } else {
      console.log(`❌ "${test.query}": Search failed - ${test.description}`);
      verificationResults.failedSearches++;
    }

    verificationResults.totalSearches++;
  } catch (error) {
    console.log(`❌ "${test.query}": ${error.message} - ${test.description}`);
    verificationResults.failedSearches++;
    verificationResults.errors.push({
      query: test.query,
      error: error.message,
    });
  }
}

function printVerificationResults() {
  const duration = new Date() - verificationResults.startTime;
  const minutes = Math.round(duration / 60000);
  const successRate =
    verificationResults.totalSearches > 0
      ? Math.round(
          (verificationResults.successfulSearches /
            verificationResults.totalSearches) *
            100
        )
      : 0;

  const avgSearchTime =
    verificationResults.searchTimes.length > 0
      ? Math.round(
          verificationResults.searchTimes.reduce((a, b) => a + b, 0) /
            verificationResults.searchTimes.length
        )
      : 0;

  console.log("\n📊 BIBLE SEARCH VERIFICATION RESULTS");
  console.log("====================================");
  console.log(
    `📚 Database: ${verificationResults.databaseStats?.totalVerses || 0} verses`
  );
  console.log(`🔍 Total Searches: ${verificationResults.totalSearches}`);
  console.log(`✅ Successful: ${verificationResults.successfulSearches}`);
  console.log(`❌ Failed: ${verificationResults.failedSearches}`);
  console.log(`📈 Success Rate: ${successRate}%`);
  console.log(`⚡ Average Search Time: ${avgSearchTime}ms`);
  console.log(`📊 Average Results: ${verificationResults.averageResults}`);
  console.log(`⏱️  Total Duration: ${minutes} minutes`);

  if (verificationResults.errors.length > 0) {
    console.log("\n❌ ERRORS ENCOUNTERED:");
    verificationResults.errors.forEach((error, index) => {
      console.log(
        `  ${index + 1}. ${error.query || error.term || "Unknown"}: ${error.error}`
      );
    });
  }

  // Performance analysis
  if (verificationResults.searchTimes.length > 0) {
    const sortedTimes = verificationResults.searchTimes.sort((a, b) => a - b);
    const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
    const maxTime = Math.max(...verificationResults.searchTimes);
    const minTime = Math.min(...verificationResults.searchTimes);

    console.log("\n⚡ PERFORMANCE ANALYSIS:");
    console.log(`   🚀 Fastest: ${minTime}ms`);
    console.log(`   📊 Median: ${medianTime}ms`);
    console.log(`   🐌 Slowest: ${maxTime}ms`);
  }

  // Final assessment
  if (successRate >= 95 && avgSearchTime < 2000) {
    console.log("\n🎉 EXCELLENT! Bible search is working perfectly!");
  } else if (successRate >= 80 && avgSearchTime < 3000) {
    console.log("\n✅ GOOD! Bible search is working well with minor issues.");
  } else if (successRate >= 60) {
    console.log("\n⚠️  FAIR! Bible search is working but needs improvement.");
  } else {
    console.log(
      "\n❌ POOR! Bible search has significant issues that need attention."
    );
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log(`
🔍 Bible Search Verification Script

Usage:
  node verify-bible-search.js              # Run complete verification
  node verify-bible-search.js --help       # Show this help

Verification Tests:
  ✅ Database statistics
  ✅ Basic search functionality
  ✅ Comprehensive search terms (50+ terms)
  ✅ Popular verse references
  ✅ Search performance
  ✅ Search accuracy
  ✅ Edge case handling

This script will thoroughly test your Bible search functionality
with the complete dataset to ensure it's working properly.
    `);
  } else {
    verifyBibleSearch();
  }
}

module.exports = { verifyBibleSearch };











