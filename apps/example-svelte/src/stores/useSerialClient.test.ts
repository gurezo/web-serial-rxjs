import type { SerialClient } from '@gurezo/web-serial-rxjs';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import type { Observable } from 'rxjs';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSerialClient } from './useSerialClient';

// Mock onDestroy for testing
vi.mock('svelte', async () => {
  const actual = await vi.importActual('svelte');
  return {
    ...actual,
    onDestroy: vi.fn((fn: () => void) => {
      // Store cleanup function for manual cleanup in tests
      (globalThis as any).__svelteCleanup = fn;
    }),
  };
});

// Mock the web-serial-rxjs library
vi.mock('@gurezo/web-serial-rxjs', () => {
  let isConnected = false;
  const mockClient = {
    get connected() {
      return isConnected;
    },
    currentPort: null,
    connect: vi.fn(() => ({
      subscribe: vi.fn(
        (observer: {
          next?: () => void;
          error?: (error: unknown) => void;
          complete?: () => void;
        }) => {
          const timeoutId = setTimeout(() => {
            isConnected = true;
            if (observer.next) {
              observer.next();
            }
            if (observer.complete) {
              observer.complete();
            }
          }, 0);
          return {
            unsubscribe: () => clearTimeout(timeoutId),
          };
        },
      ),
    })) as unknown as () => Observable<void>,
    disconnect: vi.fn(() => ({
      subscribe: vi.fn(
        (observer: {
          next?: () => void;
          error?: (error: unknown) => void;
          complete?: () => void;
        }) => {
          const obs = observer;
          const timeoutId = setTimeout(() => {
            isConnected = false;
            if (obs?.next) {
              obs.next();
            }
            if (obs?.complete) {
              obs.complete();
            }
          }, 0);
          return {
            unsubscribe: () => clearTimeout(timeoutId),
          };
        },
      ),
    })) as unknown as () => Observable<void>,
    requestPort: vi.fn(() => ({
      subscribe: vi.fn(
        (observer: {
          next?: (port: SerialPort) => void;
          error?: (error: unknown) => void;
          complete?: () => void;
        }) => {
          const timeoutId = setTimeout(() => {
            if (observer.next) {
              observer.next({} as SerialPort);
            }
            if (observer.complete) {
              observer.complete();
            }
          }, 0);
          return {
            unsubscribe: () => clearTimeout(timeoutId),
          };
        },
      ),
    })) as unknown as () => Observable<SerialPort>,
    getReadStream: vi.fn(() => ({
      subscribe: vi.fn(() => ({
        unsubscribe: vi.fn(),
      })) as unknown as (observer: {
        next?: (data: Uint8Array) => void;
        error?: (error: unknown) => void;
        complete?: () => void;
      }) => { unsubscribe: () => void },
    })) as unknown as () => Observable<Uint8Array>,
    write: vi.fn(() => ({
      subscribe: vi.fn(
        (observer: {
          next?: () => void;
          error?: (error: unknown) => void;
          complete?: () => void;
        }) => {
          const timeoutId = setTimeout(() => {
            if (observer.next) {
              observer.next();
            }
            if (observer.complete) {
              observer.complete();
            }
          }, 0);
          return {
            unsubscribe: () => clearTimeout(timeoutId),
          };
        },
      ),
    })) as unknown as (data: Uint8Array) => Observable<void>,
    getPorts: vi.fn(() => ({
      subscribe: vi.fn(),
    })) as unknown as () => Observable<SerialPort[]>,
  };

  return {
    createSerialClient: vi.fn(() => mockClient) as unknown as (options?: {
      baudRate?: number;
    }) => SerialClient,
    isBrowserSupported: vi.fn(() => true),
    SerialError: class MockSerialError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'SerialError';
      }
    },
  };
});

describe('useSerialClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cleanup function
    (globalThis as any).__svelteCleanup = undefined;
  });

  afterEach(() => {
    // Call cleanup if it exists
    if ((globalThis as any).__svelteCleanup) {
      (globalThis as any).__svelteCleanup();
      (globalThis as any).__svelteCleanup = undefined;
    }
    vi.restoreAllMocks();
  });

  it('should initialize with default values', () => {
    const serialClient = useSerialClient();

    expect(get(serialClient.browserSupported)).toBe(true);
    const connectionState = get(serialClient.connectionState);
    expect(connectionState.connected).toBe(false);
    expect(connectionState.connecting).toBe(false);
    expect(connectionState.disconnecting).toBe(false);
    expect(connectionState.error).toBe(null);
    expect(get(serialClient.receivedData)).toBe('');
  });

  it('should check browser support on initialization', () => {
    useSerialClient();
    expect(vi.mocked(webSerialRxjs.isBrowserSupported)).toHaveBeenCalled();
  });

  it('should connect to serial port', async () => {
    const serialClient = useSerialClient();

    expect(get(serialClient.connectionState).connected).toBe(false);

    await serialClient.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const connectionState = get(serialClient.connectionState);
    expect(connectionState.connected).toBe(true);
    expect(connectionState.connecting).toBe(false);
  });

  it('should disconnect from serial port', async () => {
    const serialClient = useSerialClient();

    // First connect
    await serialClient.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(get(serialClient.connectionState).connected).toBe(true);

    // Then disconnect
    await serialClient.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const connectionState = get(serialClient.connectionState);
    expect(connectionState.connected).toBe(false);
    expect(connectionState.disconnecting).toBe(false);
  });

  it('should request port', async () => {
    const serialClient = useSerialClient();

    await serialClient.requestPort();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(get(serialClient.connectionState).error).toBe(null);
  });

  it('should send data when connected', async () => {
    const serialClient = useSerialClient();

    // Connect first
    await serialClient.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(get(serialClient.connectionState).connected).toBe(true);

    // Send data
    await serialClient.send('test data');
    await new Promise((resolve) => setTimeout(resolve, 10));

    // No error should occur
    expect(get(serialClient.connectionState).error).toBe(null);
  });

  it('should clear received data', () => {
    const serialClient = useSerialClient();

    serialClient.clearReceivedData();
    expect(get(serialClient.receivedData)).toBe('');
  });

  it('should handle connection errors', async () => {
    const mockClient = vi.mocked(webSerialRxjs.createSerialClient)({
      baudRate: 9600,
    }) as SerialClient & {
      connect: ReturnType<typeof vi.fn>;
    };

    // Mock connect to throw an error
    mockClient.connect = vi.fn(() => ({
      subscribe: vi.fn(
        (observer: {
          next?: () => void;
          error?: (error: unknown) => void;
          complete?: () => void;
        }) => {
          setTimeout(() => {
            if (observer.error) {
              observer.error(new Error('Connection failed'));
            }
          }, 0);
        },
      ),
    })) as unknown as () => Observable<void>;

    const serialClient = useSerialClient();

    try {
      await serialClient.connect();
    } catch {
      // Expected to throw
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    const connectionState = get(serialClient.connectionState);
    expect(connectionState.error).toBeTruthy();
    expect(connectionState.connected).toBe(false);
  });
});
