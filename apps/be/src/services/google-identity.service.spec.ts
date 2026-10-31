import { OAuth2Client } from 'google-auth-library';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { GoogleIdentityService } from './google-identity.service';

describe('GoogleIdentityService', () => {
  const nonceHash = createHash('sha256').update('server-nonce').digest('hex');
  const service = new GoogleIdentityService();
  const previous = { ...process.env };
  const payload = { sub: 'google-sub', email: ' Owner@Gmail.com ', email_verified: true, nonce: 'server-nonce', name: 'Owner' };
  let verify: jest.SpyInstance;
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    verify = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({ getPayload: () => payload } as never);
  });
  afterEach(() => { jest.restoreAllMocks(); process.env = { ...previous }; });

  it('passes the configured audience to the signature verifier and normalizes verified identity', async () => {
    await expect(service.verify('signed-credential', nonceHash)).resolves.toEqual({ sub: 'google-sub', email: 'owner@gmail.com', suggestedName: 'Owner', authoritative: true });
    expect(verify).toHaveBeenCalledWith({ idToken: 'signed-credential', audience: 'test-client.apps.googleusercontent.com' });
  });

  it.each([
    [{ ...payload, email: 'owner@example.com' }, false],
    [{ ...payload, email: 'owner@example.com', hd: 'example.com' }, true],
    [{ ...payload, email: 'owner@example.com', hd: '  ' }, false],
  ])('does not trust third-party email verification without Workspace authority', async (claims, authoritative) => {
    verify.mockResolvedValue({ getPayload: () => claims });
    expect((await service.verify('credential', nonceHash)).authoritative).toBe(authoritative);
  });

  it.each([
    { ...payload, sub: undefined }, { ...payload, email: undefined },
    { ...payload, email: 'bad-email' }, { ...payload, email_verified: false },
    { ...payload, nonce: undefined }, { ...payload, nonce: 'wrong-nonce' },
  ])('rejects missing or invalid required signed claims', async (claims) => {
    verify.mockResolvedValue({ getPayload: () => claims });
    await expect(service.verify('credential', nonceHash)).rejects.toMatchObject({ status: 401 });
  });

  it('hides verifier errors and never returns unverified identity', async () => {
    verify.mockRejectedValue(new Error('signature/issuer/audience/expiry failure: credential-secret'));
    await expect(service.verify('credential-secret', nonceHash)).rejects.toThrow('Invalid Google credential');
  });

  it('reports missing optional configuration without calling Google', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    await expect(service.verify('credential', nonceHash)).rejects.toThrow('Google sign-in is not configured');
    expect(verify).not.toHaveBeenCalled();
  });
});

describe('Google identity verification with offline signed tokens', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const previous = { ...process.env };
  const service = new GoogleIdentityService();
  const nonceHash = createHash('sha256').update('server-nonce').digest('hex');
  const token = (claims: Record<string, unknown> = {}, corruptSignature = false) => {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'offline-key' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://accounts.google.com', aud: 'test-client.apps.googleusercontent.com', iat: now, exp: now + 600,
      sub: 'offline-sub', email: 'offline@gmail.com', email_verified: true, nonce: 'server-nonce', ...claims,
    })).toString('base64url');
    const data = `${header}.${payload}`;
    return `${data}.${(corruptSignature ? Buffer.alloc(256) : sign('RSA-SHA256', Buffer.from(data), privateKey)).toString('base64url')}`;
  };
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    // Replace only Google's public-key fetch; execute the real signature verifier.
    jest.spyOn(OAuth2Client.prototype, 'getFederatedSignonCertsAsync').mockResolvedValue({
      certs: { 'offline-key': publicKey.export({ type: 'spki', format: 'pem' }) }, format: 'PEM',
    } as never);
  });
  afterEach(() => { jest.restoreAllMocks(); process.env = { ...previous }; });

  it('accepts a valid signature, audience, issuer, lifetime and nonce without a network request', async () => {
    await expect(service.verify(token(), nonceHash)).resolves.toMatchObject({ sub: 'offline-sub', email: 'offline@gmail.com' });
  });

  it.each([
    ['signature', {}, true],
    ['audience', { aud: 'other-client.apps.googleusercontent.com' }, false],
    ['issuer', { iss: 'https://evil.invalid' }, false],
    ['expiry', { exp: 1 }, false],
    ['nonce', { nonce: 'different-nonce' }, false],
    ['missing email', { email: undefined }, false],
  ])('rejects invalid %s through the real library boundary', async (_label, claims, corruptSignature) => {
    await expect(service.verify(token(claims as Record<string, unknown>, corruptSignature as boolean), nonceHash)).rejects.toMatchObject({ status: 401 });
  });
});
