'use strict';

const strategy = require('./strategies/oidc');

module.exports = ({ strapi }) => {
  strapi.get('auth').register('admin', strategy);
};
