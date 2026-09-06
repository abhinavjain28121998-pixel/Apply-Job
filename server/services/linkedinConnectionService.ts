import { LinkedInConnection } from '../../src/types.js';
import { getFirebaseFirestore } from '../firebaseAdmin.js';

// In-memory fallback connection store
const memoryConnections = new Map<string, LinkedInConnection>();

export const linkedinConnectionService = {
  async getConnection(userId: string): Promise<LinkedInConnection | null> {
    if (!userId) return null;

    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const docSnap = await firestore.collection('linkedin_connections').doc(userId).get();
        if (docSnap.exists) {
          return docSnap.data() as LinkedInConnection;
        }
      } catch (e: any) {
        const isExpected = e?.code === 5 || e?.code === 7 || e?.message?.includes('NOT_FOUND') || e?.message?.includes('PERMISSION_DENIED');
        if (!isExpected) {
          console.warn('Could not read LinkedIn connection from Firestore, checking in-memory store:', e?.message || e);
        }
      }
    }

    return memoryConnections.get(userId) || null;
  },

  async saveConnection(connection: LinkedInConnection): Promise<void> {
    if (!connection.userId) return;

    memoryConnections.set(connection.userId, connection);

    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        await firestore.collection('linkedin_connections').doc(connection.userId).set(connection, { merge: true });
      } catch (e: any) {
        const isExpected = e?.code === 5 || e?.code === 7 || e?.message?.includes('NOT_FOUND') || e?.message?.includes('PERMISSION_DENIED');
        if (!isExpected) {
          console.warn('Could not persist LinkedIn connection to Firestore:', e?.message || e);
        }
      }
    }
  },

  async revokeConnection(userId: string): Promise<void> {
    if (!userId) return;

    const existing = memoryConnections.get(userId);
    if (existing) {
      existing.status = 'REVOKED';
      memoryConnections.set(userId, existing);
    }

    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        await firestore.collection('linkedin_connections').doc(userId).set({
          status: 'REVOKED',
          revokedAt: Date.now()
        }, { merge: true });
      } catch (e: any) {
        const isExpected = e?.code === 5 || e?.code === 7 || e?.message?.includes('NOT_FOUND') || e?.message?.includes('PERMISSION_DENIED');
        if (!isExpected) {
          console.warn('Could not revoke LinkedIn connection in Firestore:', e?.message || e);
        }
      }
    }
  }
};
