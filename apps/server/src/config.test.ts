import { describe, expect, it } from 'vitest';
import { readServerConfig } from './config.js';

describe('server deployment configuration', () => {
  it('keeps demo agents disabled by default', () => {
    expect(readServerConfig({})).toEqual({ port: 3001, demoEnabled: false });
  });
  it('accepts the hosting port and explicit demo opt-in', () => {
    expect(readServerConfig({ PORT: '10000', ECHO_DEMO_ENABLED: 'true' })).toEqual({
      port: 10000,
      demoEnabled: true,
    });
  });
  it.each(['0', '-1', 'NaN', '65536', '1.5', ''])('rejects invalid port %j', (PORT) => {
    expect(() => readServerConfig({ PORT })).toThrow();
  });
  it('rejects ambiguous demo flags before starting a listener', () => {
    expect(() => readServerConfig({ ECHO_DEMO_ENABLED: 'yes' })).toThrow();
  });
  it('accepts only an HTTP origin for browser API requests', () => {
    expect(
      readServerConfig({ ECHO_WEB_ORIGIN: 'https://echo-front-ten.vercel.app' }).webOrigin,
    ).toBe('https://echo-front-ten.vercel.app');
    expect(() => readServerConfig({ ECHO_WEB_ORIGIN: 'ftp://example.com' })).toThrow();
    expect(() => readServerConfig({ ECHO_WEB_ORIGIN: 'https://example.com/path' })).toThrow();
  });
});
