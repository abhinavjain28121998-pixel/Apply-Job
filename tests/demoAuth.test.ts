import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDemoAuthAllowed, requireAuth } from '../server/auth.js';
import { Request, Response } from 'express';

describe('Demo Mode Authentication', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('is disabled by default', () => {
    delete process.env.ALLOW_DEMO_AUTH;
    expect(isDemoAuthAllowed()).toBe(false);

    process.env.ALLOW_DEMO_AUTH = 'false';
    expect(isDemoAuthAllowed()).toBe(false);
  });

  it('is enabled only when ALLOW_DEMO_AUTH is true', () => {
    process.env.ALLOW_DEMO_AUTH = 'true';
    expect(isDemoAuthAllowed()).toBe(true);
  });

  it('never bypasses production authentication in the backend', async () => {
    process.env.ALLOW_DEMO_AUTH = 'false';

    const req = { headers: { authorization: 'Bearer demo-token' } } as Request;
    let statusCode = 200;
    let errorMsg = '';
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        errorMsg = data?.error;
        return this;
      }
    } as any;

    const next = vi.fn();
    await requireAuth(req, res, next);

    expect(statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(errorMsg).toContain('Demo authentication is disabled');
  });
});

