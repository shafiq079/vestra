/**
 * Graceful-shutdown tests.
 *
 * Verified in-process because Windows cannot deliver a real SIGINT to a spawned
 * child, so a subprocess test would silently prove nothing on the development
 * machine. The shutdown routine is exercised directly, and the signal wiring is
 * checked by invoking the listener that `registerLifecycleHandlers` actually
 * added to `process` (see the note on that describe block).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createShutdownHandler,
  registerLifecycleHandlers,
  SHUTDOWN_SIGNALS,
  type ClosableServer,
} from '../src/lifecycle';

/** Fake HTTP server whose close behaviour each test controls. */
function fakeServer(behaviour: 'ok' | 'error' | 'hang' = 'ok'): ClosableServer & { closeCalls: number } {
  return {
    closeCalls: 0,
    close(callback?: (error?: Error) => void) {
      this.closeCalls += 1;
      if (behaviour === 'hang') return this;
      setImmediate(() => {
        callback?.(behaviour === 'error' ? new Error('listener refused to close') : undefined);
      });
      return this;
    },
  };
}

let detach: (() => void) | undefined;

afterEach(() => {
  detach?.();
  detach = undefined;
  vi.useRealTimers();
});

describe('createShutdownHandler', () => {
  it('closes the server, disconnects the database, then exits with the given code', async () => {
    const server = fakeServer();
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();

    await createShutdownHandler({ server, disconnect, exit })('SIGTERM', 0);

    expect(server.closeCalls).toBe(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('propagates a non-zero exit code', async () => {
    const exit = vi.fn();

    await createShutdownHandler({
      server: fakeServer(),
      disconnect: vi.fn().mockResolvedValue(undefined),
      exit,
    })('uncaughtException', 1);

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('is idempotent — a repeat signal does not start a second shutdown', async () => {
    const server = fakeServer();
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();
    const shutdown = createShutdownHandler({ server, disconnect, exit });

    await shutdown('SIGINT', 0);
    await shutdown('SIGINT', 0);
    await shutdown('SIGTERM', 0);

    expect(server.closeCalls).toBe(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('still disconnects the database when closing the listener fails', async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const exit = vi.fn();

    await createShutdownHandler({ server: fakeServer('error'), disconnect, exit })('SIGTERM', 0);

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('forces a non-zero exit when shutdown exceeds the timeout', async () => {
    const exit = vi.fn();

    // The server never invokes its close callback, so only the backstop can fire.
    void createShutdownHandler({
      server: fakeServer('hang'),
      disconnect: vi.fn().mockResolvedValue(undefined),
      exit,
      timeoutMs: 20,
    })('SIGTERM', 0);

    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('registerLifecycleHandlers', () => {
  /**
   * The listeners are invoked directly rather than via `process.emit`. Vitest
   * installs its own SIGINT / uncaughtException handlers, so emitting real
   * process events here would cancel the run or be reported as an unhandled
   * error — this way the exact registered listener is still exercised, with no
   * side effects on the runner.
   */
  function listenersAddedBy(
    register: () => () => void,
    event: string,
  ): { added: Array<(...args: unknown[]) => void>; detach: () => void } {
    const before = new Set(process.listeners(event as NodeJS.Signals));
    const remove = register();
    const added = process
      .listeners(event as NodeJS.Signals)
      .filter((listener) => !before.has(listener)) as Array<(...args: unknown[]) => void>;

    return { added, detach: remove };
  }

  it.each(SHUTDOWN_SIGNALS)('registers a %s listener that shuts down with exit code 0', async (signal) => {
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const { added, detach: remove } = listenersAddedBy(() => registerLifecycleHandlers(shutdown), signal);
    detach = remove;

    expect(added).toHaveLength(1);
    added[0]!();

    await vi.waitFor(() => expect(shutdown).toHaveBeenCalledWith(signal, 0));
  });

  it('registers an unhandledRejection listener that shuts down with exit code 1', async () => {
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const { added, detach: remove } = listenersAddedBy(
      () => registerLifecycleHandlers(shutdown),
      'unhandledRejection',
    );
    detach = remove;

    expect(added).toHaveLength(1);
    added[0]!(new Error('nobody caught me'));

    await vi.waitFor(() => expect(shutdown).toHaveBeenCalledWith('unhandledRejection', 1));
  });

  it('registers an uncaughtException listener that shuts down with exit code 1', async () => {
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const { added, detach: remove } = listenersAddedBy(
      () => registerLifecycleHandlers(shutdown),
      'uncaughtException',
    );
    detach = remove;

    expect(added).toHaveLength(1);
    added[0]!(new Error('boom'));

    await vi.waitFor(() => expect(shutdown).toHaveBeenCalledWith('uncaughtException', 1));
  });

  it('detaches every listener it added', () => {
    const events = [...SHUTDOWN_SIGNALS, 'unhandledRejection', 'uncaughtException'];
    const before = events.map((event) => process.listenerCount(event as NodeJS.Signals));

    const remove = registerLifecycleHandlers(vi.fn().mockResolvedValue(undefined));
    events.forEach((event, index) => {
      expect(process.listenerCount(event as NodeJS.Signals)).toBe((before[index] ?? 0) + 1);
    });

    remove();
    events.forEach((event, index) => {
      expect(process.listenerCount(event as NodeJS.Signals)).toBe(before[index] ?? 0);
    });
  });
});
