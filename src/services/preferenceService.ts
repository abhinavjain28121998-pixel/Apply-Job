import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { JobSearchPreferences, UserProfile } from '../types';
import { handleFirestoreError, OperationType, shouldUseFirestore } from '../lib/firestoreError';

const getLocalPreferences = (userId: string): JobSearchPreferences | null => {
  try {
    const raw = localStorage.getItem(`demo_preferences_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const setLocalPreferences = (userId: string, prefs: JobSearchPreferences) => {
  try {
    localStorage.setItem(`demo_preferences_${userId}`, JSON.stringify(prefs));
  } catch {}
};

export const preferenceService = {
  getPreferences: async (userId: string, profile?: Partial<UserProfile> | null): Promise<JobSearchPreferences> => {
    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = `user_preferences/${userId}`;
      try {
        const snap = await getDoc(doc(db, 'user_preferences', userId));
        if (snap.exists()) {
          return snap.data() as JobSearchPreferences;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    } else {
      const local = getLocalPreferences(userId);
      if (local) return local;
    }

    // Default fallback constructed from profile if available
    const keywords: string[] = [];
    if (profile?.currentRole) keywords.push(profile.currentRole);
    if (profile?.skills && profile.skills.length > 0) {
      keywords.push(...profile.skills.slice(0, 3));
    }

    return {
      userId,
      keywords: keywords.length > 0 ? keywords : ['Software Engineer'],
      jobTitle: profile?.currentRole || '',
      location: (profile?.preferredLocations && profile.preferredLocations[0]) || '',
      workMode: (profile?.workMode as JobSearchPreferences['workMode']) || '',
      experienceLevel: profile?.totalExperience ? `${profile.totalExperience}+ years` : '',
      updatedAt: Date.now()
    };
  },

  savePreferences: async (userId: string, prefs: Partial<JobSearchPreferences>): Promise<JobSearchPreferences> => {
    const existing = await preferenceService.getPreferences(userId);
    const updated: JobSearchPreferences = {
      ...existing,
      ...prefs,
      userId,
      updatedAt: Date.now()
    };

    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = `user_preferences/${userId}`;
      try {
        await setDoc(doc(db, 'user_preferences', userId), updated, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    } else {
      setLocalPreferences(userId, updated);
    }

    return updated;
  }
};
