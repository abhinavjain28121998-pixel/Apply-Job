import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;

export function resolveFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  if (process.env.GCP_PROJECT) return process.env.GCP_PROJECT;
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.projectId) return config.projectId;
    }
  } catch {
    // Ignore fallback errors
  }

  return 'graceful-etching-qt8c4';
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
        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || projectId
        });
        return adminApp;
      } catch (err) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON credentials.');
      }
    }

    // 2. Individual email and private key credentials
    if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
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
    adminApp = initializeApp({
      projectId
    });
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
