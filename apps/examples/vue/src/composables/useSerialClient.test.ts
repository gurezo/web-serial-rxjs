import { mount } from '@vue/test-utils';
import type { SerialClient } from '@web-serial-rxjs/web-serial-rxjs';
import * as webSerialRxjs from '@web-serial-rxjs/web-serial-rxjs';
import type { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSerialClient } from './useSerialClient';

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

// Test component to use the composable
const TestComponent = {
  setup() {
    return useSerialClient(9600);
  },
  template: '<div></div>',
};

describe('useSerialClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default values', () => {
    const wrapper = mount(TestComponent);
    const vm = wrapper.vm as ReturnType<typeof useSerialClient>;

    expect(vm.browserSupported.value).toBe(true);
    expect(vm.connectionState.value.connected).toBe(false);
    expect(vm.connectionState.value.connecting).toBe(false);
    expect(vm.connectionState.value.disconnecting).toBe(false);
    expect(vm.connectionState.value.error).toBe(null);
    expect(vm.receivedData.value).toBe('');
  });

  it('should check browser support on mount', () => {
    mount(TestComponent);
    expect(vi.mocked(webSerialRxjs.isBrowserSupported)).toHaveBeenCalled();
  });

  it('should connect to serial port', async () => {
    const wrapper = mount(TestComponent);
    const vm = wrapper.vm as ReturnType<typeof useSerialClient>;

    expect(vm.connectionState.value.connected).toBe(false);

    await vm.connect();

    // Wait for async state update
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vm.connectionState.value.connected).toBe(true);
    expect(vm.connectionState.value.connecting).toBe(false);
  });

  it('should disconnect from serial port', async () => {
    const wrapper = mount(TestComponent);
    const vm = wrapper.vm as ReturnType<typeof useSerialClient>;

    // First connect
    await vm.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vm.connectionState.value.connected).toBe(true);

    // Then disconnect
    await vm.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vm.connectionState.value.connected).toBe(false);
    expect(vm.connectionState.value.disconnecting).toBe(false);
  });

  it('should request port', async () => {
    const wrapper = mount(TestComponent);
    const vm = wrapper.vm as ReturnType<typeof useSerialClient>;

    await vm.requestPort();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vm.connectionState.value.error).toBe(null);
  });

  it('should send data when connected', async () => {
    const wrapper = mount(TestComponent);
    const vm = wrapper.vm as ReturnType<typeof useSerialClient>;

    // Connect first
    await vm.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vm.connectionState.value.connected).toBe(true);

    // Send data
    await vm.send('test data');
    await new Promise((resolve) => setTimeout(resolve, 10));

    // No error should occur
    expect(vm.connectionState.value.error).toBe(null);
  });

  it('should clear received data', () => {
    const wrapper = mount(TestComponent);
    const vm = wrapper.vm as ReturnType<typeof useSerialClient>;

    vm.clearReceivedData();
    expect(vm.receivedData.value).toBe('');
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

    const wrapper = mount(TestComponent);
    const vm = wrapper.vm as ReturnType<typeof useSerialClient>;

    try {
      await vm.connect();
    } catch {
      // Expected to throw
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vm.connectionState.value.error).toBeTruthy();
    expect(vm.connectionState.value.connected).toBe(false);
  });
});
