import { Observable, type Subject } from 'rxjs';
import { SerialError } from '../../errors/serial-error';
import { SerialErrorCode } from '../../errors/serial-error-code';
import { buildRequestOptions } from './build-request-options';
import { isWebSerialSupported } from './has-web-serial-support';
import type { ReceivePipeline } from './receive-pipeline';
import type {
  SessionResources,
  TeardownResourcesOptions,
} from './port-teardown';
import {
  normalizeSerialError,
  type NormalizeSerialErrorOptions,
} from '../normalize-serial-error';
import { createReadPump, type ReadPump } from '../read-pump';
import type { SendQueue } from '../send-queue';
import type { ResolvedSerialSessionOptions } from '../serial-session-options';
import { SerialSessionStatus } from '../serial-session-state';
import {
  createConnectedRuntime,
  createConnectingRuntime,
  createDisconnectingRuntime,
  createDisposedRuntime,
  createIdleRuntime,
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
  errorsSubject: Subject<SerialError>;
  isDisposed: () => boolean;
  teardownPump: (pump: ReadPump | null) => Promise<void>;
  closePortSafely: (port: SerialPort | null) => Promise<void>;
  captureResources: (runtime: SessionRuntime) => SessionResources;
  teardownResources: (
    resources: SessionResources,
    options?: TeardownResourcesOptions,
  ) => Promise<void>;
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
    errorsSubject,
    isDisposed,
    teardownPump,
    closePortSafely,
    captureResources,
    teardownResources,
    reportError,
    createDisposedError,
  } = deps;

  const completeSubjects = (): void => {
    controller.complete();
    errorsSubject.complete();
    receivePipeline.complete();
  };

  const dispose$ = (): Observable<void> =>
    new Observable<void>((subscriber) => {
      if (isDisposed()) {
        subscriber.next();
        subscriber.complete();
        return;
      }

      const snapshot = controller.runtime;
      const resources = captureResources(snapshot);
      controller.transition(createDisposedRuntime());

      const run = async (): Promise<void> => {
        try {
          await teardownResources(resources, { closeMode: 'safe' });
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
      runtime.status !== SerialSessionStatus.Connected ||
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

  // A connect attempt can outlive unsubscribe while `requestPort` is still
  // pending. The generation drops that attempt's results. The next attempt
  // waits only while a previous one is still releasing its port, so a fresh
  // connect keeps the same microtask timing as a single `requestPort`.
  let connectGeneration = 0;
  let connectInFlight: Promise<void> | null = null;

  const connect$ = (): Observable<void> =>
    new Observable<void>((subscriber) => {
      if (isDisposed()) {
        subscriber.error(createDisposedError());
        return;
      }

      if (!isWebSerialSupported()) {
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
        current !== SerialSessionStatus.Idle &&
        current !== SerialSessionStatus.Error
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

      const generation = ++connectGeneration;
      let cancelled = false;
      let settlePrevious = (): void => undefined;
      const finished = new Promise<void>((resolve) => {
        settlePrevious = resolve;
      });
      const waitForPrevious = connectInFlight;
      connectInFlight = finished;
      const isCurrentAttempt = (): boolean =>
        !cancelled && generation === connectGeneration && !isDisposed();

      const cancelInFlightConnect = (): void => {
        cancelled = true;
        if (
          generation === connectGeneration &&
          controller.status === SerialSessionStatus.Connecting
        ) {
          controller.transition(createIdleRuntime());
        }
      };
      controller.transition(createConnectingRuntime(cancelInFlightConnect));

      // Connecting runtime does not hold the port, so reportError's fatal
      // teardown cannot close a port opened before the connected transition.
      const releaseOpenedPort = async (
        openedPump: ReadPump | null,
        openedPort: SerialPort | null,
      ): Promise<void> => {
        await teardownPump(openedPump);
        await closePortSafely(openedPort);
      };

      const run = async (): Promise<void> => {
        let selectedPort: SerialPort | null = null;
        let opened = false;
        try {
          if (waitForPrevious) {
            await waitForPrevious;
          }
          if (!isCurrentAttempt()) {
            return;
          }

          try {
            selectedPort = await navigator.serial.requestPort(
              buildRequestOptions(resolvedOptions),
            );
            if (!isCurrentAttempt()) {
              return;
            }
            await selectedPort.open({
              baudRate: resolvedOptions.baudRate,
              dataBits: resolvedOptions.dataBits,
              stopBits: resolvedOptions.stopBits,
              parity: resolvedOptions.parity,
              bufferSize: resolvedOptions.bufferSize,
              flowControl: resolvedOptions.flowControl,
            } satisfies SerialOptions);
            opened = true;
          } catch (error) {
            if (!isCurrentAttempt()) {
              if (opened && selectedPort) {
                await closePortSafely(selectedPort);
              }
              return;
            }

            const serialError = normalizeSerialError(error, {
              fallbackCode: SerialErrorCode.PORT_OPEN_FAILED,
              messagePrefix: 'Failed to open port',
            });
            // Picker cancel is NotFoundError before a port exists. reportError
            // treats OPERATION_CANCELLED as fatal and would enter `error` plus
            // teardown. Return to idle and keep the error on connect$ / errors$.
            const userCancelledPicker =
              selectedPort === null &&
              serialError.code === SerialErrorCode.OPERATION_CANCELLED;

            if (userCancelledPicker) {
              if (!isDisposed()) {
                errorsSubject.next(serialError);
                if (controller.status === SerialSessionStatus.Connecting) {
                  controller.transition(createIdleRuntime());
                }
              }
              subscriber.error(serialError);
              return;
            }

            if (selectedPort) {
              await closePortSafely(selectedPort);
            }
            if (!isCurrentAttempt()) {
              return;
            }
            const reported = reportError(serialError, {
              fallbackCode: SerialErrorCode.PORT_OPEN_FAILED,
              messagePrefix: 'Failed to open port',
            });
            if (isCurrentAttempt()) {
              subscriber.error(reported);
            }
            return;
          }

          if (!selectedPort || !isCurrentAttempt()) {
            if (opened && selectedPort) {
              await closePortSafely(selectedPort);
            }
            return;
          }

          let pump: ReadPump | null = null;
          let startupError: SerialError | null = null;
          let transitioned = false;
          try {
            receivePipeline.clearLineBuffer();
            pump = createReadPump(selectedPort, {
              onChunk: receivePipeline.handleChunk,
              onError: (pumpError) => {
                const reported = reportError(pumpError, {
                  fallbackCode: SerialErrorCode.READ_FAILED,
                  messagePrefix: 'Read pump failed',
                });
                // A synchronous failure inside start() happens before connected.
                // Later read errors run after transitioned is set and must not
                // be delivered again on connect$.
                if (!transitioned) {
                  startupError = reported;
                }
              },
              onDone: () => {
                if (controller.status !== SerialSessionStatus.Connected) {
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
            if (startupError || !isCurrentAttempt()) {
              await releaseOpenedPort(pump, selectedPort);
              if (isCurrentAttempt() && startupError) {
                subscriber.error(startupError);
              }
              return;
            }

            sendQueue.clear();
            if (!isCurrentAttempt()) {
              await releaseOpenedPort(pump, selectedPort);
              return;
            }

            controller.transition(createConnectedRuntime(selectedPort, pump));
            transitioned = true;
            subscriber.next();
            subscriber.complete();
          } catch (error) {
            if (!transitioned) {
              await releaseOpenedPort(pump, selectedPort);
            }
            if (!isCurrentAttempt() || transitioned) {
              return;
            }
            if (startupError) {
              subscriber.error(startupError);
              return;
            }
            const reported = reportError(error, {
              fallbackCode: SerialErrorCode.UNKNOWN,
              messagePrefix: 'Unexpected connect failure',
            });
            if (!isCurrentAttempt()) {
              return;
            }
            subscriber.error(reported);
          }
        } finally {
          settlePrevious();
          if (connectInFlight === finished) {
            connectInFlight = null;
          }
        }
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
        runtime.status === SerialSessionStatus.Idle ||
        runtime.status === SerialSessionStatus.Unsupported ||
        runtime.status === SerialSessionStatus.Disconnecting
      ) {
        subscriber.next();
        subscriber.complete();
        return;
      }

      if (runtime.status === SerialSessionStatus.Connecting) {
        runtime.cancel();
        subscriber.next();
        subscriber.complete();
        return;
      }

      if (
        runtime.status !== SerialSessionStatus.Connected &&
        runtime.status !== SerialSessionStatus.Error
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

      const resources = captureResources(runtime);
      controller.transition(createDisconnectingRuntime(resources.port));

      const run = async (): Promise<void> => {
        try {
          await teardownResources(resources, {
            closeMode: 'report',
            onCloseError: (error) => {
              throw reportError(error, {
                fallbackCode: SerialErrorCode.CONNECTION_LOST,
                messagePrefix: 'Failed to close port',
              });
            },
          });
          if (!isDisposed()) {
            controller.transition(createIdleRuntime());
          }
          subscriber.next();
          subscriber.complete();
        } catch (error) {
          if (error instanceof SerialError) {
            subscriber.error(error);
            return;
          }
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
  };
}
