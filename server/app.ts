import cors from 'cors';
import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest, startAdvisorEngine } from './engine.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export { handleApiRequest, startAdvisorEngine, apiResponseToFetchResult } from './engine.js';

export function resolveStaticDir(): string | null {
  const candidates = [
    join(process.cwd(), 'dist'),
    join(__dirname, '..', 'dist'),
    join(__dirname, 'dist'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.html'))) return dir;
  }
  return null;
}

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '4mb' }));

  app.all('/api/*splat', async (req, res) => {
    const suffix = req.path.replace(/^\/api/, '') || '/health';
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    const apiPath = `${suffix}${query}`;
    const rawBody =
      req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body ?? {}) : undefined;
    const result = await handleApiRequest(req.method, apiPath, rawBody);
    res.status(result.status).json(result.body);
  });

  const staticDir = resolveStaticDir();
  if (process.env.SERVE_STATIC === '1' && staticDir) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(join(staticDir, 'index.html'));
    });
  }

  return app;
}

/** Optional HTTP server for browser-based development only. */
export async function bootstrapWebServer(options?: {
  port?: number;
  host?: string;
  dataDir?: string;
  serveStatic?: boolean;
}): Promise<number> {
  if (options?.dataDir) process.env.DBD_DATA_DIR = options.dataDir;
  if (options?.serveStatic) process.env.SERVE_STATIC = '1';

  console.log('Loading Dead by Daylight data...');
  await startAdvisorEngine({ dataDir: options?.dataDir, quiet: true });

  const app = createApp();
  const host = options?.host ?? '127.0.0.1';
  const port = options?.port ?? Number(process.env.PORT ?? 3001);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      console.log(`Web dev: http://${host}:${actualPort}`);
      resolve(actualPort);
    });
    server.on('error', reject);
  });
}

export const bootstrap = bootstrapWebServer;
