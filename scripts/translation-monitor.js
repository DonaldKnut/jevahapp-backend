const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Import models
const {
  BibleBook,
  BibleChapter,
  BibleVerse,
  BIBLE_BOOKS,
} = require("../dist/models/bible.model");

// Configuration
const CONFIG = {
  ALERT_THRESHOLD: 0.8, // Alert if translation completeness is below 80%
  REPORT_FILE: "translation-completeness-report.json",
  LOG_FILE: "translation-monitor.log",
  WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || null, // Optional Slack notifications
};

// Expected verse counts per book (approximate)
const EXPECTED_VERSE_COUNTS = {
  "Genesis": 1533,
  "Exodus": 1213,
  "Leviticus": 859,
  "Numbers": 1288,
  "Deuteronomy": 959,
  "Joshua": 658,
  "Judges": 618,
  "Ruth": 85,
  "1 Samuel": 810,
  "2 Samuel": 695,
  "1 Kings": 816,
  "2 Kings": 719,
  "1 Chronicles": 942,
  "2 Chronicles": 822,
  "Ezra": 280,
  "Nehemiah": 406,
  "Esther": 167,
  "Job": 1070,
  "Psalms": 2461,
  "Proverbs": 915,
  "Ecclesiastes": 222,
  "Song of Solomon": 117,
  "Isaiah": 1292,
  "Jeremiah": 1364,
  "Lamentations": 154,
  "Ezekiel": 1273,
  "Daniel": 357,
  "Hosea": 197,
  "Joel": 73,
  "Amos": 146,
  "Obadiah": 21,
  "Jonah": 48,
  "Micah": 105,
  "Nahum": 47,
  "Habakkuk": 56,
  "Zephaniah": 53,
  "Haggai": 38,
  "Zechariah": 211,
  "Malachi": 55,
  "Matthew": 1071,
  "Mark": 678,
  "Luke": 1151,
  "John": 879,
  "Acts": 1007,
  "Romans": 433,
  "1 Corinthians": 437,
  "2 Corinthians": 257,
  "Galatians": 149,
  "Ephesians": 155,
  "Philippians": 104,
  "Colossians": 95,
  "1 Thessalonians": 89,
  "2 Thessalonians": 47,
  "1 Timothy": 113,
  "2 Timothy": 83,
  "Titus": 46,
  "Philemon": 25,
  "Hebrews": 303,
  "James": 108,
  "1 Peter": 105,
  "2 Peter": 61,
  "1 John": 105,
  "2 John": 13,
  "3 John": 15,
  "Jude": 25,
  "Revelation": 404
};

// Logging
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  
  try {
    fs.appendFileSync(CONFIG.LOG_FILE, logMessage + '\n');
  } catch (error) {
    // Ignore logging errors
  }
}

// Send alert notification
async function sendAlert(message, severity = 'WARNING') {
  log(`🚨 ALERT [${severity}]: ${message}`, 'ALERT');
  
  if (CONFIG.WEBHOOK_URL) {
    try {
      const axios = require('axios');
      await axios.post(CONFIG.WEBHOOK_URL, {
        text: `🚨 Bible Translation Monitor Alert`,
        attachments: [{
          color: severity === 'CRITICAL' ? 'danger' : 'warning',
          fields: [{
            title: 'Message',
            value: message,
            short: false
          }, {
            title: 'Timestamp',
            value: new Date().toISOString(),
            short: true
          }]
        }]
      });
    } catch (error) {
      log(`Failed to send Slack alert: ${error.message}`, 'ERROR');
    }
  }
}

// Get translation completeness report
async function getTranslationCompleteness() {
  try {
    log("📊 Analyzing translation completeness...");
    
    // Get all translations
    const translations = await BibleVerse.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$translation", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const report = {
      timestamp: new Date().toISOString(),
      translations: {},
      summary: {
        totalTranslations: translations.length,
        averageCompleteness: 0,
        criticalIssues: [],
        warnings: []
      }
    };

    let totalCompleteness = 0;
    const totalExpectedVerses = Object.values(EXPECTED_VERSE_COUNTS).reduce((sum, count) => sum + count, 0);

    for (const translation of translations) {
      const code = translation._id;
      const count = translation.count;
      const completeness = count / totalExpectedVerses;
      
      report.translations[code] = {
        count,
        expected: totalExpectedVerses,
        completeness: Math.round(completeness * 100) / 100,
        status: completeness >= CONFIG.ALERT_THRESHOLD ? 'HEALTHY' : 'INCOMPLETE'
      };

      totalCompleteness += completeness;

      // Check for critical issues
      if (completeness < 0.1) {
        report.summary.criticalIssues.push(`${code}: Only ${Math.round(completeness * 100)}% complete`);
      } else if (completeness < CONFIG.ALERT_THRESHOLD) {
        report.summary.warnings.push(`${code}: ${Math.round(completeness * 100)}% complete`);
      }
    }

    report.summary.averageCompleteness = Math.round((totalCompleteness / translations.length) * 100) / 100;

    // Detailed book-by-book analysis
    report.bookAnalysis = {};
    for (const book of BIBLE_BOOKS) {
      const expectedCount = EXPECTED_VERSE_COUNTS[book.name] || 0;
      report.bookAnalysis[book.name] = {};
      
      for (const translation of translations) {
        const code = translation._id;
        const bookCount = await BibleVerse.countDocuments({
          bookName: book.name,
          translation: code,
          isActive: true
        });
        
        const bookCompleteness = expectedCount > 0 ? bookCount / expectedCount : 0;
        report.bookAnalysis[book.name][code] = {
          count: bookCount,
          expected: expectedCount,
          completeness: Math.round(bookCompleteness * 100) / 100
        };
      }
    }

    return report;
  } catch (error) {
    log(`Error generating completeness report: ${error.message}`, 'ERROR');
    throw error;
  }
}

