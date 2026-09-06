import fs from 'fs';

const content = `import { collection, query, where, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { Application, JobStatus } from '../types';

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
    if (isFirebaseConfigured() && db) {
      const q = query(collection(db, 'applications'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as Application);
    } else {
      return getLocalApps().filter(a => a.userId === userId);
    }
  },
  
  getApplication: async (userId: string, jobId: string): Promise<Application | null> => {
    const docId = \`\${userId}_\${jobId}\`;
    if (isFirebaseConfigured() && db) {
      const docSnap = await getDoc(doc(db, 'applications', docId));
      if (docSnap.exists()) {
        return docSnap.data() as Application;
      }
      return null;
    } else {
      return getLocalApps().find(a => a.id === docId) || null;
    }
  },
  
  createOrUpdateApplication: async (userId: string, jobId: string, data: Partial<Application>): Promise<Application> => {
    const docId = \`\${userId}_\${jobId}\`;
    const existing = await applicationService.getApplication(userId, jobId);
    
    let app: Application;
    if (existing) {
      app = { ...existing, ...data };
    } else {
      app = {
        id: docId,
        userId,
        jobId,
        status: data.status || 'PREPARING',
        datePrepared: data.datePrepared || Date.now(),
        ...data
      } as Application;
    }

    if (isFirebaseConfigured() && db) {
      await setDoc(doc(db, 'applications', docId), app);
    } else {
      const apps = getLocalApps();
      const idx = apps.findIndex(a => a.id === docId);
      if (idx >= 0) apps[idx] = app;
      else apps.push(app);
      setLocalApps(apps);
    }
    return app;
  },
  
  updateApplicationStatus: async (userId: string, jobId: string, status: JobStatus): Promise<void> => {
    const docId = \`\${userId}_\${jobId}\`;
    const updates = { status, ...(status === 'APPLIED' ? { dateApplied: Date.now() } : {}) };
    
    if (isFirebaseConfigured() && db) {
      const docSnap = await getDoc(doc(db, 'applications', docId));
      if (docSnap.exists()) {
        await updateDoc(doc(db, 'applications', docId), updates);
      } else {
        await applicationService.createOrUpdateApplication(userId, jobId, updates);
      }
    } else {
      const apps = getLocalApps();
      const idx = apps.findIndex(a => a.id === docId);
      if (idx >= 0) {
        apps[idx] = { ...apps[idx], ...updates };
        setLocalApps(apps);
      } else {
        await applicationService.createOrUpdateApplication(userId, jobId, updates);
      }
    }
  }
};
`;

fs.writeFileSync('src/services/applicationService.ts', content);
