import crypto from 'crypto';

interface OAuthStateRecord {
  state: string;
  userId?: string;
  redirectPath?: string;
  createdAt: number;
  expiresAt: number;
}

// In-memory state store with 10-minute TTL for CSRF protection
const stateStore = new Map<string, OAuthStateRecord>();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Periodically purge states that have exceeded their TTL.
 */
function purgeExpiredStates() {
  const now = Date.now();
  for (const [key, record] of stateStore.entries()) {
    if (record.expiresAt < now) {
      stateStore.delete(key);
    }
  }
}

/**
 * Generates a cryptographically strong, random state token associated with an optional user context.
 */
export function createOAuthState(userId?: string, redirectPath?: string): string {
  purgeExpiredStates();
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  
  const record: OAuthStateRecord = {
    state: randomBytes,
    userId,
    redirectPath,
    createdAt: now,
    expiresAt: now + STATE_TTL_MS
  };

  stateStore.set(randomBytes, record);
  return randomBytes;
}

/**
 * Validates a state token and consumes it (one-time use to prevent replay attacks).
 */
export function validateAndConsumeOAuthState(state: string | undefined): { 
  valid: boolean; 
  userId?: string; 
  redirectPath?: string;
  reason?: string;
} {
  if (!state || typeof state !== 'string') {
    return { valid: false, reason: 'Missing or malformed state parameter' };
  }

  purgeExpiredStates();

  const record = stateStore.get(state);
  if (!record) {
    return { valid: false, reason: 'Invalid or expired state parameter (CSRF protection failed)' };
  }

  // Consume immediately so it cannot be reused
  stateStore.delete(state);

  if (Date.now() > record.expiresAt) {
    return { valid: false, reason: 'State parameter has expired' };
  }

  return {
    valid: true,
    userId: record.userId,
    redirectPath: record.redirectPath
  };
}

/**
 * Clears all states (used primarily for test resets).
 */
export function resetOAuthStatesForTesting() {
  stateStore.clear();
}
