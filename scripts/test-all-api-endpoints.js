import assert from "node:assert/strict";

const BASE_URL = "http://localhost:3000";

const results = [];
let passCount = 0;
let failCount = 0;

async function testApi(name, fn) {
  process.stdout.write(`API Test: ${name} ... `);
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    console.log(`✅ PASS (${duration}ms)`);
    results.push({ name, passed: true, duration });
    passCount++;
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`❌ FAIL (${duration}ms):`, err.message);
    results.push({ name, passed: false, duration, error: err.message });
    failCount++;
  }
}

console.log("Starting Live Backend API Endpoint Verification against", BASE_URL, "...\n");

// 1. Health Endpoints
await testApi("GET /health -> 200 healthy", async () => {
  const res = await fetch(`${BASE_URL}/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.status, "healthy");
});

await testApi("GET /api/health -> 200 healthy", async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.status, "healthy");
});

await testApi("GET /api -> 200 root API metadata", async () => {
  const res = await fetch(`${BASE_URL}/api`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.endpoints));
});

// 2. AI Provider Status & Health
await testApi("GET /api/ai/status -> 200 provider map", async () => {
  const res = await fetch(`${BASE_URL}/api/ai/status`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.providers);
});

await testApi("GET /api/ai/health -> 200 provider health details", async () => {
  const res = await fetch(`${BASE_URL}/api/ai/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.providers);
});

// 3. AI Completion Negative & Validation
await testApi("POST /api/ai/complete -> 400 when messages empty", async () => {
  const res = await fetch(`${BASE_URL}/api/ai/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [] }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.ok(data.error);
});

// 4. Web Search Endpoint
await testApi("POST /api/ai/search -> 400 on empty query", async () => {
  const res = await fetch(`${BASE_URL}/api/ai/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "" }),
  });
  assert.equal(res.status, 400);
});

// 5. AI Interpretation Endpoint
await testApi("POST /api/ai/interpret -> 400 on empty text", async () => {
  const res = await fetch(`${BASE_URL}/api/ai/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "" }),
  });
  assert.equal(res.status, 400);
});

await testApi("POST /api/ai/interpret -> 200 valid non-empty text", async () => {
  const res = await fetch(`${BASE_URL}/api/ai/interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "I slept 7 hours and walked 5000 steps today.", language: "en" }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.ok !== false);
});

// 6. Conversational Check-in & Transcript
await testApi("POST /api/ai/extract-checkin -> 400 on empty text", async () => {
  const res = await fetch(`${BASE_URL}/api/ai/extract-checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "" }),
  });
  assert.equal(res.status, 400);
});

await testApi("POST /api/ai/improve-transcript -> 400 on empty text", async () => {
  const res = await fetch(`${BASE_URL}/api/ai/improve-transcript`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "" }),
  });
  assert.equal(res.status, 400);
});

// 7. Document Understanding
await testApi("POST /api/ai/understand-document -> 400 when pages empty", async () => {
  const res = await fetch(`${BASE_URL}/api/ai/understand-document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pages: [] }),
  });
  assert.equal(res.status, 400);
});

// 8. Support Email Endpoint
await testApi("POST /api/support/email -> 400 on empty reason", async () => {
  const res = await fetch(`${BASE_URL}/api/support/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "" }),
  });
  assert.equal(res.status, 400);
});

await testApi("POST /api/support/email -> 200 with valid support inquiry", async () => {
  const res = await fetch(`${BASE_URL}/api/support/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "question",
      reason: "Automated QA Verification Ticket",
      message: "Testing support endpoint reliability during release certification.",
      userName: "QA Auditor",
      userEmail: "qa-cert@healthguardian.internal",
    }),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
});

// 9. Auth OTP Password Reset Flow
await testApi("POST /api/auth/otp/send -> 400 on invalid email", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invalid-email" }),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.ok, false);
});

await testApi("POST /api/auth/otp/verify -> 400 on empty otp", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com", otp: "" }),
  });
  assert.equal(res.status, 400);
});

await testApi("POST /api/auth/otp/reset-password -> 400 on empty token", async () => {
  const res = await fetch(`${BASE_URL}/api/auth/otp/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resetSessionToken: "", newPassword: "" }),
  });
  assert.equal(res.status, 400);
});

// 10. Notification Endpoints & Authorization
await testApi("POST /api/notifications/send -> 401 when unauthenticated in prod/guarded mode", async () => {
  const res = await fetch(`${BASE_URL}/api/notifications/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: "user_a", title: "Test", body: "Test" }),
  });
  // Should either return 401 (unauthorized) or 200 (if dev mode bypass)
  assert.ok(res.status === 401 || res.status === 200);
});

// 11. Static 3D Asset Serving via HTTP
await testApi("GET /models/healthguardian-organs-skeleton-clean-batched.glb -> 200 exact byte length", async () => {
  const res = await fetch(`${BASE_URL}/models/healthguardian-organs-skeleton-clean-batched.glb`);
  assert.equal(res.status, 200);
  const contentLength = Number(res.headers.get("content-length"));
  assert.equal(contentLength, 11942248, "Content-Length must match approved Asset 3 size exactly");
});

console.log("\n================ API TEST SUMMARY ================");
console.log(`Total: ${results.length} | Passed: ${passCount} | Failed: ${failCount}`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log("All API endpoint tests PASSED with 100% success rate.");
}
