import { describe, it, expect } from 'vitest';
import { calculateApplicationReadiness } from '../src/services/applicationReadinessService.ts';
import { Job } from '../src/types.ts';

describe('calculateApplicationReadiness', () => {
  it('should return 0 readiness for unanalyzed job', () => {
    const job: Partial<Job> = {};
    const result = calculateApplicationReadiness(job);
    expect(result.score).toBe(0);
    expect(result.reasons).toContain('Job not analyzed');
  });

  it('should return 100 readiness for fully prepared job', () => {
    const job: Partial<Job> = {
      matchScore: 80,
      tailoredCv: 'Some cv',
      coverLetter: 'Some cover letter',
      applicationAnswers: { why: 'Because' }, title: 'T', company: 'C', url: 'U'
    };
    const result = calculateApplicationReadiness(job);
    expect(result.score).toBe(100);
    expect(result.reasons.length).toBe(0);
  });
});
