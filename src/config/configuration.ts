import * as process from 'process';

export default () => ({
  app: {
    port: parseInt(process.env?.APP_PORT || '3030', 10),
    env: process.env?.APP_ENV || 'development',
  },
  authentication: {
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  },

  server_url: {
    url: process.env.SERVER_URL,
  },
});
