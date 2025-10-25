const axios = require("axios");
const mongoose = require("mongoose");

// Load environment variables
require("dotenv").config();

// Configuration
const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const API_URL = `${BASE_URL}/api/bible`;

// Test data
const testData = {
  bookName: "John",
  chapterNumber: 3,
  verseNumber: 16,
  searchQuery: "love",
  reference: "John 3:16",
  rangeReference: "Psalm 23:1-6",
};

// Colors for console output
const colors = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, status, details = "") {
  const statusColor =
    status === "PASS" ? "green" : status === "FAIL" ? "red" : "yellow";
  const statusSymbol =
    status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️";

  log(`${statusSymbol} ${testName}: ${status}`, statusColor);
  if (details) {
    log(`   ${details}`, "blue");
  }
}

async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500,
    };
  }
}

async function testBibleBooks() {
  log("\n📚 Testing Bible Books Endpoints", "bold");

  // Test get all books
  const allBooks = await makeRequest("GET", "/books");
  if (
    allBooks.success &&
    allBooks.data.success &&
    allBooks.data.data.length > 0
  ) {
    logTest(
      "Get All Books",
      "PASS",
      `Found ${allBooks.data.data.length} books`
    );
  } else {
    logTest(
      "Get All Books",
      "FAIL",
      allBooks.error?.message || "No books found"
    );
  }

  // Test get old testament books
  const oldTestament = await makeRequest("GET", "/books/testament/old");
  if (oldTestament.success && oldTestament.data.success) {
    logTest(
      "Get Old Testament Books",
      "PASS",
      `Found ${oldTestament.data.data.length} books`
    );
  } else {
    logTest("Get Old Testament Books", "FAIL", oldTestament.error?.message);
  }

  // Test get new testament books
  const newTestament = await makeRequest("GET", "/books/testament/new");
  if (newTestament.success && newTestament.data.success) {
    logTest(
      "Get New Testament Books",
      "PASS",
      `Found ${newTestament.data.data.length} books`
    );
  } else {
    logTest("Get New Testament Books", "FAIL", newTestament.error?.message);
  }

  // Test get specific book
  const specificBook = await makeRequest("GET", `/books/${testData.bookName}`);
  if (specificBook.success && specificBook.data.success) {
    logTest(
      "Get Specific Book",
      "PASS",
      `Found book: ${specificBook.data.data.name}`
    );
  } else {
    logTest("Get Specific Book", "FAIL", specificBook.error?.message);
  }
}

async function testBibleChapters() {
  log("\n📖 Testing Bible Chapters Endpoints", "bold");

  // Test get chapters for a book
  const chapters = await makeRequest(
    "GET",
    `/books/${testData.bookName}/chapters`
  );
  if (chapters.success && chapters.data.success) {
    logTest(
      "Get Chapters for Book",
      "PASS",
      `Found ${chapters.data.data.length} chapters`
    );
  } else {
    logTest("Get Chapters for Book", "FAIL", chapters.error?.message);
  }

  // Test get specific chapter
  const chapter = await makeRequest(
    "GET",
    `/books/${testData.bookName}/chapters/${testData.chapterNumber}`
  );
  if (chapter.success && chapter.data.success) {
    logTest(
      "Get Specific Chapter",
      "PASS",
      `Found chapter ${chapter.data.data.chapterNumber}`
    );
  } else {
    logTest("Get Specific Chapter", "FAIL", chapter.error?.message);
  }
}

