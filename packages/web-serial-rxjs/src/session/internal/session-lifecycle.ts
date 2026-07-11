import { type BehaviorSubject, Observable, type Subject } from 'rxjs';
import { SerialError } from '../../errors/serial-error';
import { SerialErrorCode } from '../../errors/serial-error-code';
import { buildRequestOptions } from './build-request-options';
import { hasWebSerialSupport } from './has-web-serial-support';
import type { ReceivePipeline } from './receive-pipeline';
import {
  normalizeSerialError,
  type NormalizeSerialErrorOptions,
} from '../normalize-serial-error';
import { createReadPump, type ReadPump } from '../read-pump';
import type { SendQueue } from '../send-queue';
import type { ResolvedSerialSessionOptions } from '../serial-session-options';
import { SerialSessionState } from '../serial-session-state';
import {
  createConnectedRuntime,
  createConnectingRuntime,
  createDisconnectingRuntime,
  createDisposedRuntime,
  createIdleRuntime,
  getRuntimePort,
  getRuntimePump,
  type SessionRuntime,
  type SessionRuntimeController,
} from '../session-runtime';

/**
 * Dependencies for {@link createSessionLifecycle}.
 *
 * @internal
 */
export interface SessionLifecycleDeps {
  controller: SessionRuntimeController;
  resolvedOptions: ResolvedSerialSessionOptions;
  sendQueue: SendQueue;
  receivePipeline: ReceivePipeline;
  portInfoSubject: BehaviorSubject<SerialPortInfo | null>;
  errorsSubject: Subject<SerialError>;
  isDisposed: () => boolean;
  reportError: (
    error: unknown,
    options: NormalizeSerialErrorOptions,
  ) => SerialError;
  createDisposedError: () => SerialError;
}

/**
 * Port and pump lifecycle operations for {@link createSerialSession}.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/401 | Issue #401}
 */
export interface SessionLifecycle {
  connect$: () => Observable<void>;
  disconnect$: () => Observable<void>;
  dispose$: () => Observable<void>;
  writeToPort: (payload: Uint8Array) => Promise<void>;
  teardownPump: (pump: ReadPump | null) => Promise<void>;
  closePortSafely: (port: SerialPort | null) => Promise<void>;
  updatePortInfo: (port: SerialPort | null) => void;
}

/**
 * @internal
 */
