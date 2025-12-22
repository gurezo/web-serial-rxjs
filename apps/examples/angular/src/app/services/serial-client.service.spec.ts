import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom, of, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { SerialClient } from '@web-serial-rxjs/web-serial-rxjs';
import * as webSerialRxjs from '@web-serial-rxjs/web-serial-rxjs';
import { SerialClientService } from './serial-client.service';

// Mock the web-serial-rxjs library
vi.mock('@web-serial-rxjs/web-serial-rxjs', () => {
  let isConnected = false;
  const mockClient = {
    get connected() {
      return isConnected;
    },
    currentPort: null,
    connect: vi.fn(() =>
      of(undefined).pipe(
        tap(() => {
          isConnected = true;
        }),
      ),
    ),
    disconnect: vi.fn(() =>
      of(undefined).pipe(
        tap(() => {
          isConnected = false;
        }),
      ),
    ),
    requestPort: vi.fn(() => of({} as SerialPort)),
    getReadStream: vi.fn(() =>
      of(new Uint8Array([72, 101, 108, 108, 111])), // "Hello"
    ),
    write: vi.fn(() => of(undefined)),
    getPorts: vi.fn(() => of([])),
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

describe('SerialClientService', () => {
  let service: SerialClientService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SerialClientService);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default values', (done) => {
    service.browserSupported.subscribe((supported) => {
      expect(supported).toBe(true);
    });

    service.connectionState.subscribe((state) => {
      expect(state.connected).toBe(false);
      expect(state.connecting).toBe(false);
      expect(state.disconnecting).toBe(false);
      expect(state.error).toBe(null);
      done();
    });
  });

  it('should check browser support on initialization', () => {
    expect(vi.mocked(webSerialRxjs.isBrowserSupported)).toHaveBeenCalled();
  });

  it('should connect to serial port', async () => {
    let connectionState: any;
    service.connectionState.subscribe((state) => {
      connectionState = state;
    });

    expect(connectionState.connected).toBe(false);

    await firstValueFrom(service.connect());

    // Wait a bit for state updates
    await new Promise((resolve) => setTimeout(resolve, 10));

    service.connectionState.subscribe((state) => {
      expect(state.connected).toBe(true);
      expect(state.connecting).toBe(false);
    });
  });

  it('should disconnect from serial port', async () => {
    // First connect
    await firstValueFrom(service.connect());
    await new Promise((resolve) => setTimeout(resolve, 10));

    let connectionState: any;
    service.connectionState.subscribe((state) => {
      connectionState = state;
    });

    expect(connectionState.connected).toBe(true);

    // Then disconnect
    await firstValueFrom(service.disconnect());
    await new Promise((resolve) => setTimeout(resolve, 10));

    service.connectionState.subscribe((state) => {
      expect(state.connected).toBe(false);
      expect(state.disconnecting).toBe(false);
    });
  });

  it('should request port', async () => {
    await firstValueFrom(service.requestPort());

    service.connectionState.subscribe((state) => {
      expect(state.error).toBe(null);
    });
  });

  it('should send data when connected', async () => {
    // Connect first
    await firstValueFrom(service.connect());
    await new Promise((resolve) => setTimeout(resolve, 10));

    let connectionState: any;
    service.connectionState.subscribe((state) => {
      connectionState = state;
    });

    expect(connectionState.connected).toBe(true);

    // Send data
    await firstValueFrom(service.send('test data'));

    // No error should occur
    service.connectionState.subscribe((state) => {
      expect(state.error).toBe(null);
    });
  });

  it('should clear received data', (done) => {
    service.clearReceivedData();

    service.receivedData.subscribe((data) => {
      expect(data).toBe('');
      done();
    });
  });

  it('should handle connection errors', async () => {
    // Create a new service instance to test error handling
    const errorService = new SerialClientService();
    
    // Mock createSerialClient to return a client that throws on connect
    const errorClient = {
      get connected() {
        return false;
      },
      currentPort: null,
      connect: vi.fn(() => throwError(() => new Error('Connection failed'))),
      disconnect: vi.fn(() => of(undefined)),
      requestPort: vi.fn(() => of({} as SerialPort)),
      getReadStream: vi.fn(() => of(new Uint8Array())),
      write: vi.fn(() => of(undefined)),
      getPorts: vi.fn(() => of([])),
    };

    vi.mocked(webSerialRxjs.createSerialClient).mockReturnValueOnce(errorClient as any);

    try {
      await firstValueFrom(errorService.connect());
    } catch {
      // Expected to throw
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    errorService.connectionState.subscribe((state) => {
      expect(state.error).toBeTruthy();
      expect(state.connected).toBe(false);
    });
  });

  it('should provide async methods', async () => {
    // Test connectAsync
    await service.connectAsync(9600);
    await new Promise((resolve) => setTimeout(resolve, 10));

    let connectionState: any;
    service.connectionState.subscribe((state) => {
      connectionState = state;
    });

    expect(connectionState.connected).toBe(true);

    // Test disconnectAsync
    await service.disconnectAsync();
    await new Promise((resolve) => setTimeout(resolve, 10));

    service.connectionState.subscribe((state) => {
      expect(state.connected).toBe(false);
    });

    // Test requestPortAsync
    await service.requestPortAsync();

    // Test sendAsync
    await service.connectAsync();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await service.sendAsync('test');
  });
});
