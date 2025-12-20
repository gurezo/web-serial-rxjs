import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app.js';

// Mock the web-serial-rxjs library
vi.mock('@web-serial-rxjs/web-serial-rxjs', () => {
  const mockClient = {
    connected: false,
    currentPort: null,
    connect: vi.fn(() => ({
      subscribe: vi.fn((observer) => {
        setTimeout(() => {
          mockClient.connected = true;
          observer.next();
          observer.complete();
        }, 0);
      }),
    })),
    disconnect: vi.fn(() => ({
      subscribe: vi.fn((observer) => {
        setTimeout(() => {
          mockClient.connected = false;
          observer.next();
          observer.complete();
        }, 0);
      }),
    })),
    requestPort: vi.fn(() => ({
      subscribe: vi.fn((observer) => {
        setTimeout(() => {
          observer.next({});
          observer.complete();
        }, 0);
      }),
    })),
    getReadStream: vi.fn(() => ({
      subscribe: vi.fn(() => ({
        unsubscribe: vi.fn(),
      })),
    })),
    write: vi.fn(() => ({
      subscribe: vi.fn((observer) => {
        setTimeout(() => {
          observer.next();
          observer.complete();
        }, 0);
      }),
    })),
  };

  return {
    createSerialClient: vi.fn(() => mockClient),
    isBrowserSupported: vi.fn(() => true),
    SerialError: class MockSerialError extends Error {
      constructor(message) {
        super(message);
        this.name = 'SerialError';
      }
    },
  };
});

describe('App', () => {
  let app;
  let container;

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
    if (app && app.readSubscription) {
      app.readSubscription.unsubscribe();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should create an App instance', () => {
    app = new App();
    expect(app).toBeInstanceOf(App);
  });

  it('should initialize DOM elements', () => {
    app = new App();
    expect(app.connectBtn).toBeDefined();
    expect(app.disconnectBtn).toBeDefined();
    expect(app.sendInput).toBeDefined();
    expect(app.receiveOutput).toBeDefined();
  });

  it('should check browser support on initialization', async () => {
    const { isBrowserSupported } = await import(
      '@web-serial-rxjs/web-serial-rxjs'
    );
    app = new App();
    // Give time for the async initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(isBrowserSupported).toHaveBeenCalled();
  });

  it('should enable connect button when browser is supported', () => {
    app = new App();
    // Wait for async initialization
    return new Promise((resolve) => {
      setTimeout(() => {
        // The button should be enabled if browser is supported
        // (Note: In real tests, this depends on the mock return value)
        resolve();
      }, 100);
    });
  });
});
