import { describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  it('should be defined', () => {
    // Simple smoke test - component structure is tested via build
    expect(App).toBeDefined();
  });
});
