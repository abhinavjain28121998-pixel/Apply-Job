import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { Application, JobStatus } from '../types';
import { handleFirestoreError, OperationType, shouldUseFirestore } from '../lib/firestoreError';

// Helper for local storage mock
const getLocalApps = (): Application[] => {
  try {
    return JSON.parse(localStorage.getItem('demo_apps') || '[]');
  } catch {
    return [];
  }
};
const setLocalApps = (apps: Application[]) => {
  localStorage.setItem('demo_apps', JSON.stringify(apps));
};

export const applicationService = {
  getApplicationsForUser: async (userId: string): Promise<Application[]> => {
    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = 'applications';
      try {
        const q = query(collection(db, path), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as Application);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    } else {
      return getLocalApps().filter(a => a.userId === userId);
    }
  },
  
  // We now fetch by querying jobId and userId instead of using a composite doc ID
  getApplication: async (userId: string, jobId: string): Promise<Application | null> => {
    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = 'applications';
      try {
        const q = query(collection(db, path), where('userId', '==', userId), where('jobId', '==', jobId));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          return snapshot.docs[0].data() as Application;
        }
        return null;
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    } else {
      return getLocalApps().find(a => a.userId === userId && a.jobId === jobId) || null;
    }
  },
  
  createOrUpdateApplication: async (userId: string, jobId: string, data: Partial<Application>): Promise<Application> => {
    const existing = await applicationService.getApplication(userId, jobId);
    
    let app: Application;
    if (existing) {
      app = { ...existing, ...data, updatedAt: Date.now() };
    } else {
      const newId = crypto.randomUUID(); // Generated unique ID
      app = {
        id: newId,
        userId,
        jobId,
        status: data.status || 'PREPARING',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        datePrepared: data.datePrepared || Date.now(),
        ...data
      } as Application;
    }

    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = `applications/${app.id}`;
      try {
        await setDoc(doc(db, 'applications', app.id), app);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    } else {
      const apps = getLocalApps();
      const idx = apps.findIndex(a => a.id === app.id);
      if (idx >= 0) apps[idx] = app;
      else apps.push(app);
      setLocalApps(apps);
    }
    return app;
  },
  
  updateApplicationStatus: async (userId: string, jobId: string, status: JobStatus): Promise<void> => {
    const updates = { status, ...(status === 'APPLIED' ? { dateApplied: Date.now() } : {}) };
    
    const existing = await applicationService.getApplication(userId, jobId);
    if (existing) {
      if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
        const path = `applications/${existing.id}`;
        try {
          await updateDoc(doc(db, 'applications', existing.id), updates);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, path);
        }
      } else {
        const apps = getLocalApps();
        const idx = apps.findIndex(a => a.id === existing.id);
        if (idx >= 0) {
          apps[idx] = { ...apps[idx], ...updates };
          setLocalApps(apps);
        }
      }
    } else {
      await applicationService.createOrUpdateApplication(userId, jobId, updates);
    }
  }
};
