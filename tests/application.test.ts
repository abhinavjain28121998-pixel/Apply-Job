import { describe, it, expect } from 'vitest';
import { calculateApplicationReadiness } from '../src/services/applicationReadinessService.ts';
import { Job, JobMatch, Application, UserProfile } from '../src/types.ts';

describe('calculateApplicationReadiness', () => {
  it('should return 0 readiness for unanalyzed job', () => {
    const job: Partial<Job> = {};
    const result = calculateApplicationReadiness(job, null, null, null);
    expect(result.score).toBe(0);
    expect(result.reasons).toContain('Job not analyzed');
  });

  it('should return 100 readiness for fully prepared job', () => {
    const job: Partial<Job> = { title: 'T', company: 'C' };
    const match = { analysisStatus: 'READY', matchScore: 80 } as JobMatch;
    const app = { 
      id: 'app-1',
      userId: 'user-1',
      jobId: 'job-1',
      status: 'PREPARING',
      datePrepared: Date.now(),
      tailoredCv: 'Some cv', 
      coverLetter: 'Some letter', 
      applicationAnswers: { why: 'Because' } 
    } as Application;
    const profile = { baseCvText: 'This is a long base CV text to ensure it passes the length requirement.', skills: ['React'] } as UserProfile;
    
    const result = calculateApplicationReadiness(job, match, app, profile);
    expect(result.score).toBe(100);
    expect(result.reasons.length).toBe(0);
  });

  it('readiness with no application', () => {
    const job: Partial<Job> = { title: 'T', company: 'C' };
    const match = { analysisStatus: 'READY', matchScore: 80 } as JobMatch;
    const profile = { baseCvText: 'This is a long base CV text to ensure it passes the length requirement.', skills: ['React'] } as UserProfile;
    
    const result = calculateApplicationReadiness(job, match, null, profile);
    // Should be missing tailoredCv (25), coverLetter (20), answers (15) -> Total score 40
    expect(result.score).toBe(40);
  });
});
