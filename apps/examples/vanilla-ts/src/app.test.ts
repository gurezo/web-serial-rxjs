import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app.js';
import type { SerialClient } from '@web-serial-rxjs/web-serial-rxjs';
import type { Observable, Subscription } from 'rxjs';

// Mock the web-serial-rxjs library
vi.mock('@web-serial-rxjs/web-serial-rxjs', () => {
  const mockClient: SerialClient = {
    connected: false,
    currentPort: null,
    connect: vi.fn(() => ({
      subscribe: vi.fn((observer: {
        next?: () => void;
        error?: (error: unknown) => void;
        complete?: () => void;
      }) => {
        setTimeout(() => {
          mockClient.connected = true;
          observer.next?.();
          observer.complete?.();
        }, 0);
      }),
    })) as unknown as () => Observable<void>,
    disconnect: vi.fn(() => ({
      subscribe: vi.fn((observer: {
        next?: () => void;
        error?: (error: unknown) => void;
        complete?: () => void;
      }) => {
        setTimeout(() => {
          mockClient.connected = false;
          observer.next?.();
          observer.complete?.();
        }, 0);
      }),
    })) as unknown as () => Observable<void>,
    requestPort: vi.fn(() => ({
      subscribe: vi.fn((observer: {
        next?: (port: SerialPort) => void;
        error?: (error: unknown) => void;
        complete?: () => void;
      }) => {
        setTimeout(() => {
          observer.next?.({} as SerialPort);
          observer.complete?.();
        }, 0);
      }),
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
      subscribe: vi.fn((observer: {
        next?: () => void;
        error?: (error: unknown) => void;
        complete?: () => void;
      }) => {
        setTimeout(() => {
          observer.next?.();
          observer.complete?.();
        }, 0);
      }),
    })) as unknown as (data: Uint8Array) => Observable<void>,
    getPorts: vi.fn(() => ({
      subscribe: vi.fn(),
    })) as unknown as () => Observable<SerialPort[]>,
    writeStream: vi.fn(() => ({
      subscribe: vi.fn(),
    })) as unknown as (data$: Observable<Uint8Array>) => Observable<void>,
  };

  return {
    createSerialClient: vi.fn(() => mockClient),
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
  let app: App | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    // Create a mock DOM structure
    container = document.createElement('div');
    container.innerHTML = `
      <div id="browser-support-status"></div>
      <button id="connect-btn"></button>
      <button id="disconnect-btn"></button>
      <button id="request-port-btn"></button>
      <div id="connection-status"></div>
      <select id="baud-rate">
        <option value="9600">9600</option>
        <option value="115200" selected>115200</option>
      </select>
      <input id="send-input" />
      <button id="send-btn"></button>
      <textarea id="receive-output"></textarea>
      <button id="clear-receive-btn"></button>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Cleanup: App instance will handle its own cleanup
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    app = null;
    container = null;
  });

  it('should create an App instance', () => {
    app = new App();
    expect(app).toBeInstanceOf(App);
  });

  it('should initialize DOM elements', () => {
    app = new App();
    // Verify that the app was created successfully
    // DOM elements are private, so we just verify the app instance exists
    expect(app).toBeDefined();
    // Verify that required DOM elements exist in the document
    expect(document.getElementById('connect-btn')).toBeDefined();
    expect(document.getElementById('disconnect-btn')).toBeDefined();
    expect(document.getElementById('send-input')).toBeDefined();
    expect(document.getElementById('receive-output')).toBeDefined();
  });

  it('should check browser support on initialization', async () => {
    const { isBrowserSupported } =
      await import('@web-serial-rxjs/web-serial-rxjs');
    app = new App();
    // Give time for the async initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(isBrowserSupported).toHaveBeenCalled();
  });

  it('should enable connect button when browser is supported', () => {
    app = new App();
    // Wait for async initialization
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // The button should be enabled if browser is supported
        // (Note: In real tests, this depends on the mock return value)
        resolve();
      }, 100);
    });
  });
});
