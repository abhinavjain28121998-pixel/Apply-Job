import { Job, SearchFilters, ProviderStatus, JobProvider } from '../../src/types.js';
import { linkedinJobDiscoveryService } from '../../src/services/linkedinService.js';

/**
 * LinkedInJobProvider
 * 
 * Complies with official LinkedIn Developer Platform terms and requirements:
 * 1. Consumer OpenID Connect authentication requires only:
 *    - LINKEDIN_ENABLED
 *    - LINKEDIN_CLIENT_ID
 *    - LINKEDIN_CLIENT_SECRET
 *    - LINKEDIN_REDIRECT_URI
 *    - LINKEDIN_SCOPES
 * 2. Job discovery is performed through the official "Search on LinkedIn" URL destination builder.
 *    No unauthorized job search API or enterprise API credentials are required.
 * 3. Never scrapes LinkedIn, automates browsers, or invents mock listings.
 */
export class LinkedInJobProvider implements JobProvider {
  /**
   * Evaluates whether official LinkedIn OAuth integration is configured.
   */
  public isConfigured(): boolean {
    return (
      process.env.LINKEDIN_ENABLED === 'true' &&
      !!(process.env.LINKEDIN_CLIENT_ID?.trim() && process.env.LINKEDIN_CLIENT_SECRET?.trim())
    );
  }

  /**
   * Generates official LinkedIn search destination URL for the given search filters
   * using native URLSearchParams constructor via linkedinJobDiscoveryService.
   */
  public getSearchUrl(filters: SearchFilters): string {
    return linkedinJobDiscoveryService.buildSearchUrl({
      keywords: filters.query,
      location: filters.location,
      workMode: filters.workMode as any,
      experience: filters.experience
    });
  }

  /**
   * Job discovery is routed through the official "Search on LinkedIn" destination.
   * Returns empty array without fabricating mock records or calling unauthorized APIs.
   */
  async searchJobs(_filters: SearchFilters): Promise<Partial<Job>[]> {
    return [];
  }

  /**
   * Returns official LinkedIn job view link.
   */
  async getJobDetails(jobId: string): Promise<Partial<Job>> {
    const cleanId = jobId.replace(/^li_/, '');
    return {
      id: jobId,
      title: 'LinkedIn Job Posting',
      company: 'LinkedIn Employer',
      url: `https://www.linkedin.com/jobs/view/${encodeURIComponent(cleanId)}`,
      source: 'LinkedIn'
    };
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
      source: 'LinkedIn',
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
    const isConfigured = this.isConfigured();
    return {
      provider: 'LinkedIn',
      status: isConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
      lastSync: Date.now(),
      lastError: isConfigured
        ? undefined
        : 'LinkedIn OAuth is not configured or disabled. Job discovery is active via official "Search on LinkedIn" destination URLs.'
    };
  }
}
