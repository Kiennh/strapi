'use strict';

module.exports = ({ strapi }) => ({
  async getLoginUrl(ctx) {
    const { state } = ctx.query;
    const client = await strapi.plugin('oidc-auth').service('oidc').getClient();
    const url = client.authorizationUrl({
      scope: 'openid email profile',
      state,
    });
    ctx.body = { url };
  },

  async callback(ctx) {
    const { code, state } = ctx.query;
    const client = await strapi.plugin('oidc-auth').service('oidc').getClient();
    const redirectUri = process.env.STRAPI_OIDC_REDIRECT_URI || 'http://localhost:1337/admin';

    // openid-client v4 callback handles state verification if provided in checks
    const tokenSet = await client.callback(redirectUri, { code, state }, { state });
    ctx.body = {
      access_token: tokenSet.access_token,
      refresh_token: tokenSet.refresh_token,
    };
  },

  async refresh(ctx) {
    const { refreshToken } = ctx.query;
    const client = await strapi.plugin('oidc-auth').service('oidc').getClient();
    const tokenSet = await client.refresh(refreshToken);
    ctx.body = {
      access_token: tokenSet.access_token,
      refresh_token: tokenSet.refresh_token,
    };
  },
});
