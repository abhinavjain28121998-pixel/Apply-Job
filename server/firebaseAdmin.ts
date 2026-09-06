import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;

/**
 * Resolves the Firebase project ID from explicit environment variables or service account.
 * Does NOT contain any hard-coded project fallback.
 * Returns undefined if no explicit project ID is configured, allowing ADC auto-discovery.
 */
export function resolveFirebaseProjectId(): string | undefined {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID.trim()) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  if (process.env.GCP_PROJECT && process.env.GCP_PROJECT.trim()) {
    return process.env.GCP_PROJECT.trim();
  }
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT.trim()) {
    return process.env.GCLOUD_PROJECT.trim();
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      if (sa.project_id && typeof sa.project_id === 'string' && sa.project_id.trim()) {
        return sa.project_id.trim();
      }
    } catch {
      // Ignore JSON parse errors here, caught during initialization
    }
  }

  return undefined;
}

export function getFirebaseAdmin(): App | null {
  if (adminApp) {
    return adminApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0]!;
    return adminApp;
  }

  try {
    const projectId = resolveFirebaseProjectId();

    // 1. JSON Service account key provided in environment
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        const resolvedProjectId = serviceAccount.project_id || projectId;
        if (!resolvedProjectId) {
          throw new Error('Firebase project ID could not be determined from service account or environment.');
        }
        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: resolvedProjectId
        });
        return adminApp;
      } catch (err: any) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON credentials:', err?.message);
        throw err;
      }
    }

    // 2. Individual email and private key credentials
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      if (!projectId) {
        throw new Error('FIREBASE_PROJECT_ID is required when using FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.');
      }
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey
        }),
        projectId
      });
      return adminApp;
    }

    // 3. Application Default Credentials (ADC) or GCP metadata environment
    if (projectId) {
      adminApp = initializeApp({
        projectId
      });
    } else {
      // Rely on Application Default Credentials (ADC) in GCP/Cloud Run environment.
      // If ADC fails or is unavailable in the environment, initializeApp throws and null is returned.
      adminApp = initializeApp();
    }
    return adminApp;
  } catch (error) {
    console.warn('Firebase Admin SDK initialization could not be completed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  if (adminAuth) {
    return adminAuth;
  }
  const app = getFirebaseAdmin();
  if (!app) return null;
  adminAuth = getAuth(app);
  return adminAuth;
}

// Helpers to reset auth/app reference (useful for testing)
export function _setFirebaseAuth(auth: Auth | null): void {
  adminAuth = auth;
}

export function _setFirebaseAdminApp(app: App | null): void {
  adminApp = app;
}
