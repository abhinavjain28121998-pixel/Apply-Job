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
      experience: { requirement: 'Req', matchLevel: 'MATCHED' },
      seniority: { requirement: 'Req', matchLevel: 'MATCHED' },
      responsibilities: [
        { requirement: 'Req', matchLevel: 'MATCHED' }
      ],
      industry: { requirement: 'Req', matchLevel: 'MATCHED' },
      education: { requirement: 'Req', matchLevel: 'MATCHED' },
      location: { requirement: 'Req', matchLevel: 'MATCHED' },
      otherFit: { requirement: 'Req', matchLevel: 'MATCHED' }
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
      experience: { requirement: 'Req', matchLevel: 'MISSING' },
      seniority: { requirement: 'Req', matchLevel: 'MATCHED' },
      responsibilities: [
        { requirement: 'Req', matchLevel: 'MATCHED' }
      ],
      industry: { requirement: 'Req', matchLevel: 'MATCHED' },
      education: { requirement: 'Req', matchLevel: 'MATCHED' },
      location: { requirement: 'Req', matchLevel: 'MATCHED' },
      otherFit: { requirement: 'Req', matchLevel: 'MATCHED' }
    };

    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.matchScore).toBeLessThan(70);
    expect(result.recommendation).toBe('LOW_PRIORITY');
    expect(result.missingRequiredSkills).toContain('React');
  });

  it('should classify as LOW_PRIORITY if score < 65 but no required skills missing', () => {
    const evalMock = {
      skills: [
        { requirement: 'React', importance: 'REQUIRED', matchLevel: 'MATCHED' },
      ],
      experience: { requirement: 'Req', matchLevel: 'MISSING' },
      seniority: { requirement: 'Req', matchLevel: 'MISSING' },
      responsibilities: [
        { requirement: 'Req', matchLevel: 'MISSING' }
      ],
      industry: { requirement: 'Req', matchLevel: 'MISSING' },
      education: { requirement: 'Req', matchLevel: 'MISSING' },
      location: { requirement: 'Req', matchLevel: 'MISSING' },
      otherFit: { requirement: 'Req', matchLevel: 'MISSING' }
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
      experience: { requirement: 'Req', matchLevel: 'MISSING' },
      seniority: { requirement: 'Req', matchLevel: 'MATCHED' }, // 15
      responsibilities: [
        { requirement: 'Req', matchLevel: 'MISSING' }
      ],
      industry: { requirement: 'Req', matchLevel: 'MISSING' },
      education: { requirement: 'Req', matchLevel: 'MISSING' },
      location: { requirement: 'Req', matchLevel: 'MISSING' },
      otherFit: { requirement: 'Req', matchLevel: 'MISSING' }
    };

    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.matchScore).toBe(50); // 35 + 15
    expect(result.recommendation).toBe('LOW_PRIORITY');
  });
});
