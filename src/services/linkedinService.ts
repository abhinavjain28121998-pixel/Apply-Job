import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../firebase';
import { LinkedInSearchCriteria, SavedLinkedInSearch, ExternalJobSearchDestination, UserProfile, Job, LinkedInJobDiscoveryService } from '../types';
import { handleFirestoreError, OperationType, shouldUseFirestore } from '../lib/firestoreError';

export type { LinkedInSearchCriteria } from '../types';

const LINKEDIN_BASE_URL = 'https://www.linkedin.com/jobs/search/';
const TRUSTED_HOSTS = new Set(['www.linkedin.com', 'linkedin.com']);

/**
 * Maps experience strings to LinkedIn standard filter codes (f_E).
 * 1: Internship, 2: Entry level, 3: Associate, 4: Mid-Senior level, 5: Director, 6: Executive
 */
export function mapExperienceToLinkedInFilter(exp?: string): string | undefined {
  if (!exp) return undefined;
  const s = exp.toLowerCase().trim();
  if (s.includes('intern')) return '1';
  if (s.includes('entry') || s.includes('fresher') || s.includes('0-1') || s.includes('junior')) return '2';
  if (s.includes('associate') || s.includes('1-3')) return '3';
  if (s.includes('mid') || s.includes('senior') || s.includes('lead') || s.includes('3-5') || s.includes('5+') || s.includes('4-')) return '4';
  if (s.includes('director') || s.includes('head')) return '5';
  if (s.includes('exec') || s.includes('vp') || s.includes('c-level') || s.includes('chief')) return '6';
  return undefined;
}

/**
 * Maps work mode / remote parameters to LinkedIn work type filter codes (f_WT).
 * 1: On-site, 2: Remote, 3: Hybrid
 */
export function mapWorkModeToLinkedInFilter(workMode?: string, remote?: boolean | string): string | undefined {
  if (remote === true || remote === 'true' || remote === 'Remote') return '2';
  if (remote === 'Hybrid') return '3';
  if (remote === 'On-site') return '1';

  if (!workMode) return undefined;
  const m = workMode.toLowerCase().trim();
  if (m === 'remote') return '2';
  if (m === 'hybrid') return '3';
  if (m === 'on-site' || m === 'onsite' || m === 'in-office') return '1';
  return undefined;
}

/**
 * Maps employment types to LinkedIn job type filter codes (f_JT).
 * F: Full-time, P: Part-time, C: Contract, T: Temporary, I: Internship
 */
export function mapJobTypeToLinkedInFilter(jobType?: string): string | undefined {
  if (!jobType) return undefined;
  const t = jobType.toLowerCase().trim();
  if (t.includes('full')) return 'F';
  if (t.includes('part')) return 'P';
  if (t.includes('contract') || t.includes('freelance')) return 'C';
  if (t.includes('temp')) return 'T';
  if (t.includes('intern')) return 'I';
  return undefined;
}

/**
 * Validates that a given URL string safely points to the official LinkedIn domain.
 * Prevents phishing, open redirects, or arbitrary user URLs.
 */
export function isValidLinkedInUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'https:' && TRUSTED_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Builds an official, safely encoded LinkedIn Jobs search URL using native URL and URLSearchParams constructors.
 * Operates purely on client and server runtimes without needing LinkedIn API access or credentials.
 * Automatically omits empty/whitespace filters and ensures target URLs conform to the trusted LinkedIn origin.
 */
