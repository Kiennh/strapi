'use strict';

const register = require('../register');
const strategy = require('../strategies/oidc');

describe('Plugin Registration', () => {
  it('should register the admin authentication strategy', () => {
    const registerMock = jest.fn();
    const strapi = {
      get: jest.fn().mockReturnValue({
        register: registerMock,
      }),
    };

    register({ strapi });

    expect(strapi.get).toHaveBeenCalledWith('auth');
    expect(registerMock).toHaveBeenCalledWith('admin', strategy);
  });
});