async function testBibleVerses() {
  log("\n📝 Testing Bible Verses Endpoints", "bold");

  // Test get verses for a chapter
  const verses = await makeRequest(
    "GET",
    `/books/${testData.bookName}/chapters/${testData.chapterNumber}/verses`
  );
  if (verses.success && verses.data.success) {
    logTest(
      "Get Verses for Chapter",
      "PASS",
      `Found ${verses.data.data.length} verses`
    );
  } else {
    logTest("Get Verses for Chapter", "FAIL", verses.error?.message);
  }

  // Test get specific verse
  const verse = await makeRequest(
    "GET",
    `/books/${testData.bookName}/chapters/${testData.chapterNumber}/verses/${testData.verseNumber}`
  );
  if (verse.success && verse.data.success) {
    logTest(
      "Get Specific Verse",
      "PASS",
      `Found verse: "${verse.data.data.text.substring(0, 50)}..."`
    );
  } else {
    logTest("Get Specific Verse", "FAIL", verse.error?.message);
  }

  // Test get verse range
  const verseRange = await makeRequest(
    "GET",
    `/verses/range/${testData.rangeReference}`
  );
  if (verseRange.success && verseRange.data.success) {
    logTest(
      "Get Verse Range",
      "PASS",
      `Found ${verseRange.data.data.length} verses`
    );
  } else {
    logTest("Get Verse Range", "FAIL", verseRange.error?.message);
  }
}

async function testBibleSearch() {
  log("\n🔍 Testing Bible Search Endpoints", "bold");

  // Test search Bible text
  const search = await makeRequest(
    "GET",
    `/search?q=${testData.searchQuery}&limit=5`
  );
  if (search.success && search.data.success) {
    logTest(
      "Search Bible Text",
      "PASS",
      `Found ${search.data.data.length} results`
    );
  } else {
    logTest("Search Bible Text", "FAIL", search.error?.message);
  }

  // Test search with book filter
  const searchWithBook = await makeRequest(
    "GET",
    `/search?q=${testData.searchQuery}&book=${testData.bookName}&limit=5`
  );
  if (searchWithBook.success && searchWithBook.data.success) {
    logTest(
      "Search with Book Filter",
      "PASS",
      `Found ${searchWithBook.data.data.length} results`
    );
  } else {
    logTest("Search with Book Filter", "FAIL", searchWithBook.error?.message);
  }

  // Test search with testament filter
  const searchWithTestament = await makeRequest(
    "GET",
    `/search?q=${testData.searchQuery}&testament=new&limit=5`
  );
  if (searchWithTestament.success && searchWithTestament.data.success) {
    logTest(
      "Search with Testament Filter",
      "PASS",
      `Found ${searchWithTestament.data.data.length} results`
    );
  } else {
    logTest(
      "Search with Testament Filter",
      "FAIL",
      searchWithTestament.error?.message
    );
  }
}

async function testBibleDiscovery() {
  log("\n🌟 Testing Bible Discovery Endpoints", "bold");

  // Test get random verse
  const randomVerse = await makeRequest("GET", "/verses/random");
  if (randomVerse.success && randomVerse.data.success) {
    logTest(
      "Get Random Verse",
      "PASS",
      `Found random verse from ${randomVerse.data.data.bookName}`
    );
  } else {
    logTest("Get Random Verse", "FAIL", randomVerse.error?.message);
  }

  // Test get verse of the day
  const verseOfTheDay = await makeRequest("GET", "/verses/daily");
  if (verseOfTheDay.success && verseOfTheDay.data.success) {
    logTest(
      "Get Verse of the Day",
      "PASS",
      `Found verse of the day from ${verseOfTheDay.data.data.bookName}`
    );
  } else {
    logTest("Get Verse of the Day", "FAIL", verseOfTheDay.error?.message);
  }

  // Test get popular verses
  const popularVerses = await makeRequest("GET", "/verses/popular?limit=5");
  if (popularVerses.success && popularVerses.data.success) {
    logTest(
      "Get Popular Verses",
      "PASS",
      `Found ${popularVerses.data.data.length} popular verses`
    );
  } else {
    logTest("Get Popular Verses", "FAIL", popularVerses.error?.message);
  }
}

async function testBibleStats() {
  log("\n📊 Testing Bible Statistics Endpoints", "bold");

  // Test get Bible stats
  const stats = await makeRequest("GET", "/stats");
  if (stats.success && stats.data.success) {
    const data = stats.data.data;
    logTest(
      "Get Bible Statistics",
      "PASS",
      `Books: ${data.totalBooks}, Chapters: ${data.totalChapters}, Verses: ${data.totalVerses}`
    );
  } else {
    logTest("Get Bible Statistics", "FAIL", stats.error?.message);
  }

  // Test get reading plans
  const readingPlans = await makeRequest("GET", "/reading-plans");
  if (readingPlans.success && readingPlans.data.success) {
    logTest(
      "Get Reading Plans",
      "PASS",
      `Found ${readingPlans.data.data.length} reading plans`
    );
  } else {
    logTest("Get Reading Plans", "FAIL", readingPlans.error?.message);
  }
}