export function buildLinkedInJobsUrl(criteria: LinkedInSearchCriteria): string {
  // Native URL constructor for official LinkedIn job search base
  const url = new URL(LINKEDIN_BASE_URL);
  
  // Native URLSearchParams constructor to parse, format, and safely encode query parameters
  const searchParams = new URLSearchParams();

  // 1. Keywords & Job Title (combining query, jobTitle, keywords without redundant duplication)
  const kw = criteria?.keywords?.trim();
  const jt = criteria?.jobTitle?.trim();
  const queryParam = (criteria as any)?.query?.trim();

  let combinedKeywords = '';
  if (kw && jt) {
    if (kw.toLowerCase().includes(jt.toLowerCase())) {
      combinedKeywords = kw;
    } else {
      combinedKeywords = `${jt} ${kw}`;
    }
  } else {
    combinedKeywords = kw || jt || queryParam || '';
  }

  if (combinedKeywords) {
    searchParams.set('keywords', combinedKeywords);
  }

  // 2. Location
  if (criteria?.location && criteria.location.trim()) {
    searchParams.set('location', criteria.location.trim());
  }

  // 3. Remote / Work Mode (LinkedIn official parameter: f_WT)
  const workType = mapWorkModeToLinkedInFilter(criteria?.workMode, criteria?.remote);
  if (workType) {
    searchParams.set('f_WT', workType);
  }

  // 4. Experience Level (LinkedIn official parameter: f_E)
  const expFilter = criteria?.experience || criteria?.experienceLevel;
  const expCode = mapExperienceToLinkedInFilter(expFilter);
  if (expCode) {
    searchParams.set('f_E', expCode);
  }

  // 5. Job Type / Employment Type (LinkedIn official parameter: f_JT)
  const jobTypeFilter = criteria?.jobType || criteria?.employmentType;
  const jobTypeCode = mapJobTypeToLinkedInFilter(jobTypeFilter);
  if (jobTypeCode) {
    searchParams.set('f_JT', jobTypeCode);
  }

  // 6. Sort By (DD for Date/Recent, R for Relevant)
  if (criteria?.sortBy === 'recent') {
    searchParams.set('sortBy', 'DD');
  } else if (criteria?.sortBy === 'relevant') {
    searchParams.set('sortBy', 'R');
  }

  // Attach safe search parameters to the native URL constructor
  const paramString = searchParams.toString();
  if (paramString) {
    url.search = paramString;
  }

  const resultUrl = url.toString();

  // Final invariant check: Must be a verified LinkedIn URL
  if (!isValidLinkedInUrl(resultUrl)) {
    throw new Error('Generated an invalid LinkedIn search URL');
  }

  return resultUrl;
}

/**
 * Generates an official LinkedIn search URL specifically targeting an existing Job posting.
 */
export function buildLinkedInSearchUrlForJob(job: Partial<Job>): string {
  const parts: string[] = [];
  if (job.title) parts.push(job.title.trim());
  if (job.company) parts.push(job.company.trim());

  return buildLinkedInJobsUrl({
    keywords: parts.join(' '),
    location: job.location,
    workMode: job.workMode as LinkedInSearchCriteria['workMode'],
    experience: job.experienceRequired,
    jobType: job.employmentType
  });
}

/**
 * Generates an official LinkedIn search URL based on the candidate's existing Profile & CV.
 */
export function buildLinkedInSearchUrlFromProfile(profile: Partial<UserProfile>): string {
  const keywords: string[] = [];

  if (profile.currentRole && profile.currentRole.trim()) {
    keywords.push(profile.currentRole.trim());
  } else if (profile.skills && profile.skills.length > 0) {
    // Pick top 2 most prominent skills
    keywords.push(profile.skills.slice(0, 2).join(' '));
  }

  const location = profile.preferredLocations && profile.preferredLocations.length > 0
    ? profile.preferredLocations[0]
    : undefined;

  let experienceStr: string | undefined;
  if (profile.totalExperience != null) {
    const yrs = profile.totalExperience;
    if (yrs <= 1) experienceStr = 'entry';
    else if (yrs <= 3) experienceStr = 'associate';
    else if (yrs <= 7) experienceStr = 'senior';
    else experienceStr = 'lead senior';
  }

  return buildLinkedInJobsUrl({
    keywords: keywords.join(' ') || 'Software Engineer',
    location,
    workMode: profile.workMode as LinkedInSearchCriteria['workMode'],
    experience: experienceStr
  });
}

/**
 * LinkedIn Job Discovery Service
 * 
 * Uses the native URL and URLSearchParams constructor to build official LinkedIn job search
 * destination URLs based on user criteria when direct API access is unavailable or uncredentialed.
 * Guarantees the application remains fully functional without needing specific API credentials.
 */
