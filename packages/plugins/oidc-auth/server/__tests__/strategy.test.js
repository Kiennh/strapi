'use strict';

const strategy = require('../strategies/oidc');

describe('OIDC Auth Strategy', () => {
  let strapiMock;

  beforeEach(() => {
    strapiMock = {
      db: {
        query: jest.fn().mockReturnThis(),
        findOne: jest.fn(),
        findMany: jest.fn(),
      },
      admin: {
        services: {
          user: {
            create: jest.fn().mockImplementation((data) => ({ ...data, id: 1 })),
            updateById: jest.fn().mockImplementation((id, data) => ({ ...data, id })),
          },
          permission: {
            engine: {
              generateUserAbility: jest.fn().mockResolvedValue({}),
            },
          },
        },
      },
      plugins: {
        'oidc-auth': {
          services: {
            oidc: {
              getClient: jest.fn().mockResolvedValue({
                userinfo: jest.fn(),
                client_id: 'test-client',
              }),
            },
          },
        },
      },
      plugin: jest.fn((name) => strapiMock.plugins[name]),
      service: jest.fn((name) => {
        if (name.startsWith('admin::')) {
          return strapiMock.admin.services[name.split('admin::')[1]];
        }
      }),
      api: {},
      log: {
        error: jest.fn(),
      },
    };
    global.strapi = strapiMock;
  });

  afterEach(() => {
    delete global.strapi;
  });

  it('should fail if Authorization header is missing', async () => {
    const ctx = {
      request: {
        header: {},
      },
    };

    const result = await strategy.authenticate(ctx);
    expect(result.authenticated).toBe(false);
  });

  it('should fail if Authorization header is not Bearer', async () => {
    const ctx = {
      request: {
        header: {
          authorization: 'Basic dXNlcjpwYXNz',
        },
      },
    };

    const result = await strategy.authenticate(ctx);
    expect(result.authenticated).toBe(false);
  });

  it('should authenticate if token is valid and user exists', async () => {
    const claims = { email: 'test@example.com', roles: ['strapi-editor'] };
    const user = { id: 1, email: 'test@example.com', roles: [{ id: 1, code: 'strapi-editor' }], isActive: true };

    const clientMock = await strapiMock.plugins['oidc-auth'].services.oidc.getClient();
    clientMock.userinfo.mockResolvedValue(claims);
    strapiMock.db.findOne.mockResolvedValue(user);
    strapiMock.db.findMany.mockResolvedValue([{ id: 1, code: 'strapi-editor' }]);

    const ctx = {
      request: {
        header: {
          authorization: 'Bearer token-1',
        },
      },
      state: {},
    };

    const result = await strategy.authenticate(ctx);
    expect(result.authenticated).toBe(true);
    expect(result.credentials).toEqual(user);
    expect(strapiMock.admin.services.user.updateById).not.toHaveBeenCalled();
  });

  it('should create user if not exists', async () => {
    const claims = { email: 'new@example.com', given_name: 'New', family_name: 'User', roles: ['strapi-editor'] };

    const clientMock = await strapiMock.plugins['oidc-auth'].services.oidc.getClient();
    clientMock.userinfo.mockResolvedValue(claims);
    strapiMock.db.findOne.mockResolvedValue(null);
    strapiMock.db.findMany.mockResolvedValue([{ id: 1, code: 'strapi-editor' }]);

    const ctx = {
      request: {
        header: {
          authorization: 'Bearer token-2',
        },
      },
      state: {},
    };

    const result = await strategy.authenticate(ctx);
    expect(result.authenticated).toBe(true);
    expect(strapiMock.admin.services.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        firstname: 'New',
        roles: [1],
      })
    );
  });

  it('should sync roles for existing user if they differ', async () => {
    const claims = { email: 'test@example.com', roles: ['strapi-super-admin'] };
    const user = { id: 1, email: 'test@example.com', roles: [{ id: 1, code: 'strapi-editor' }], isActive: true };

    const clientMock = await strapiMock.plugins['oidc-auth'].services.oidc.getClient();
    clientMock.userinfo.mockResolvedValue(claims);
    strapiMock.db.findOne.mockResolvedValue(user);
    strapiMock.db.findMany.mockResolvedValue([{ id: 2, code: 'strapi-super-admin' }]);

    const ctx = {
      request: {
        header: {
          authorization: 'Bearer token-3',
        },
      },
      state: {},
    };

    await strategy.authenticate(ctx);
    expect(strapiMock.admin.services.user.updateById).toHaveBeenCalledWith(1, {
      roles: [2],
    });
  });

  it('should handle roles from Keycloak resource_access', async () => {
    const claims = {
      email: 'test@example.com',
      resource_access: {
        'test-client': { roles: ['strapi-editor'] }
      }
    };
    const user = { id: 1, email: 'test@example.com', roles: [{ id: 1, code: 'strapi-editor' }], isActive: true };

    const clientMock = await strapiMock.plugins['oidc-auth'].services.oidc.getClient();
    clientMock.userinfo.mockResolvedValue(claims);
    strapiMock.db.findOne.mockResolvedValue(user);
    strapiMock.db.findMany.mockResolvedValue([{ id: 1, code: 'strapi-editor' }]);

    const ctx = {
      request: {
        header: {
          authorization: 'Bearer token-4',
        },
      },
      state: {},
    };

    const result = await strategy.authenticate(ctx);
    expect(result.authenticated).toBe(true);
  });

  it('should fail if user is inactive', async () => {
    const claims = { email: 'test@example.com', roles: ['strapi-editor'] };
    const user = { id: 1, email: 'test@example.com', roles: [{ id: 1, code: 'strapi-editor' }], isActive: false };

    const clientMock = await strapiMock.plugins['oidc-auth'].services.oidc.getClient();
    clientMock.userinfo.mockResolvedValue(claims);
    strapiMock.db.findOne.mockResolvedValue(user);
    strapiMock.db.findMany.mockResolvedValue([{ id: 1, code: 'strapi-editor' }]);

    const ctx = {
      request: {
        header: {
          authorization: 'Bearer token-5',
        },
      },
      state: {},
    };

    const result = await strategy.authenticate(ctx);
    expect(result.authenticated).toBe(false);
  });

  it('should fail if OIDC provider returns no email', async () => {
    const claims = { name: 'No Email' };

    const clientMock = await strapiMock.plugins['oidc-auth'].services.oidc.getClient();
    clientMock.userinfo.mockResolvedValue(claims);

    const ctx = {
      request: {
        header: {
          authorization: 'Bearer token-6',
        },
      },
      state: {},
    };

    const result = await strategy.authenticate(ctx);
    expect(result.authenticated).toBe(false);
    expect(result.message).toContain('missing email claim');
  });

  it('should fail if OIDC client cannot be initialized', async () => {
    strapiMock.plugins['oidc-auth'].services.oidc.getClient.mockRejectedValue(new Error('Discovery failed'));

    const ctx = {
      request: {
        header: {
          authorization: 'Bearer token-7',
        },
      },
      state: {},
    };

    const result = await strategy.authenticate(ctx);
    expect(result.authenticated).toBe(false);
    expect(result.message).toBe('Discovery failed');
  });
});
