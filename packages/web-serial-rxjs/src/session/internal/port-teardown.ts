import type { ReadPump } from '../read-pump';
import type { ReceivePipeline } from './receive-pipeline';

/**
 * Dependencies for {@link createPortTeardown}.
 *
 * @internal
 */
export interface PortTeardownDeps {
  receivePipeline: ReceivePipeline;
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
 */
export interface PortTeardown {
  teardownPump: (pump: ReadPump | null) => Promise<void>;
  closePortSafely: (port: SerialPort | null) => Promise<void>;
}

/**
 * @internal
 */
export function createPortTeardown(deps: PortTeardownDeps): PortTeardown {
  const { receivePipeline } = deps;

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

  return { teardownPump, closePortSafely };
}
