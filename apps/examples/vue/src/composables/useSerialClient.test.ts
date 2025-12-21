import { mount } from '@vue/test-utils';
import type { SerialClient } from '@web-serial-rxjs/web-serial-rxjs';
import * as webSerialRxjs from '@web-serial-rxjs/web-serial-rxjs';
import type { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSerialClient } from './useSerialClient';

// Test component to use the composable
const TestComponent = {
  setup() {
    const serialClient = useSerialClient(9600);
    // Expose all properties for testing by using them in template
    return {
      ...serialClient,
      // Also expose as methods for easier access
      getBrowserSupported: () => serialClient.browserSupported.value,
      getConnectionState: () => serialClient.connectionState.value,
      getReceivedData: () => serialClient.receivedData.value,
    };
  },
  template: '<div>{{ browserSupported }} {{ connectionState.connected }} {{ receivedData }}</div>',
};

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

describe('useSerialClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default values', async () => {
    const wrapper = mount(TestComponent);
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(wrapper.vm.getBrowserSupported()).toBe(true);
    expect(wrapper.vm.getConnectionState().connected).toBe(false);
    expect(wrapper.vm.getConnectionState().connecting).toBe(false);
    expect(wrapper.vm.getConnectionState().disconnecting).toBe(false);
    expect(wrapper.vm.getConnectionState().error).toBe(null);
    expect(wrapper.vm.getReceivedData()).toBe('');
  });

  it('should check browser support on mount', async () => {
    mount(TestComponent);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(vi.mocked(webSerialRxjs.isBrowserSupported)).toHaveBeenCalled();
  });

  it('should connect to serial port', async () => {
    const wrapper = mount(TestComponent);
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(wrapper.vm.getConnectionState().connected).toBe(false);

    await wrapper.vm.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(wrapper.vm.getConnectionState().connected).toBe(true);
    expect(wrapper.vm.getConnectionState().connecting).toBe(false);
  });

  it('should disconnect from serial port', async () => {
    const wrapper = mount(TestComponent);
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // First connect
    await wrapper.vm.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(wrapper.vm.getConnectionState().connected).toBe(true);

    // Then disconnect
    await wrapper.vm.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(wrapper.vm.getConnectionState().connected).toBe(false);
    expect(wrapper.vm.getConnectionState().disconnecting).toBe(false);
  });

  it('should request port', async () => {
    const wrapper = mount(TestComponent);
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    await wrapper.vm.requestPort();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(wrapper.vm.getConnectionState().error).toBe(null);
  });

  it('should send data when connected', async () => {
    const wrapper = mount(TestComponent);
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Connect first
    await wrapper.vm.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(wrapper.vm.getConnectionState().connected).toBe(true);

    // Send data
    await wrapper.vm.send('test data');
    await new Promise((resolve) => setTimeout(resolve, 10));

    // No error should occur
    expect(wrapper.vm.getConnectionState().error).toBe(null);
  });

  it('should clear received data', async () => {
    const wrapper = mount(TestComponent);
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    wrapper.vm.clearReceivedData();
    expect(wrapper.vm.getReceivedData()).toBe('');
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
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    try {
      await wrapper.vm.connect();
    } catch {
      // Expected to throw
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(wrapper.vm.getConnectionState().error).toBeTruthy();
    expect(wrapper.vm.getConnectionState().connected).toBe(false);
  });
});