async function testBibleStudyTools() {
  log("\n🔬 Testing Bible Study Tools Endpoints", "bold");

  // Test get cross-references
  const crossReferences = await makeRequest(
    "GET",
    `/books/${testData.bookName}/chapters/${testData.chapterNumber}/verses/${testData.verseNumber}/cross-references`
  );
  if (crossReferences.success && crossReferences.data.success) {
    logTest(
      "Get Cross-References",
      "PASS",
      `Found ${crossReferences.data.data.length} cross-references`
    );
  } else {
    logTest("Get Cross-References", "FAIL", crossReferences.error?.message);
  }

  // Test get commentary
  const commentary = await makeRequest(
    "GET",
    `/books/${testData.bookName}/chapters/${testData.chapterNumber}/verses/${testData.verseNumber}/commentary`
  );
  if (commentary.success && commentary.data.success) {
    logTest("Get Commentary", "PASS", "Commentary endpoint working");
  } else {
    logTest("Get Commentary", "FAIL", commentary.error?.message);
  }
}

async function testErrorHandling() {
  log("\n⚠️  Testing Error Handling", "bold");

  // Test invalid book name
  const invalidBook = await makeRequest("GET", "/books/InvalidBook");
  if (!invalidBook.success || !invalidBook.data.success) {
    logTest("Invalid Book Name", "PASS", "Correctly handled invalid book");
  } else {
    logTest(
      "Invalid Book Name",
      "FAIL",
      "Should have returned error for invalid book"
    );
  }

  // Test invalid chapter number
  const invalidChapter = await makeRequest(
    "GET",
    `/books/${testData.bookName}/chapters/999`
  );
  if (!invalidChapter.success || !invalidChapter.data.success) {
    logTest(
      "Invalid Chapter Number",
      "PASS",
      "Correctly handled invalid chapter"
    );
  } else {
    logTest(
      "Invalid Chapter Number",
      "FAIL",
      "Should have returned error for invalid chapter"
    );
  }

  // Test invalid verse number
  const invalidVerse = await makeRequest(
    "GET",
    `/books/${testData.bookName}/chapters/${testData.chapterNumber}/verses/999`
  );
  if (!invalidVerse.success || !invalidVerse.data.success) {
    logTest("Invalid Verse Number", "PASS", "Correctly handled invalid verse");
  } else {
    logTest(
      "Invalid Verse Number",
      "FAIL",
      "Should have returned error for invalid verse"
    );
  }

  // Test invalid reference format
  const invalidReference = await makeRequest(
    "GET",
    "/verses/range/InvalidReference"
  );
  if (!invalidReference.success || !invalidReference.data.success) {
    logTest(
      "Invalid Reference Format",
      "PASS",
      "Correctly handled invalid reference"
    );
  } else {
    logTest(
      "Invalid Reference Format",
      "FAIL",
      "Should have returned error for invalid reference"
    );
  }
}

async function runAllTests() {
  log("🧪 Starting Bible API Tests", "bold");
  log(`📍 Testing against: ${API_URL}`, "blue");
  log("=" * 50, "blue");

  try {
    await testBibleBooks();
    await testBibleChapters();
    await testBibleVerses();
    await testBibleSearch();
    await testBibleDiscovery();
    await testBibleStats();
    await testBibleStudyTools();
    await testErrorHandling();

    log("\n🎉 All Bible API tests completed!", "green");
    log("=" * 50, "green");
  } catch (error) {
    log(`\n❌ Test suite failed: ${error.message}`, "red");
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testBibleBooks,
  testBibleChapters,
  testBibleVerses,
  testBibleSearch,
  testBibleDiscovery,
  testBibleStats,
  testBibleStudyTools,
  testErrorHandling,
};
