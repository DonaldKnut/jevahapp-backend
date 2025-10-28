#!/usr/bin/env node

const { spawn } = require("child_process");
const path = require("path");

// Configuration
const SCRIPTS = {
  seed: {
    path: path.join(__dirname, "seed-complete-bible.js"),
    description: "Seed database with complete Bible text (31,000+ verses)",
    estimatedTime: "15-25 minutes",
  },
  test: {
    path: path.join(__dirname, "test-complete-bible.js"),
    description: "Test all Bible API endpoints",
    estimatedTime: "5-10 minutes",
  },
  verify: {
    path: path.join(__dirname, "verify-bible-search.js"),
    description: "Verify search functionality with full dataset",
    estimatedTime: "10-15 minutes",
  },
};

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, type = "info") {
  const timestamp = new Date().toLocaleTimeString();
  const prefix =
    type === "error"
      ? "❌"
      : type === "success"
        ? "✅"
        : type === "warning"
          ? "⚠️"
          : "ℹ️";
  console.log(`${colorize(`[${timestamp}]`, "cyan")} ${prefix} ${message}`);
}

function runScript(scriptName, scriptConfig) {
  return new Promise((resolve, reject) => {
    log(`Starting ${scriptName}: ${scriptConfig.description}`, "info");
    log(`Estimated time: ${scriptConfig.estimatedTime}`, "info");

    const child = spawn("node", [scriptConfig.path], {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    child.on("close", code => {
      if (code === 0) {
        log(`${scriptName} completed successfully!`, "success");
        resolve();
      } else {
        log(`${scriptName} failed with exit code ${code}`, "error");
        reject(new Error(`Script ${scriptName} failed with exit code ${code}`));
      }
    });

    child.on("error", error => {
      log(`${scriptName} failed to start: ${error.message}`, "error");
      reject(error);
    });
  });
}

async function runCompleteBibleSetup() {
  try {
    console.log(colorize("\n🌱 COMPLETE BIBLE SETUP", "bright"));
    console.log(colorize("========================", "bright"));
    console.log(
      "This will set up your Bible API with complete text and test all functionality.\n"
    );

    const startTime = new Date();

    // Step 1: Seed the database
    log("Step 1/3: Seeding database with complete Bible text...", "info");
    await runScript("Bible Seeding", SCRIPTS.seed);

    // Step 2: Test API functionality
    log("Step 2/3: Testing Bible API functionality...", "info");
    await runScript("API Testing", SCRIPTS.test);

    // Step 3: Verify search functionality
    log("Step 3/3: Verifying search functionality...", "info");
    await runScript("Search Verification", SCRIPTS.verify);

    const duration = new Date() - startTime;
    const minutes = Math.round(duration / 60000);

    console.log(colorize("\n🎉 COMPLETE BIBLE SETUP FINISHED!", "bright"));
    console.log(colorize("==================================", "bright"));
    log(`Total time: ${minutes} minutes`, "success");
    log("Your Bible API is now fully set up and tested!", "success");

    console.log(colorize("\n📊 What was accomplished:", "bright"));
    console.log("✅ Fetched and seeded 31,000+ Bible verses");
    console.log("✅ Tested all Bible API endpoints");
    console.log("✅ Verified search functionality");
    console.log("✅ Performance tested");
    console.log("✅ Edge cases handled");

    console.log(colorize("\n🚀 Your Bible API is ready to use!", "bright"));
    console.log("You can now:");
    console.log("• Search through all Bible verses");
    console.log("• Access any book, chapter, or verse");
    console.log("• Use advanced search features");
    console.log("• Get random verses and daily verses");
    console.log("• Access Bible statistics");
  } catch (error) {
    log(`Setup failed: ${error.message}`, "error");
    process.exit(1);
  }
}

async function runIndividualScript() {
  const args = process.argv.slice(2);
  const scriptName = args[0];

  if (!scriptName || !SCRIPTS[scriptName]) {
    console.log(colorize("\n📖 Complete Bible Setup Script", "bright"));
    console.log(colorize("==============================", "bright"));
    console.log("\nUsage:");
    console.log(
      "  node run-complete-bible-setup.js              # Run complete setup"
    );
    console.log(
      "  node run-complete-bible-setup.js seed         # Run seeding only"
    );
    console.log(
      "  node run-complete-bible-setup.js test         # Run testing only"
    );
    console.log(
      "  node run-complete-bible-setup.js verify       # Run verification only"
    );
    console.log(
      "  node run-complete-bible-setup.js help         # Show this help"
    );

    console.log(colorize("\nAvailable Scripts:", "bright"));
    Object.entries(SCRIPTS).forEach(([name, config]) => {
      console.log(`  ${name.padEnd(8)} - ${config.description}`);
      console.log(
        `  ${" ".repeat(8)}   Estimated time: ${config.estimatedTime}`
      );
    });

    console.log(colorize("\nComplete Setup Process:", "bright"));
    console.log("1. Seed database with complete Bible text (31,000+ verses)");
    console.log("2. Test all Bible API endpoints");
    console.log("3. Verify search functionality with full dataset");
    console.log("\nTotal estimated time: 30-50 minutes");

    return;
  }

  if (scriptName === "help") {
    runIndividualScript();
    return;
  }

  try {
    log(`Running ${scriptName} script only...`, "info");
    await runScript(scriptName, SCRIPTS[scriptName]);
    log(`${scriptName} completed successfully!`, "success");
  } catch (error) {
    log(`${scriptName} failed: ${error.message}`, "error");
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    runCompleteBibleSetup();
  } else {
    runIndividualScript();
  }
}

module.exports = { runCompleteBibleSetup, runIndividualScript };




