import { describe, it, expect } from 'vitest';
import { deduplicateJobs, generateFingerprint } from './providers.js';

describe('Job Deduplication', () => {
  it('should generate deterministic fingerprints', () => {
    const jobA = {
      title: ' Software Engineer ',
      company: 'Tech Corp',
      location: 'Remote ',
      source: 'Naukri'
    };
    
    const jobB = {
      title: 'Software Engineer',
      company: 'Tech Corp',
      location: 'Remote',
      source: 'Naukri'
    };
    
    expect(generateFingerprint(jobA)).toEqual(generateFingerprint(jobB));
  });
  
  it('should deduplicate jobs correctly', () => {
    const jobs = [
      { id: '1', title: 'Dev', company: 'X', location: 'Y', source: 'S' },
      { id: '2', title: 'Dev', company: 'X', location: 'Y', source: 'S' },
      { id: '3', title: 'Dev', company: 'Y', location: 'Y', source: 'S' }
    ];
    
    const result = deduplicateJobs(jobs);
    
    expect(result.unique.length).toBe(2);
    expect(result.duplicates).toBe(1);
    expect(result.unique[0].id).toBe('1');
    expect(result.unique[1].id).toBe('3');
  });
});
