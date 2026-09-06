import { Request, Response, NextFunction } from 'express';
import './types.js';

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 10;
  const requestHistory = new Map<string, number[]>();

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    // Prefer authenticated Firebase UID if available, fallback to IP address
    const identifier = req.user?.uid || req.ip || (req.socket && req.socket.remoteAddress) || 'anonymous';
    const now = Date.now();
    const timestamps = requestHistory.get(identifier) || [];

    const activeTimestamps = timestamps.filter(time => now - time < windowMs);

    if (activeTimestamps.length >= maxRequests) {
      return res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfterMs: Math.max(0, activeTimestamps[0] + windowMs - now)
      });
    }

    activeTimestamps.push(now);
    requestHistory.set(identifier, activeTimestamps);
    next();
  };

  middleware.reset = () => {
    requestHistory.clear();
  };

  return middleware;
}

export const rateLimit = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
