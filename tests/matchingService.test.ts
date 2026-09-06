import { describe, it, expect } from 'vitest';
import { MatchingService, EvaluatedRequirement } from '../src/services/matchingService.js';

describe('MatchingService Deterministic Scoring', () => {
  const matchingService = new (MatchingService as any)();

  it('should return 100 for perfect match', () => {
    const evalMock: EvaluatedRequirement[] = [
      { id: '1', text: 'React', category: 'SKILL', importance: 'REQUIRED', critical: true, matchLevel: 'MATCHED', evidence: '' },
      { id: '2', text: 'Degree', category: 'EDUCATION', importance: 'REQUIRED', critical: true, matchLevel: 'MATCHED', evidence: '' }
    ];
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.matchScore).toBe(100);
    expect(result.recommendation).toBe('APPLY');
  });

  it('missing required but non-critical skill', () => {
    const evalMock: EvaluatedRequirement[] = [
      { id: '1', text: 'React', category: 'SKILL', importance: 'REQUIRED', critical: false, matchLevel: 'MISSING', evidence: '' },
      { id: '2', text: 'TS', category: 'SKILL', importance: 'PREFERRED', critical: false, matchLevel: 'MATCHED', evidence: '' }
    ];
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.matchScore).toBe(50); 
    // Missing required non-critical -> APPLY_WITH_CHANGES or LOW_PRIORITY based on score
    expect(['APPLY_WITH_CHANGES', 'LOW_PRIORITY']).toContain(result.recommendation);
  });
  
  it('missing critical certification (other category)', () => {
    const evalMock: EvaluatedRequirement[] = [
      { id: '1', text: 'AWS', category: 'CERTIFICATION', importance: 'REQUIRED', critical: true, matchLevel: 'MISSING', evidence: '' },
      { id: '2', text: 'React', category: 'SKILL', importance: 'REQUIRED', critical: false, matchLevel: 'MATCHED', evidence: '' }
    ];
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.recommendation).toBe('SKIP');
  });

  it('missing critical education', () => {
    const evalMock: EvaluatedRequirement[] = [
      { id: '1', text: 'BSCS', category: 'EDUCATION', importance: 'REQUIRED', critical: true, matchLevel: 'MISSING', evidence: '' },
      { id: '2', text: 'React', category: 'SKILL', importance: 'REQUIRED', critical: false, matchLevel: 'MATCHED', evidence: '' }
    ];
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.recommendation).toBe('SKIP');
  });

  it('missing critical skill', () => {
    const evalMock: EvaluatedRequirement[] = [
      { id: '1', text: 'React', category: 'SKILL', importance: 'REQUIRED', critical: true, matchLevel: 'MISSING', evidence: '' },
      { id: '2', text: 'BSCS', category: 'EDUCATION', importance: 'REQUIRED', critical: false, matchLevel: 'MATCHED', evidence: '' }
    ];
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.recommendation).toBe('SKIP');
  });

  it('unavailable AI analysis', () => {
    // When AI parsing fails or is empty, we set analysisStatus = ANALYSIS_FAILED
    const evalMock = null;
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.analysisStatus).toBe('ANALYSIS_FAILED');
    expect(result.matchScore).toBeNull();
  });

  it('no extracted requirements', () => {
    const evalMock: EvaluatedRequirement[] = [];
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.analysisStatus).toBe('ANALYSIS_FAILED');
    expect(result.matchScore).toBeNull();
  });
});
