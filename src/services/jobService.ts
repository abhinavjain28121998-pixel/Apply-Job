import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { Job } from '../types';

// Helper for local storage mock
const getLocalJobs = (): Job[] => {
  try {
    return JSON.parse(localStorage.getItem('demo_jobs') || '[]');
  } catch {
    return [];
  }
};
const setLocalJobs = (jobs: Job[]) => {
  localStorage.setItem('demo_jobs', JSON.stringify(jobs));
};

export const jobService = {
  getJobsForUser: async (userId: string): Promise<Job[]> => {
    if (isFirebaseConfigured() && db) {
      const q = query(collection(db, 'jobs'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Job);
    } else {
      return getLocalJobs().filter(j => j.userId === userId);
    }
  },
  
  getJobById: async (jobId: string): Promise<Job | null> => {
    if (isFirebaseConfigured() && db) {
      const docSnap = await getDoc(doc(db, 'jobs', jobId));
      if (docSnap.exists()) {
        return docSnap.data() as Job;
      }
      return null;
    } else {
      return getLocalJobs().find(j => j.id === jobId) || null;
    }
  },
  
  saveJob: async (job: Job): Promise<void> => {
    if (isFirebaseConfigured() && db) {
      await setDoc(doc(db, 'jobs', job.id), job);
    } else {
      const jobs = getLocalJobs();
      const idx = jobs.findIndex(j => j.id === job.id);
      if (idx >= 0) jobs[idx] = job;
      else jobs.push(job);
      setLocalJobs(jobs);
    }
  },

  updateJob: async (jobId: string, updates: Partial<Job>): Promise<void> => {
    if (isFirebaseConfigured() && db) {
      await updateDoc(doc(db, 'jobs', jobId), updates as any);
    } else {
      const jobs = getLocalJobs();
      const idx = jobs.findIndex(j => j.id === jobId);
      if (idx >= 0) {
        jobs[idx] = { ...jobs[idx], ...updates };
        setLocalJobs(jobs);
      }
    }
  }
};
