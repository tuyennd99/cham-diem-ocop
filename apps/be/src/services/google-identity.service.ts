import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { OAuth2Client } from 'google-auth-library';
import { createHash, timingSafeEqual } from 'node:crypto';

@Injectable()
export class GoogleIdentityService {
  private readonly client = new OAuth2Client();

  async verify(credential: string, nonceHash: string): Promise<{
    sub: string; email: string; suggestedName: string | null; authoritative: boolean;
  }> {
    const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!googleClientId) throw new ServiceUnavailableException('Google sign-in is not configured');
    try {
      // The library verifies signature, issuer, audience and token lifetime.
      const ticket = await this.client.verifyIdToken({ idToken: credential, audience: googleClientId });
      const payload = ticket.getPayload();
      const nonce = (payload as { nonce?: unknown } | undefined)?.nonce;
      if (!payload || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255 ||
        typeof payload.email !== 'string' || payload.email_verified !== true || typeof nonce !== 'string') {
        throw new Error('Missing required claims');
      }
      const email = payload.email.trim().toLowerCase();
      if (email.length > 320 || !isEmail(email)) throw new Error('Invalid email claim');
      const actual = createHash('sha256').update(nonce).digest();
      const expected = Buffer.from(nonceHash, 'hex');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Invalid nonce');
      return {
        sub: payload.sub, email,
        suggestedName: typeof payload.name === 'string' ? payload.name.trim().slice(0, 255) || null : null,
        authoritative: email.endsWith('@gmail.com') || (typeof payload.hd === 'string' && !!payload.hd.trim()),
      };
    } catch {
      // Upstream errors can contain the credential; never propagate or log them.
      throw new UnauthorizedException('Invalid Google credential');
    }
  }
}
