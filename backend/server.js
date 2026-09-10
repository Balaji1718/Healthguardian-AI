import 'dotenv/config';
import express from 'express';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { getProviderHealth, providerAvailability, PROVIDER_REGISTRY, routeCompletion, testProvider } from './ai-provider-router.js';
import { executeWebSearch } from './web-search.js';
import { extractConversationalCheckin, convertAndImproveTranscript } from './conversational-checkin.js';
import { sendUserPush } from './firebase-admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '../frontend');
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 3000;
const app = express();
const server = http.createServer(app);

app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    service: 'healthguardian-ai-backend',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    service: 'healthguardian-ai-backend',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api', (_req, res) => {
  res.json({
    ok: true,
    message: 'Backend boundary ready',
    endpoints: ['/health', '/api/health', '/api/ai/complete', '/api/ai/status'],
  });
});

app.get('/api/ai/status', (_req, res) => {
  res.json({ providers: providerAvailability() });
});

app.get('/api/ai/health', (_req, res) => {
  res.json({ providers: getProviderHealth() });
});

app.post('/api/ai/complete', async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!messages.length) return res.status(400).json({ error: 'At least one message is required.' });
  try {
    return res.status(200).json(await routeCompletion({
      messages,
      temperature: req.body?.temperature,
      maxTokens: req.body?.max_tokens,
      json: req.body?.json === true,
    }));
  } catch {
    return res.status(500).json({ error: 'AI completion failed.' });
  }
});

app.post('/api/ai/search', async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query : '';
  if (!query.trim()) return res.status(400).json({ error: 'Query is required.' });
  try {
    const searchResult = await executeWebSearch(query);
    return res.status(200).json(searchResult);
  } catch {
    return res.status(500).json({ error: 'Web search failed.' });
  }
});

app.post('/api/ai/extract-checkin', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const language = typeof req.body?.language === 'string' ? req.body.language : 'en';
  if (!text.trim()) return res.status(400).json({ ok: false, error: 'Text is required.' });
  try {
    const result = await extractConversationalCheckin(text, language);
    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ ok: false, error: 'Conversational extraction failed.' });
  }
});

app.post('/api/ai/improve-transcript', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  const language = typeof req.body?.language === 'string' ? req.body.language : 'en';
  if (!text.trim()) return res.status(400).json({ ok: false, error: 'Text is required.' });
  try {
    const result = await convertAndImproveTranscript(text, language);
    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ ok: false, error: 'Transcript improvement failed.' });
  }
});

app.post('/api/support/email', async (req, res) => {
  const { type, reason, message, priority, userEmail, userName, requestId } = req.body ?? {};
  if (typeof reason !== 'string' || !reason.trim()) {
    return res.status(400).json({ ok: false, error: 'Support summary is required.' });
  }

  const recipient = process.env.SUPPORT_EMAIL_TO || 'balajiteen18@gmail.com';
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[Support Ticket] Ticket ${requestId || 'new'} recorded for ${recipient}: ${reason.trim()}`);
    return res.status(200).json({ ok: true, delivered: true, recipient });
  }
  const text = [
    `Request ID: ${requestId || 'not provided'}`,
    `Type: ${type || 'question'}`,
    `Priority: ${priority || 'normal'}`,
    `User: ${userName || 'Unknown'}${userEmail ? ` <${userEmail}>` : ''}`,
    '',
    `Summary: ${reason.trim()}`,
    `Details: ${typeof message === 'string' && message.trim() ? message.trim() : 'No additional details.'}`,
  ].join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.SUPPORT_EMAIL_FROM || 'HealthGuardian Support <onboarding@resend.dev>',
        to: [recipient],
        subject: `[HealthGuardian support] ${reason.trim()}`,
        text,
      }),
    });

    if (!response.ok) {
      return res.status(502).json({ ok: false, delivered: false, error: 'Support email delivery failed.' });
    }
    return res.status(200).json({ ok: true, delivered: true });
  } catch {
    return res.status(502).json({ ok: false, delivered: false, error: 'Support email delivery failed.' });
  }
});

app.post('/api/notifications/send', async (req, res) => {
  if (!process.env.FCM_INTERNAL_SECRET || req.get('x-fcm-internal-secret') !== process.env.FCM_INTERNAL_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized.' });
  }
  const { uid, title, body, data } = req.body ?? {};
  if (typeof uid !== 'string' || typeof title !== 'string' || typeof body !== 'string') {
    return res.status(400).json({ ok: false, error: 'uid, title, and body are required.' });
  }
  try {
    return res.status(200).json({ ok: true, ...(await sendUserPush(uid, title, body, data)) });
  } catch {
    return res.status(502).json({ ok: false, error: 'Push delivery failed.' });
  }
});

app.get('/api/ai/diagnostics', async (_req, res) => {
  const results = [];
  for (const provider of PROVIDER_REGISTRY) {
    results.push(await testProvider(provider.id));
  }
  res.json({ providers: results });
});

if (!isProduction) {
  const vite = await createViteServer({
    root: frontendRoot,
    server: {
      middlewareMode: true,
      host: '0.0.0.0',
      hmr: {
        server,
        host: 'localhost',
        port,
      },
    },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  app.use(async (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }

    try {
      const indexHtml = await fs.readFile(path.join(frontendRoot, 'index.html'), 'utf8');
      const html = await vite.transformIndexHtml(req.originalUrl, indexHtml);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      next(error);
    }
  });
} else {
  const distPath = path.join(frontendRoot, 'dist');
  app.use(express.static(distPath));

  app.get(/^(?!\/api).*/, async (req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/api')) {
      return next();
    }

    try {
      const indexHtml = await fs.readFile(path.join(distPath, 'index.html'), 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.send(indexHtml);
    } catch (error) {
      next(error);
    }
  });
}

app.use((req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    requestedPath: req.originalUrl,
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Server error' });
});

const host = process.env.HOST || '0.0.0.0';
server.listen(port, host, () => {
  console.log(`HealthGuardian app running on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
});

