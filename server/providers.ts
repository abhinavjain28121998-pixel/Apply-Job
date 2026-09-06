import { Job, SearchFilters, ProviderStatus, JobProvider } from '../src/types.js';
import { mockJobs } from './mockJobs.js';
import { LinkedInJobProvider } from './providers/linkedin.js';

export { LinkedInJobProvider };

export class MockJobProvider implements JobProvider {
  async searchJobs(filters: SearchFilters): Promise<Partial<Job>[]> {
    let filteredJobs = [...mockJobs];

    if (filters.query) {
      const query = filters.query.toLowerCase();
      const terms = query.split(/\s+/).filter(t => t.length > 0);
      
      filteredJobs = filteredJobs.filter(job => {
        const searchableText = [
          job.title,
          job.company,
          job.description,
          job.source
        ].join(' ').toLowerCase();

        // Check if all terms match (AND logic)
        return terms.every(term => searchableText.includes(term));
      });
    }

    if (filters.location) {
      const loc = filters.location.toLowerCase();
      filteredJobs = filteredJobs.filter(job => job.location?.toLowerCase().includes(loc));
    }
    
    if (filters.workMode) {
      const mode = filters.workMode.toLowerCase();
      filteredJobs = filteredJobs.filter(job => job.workMode?.toLowerCase().includes(mode));
    }

    return filteredJobs;
  }

  async getJobDetails(jobId: string): Promise<Partial<Job>> {
    return mockJobs.find(j => j.id === jobId) || mockJobs[0];
  }

  normalizeJob(rawJob: any): Partial<Job> {
    return rawJob;
  }

  async healthCheck(): Promise<ProviderStatus> {
    return {
      provider: 'Mock',
      status: 'DEMO',
      lastSync: Date.now()
    };
  }
}

export function getProvider(providerName?: string): JobProvider {
  const selected = providerName || process.env.JOB_PROVIDER;
  if (selected === 'mock') {
    return new MockJobProvider();
  }
  return new LinkedInJobProvider();
}

export function generateFingerprint(job: Partial<Job>): string {
  const source = (job.source || '').trim();
  const company = (job.company || '').trim();
  const title = (job.title || '').trim();
  const location = (job.location || '').trim();
  
  // Normalize whitespace and casing
  return `${source}_${company}_${title}_${location}`.toLowerCase().replace(/\s+/g, '-');
}

export function deduplicateJobs(jobs: Partial<Job>[]): { unique: Partial<Job>[], duplicates: number } {
  const seen = new Set<string>();
  const unique: Partial<Job>[] = [];
  let duplicates = 0;

  for (const job of jobs) {
    const fingerprint = generateFingerprint(job);
    if (seen.has(fingerprint)) {
      duplicates++;
    } else {
      seen.add(fingerprint);
      unique.push(job);
    }
  }

  return { unique, duplicates };
}
