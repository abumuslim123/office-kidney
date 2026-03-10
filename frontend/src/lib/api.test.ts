import { describe, it, expect, beforeEach } from 'vitest';

describe('API module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should export api and publicApi', async () => {
    const { api, publicApi } = await import('./api');
    expect(api).toBeDefined();
    expect(publicApi).toBeDefined();
  });

  it('api should have baseURL configured', async () => {
    const { api } = await import('./api');
    expect(api.defaults.baseURL).toBeDefined();
  });

  it('api should have Content-Type header', async () => {
    const { api } = await import('./api');
    expect(api.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('api should have withCredentials enabled', async () => {
    const { api } = await import('./api');
    expect(api.defaults.withCredentials).toBe(true);
  });
});
