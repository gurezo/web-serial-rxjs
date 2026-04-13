import { BrowserType } from '../browser/browser-detection';
import { SerialError } from '../errors/serial-error';

/**
 * Browser support information for Web Serial API.
 */
export type SerialSupport =
  | {
      supported: true;
      browser: BrowserType;
    }
  | {
      supported: false;
      browser: BrowserType;
      reason: string;
    };

/**
 * Reactive state machine for serial client lifecycle.
 */
export type SerialState =
  | { kind: 'idle' }
  | { kind: 'unsupported'; support: SerialSupport }
  | { kind: 'connecting' }
  | { kind: 'connected' }
  | { kind: 'disconnecting' }
  | { kind: 'error'; error: SerialError };
