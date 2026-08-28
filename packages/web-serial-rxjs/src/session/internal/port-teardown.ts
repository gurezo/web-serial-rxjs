import type { ReadPump } from '../read-pump';
import type { SendQueue } from '../send-queue';
import {
  getRuntimePort,
  getRuntimePump,
  type SessionRuntime,
} from '../session-runtime';
import { SerialSessionStatus } from '../serial-session-state';
import type { ReceivePipeline } from './receive-pipeline';

/**
 * Snapshot of session-owned resources captured before a lifecycle transition.
 *
 * Transition targets such as `disconnecting` and `error` drop pump references,
 * so callers must capture resources while the source runtime still holds them.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/588 | Issue #588}
 */
export interface SessionResources {
  port: SerialPort | null;
  pump: ReadPump | null;
  cancelConnect?: () => void;
}

/**
 * How {@link teardownResources} handles `port.close()` rejections.
 *
 * - `safe` — swallow rejections (dispose, fatal error).
 * - `report` — propagate via {@link TeardownResourcesOptions.onCloseError}.
 *
 * @internal
 */
export type TeardownCloseMode = 'safe' | 'report';

/**
 * Options for {@link teardownResources}.
 *
 * @internal
 */
export interface TeardownResourcesOptions {
  closeMode?: TeardownCloseMode;
  /**
   * When `false`, skip {@link SessionResources.cancelConnect} even if captured.
   * Fatal error teardown uses this to avoid reverting `error` back to `idle`.
   */
  cancelInFlightConnect?: boolean;
  /**
   * Called when `closeMode` is `report` and `port.close()` rejects.
   * Should throw the normalised error to abort the teardown caller.
   */
  onCloseError?: (error: unknown) => never;
}

/**
 * Dependencies for {@link createPortTeardown}.
 *
 * @internal
 */
export interface PortTeardownDeps {
  receivePipeline: ReceivePipeline;
  sendQueue: SendQueue;
}

/**
 * Port and pump teardown primitives for {@link createSerialSession}.
 *
 * These are extracted from the session lifecycle so that both the lifecycle
 * and the error reporter can depend on them without forming a construction
 * cycle: the error reporter needs `teardownPump` / `closePortSafely` for fatal
 * cleanup, while the lifecycle needs the error reporter for `reportError`.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/476 | Issue #476}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/588 | Issue #588}
 */
export interface PortTeardown {
  teardownPump: (pump: ReadPump | null) => Promise<void>;
  closePortSafely: (port: SerialPort | null) => Promise<void>;
  captureResources: (runtime: SessionRuntime) => SessionResources;
  teardownResources: (
    resources: SessionResources,
    options?: TeardownResourcesOptions,
  ) => Promise<void>;
}

/**
 * Capture port, pump, and in-flight connect cancellation from runtime.
 *
 * @internal
 */
export function captureResources(runtime: SessionRuntime): SessionResources {
  const resources: SessionResources = {
    port: getRuntimePort(runtime),
    pump: getRuntimePump(runtime),
  };

  if (runtime.status === SerialSessionStatus.Connecting) {
    resources.cancelConnect = runtime.cancel;
  }

  return resources;
}

/**
 * @internal
 */
export function createPortTeardown(deps: PortTeardownDeps): PortTeardown {
  const { receivePipeline, sendQueue } = deps;

  const teardownPump = async (pump: ReadPump | null): Promise<void> => {
    receivePipeline.clearLineBuffer();
    if (pump) {
      await pump.stop();
    }
  };

  const closePortSafely = async (port: SerialPort | null): Promise<void> => {
    if (!port) {
      return;
    }
    try {
      await port.close();
    } catch {
      // The read pump may already have errored the stream, which makes
      // close() reject. We ignore it here because disconnect$ has a
      // dedicated error path for close failures initiated by the user.
    }
  };

  /**
   * Tear down captured session resources in a fixed order:
   *
   * 1. Cancel an in-flight connect (if captured).
   * 2. Clear pending writes on the send queue.
   * 3. Stop the read pump and clear the receive line buffer.
   * 4. Close the serial port.
   */
  const teardownResources = async (
    resources: SessionResources,
    options: TeardownResourcesOptions = {},
  ): Promise<void> => {
    const closeMode = options.closeMode ?? 'safe';
    const cancelInFlightConnect = options.cancelInFlightConnect ?? true;

    if (cancelInFlightConnect) {
      resources.cancelConnect?.();
    }
    sendQueue.clear();
    await teardownPump(resources.pump);

    if (!resources.port) {
      return;
    }

    if (closeMode === 'safe') {
      await closePortSafely(resources.port);
      return;
    }

    try {
      await resources.port.close();
    } catch (error) {
      if (options.onCloseError) {
        options.onCloseError(error);
      }
      throw error;
    }
  };

  return {
    teardownPump,
    closePortSafely,
    captureResources,
    teardownResources,
  };
}