// Check for missing verses in specific ranges
async function checkMissingVerses(translation, bookName, startChapter = 1, endChapter = null) {
  try {
    const book = BIBLE_BOOKS.find(b => b.name === bookName);
    if (!book) {
      throw new Error(`Book not found: ${bookName}`);
    }

    const endChapterNum = endChapter || book.chapters;
    const missingVerses = [];

    for (let chapterNum = startChapter; chapterNum <= endChapterNum; chapterNum++) {
      // Get WEB verses for this chapter
      const webVerses = await BibleVerse.find({
        bookName: bookName,
        chapterNumber: chapterNum,
        translation: "WEB",
        isActive: true
      }).sort({ verseNumber: 1 });

      // Get translation verses for this chapter
      const translationVerses = await BibleVerse.find({
        bookName: bookName,
        chapterNumber: chapterNum,
        translation: translation,
        isActive: true
      }).sort({ verseNumber: 1 });

      const webVerseNumbers = new Set(webVerses.map(v => v.verseNumber));
      const translationVerseNumbers = new Set(translationVerses.map(v => v.verseNumber));

      // Find missing verses
      for (const verseNumber of webVerseNumbers) {
        if (!translationVerseNumbers.has(verseNumber)) {
          missingVerses.push({
            bookName,
            chapterNumber: chapterNum,
            verseNumber,
            translation
          });
        }
      }
    }

    return missingVerses;
  } catch (error) {
    log(`Error checking missing verses: ${error.message}`, 'ERROR');
    throw error;
  }
}

// Generate detailed report
async function generateDetailedReport() {
  try {
    log("📋 Generating detailed translation report...");
    
    const report = await getTranslationCompleteness();
    
    // Add missing verse analysis for each translation
    for (const translationCode of Object.keys(report.translations)) {
      if (translationCode === 'WEB') continue; // Skip WEB as it's the reference
      
      const missingVerses = await checkMissingVerses(translationCode, 'John', 1, 3); // Sample check
      report.translations[translationCode].sampleMissingVerses = missingVerses.slice(0, 10); // First 10 missing
    }

    // Save report to file
    fs.writeFileSync(CONFIG.REPORT_FILE, JSON.stringify(report, null, 2));
    log(`📄 Report saved to ${CONFIG.REPORT_FILE}`);

    return report;
  } catch (error) {
    log(`Error generating detailed report: ${error.message}`, 'ERROR');
    throw error;
  }
}

// Main monitoring function
async function monitorTranslations() {
  try {
    log("🔍 Starting translation monitoring...");
    
    // Connect to database
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app"
    );
    log("✅ Connected to database");

    // Generate report
    const report = await generateDetailedReport();

    // Display summary
    log("\n📊 TRANSLATION COMPLETENESS SUMMARY:");
    log("=====================================");
    
    for (const [code, data] of Object.entries(report.translations)) {
      const status = data.status === 'HEALTHY' ? '✅' : '⚠️';
      log(`${status} ${code}: ${data.count.toLocaleString()}/${data.expected.toLocaleString()} (${Math.round(data.completeness * 100)}%)`);
    }

    log(`\n📈 Average Completeness: ${Math.round(report.summary.averageCompleteness * 100)}%`);

    // Send alerts for critical issues
    if (report.summary.criticalIssues.length > 0) {
      await sendAlert(`Critical translation issues detected:\n${report.summary.criticalIssues.join('\n')}`, 'CRITICAL');
    }

    if (report.summary.warnings.length > 0) {
      await sendAlert(`Translation warnings:\n${report.summary.warnings.join('\n')}`, 'WARNING');
    }

    // Check for recent errors in seeding logs
    if (fs.existsSync('translation-seeding.log')) {
      const logContent = fs.readFileSync('translation-seeding.log', 'utf8');
      const recentErrors = logContent.split('\n').filter(line => 
        line.includes('[ERROR]') && 
        new Date(line.split(']')[0].replace('[', '')) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
      
      if (recentErrors.length > 0) {
        await sendAlert(`Recent seeding errors detected: ${recentErrors.length} errors in last 24h`, 'WARNING');
      }
    }

    log("\n✅ Monitoring completed successfully!");

  } catch (error) {
    log(`❌ Monitoring failed: ${error.message}`, 'ERROR');
    await sendAlert(`Translation monitoring failed: ${error.message}`, 'CRITICAL');
    throw error;
  } finally {
    await mongoose.connection.close();
    log("✅ Database connection closed");
  }
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'monitor';

  try {
    switch (command) {
      case 'monitor':
        await monitorTranslations();
        break;
      case 'report':
        await generateDetailedReport();
        break;
      case 'check-missing':
        const translation = args[1];
        const book = args[2] || 'John';
        const startChapter = parseInt(args[3]) || 1;
        const endChapter = parseInt(args[4]) || null;
        
        if (!translation) {
          console.log('Usage: node translation-monitor.js check-missing <translation> [book] [startChapter] [endChapter]');
          process.exit(1);
        }
        
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/jevah-app");
        const missing = await checkMissingVerses(translation, book, startChapter, endChapter);
        console.log(`Missing verses in ${translation} for ${book}:`, missing);
        await mongoose.connection.close();
        break;
      default:
        console.log('Usage: node translation-monitor.js [monitor|report|check-missing]');
        process.exit(1);
    }
  } catch (error) {
    log(`❌ Command failed: ${error.message}`, 'ERROR');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  monitorTranslations,
  generateDetailedReport,
  checkMissingVerses,
  getTranslationCompleteness
};







