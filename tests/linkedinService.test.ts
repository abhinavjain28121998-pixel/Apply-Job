import { describe, it, expect } from 'vitest';
import {
  buildLinkedInJobsUrl,
  buildLinkedInSearchUrlForJob,
  buildLinkedInSearchUrlFromProfile,
  isValidLinkedInUrl,
  mapExperienceToLinkedInFilter,
  mapWorkModeToLinkedInFilter,
  mapJobTypeToLinkedInFilter,
  linkedInDestination,
  linkedinSearchService
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
});
