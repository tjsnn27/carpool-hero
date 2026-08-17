import { Configuration, LogLevel } from '@azure/msal-browser';

const mockAuth = import.meta.env.VITE_MOCK_AUTH === 'true';

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AAD_CLIENT_ID || '00000000-0000-0000-0000-000000000000',
    authority: import.meta.env.VITE_AAD_AUTHORITY || 'https://login.microsoftonline.com/common',
    redirectUri: import.meta.env.VITE_AAD_REDIRECT_URI || window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
    },
  },
};

/** Delegated scopes for teacher SSO + group membership lookup */
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read', 'GroupMember.Read.All'],
};

export const graphScopes = {
  scopes: ['User.Read', 'GroupMember.Read.All'],
};

export const isMockAuth = mockAuth;
