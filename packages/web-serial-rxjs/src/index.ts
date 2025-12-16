// Main exports
export { createSerialClient, SerialClient } from './client/create-serial-client';

// Error exports
export { SerialError } from './errors/serial-error';
export { SerialErrorCode } from './errors/serial-error-code';

// Type exports
export type { SerialClientOptions } from './types/options';

// Browser support exports
export {
  checkBrowserSupport,
  isBrowserSupported,
} from './browser/browser-support';
export {
  hasWebSerialSupport,
  detectBrowserType,
  isChromiumBased,
  BrowserType,
} from './browser/browser-detection';

// I/O utility exports
export { readableToObservable } from './io/readable-to-observable';
export {
  observableToWritable,
  subscribeToWritable,
} from './io/observable-to-writable';

// Filter exports
export { buildRequestOptions } from './filters/build-request-options';
