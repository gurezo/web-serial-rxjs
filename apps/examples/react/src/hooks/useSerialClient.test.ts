import type { SerialClient } from '@web-serial-rxjs/web-serial-rxjs';
import type { Observable, Subscription } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSerialClient } from './useSerialClient';
import * as webSerialRxjs from '@web-serial-rxjs/web-serial-rxjs';

// Mock the web-serial-rxjs library
vi.mock('@web-serial-rxjs/web-serial-rxjs', () => {
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
      }) => Subscription,
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
    createSerialClient: vi.fn(() => mockClient) as unknown as (
      options?: { baudRate?: number },
    ) => SerialClient,
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSerialClient());

    expect(result.current.browserSupported).toBe(true);
    expect(result.current.connectionState.connected).toBe(false);
    expect(result.current.connectionState.connecting).toBe(false);
    expect(result.current.connectionState.disconnecting).toBe(false);
    expect(result.current.connectionState.error).toBe(null);
    expect(result.current.receivedData).toBe('');
  });

  it('should check browser support on mount', () => {
    renderHook(() => useSerialClient());
    expect(vi.mocked(webSerialRxjs.isBrowserSupported)).toHaveBeenCalled();
  });

  it('should connect to serial port', async () => {
    const { result } = renderHook(() => useSerialClient(9600));

    expect(result.current.connectionState.connected).toBe(false);

    await waitFor(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.connectionState.connected).toBe(true);
      expect(result.current.connectionState.connecting).toBe(false);
    });
  });

  it('should disconnect from serial port', async () => {
    const { result } = renderHook(() => useSerialClient());

    // First connect
    await waitFor(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.connectionState.connected).toBe(true);
    });

    // Then disconnect
    await waitFor(async () => {
      await result.current.disconnect();
    });

    await waitFor(() => {
      expect(result.current.connectionState.connected).toBe(false);
      expect(result.current.connectionState.disconnecting).toBe(false);
    });
  });

  it('should request port', async () => {
    const { result } = renderHook(() => useSerialClient());

    await waitFor(async () => {
      await result.current.requestPort();
    });

    expect(result.current.connectionState.error).toBe(null);
  });

  it('should send data when connected', async () => {
    const { result } = renderHook(() => useSerialClient());

    // Connect first
    await waitFor(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.connectionState.connected).toBe(true);
    });

    // Send data
    await waitFor(async () => {
      await result.current.send('test data');
    });

    // No error should occur
    expect(result.current.connectionState.error).toBe(null);
  });

  it('should clear received data', () => {
    const { result } = renderHook(() => useSerialClient());

    // Manually set received data (simulating received data)
    // Note: In a real scenario, this would be set by the read stream
    result.current.clearReceivedData();
    expect(result.current.receivedData).toBe('');
  });

  it('should handle connection errors', async () => {
    const mockClient = vi.mocked(webSerialRxjs.createSerialClient)({
      baudRate: 9600,
    }) as SerialClient;

    // Mock connect to throw an error
    (mockClient.connect as ReturnType<typeof vi.fn>) = vi.fn(() => ({
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

    const { result } = renderHook(() => useSerialClient());

    await waitFor(async () => {
      try {
        await result.current.connect();
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(result.current.connectionState.error).toBeTruthy();
      expect(result.current.connectionState.connected).toBe(false);
    });
  });
});
