/**
 * Process lifecycle: graceful shutdown and signal wiring.
 *
 * Kept separate from server.ts — which self-starts on import — so the shutdown
 * behaviour can be unit tested (`tests/lifecycle.test.ts`) without binding a
 * port or opening a real database connection. Windows cannot deliver a genuine
 * SIGINT to a spawned child process, so testing this in-process is the only way
 * to verify it honestly on the development machine.
 */

import { logger } from './utils/logger';

/** How long a shutdown may take before the process is killed anyway. */
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

/** The part of http.Server this module needs, narrowed so tests can fake it. */
export interface ClosableServer {
  close(callback?: (error?: Error) => void): unknown;
}

export interface ShutdownOptions {
  server: ClosableServer;
  /** Closes the database connection. */
  disconnect: () => Promise<void>;
  /** Injected so tests can observe the exit code instead of killing the runner. */
  exit: (code: number) => void;
  timeoutMs?: number;
}

export type ShutdownHandler = (reason: string, exitCode: number) => Promise<void>;

/**
 * Builds an idempotent shutdown routine: close the HTTP server, close the
 * database connection, then exit. A repeat signal is ignored rather than
 * starting a second, overlapping shutdown.
 */
export function createShutdownHandler(options: ShutdownOptions): ShutdownHandler {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
  let shuttingDown = false;

  return async function shutdown(reason: string, exitCode: number): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`Shutting down (${reason})...`);

    // Backstop: if a socket refuses to close, do not hang the process forever.
    const forceExit = setTimeout(() => {
      logger.error(`Shutdown did not complete within ${timeoutMs}ms - forcing exit.`);
      options.exit(1);
    }, timeoutMs);
    forceExit.unref?.();

    try {
      await new Promise<void>((resolve, reject) => {
        options.server.close((error) => (error ? reject(error) : resolve()));
      });
      logger.info('HTTP server closed');
    } catch (error) {
      // A failure to close the listener must not skip the database disconnect.
      logger.error('Error while closing the HTTP server:', error);
    }

    await options.disconnect();

    clearTimeout(forceExit);
    logger.info('Shutdown complete');
    options.exit(exitCode);
  };
}

/** Signals and process events that must trigger a shutdown. */
export const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

/**
 * Attaches the shutdown handler to SIGINT, SIGTERM, and the two fatal process
 * events. Returns a detach function so tests do not leak process listeners.
 */
export function registerLifecycleHandlers(shutdown: ShutdownHandler): () => void {
  const registered: Array<{ event: string; listener: (...args: unknown[]) => void }> = [];

  const on = (event: string, listener: (...args: unknown[]) => void): void => {
    process.on(event, listener);
    registered.push({ event, listener });
  };

  for (const signal of SHUTDOWN_SIGNALS) {
    on(signal, () => {
      void shutdown(signal, 0);
    });
  }

  on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection:', reason);
    void shutdown('unhandledRejection', 1);
  });

  on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    void shutdown('uncaughtException', 1);
  });

  return () => {
    for (const { event, listener } of registered) {
      process.off(event, listener);
    }
  };
}
