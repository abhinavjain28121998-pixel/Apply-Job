import { describe, it, expect } from 'vitest';
import { MockJobProvider } from '../server/providers.ts';

describe('MockJobProvider', () => {
  it('should filter jobs by keyword', async () => {
    const provider = new MockJobProvider();
    
    // digital marketing should find our mocked roles
    const jobs = await provider.searchJobs({ query: 'digital marketing' });
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].title?.toLowerCase()).toContain('marketing');
    
    // frontend developer should not find anything if we didn't mock it, or at least not digital marketing
    const frontendJobs = await provider.searchJobs({ query: 'frontend developer' });
    expect(frontendJobs.length).toBeGreaterThan(0);
    expect(frontendJobs[0].title.toLowerCase()).toContain('frontend'); // Since we replaced the mocks with marketing jobs
  });
});
