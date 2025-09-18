#!/usr/bin/env node

/**
 * Test script for the fix-broken-urls functionality
 */

const { isBrokenUrl, fixUrl } = require("./scripts/fix-broken-urls");

console.log("🧪 Testing URL Fix Functions");
console.log("=".repeat(50));

// Test cases
const testCases = [
  {
    name: "Broken URL (your uploaded content)",
    url: "https://bDp9npjM_CVBCOUtyrsgKjLle3shpuJ64W_y7DYY/media-videos/1758170178011-alfm5b395.mp4",
    expected:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/media-videos/1758170178011-alfm5b395.mp4",
  },
  {
    name: "Broken thumbnail URL",
    url: "https://bDp9npjM_CVBCOUtyrsgKjLle3shpuJ64W_y7DYY/media-thumbnails/1758170179113-ytrt4c0n2.jpg",
    expected:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/media-thumbnails/1758170179113-ytrt4c0n2.jpg",
  },
  {
    name: "Good URL (seeded content)",
    url: "https://870e0e55f75d0d9434531d7518f57e92.r2.cloudflarestorage.com/jevah/jevah/media-music/kefee_thank-you-my-god.mp3",
    expected:
      "https://pub-17c463321ed44e22ba0d23a3505140ac.r2.dev/jevah/media-music/kefee_thank-you-my-god.mp3",
  },
  {
    name: "Null URL",
    url: null,
    expected: null,
  },
];

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.name}`);
  console.log(`   Input: ${testCase.url}`);

  const isBroken = isBrokenUrl(testCase.url);
  console.log(`   Is Broken: ${isBroken}`);

  if (isBroken) {
    const fixed = fixUrl(testCase.url);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Expected: ${testCase.expected}`);
    console.log(`   ✅ Match: ${fixed === testCase.expected ? "YES" : "NO"}`);
  } else {
    console.log(`   ✅ No fix needed`);
  }
});

console.log("\n🎉 Test completed!");
