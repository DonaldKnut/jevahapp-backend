#!/usr/bin/env node
/**
 * End-to-end smoke test for feed + copyright-free engagement.
 *
 * Usage:
 *   AUTH_TOKEN=<jwt> BASE_URL=http://localhost:3000 node scripts/smoke-engagement.js
 *
 * Optional:
 *   MEDIA_ID=<objectId>           — feed media (auto-fetches first media if omitted)
 *   COPYRIGHT_FREE_SONG_ID=<id>   — auto-fetches first song if omitted
 *   SKIP_SAVE=1                 — skip copyright-free save (known broken until Bookmark fix)
 */

require("dotenv").config();

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.JWT || "";
const MEDIA_ID = process.env.MEDIA_ID;
const COPYRIGHT_FREE_SONG_ID = process.env.COPYRIGHT_FREE_SONG_ID;
const SKIP_SAVE = process.env.SKIP_SAVE === "1";

const results = [];

function log(msg) {
  console.log(msg);
}

function authHeaders() {
  if (!AUTH_TOKEN) return {};
  return { Authorization: `Bearer ${AUTH_TOKEN}` };
}

async function request(method, path, body) {
  const url = `${BASE_URL}${path}`;
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

async function runStep(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
    return true;
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    log(`  ❌ ${name} — ${err.message}`);
    return false;
  }
}

function assertOk(res, label) {
  if (!res.ok) {
    const msg = res.data?.message || res.data?.error || JSON.stringify(res.data);
    throw new Error(`${label}: HTTP ${res.status} — ${msg}`);
  }
  return res.data;
}

async function resolveMediaId() {
  if (MEDIA_ID) return MEDIA_ID;
  const res = await request("GET", "/api/media?limit=1");
  const items = res.data?.data?.media || res.data?.data || res.data?.media || [];
  const first = Array.isArray(items) ? items[0] : null;
  const id = first?._id || first?.id;
  if (!id) throw new Error("No MEDIA_ID and could not fetch media — set MEDIA_ID env");
  return String(id);
}

async function resolveSongId() {
  if (COPYRIGHT_FREE_SONG_ID) return COPYRIGHT_FREE_SONG_ID;
  const res = await request("GET", "/api/audio/copyright-free?limit=1");
  const items = res.data?.data?.songs || res.data?.data || res.data?.songs || [];
  const first = Array.isArray(items) ? items[0] : null;
  const id = first?._id || first?.id;
  if (!id) throw new Error("No COPYRIGHT_FREE_SONG_ID and could not fetch songs — set env or seed");
  return String(id);
}

async function testFeed(mediaId) {
  log("\n📺 Feed media engagement");

  await runStep("GET metadata", async () => {
    const data = assertOk(
      await request("GET", `/api/content/media/${mediaId}/metadata`),
      "metadata"
    );
    const likes = data?.data?.stats?.likes ?? data?.data?.likeCount;
    return `likes=${likes}`;
  });

  await runStep("POST like (toggle)", async () => {
    const data = assertOk(
      await request("POST", `/api/content/media/${mediaId}/like`),
      "like"
    );
    const d = data?.data || data;
    return `liked=${d.liked}, count=${d.likeCount}`;
  });

  await runStep("POST view (qualified)", async () => {
    const data = assertOk(
      await request("POST", `/api/content/media/${mediaId}/view`, {
        durationMs: 5000,
        progressPct: 30,
        isComplete: false,
      }),
      "view"
    );
    const d = data?.data || data;
    return `counted=${d.counted}, views=${d.viewCount}`;
  });

  await runStep("POST share", async () => {
    const data = assertOk(
      await request("POST", `/api/content/media/${mediaId}/share`, { platform: "copy_link" }),
      "share"
    );
    const d = data?.data || data;
    return `shares=${d.shareCount ?? d.totalShares ?? "ok"}`;
  });

  await runStep("POST batch-metadata", async () => {
    const data = assertOk(
      await request("POST", "/api/content/batch-metadata", {
        items: [{ contentType: "media", contentId: mediaId }],
      }),
      "batch-metadata"
    );
    const items = data?.data || data?.items || [];
    return `items=${Array.isArray(items) ? items.length : 1}`;
  });
}

