const defaultOrigin = 'http://localhost:5173';

export function requireSecret(name: string, value: string | undefined) {
  if (!value || Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error(`${name} must be at least 32 bytes`);
  }
  return value;
}

export interface AppEnv {
  readonly port: number;
  readonly jwtSecret: string;
  readonly trustProxyHops: number;
  readonly allowedOrigins: readonly string[];
  readonly googleClientId: string | undefined;
  readonly smtpHost: string;
  readonly smtpPort: number;
  readonly smtpUser: string;
  readonly smtpPassword: string;
  readonly smtpFrom: string;
}

let cachedEnvSignature: string | null = null;
let cachedEnvConfig: AppEnv | null = null;

export function resetEnvCacheForTest() {
  cachedEnvSignature = null;
  cachedEnvConfig = null;
}

export function getGoogleClientId(
  values: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return values.GOOGLE_CLIENT_ID?.trim() || undefined;
}

function buildEnvSignature(values: NodeJS.ProcessEnv): string {
  return [
    values.PORT ?? '',
    values.TRUST_PROXY_HOPS ?? '',
    values.CORS_ORIGINS ?? '',
    values.JWT_SECRET ?? '',
    values.GOOGLE_CLIENT_ID ?? '',
    values.SMTP_HOST ?? '',
    values.SMTP_PORT ?? '',
    values.SMTP_USER ?? '',
    values.SMTP_PASSWORD ?? '',
    values.SMTP_FROM ?? '',
  ].join('\0');
}

function parseEnv(values: NodeJS.ProcessEnv): AppEnv {
  const port = Number(values.PORT ?? 3030);
  const trustProxyHops = Number(values.TRUST_PROXY_HOPS ?? 0);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
  }
  const allowedOrigins = Object.freeze(
    (values.CORS_ORIGINS ?? defaultOrigin)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  const smtpPort = Number(values.SMTP_PORT ?? 587);
  const smtpHost = values.SMTP_HOST?.trim();
  const smtpUser = values.SMTP_USER?.trim();
  const smtpPassword = values.SMTP_PASSWORD;
  const smtpFrom = values.SMTP_FROM?.trim();
  if (!smtpHost || !smtpUser || !smtpPassword || !smtpFrom) {
    throw new Error(
      'SMTP_HOST, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM are required',
    );
  }
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error('SMTP_PORT must be a valid port number');
  }

  return Object.freeze({
    port: Number.isInteger(port) && port > 0 ? port : 3030,
    jwtSecret: requireSecret('JWT_SECRET', values.JWT_SECRET),
    trustProxyHops,
    allowedOrigins,
    googleClientId: getGoogleClientId(values),
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword,
    smtpFrom,
  });
}

export function env(values: NodeJS.ProcessEnv = process.env): AppEnv {
  if (values === process.env) {
    const signature = buildEnvSignature(values);
    if (cachedEnvConfig && cachedEnvSignature === signature) {
      return cachedEnvConfig;
    }
    const parsed = parseEnv(values);
    cachedEnvSignature = signature;
    cachedEnvConfig = parsed;
    return parsed;
  }
  return parseEnv(values);
}
