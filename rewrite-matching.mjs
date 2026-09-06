import fs from 'fs';

const matchingServiceCode = `import { GoogleGenAI } from '@google/genai';
import { JobRecommendation, JobRequirement, ResumeEvidence } from '../types.js';

export interface EvaluatedRequirement extends JobRequirement {
  matchLevel: 'MATCHED' | 'MISSING' | 'UNCLEAR';
  evidence: string;
}

export interface JobMatchResult {
  analysisStatus: 'READY' | 'ANALYSIS_UNAVAILABLE' | 'ANALYSIS_FAILED';
  matchScore?: number | null;
  confidenceScore: number;
  matchExplanation: string;
  skillsMatch: string;
  experienceMatch: string;
  seniorityMatch: string;
  industryMatch: string;
  locationMatch: string;
  educationMatch: string;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  missingNiceToHaveSkills: string[];
  concerns: string[];
  recommendation: JobRecommendation;
  details: any;
}

export class MatchingService {
  private ai: GoogleGenAI | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.ai = new GoogleGenAI({ apiKey: key });
    }
  }

  public async evaluateMatch(jobDescription: string, baseCv: string): Promise<JobMatchResult> {
    if (!this.ai) {
      console.warn("GEMINI_API_KEY not found. Using fallback deterministic analysis.");
      return this.fallbackAnalysis(jobDescription, baseCv);
    }

    try {
      // Step 1: Extract Job Requirements
      const requirements = await this.extractJobRequirements(jobDescription);
      
      // Step 2: Extract Resume Evidence
      const evidence = await this.extractResumeEvidence(baseCv);

      // Step 3: Match Requirements (Semantic Equivalence)
      const evaluatedReqs = await this.semanticMatching(requirements, evidence);

      // Step 4: Deterministic Scoring
      return this.calculateDeterministicScore(evaluatedReqs);
    } catch (e) {
      console.error("Failed to evaluate match via AI:", e);
      return this.fallbackAnalysis(jobDescription, baseCv);
    }
  }

  public async extractJobRequirements(jobDescription: string): Promise<JobRequirement[]> {
    if (!this.ai) return [];
    
    const prompt = \`Extract the requirements from this job description into a structured JSON array.
Each requirement must match this schema:
{
  "id": "unique-string",
  "text": "the requirement text",
  "category": "SKILL" | "EXPERIENCE" | "RESPONSIBILITY" | "EDUCATION" | "CERTIFICATION" | "LOCATION" | "OTHER",
  "importance": "REQUIRED" | "PREFERRED",
  "critical": boolean
}

Job Description:
\${jobDescription}\`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.1 }
    });
    
    let reqs = JSON.parse(response.text || "[]");
    if (!Array.isArray(reqs)) reqs = reqs.requirements || [];
    return reqs;
  }

  public async extractResumeEvidence(baseCv: string): Promise<ResumeEvidence> {
    if (!this.ai) return { skills: [], experience: '', education: '', certifications: [], industries: [], other: '' };
    
    const prompt = \`Extract the candidate's capabilities from this CV into this JSON schema:
{
  "skills": ["string"],
  "experience": "Detailed summary of years of experience and roles",
  "education": "Summary of degrees",
  "certifications": ["string"],
  "industries": ["string"],
  "other": "Any other relevant details"
}

CV:
\${baseCv}\`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.1 }
    });
    
    return JSON.parse(response.text || "{}");
  }

  public async semanticMatching(requirements: JobRequirement[], evidence: ResumeEvidence): Promise<EvaluatedRequirement[]> {
    if (!this.ai || requirements.length === 0) return [];
    
    const prompt = \`Evaluate if the candidate meets the following job requirements based ONLY on the provided evidence.
For each requirement, output a JSON object with matchLevel and evidence found.

Requirements:
\${JSON.stringify(requirements, null, 2)}

Candidate Evidence:
\${JSON.stringify(evidence, null, 2)}

Return a JSON array where each object matches:
{
  "id": "the requirement id",
  "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR",
  "evidence": "Quoted or summarized evidence from the candidate data, or explanation of missing"
}\`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.1 }
    });
    
    let matched = JSON.parse(response.text || "[]");
    if (!Array.isArray(matched)) matched = matched.matches || [];
    
    const evaluated: EvaluatedRequirement[] = requirements.map(req => {
      const match = matched.find((m: any) => m.id === req.id) || {};
      return {
        ...req,
        matchLevel: match.matchLevel || 'MISSING',
        evidence: match.evidence || 'No evidence provided'
      };
    });
    
    return evaluated;
  }

  private fallbackAnalysis(jobDescription: string, baseCv: string): JobMatchResult {
    return {
      analysisStatus: 'ANALYSIS_UNAVAILABLE',
      matchScore: null,
      confidenceScore: 0,
      matchExplanation: "Fallback analysis used due to missing API key or parsing error.",
      skillsMatch: "N/A",
      experienceMatch: "N/A",
      seniorityMatch: "N/A",
      industryMatch: "N/A",
      locationMatch: "N/A",
      educationMatch: "N/A",
      matchedSkills: [],
      missingRequiredSkills: [],
      missingNiceToHaveSkills: [],
      concerns: ["Used fallback deterministic analysis"],
      recommendation: 'LOW_PRIORITY',
      details: {}
    };
  }

  public calculateDeterministicScore(evaluatedReqs: EvaluatedRequirement[] | null): JobMatchResult {
    let analysisStatus: 'READY' | 'ANALYSIS_UNAVAILABLE' | 'ANALYSIS_FAILED' = 'READY';
    
    if (!evaluatedReqs || evaluatedReqs.length === 0) {
      return {
        analysisStatus: 'ANALYSIS_FAILED',
        matchScore: null,
        confidenceScore: 0,
        matchExplanation: "Failed to extract requirements.",
        skillsMatch: "N/A",
        experienceMatch: "N/A",
        seniorityMatch: "N/A",
        industryMatch: "N/A",
        locationMatch: "N/A",
        educationMatch: "N/A",
        matchedSkills: [],
        missingRequiredSkills: [],
        missingNiceToHaveSkills: [],
        concerns: ["Could not extract job requirements"],
        recommendation: 'SKIP',
        details: evaluatedReqs
      };
    }

    let totalEarned = 0;
    let totalPossible = 0;

    const weights = {
      SKILL: 5,
      EXPERIENCE: 10,
      RESPONSIBILITY: 5,
      EDUCATION: 10,
      CERTIFICATION: 10,
      LOCATION: 10,
      OTHER: 5
    };

    let missingCritical: string[] = [];
    let missingRequired: string[] = [];
    let missingNiceToHave: string[] = [];
    let matchedSkills: string[] = [];

    for (const req of evaluatedReqs) {
      const weight = weights[req.category] || 5;
      totalPossible += weight;

      if (req.matchLevel === 'MATCHED') {
        totalEarned += weight;
        if (req.category === 'SKILL') matchedSkills.push(req.text);
      } else if (req.matchLevel === 'UNCLEAR') {
        totalEarned += (weight * 0.4);
      }

      if (req.matchLevel === 'MISSING') {
        if (req.critical) missingCritical.push(req.text);
        if (req.importance === 'REQUIRED') missingRequired.push(req.text);
        if (req.importance === 'PREFERRED') missingNiceToHave.push(req.text);
      }
    }

    let score = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : null;
    let confidenceScore = 100; // Simplified for now, since we evaluated all extracted reqs

    let recommendation: JobRecommendation = 'APPLY';
    if (missingCritical.length > 0) {
      recommendation = 'SKIP';
    } else if (score !== null && score < 40) {
      recommendation = 'SKIP';
    } else if (score !== null && score < 65) {
      recommendation = 'LOW_PRIORITY';
    } else if (missingRequired.length > 0 || (score !== null && score < 85)) {
      recommendation = 'APPLY_WITH_CHANGES';
    }

    return {
      analysisStatus,
      matchScore: score,
      confidenceScore,
      matchExplanation: \`Match Score: \${score}/100. \${missingCritical.length > 0 ? 'Missing critical requirements.' : 'Good overall fit.'}\`,
      skillsMatch: \`\${matchedSkills.length} matched, \${missingRequired.length} required missing.\`,
      experienceMatch: "Check details",
      seniorityMatch: "Check details",
      industryMatch: "Check details",
      locationMatch: "Check details",
      educationMatch: "Check details",
      matchedSkills,
      missingRequiredSkills: missingRequired,
      missingNiceToHaveSkills: missingNiceToHave,
      concerns: missingCritical.length > 0 ? ['Missing critical requirements'] : [],
      recommendation,
      details: evaluatedReqs
    };
  }
}
`;

fs.writeFileSync('src/services/matchingService.ts', matchingServiceCode);
