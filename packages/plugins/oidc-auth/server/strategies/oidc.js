'use strict';

const claimsCache = new Map();

module.exports = {
  name: 'admin',
  async authenticate(ctx) {
    const { authorization } = ctx.request.header;

    if (!authorization) {
      return { authenticated: false };
    }

    const [scheme, token] = authorization.split(/\s+/);

    if (scheme.toLowerCase() !== 'bearer' || !token) {
      return { authenticated: false };
    }

    try {
      const client = await strapi.plugin('oidc-auth').service('oidc').getClient();

      let claims;
      const cached = claimsCache.get(token);
      if (cached && cached.expiresAt > Date.now()) {
        claims = cached.claims;
      } else {
        claims = await client.userinfo(token);
        if (claims) {
          // Cache for 1 minute to reduce overhead on OIDC provider
          claimsCache.set(token, { claims, expiresAt: Date.now() + 60000 });
        }
      }

      if (!claims || !claims.email) {
        return { authenticated: false, message: 'Invalid token or missing email claim' };
      }

      const email = claims.email;

      let roleCodes = [];
      if (Array.isArray(claims.roles)) {
        roleCodes = claims.roles;
      } else if (claims.resource_access && claims.resource_access[client.client_id]) {
        roleCodes = claims.resource_access[client.client_id].roles || [];
      } else if (Array.isArray(claims.groups)) {
        roleCodes = claims.groups;
      }

      let user = await strapi.db.query('admin::user').findOne({
        where: { email: { $eqi: email } },
        populate: ['roles'],
      });

      if (!user) {
        const effectiveRoleCodes = roleCodes.length > 0 ? roleCodes : ['strapi-editor'];

        const roles = await strapi.db.query('admin::role').findMany({
          where: { code: { $in: effectiveRoleCodes } },
        });

        if (roles.length === 0) {
          const authorRole = await strapi.db
            .query('admin::role')
            .findOne({ where: { code: 'strapi-author' } });
          if (authorRole) roles.push(authorRole);
        }

        user = await strapi.service('admin::user').create({
          email,
          firstname: claims.given_name || 'OIDC',
          lastname: claims.family_name || 'User',
          roles: roles.map((r) => r.id),
          isActive: true,
          registrationToken: null,
        });
      } else {
        // Sync roles for existing user
        const roles = await strapi.db.query('admin::role').findMany({
          where: { code: { $in: roleCodes } },
        });

        const currentRoleIds = user.roles.map((r) => r.id).sort();
        const newRoleIds = roles.map((r) => r.id).sort();

        if (JSON.stringify(currentRoleIds) !== JSON.stringify(newRoleIds)) {
          user = await strapi.service('admin::user').updateById(user.id, {
            roles: newRoleIds,
          });
        }
      }

      if (!user || user.isActive === false) {
        return { authenticated: false };
      }

      const userAbility = await strapi.service('admin::permission').engine.generateUserAbility(user);

      ctx.state.user = user;
      ctx.state.userAbility = userAbility;

      return {
        authenticated: true,
        credentials: user,
        ability: userAbility,
      };
    } catch (err) {
      strapi.log.error(err);
      return { authenticated: false, message: err.message };
    }
  },
};
