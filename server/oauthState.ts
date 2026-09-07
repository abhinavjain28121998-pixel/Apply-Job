import crypto from 'crypto';
import { getFirebaseFirestore } from './firebaseAdmin.js';

interface OAuthStateRecord {
  state: string;
  userId: string;
  redirectPath?: string;
  createdAt: number;
  expiresAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// In-memory fallback ONLY if in test or development environment and Firestore is unavailable
const memoryStore = new Map<string, OAuthStateRecord>();

/**
 * Validates that a redirect path is internal and safe from open redirects.
 */
export function isValidInternalRedirectPath(path: string | undefined): boolean {
  if (!path) return true;
  const trimmed = path.trim();
  if (trimmed === '') return true;
  
  // Must start with exactly one '/' and not be followed by another slash or backslash
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return false;
  }
  
  // Must not contain protocol schemes, backslashes, or colons
  if (trimmed.includes(':') || trimmed.includes('\\')) {
    return false;
  }
  
  // Strictly allow alpha-numeric, slashes, dashes, underscores, and basic query parameter chars
  const pathRegex = /^\/[a-zA-Z0-9\-_/?&=]*$/;
  return pathRegex.test(trimmed);
}

/**
 * Periodically purge states that have exceeded their TTL.
 */
async function purgeExpiredStates() {
  const firestore = getFirebaseFirestore();
  const now = Date.now();
  
  // Always clean the memory store
  for (const [key, record] of memoryStore.entries()) {
    if (record.expiresAt < now) {
      memoryStore.delete(key);
    }
  }

  if (firestore) {
    try {
      const snapshot = await firestore.collection('oauth_states')
        .where('expiresAt', '<', now)
        .get();
      if (!snapshot.empty) {
        const batch = firestore.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
    } catch (e: any) {
      // Gracefully log permission or other errors without breaking the request thread
      const isExpected = e?.code === 7 || e?.message?.includes('PERMISSION_DENIED');
      if (!isExpected) {
        console.warn('Failed to purge expired OAuth states from Firestore:', e?.message || e);
      }
    }
  }
}

/**
 * Generates a cryptographically strong, random state token associated with an authenticated user context.
 */
export async function createOAuthState(userId: string, redirectPath?: string): Promise<string> {
  if (!userId) {
    throw new Error('An OAuth connection must always belong to an authenticated Firebase user.');
  }

  if (redirectPath && !isValidInternalRedirectPath(redirectPath)) {
    throw new Error('Invalid redirect path provided. Open redirects are strictly prohibited.');
  }

  // Purge asynchronously without blocking the request
  purgeExpiredStates().catch(() => {});

  const randomBytes = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  
  const record: OAuthStateRecord = {
    state: randomBytes,
    userId,
    redirectPath: redirectPath || '',
    createdAt: now,
    expiresAt: now + STATE_TTL_MS
  };

  // Always pre-populate memoryStore so we can retrieve it even if Firestore writes fail
  memoryStore.set(randomBytes, record);

  const firestore = getFirebaseFirestore();
  if (firestore) {
    try {
      await firestore.collection('oauth_states').doc(randomBytes).set(record);
    } catch (e: any) {
      const isPermissionDenied = e?.code === 7 || e?.message?.includes('PERMISSION_DENIED');
      if (isPermissionDenied) {
        console.warn('Firestore write permission denied for oauth_states. Utilizing secure in-memory fallback store.');
      } else {
        console.warn('Could not write OAuth state to Firestore, falling back to memory store:', e?.message || e);
      }
    }
  }

  return randomBytes;
}

/**
 * Validates a state token and consumes it atomically (one-time use to prevent replay attacks).
 */
export async function validateAndConsumeOAuthState(state: string | undefined): Promise<{ 
  valid: boolean; 
  userId?: string; 
  redirectPath?: string;
  reason?: string;
}> {
  if (!state || typeof state !== 'string') {
    return { valid: false, reason: 'Missing or malformed state parameter' };
  }

  // Purge asynchronously
  purgeExpiredStates().catch(() => {});

  const firestore = getFirebaseFirestore();

  if (firestore) {
    try {
      const docRef = firestore.collection('oauth_states').doc(state);
      
      const result = await firestore.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists) {
          // If Firestore is missing the document, check if we have it in our local memory store
          const memoryRecord = memoryStore.get(state);
          if (memoryRecord) {
            memoryStore.delete(state);
            if (Date.now() > memoryRecord.expiresAt) {
              return { valid: false, reason: 'State parameter has expired' };
            }
            if (memoryRecord.redirectPath && !isValidInternalRedirectPath(memoryRecord.redirectPath)) {
              return { valid: false, reason: 'Malicious redirect path detected' };
            }
            return {
              valid: true,
              userId: memoryRecord.userId,
              redirectPath: memoryRecord.redirectPath
            };
          }
          return { valid: false, reason: 'Invalid or expired state parameter (CSRF protection failed)' };
        }
        
        const record = docSnap.data() as OAuthStateRecord;
        
        // Delete the record atomically within the transaction (single-use / replay protection)
        transaction.delete(docRef);
        
        // Clean up memory store as well
        memoryStore.delete(state);

        if (Date.now() > record.expiresAt) {
          return { valid: false, reason: 'State parameter has expired' };
        }

        if (record.redirectPath && !isValidInternalRedirectPath(record.redirectPath)) {
          return { valid: false, reason: 'Malicious redirect path detected' };
        }
        
        return {
          valid: true,
          userId: record.userId,
          redirectPath: record.redirectPath
        };
      });
      
      return result;
    } catch (e: any) {
      const isPermissionDenied = e?.code === 7 || e?.message?.includes('PERMISSION_DENIED');
      if (isPermissionDenied) {
        console.warn('Firestore read permission denied for oauth_states. Consuming from secure in-memory fallback store.');
      } else {
        console.error('Error validating state atomically in Firestore, checking memory store:', e?.message || e);
      }
    }
  }

  // Handle fallback using memory store
  const record = memoryStore.get(state);
  if (record) {
    memoryStore.delete(state);
    if (Date.now() > record.expiresAt) {
      return { valid: false, reason: 'State parameter has expired' };
    }
    if (record.redirectPath && !isValidInternalRedirectPath(record.redirectPath)) {
      return { valid: false, reason: 'Malicious redirect path detected' };
    }
    return {
      valid: true,
      userId: record.userId,
      redirectPath: record.redirectPath
    };
  }

  return { valid: false, reason: 'Invalid or expired state parameter (CSRF protection failed)' };
}

/**
 * Clears all states (used primarily for test resets).
 */
export async function resetOAuthStatesForTesting(): Promise<void> {
  const firestore = getFirebaseFirestore();
  if (firestore) {
    try {
      const snapshot = await firestore.collection('oauth_states').get();
      if (!snapshot.empty) {
        const batch = firestore.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
    } catch (e: any) {
      const isExpected = e?.code === 7 || e?.message?.includes('PERMISSION_DENIED');
      if (!isExpected) {
        console.warn('Failed to reset oauth_states in Firestore:', e?.message || e);
      }
    }
  }
  memoryStore.clear();
}


