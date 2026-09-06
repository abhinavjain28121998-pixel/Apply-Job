import fs from 'fs';

let content = `import { describe, it, expect, vi } from 'vitest';
import { MatchingService, EvaluatedRequirement } from '../src/services/matchingService.js';

describe('MatchingService Deterministic Scoring', () => {
  const matchingService = new (MatchingService as any)();

  it('should return 100 for perfect match', () => {
    const evalMock: EvaluatedRequirement[] = [
      { id: '1', text: 'React', category: 'SKILL', importance: 'REQUIRED', critical: true, matchLevel: 'MATCHED', evidence: '' },
      { id: '2', text: 'Degree', category: 'EDUCATION', importance: 'REQUIRED', critical: true, matchLevel: 'MATCHED', evidence: '' }
    ];
    const result = matchingService.calculateDeterministicScore(evalMock, { skills: ['React'], experience: { totalYears: null, relevantYears: null, roles: [] }, education: 'Degree', certifications: [], industries: [], other: '' });
    expect(result.matchScore).toBe(100);
    expect(result.recommendation).toBe('APPLY');
  });

  it('missing required but non-critical skill', () => {
    const evalMock: EvaluatedRequirement[] = [
      { id: '1', text: 'React', category: 'SKILL', importance: 'REQUIRED', critical: false, matchLevel: 'MISSING', evidence: '' },
      { id: '2', text: 'TS', category: 'SKILL', importance: 'PREFERRED', critical: false, matchLevel: 'MATCHED', evidence: '' }
    ];
    const result = matchingService.calculateDeterministicScore(evalMock, { skills: ['TS'], experience: { totalYears: null, relevantYears: null, roles: [] }, education: '', certifications: [], industries: [], other: '' });
    expect(result.matchScore).toBe(50); 
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

  it('unavailable AI analysis', () => {
    const evalMock = null;
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.analysisStatus).toBe('ANALYSIS_FAILED');
    expect(result.matchScore).toBeNull();
  });

  it('5 years required / 5 years candidate', () => {
    const evalMock: EvaluatedRequirement[] = [
      { id: '1', text: '5 years experience', category: 'EXPERIENCE', importance: 'REQUIRED', critical: true, matchLevel: 'MATCHED', evidence: '', requiredYears: 5, candidateYears: 5 }
    ];
    const result = matchingService.calculateDeterministicScore(evalMock, { experience: { totalYears: 5, relevantYears: 5, roles: [] }, skills: [], education: '', certifications: [], industries: [], other: '' });
    expect(result.matchScore).toBe(100);
  });

  it('5 years required / 4 years candidate', () => {
    const evalMock: EvaluatedRequirement[] = [
      { id: '1', text: '5 years experience', category: 'EXPERIENCE', importance: 'REQUIRED', critical: true, matchLevel: 'MATCHED', evidence: '', requiredYears: 5, candidateYears: 4 }
    ];
    const result = matchingService.calculateDeterministicScore(evalMock, { experience: { totalYears: 4, relevantYears: 4, roles: [] }, skills: [], education: '', certifications: [], industries: [], other: '' });
    expect(result.matchScore).toBe(80); // 4/5 * 10 = 8. 8/10 = 80%
  });

  it('5 years required / 1 year candidate', () => {
    const evalMock: EvaluatedRequirement[] = [
      { id: '1', text: '5 years experience', category: 'EXPERIENCE', importance: 'REQUIRED', critical: true, matchLevel: 'MATCHED', evidence: '', requiredYears: 5, candidateYears: 1 }
    ];
    const result = matchingService.calculateDeterministicScore(evalMock, { experience: { totalYears: 1, relevantYears: 1, roles: [] }, skills: [], education: '', certifications: [], industries: [], other: '' });
    expect(result.matchScore).toBe(20); // 1/5 = 20%
  });

  it('no experience evidence', () => {
    const evalMock: EvaluatedRequirement[] = [
      { id: '1', text: '5 years experience', category: 'EXPERIENCE', importance: 'REQUIRED', critical: true, matchLevel: 'UNCLEAR', evidence: '', requiredYears: 5, candidateYears: null }
    ];
    const result = matchingService.calculateDeterministicScore(evalMock, { experience: { totalYears: null, relevantYears: null, roles: [] }, skills: [], education: '', certifications: [], industries: [], other: '' });
    expect(result.matchScore).toBe(40); // 0.4 weight for UNCLEAR
  });

  it('confidence calculation', () => {
    const evalMock: EvaluatedRequirement[] = [
      { id: '1', text: 'Skill', category: 'SKILL', importance: 'REQUIRED', critical: false, matchLevel: 'UNCLEAR', evidence: '' }
    ];
    // 1 req < 3 (penalty 20)
    // 1 unclear / 1 req (penalty 50)
    // No evidence (penalty 40)
    // Max penalty 110, confidence 0
    const result = matchingService.calculateDeterministicScore(evalMock, { experience: { totalYears: null, relevantYears: null, roles: [] }, skills: [], education: '', certifications: [], industries: [], other: '' });
    expect(result.confidenceScore).toBe(0);
  });
});
`;

fs.writeFileSync('tests/matchingService.test.ts', content);
