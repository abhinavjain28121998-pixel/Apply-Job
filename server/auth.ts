import { Request, Response, NextFunction } from 'express';
import { getFirebaseAuth } from './firebaseAdmin.js';
import './types.js';

/**
 * Checks whether demo authentication is explicitly enabled via environment configuration.
 * By default, this is disabled (returns false).
 */
export function isDemoAuthAllowed(): boolean {
  return process.env.ALLOW_DEMO_AUTH === 'true';
}

/**
 * Authenticates incoming requests by verifying the Firebase ID token in the Authorization header.
 * Rejects missing, malformed, expired, revoked, or invalid tokens with HTTP 401.
 * Only accepts demo tokens if ALLOW_DEMO_AUTH=true is explicitly configured.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ 
      error: "Unauthorized: Missing Authorization header" 
    });
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1] || !match[1].trim()) {
    return res.status(401).json({ 
      error: "Unauthorized: Malformed Authorization header. Expected 'Bearer <token>'" 
    });
  }

  const token = match[1].trim();

  // Controlled Demo Authentication
  if (token === 'demo-token' || token.startsWith('demo-')) {
    if (isDemoAuthAllowed()) {
      req.user = {
        uid: 'demo-user-123',
        email: 'demo@example.com',
        name: 'Demo User',
        isDemo: true
      };
      return next();
    } else {
      return res.status(401).json({ 
        error: "Unauthorized: Demo authentication is disabled" 
      });
    }
  }

  // Real Firebase Admin cryptographic verification
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    return res.status(500).json({ 
      error: "Server authentication service unavailable" 
    });
  }

  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token, true);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      name: decodedToken.name || null,
      picture: decodedToken.picture || null,
      isDemo: false
    };
    return next();
  } catch (err: any) {
    // Note: Do NOT log tokens or sensitive auth credentials!
    const errorCode = err?.code || 'auth/invalid-token';
    return res.status(401).json({ 
      error: `Unauthorized: Token verification failed (${errorCode})` 
    });
  }
}
