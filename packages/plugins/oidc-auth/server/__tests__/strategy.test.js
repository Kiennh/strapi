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
      // Explicitly mock methods for robustness as suggested by code review
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
});
