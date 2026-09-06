import { describe, it, expect } from 'vitest';
import { MatchingService } from '../src/services/matchingService.js';

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
    expect(result.confidenceScore).toBe(100);
  });

  it('missing required but non-critical skill', () => {
    const evalMock = {
      skills: [
        { requirement: 'React', importance: 'REQUIRED', critical: false, matchLevel: 'MISSING' }
      ]
    };
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.matchScore).toBe(20); 
    // Missing required, non-critical puts it in SKIP because score < 40
    // Wait, let's bump the score by adding matching other things to isolate the skill logic
  });
  
  it('missing required but non-critical skill (high score)', () => {
    const evalMock = {
      skills: [
        { requirement: 'React', importance: 'REQUIRED', critical: false, matchLevel: 'MISSING' }
      ],
      experience: { requirement: 'Req', matchLevel: 'MATCHED' },
      seniority: { requirement: 'Req', matchLevel: 'MATCHED' },
      responsibilities: [
        { requirement: 'Req', matchLevel: 'MATCHED' }
      ]
    };
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.matchScore).toBeGreaterThan(40);
    expect(result.recommendation).toBe('APPLY_WITH_CHANGES'); 
  });

  it('missing critical skill', () => {
    const evalMock = {
      skills: [
        { requirement: 'Security Clearance', importance: 'REQUIRED', critical: true, matchLevel: 'MISSING' }
      ],
      experience: { requirement: 'Req', matchLevel: 'MATCHED' },
      seniority: { requirement: 'Req', matchLevel: 'MATCHED' },
      responsibilities: [
        { requirement: 'Req', matchLevel: 'MATCHED' }
      ]
    };
    const result = matchingService.calculateDeterministicScore(evalMock);
    // Despite high score, critical missing = SKIP
    expect(result.recommendation).toBe('SKIP');
  });

  it('no extracted requirements', () => {
    const evalMock = {};
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.matchScore).toBe(0);
    expect(result.confidenceScore).toBe(0);
  });

  it('partial experience match (numerical)', () => {
    const evalMock = {
      experience: { 
        requirement: '5 years React', 
        matchLevel: 'UNCLEAR', // Level doesn't matter if numerical are present
        requiredYears: 5,
        candidateYears: 2
      }
    };
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.matchScore).toBe(40); // 2/5 = 40% of the totalPossible (which is just experience since it's the only one)
  });
});
