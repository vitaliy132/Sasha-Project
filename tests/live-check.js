/**
 * Hit the live Render app to verify /health and /api/env-check.
 * Usage: BASE_URL=https://your-app.onrender.com node tests/live-check.js
 */
const base = process.env.BASE_URL || "http://localhost:3000";

async function check(name, url) {
  try {
    const res = await fetch(url);
    const ok = res.ok;
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    console.log(ok ? "✓" : "✗", name, res.status, body);
    return ok;
  } catch (err) {
    console.log("✗", name, err.message);
    return false;
  }
}

(async () => {
  console.log("Base URL:", base);
  const health = await check("GET /health", base + "/health");
  const env = await check("GET /api/env-check", base + "/api/env-check");
  const root = await check("GET /", base + "/");
  const code = health && env && root ? 0 : 1;
  process.exit(code);
})();
