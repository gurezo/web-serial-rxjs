import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { createSessionErrorReporter } from '../../src/session/internal/session-error-reporter';
import type { SessionResources } from '../../src/session/internal/port-teardown';
import { SerialSessionStatus } from '../../src/session/serial-session-state';
import {
  createConnectingRuntime,
  createDisposedRuntime,
  createIdleRuntime,
  createSessionRuntimeController,
  type SessionRuntimeController,
} from '../../src/session/session-runtime';

function createHarness(initial: 'idle' | 'connecting' = 'idle'): {
  controller: SessionRuntimeController;
  emissions: SerialError[];
  teardownResources: ReturnType<typeof vi.fn>;
  reportError: ReturnType<typeof createSessionErrorReporter>['reportError'];
} {
  const controller = createSessionRuntimeController(
    initial === 'connecting'
      ? createConnectingRuntime(() => undefined)
      : createIdleRuntime(),
  );
  const errorsSubject = new Subject<SerialError>();
  const emissions: SerialError[] = [];
  errorsSubject.subscribe((error) => emissions.push(error));
  const teardownResources = vi.fn(async () => undefined);
  const { reportError } = createSessionErrorReporter({
    controller,
    errorsSubject,
    isDisposed: () => controller.status === SerialSessionStatus.Disposed,
    captureResources: (): SessionResources => ({ port: null, pump: null }),
    teardownResources,
  });
  return { controller, emissions, teardownResources, reportError };
}

describe('createSessionErrorReporter', () => {
  it('publishes on errors$ by default and still applies severity side effects', () => {
    const { controller, emissions, reportError } = createHarness('connecting');

    const reported = reportError(
      new SerialError(
        SerialErrorCode.OPERATION_CANCELLED,
        'Port selection cancelled',
      ),
      { fallbackCode: SerialErrorCode.OPERATION_CANCELLED },
    );

    expect(emissions).toEqual([reported]);
    expect(controller.status).toBe(SerialSessionStatus.Idle);
  });

  it('skips errors$ when emitOnErrors is false but still applies fatal side effects', () => {
    const { controller, emissions, teardownResources, reportError } =
      createHarness('idle');

    const reported = reportError(new Error('open failed'), {
      fallbackCode: SerialErrorCode.PORT_OPEN_FAILED,
      emitOnErrors: false,
    });

    expect(emissions).toEqual([]);
    expect(reported.code).toBe(SerialErrorCode.PORT_OPEN_FAILED);
    expect(controller.status).toBe(SerialSessionStatus.Error);
    if (controller.runtime.status === SerialSessionStatus.Error) {
      expect(controller.runtime.error).toBe(reported);
    }
    expect(teardownResources).toHaveBeenCalledOnce();
  });

  it('does not publish or change state after dispose', () => {
    const { controller, emissions, teardownResources, reportError } =
      createHarness('idle');
    controller.transition(createDisposedRuntime());

    const reported = reportError(new Error('late'), {
      fallbackCode: SerialErrorCode.READ_FAILED,
      emitOnErrors: true,
    });

    expect(emissions).toEqual([]);
    expect(reported.code).toBe(SerialErrorCode.READ_FAILED);
    expect(controller.status).toBe(SerialSessionStatus.Disposed);
    expect(teardownResources).not.toHaveBeenCalled();
  });
});
