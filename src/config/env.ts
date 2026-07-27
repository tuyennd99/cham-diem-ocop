const defaultOrigin = 'http://localhost:5173';

export function requireSecret(name: string, value: string | undefined) {
  if (!value || Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error(`${name} must be at least 32 bytes`);
  }
  return value;
}

export function env(values: NodeJS.ProcessEnv) {
  const port = Number(values.PORT ?? 3030);
  const trustProxyHops = Number(values.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
  }

  return {
    port: Number.isInteger(port) && port > 0 ? port : 3030,
    jwtSecret: requireSecret('JWT_SECRET', values.JWT_SECRET),
    csrfSecret: requireSecret('CSRF_SECRET', values.CSRF_SECRET),
    trustProxyHops,
    allowedOrigins: (values.CORS_ORIGINS ?? defaultOrigin)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
