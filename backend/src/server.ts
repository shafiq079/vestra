/**
 * Process entry point: validated configuration -> database connection -> HTTP
 * listener -> graceful shutdown.
 *
 * Environment validation happens first (importing config/env throws on a bad or
 * missing variable), so the process fails fast with a clear message instead of
 * starting up half-configured.
 *
 * Shutdown behaviour lives in lifecycle.ts so it can be tested; this file is a
 * thin bootstrap and is deliberately never imported by the test suite.
 */

import http from 'node:http';

import { app } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { createShutdownHandler, registerLifecycleHandlers } from './lifecycle';
import { logger } from './utils/logger';

async function start(): Promise<void> {
  logger.info(`Starting VESTRA backend in ${env.NODE_ENV} mode`);

  await connectDatabase();

  const server = http.createServer(app);

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${env.PORT} is already in use. Stop the other process or change PORT.`);
      process.exit(1);
    }
    logger.error('HTTP server error:', error);
    process.exit(1);
  });

  server.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}/api`);
    logger.info(`Health check: http://localhost:${env.PORT}/api/health`);
    logger.info(`CORS origins: ${env.corsOrigins.join(', ')}`);
  });

  registerLifecycleHandlers(
    createShutdownHandler({
      server,
      disconnect: disconnectDatabase,
      exit: (code) => process.exit(code),
    }),
  );
}

void start().catch((error: unknown) => {
  // Configuration and connection failures land here. The messages produced by
  // config/env.ts and config/database.ts are already secret-free.
  logger.error('Failed to start the VESTRA backend.');
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
