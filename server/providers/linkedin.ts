import { Job, SearchFilters, ProviderStatus, JobProvider } from '../../src/types.js';

/**
 * LinkedInJobProvider
 * 
 * Complies with official LinkedIn Developer Platform rules:
 * 1. LinkedIn does NOT offer a publicly accessible consumer Job Search API.
 * 2. Enterprise/Partner APIs (Talent Solutions / Recruiter System Connect / Job Posting API)
 *    require formal contractual business agreements and enterprise provisioning.
 * 3. This provider provides the official scaffolding for enterprise integration when configured.
 * 4. When unconfigured (default), it strictly refuses to generate artificial or fake LinkedIn jobs,
 *    delegating discovery to the compliant "Search on LinkedIn" URL destination.
 */
export class LinkedInJobProvider implements JobProvider {
  private clientId = process.env.LINKEDIN_CLIENT_ID;
  private clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  private enterpriseApiUrl = process.env.LINKEDIN_ENTERPRISE_API_URL;
  private isJobSearchApiEnabled = process.env.LINKEDIN_JOB_SEARCH_API_ENABLED === 'true';

  /**
   * Evaluates whether official LinkedIn Partner Job Search API access is fully configured.
   */
  public isConfigured(): boolean {
    return !!(
      this.isJobSearchApiEnabled &&
      this.enterpriseApiUrl &&
      this.clientId &&
      this.clientSecret
    );
  }

  /**
   * Searches jobs via official enterprise partner endpoint if enabled.
   * If not configured, returns an empty list without fabricating mock records.
   */
  async searchJobs(filters: SearchFilters): Promise<Partial<Job>[]> {
    if (!this.isConfigured()) {
      // Invariant: Do not invent mock LinkedIn jobs when real API access is absent.
      return [];
    }

    try {
      // Production Enterprise Partner Integration scaffolding
      const searchEndpoint = new URL(`${this.enterpriseApiUrl}/jobs`);
      if (filters.query) searchEndpoint.searchParams.set('keywords', filters.query);
      if (filters.location) searchEndpoint.searchParams.set('location', filters.location);
      if (filters.workMode) searchEndpoint.searchParams.set('workMode', filters.workMode);

      const response = await fetch(searchEndpoint.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.clientSecret}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`LinkedIn API responded with status ${response.status}`);
      }

      const data = await response.json();
      const elements: any[] = data.elements || [];
      return elements.map(elem => this.normalizeJob(elem));
    } catch (err) {
      console.warn('LinkedIn Job Search API error:', err);
      return [];
    }
  }

  /**
   * Retrieves single job details from official partner API or throws unconfigured error.
   */
  async getJobDetails(jobId: string): Promise<Partial<Job>> {
    if (!this.isConfigured()) {
      throw new Error(
        'LinkedIn Job Details API requires approved Enterprise/Partner credentials. ' +
        'Use the official "Search on LinkedIn" link to view this job directly on LinkedIn.'
      );
    }

    const response = await fetch(`${this.enterpriseApiUrl}/jobs/${encodeURIComponent(jobId)}`, {
      headers: {
        'Authorization': `Bearer ${this.clientSecret}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`LinkedIn API responded with status ${response.status}`);
    }

    const rawJob = await response.json();
    return this.normalizeJob(rawJob);
  }

  /**
   * Normalizes official LinkedIn Job schema into internal Job format.
   */
  normalizeJob(rawJob: any): Partial<Job> {
    const id = rawJob.id || rawJob.jobPostingId || rawJob.entityUrn || String(Math.random());
    const company = rawJob.companyName || rawJob.companyDetails?.companyName || rawJob.company || 'LinkedIn Employer';
    const title = rawJob.title || rawJob.jobTitle || 'Opportunity';
    const location = rawJob.location || rawJob.formattedLocation || 'Remote / Unspecified';
    const description = rawJob.description?.text || rawJob.description || rawJob.jobDescription || '';
    const applyUrl = rawJob.applyUrl || rawJob.companyApplyUrl || `https://www.linkedin.com/jobs/view/${id}`;

    return {
      id: `li_${id}`,
      title,
      company,
      location,
      description,
      url: applyUrl,
      source: 'LinkedIn (API)',
      postedDate: rawJob.listedAt || rawJob.postedDate || Date.now(),
      workMode: rawJob.workplaceTypes?.[0] || rawJob.workMode || 'On-site',
      employmentType: rawJob.employmentStatus || rawJob.employmentType || 'Full-time',
      experienceRequired: rawJob.experienceLevel || rawJob.experience,
      salaryRange: rawJob.salaryInsights?.compensation || rawJob.salaryRange
    };
  }

  /**
   * Health check reporting provider configuration state.
   */
  async healthCheck(): Promise<ProviderStatus> {
    if (!this.isConfigured()) {
      return {
        provider: 'LinkedIn',
        status: 'NOT_CONFIGURED',
        lastError: 'Official LinkedIn Job Search API is restricted to approved Enterprise/Partner programs. Direct search is routed through the official LinkedIn Search destination.'
      };
    }

    return {
      provider: 'LinkedIn',
      status: 'CONNECTED',
      lastSync: Date.now()
    };
  }
}
