import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requireAuth } from '../server/auth.js';
import { createRateLimiter } from '../server/rateLimit.js';
import { _setFirebaseAuth, resolveFirebaseProjectId } from '../server/firebaseAdmin.js';
import { Request, Response } from 'express';

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    jsonData: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.jsonData = data;
      return this;
    }
  };
  return res as Response & { statusCode: number; jsonData: any };
}

describe('Server Authentication & Hardened Security Tests', () => {
  const originalEnv = process.env;
  let mockVerifyIdToken = vi.fn();

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockVerifyIdToken = vi.fn();
    const mockAuth = {
      verifyIdToken: mockVerifyIdToken
    } as any;
    _setFirebaseAuth(mockAuth);
  });

  afterEach(() => {
    process.env = originalEnv;
    _setFirebaseAuth(null);
  });

  it('no Authorization header -> 401', async () => {
    const req = { headers: {} } as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.jsonData?.error).toContain('Missing Authorization header');
    expect(next).not.toHaveBeenCalled();
  });

  it('malformed Authorization header -> 401', async () => {
    const invalidHeaders = [
      'Basic 12345',
      'Bearer',
      'Bearer    ',
      'Token some-token',
      'bearer',
    ];

    for (const header of invalidHeaders) {
      const req = { headers: { authorization: header } } as Request;
      const res = createMockResponse();
      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData?.error).toContain('Malformed Authorization header');
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('arbitrary Bearer token -> 401', async () => {
    process.env.ALLOW_DEMO_AUTH = 'false';
    mockVerifyIdToken.mockRejectedValue(new Error('Decoding Firebase ID token failed. Make sure you passed the entire string.'));

    const req = { headers: { authorization: 'Bearer arbitrary-random-token-xyz' } } as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(mockVerifyIdToken).toHaveBeenCalledWith('arbitrary-random-token-xyz', true);
    expect(res.statusCode).toBe(401);
    expect(res.jsonData?.error).toContain('Token verification failed');
    expect(next).not.toHaveBeenCalled();
  });

  it('invalid Firebase token -> 401', async () => {
    process.env.ALLOW_DEMO_AUTH = 'false';
    const authError: any = new Error('Firebase ID token is expired.');
    authError.code = 'auth/id-token-expired';
    mockVerifyIdToken.mockRejectedValue(authError);

    const req = { headers: { authorization: 'Bearer expired.firebase.jwt.token' } } as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(mockVerifyIdToken).toHaveBeenCalledWith('expired.firebase.jwt.token', true);
    expect(res.statusCode).toBe(401);
    expect(res.jsonData?.error).toContain('auth/id-token-expired');
    expect(next).not.toHaveBeenCalled();
  });

  it('valid Firebase token -> authenticated', async () => {
    process.env.ALLOW_DEMO_AUTH = 'false';
    mockVerifyIdToken.mockResolvedValue({
      uid: 'firebase-user-999',
      email: 'verified@example.com',
      name: 'Verified User',
      picture: 'https://example.com/pic.jpg'
    });

    const req = { headers: { authorization: 'Bearer valid.firebase.jwt.token' } } as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(mockVerifyIdToken).toHaveBeenCalledWith('valid.firebase.jwt.token', true);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user?.uid).toBe('firebase-user-999');
    expect(req.user?.email).toBe('verified@example.com');
    expect(req.user?.isDemo).toBe(false);
  });

  it('demo token rejected when ALLOW_DEMO_AUTH=false', async () => {
    process.env.ALLOW_DEMO_AUTH = 'false';
    process.env.DEMO_AUTH_TOKEN = 'demo-secret-key';

    const req = { headers: { authorization: 'Bearer demo-secret-key' } } as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.jsonData?.error).toContain('Demo authentication is disabled');
    expect(next).not.toHaveBeenCalled();
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('wrong demo token rejected when ALLOW_DEMO_AUTH=true', async () => {
    process.env.ALLOW_DEMO_AUTH = 'true';
    process.env.DEMO_AUTH_TOKEN = 'configured-secret-token';

    const req = { headers: { authorization: 'Bearer wrong-demo-token' } } as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.jsonData?.error).toContain('Invalid demo authentication token');
    expect(next).not.toHaveBeenCalled();
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('exact DEMO_AUTH_TOKEN accepted when ALLOW_DEMO_AUTH=true', async () => {
    process.env.ALLOW_DEMO_AUTH = 'true';
    process.env.DEMO_AUTH_TOKEN = 'custom-configured-demo-token';

    const req = { headers: { authorization: 'Bearer custom-configured-demo-token' } } as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user?.uid).toBe('demo-user-123');
    expect(req.user?.isDemo).toBe(true);
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('rate limit returns 429', () => {
    const testRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 3 });

    const req = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      user: { uid: 'user-rate-limited-123', email: 'test@example.com' }
    } as any;

    // First 3 requests should pass
    for (let i = 0; i < 3; i++) {
      const res = createMockResponse();
      const next = vi.fn();
      testRateLimiter(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    }

    // 4th request must be rejected with 429
    const res4 = createMockResponse();
    const next4 = vi.fn();
    testRateLimiter(req, res4, next4);

    expect(res4.statusCode).toBe(429);
    expect(res4.jsonData?.error).toContain('Too many requests');
    expect(next4).not.toHaveBeenCalled();
  });

  it('authenticated rate limiting uses req.user.uid', () => {
    const testRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2 });

    const reqUserA = {
      ip: '10.0.0.1',
      user: { uid: 'user-A', email: 'a@example.com' }
    } as any;

    const reqUserB = {
      ip: '10.0.0.1', // Same IP address!
      user: { uid: 'user-B', email: 'b@example.com' }
    } as any;

    // User A consumes quota
    for (let i = 0; i < 2; i++) {
      const res = createMockResponse();
      const next = vi.fn();
      testRateLimiter(reqUserA, res, next);
      expect(next).toHaveBeenCalled();
    }
    const resOverA = createMockResponse();
    const nextOverA = vi.fn();
    testRateLimiter(reqUserA, resOverA, nextOverA);
    expect(resOverA.statusCode).toBe(429);

    // User B from same IP is NOT blocked because rate limiting is keyed by UID
    const resB = createMockResponse();
    const nextB = vi.fn();
    testRateLimiter(reqUserB, resB, nextB);
    expect(nextB).toHaveBeenCalled();
    expect(resB.statusCode).toBe(200);
  });

  it('resolveFirebaseProjectId does not return hard-coded fallback', () => {
    // Clean environment
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.GCP_PROJECT;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    // Must never return 'graceful-etching-qt8c4' if not configured
    const resolved = resolveFirebaseProjectId();
    expect(resolved).not.toBe('graceful-etching-qt8c4');

    // Test explicit FIREBASE_PROJECT_ID
    process.env.FIREBASE_PROJECT_ID = 'my-custom-project';
    expect(resolveFirebaseProjectId()).toBe('my-custom-project');

    // Test GCP_PROJECT
    delete process.env.FIREBASE_PROJECT_ID;
    process.env.GCP_PROJECT = 'gcp-project-id';
    expect(resolveFirebaseProjectId()).toBe('gcp-project-id');

    // Test service account key json
    delete process.env.GCP_PROJECT;
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({ project_id: 'sa-project-id' });
    expect(resolveFirebaseProjectId()).toBe('sa-project-id');
  });
});
