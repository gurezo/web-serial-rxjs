// Main exports
export { createSerialClient } from './client/create-serial-client';

// Type exports
export type { SerialClient } from './client/create-serial-client';

// Error exports
export { SerialError } from './errors/serial-error';
export { SerialErrorCode } from './errors/serial-error-code';

// Type exports
export type { SerialClientOptions } from './types/options';

// Browser support exports
export {
  BrowserType,
  detectBrowserType,
  hasWebSerialSupport,
  isChromiumBased,
} from './browser/browser-detection';
export {
  checkBrowserSupport,
  isBrowserSupported,
} from './browser/browser-support';

// I/O utility exports
export {
  observableToWritable,
  subscribeToWritable,
} from './io/observable-to-writable';
export { readableToObservable } from './io/readable-to-observable';

// Filter exports
export { buildRequestOptions } from './filters/build-request-options';