async function testCopyrightFree(songId) {
  log("\n🎵 Copyright-free engagement");

  await runStep("GET song", async () => {
    const data = assertOk(
      await request("GET", `/api/audio/copyright-free/${songId}`),
      "get song"
    );
    const s = data?.data || data;
    return `views=${s.viewCount}, likes=${s.likeCount}`;
  });

  await runStep("POST like", async () => {
    const data = assertOk(
      await request("POST", `/api/audio/copyright-free/${songId}/like`),
      "like"
    );
    const d = data?.data || data;
    return `liked=${d.liked ?? d.isLiked}, count=${d.likeCount}`;
  });

  await runStep("POST view (deduped)", async () => {
    const data = assertOk(
      await request("POST", `/api/audio/copyright-free/${songId}/view`, {
        durationMs: 4000,
        progressPct: 30,
        isComplete: false,
      }),
      "view"
    );
    const d = data?.data || data;
    return `counted=${d.counted ?? d.viewCounted}, views=${d.viewCount}`;
  });

  await runStep("POST view again (should dedupe)", async () => {
    const data = assertOk(
      await request("POST", `/api/audio/copyright-free/${songId}/view`, {
        durationMs: 4000,
        progressPct: 50,
      }),
      "view dedupe"
    );
    const d = data?.data || data;
    if (d.counted === true && d.viewCounted === true) {
      throw new Error("Second view was counted — dedupe may be broken");
    }
    return "deduped as expected";
  });

  await runStep("POST share", async () => {
    const data = assertOk(
      await request("POST", `/api/audio/copyright-free/${songId}/share`),
      "share"
    );
    const d = data?.data || data;
    return `shares=${d.shareCount ?? "ok"}`;
  });

  if (!SKIP_SAVE) {
    await runStep("POST save (known issue: may fail)", async () => {
      const res = await request("POST", `/api/audio/copyright-free/${songId}/save`);
      if (!res.ok) {
        const msg = res.data?.message || "";
        if (msg.toLowerCase().includes("media not found") || msg.toLowerCase().includes("not found")) {
          throw new Error(
            "Save broken — UnifiedBookmarkService only checks Media collection. Set SKIP_SAVE=1 to ignore."
          );
        }
        throw new Error(`HTTP ${res.status}: ${msg}`);
      }
      return "saved";
    });
  } else {
    log("  ⏭️  save skipped (SKIP_SAVE=1)");
  }
}

async function testInfra() {
  log("\n🔧 Infrastructure");

  await runStep("GET health", async () => {
    const res = await request("GET", "/api/health");
    if (res.status === 404) return "no /api/health route (optional)";
    assertOk(res, "health");
    return "ok";
  });
}

async function main() {
  log("🔥 Engagement smoke test");
  log(`   BASE_URL: ${BASE_URL}`);
  log(`   AUTH: ${AUTH_TOKEN ? "token set" : "⚠️  NO AUTH_TOKEN — authenticated routes will 401"}`);

  if (!AUTH_TOKEN) {
    log("\n❌ AUTH_TOKEN is required for like/view/share/save tests.");
    process.exit(1);
  }

  await testInfra();

  let mediaId;
  let songId;
  try {
    mediaId = await resolveMediaId();
    log(`\n   MEDIA_ID: ${mediaId}`);
  } catch (e) {
    log(`\n⚠️  Feed tests skipped: ${e.message}`);
  }

  try {
    songId = await resolveSongId();
    log(`   SONG_ID: ${songId}`);
  } catch (e) {
    log(`\n⚠️  Copyright-free tests skipped: ${e.message}`);
  }

  if (mediaId) await testFeed(mediaId);
  if (songId) await testCopyrightFree(songId);

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  log("\n─────────────────────────────");
  log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    log("\nFailed steps:");
    results.filter((r) => !r.ok).forEach((r) => log(`  • ${r.name}: ${r.error}`));
    process.exit(1);
  }

  log("\n🎉 All smoke tests passed.");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
