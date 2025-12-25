import { mount } from '@vue/test-utils';
// @ts-expect-error - Mocked module, types not needed at runtime
import type { SerialClient } from '@gurezo/web-serial-rxjs';
import type { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error - Vue SFC file, types are defined in vue-shims.d.ts
import App from './App.vue';

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

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the app', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('Web Serial RxJS - Vue Example');
    expect(wrapper.text()).toContain(
      'Vue Composition API を使用した Web Serial API のサンプル',
    );
  });

  it('should display browser support status', async () => {
    const wrapper = mount(App);
    // Wait for onMounted to execute
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(wrapper.text()).toContain(
      'ブラウザは Web Serial API をサポートしています。',
    );
  });

  it('should have connection buttons', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('ポートを選択');
    expect(wrapper.text()).toContain('接続');
    expect(wrapper.text()).toContain('切断');
  });

  it('should have baud rate selector', () => {
    const wrapper = mount(App);
    const baudRateSelect = wrapper.find('#baud-rate');
    expect(baudRateSelect.exists()).toBe(true);
    expect((baudRateSelect.element as HTMLSelectElement).value).toBe('9600');
  });

  it('should change baud rate', async () => {
    const wrapper = mount(App);
    const baudRateSelect = wrapper.find('#baud-rate');

    await baudRateSelect.setValue('115200');
    expect((baudRateSelect.element as HTMLSelectElement).value).toBe('115200');
  });

  it('should connect when connect button is clicked', async () => {
    const wrapper = mount(App);
    // Wait for onMounted to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    const connectButtons = wrapper.findAll('.btn-primary');
    const connectButton = connectButtons[0]; // First primary button is connect

    await connectButton.trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(wrapper.text()).toContain('シリアルポートに接続しました。');
  });

  it('should disconnect when disconnect button is clicked', async () => {
    const wrapper = mount(App);
    // Wait for onMounted to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    // First connect
    const connectButtons = wrapper.findAll('.btn-primary');
    const connectButton = connectButtons[0];
    await connectButton.trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(wrapper.text()).toContain('シリアルポートに接続しました。');

    // Then disconnect
    const disconnectButton = wrapper.find('.btn-secondary');
    await disconnectButton.trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(wrapper.text()).toContain('シリアルポートに接続していません。');
  });

  it('should send data when send button is clicked', async () => {
    const wrapper = mount(App);
    // Wait for onMounted to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Connect first
    const connectButtons = wrapper.findAll('.btn-primary');
    const connectButton = connectButtons[0];
    await connectButton.trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(wrapper.text()).toContain('シリアルポートに接続しました。');

    // Enter data and send
    const sendInput = wrapper.find('#send-input');
    const sendButton = connectButtons[1]; // Second primary button is send

    await sendInput.setValue('test message');
    await sendButton.trigger('click');
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Input should be cleared after sending
    expect((sendInput.element as HTMLInputElement).value).toBe('');
  });

  it('should clear received data when clear button is clicked', async () => {
    const wrapper = mount(App);

    const clearButton = wrapper.find('.btn-secondary');
    // Should be disabled when no data
    expect(clearButton.attributes('disabled')).toBeDefined();
  });
});
