import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const JWT_SECRET = process.env.JWT_SECRET || 'reachinbox-dev-jwt-secret-key-super-secure';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'MEMBER';
  tenantId: string;
  picture?: string;
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export class AuthService {
  /**
   * Verify Google OAuth ID Token
   */
  public static async verifyGoogleToken(idToken: string): Promise<{
    valid: boolean;
    payload?: any;
    error?: string;
  }> {
    if (!idToken) {
      return { valid: false, error: 'Token is required' };
    }

    try {
      if (!GOOGLE_CLIENT_ID) {
        // If GOOGLE_CLIENT_ID is not configured in env, decode without signature verification for dev/preview
        const decoded: any = jwt.decode(idToken);
        if (decoded && decoded.email) {
          return {
            valid: true,
            payload: {
              email: decoded.email,
              name: decoded.name || decoded.email.split('@')[0],
              sub: decoded.sub || 'google_sub',
              picture: decoded.picture,
            },
          };
        }
        return {
          valid: false,
          error: 'GOOGLE_CLIENT_ID is not configured in environment and token could not be parsed.',
        };
      }

      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      if (!payload || !payload.email) {
        return { valid: false, error: 'Token missing required email claim' };
      }

      return {
        valid: true,
        payload: {
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          sub: payload.sub,
          picture: payload.picture,
        },
      };
    } catch (err: any) {
      return { valid: false, error: err?.message || 'Invalid or expired Google OAuth token' };
    }
  }

  /**
   * Generate session JWT token for tenant user
   */
  public static generateSessionToken(user: AuthenticatedUser): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  /**
   * Verify session JWT token
   */
  public static verifySessionToken(token: string): AuthenticatedUser | null {
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      return {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role || 'MEMBER',
        tenantId: decoded.tenantId,
      };
    } catch {
      return null;
    }
  }
}
