process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/congan_e2e?schema=public';
process.env.JWT_SECRET ??= 'test-jwt-secret-at-least-32-characters';
process.env.CSRF_SECRET ??= 'test-csrf-secret-at-least-32-characters';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';
process.env.DISABLE_SCHEDULER = 'true';
