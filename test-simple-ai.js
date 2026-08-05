const https = require("https");

async function testEndpoint() {
  console.log("🧪 Testing AI Content Description Endpoint...\n");

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
          console.log("✅ Successfully fetched content");
          console.log(`📊 Total items: ${response.total}`);
          console.log(`📋 Media items: ${response.media.length}\n`);

          // Analyze first few items
          const sampleItems = response.media.slice(0, 3);

          console.log("🔍 Sample Content Analysis:\n");

          sampleItems.forEach((item, index) => {
            console.log(`📋 Item ${index + 1}:`);
            console.log(`   Title: "${item.title}"`);
            console.log(
              `   Description: "${item.description || "No description"}"`
            );
            console.log(`   Author: ${item.authorInfo?.fullName || "Unknown"}`);
            console.log(`   Category: ${item.category || "N/A"}`);
            console.log(`   Type: ${item.contentType}`);
            console.log(`   Topics: ${item.topics?.join(", ") || "None"}`);
            console.log("");
          });

          // Count items with descriptions
          const itemsWithDescriptions = response.media.filter(
            item => item.description && item.description.trim().length > 0
          );

          console.log("📈 Summary:");
          console.log(`   Total Items: ${response.media.length}`);
          console.log(
            `   Items with Descriptions: ${itemsWithDescriptions.length}`
          );
          console.log(
            `   Items without Descriptions: ${response.media.length - itemsWithDescriptions.length}`
          );
          console.log(
            `   Description Coverage: ${((itemsWithDescriptions.length / response.media.length) * 100).toFixed(1)}%`
          );
        } else {
          console.log("❌ Failed to fetch content");
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

testEndpoint();