export const linkedinJobDiscoveryService: LinkedInJobDiscoveryService = {
  /**
   * Builds an official LinkedIn job search URL using native URL and URLSearchParams constructor.
   */
  buildSearchUrl(criteria: LinkedInSearchCriteria): string {
    return buildLinkedInJobsUrl(criteria);
  },

  /**
   * Builds an official LinkedIn search URL derived from candidate profile and CV data.
   */
  buildSearchUrlFromProfile(profile: Partial<UserProfile>): string {
    return buildLinkedInSearchUrlFromProfile(profile);
  },

  /**
   * Builds an official LinkedIn search URL targeting a specific job posting.
   */
  buildSearchUrlForJob(job: Partial<Job>): string {
    return buildLinkedInSearchUrlForJob(job);
  },

  /**
   * Discovers matching jobs using the official LinkedIn search destination when API access is unavailable.
   * Enables continuous functionality without requiring specific API credentials or web scrapers.
   */
  async discoverJobs(criteria: LinkedInSearchCriteria): Promise<{
    mode: 'EXTERNAL_SEARCH' | 'URL_DESTINATION';
    searchUrl: string;
    criteria: LinkedInSearchCriteria;
    message: string;
    jobs: Partial<Job>[];
  }> {
    const searchUrl = buildLinkedInJobsUrl(criteria);
    return {
      mode: 'EXTERNAL_SEARCH',
      searchUrl,
      criteria,
      message: 'Job discovery is powered by the official LinkedIn search destination. Browse real postings directly on LinkedIn with zero API credentials or scraping required.',
      jobs: []
    };
  },

  /**
   * Validates that a given URL points safely to official LinkedIn job search.
   */
  isValidUrl(url: string): boolean {
    return isValidLinkedInUrl(url);
  }
};

export const linkedInJobDiscoveryService = linkedinJobDiscoveryService;
export const linkedinDiscoveryService = linkedinJobDiscoveryService;
export type LinkedInDiscoveryService = LinkedInJobDiscoveryService;

/**
 * External job destination implementation for LinkedIn
 */
export const linkedInDestination: ExternalJobSearchDestination = {
  id: 'linkedin',
  name: 'LinkedIn Jobs',
  description: 'Search official LinkedIn jobs and apply directly on LinkedIn in a new browser tab.',
  buildSearchUrl: (criteria: LinkedInSearchCriteria) => linkedinJobDiscoveryService.buildSearchUrl(criteria)
};

// Local storage helper with in-memory fallback for node/test/offline environments
let memorySavedSearches: SavedLinkedInSearch[] = [];

const getLocalSavedSearches = (): SavedLinkedInSearch[] => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return JSON.parse(window.localStorage.getItem('demo_saved_linkedin_searches') || '[]');
    }
    return memorySavedSearches;
  } catch {
    return memorySavedSearches;
  }
};

const setLocalSavedSearches = (searches: SavedLinkedInSearch[]) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('demo_saved_linkedin_searches', JSON.stringify(searches));
    }
  } catch {}
  memorySavedSearches = searches;
};

/**
 * Service to manage saved LinkedIn search configurations.
 * Allows candidates to save search intent without importing or scraping third-party job records.
 */
export const linkedinSearchService = {
  getSavedSearches: async (userId: string): Promise<SavedLinkedInSearch[]> => {
    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = 'saved_linkedin_searches';
      try {
        const q = query(collection(db, path), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data() as SavedLinkedInSearch);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
        return [];
      }
    } else {
      return getLocalSavedSearches().filter(s => s.userId === userId);
    }
  },

  saveSearch: async (userId: string, criteria: LinkedInSearchCriteria, title?: string): Promise<SavedLinkedInSearch> => {
    const generatedUrl = buildLinkedInJobsUrl(criteria);
    const searchId = `search_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const saved: SavedLinkedInSearch = {
      id: searchId,
      userId,
      criteria,
      generatedUrl,
      title: title || criteria.keywords || 'LinkedIn Job Search',
      createdAt: Date.now()
    };

    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = `saved_linkedin_searches/${searchId}`;
      try {
        await setDoc(doc(db, 'saved_linkedin_searches', searchId), saved);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    } else {
      const searches = getLocalSavedSearches();
      searches.unshift(saved);
      setLocalSavedSearches(searches);
    }

    return saved;
  },

  deleteSearch: async (userId: string, searchId: string): Promise<void> => {
    if (isFirebaseConfigured() && db && shouldUseFirestore(userId)) {
      const path = `saved_linkedin_searches/${searchId}`;
      try {
        await deleteDoc(doc(db, 'saved_linkedin_searches', searchId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    } else {
      const searches = getLocalSavedSearches().filter(s => s.id !== searchId);
      setLocalSavedSearches(searches);
    }
  }
};
