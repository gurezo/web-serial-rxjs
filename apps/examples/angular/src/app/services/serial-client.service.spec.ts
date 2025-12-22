import { TestBed } from '@angular/core/testing';
import type { SerialClient } from '@web-serial-rxjs/web-serial-rxjs';
import * as webSerialRxjs from '@web-serial-rxjs/web-serial-rxjs';
import { firstValueFrom, of, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    requestPort: vi.fn(() => of({} as unknown as SerialPort)),
    getReadStream: vi.fn(
      () => of(new Uint8Array([72, 101, 108, 108, 111])), // "Hello"
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
    vi.clearAllMocks();
    TestBed.configureTestingModule({});
    service = TestBed.inject(SerialClientService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default values', async () => {
    const browserSupported = await firstValueFrom(service.browserSupported);
    expect(browserSupported).toBe(true);

    const connectionState = await firstValueFrom(service.connectionState);
    expect(connectionState.connected).toBe(false);
    expect(connectionState.connecting).toBe(false);
    expect(connectionState.disconnecting).toBe(false);
    expect(connectionState.error).toBe(null);
  });

  it('should check browser support on initialization', () => {
    expect(vi.mocked(webSerialRxjs.isBrowserSupported)).toHaveBeenCalled();
  });

  it('should connect to serial port', async () => {
    const initialState = await firstValueFrom(service.connectionState);
    expect(initialState.connected).toBe(false);

    await firstValueFrom(service.connect());

    // Wait a bit for state updates
    await new Promise((resolve) => setTimeout(resolve, 10));

    const newState = await firstValueFrom(service.connectionState);
    expect(newState.connected).toBe(true);
    expect(newState.connecting).toBe(false);
  });

  it('should disconnect from serial port', async () => {
    // First connect
    await firstValueFrom(service.connect());
    await new Promise((resolve) => setTimeout(resolve, 10));

    const connectedState = await firstValueFrom(service.connectionState);
    expect(connectedState.connected).toBe(true);

    // Then disconnect
    await firstValueFrom(service.disconnect());
    await new Promise((resolve) => setTimeout(resolve, 10));

    const disconnectedState = await firstValueFrom(service.connectionState);
    expect(disconnectedState.connected).toBe(false);
    expect(disconnectedState.disconnecting).toBe(false);
  });

  it('should request port', async () => {
    await firstValueFrom(service.requestPort());

    const connectionState = await firstValueFrom(service.connectionState);
    expect(connectionState.error).toBe(null);
  });

  it('should send data when connected', async () => {
    // Connect first
    await firstValueFrom(service.connect());
    await new Promise((resolve) => setTimeout(resolve, 10));

    const connectedState = await firstValueFrom(service.connectionState);
    expect(connectedState.connected).toBe(true);

    // Send data
    await firstValueFrom(service.send('test data'));

    // No error should occur
    const finalState = await firstValueFrom(service.connectionState);
    expect(finalState.error).toBe(null);
  });

  it('should clear received data', async () => {
    service.clearReceivedData();

    const receivedData = await firstValueFrom(service.receivedData);
    expect(receivedData).toBe('');
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
      requestPort: vi.fn(() => of({} as unknown as SerialPort)),
      getReadStream: vi.fn(() => of(new Uint8Array())),
      write: vi.fn(() => of(undefined)),
      getPorts: vi.fn(() => of([])),
    };

    vi.mocked(webSerialRxjs.createSerialClient).mockReturnValueOnce(
      errorClient as unknown as SerialClient,
    );

    try {
      await firstValueFrom(errorService.connect());
    } catch {
      // Expected to throw
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    const errorState = await firstValueFrom(errorService.connectionState);
    expect(errorState.error).toBeTruthy();
    expect(errorState.connected).toBe(false);
  });

  it('should provide async methods', async () => {
    // Test connectAsync
    await service.connectAsync(9600);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const connectedState = await firstValueFrom(service.connectionState);
    expect(connectedState.connected).toBe(true);

    // Test disconnectAsync
    await service.disconnectAsync();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const disconnectedState = await firstValueFrom(service.connectionState);
    expect(disconnectedState.connected).toBe(false);

    // Test requestPortAsync
    await service.requestPortAsync();

    // Test sendAsync
    await service.connectAsync();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await service.sendAsync('test');
  });
});
