import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { JobMatch } from '../types';

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
    if (isFirebaseConfigured() && db) {
      const docSnap = await getDoc(doc(db, 'job_matches', docId));
      if (docSnap.exists()) {
        return docSnap.data() as JobMatch;
      }
      return null;
    } else {
      return getLocalMatches().find(m => m.id === docId) || null;
    }
  },
  
  saveMatch: async (match: JobMatch): Promise<void> => {
    const docId = `${match.userId}_${match.jobId}`; // Kept unique by composite because user can only have one match report per job
    match.id = docId;
    if (isFirebaseConfigured() && db) {
      await setDoc(doc(db, 'job_matches', docId), match);
    } else {
      const matches = getLocalMatches();
      const idx = matches.findIndex(m => m.id === docId);
      if (idx >= 0) matches[idx] = match;
      else matches.push(match);
      setLocalMatches(matches);
    }
  }
};
