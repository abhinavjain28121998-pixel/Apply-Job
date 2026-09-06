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
      provider: 'Naukri (Mock)',
      status: 'DEMO',
      lastSync: Date.now()
    };
  }
}

export class NaukriJobProvider implements JobProvider {
  private baseUrl = process.env.NAUKRI_API_BASE_URL;
  private apiKey = process.env.NAUKRI_API_KEY;
  private clientId = process.env.NAUKRI_CLIENT_ID;

  private isConfigured(): boolean {
    return !!(this.baseUrl && this.apiKey && this.clientId);
  }

  async searchJobs(filters: SearchFilters): Promise<Partial<Job>[]> {
    if (!this.isConfigured()) return [];
    
    // In a real implementation, this would make an authenticated fetch to Naukri API
    // e.g., fetch(`${this.baseUrl}/jobs?q=${filters.query}`, { headers: { 'Authorization': `Bearer ${this.apiKey}` } })
    
    // Simulating API call for demonstration of the production scaffolding
    return []; 
  }

  async getJobDetails(jobId: string): Promise<Partial<Job>> {
    if (!this.isConfigured()) throw new Error('Not configured');
    return { id: jobId, title: 'Real Job', source: 'Naukri' }; 
  }

  normalizeJob(rawJob: any): Partial<Job> {
    // Normalizes real Naukri payload into internal Job format
    return {
      id: rawJob.jobId || String(Math.random()),
      title: rawJob.title || rawJob.jobTitle || 'Unknown Title',
      company: rawJob.companyName || rawJob.company || 'Unknown Company',
      location: rawJob.location || rawJob.locations?.[0] || 'Unknown Location',
      description: rawJob.jobDescription || rawJob.description || '',
      url: rawJob.applyUrl || rawJob.url,
      source: 'Naukri',
      postedDate: rawJob.postedDate ? new Date(rawJob.postedDate).getTime() : Date.now(),
      experienceRequired: rawJob.experience,
      salaryRange: rawJob.salary,
      workMode: rawJob.workMode || 'On-site',
    };
  }

  async healthCheck(): Promise<ProviderStatus> {
    if (!this.isConfigured()) {
      return {
        provider: 'Naukri',
        status: 'NOT_CONFIGURED',
        lastError: 'Missing API credentials'
      };
    }
    
    // Real implementation would ping the health endpoint, but since it is not implemented:
    return {
      provider: 'Naukri',
      status: 'ERROR',
      lastError: 'Naukri integration pending backend implementation'
    };
  }
}

export function getProvider(providerName?: string): JobProvider {
  const selected = providerName || process.env.JOB_PROVIDER;
  if (selected === 'linkedin') {
    return new LinkedInJobProvider();
  }
  if (selected === 'naukri') {
    return new NaukriJobProvider();
  }
  return new MockJobProvider();
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
