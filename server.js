import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;

const app = express();
const port = Number(process.env.PORT) || 3001;
const DEMAND_STATE_KEY = 'demands';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const indexFile = path.join(distDir, 'index.html');
const hasBuiltFrontend = fs.existsSync(indexFile);

let pool;
let dbEnabled = false;

app.use(express.json({ limit: '1mb' }));

function getPool() {
  if (pool) return pool;

  const { DATABASE_URL, PGSSL } = process.env;
  if (!DATABASE_URL) return null;

  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: PGSSL === 'true' ? { rejectUnauthorized: false } : false
  });

  return pool;
}

async function initDemandStore() {
  const db = getPool();
  if (!db) {
    dbEnabled = false;
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  dbEnabled = true;
}

function isArrayPayload(value) {
  return Array.isArray(value);
}

app.get('/api/demands', async (_req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured. Set DATABASE_URL to enable PostgreSQL persistence.'
    });
  }

  try {
    const db = getPool();
    const result = await db.query('SELECT value FROM app_state WHERE key = $1', [DEMAND_STATE_KEY]);
    const demands = result.rows[0]?.value;

    return res.json({ ok: true, demands: isArrayPayload(demands) ? demands : [] });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Database read error.'
    });
  }
});

app.put('/api/demands', async (req, res) => {
  if (!dbEnabled) {
    return res.status(503).json({
      ok: false,
      error: 'Database is not configured. Set DATABASE_URL to enable PostgreSQL persistence.'
    });
  }

  const { demands } = req.body ?? {};
  if (!Array.isArray(demands)) {
    return res.status(400).json({ ok: false, error: 'Request body must include an array "demands".' });
  }

  try {
    const db = getPool();
    await db.query(
      `
        INSERT INTO app_state (key, value)
        VALUES ($1, $2::jsonb)
        ON CONFLICT (key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `,
      [DEMAND_STATE_KEY, JSON.stringify(demands)]
    );

    return res.json({ ok: true, count: demands.length });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Database write error.'
    });
  }
});

function getMailerConfig() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    return null;
  }

  return {
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    from: SMTP_FROM
  };
}

function createTransporter() {
  const config = getMailerConfig();
  if (!config) return null;

  return {
    transporter: nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth
    }),
    from: config.from
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/notifications/demand-created', async (req, res) => {
  const transportBundle = createTransporter();
  if (!transportBundle) {
    return res.status(503).json({
      ok: false,
      error: 'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.'
    });
  }

  const {
    organizationEmail,
    organizationLabel,
    creatorEmail,
    creatorName,
    demandTitle,
    project,
    positionTitle,
    priority,
    needDate,
    notes,
    demandIds
  } = req.body ?? {};

  if (!organizationEmail || !creatorEmail || !creatorName || !demandTitle) {
    return res.status(400).json({ ok: false, error: 'Missing required notification fields.' });
  }

  const ids = Array.isArray(demandIds) ? demandIds.filter(Boolean) : [];
  const orgSubject = ids.length > 1 ? `New Demands Created: ${positionTitle} (${ids.length})` : `New Demand Created: ${demandTitle}`;
  const creatorSubject = ids.length > 1 ? `Your Demands Were Created (${ids.length})` : `Your Demand Was Created: ${demandTitle}`;

  const sharedLines = [
    `Organization: ${organizationLabel || 'N/A'}`,
    `Project: ${project || 'N/A'}`,
    `Position: ${positionTitle || 'N/A'}`,
    `Priority: ${priority || 'N/A'}`,
    `Need Date: ${needDate || 'N/A'}`,
    `Demand IDs: ${ids.length > 0 ? ids.join(', ') : 'N/A'}`,
    `Notes: ${notes || 'N/A'}`
  ].join('\n');

  try {
    await Promise.all([
      transportBundle.transporter.sendMail({
        from: transportBundle.from,
        to: organizationEmail,
        cc: creatorEmail,
        subject: orgSubject,
        text: `A new demand has been created and needs review.\n\nRequested By: ${creatorName} (${creatorEmail})\n${sharedLines}`
      }),
      transportBundle.transporter.sendMail({
        from: transportBundle.from,
        to: creatorEmail,
        subject: creatorSubject,
        text: `Your demand submission has been created successfully.\n\n${sharedLines}`
      })
    ]);

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown mail error.'
    });
  }
});

if (hasBuiltFrontend) {
  app.use(express.static(distDir));

  // Serve the SPA for non-API GET requests.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(indexFile);
  });
} else {
  app.get('/', (_req, res) => {
    res.status(200).type('text/plain').send(
      [
        'Demand API is running.',
        'Frontend (dev): http://localhost:5173',
        'Health: /api/health'
      ].join('\n')
    );
  });
}

app.listen(port, () => {
  initDemandStore()
    .then(() => {
      console.log(`Demand API listening on http://localhost:${port}`);
      if (!dbEnabled) {
        console.log('PostgreSQL not configured. Demand data will remain local in the browser cache.');
      }
    })
    .catch((error) => {
      dbEnabled = false;
      console.error('Failed to initialize PostgreSQL store:', error);
      console.log(`Demand API listening on http://localhost:${port}`);
    });
});