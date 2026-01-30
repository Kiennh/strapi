'use strict';

jest.mock('openid-client', () => ({
  Issuer: {
    discover: jest.fn(),
  },
}));

describe('OIDC Service', () => {
  let strapi;
  let oidcService;
  let Issuer;

  beforeEach(() => {
    jest.resetModules();
    oidcService = require('../services/oidc');
    Issuer = require('openid-client').Issuer;
    strapi = {};
    process.env.STRAPI_OIDC_ISSUER = 'http://issuer.com';
    process.env.STRAPI_OIDC_CLIENT_ID = 'client-id';
    process.env.STRAPI_OIDC_CLIENT_SECRET = 'client-secret';
  });

  afterEach(() => {
    delete process.env.STRAPI_OIDC_ISSUER;
    delete process.env.STRAPI_OIDC_CLIENT_ID;
    delete process.env.STRAPI_OIDC_CLIENT_SECRET;
    jest.clearAllMocks();
  });

  it('should initialize and return OIDC client', async () => {
    const mockClient = { name: 'mockClient' };
    const mockIssuer = {
      Client: jest.fn().mockReturnValue(mockClient),
    };
    Issuer.discover.mockResolvedValue(mockIssuer);

    const service = oidcService({ strapi });
    const client = await service.getClient();

    expect(Issuer.discover).toHaveBeenCalledWith('http://issuer.com');
    expect(mockIssuer.Client).toHaveBeenCalledWith(expect.objectContaining({
      client_id: 'client-id',
      client_secret: 'client-secret',
    }));
    expect(client).toBe(mockClient);
  });

  it('should throw if issuer is not configured', async () => {
    delete process.env.STRAPI_OIDC_ISSUER;
    const service = oidcService({ strapi });
    await expect(service.getClient()).rejects.toThrow('OIDC Issuer and Client ID must be configured.');
  });
});
