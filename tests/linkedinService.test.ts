import { describe, it, expect, vi } from 'vitest';
import {
  buildLinkedInJobsUrl,
  buildLinkedInSearchUrlForJob,
  buildLinkedInSearchUrlFromProfile,
  isValidLinkedInUrl,
  mapExperienceToLinkedInFilter,
  mapWorkModeToLinkedInFilter,
  mapJobTypeToLinkedInFilter,
  linkedInDestination,
  linkedinSearchService,
  linkedinJobDiscoveryService,
  linkedInJobDiscoveryService
} from '../src/services/linkedinService';

describe('LinkedIn Service & Search URL Builder', () => {
  it('generates a valid, official LinkedIn search URL with keywords and location', () => {
    const url = buildLinkedInJobsUrl({
      keywords: 'Full Stack Engineer',
      location: 'Bengaluru, India'
    });

    expect(url).toContain('https://www.linkedin.com/jobs/search/?');
    expect(url).toContain('keywords=Full+Stack+Engineer');
    expect(url).toContain('location=Bengaluru%2C+India');
    expect(isValidLinkedInUrl(url)).toBe(true);
  });

  it('safely encodes special characters in keywords and locations', () => {
    const url = buildLinkedInJobsUrl({
      keywords: 'C++ & C# Developer / Systems Engineer',
      location: 'New York & San Francisco, CA'
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.get('keywords')).toBe('C++ & C# Developer / Systems Engineer');
    expect(parsed.searchParams.get('location')).toBe('New York & San Francisco, CA');
    expect(parsed.origin).toBe('https://www.linkedin.com');
  });

  it('omits empty or whitespace-only filters', () => {
    const url = buildLinkedInJobsUrl({
      keywords: 'Product Manager',
      location: '   ',
      experience: '',
      jobType: ''
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.get('keywords')).toBe('Product Manager');
    expect(parsed.searchParams.has('location')).toBe(false);
    expect(parsed.searchParams.has('f_E')).toBe(false);
    expect(parsed.searchParams.has('f_JT')).toBe(false);
    expect(parsed.searchParams.has('f_WT')).toBe(false);
  });

  it('correctly maps remote and work mode filters to f_WT', () => {
    // Remote
    const remoteUrl1 = buildLinkedInJobsUrl({ keywords: 'Engineer', remote: true });
    expect(new URL(remoteUrl1).searchParams.get('f_WT')).toBe('2');

    const remoteUrl2 = buildLinkedInJobsUrl({ keywords: 'Engineer', workMode: 'Remote' });
    expect(new URL(remoteUrl2).searchParams.get('f_WT')).toBe('2');

    // Hybrid
    const hybridUrl = buildLinkedInJobsUrl({ keywords: 'Engineer', workMode: 'Hybrid' });
    expect(new URL(hybridUrl).searchParams.get('f_WT')).toBe('3');

    // On-site
    const onsiteUrl = buildLinkedInJobsUrl({ keywords: 'Engineer', workMode: 'On-site' });
    expect(new URL(onsiteUrl).searchParams.get('f_WT')).toBe('1');
  });

  it('correctly maps experience levels to f_E filter', () => {
    expect(mapExperienceToLinkedInFilter('Internship')).toBe('1');
    expect(mapExperienceToLinkedInFilter('Entry level / 0-1 yrs')).toBe('2');
    expect(mapExperienceToLinkedInFilter('Associate 1-3 years')).toBe('3');
    expect(mapExperienceToLinkedInFilter('Mid-Senior Level (5+ yrs)')).toBe('4');
    expect(mapExperienceToLinkedInFilter('Director of Engineering')).toBe('5');
    expect(mapExperienceToLinkedInFilter('Executive VP')).toBe('6');
    expect(mapExperienceToLinkedInFilter('Unknown')).toBeUndefined();
  });

  it('correctly maps job types to f_JT filter', () => {
    expect(mapJobTypeToLinkedInFilter('Full-time')).toBe('F');
    expect(mapJobTypeToLinkedInFilter('Part-time')).toBe('P');
    expect(mapJobTypeToLinkedInFilter('Contract')).toBe('C');
    expect(mapJobTypeToLinkedInFilter('Temporary')).toBe('T');
    expect(mapJobTypeToLinkedInFilter('Internship')).toBe('I');
    expect(mapJobTypeToLinkedInFilter('Custom')).toBeUndefined();
  });

  it('supports sorting by recent or relevant', () => {
    const recentUrl = buildLinkedInJobsUrl({ keywords: 'React', sortBy: 'recent' });
    expect(new URL(recentUrl).searchParams.get('sortBy')).toBe('DD');

    const relevantUrl = buildLinkedInJobsUrl({ keywords: 'React', sortBy: 'relevant' });
    expect(new URL(relevantUrl).searchParams.get('sortBy')).toBe('R');
  });

  it('strictly prevents arbitrary hostnames and validates trusted domain', () => {
    expect(isValidLinkedInUrl('https://www.linkedin.com/jobs/search/?keywords=dev')).toBe(true);
    expect(isValidLinkedInUrl('https://linkedin.com/jobs/search/?keywords=dev')).toBe(true);
    expect(isValidLinkedInUrl('http://www.linkedin.com/jobs/search/?keywords=dev')).toBe(false); // must be https
    expect(isValidLinkedInUrl('https://evil-phishing-site.com/linkedin')).toBe(false);
    expect(isValidLinkedInUrl('javascript:alert(1)')).toBe(false);
  });

  it('builds a LinkedIn search URL specifically for a Job', () => {
    const url = buildLinkedInSearchUrlForJob({
      title: 'Senior Frontend Engineer',
      company: 'Acme Technologies',
      location: 'Bengaluru',
      workMode: 'Remote'
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.get('keywords')).toBe('Senior Frontend Engineer Acme Technologies');
    expect(parsed.searchParams.get('location')).toBe('Bengaluru');
    expect(parsed.searchParams.get('f_WT')).toBe('2');
  });

  it('builds a LinkedIn search URL from a candidate UserProfile', () => {
    const url = buildLinkedInSearchUrlFromProfile({
      currentRole: 'Staff Software Architect',
      preferredLocations: ['San Francisco, CA'],
      workMode: 'Hybrid',
      totalExperience: 8
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.get('keywords')).toBe('Staff Software Architect');
    expect(parsed.searchParams.get('location')).toBe('San Francisco, CA');
    expect(parsed.searchParams.get('f_WT')).toBe('3');
    expect(parsed.searchParams.get('f_E')).toBe('4'); // Senior
  });

  it('external job search destination contract conforms to interface', () => {
    expect(linkedInDestination.id).toBe('linkedin');
    expect(linkedInDestination.name).toBe('LinkedIn Jobs');
    const destUrl = linkedInDestination.buildSearchUrl({ keywords: 'DevOps' });
    expect(destUrl).toContain('keywords=DevOps');
  });

  it('saves and retrieves LinkedIn search intent offline/demo', async () => {
    const userId = 'test_user_abc';
    const saved = await linkedinSearchService.saveSearch(userId, {
      keywords: 'Machine Learning Engineer',
      location: 'Hyderabad'
    }, 'My ML Search');

    expect(saved.id).toBeDefined();
    expect(saved.title).toBe('My ML Search');
    expect(saved.generatedUrl).toContain('Machine+Learning+Engineer');

    const list = await linkedinSearchService.getSavedSearches(userId);
    expect(list.some(s => s.id === saved.id)).toBe(true);

    await linkedinSearchService.deleteSearch(userId, saved.id);
    const listAfter = await linkedinSearchService.getSavedSearches(userId);
    expect(listAfter.some(s => s.id === saved.id)).toBe(false);
  });

  it('LinkedInJobProvider handles unconfigured state responsibly without inventing mock jobs', async () => {
    const { LinkedInJobProvider } = await import('../server/providers/linkedin.js');
    const provider = new LinkedInJobProvider();

    expect(provider.isConfigured()).toBe(false);
    const results = await provider.searchJobs({ query: 'Software Engineer' });
    expect(results).toEqual([]);

    const health = await provider.healthCheck();
    expect(health.provider).toBe('LinkedIn');
    expect(health.status).toBe('NOT_CONFIGURED');
  });

  it('getProvider returns LinkedInJobProvider when selected or when configured', async () => {
    const { getProvider } = await import('../server/providers.js');
    const { LinkedInJobProvider } = await import('../server/providers/linkedin.js');

    const provider = getProvider('linkedin');
    expect(provider).toBeInstanceOf(LinkedInJobProvider);

    const prev = process.env.JOB_PROVIDER;
    process.env.JOB_PROVIDER = 'linkedin';
    try {
      const defaultProvider = getProvider();
      expect(defaultProvider).toBeInstanceOf(LinkedInJobProvider);
    } finally {
      process.env.JOB_PROVIDER = prev;
    }
  });

  it('evaluates LinkedInJobProvider configuration strictly against minimum OAuth credentials', async () => {
    const { LinkedInJobProvider } = await import('../server/providers/linkedin.js');
    const provider = new LinkedInJobProvider();

    const originalEnabled = process.env.LINKEDIN_ENABLED;
    const originalClientId = process.env.LINKEDIN_CLIENT_ID;
    const originalClientSecret = process.env.LINKEDIN_CLIENT_SECRET;

    try {
      // 1. When disabled
      process.env.LINKEDIN_ENABLED = 'false';
      process.env.LINKEDIN_CLIENT_ID = 'my_client_id';
      process.env.LINKEDIN_CLIENT_SECRET = 'my_secret';
      expect(provider.isConfigured()).toBe(false);

      // 2. When enabled but missing client secret
      process.env.LINKEDIN_ENABLED = 'true';
      process.env.LINKEDIN_CLIENT_ID = 'my_client_id';
      delete process.env.LINKEDIN_CLIENT_SECRET;
      expect(provider.isConfigured()).toBe(false);

      // 3. When enabled with both credentials
      process.env.LINKEDIN_ENABLED = 'true';
      process.env.LINKEDIN_CLIENT_ID = 'my_client_id';
      process.env.LINKEDIN_CLIENT_SECRET = 'my_secret';
      expect(provider.isConfigured()).toBe(true);

      const health = await provider.healthCheck();
      expect(health.status).toBe('CONNECTED');
    } finally {
      process.env.LINKEDIN_ENABLED = originalEnabled;
      process.env.LINKEDIN_CLIENT_ID = originalClientId;
      process.env.LINKEDIN_CLIENT_SECRET = originalClientSecret;
    }
  });

  describe('linkedinJobDiscoveryService', () => {
    it('uses native URL and URLSearchParams to build compliant LinkedIn job search URLs', () => {
      const criteria = {
        jobTitle: 'Principal Architect',
        keywords: 'Distributed Systems',
        location: 'Seattle, WA',
        workMode: 'Remote' as const,
        experienceLevel: 'Mid-Senior level (5+ yrs)',
        employmentType: 'Full-time',
        sortBy: 'recent' as const
      };

      const url = linkedinJobDiscoveryService.buildSearchUrl(criteria);
      expect(url.startsWith('https://www.linkedin.com/jobs/search/?')).toBe(true);

      const parsed = new URL(url);
      expect(parsed.searchParams.get('keywords')).toBe('Principal Architect Distributed Systems');
      expect(parsed.searchParams.get('location')).toBe('Seattle, WA');
      expect(parsed.searchParams.get('f_WT')).toBe('2'); // Remote
      expect(parsed.searchParams.get('f_E')).toBe('4'); // Mid-Senior
      expect(parsed.searchParams.get('f_JT')).toBe('F'); // Full-time
      expect(parsed.searchParams.get('sortBy')).toBe('DD'); // Recent
    });

    it('works seamlessly without any LinkedIn API credentials via discoverJobs', async () => {
      const result = await linkedinJobDiscoveryService.discoverJobs({
        keywords: 'React Developer',
        location: 'Remote'
      });

      expect(result.mode).toBe('EXTERNAL_SEARCH');
      expect(result.searchUrl).toContain('https://www.linkedin.com/jobs/search/?');
      expect(result.searchUrl).toContain('keywords=React+Developer');
      expect(result.message).toContain('official LinkedIn search destination');
      expect(result.jobs).toEqual([]);
    });

    it('builds search URLs from profile and job objects', () => {
      const profileUrl = linkedinJobDiscoveryService.buildSearchUrlFromProfile({
        currentRole: 'Backend Engineer',
        preferredLocations: ['Austin, TX'],
        totalExperience: 3
      });
      expect(profileUrl).toContain('keywords=Backend+Engineer');
      expect(profileUrl).toContain('location=Austin%2C+TX');
      expect(profileUrl).toContain('f_E=3'); // Associate

      const jobUrl = linkedinJobDiscoveryService.buildSearchUrlForJob({
        title: 'DevOps Lead',
        company: 'Cloud Corp',
        location: 'Remote'
      });
      expect(jobUrl).toContain('keywords=DevOps+Lead+Cloud+Corp');
    });

    it('exposes aliased linkedInJobDiscoveryService identically', () => {
      expect(linkedInJobDiscoveryService).toBe(linkedinJobDiscoveryService);
      expect(typeof linkedInJobDiscoveryService.buildSearchUrl).toBe('function');
      expect(typeof linkedInJobDiscoveryService.discoverJobs).toBe('function');
    });

    it('allows LinkedInJobProvider to construct search URLs via getSearchUrl', async () => {
      const { LinkedInJobProvider } = await import('../server/providers/linkedin.js');
      const provider = new LinkedInJobProvider();

      const searchUrl = provider.getSearchUrl({
        query: 'Machine Learning',
        location: 'Boston, MA',
        workMode: 'Hybrid',
        experience: 'Senior'
      });

      const parsed = new URL(searchUrl);
      expect(parsed.searchParams.get('keywords')).toBe('Machine Learning');
      expect(parsed.searchParams.get('location')).toBe('Boston, MA');
      expect(parsed.searchParams.get('f_WT')).toBe('3');
      expect(parsed.searchParams.get('f_E')).toBe('4');
    });
  });

  describe('linkedinConnectionService', () => {
    it('persists and retrieves connections with in-memory fallback when Firestore is unavailable or throws', async () => {
      const { linkedinConnectionService } = await import('../server/services/linkedinConnectionService.js');
      const { _setFirebaseFirestore } = await import('../server/firebaseAdmin.js');

      // Simulate a Firestore instance that throws gRPC 5 NOT_FOUND
      const throwingFirestore = {
        collection: () => ({
          doc: () => ({
            get: vi.fn().mockRejectedValue(Object.assign(new Error('5 NOT_FOUND: Database not found'), { code: 5 })),
            set: vi.fn().mockRejectedValue(Object.assign(new Error('5 NOT_FOUND: Database not found'), { code: 5 }))
          })
        })
      } as any;

      _setFirebaseFirestore(throwingFirestore);

      try {
        const testConn = {
          userId: 'test-user-fallback-123',
          sub: 'sub-456',
          displayName: 'Test Fallback User',
          provider: 'linkedin' as const,
          scopes: ['openid', 'profile'],
          status: 'CONNECTED' as const,
          connectedAt: Date.now()
        };

        // Should not throw or crash
        await linkedinConnectionService.saveConnection(testConn);

        // Should retrieve from in-memory fallback smoothly
        const retrieved = await linkedinConnectionService.getConnection('test-user-fallback-123');
        expect(retrieved).not.toBeNull();
        expect(retrieved?.displayName).toBe('Test Fallback User');
        expect(retrieved?.status).toBe('CONNECTED');

        // Revoke should also handle fallback gracefully
        await linkedinConnectionService.revokeConnection('test-user-fallback-123');
        const revoked = await linkedinConnectionService.getConnection('test-user-fallback-123');
        expect(revoked?.status).toBe('REVOKED');
      } finally {
        _setFirebaseFirestore(null);
      }
    });
  });
});
