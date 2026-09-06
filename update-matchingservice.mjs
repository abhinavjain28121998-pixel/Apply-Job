import fs from 'fs';

const content = `import { GoogleGenAI } from '@google/genai';
import { JobRecommendation } from '../types.js';

export interface MatchEvidence {
  requirement: string;
  matchLevel: 'MATCHED' | 'MISSING' | 'UNCLEAR';
  evidence: string;
}

export interface SkillMatch extends MatchEvidence {
  importance: 'REQUIRED' | 'PREFERRED';
  critical?: boolean;
}

export interface ExperienceEvidence extends MatchEvidence {
  requiredYears: number | null;
  candidateYears: number | null;
}

export interface JobMatchResult {
  matchScore: number;
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

const SCORING_WEIGHTS = {
  skills: 35,
  experience: 20,
  seniority: 15,
  responsibilities: 10,
  industry: 5,
  education: 5,
  location: 5,
  otherFit: 5
};

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

    const prompt = \`You are an expert technical recruiter and career coach.
Analyze the following job description against the provided CV.
Extract the match evaluation into a precise JSON structure.

Rules for evaluation:
- Never infer a missing qualification as a match. If it's not explicitly in the CV or strongly implied, mark it as MISSING or UNCLEAR.
- For experience, try to extract the required years and candidate's relevant years numerically.
- Required skills are those explicitly stated as must-haves. Critical ones are absolute deal-breakers.

Return a JSON object matching this schema exactly:
{
  "skills": [
    { "requirement": "string", "importance": "REQUIRED" | "PREFERRED", "critical": boolean, "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" }
  ],
  "experience": { "requirement": "string", "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string", "requiredYears": number | null, "candidateYears": number | null },
  "seniority": { "requirement": "string", "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" },
  "responsibilities": [
    { "requirement": "string", "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" }
  ],
  "industry": { "requirement": "string", "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" },
  "education": { "requirement": "string", "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" },
  "location": { "requirement": "string", "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" },
  "otherFit": { "requirement": "string", "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" },
  "concerns": ["string"]
}

Job Description:
\${jobDescription}

My CV:
\${baseCv}\`;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });
      const text = response.text || "{}";
      const extracted = this.validateAndParse(text);
      return this.calculateDeterministicScore(extracted);
    } catch (e) {
      console.error("Failed to evaluate match via AI:", e);
      return this.fallbackAnalysis(jobDescription, baseCv);
    }
  }

  private validateAndParse(text: string): any {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("Invalid JSON from AI");
    }
    
    // Strict runtime validation
    if (!data || typeof data !== 'object') throw new Error("Parsed data is not an object");
    
    return {
      skills: Array.isArray(data.skills) ? data.skills : [],
      experience: typeof data.experience === 'object' ? data.experience : null,
      seniority: typeof data.seniority === 'object' ? data.seniority : null,
      responsibilities: Array.isArray(data.responsibilities) ? data.responsibilities : [],
      industry: typeof data.industry === 'object' ? data.industry : null,
      education: typeof data.education === 'object' ? data.education : null,
      location: typeof data.location === 'object' ? data.location : null,
      otherFit: typeof data.otherFit === 'object' ? data.otherFit : null,
      concerns: Array.isArray(data.concerns) ? data.concerns : []
    };
  }

  private fallbackAnalysis(jobDescription: string, baseCv: string): JobMatchResult {
    // Basic fallback matching
    const score = 50;
    return {
      matchScore: score,
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

  public calculateDeterministicScore(evaluation: any): JobMatchResult {
    let totalEarned = 0;
    let totalPossible = 0;

    const calculateCategoryScore = (evidence: MatchEvidence | null, weight: number): number => {
      if (!evidence || !evidence.requirement) return 0; // If missing, we don't count it in possible points (normalize)
      totalPossible += weight;
      if (evidence.matchLevel === 'MATCHED') return weight;
      if (evidence.matchLevel === 'UNCLEAR') return weight * 0.4;
      return 0;
    };

    // Skills
    const skills = evaluation.skills || [];
    if (skills.length > 0) {
      totalPossible += SCORING_WEIGHTS.skills;
      const requiredSkills = skills.filter((s: any) => s.importance === 'REQUIRED');
      const preferredSkills = skills.filter((s: any) => s.importance === 'PREFERRED');
      
      let reqScore = 0;
      if (requiredSkills.length > 0) {
        const matchedReq = requiredSkills.filter((s: any) => s.matchLevel === 'MATCHED').length;
        const unclearReq = requiredSkills.filter((s: any) => s.matchLevel === 'UNCLEAR').length;
        reqScore = ((matchedReq + unclearReq * 0.4) / requiredSkills.length) * (SCORING_WEIGHTS.skills * 0.8);
      } else {
        reqScore = SCORING_WEIGHTS.skills * 0.8;
      }

      let prefScore = 0;
      if (preferredSkills.length > 0) {
        const matchedPref = preferredSkills.filter((s: any) => s.matchLevel === 'MATCHED').length;
        const unclearPref = preferredSkills.filter((s: any) => s.matchLevel === 'UNCLEAR').length;
        prefScore = ((matchedPref + unclearPref * 0.4) / preferredSkills.length) * (SCORING_WEIGHTS.skills * 0.2);
      } else {
        prefScore = SCORING_WEIGHTS.skills * 0.2;
      }
      totalEarned += (reqScore + prefScore);
    }

    // Experience (handle numerical if available)
    if (evaluation.experience && evaluation.experience.requirement) {
      totalPossible += SCORING_WEIGHTS.experience;
      const exp = evaluation.experience as ExperienceEvidence;
      if (typeof exp.requiredYears === 'number' && typeof exp.candidateYears === 'number' && exp.requiredYears > 0) {
        const ratio = Math.min(exp.candidateYears / exp.requiredYears, 1.0);
        // If they have 0 years and 5 required, ratio is 0. If 4 and 5 required, ratio is 0.8
        totalEarned += (ratio * SCORING_WEIGHTS.experience);
      } else {
        if (exp.matchLevel === 'MATCHED') totalEarned += SCORING_WEIGHTS.experience;
        else if (exp.matchLevel === 'UNCLEAR') totalEarned += (SCORING_WEIGHTS.experience * 0.4);
      }
    }

    totalEarned += calculateCategoryScore(evaluation.seniority, SCORING_WEIGHTS.seniority);

    // Responsibilities
    const responsibilities = evaluation.responsibilities || [];
    if (responsibilities.length > 0) {
      totalPossible += SCORING_WEIGHTS.responsibilities;
      const matched = responsibilities.filter((r: any) => r.matchLevel === 'MATCHED').length;
      const unclear = responsibilities.filter((r: any) => r.matchLevel === 'UNCLEAR').length;
      totalEarned += ((matched + unclear * 0.4) / responsibilities.length) * SCORING_WEIGHTS.responsibilities;
    }

    totalEarned += calculateCategoryScore(evaluation.industry, SCORING_WEIGHTS.industry);
    totalEarned += calculateCategoryScore(evaluation.education, SCORING_WEIGHTS.education);
    totalEarned += calculateCategoryScore(evaluation.location, SCORING_WEIGHTS.location);
    totalEarned += calculateCategoryScore(evaluation.otherFit, SCORING_WEIGHTS.otherFit);

    // Normalize score to 100
    let score = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

    const missingRequired = (evaluation.skills || []).filter((s: any) => s.importance === 'REQUIRED' && s.matchLevel === 'MISSING').map((s: any) => s.requirement);
    const missingCritical = (evaluation.skills || []).filter((s: any) => s.importance === 'REQUIRED' && s.critical === true && s.matchLevel === 'MISSING').map((s: any) => s.requirement);

    let recommendation: JobRecommendation = 'APPLY';
    if (score < 40 || missingCritical.length > 0) {
      recommendation = 'SKIP';
    } else if (score < 65) {
      recommendation = 'LOW_PRIORITY';
    } else if (score < 85 || (evaluation.skills || []).some((s: any) => s.matchLevel === 'UNCLEAR') || missingRequired.length > 0) {
      // Missing non-critical required skills puts it at APPLY_WITH_CHANGES
      recommendation = 'APPLY_WITH_CHANGES';
    }

    const matchedSkills = (evaluation.skills || []).filter((s: any) => s.matchLevel === 'MATCHED').map((s: any) => s.requirement);
    const missingNiceToHave = (evaluation.skills || []).filter((s: any) => s.importance === 'PREFERRED' && s.matchLevel === 'MISSING').map((s: any) => s.requirement);

    return {
      matchScore: score,
      matchExplanation: \`Match Score: \${score}/100. \${missingCritical.length > 0 ? 'Missing critical requirements.' : 'Good overall fit.'}\`,
      skillsMatch: \`\${matchedSkills.length} matched, \${missingRequired.length} required missing.\`,
      experienceMatch: evaluation.experience?.evidence || 'N/A',
      seniorityMatch: evaluation.seniority?.evidence || 'N/A',
      industryMatch: evaluation.industry?.evidence || 'N/A',
      locationMatch: evaluation.location?.evidence || 'N/A',
      educationMatch: evaluation.education?.evidence || 'N/A',
      matchedSkills,
      missingRequiredSkills: missingRequired,
      missingNiceToHaveSkills: missingNiceToHave,
      concerns: evaluation.concerns || [],
      recommendation,
      details: evaluation
    };
  }
}
`;

fs.writeFileSync('src/services/matchingService.ts', content);
