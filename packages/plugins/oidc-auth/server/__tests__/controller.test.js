'use strict';

const oidcController = require('../controllers/oidc');

describe('OIDC Controller', () => {
  let strapi;

  beforeEach(() => {
    strapi = {
      plugin: jest.fn().mockReturnThis(),
      service: jest.fn().mockReturnThis(),
      getClient: jest.fn(),
    };
  });

  it('getLoginUrl should return authorization URL', async () => {
    const mockClient = {
      authorizationUrl: jest.fn().mockReturnValue('http://auth-url.com'),
    };
    strapi.getClient.mockResolvedValue(mockClient);

    const controller = oidcController({ strapi });
    const ctx = { query: { state: 'test-state' } };
    await controller.getLoginUrl(ctx);

    expect(mockClient.authorizationUrl).toHaveBeenCalledWith(expect.objectContaining({
      state: 'test-state',
    }));
    expect(ctx.body.url).toBe('http://auth-url.com');
  });

  it('callback should return tokens', async () => {
    const mockClient = {
      callback: jest.fn().mockResolvedValue({
        access_token: 'access',
        refresh_token: 'refresh',
      }),
    };
    strapi.getClient.mockResolvedValue(mockClient);

    const controller = oidcController({ strapi });
    const ctx = { query: { code: 'test-code', state: 'test-state' } };
    await controller.callback(ctx);

    expect(mockClient.callback).toHaveBeenCalled();
    expect(ctx.body.access_token).toBe('access');
  });
});
