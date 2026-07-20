#!/usr/bin/env node
/**
 * Contabo / staging latency baseline (p50 / p95) for the shareholder pack.
 *
 * Usage:
 *   AUTH_TOKEN=<jwt> BASE_URL=https://api.yourhost.com npm run measure:latency
 *
 * Optional:
 *   MEDIA_ID=<objectId>     — feed media for like/metadata (auto-resolves if omitted)
 *   SAMPLES=20              — samples per timed endpoint (default 20)
 *   SKIP_LIKE=1             — skip like toggles (avoids flipping state)
 *   ADMIN_TOKEN=<jwt>       — if set (or AUTH_TOKEN is admin), also hit /api/metrics
 *
 * Prints a markdown table you can paste into docs/PERFORMANCE.md §11.
 */

require("dotenv").config();
const { randomUUID } = require("crypto");

const BASE_URL = (process.env.BASE_URL || process.env.API_URL || "http://localhost:4000").replace(
  /\/$/,
  ""
);
const AUTH_TOKEN = process.env.AUTH_TOKEN || process.env.JWT || process.env.ADMIN_TOKEN || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || AUTH_TOKEN;
const MEDIA_ID_ENV = process.env.MEDIA_ID;
const SAMPLES = Math.max(5, Math.min(100, parseInt(process.env.SAMPLES || "20", 10) || 20));
const SKIP_LIKE = process.env.SKIP_LIKE === "1";

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

function stats(samples) {
  const ok = samples.filter(s => s.ok).map(s => s.ms);
  const sorted = [...ok].sort((a, b) => a - b);
  const fail = samples.length - ok.length;
  return {
    n: samples.length,
    ok: ok.length,
    fail,
    min: sorted[0] ?? null,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1] ?? null,
    avg: ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null,
  };
}

function authHeaders(token = AUTH_TOKEN) {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function timedRequest(method, path, opts = {}) {
  const url = `${BASE_URL}${path}`;
  const start = Date.now();
  let status = 0;
  let ok = false;
  let error = null;
  let data = null;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(opts.token),
        ...(opts.headers || {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    status = res.status;
    ok = res.ok;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!ok) {
      error = data?.message || data?.code || `HTTP ${status}`;
    }
  } catch (err) {
    error = err.message || String(err);
  }
  return { ms: Date.now() - start, ok, status, error, data };
}

async function sample(name, n, fn) {
  const samples = [];
  process.stdout.write(`\n⏱  ${name} × ${n}…`);
  for (let i = 0; i < n; i++) {
    const r = await fn(i);
    samples.push(r);
    process.stdout.write(r.ok ? "." : "x");
  }
  process.stdout.write("\n");
  return { name, samples, ...stats(samples) };
}

async function resolveMediaId() {
  if (MEDIA_ID_ENV) return MEDIA_ID_ENV;
  const r = await timedRequest("GET", "/api/media/all-content?page=1&limit=1", {
    token: AUTH_TOKEN,
  });
  const items =
    r.data?.data?.media ||
    r.data?.data?.items ||
    r.data?.data ||
    r.data?.media ||
    [];
  const list = Array.isArray(items) ? items : [];
  const first = list[0];
  const id = first?._id || first?.id || first?.mediaId;
  if (!id) {
    throw new Error("Set MEDIA_ID — could not auto-resolve from feed");
  }
  return String(id);
}

function fmt(ms) {
  return ms == null ? "—" : `${ms} ms`;
}

function printTable(rows) {
  console.log("\n## Latency baseline\n");
  console.log(`Base URL: \`${BASE_URL}\``);
  console.log(`Samples per endpoint: **${SAMPLES}**`);
  console.log(`Captured: ${new Date().toISOString()}\n`);
  console.log("| Endpoint | ok/n | min | p50 | p95 | max | avg |");
  console.log("|----------|------|-----|-----|-----|-----|-----|");
  for (const r of rows) {
    console.log(
      `| ${r.name} | ${r.ok}/${r.n} | ${fmt(r.min)} | ${fmt(r.p50)} | ${fmt(r.p95)} | ${fmt(r.max)} | ${fmt(r.avg)} |`
    );
  }
  console.log(
    "\nPaste into `docs/PERFORMANCE.md` §11 (Resource snapshot) or the board pack.\n"
  );
}

async function main() {
  console.log(`Measuring against ${BASE_URL}`);
  if (!AUTH_TOKEN) {
    console.warn("⚠️  No AUTH_TOKEN — authenticated routes will fail (health still runs).");
  }

  const rows = [];

  rows.push(
    await sample("GET /api/health/warmup", SAMPLES, () =>
      timedRequest("GET", "/api/health/warmup")
    )
  );

  rows.push(
    await sample("GET /api/health/full", Math.min(10, SAMPLES), () =>
      timedRequest("GET", "/api/health/full")
    )
  );

  rows.push(
    await sample("GET /api/health/database", Math.min(10, SAMPLES), () =>
      timedRequest("GET", "/api/health/database")
    )
  );

  if (AUTH_TOKEN) {
    let mediaId;
    try {
      mediaId = await resolveMediaId();
      console.log(`Using MEDIA_ID=${mediaId}`);
    } catch (err) {
      console.warn(`⚠️  ${err.message}`);
    }

    rows.push(
      await sample("GET /api/media/all-content?limit=10", SAMPLES, () =>
        timedRequest("GET", "/api/media/all-content?page=1&limit=10")
      )
    );

    if (mediaId) {
      rows.push(
        await sample(`GET /api/content/media/:id/metadata`, SAMPLES, () =>
          timedRequest("GET", `/api/content/media/${mediaId}/metadata`)
        )
      );

      if (!SKIP_LIKE) {
        rows.push(
          await sample(`POST /api/content/media/:id/like`, SAMPLES, () =>
            timedRequest("POST", `/api/content/media/${mediaId}/like`, {
              headers: { "Idempotency-Key": randomUUID() },
            })
          )
        );

        // Replays should be faster — same key twice
        const replayKey = randomUUID();
        await timedRequest("POST", `/api/content/media/${mediaId}/like`, {
          headers: { "Idempotency-Key": replayKey },
        });
        rows.push(
          await sample(`POST like (idempotency replay)`, Math.min(10, SAMPLES), () =>
            timedRequest("POST", `/api/content/media/${mediaId}/like`, {
              headers: { "Idempotency-Key": replayKey },
            })
          )
        );
      }
    }

    rows.push(
      await sample("GET /api/metrics (admin)", Math.min(5, SAMPLES), () =>
        timedRequest("GET", "/api/metrics", { token: ADMIN_TOKEN })
      )
    );
  }

  printTable(rows);

  const likeRow = rows.find(r => r.name.includes("/like") && !r.name.includes("replay"));
  if (likeRow?.p95 != null) {
    const target = 500;
    if (likeRow.p95 <= target) {
      console.log(`✅ Like p95 ${likeRow.p95} ms ≤ ${target} ms target`);
    } else {
      console.log(`⚠️  Like p95 ${likeRow.p95} ms > ${target} ms target — investigate Atlas/Redis`);
    }
  }

  const failedHard = rows.some(r => r.ok === 0 && r.name.includes("warmup"));
  process.exit(failedHard ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
