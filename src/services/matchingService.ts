import { GoogleGenAI } from "@google/genai";
import { Job } from '../types.js';

export interface MatchEvidence {
  requirement: string;
  matchLevel: 'MATCHED' | 'MISSING' | 'UNCLEAR';
  evidence: string;
}

export interface SkillMatch extends MatchEvidence {
  importance: 'REQUIRED' | 'PREFERRED';
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
  recommendation: 'APPLY' | 'APPLY_WITH_CHANGES' | 'LOW_PRIORITY' | 'SKIP';
  
  // Detailed evidence for deterministic scoring
  details: {
    skills: SkillMatch[];
    experience: MatchEvidence;
    seniority: MatchEvidence;
    responsibilities: MatchEvidence[];
    industry: MatchEvidence;
    education: MatchEvidence;
    location: MatchEvidence;
    otherFit: MatchEvidence;
  };
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
  private ai: GoogleGenAI;

  constructor(apiKey?: string) {
    this.ai = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY });
  }

  public async evaluateMatch(jobDescription: string, baseCv: string): Promise<JobMatchResult> {
    const prompt = `You are an expert technical recruiter and career coach.
Analyze the following job description against the provided CV.
Extract the match evaluation into a precise JSON structure.

Rules for evaluation:
- Never infer a missing qualification as a match. If it's not explicitly in the CV or strongly implied by standard role definitions, mark it as MISSING or UNCLEAR.
- Distinguish strictly between 'MATCHED', 'MISSING', and 'UNCLEAR'.
- Required skills are those explicitly stated as must-haves. Preferred are nice-to-haves.
- Experience matching must consider *relevant* experience in the specific domain/skills requested, not simply total career duration.
- Provide a brief 'evidence' string for each evaluated point (e.g., "CV mentions 4 years of React experience").

Return a JSON object matching this schema exactly:
{
  "skills": [
    { "requirement": "string", "importance": "REQUIRED" | "PREFERRED", "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" }
  ],
  "experience": { "requirement": "string", "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" },
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
${jobDescription}

My CV:
${baseCv}`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const text = response.text || "{}";
    let extracted;
    try {
      extracted = JSON.parse(text);
    } catch (e) {
      throw new Error("Failed to parse AI evaluation");
    }

    return this.calculateDeterministicScore(extracted);
  }

  private calculateDeterministicScore(evaluation: any): JobMatchResult {
    let score = 0;
    
    const calculateCategoryScore = (evidence: MatchEvidence | undefined, weight: number): number => {
      if (!evidence) return 0;
      if (evidence.matchLevel === 'MATCHED') return weight;
      if (evidence.matchLevel === 'UNCLEAR') return weight * 0.4;
      return 0;
    };

    // Skills (35)
    let skillsScore = 0;
    const skills = evaluation.skills || [];
    if (skills.length > 0) {
      const requiredSkills = skills.filter((s: any) => s.importance === 'REQUIRED');
      const preferredSkills = skills.filter((s: any) => s.importance === 'PREFERRED');
      
      let reqScore = 0;
      if (requiredSkills.length > 0) {
        const matchedReq = requiredSkills.filter((s: any) => s.matchLevel === 'MATCHED').length;
        const unclearReq = requiredSkills.filter((s: any) => s.matchLevel === 'UNCLEAR').length;
        // Required skills contribute 80% of the skills score
        reqScore = ((matchedReq + unclearReq * 0.4) / requiredSkills.length) * (SCORING_WEIGHTS.skills * 0.8);
      } else {
        reqScore = SCORING_WEIGHTS.skills * 0.8;
      }

      let prefScore = 0;
      if (preferredSkills.length > 0) {
        const matchedPref = preferredSkills.filter((s: any) => s.matchLevel === 'MATCHED').length;
        const unclearPref = preferredSkills.filter((s: any) => s.matchLevel === 'UNCLEAR').length;
        // Preferred skills contribute 20%
        prefScore = ((matchedPref + unclearPref * 0.4) / preferredSkills.length) * (SCORING_WEIGHTS.skills * 0.2);
      } else {
        prefScore = SCORING_WEIGHTS.skills * 0.2;
      }
      
      skillsScore = reqScore + prefScore;
    } else {
      skillsScore = SCORING_WEIGHTS.skills;
    }
    score += skillsScore;

    score += calculateCategoryScore(evaluation.experience, SCORING_WEIGHTS.experience);
    score += calculateCategoryScore(evaluation.seniority, SCORING_WEIGHTS.seniority);
    
    // Responsibilities (10)
    let respScore = 0;
    const responsibilities = evaluation.responsibilities || [];
    if (responsibilities.length > 0) {
      const matched = responsibilities.filter((r: any) => r.matchLevel === 'MATCHED').length;
      const unclear = responsibilities.filter((r: any) => r.matchLevel === 'UNCLEAR').length;
      respScore = ((matched + unclear * 0.4) / responsibilities.length) * SCORING_WEIGHTS.responsibilities;
    } else {
      respScore = SCORING_WEIGHTS.responsibilities;
    }
    score += respScore;

    score += calculateCategoryScore(evaluation.industry, SCORING_WEIGHTS.industry);
    score += calculateCategoryScore(evaluation.education, SCORING_WEIGHTS.education);
    score += calculateCategoryScore(evaluation.location, SCORING_WEIGHTS.location);
    score += calculateCategoryScore(evaluation.otherFit, SCORING_WEIGHTS.otherFit);

    score = Math.round(score);

    const missingRequired = (evaluation.skills || []).filter((s: any) => s.importance === 'REQUIRED' && s.matchLevel === 'MISSING').map((s: any) => s.requirement);
    
    let recommendation: 'APPLY' | 'APPLY_WITH_CHANGES' | 'LOW_PRIORITY' | 'SKIP' = 'APPLY';
    if (score < 40 || missingRequired.length > 0) {
      recommendation = 'SKIP';
    } else if (score < 65) {
      recommendation = 'LOW_PRIORITY';
    } else if (score < 85 || (evaluation.skills || []).some((s: any) => s.matchLevel === 'UNCLEAR')) {
      recommendation = 'APPLY_WITH_CHANGES';
    }

    const matchedSkills = (evaluation.skills || []).filter((s: any) => s.matchLevel === 'MATCHED').map((s: any) => s.requirement);
    const missingNiceToHave = (evaluation.skills || []).filter((s: any) => s.importance === 'PREFERRED' && s.matchLevel === 'MISSING').map((s: any) => s.requirement);

    return {
      matchScore: score,
      matchExplanation: `Match Score: ${score}/100. ${missingRequired.length > 0 ? 'Missing critical requirements.' : 'Good overall fit.'}`,
      skillsMatch: `${matchedSkills.length} matched, ${missingRequired.length} required missing.`,
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
