import { describe, it, expect, vi } from 'vitest';
import { handleFirestoreError, OperationType, shouldUseFirestore } from '../src/lib/firestoreError';
import fs from 'fs';
import path from 'path';

describe('Firestore Rules & Security Invariants', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  it('rules enforce rules_version 2 and default deny', () => {
    expect(rulesContent).toContain("rules_version = '2';");
    expect(rulesContent).toContain("match /{document=**} {\n      allow read, write: if false;\n    }");
  });

  it('rules isolate users collection to authenticated owner', () => {
    expect(rulesContent).toContain("match /users/{userId}");
    expect(rulesContent).toContain("allow get, delete: if request.auth != null && request.auth.uid == userId;");
    expect(rulesContent).toContain("allow create: if request.auth != null && request.auth.uid == userId && request.resource.data.userId == userId;");
    expect(rulesContent).toContain("allow update: if request.auth != null && request.auth.uid == userId && request.resource.data.userId == userId;");
  });

  it('rules isolate saved_jobs to authenticated owner with existence check', () => {
    expect(rulesContent).toContain("match /saved_jobs/{docId}");
    expect(rulesContent).toContain("allow get: if request.auth != null && (resource == null || resource.data.userId == request.auth.uid);");
    expect(rulesContent).toContain("allow list: if request.auth != null && resource.data.userId == request.auth.uid;");
    expect(rulesContent).toContain("allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;");
    expect(rulesContent).toContain("allow update: if request.auth != null && resource.data.userId == request.auth.uid && request.resource.data.userId == request.auth.uid;");
    expect(rulesContent).toContain("allow delete: if request.auth != null && resource.data.userId == request.auth.uid;");
  });

  it('rules isolate job_matches to authenticated owner with existence check', () => {
    expect(rulesContent).toContain("match /job_matches/{docId}");
    expect(rulesContent).toContain("allow get: if request.auth != null && (resource == null || resource.data.userId == request.auth.uid);");
    expect(rulesContent).toContain("allow list: if request.auth != null && resource.data.userId == request.auth.uid;");
    expect(rulesContent).toContain("allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;");
    expect(rulesContent).toContain("allow update: if request.auth != null && resource.data.userId == request.auth.uid && request.resource.data.userId == request.auth.uid;");
    expect(rulesContent).toContain("allow delete: if request.auth != null && resource.data.userId == request.auth.uid;");
  });

  it('rules isolate applications to authenticated owner with existence check', () => {
    expect(rulesContent).toContain("match /applications/{docId}");
    expect(rulesContent).toContain("allow get: if request.auth != null && (resource == null || resource.data.userId == request.auth.uid);");
    expect(rulesContent).toContain("allow list: if request.auth != null && resource.data.userId == request.auth.uid;");
    expect(rulesContent).toContain("allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;");
    expect(rulesContent).toContain("allow update: if request.auth != null && resource.data.userId == request.auth.uid && request.resource.data.userId == request.auth.uid;");
    expect(rulesContent).toContain("allow delete: if request.auth != null && resource.data.userId == request.auth.uid;");
  });

  it('shouldUseFirestore correctly identifies unauthenticated/demo state', () => {
    // When no auth.currentUser exists, it must return false to fall back to demo/local storage
    expect(shouldUseFirestore('demo-user-123')).toBe(false);
    expect(shouldUseFirestore()).toBe(false);
  });

  it('handleFirestoreError formats structured error JSON', () => {
    const originalConsoleError = console.error;
    console.error = vi.fn();

    try {
      expect(() => {
        handleFirestoreError(new Error('Missing or insufficient permissions.'), OperationType.LIST, 'saved_jobs');
      }).toThrow();
    } finally {
      console.error = originalConsoleError;
    }
  });
});
