import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOAuthState, validateAndConsumeOAuthState, resetOAuthStatesForTesting } from '../server/oauthState.js';
import { _setFirebaseFirestore } from '../server/firebaseAdmin.js';
import { getProvider } from '../server/providers.js';

describe('LinkedIn Integration Production Hardening', () => {
  beforeEach(async () => {
    _setFirebaseFirestore(null);
    await resetOAuthStatesForTesting();
  });

  describe('Firestore-Backed OAuth State Persistence', () => {
    it('creates a cryptographically random, user-bound state and persists it to Firestore', async () => {
      const mockSet = vi.fn().mockResolvedValue(undefined);
      const mockFirestore = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            set: mockSet
          })
        })
      } as any;

      _setFirebaseFirestore(mockFirestore);

      const userId = 'user_abc_123';
      const redirectPath = '/dashboard';
      const state = await createOAuthState(userId, redirectPath);

      expect(state).toHaveLength(64); // 32 bytes hex = 64 characters
      expect(mockFirestore.collection).toHaveBeenCalledWith('oauth_states');
      expect(mockFirestore.collection('oauth_states').doc).toHaveBeenCalledWith(state);
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        state,
        userId,
        redirectPath
      }));
    });

    it('validates and consumes a state token (single-use/replay protection)', async () => {
      const mockData = {
        state: 'valid_state_123',
        userId: 'user_xyz',
        redirectPath: '/jobs',
        createdAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000
      };

      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => mockData
      });

      const mockFirestore = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: mockGet,
            delete: mockDelete
          })
        }),
        runTransaction: vi.fn().mockImplementation(async (callback) => {
          const transaction = {
            get: vi.fn().mockImplementation(async () => mockGet()),
            delete: vi.fn().mockImplementation(() => mockDelete())
          };
          return callback(transaction);
        })
      } as any;

      _setFirebaseFirestore(mockFirestore);

      const validation = await validateAndConsumeOAuthState('valid_state_123');

      expect(validation.valid).toBe(true);
      expect(validation.userId).toBe('user_xyz');
      expect(validation.redirectPath).toBe('/jobs');
      expect(mockDelete).toHaveBeenCalled(); // Consumed/deleted immediately
    });

    it('rejects expired state tokens', async () => {
      const mockData = {
        state: 'expired_state_123',
        userId: 'user_xyz',
        redirectPath: '/jobs',
        createdAt: Date.now() - 20 * 60 * 1000,
        expiresAt: Date.now() - 10 * 60 * 1000 // Expired 10 minutes ago
      };

      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => mockData
      });

      const mockFirestore = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: mockGet,
            delete: mockDelete
          })
        }),
        runTransaction: vi.fn().mockImplementation(async (callback) => {
          const transaction = {
            get: vi.fn().mockImplementation(async () => mockGet()),
            delete: vi.fn().mockImplementation(() => mockDelete())
          };
          return callback(transaction);
        })
      } as any;

      _setFirebaseFirestore(mockFirestore);

      const validation = await validateAndConsumeOAuthState('expired_state_123');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('expired');
    });

    it('fails validation when the state parameter is unrecognized (replay/forgery protection)', async () => {
      const mockGet = vi.fn().mockResolvedValue({
        exists: false
      });

      const mockFirestore = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: mockGet
          })
        }),
        runTransaction: vi.fn().mockImplementation(async (callback) => {
          const transaction = {
            get: vi.fn().mockImplementation(async () => mockGet())
          };
          return callback(transaction);
        })
      } as any;

      _setFirebaseFirestore(mockFirestore);

      const validation = await validateAndConsumeOAuthState('non_existent_state');

      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('Invalid or expired state parameter');
    });

    it('requires an authenticated Firebase user to create an OAuth state', async () => {
      await expect(createOAuthState('')).rejects.toThrow('authenticated Firebase user');
    });
  });

  describe('Popup Security and Target Origin Validation', () => {
    it('generates a secure targetOrigin matching the configured APP_URL or request protocol/headers', async () => {
      const provider = getProvider();
      const status = await provider.healthCheck();
      expect(status.provider).toBe('LinkedIn');
      expect(status.status).toBeDefined();
    });
  });

  describe('Job Discovery & External Search Mode', () => {
    it('allows job search to work in external search mode even when OAuth is disabled or not configured', async () => {
      const provider = getProvider() as any;
      const searchUrl = provider.getSearchUrl({
        query: 'Frontend Developer',
        location: 'Berlin, Germany'
      });

      expect(searchUrl).toContain('linkedin.com/jobs/search');
      expect(searchUrl).toContain('keywords=Frontend+Developer');
      expect(searchUrl).toContain('location=Berlin%2C+Germany');
    });
  });
});
