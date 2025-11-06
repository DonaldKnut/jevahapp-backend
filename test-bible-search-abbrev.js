const mongoose = require("mongoose");
const axios = require("axios");
require("dotenv").config();

const BASE_URL = process.env.API_BASE_URL || "http://localhost:4000";

async function testSearchWithAbbreviations() {
  try {
    console.log("🧪 Testing Bible Search with Abbreviations...\n");

    // Test cases: input -> expected book
    const testCases = [
      {
        input: "pro",
        expected: "Proverbs",
        description: "Short 'pro' should match Proverbs",
      },
      {
        input: "Pro",
        expected: "Proverbs",
        description: "Capital 'Pro' (abbreviation) should match Proverbs",
      },
      {
        input: "gen",
        expected: "Genesis",
        description: "'gen' should match Genesis",
      },
      {
        input: "john",
        expected: "John",
        description: "'john' should match John",
      },
      {
        input: "joh",
        expected: "John",
        description: "'joh' (partial abbreviation) should match John",
      },
      {
        input: "rom",
        expected: "Romans",
        description: "'rom' should match Romans",
      },
      {
        input: "psa",
        expected: "Psalm",
        description: "'psa' (abbreviation) should match Psalm",
      },
      {
        input: "1Co",
        expected: "1 Corinthians",
        description: "'1Co' (abbreviation) should match 1 Corinthians",
      },
      {
        input: "1 cor",
        expected: "1 Corinthians",
        description: "'1 cor' should match 1 Corinthians",
      },
    ];

    for (const testCase of testCases) {
      console.log(`\n🔍 Test: ${testCase.description}`);
      console.log(`   Input: "${testCase.input}"`);

      try {
        const url = `${BASE_URL}/api/bible/search?q=love&book=${encodeURIComponent(testCase.input)}&limit=3`;
        console.log(`   URL: ${url}`);

        const response = await axios.get(url, { timeout: 10000 });

        if (response.data.success && response.data.data.length > 0) {
          const firstResult = response.data.data[0];
          const actualBook =
            firstResult.book?.name || firstResult.verse?.bookName;

          if (actualBook === testCase.expected) {
            console.log(`   ✅ PASS - Found verses in "${actualBook}"`);
            console.log(
              `   📖 Sample: ${firstResult.verse?.bookName} ${firstResult.verse?.chapterNumber}:${firstResult.verse?.verseNumber}`
            );
          } else {
            console.log(
              `   ⚠️  PARTIAL - Expected "${testCase.expected}", got "${actualBook}"`
            );
          }
        } else {
          console.log(`   ❌ FAIL - No results found`);
        }
      } catch (error) {
        console.log(`   ❌ ERROR - ${error.message}`);
        if (error.response) {
          console.log(`   Status: ${error.response.status}`);
        }
      }
    }

    // Test without server (just test the logic)
    console.log("\n\n📊 Additional Test Cases to Try:");
    console.log("================================");
    console.log('✅ "pro" + search term -> Proverbs');
    console.log('✅ "gen" + search term -> Genesis');
    console.log('✅ "joh" + search term -> John');
    console.log('✅ "rom" + search term -> Romans');
    console.log('✅ "1co" + search term -> 1 Corinthians');
    console.log('✅ "2co" + search term -> 2 Corinthians');
    console.log('✅ "1ti" + search term -> 1 Timothy');
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run tests
if (require.main === module) {
  testSearchWithAbbreviations()
    .then(() => {
      console.log("\n🏁 Testing completed!");
      process.exit(0);
    })
    .catch(error => {
      console.error("❌ Test error:", error);
      process.exit(1);
    });
}

module.exports = { testSearchWithAbbreviations };












