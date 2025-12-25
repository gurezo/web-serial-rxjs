import { mount } from '@vue/test-utils';
// @ts-expect-error - Mocked module, types not needed at runtime
import type { SerialClient } from '@gurezo/web-serial-rxjs';
// @ts-expect-error - Mocked module, types not needed at runtime
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
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
  template:
    '<div>{{ browserSupported }} {{ connectionState.connected }} {{ receivedData }}</div>',
} as any;

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default values', async () => {
    const wrapper = mount(TestComponent);
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const vm = wrapper.vm as any;
    expect(vm.getBrowserSupported()).toBe(true);
    expect(vm.getConnectionState().connected).toBe(false);
    expect(vm.getConnectionState().connecting).toBe(false);
    expect(vm.getConnectionState().disconnecting).toBe(false);
    expect(vm.getConnectionState().error).toBe(null);
    expect(vm.getReceivedData()).toBe('');
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

    const vm = wrapper.vm as any;
    expect(vm.getConnectionState().connected).toBe(false);

    await vm.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vm.getConnectionState().connected).toBe(true);
    expect(vm.getConnectionState().connecting).toBe(false);
  });

  it('should disconnect from serial port', async () => {
    const wrapper = mount(TestComponent);
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const vm = wrapper.vm as any;
    // First connect
    await vm.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vm.getConnectionState().connected).toBe(true);

    // Then disconnect
    await vm.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vm.getConnectionState().connected).toBe(false);
    expect(vm.getConnectionState().disconnecting).toBe(false);
  });

  it('should request port', async () => {
    const wrapper = mount(TestComponent);
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const vm = wrapper.vm as any;
    await vm.requestPort();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vm.getConnectionState().error).toBe(null);
  });

  it('should send data when connected', async () => {
    const wrapper = mount(TestComponent);
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const vm = wrapper.vm as any;
    // Connect first
    await vm.connect();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vm.getConnectionState().connected).toBe(true);

    // Send data
    await vm.send('test data');
    await new Promise((resolve) => setTimeout(resolve, 10));

    // No error should occur
    expect(vm.getConnectionState().error).toBe(null);
  });

  it('should clear received data', async () => {
    const wrapper = mount(TestComponent);
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const vm = wrapper.vm as any;
    vm.clearReceivedData();
    expect(vm.getReceivedData()).toBe('');
  });

  it('should handle connection errors', async () => {
    const mockClient = vi.mocked(webSerialRxjs.createSerialClient)({
      baudRate: 9600,
    }) as any;

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

    const wrapper = mount(TestComponent);
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const vm = wrapper.vm as any;
    try {
      await vm.connect();
    } catch {
      // Expected to throw
    }

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vm.getConnectionState().error).toBeTruthy();
    expect(vm.getConnectionState().connected).toBe(false);
  });
});
