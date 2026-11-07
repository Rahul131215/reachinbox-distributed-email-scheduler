
import { OAuth2Client } from 'google-auth-library';
import jwt, { type JwtPayload } from 'jsonwebtoken';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'MEMBER';
  tenantId: string;
  picture?: string;
}

const ALLOWED_ROLES = ['ADMIN', 'OPERATOR', 'MEMBER'] as const;

function getGoogleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID || '';
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be configured with at least 32 characters.'
    );
  }

  return secret;
}

export class AuthService {
  /**
   * Verify Google OAuth ID token.
   * Never accept an unverified or merely decoded token.
   */
  public static async verifyGoogleToken(idToken: string): Promise<{
    valid: boolean;
    payload?: {
      email: string;
      name: string;
      sub: string;
      picture?: string;
    };
    error?: string;
  }> {
    if (!idToken) {
      return { valid: false, error: 'Token is required' };
    }

    const clientId = getGoogleClientId();

    if (!clientId) {
      return {
        valid: false,
        error: 'Google OAuth is not configured.'
      };
    }

    try {
      const client = new OAuth2Client(clientId);

      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId
      });

      const payload = ticket.getPayload();

      if (
        !payload ||
        !payload.sub ||
        !payload.email ||
        payload.email_verified !== true
      ) {
        return {
          valid: false,
          error: 'Google token is missing required verified identity claims.'
        };
      }

      return {
        valid: true,
        payload: {
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          sub: payload.sub,
          picture: payload.picture
        }
      };
    } catch {
      return {
        valid: false,
        error: 'Invalid or expired Google OAuth token.'
      };
    }
  }

  /**
   * Generate a signed session JWT.
   */
  public static generateSessionToken(user: AuthenticatedUser): string {
    if (!user.id || !user.email || !user.tenantId) {
      throw new Error('User ID, email and tenant ID are required.');
    }

    if (!ALLOWED_ROLES.includes(user.role)) {
      throw new Error('Invalid user role.');
    }

    return jwt.sign(
      {
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId
      },
      getJwtSecret(),
      {
        subject: user.id,
        expiresIn: '7d',
        algorithm: 'HS256'
      }
    );
  }

  /**
   * Verify session JWT and validate its required claims.
   */
  public static verifySessionToken(
    token: string
  ): AuthenticatedUser | null {
    if (!token) {
      return null;
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret(), {
        algorithms: ['HS256']
      });

      if (typeof decoded === 'string') {
        return null;
      }

      const claims = decoded as JwtPayload;

      if (
        typeof claims.sub !== 'string' ||
        typeof claims.email !== 'string' ||
        typeof claims.name !== 'string' ||
        typeof claims.tenantId !== 'string' ||
        !claims.tenantId ||
        !ALLOWED_ROLES.includes(
          claims.role as typeof ALLOWED_ROLES[number]
        )
      ) {
        return null;
      }

      return {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        role: claims.role as AuthenticatedUser['role'],
        tenantId: claims.tenantId
      };
    } catch {
      return null;
    }
  }
}
