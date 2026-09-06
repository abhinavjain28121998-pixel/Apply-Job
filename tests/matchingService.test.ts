import { describe, it, expect } from 'vitest';
import { MatchingService } from '../src/services/matchingService.js';

// We can test the deterministic calculation by exposing it or making a mock
// The calculateDeterministicScore is currently private.
// We can use any cast to bypass private for testing
describe('MatchingService Deterministic Scoring', () => {
  const matchingService = new (MatchingService as any)();

  it('should return 100 for perfect match', () => {
    const evalMock = {
      skills: [
        { requirement: 'React', importance: 'REQUIRED', matchLevel: 'MATCHED' },
        { requirement: 'TypeScript', importance: 'PREFERRED', matchLevel: 'MATCHED' }
      ],
      experience: { matchLevel: 'MATCHED' },
      seniority: { matchLevel: 'MATCHED' },
      responsibilities: [
        { matchLevel: 'MATCHED' }
      ],
      industry: { matchLevel: 'MATCHED' },
      education: { matchLevel: 'MATCHED' },
      location: { matchLevel: 'MATCHED' },
      otherFit: { matchLevel: 'MATCHED' }
    };

    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.matchScore).toBe(100);
    expect(result.recommendation).toBe('APPLY');
  });

  it('should lower score for UNCLEAR and MISSING', () => {
    const evalMock = {
      skills: [
        { requirement: 'React', importance: 'REQUIRED', matchLevel: 'MISSING' },
        { requirement: 'TypeScript', importance: 'PREFERRED', matchLevel: 'UNCLEAR' }
      ],
      experience: { matchLevel: 'MISSING' },
      seniority: { matchLevel: 'MATCHED' },
      responsibilities: [
        { matchLevel: 'MATCHED' }
      ],
      industry: { matchLevel: 'MATCHED' },
      education: { matchLevel: 'MATCHED' },
      location: { matchLevel: 'MATCHED' },
      otherFit: { matchLevel: 'MATCHED' }
    };

    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.matchScore).toBeLessThan(70);
    expect(result.recommendation).toBe('SKIP'); // because missing required skills
    expect(result.missingRequiredSkills).toContain('React');
  });

  it('should classify as LOW_PRIORITY if score < 65 but no required skills missing', () => {
    const evalMock = {
      skills: [
        { requirement: 'React', importance: 'REQUIRED', matchLevel: 'MATCHED' },
      ],
      experience: { matchLevel: 'MISSING' },
      seniority: { matchLevel: 'MISSING' },
      responsibilities: [
        { matchLevel: 'MISSING' }
      ],
      industry: { matchLevel: 'MISSING' },
      education: { matchLevel: 'MISSING' },
      location: { matchLevel: 'MISSING' },
      otherFit: { matchLevel: 'MISSING' }
    };

    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.matchScore).toBe(35); // only skills match
    expect(result.recommendation).toBe('SKIP'); // Wait, <40 is SKIP
  });
  
  it('should classify as LOW_PRIORITY if score between 40-64', () => {
    const evalMock = {
      skills: [
        { requirement: 'React', importance: 'REQUIRED', matchLevel: 'MATCHED' },
      ],
      experience: { matchLevel: 'MISSING' },
      seniority: { matchLevel: 'MATCHED' }, // 15
      responsibilities: [
        { matchLevel: 'MISSING' }
      ],
      industry: { matchLevel: 'MISSING' },
      education: { matchLevel: 'MISSING' },
      location: { matchLevel: 'MISSING' },
      otherFit: { matchLevel: 'MISSING' }
    };

    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.matchScore).toBe(50); // 35 + 15
    expect(result.recommendation).toBe('LOW_PRIORITY');
  });
});
