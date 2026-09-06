import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { SavedJob, Job } from '../types';
import { handleFirestoreError, OperationType, shouldUseFirestore } from '../lib/firestoreError';

// Helper for local storage mock
const getLocalSavedJobs = (): SavedJob[] => {
  try {
    return JSON.parse(localStorage.getItem('demo_saved_jobs') || '[]');
  } catch {
    return [];
  }
};
const setLocalSavedJobs = (jobs: SavedJob[]) => {
  localStorage.setItem('demo_saved_jobs', JSON.stringify(jobs));
};

export const jobService = {
  getSavedJobsForUser: async (userId: string): Promise<SavedJob[]> => {
    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = 'saved_jobs';
      try {
        const q = query(collection(db, path), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as SavedJob);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    } else {
      return getLocalSavedJobs().filter(j => j.userId === userId);
    }
  },
  
  getSavedJob: async (userId: string, jobId: string): Promise<SavedJob | null> => {
    const docId = `${userId}_${jobId}`; // Kept unique by composite because user can only save a specific job once
    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = `saved_jobs/${docId}`;
      try {
        const docSnap = await getDoc(doc(db, 'saved_jobs', docId));
        if (docSnap.exists()) {
          return docSnap.data() as SavedJob;
        }
        return null;
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    } else {
      return getLocalSavedJobs().find(j => j.id === docId) || null;
    }
  },
  
  saveJob: async (userId: string, job: Job): Promise<SavedJob> => {
    const docId = `${userId}_${job.id}`;
    const savedJob: SavedJob = {
      id: docId,
      userId,
      jobId: job.id,
      job,
      dateAdded: Date.now()
    };

    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = `saved_jobs/${docId}`;
      try {
        await setDoc(doc(db, 'saved_jobs', docId), savedJob);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    } else {
      const jobs = getLocalSavedJobs();
      const idx = jobs.findIndex(j => j.id === docId);
      if (idx >= 0) jobs[idx] = savedJob;
      else jobs.push(savedJob);
      setLocalSavedJobs(jobs);
    }
    return savedJob;
  },

  updateSavedJob: async (userId: string, jobId: string, updates: Partial<SavedJob>): Promise<void> => {
    const docId = `${userId}_${jobId}`; // Kept unique by composite because user can only save a specific job once
    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = `saved_jobs/${docId}`;
      try {
        await updateDoc(doc(db, 'saved_jobs', docId), updates as any);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } else {
      const jobs = getLocalSavedJobs();
      const idx = jobs.findIndex(j => j.id === docId);
      if (idx >= 0) {
        jobs[idx] = { ...jobs[idx], ...updates };
        setLocalSavedJobs(jobs);
      }
    }
  }
};
