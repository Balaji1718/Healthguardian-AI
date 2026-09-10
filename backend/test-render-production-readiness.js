import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'frontend/dist');
const TEST_PORT = 3847;

const PROVIDER_SECRETS = [
  'OPENROUTER_API_KEY',
  'GROQ_API_KEY',
  'NVIDIA_API_KEY',
  'MISTRAL_API_KEY',
  'SAMBANOVA_API_KEY',
  'COHERE_API_KEY',
  'CEREBRAS_API_KEY',
];

function fetchEndpoint(endpointPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${TEST_PORT}${endpointPath}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${endpointPath}`));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('=======================================================');
  console.log('  HealthGuardian AI — Phase 12A Render Readiness Audit');
  console.log('=======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Frontend Build Output Audit
  // -------------------------------------------------------------
  console.log('[1. Frontend Dist Output Audit]');
  assert(fs.existsSync(distDir), 'frontend/dist directory exists');
  assert(fs.existsSync(path.join(distDir, 'index.html')), 'dist/index.html exists');
  assert(fs.existsSync(path.join(distDir, 'manifest.webmanifest')), 'dist/manifest.webmanifest exists');
  assert(fs.existsSync(path.join(distDir, 'sw.js')), 'dist/sw.js exists');
  assert(fs.existsSync(path.join(distDir, 'pwa-192.png')), 'dist/pwa-192.png exists');
  assert(fs.existsSync(path.join(distDir, 'pwa-512.png')), 'dist/pwa-512.png exists');
  assert(fs.existsSync(path.join(distDir, 'favicon-32.png')), 'dist/favicon-32.png exists');

  // -------------------------------------------------------------
  // Test 2: Secret Scan on Dist
  // -------------------------------------------------------------
  console.log('\n[2. Secret Scan on Frontend Dist]');
  const assetsDir = path.join(distDir, 'assets');
  let leakedSecretFound = false;
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    for (const file of files) {
      if (file.endsWith('.js')) {
        const content = fs.readFileSync(path.join(assetsDir, file), 'utf8');
        for (const secretKey of PROVIDER_SECRETS) {
          if (content.includes(secretKey)) {
            console.error(`  Found ${secretKey} in ${file}!`);
            leakedSecretFound = true;
          }
        }
      }
    }
  }
  assert(!leakedSecretFound, 'Zero AI provider secret names found in frontend bundle');

  // -------------------------------------------------------------
  // Test 3: Start Node Server in Production Mode
  // -------------------------------------------------------------
  console.log('\n[3. Production Server Startup]');
  const serverProcess = spawn('node', ['server.js'], {
    cwd: path.join(rootDir, 'backend'),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(TEST_PORT),
      HOST: '0.0.0.0',
    },
    stdio: 'pipe',
  });

  let serverStarted = false;
  let serverOutput = '';
  serverProcess.stdout.on('data', (d) => {
    serverOutput += d.toString();
    if (serverOutput.includes('HealthGuardian app running')) {
      serverStarted = true;
    }
  });

  serverProcess.stderr.on('data', (d) => {
    console.error(`[Server stderr]: ${d.toString()}`);
  });

  // Wait up to 20s for server to start
  for (let i = 0; i < 100; i++) {
    if (serverStarted) break;
    await sleep(200);
  }
  assert(serverStarted, `Production server started and listening on port ${TEST_PORT}`);

  try {
    // -------------------------------------------------------------
    // Test 4: Root & Health Check Endpoints
    // -------------------------------------------------------------
    console.log('\n[4. Health Check Endpoints]');
    const rootRes = await fetchEndpoint('/');
    assert(rootRes.statusCode === 200, 'GET / returns HTTP 200');
    assert(rootRes.headers['content-type']?.includes('text/html'), 'GET / returns text/html');
    assert(rootRes.body.includes('HealthGuardian AI'), 'GET / HTML contains HealthGuardian AI title');

    const healthRes = await fetchEndpoint('/api/health');
    assert(healthRes.statusCode === 200, 'GET /api/health returns HTTP 200');
    const healthJson = JSON.parse(healthRes.body);
    assert(healthJson.ok === true && healthJson.status === 'healthy', 'GET /api/health returns { ok: true, status: "healthy" }');

    const basicHealthRes = await fetchEndpoint('/health');
    assert(basicHealthRes.statusCode === 200, 'GET /health returns HTTP 200');

    // -------------------------------------------------------------
    // Test 5: AI Status Endpoints
    // -------------------------------------------------------------
    console.log('\n[5. AI Status Endpoints]');
    const aiStatusRes = await fetchEndpoint('/api/ai/status');
    assert(aiStatusRes.statusCode === 200, 'GET /api/ai/status returns HTTP 200');
    const aiStatusJson = JSON.parse(aiStatusRes.body);
    assert(Array.isArray(aiStatusJson.providers), 'GET /api/ai/status returns providers array');
    assert(!aiStatusRes.body.includes('sk-') && !aiStatusRes.body.includes('gsk_'), 'GET /api/ai/status does not expose secret keys');

    const aiHealthRes = await fetchEndpoint('/api/ai/health');
    assert(aiHealthRes.statusCode === 200, 'GET /api/ai/health returns HTTP 200');
    const aiHealthJson = JSON.parse(aiHealthRes.body);
    assert(typeof aiHealthJson.providers === 'object', 'GET /api/ai/health returns provider health');

    // -------------------------------------------------------------
    // Test 6: SPA Client-Side Routes Fallback
    // -------------------------------------------------------------
    console.log('\n[6. SPA Client Routes Direct Access & Refresh Support]');
    const spaRoutes = [
      '/auth',
      '/app/dashboard',
      '/app/checkin',
      '/app/history',
      '/app/reports',
      '/app/risk',
      '/app/assistant',
      '/app/goals',
      '/app/notifications',
      '/app/specialist',
      '/app/support',
      '/app/settings',
      '/app/guide',
    ];

    for (const route of spaRoutes) {
      const res = await fetchEndpoint(route);
      const isOk = res.statusCode === 200;
      const isHtml = res.headers['content-type']?.includes('text/html');
      assert(isOk && isHtml, `GET ${route} resolves to index.html (HTTP 200 SPA fallback)`);
    }

    // -------------------------------------------------------------
    // Test 7: Static Assets Serving
    // -------------------------------------------------------------
    console.log('\n[7. Static Asset Serving]');
    const manifestRes = await fetchEndpoint('/manifest.webmanifest');
    assert(manifestRes.statusCode === 200, 'GET /manifest.webmanifest returns HTTP 200');

    const swRes = await fetchEndpoint('/sw.js');
    assert(swRes.statusCode === 200, 'GET /sw.js returns HTTP 200');

    const iconRes = await fetchEndpoint('/pwa-192.png');
    assert(iconRes.statusCode === 200, 'GET /pwa-192.png returns HTTP 200');

    // -------------------------------------------------------------
    // Test 8: API Boundary & 404 Routing Safety
    // -------------------------------------------------------------
    console.log('\n[8. API Routing & 404 Handling]');
    const api404Res = await fetchEndpoint('/api/nonexistent-route-audit');
    assert(api404Res.statusCode === 404, 'GET /api/nonexistent-route-audit returns HTTP 404');
    const api404Json = JSON.parse(api404Res.body);
    assert(api404Json.error === 'API endpoint not found', 'GET /api/nonexistent-route returns JSON error (not index.html)');

  } finally {
    serverProcess.kill('SIGTERM');
  }

  console.log('\n=======================================================');
  console.log(`  Tests Passed: ${passed} / ${passed + failed} (${Math.round((passed / (passed + failed)) * 100)}%)`);
  if (failed === 0) {
    console.log('  ALL PHASE 12A RENDER READINESS TESTS PASSED!');
  } else {
    console.error(`  ${failed} TESTS FAILED!`);
    process.exitCode = 1;
  }
  console.log('=======================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
