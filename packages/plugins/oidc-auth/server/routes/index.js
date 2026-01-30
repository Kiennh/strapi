'use strict';

module.exports = [
  {
    method: 'GET',
    path: '/login-url',
    handler: 'oidc.getLoginUrl',
    config: { auth: false },
  },
  {
    method: 'GET',
    path: '/callback',
    handler: 'oidc.callback',
    config: { auth: false },
  },
  {
    method: 'GET',
    path: '/refresh',
    handler: 'oidc.refresh',
    config: { auth: false },
  },
];
