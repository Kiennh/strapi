'use strict';

const STORAGE_KEYS = {
  TOKEN: 'jwtToken',
  REFRESH_TOKEN: 'refreshToken',
  OIDC_STATE: 'oidcState',
};

const getStoredToken = () => {
  const token =
    localStorage.getItem(STORAGE_KEYS.TOKEN) ?? sessionStorage.getItem(STORAGE_KEYS.TOKEN);

  if (typeof token === 'string') {
    try {
      return JSON.parse(token);
    } catch (e) {
      return null;
    }
  }

  return null;
};

const generateRandomString = (length) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(values[i] % charset.length);
  }
  return result;
};

export default {
  register(app) {
    // Nothing to register
  },
  async bootstrap(app) {
    const token = getStoredToken();
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    // 1. If we have a code and state, exchange it for tokens
    if (code && state) {
      const storedState = window.sessionStorage.getItem(STORAGE_KEYS.OIDC_STATE);
      if (state !== storedState) {
        console.error('OIDC state mismatch');
      } else {
        try {
          // Removed /api prefix as per review feedback
          const response = await fetch(`${window.strapi.backendURL}/oidc-auth/callback?code=${code}&state=${state}`, {
            method: 'GET',
          });
          const data = await response.json();

          if (data.access_token) {
            // Using JSON.stringify to stay consistent with Strapi's own token storage
            window.localStorage.setItem(STORAGE_KEYS.TOKEN, JSON.stringify(data.access_token));
            if (data.refresh_token) {
              window.sessionStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, JSON.stringify(data.refresh_token));
            }
            window.sessionStorage.removeItem(STORAGE_KEYS.OIDC_STATE);
            // Clean up URL and reload
            window.location.href = window.location.origin + window.location.pathname;
            return;
          }
        } catch (error) {
          console.error('OIDC callback failed', error);
        }
      }
    }

    // 2. If no token and not on a login/auth page, redirect to OIDC provider
    const isAuthPage = window.location.pathname.startsWith('/admin/auth');
    if (!token && !isAuthPage) {
      try {
        const newState = generateRandomString(32);
        window.sessionStorage.setItem(STORAGE_KEYS.OIDC_STATE, newState);
        const response = await fetch(`${window.strapi.backendURL}/oidc-auth/login-url?state=${newState}`);
        const { url } = await response.json();
        window.location.href = url;
      } catch (error) {
        console.error('Failed to get OIDC login URL', error);
      }
    }

    // 3. Token refresh logic
    if (token) {
      setInterval(async () => {
        const refreshToken = JSON.parse(window.sessionStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN));
        if (refreshToken) {
          try {
            const response = await fetch(`${window.strapi.backendURL}/oidc-auth/refresh?refreshToken=${refreshToken}`);
            const data = await response.json();
            if (data.access_token) {
              window.localStorage.setItem(STORAGE_KEYS.TOKEN, JSON.stringify(data.access_token));
            }
          } catch (error) {
            console.error('Token refresh failed', error);
          }
        }
      }, 1000 * 60 * 5); // Every 5 minutes
    }
  },
};
