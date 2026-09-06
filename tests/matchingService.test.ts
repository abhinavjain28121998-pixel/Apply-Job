import { describe, it, expect } from 'vitest';
import { MatchingService, EvaluatedRequirement } from '../src/services/matchingService';

describe('MatchingService Deterministic Scoring', () => {
  const service = new MatchingService('dummy-key');

  it('calculates score proportionally within fixed category weights (10 skills vs 2 skills)', () => {
    const evidence = {
      skills: ['react', 'node', 'aws', 'docker', 'sql', 'nosql', 'ci/cd', 'typescript', 'jest', 'kubernetes'],
      experience: { totalYears: 5, relevantYears: 5, roles: [] },
      education: 'B.S.',
      certifications: [],
      industries: [],
      other: ''
    };

    const reqsA: EvaluatedRequirement[] = Array.from({ length: 10 }).map((_, i) => ({
      id: "sk-"+i, text: "Skill "+i, category: 'SKILL', importance: 'REQUIRED', critical: true,
      matchLevel: 'MATCHED', evidence: ''
    }));

    const reqsB: EvaluatedRequirement[] = Array.from({ length: 2 }).map((_, i) => ({
      id: "sk-"+i, text: "Skill "+i, category: 'SKILL', importance: 'REQUIRED', critical: true,
      matchLevel: 'MATCHED', evidence: ''
    }));

    const resA = service.calculateDeterministicScore(reqsA, evidence);
    const resB = service.calculateDeterministicScore(reqsB, evidence);

    expect(resA.matchScore).toBe(100); 
    expect(resB.matchScore).toBe(100);
  });

  it('does not allow a category to exceed its configured max weight', () => {
    const evidence = { skills: [], experience: { totalYears: 2, relevantYears: 2, roles: [] }, education: '', certifications: [], industries: [], other: '' };
    
    const reqs: EvaluatedRequirement[] = Array.from({ length: 20 }).map((_, i) => ({
      id: "oth-"+i, text: "Other "+i, category: 'OTHER', importance: 'REQUIRED', critical: false,
      matchLevel: 'MATCHED', evidence: ''
    }));

    const res = service.calculateDeterministicScore(reqs, evidence);
    
    expect(res.matchScore).toBe(100); 
  });

  it('assigns UNAVAILABLE recommendation when analysis is unavailable', () => {
    const res = (service as any).analysisUnavailable('', '');
    expect(res.recommendation).toBe('UNAVAILABLE');
    expect(res.confidenceScore).toBe(0);
    expect(res.matchScore).toBeNull();
  });

  it('assigns proper explanation for low scores', () => {
    const evidence = { skills: [], experience: { totalYears: 2, relevantYears: 2, roles: [] }, education: '', certifications: [], industries: [], other: '' };
    
    const reqs: EvaluatedRequirement[] = [
      { id: '1', text: 'Skill 1', category: 'SKILL', importance: 'REQUIRED', critical: false, matchLevel: 'MATCHED', evidence: '' },
      { id: '2', text: 'Skill 2', category: 'SKILL', importance: 'REQUIRED', critical: true, matchLevel: 'MISSING', evidence: '' },
      { id: '3', text: 'Skill 3', category: 'SKILL', importance: 'REQUIRED', critical: true, matchLevel: 'MISSING', evidence: '' },
      { id: '4', text: 'Skill 4', category: 'SKILL', importance: 'REQUIRED', critical: true, matchLevel: 'MISSING', evidence: '' }
    ];

    const res = service.calculateDeterministicScore(reqs, evidence);
    
    expect(res.matchScore).toBe(25); 
    expect(res.matchExplanation).toContain('Weak match');
    expect(res.matchExplanation).toContain('Missing critical requirements');
    expect(res.matchExplanation).not.toContain('Good overall fit');
  });
});
