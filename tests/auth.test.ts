import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requireAuth } from '../server/auth.js';
import { createRateLimiter } from '../server/rateLimit.js';
import { _setFirebaseAuth } from '../server/firebaseAdmin.js';
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

describe('Server Authentication & Rate Limiting Tests', () => {
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

  it('no Authorization header => 401', async () => {
    const req = { headers: {} } as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.jsonData?.error).toContain('Missing Authorization header');
    expect(next).not.toHaveBeenCalled();
  });

  it('malformed Bearer header => 401', async () => {
    const invalidHeaders = [
      'Basic 12345',
      'Bearer',
      'Bearer    ',
      'Token some-token',
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

  it('invalid Firebase token => 401', async () => {
    process.env.ALLOW_DEMO_AUTH = 'false';
    mockVerifyIdToken.mockRejectedValue(new Error('Firebase ID token is invalid or expired.'));

    const req = { headers: { authorization: 'Bearer invalid.firebase.token' } } as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(mockVerifyIdToken).toHaveBeenCalledWith('invalid.firebase.token', true);
    expect(res.statusCode).toBe(401);
    expect(res.jsonData?.error).toContain('Token verification failed');
    expect(next).not.toHaveBeenCalled();
  });

  it('valid Firebase token => request proceeds and attaches req.user', async () => {
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

  it('production rejects demo-token', async () => {
    // ALLOW_DEMO_AUTH is explicitly false or not set
    process.env.ALLOW_DEMO_AUTH = 'false';

    const req = { headers: { authorization: 'Bearer demo-token' } } as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.jsonData?.error).toContain('Demo authentication is disabled');
    expect(next).not.toHaveBeenCalled();
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  it('controlled demo mode works only when explicitly enabled', async () => {
    // Enable demo auth explicitly
    process.env.ALLOW_DEMO_AUTH = 'true';

    const req = { headers: { authorization: 'Bearer demo-token' } } as Request;
    const res = createMockResponse();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user?.uid).toBe('demo-user-123');
    expect(req.user?.isDemo).toBe(true);
  });

  it('rate limit returns 429 when max requests are exceeded', () => {
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

  it('rate limiting separates requests by authenticated uid', () => {
    const testRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2 });

    const reqUserA = {
      ip: '10.0.0.1',
      user: { uid: 'user-A', email: 'a@example.com' }
    } as any;

    const reqUserB = {
      ip: '10.0.0.1', // Same IP!
      user: { uid: 'user-B', email: 'b@example.com' }
    } as any;

    // User A hits limit
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
});
