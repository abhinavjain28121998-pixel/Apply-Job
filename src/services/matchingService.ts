import { GoogleGenAI } from '@google/genai';
import { 
  JobRecommendation, 
  JobRequirement, 
  ResumeEvidence, 
  WorkExperience,
  KeywordGapItem,
  ResumeRecommendationItem
} from '../types.js';

export interface EvaluatedRequirement extends JobRequirement {
  matchLevel: 'MATCHED' | 'MISSING' | 'UNCLEAR';
  evidence: string;
  requiredYears?: number | null;
  candidateYears?: number | null;
}

export interface JobMatchResult {
  analysisStatus: 'READY' | 'ANALYSIS_UNAVAILABLE' | 'ANALYSIS_FAILED';
  matchScore?: number | null;
  confidenceScore: number;
  confidenceLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
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
  keywordGaps?: KeywordGapItem[];
  resumeRecommendations?: ResumeRecommendationItem[];
  details: any;
}

const GEMINI_MODELS_CASCADE = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest'
];

export class MatchingService {
  private ai: GoogleGenAI | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.ai = new GoogleGenAI({ apiKey: key });
    }
  }

  private async generateWithCascade(prompt: string, config: any = {}): Promise<string> {
    if (!this.ai) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    let lastError: any = null;
    for (const model of GEMINI_MODELS_CASCADE) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await this.ai.models.generateContent({
            model,
            contents: prompt,
            config
          });
          if (response && response.text) {
            return response.text;
          }
        } catch (err: any) {
          lastError = err;
          const status = err?.status || err?.code;
          if (status === 404) break; // Deprecated or invalid model, skip directly
          if ((status === 503 || status === 429) && attempt === 0) {
            await new Promise(r => setTimeout(r, 400));
          }
        }
      }
    }

    throw lastError || new Error('Failed to generate response across Gemini models');
  }

  private parseJson<T>(rawText: string, fallback: T): T {
    if (!rawText) return fallback;
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    }
    try {
      return JSON.parse(cleaned);
    } catch {
      return fallback;
    }
  }

  public async evaluateMatch(jobDescription: string, baseCv: string): Promise<JobMatchResult> {
    if (!this.ai) {
      console.warn("GEMINI_API_KEY not found. Using fallback unavailable analysis.");
      return this.analysisUnavailable(jobDescription, baseCv);
    }

    try {
      const requirements = await this.extractJobRequirements(jobDescription);
      const evidence = await this.extractResumeEvidence(baseCv);
      const evaluatedReqs = await this.semanticMatching(requirements, evidence);
      return this.calculateDeterministicScore(evaluatedReqs, evidence);
    } catch (e) {
      console.error("Failed to evaluate match via AI:", e);
      return this.analysisFailed(jobDescription, baseCv);
    }
  }

  public async extractJobRequirements(jobDescription: string): Promise<JobRequirement[]> {
    if (!this.ai) return [];
    
    const prompt = `Extract the requirements from this job description into a structured JSON array.
Each requirement must match this schema:
{
  "id": "unique-string",
  "text": "the requirement text",
  "category": "SKILL" | "EXPERIENCE" | "SENIORITY" | "RESPONSIBILITY" | "INDUSTRY" | "EDUCATION" | "CERTIFICATION" | "LOCATION" | "OTHER",
  "importance": "REQUIRED" | "PREFERRED",
  "critical": boolean
}

Job Description:
${jobDescription}`;

    const responseText = await this.generateWithCascade(prompt, {
      responseMimeType: "application/json",
      temperature: 0.1
    });
    
    let reqs = [];
    try {
      let parsed = this.parseJson<any>(responseText, []);
      if (!Array.isArray(parsed)) parsed = parsed.requirements || [];
      
      const validCategories = ['SKILL', 'EXPERIENCE', 'SENIORITY', 'RESPONSIBILITY', 'INDUSTRY', 'EDUCATION', 'CERTIFICATION', 'LOCATION', 'OTHER'];
      const validImportance = ['REQUIRED', 'PREFERRED'];
      
      reqs = parsed.filter((r: any) => {
        if (!r.id || typeof r.id !== 'string') return false;
        if (!r.text || typeof r.text !== 'string') return false;
        if (!validCategories.includes(r.category)) return false;
        if (!validImportance.includes(r.importance)) return false;
        if (typeof r.critical !== 'boolean') return false;
        return true;
      });
    } catch (e) {
      console.error("Failed to parse or validate job requirements:", e);
      throw new Error("Invalid job requirements output");
    }
    return reqs as JobRequirement[];
  }

  public async extractResumeEvidence(baseCv: string): Promise<ResumeEvidence> {
    if (!this.ai) return { skills: [], experience: { totalYears: null, relevantYears: null, roles: [] }, education: '', certifications: [], industries: [], other: '' };
    
    const prompt = `Extract the candidate's capabilities from this CV into this JSON schema:
{
  "skills": ["string"],
  "experience": {
    "totalYears": number or null,
    "relevantYears": number or null,
    "roles": [
      {
        "company": "string",
        "title": "string",
        "startYear": number,
        "endYear": number or null,
        "description": "string",
        "skillsUsed": ["string"]
      }
    ]
  },
  "education": "Summary of degrees",
  "certifications": ["string"],
  "industries": ["string"],
  "other": "Any other relevant details"
}

CV:
${baseCv}`;

    let parsed: any = {};
    try {
      const responseText = await this.generateWithCascade(prompt, {
        responseMimeType: "application/json",
        temperature: 0.1
      });
      parsed = this.parseJson<any>(responseText, {});
    } catch (e) {
      console.error("Failed to parse resume evidence:", e);
    }
    
    return {
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experience: parsed.experience || { totalYears: null, relevantYears: null, roles: [] },
      education: typeof parsed.education === 'string' ? parsed.education : '',
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      industries: Array.isArray(parsed.industries) ? parsed.industries : [],
      other: typeof parsed.other === 'string' ? parsed.other : ''
    };
  }

  public async semanticMatching(requirements: JobRequirement[], evidence: ResumeEvidence): Promise<EvaluatedRequirement[]> {
    if (!this.ai || requirements.length === 0) return [];
    
    const prompt = `Evaluate if the candidate meets the following job requirements based ONLY on the provided evidence.
Use only: explicit evidence, recognized semantic/terminology equivalents, or UNCLEAR when evidence is insufficient.
Never infer an unstated qualification.

For each requirement, output a JSON object with matchLevel, evidence found, and if it's an EXPERIENCE requirement, try to extract requiredYears and candidateYears as numbers.

Requirements:
${JSON.stringify(requirements, null, 2)}

Candidate Evidence:
${JSON.stringify(evidence, null, 2)}

Return a JSON array where each object matches:
{
  "id": "the requirement id",
  "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR",
  "evidence": "Quoted or summarized evidence from the candidate data, or explanation of missing",
  "requiredYears": number or null,
  "candidateYears": number or null
}`;

    let matched = [];
    try {
      const responseText = await this.generateWithCascade(prompt, {
        responseMimeType: "application/json",
        temperature: 0.1
      });
      let parsed = this.parseJson<any>(responseText, []);
      if (!Array.isArray(parsed)) parsed = parsed.matches || [];
      matched = parsed;
    } catch (e) {
      console.error("Failed to parse semantic matching:", e);
      throw new Error("Invalid semantic matching output");
    }
    
    const evaluated: EvaluatedRequirement[] = requirements.map(req => {
      const match = matched.find((m: any) => m.id === req.id) || {};
      const validMatchLevels = ['MATCHED', 'MISSING', 'UNCLEAR'];
      const matchLevel = validMatchLevels.includes(match.matchLevel) ? match.matchLevel : 'MISSING';
      
      return {
        ...req,
        matchLevel,
        evidence: typeof match.evidence === 'string' ? match.evidence : 'No evidence provided',
        requiredYears: typeof match.requiredYears === 'number' ? match.requiredYears : null,
        candidateYears: typeof match.candidateYears === 'number' ? match.candidateYears : null
      };
    });
    
    return evaluated;
  }

  private analysisUnavailable(jobDescription: string, baseCv: string): JobMatchResult {
    return {
      analysisStatus: 'ANALYSIS_UNAVAILABLE',
      matchScore: null,
      confidenceScore: 0,
      confidenceLevel: 'LOW',
      matchExplanation: "Analysis is unavailable due to missing API configuration.",
      skillsMatch: "N/A",
      experienceMatch: "N/A",
      seniorityMatch: "N/A",
      industryMatch: "N/A",
      locationMatch: "N/A",
      educationMatch: "N/A",
      matchedSkills: [],
      missingRequiredSkills: [],
      missingNiceToHaveSkills: [],
      concerns: ["Analysis unavailable"],
      recommendation: 'UNAVAILABLE' as any,
      details: {}
    };
  }

  private analysisFailed(jobDescription: string, baseCv: string): JobMatchResult {
    return {
      analysisStatus: 'ANALYSIS_FAILED',
      matchScore: null,
      confidenceScore: 0,
      confidenceLevel: 'LOW',
      matchExplanation: "Analysis failed due to a processing error.",
      skillsMatch: "N/A",
      experienceMatch: "N/A",
      seniorityMatch: "N/A",
      industryMatch: "N/A",
      locationMatch: "N/A",
      educationMatch: "N/A",
      matchedSkills: [],
      missingRequiredSkills: [],
      missingNiceToHaveSkills: [],
      concerns: ["Analysis failed"],
      recommendation: 'UNAVAILABLE' as any,
      details: {}
    };
  }

  public calculateDeterministicScore(evaluatedReqs: EvaluatedRequirement[] | null, evidence?: ResumeEvidence): JobMatchResult {
    let analysisStatus: 'READY' | 'ANALYSIS_UNAVAILABLE' | 'ANALYSIS_FAILED' = 'READY';
    
    if (!evaluatedReqs || evaluatedReqs.length === 0) {
      return this.analysisFailed("", "");
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
    
    let unclearCount = 0;
    let evidenceAvailableCount = 0;

    // Weight allocation across 7 canonical dimensions:
    // Skills (30%), Experience (20%), Responsibilities (15%), Seniority (10%), Industry (10%), Education/Certs (5%), Keyword Coverage (10%)
    const dimensionWeights: Record<string, number> = {
      SKILL: 30,
      EXPERIENCE: 20,
      RESPONSIBILITY: 15,
      SENIORITY: 10,
      INDUSTRY: 10,
      EDUCATION: 5,
      CERTIFICATION: 5,
      LOCATION: 5,
      OTHER: 5
    };

    const keywordGaps: KeywordGapItem[] = [];
    const resumeRecommendations: ResumeRecommendationItem[] = [];

    for (const req of evaluatedReqs) {
      const weight = dimensionWeights[req.category] || 5;
      totalPossible += weight;
      
      let reqEarned = 0;

      // Override matchLevel based on numeric experience if available
      let effectiveMatchLevel = req.matchLevel;
      if (req.category === 'EXPERIENCE' && typeof req.requiredYears === 'number') {
        const candidateYears = typeof req.candidateYears === 'number' ? req.candidateYears : (evidence?.experience?.totalYears || 0);
        if (candidateYears >= req.requiredYears) {
          effectiveMatchLevel = 'MATCHED';
        } else if (candidateYears > 0 && candidateYears >= (req.requiredYears * 0.5)) {
          effectiveMatchLevel = 'UNCLEAR'; // Partial match
        } else if (candidateYears === 0 && req.matchLevel === 'UNCLEAR') {
          effectiveMatchLevel = 'UNCLEAR';
        } else {
          effectiveMatchLevel = 'MISSING';
        }
      }

      const isFound = effectiveMatchLevel === 'MATCHED';
      const gapImportance: KeywordGapItem['importance'] = req.critical ? 'REQUIRED' : req.importance === 'REQUIRED' ? 'REQUIRED' : 'PREFERRED';

      let gapRec = '';
      if (isFound) {
        gapRec = `Prominently showcase your verified experience in "${req.text}" in your application bullets and executive summary.`;
      } else if (effectiveMatchLevel === 'UNCLEAR') {
        gapRec = `Explicitly clarify and quantify your exposure to "${req.text}" using truthful metrics from past projects.`;
      } else {
        gapRec = `Highlight adjacent or transferable capabilities related to "${req.text}" without fabricating unearned credentials.`;
      }

      keywordGaps.push({
        keyword: req.text,
        importance: gapImportance,
        foundInResume: isFound,
        evidence: req.evidence,
        recommendation: gapRec
      });

      if (effectiveMatchLevel === 'MATCHED') {
        reqEarned = weight;
        evidenceAvailableCount++;
        if (req.category === 'SKILL') {
          matchedSkills.push(req.text);
          if (resumeRecommendations.length < 5) {
            resumeRecommendations.push({
              category: 'SKILLS_TO_EMPHASIZE',
              headline: `Emphasize Verified Skill: ${req.text}`,
              suggestion: `Make ${req.text} prominent in the core competencies section of your tailored CV.`,
              groundingEvidence: req.evidence
            });
          }
        }
      } else if (effectiveMatchLevel === 'UNCLEAR') {
        if (req.category === 'EXPERIENCE' && typeof req.requiredYears === 'number') {
          const candidateYears = typeof req.candidateYears === 'number' ? req.candidateYears : (evidence?.experience?.totalYears || 0);
          if (candidateYears > 0) {
            reqEarned = weight * (candidateYears / req.requiredYears);
          } else {
            reqEarned = (weight * 0.4);
          }
        } else {
          reqEarned = (weight * 0.4);
        }
        unclearCount++;

        if (resumeRecommendations.length < 6) {
          resumeRecommendations.push({
            category: 'ACHIEVEMENTS_TO_REPHRASE',
            headline: `Clarify Experience for ${req.text}`,
            suggestion: `Rephrase existing bullets to explicitly connect your accomplishments with the requirements for ${req.text}.`,
            groundingEvidence: req.evidence
          });
        }
      } else if (effectiveMatchLevel === 'MISSING') {
        if (req.critical) missingCritical.push(req.text);
        if (req.importance === 'REQUIRED') missingRequired.push(req.text);
        if (req.importance === 'PREFERRED') missingNiceToHave.push(req.text);

        if (req.importance === 'REQUIRED' && resumeRecommendations.length < 6) {
          resumeRecommendations.push({
            category: 'KEYWORDS_TO_ADD',
            headline: `Address Target Requirement: ${req.text}`,
            suggestion: `If you have truthful exposure to ${req.text} from past projects or coursework, mention it in your summary or project details.`,
            groundingEvidence: 'Missing from uploaded base CV'
          });
        }
      }
      
      totalEarned += reqEarned;
    }

    // Add high-level summary recommendation
    if (matchedSkills.length > 0) {
      resumeRecommendations.unshift({
        category: 'SUMMARY_IMPROVEMENT',
        headline: 'Lead with Core Strengths',
        suggestion: `Frame your professional summary around your validated expertise in ${matchedSkills.slice(0, 3).join(', ')}.`,
        groundingEvidence: `Truthfully documented in CV skills`
      });
    }

    let score = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : null;
    
    // Confidence score calculation
    let confidenceScore = 100;
    if (evaluatedReqs.length === 0) {
      confidenceScore = 0;
    } else {
      let penalty = 0;
      if (evaluatedReqs.length < 3) penalty += 20; // Too few requirements extracted
      penalty += (unclearCount / evaluatedReqs.length) * 50; // Penalty for unclear matches
      
      // If evidence is completely empty
      if (!evidence || (!evidence.experience.totalYears && evidence.skills.length === 0 && evidence.education === '')) {
        penalty += 40;
      }
      
      confidenceScore = Math.max(0, Math.round(100 - penalty));
    }
    
    let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
    if (confidenceScore < 50) confidenceLevel = 'LOW';
    else if (confidenceScore < 80) confidenceLevel = 'MEDIUM';

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

    let explanation = `Match Score: ${score !== null ? score : 'N/A'}/100. `;
    if (score !== null) {
      if (score >= 90) explanation += 'Excellent match.';
      else if (score >= 80) explanation += 'Strong match.';
      else if (score >= 65) explanation += 'Good match.';
      else if (score >= 50) explanation += 'Partial match.';
      else explanation += 'Weak match.';
    }
    if (missingCritical.length > 0) explanation += ' Missing critical requirements.';

    return {
      analysisStatus,
      matchScore: score,
      confidenceScore,
      confidenceLevel,
      matchExplanation: explanation,
      skillsMatch: `${matchedSkills.length} matched, ${missingRequired.length} required missing.`,
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
      keywordGaps,
      resumeRecommendations,
      details: evaluatedReqs
    };
  }
}
