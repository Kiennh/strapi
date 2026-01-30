'use strict';

const { Issuer } = require('openid-client');

let oidcClient;

module.exports = ({ strapi }) => ({
  async getClient() {
    if (oidcClient) return oidcClient;

    const issuerUrl = process.env.STRAPI_OIDC_ISSUER;
    const clientId = process.env.STRAPI_OIDC_CLIENT_ID;
    const clientSecret = process.env.STRAPI_OIDC_CLIENT_SECRET;
    const redirectUri = process.env.STRAPI_OIDC_REDIRECT_URI || 'http://localhost:1337/admin';

    if (!issuerUrl || !clientId) {
      throw new Error('OIDC Issuer and Client ID must be configured.');
    }

    const issuer = await Issuer.discover(issuerUrl);
    oidcClient = new issuer.Client({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: [redirectUri],
      response_types: ['code'],
    });

    return oidcClient;
  },
});
