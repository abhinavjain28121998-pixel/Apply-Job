import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { JobMatch } from '../types';
import { handleFirestoreError, OperationType, shouldUseFirestore } from '../lib/firestoreError';

const getLocalMatches = (): JobMatch[] => {
  try {
    return JSON.parse(localStorage.getItem('demo_matches') || '[]');
  } catch {
    return [];
  }
};
const setLocalMatches = (matches: JobMatch[]) => {
  localStorage.setItem('demo_matches', JSON.stringify(matches));
};

export const jobMatchService = {
  getMatch: async (userId: string, jobId: string): Promise<JobMatch | null> => {
    const docId = `${userId}_${jobId}`; // Kept unique by composite because user can only have one match report per job
    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = `job_matches/${docId}`;
      try {
        const docSnap = await getDoc(doc(db, 'job_matches', docId));
        if (docSnap.exists()) {
          return docSnap.data() as JobMatch;
        }
        return null;
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    } else {
      return getLocalMatches().find(m => m.id === docId) || null;
    }
  },
  
  getMatchesForUser: async (userId: string): Promise<JobMatch[]> => {
    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = 'job_matches';
      try {
        const q = query(collection(db, path), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as JobMatch);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    } else {
      return getLocalMatches().filter(m => m.userId === userId);
    }
  },
  
  saveMatch: async (match: JobMatch): Promise<void> => {
    const docId = `${match.userId}_${match.jobId}`; // Kept unique by composite because user can only have one match report per job
    const matchToSave = { ...match, id: docId, analyzedAt: Date.now() };
    if (isFirebaseConfigured() && db && shouldUseFirestore(match.userId)) {
      const path = `job_matches/${docId}`;
      try {
        await setDoc(doc(db, 'job_matches', docId), matchToSave);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    } else {
      const matches = getLocalMatches();
      const idx = matches.findIndex(m => m.id === docId);
      if (idx >= 0) matches[idx] = matchToSave;
      else matches.push(matchToSave);
      setLocalMatches(matches);
    }
  }
};
