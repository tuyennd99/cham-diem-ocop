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
  const allowedOrigins = (values.CORS_ORIGINS ?? defaultOrigin)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const smtpPort = Number(values.SMTP_PORT ?? 587);
  const smtpHost = values.SMTP_HOST?.trim();
  const smtpUser = values.SMTP_USER?.trim();
  const smtpPassword = values.SMTP_PASSWORD;
  const smtpFrom = values.SMTP_FROM?.trim();
  if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
    throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM are required');
  }
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('SMTP_PORT must be a valid port number');
  }

  return {
    port: Number.isInteger(port) && port > 0 ? port : 3030,
    jwtSecret: requireSecret('JWT_SECRET', values.JWT_SECRET),
    trustProxyHops,
    allowedOrigins,
    googleClientId: values.GOOGLE_CLIENT_ID?.trim() || undefined,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword,
    smtpFrom,
  };
}
