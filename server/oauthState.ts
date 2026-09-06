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

// In-memory fallback ONLY if Firestore is unavailable (e.g. testing without firebase initialization)
const memoryStore = new Map<string, OAuthStateRecord>();

/**
 * Periodically purge states that have exceeded their TTL.
 */
async function purgeExpiredStates() {
  const firestore = getFirebaseFirestore();
  const now = Date.now();
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
    } catch (e) {
      console.warn('Failed to purge expired OAuth states from Firestore:', e);
    }
  } else {
    for (const [key, record] of memoryStore.entries()) {
      if (record.expiresAt < now) {
        memoryStore.delete(key);
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

  const firestore = getFirebaseFirestore();
  if (firestore) {
    await firestore.collection('oauth_states').doc(randomBytes).set(record);
  } else {
    memoryStore.set(randomBytes, record);
  }

  return randomBytes;
}

/**
 * Validates a state token and consumes it (one-time use to prevent replay attacks).
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
  let record: OAuthStateRecord | undefined;

  if (firestore) {
    try {
      const docRef = firestore.collection('oauth_states').doc(state);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        record = docSnap.data() as OAuthStateRecord;
        // Consume immediately (delete from Firestore to prevent replay attack)
        await docRef.delete();
      }
    } catch (e: any) {
      console.error('Error fetching/deleting state from Firestore:', e);
      return { valid: false, reason: 'Database error validating state parameter' };
    }
  } else {
    record = memoryStore.get(state);
    if (record) {
      memoryStore.delete(state);
    }
  }

  if (!record) {
    return { valid: false, reason: 'Invalid or expired state parameter (CSRF protection failed)' };
  }

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
    } catch (e) {
      console.warn('Failed to reset oauth_states in Firestore:', e);
    }
  }
  memoryStore.clear();
}