export function createSessionLifecycle(
  deps: SessionLifecycleDeps,
): SessionLifecycle {
  const {
    controller,
    resolvedOptions,
    sendQueue,
    receivePipeline,
    portInfoSubject,
    errorsSubject,
    isDisposed,
    reportError,
    createDisposedError,
  } = deps;

  const updatePortInfo = (port: SerialPort | null): void => {
    portInfoSubject.next(port ? port.getInfo() : null);
  };

  const teardownPump = async (pump: ReadPump | null): Promise<void> => {
    receivePipeline.clearReplay();
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

  const teardownFromSnapshot = async (
    snapshot: SessionRuntime,
  ): Promise<void> => {
    if (snapshot.status === SerialSessionState.Connecting) {
      snapshot.cancel();
    }

    sendQueue.clear();

    if (
      snapshot.status === SerialSessionState.Connected ||
      snapshot.status === SerialSessionState.Disconnecting ||
      snapshot.status === SerialSessionState.Error
    ) {
      const portToClose = getRuntimePort(snapshot);
      const pump = getRuntimePump(snapshot);
      await teardownPump(pump);
      await closePortSafely(portToClose);
      updatePortInfo(null);
    }

    receivePipeline.clearLineBuffer();
  };

  const completeSubjects = (): void => {
    controller.complete();
    errorsSubject.complete();
    receivePipeline.complete();
    portInfoSubject.complete();
  };

  const dispose$ = (): Observable<void> =>
    new Observable<void>((subscriber) => {
      if (isDisposed()) {
        subscriber.next();
        subscriber.complete();
        return;
      }

      const snapshot = controller.runtime;
      controller.transition(createDisposedRuntime());

      const run = async (): Promise<void> => {
        try {
          await teardownFromSnapshot(snapshot);
          completeSubjects();
          subscriber.next();
          subscriber.complete();
        } catch (error) {
          const serialError = normalizeSerialError(error, {
            fallbackCode: SerialErrorCode.UNKNOWN,
            messagePrefix: 'Unexpected dispose failure',
          });
          subscriber.error(serialError);
        }
      };

      void run();
    });

  const writeToPort = async (payload: Uint8Array): Promise<void> => {
    const runtime = controller.runtime;
    if (
      runtime.status !== SerialSessionState.Connected ||
      !runtime.port.writable
    ) {
      throw new SerialError(
        SerialErrorCode.PORT_NOT_OPEN,
        'Cannot send data while session is not connected',
      );
    }
    const writer = runtime.port.writable.getWriter();
    try {
      await writer.write(payload);
    } finally {
      try {
        writer.releaseLock();
      } catch {
        // releaseLock throws when the stream is already errored; the real
        // failure is surfaced through the write() rejection above so we
        // intentionally swallow this secondary error.
      }
    }
  };

  const connect$ = (): Observable<void> =>
    new Observable<void>((subscriber) => {
      if (isDisposed()) {
        subscriber.error(createDisposedError());
        return;
      }

      if (!hasWebSerialSupport()) {
        const error = reportError(
          new SerialError(
            SerialErrorCode.BROWSER_NOT_SUPPORTED,
            'Web Serial API is not supported in this environment',
          ),
          { fallbackCode: SerialErrorCode.BROWSER_NOT_SUPPORTED },
        );
        subscriber.error(error);
        return;
      }

      const current = controller.status;
      if (
        current !== SerialSessionState.Idle &&
        current !== SerialSessionState.Error
      ) {
        const error = reportError(
          new SerialError(
            SerialErrorCode.PORT_ALREADY_OPEN,
            `Cannot connect while session state is '${current}'`,
          ),
          { fallbackCode: SerialErrorCode.PORT_ALREADY_OPEN },
        );
        subscriber.error(error);
        return;
      }

      let cancelled = false;
      const cancelInFlightConnect = (): void => {
        cancelled = true;
        if (controller.status === SerialSessionState.Connecting) {
          controller.transition(createIdleRuntime());
        }
      };
      controller.transition(createConnectingRuntime(cancelInFlightConnect));

      const run = async (): Promise<void> => {
        let selectedPort: SerialPort | null = null;
        try {
          selectedPort = await navigator.serial.requestPort(
            buildRequestOptions(resolvedOptions),
          );
          await selectedPort.open({
            baudRate: resolvedOptions.baudRate,
            dataBits: resolvedOptions.dataBits,
            stopBits: resolvedOptions.stopBits,
            parity: resolvedOptions.parity,
            bufferSize: resolvedOptions.bufferSize,
            flowControl: resolvedOptions.flowControl,
          });
        } catch (error) {
          if (selectedPort) {
            await closePortSafely(selectedPort);
          }
          const serialError = reportError(error, {
            fallbackCode: SerialErrorCode.PORT_OPEN_FAILED,
            messagePrefix: 'Failed to open port',
          });
          if (!cancelled) {
            subscriber.error(serialError);
          }
          return;
        }

        if (cancelled || isDisposed()) {
          await closePortSafely(selectedPort);
          return;
        }

        receivePipeline.clearLineBuffer();
        if (resolvedOptions.receiveReplay.enabled) {
          receivePipeline.startLiveReceiveReplay();
        }
        const pump = createReadPump(selectedPort, {
          onChunk: receivePipeline.handleChunk,
          onError: (pumpError) =>
            reportError(pumpError, {
              fallbackCode: SerialErrorCode.READ_FAILED,
              messagePrefix: 'Read pump failed',
            }),
          onDone: () => {
            if (controller.status !== SerialSessionState.Connected) {
              return;
            }
            reportError(
              new SerialError(
                SerialErrorCode.CONNECTION_LOST,
                'Read pump ended unexpectedly: stream closed while connected',
              ),
              {
                fallbackCode: SerialErrorCode.CONNECTION_LOST,
              },
            );
          },
        });
        pump.start();
        sendQueue.clear();
        if (isDisposed()) {
          await teardownPump(pump);
          await closePortSafely(selectedPort);
          return;
        }
        controller.transition(createConnectedRuntime(selectedPort, pump));
        updatePortInfo(selectedPort);
        subscriber.next();
        subscriber.complete();
      };

      void run();

      return () => {
        cancelInFlightConnect();
      };
    });

  const disconnect$ = (): Observable<void> =>
    new Observable<void>((subscriber) => {
      if (isDisposed()) {
        subscriber.next();
        subscriber.complete();
        return;
      }

      const runtime = controller.runtime;

      if (
        runtime.status === SerialSessionState.Idle ||
        runtime.status === SerialSessionState.Unsupported ||
        runtime.status === SerialSessionState.Disconnecting
      ) {
        subscriber.next();
        subscriber.complete();
        return;
      }

      if (runtime.status === SerialSessionState.Connecting) {
        runtime.cancel();
        subscriber.next();
        subscriber.complete();
        return;
      }

      if (
        runtime.status !== SerialSessionState.Connected &&
        runtime.status !== SerialSessionState.Error
      ) {
        const error = reportError(
          new SerialError(
            SerialErrorCode.PORT_NOT_OPEN,
            `Cannot disconnect while session state is '${runtime.status}'`,
          ),
          { fallbackCode: SerialErrorCode.PORT_NOT_OPEN },
        );
        subscriber.error(error);
        return;
      }

      const portToClose = getRuntimePort(runtime);
      controller.transition(createDisconnectingRuntime(portToClose));
      sendQueue.clear();

      const run = async (): Promise<void> => {
        try {
          const pump = getRuntimePump(controller.runtime);
          await teardownPump(pump);
          if (portToClose) {
            try {
              await portToClose.close();
            } catch (error) {
              updatePortInfo(null);
              const serialError = reportError(error, {
                fallbackCode: SerialErrorCode.CONNECTION_LOST,
                messagePrefix: 'Failed to close port',
              });
              subscriber.error(serialError);
              return;
            }
          }
          updatePortInfo(null);
          if (!isDisposed()) {
            controller.transition(createIdleRuntime());
          }
          subscriber.next();
          subscriber.complete();
        } catch (error) {
          const serialError = reportError(error, {
            fallbackCode: SerialErrorCode.UNKNOWN,
            messagePrefix: 'Unexpected disconnect failure',
          });
          subscriber.error(serialError);
        }
      };

      void run();
    });

  return {
    connect$,
    disconnect$,
    dispose$,
    writeToPort,
    teardownPump,
    closePortSafely,
    updatePortInfo,
  };
}
