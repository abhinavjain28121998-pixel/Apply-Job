import fs from 'fs';
let content = fs.readFileSync('src/services/matchingService.ts', 'utf8');

// 1. Update MatchEvidence interface to include critical
content = content.replace(
  /export interface MatchEvidence \{/g,
  `export interface MatchEvidence {\n  critical?: boolean;`
);

// Remove critical from SkillMatch since it's now in MatchEvidence
content = content.replace(
  /export interface SkillMatch extends MatchEvidence \{\n  importance: 'REQUIRED' | 'PREFERRED';\n  critical\?: boolean;\n\}/g,
  `export interface SkillMatch extends MatchEvidence {\n  importance: 'REQUIRED' | 'PREFERRED';\n}`
);

// 2. Update JobMatchResult to include analysisStatus
content = content.replace(
  /export interface JobMatchResult \{/g,
  `export interface JobMatchResult {\n  analysisStatus: 'READY' | 'ANALYSIS_UNAVAILABLE' | 'ANALYSIS_FAILED';`
);

// 3. Update the prompt to ask for critical on ALL categories
content = content.replace(
  /\{\n  "skills": \[\n    \{ "requirement": "string", "importance": "REQUIRED" \| "PREFERRED", "critical": boolean, "matchLevel": "MATCHED" \| "MISSING" \| "UNCLEAR", "evidence": "string" \}\n  \],\n  "experience": \{ "requirement": "string", "matchLevel": "MATCHED" \| "MISSING" \| "UNCLEAR", "evidence": "string", "requiredYears": number \| null, "candidateYears": number \| null \},\n  "seniority": \{ "requirement": "string", "matchLevel": "MATCHED" \| "MISSING" \| "UNCLEAR", "evidence": "string" \},\n  "responsibilities": \[\n    \{ "requirement": "string", "matchLevel": "MATCHED" \| "MISSING" \| "UNCLEAR", "evidence": "string" \}\n  \],\n  "industry": \{ "requirement": "string", "matchLevel": "MATCHED" \| "MISSING" \| "UNCLEAR", "evidence": "string" \},\n  "education": \{ "requirement": "string", "matchLevel": "MATCHED" \| "MISSING" \| "UNCLEAR", "evidence": "string" \},\n  "location": \{ "requirement": "string", "matchLevel": "MATCHED" \| "MISSING" \| "UNCLEAR", "evidence": "string" \},\n  "otherFit": \{ "requirement": "string", "matchLevel": "MATCHED" \| "MISSING" \| "UNCLEAR", "evidence": "string" \},\n  "concerns": \\["string"\\]\n\}/g,
  `{
  "skills": [
    { "requirement": "string", "importance": "REQUIRED" | "PREFERRED", "critical": boolean, "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" }
  ],
  "experience": { "requirement": "string", "critical": boolean, "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string", "requiredYears": number | null, "candidateYears": number | null },
  "seniority": { "requirement": "string", "critical": boolean, "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" },
  "responsibilities": [
    { "requirement": "string", "critical": boolean, "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" }
  ],
  "industry": { "requirement": "string", "critical": boolean, "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" },
  "education": { "requirement": "string", "critical": boolean, "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" },
  "location": { "requirement": "string", "critical": boolean, "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" },
  "otherFit": { "requirement": "string", "critical": boolean, "matchLevel": "MATCHED" | "MISSING" | "UNCLEAR", "evidence": "string" },
  "concerns": ["string"]
}`
);

// 4. Fallback analysis status
content = content.replace(
  /private fallbackAnalysis\(jobDescription: string, baseCv: string\): JobMatchResult \{\n    return \{\n      matchScore: 50,/g,
  `private fallbackAnalysis(jobDescription: string, baseCv: string): JobMatchResult {\n    return {\n      analysisStatus: 'ANALYSIS_UNAVAILABLE',\n      matchScore: 0,`
);

// 5. Update calculateDeterministicScore
content = content.replace(
  /public calculateDeterministicScore\(evaluation: any\): JobMatchResult \{/g,
  `public calculateDeterministicScore(evaluation: any): JobMatchResult {
    let analysisStatus: 'READY' | 'ANALYSIS_UNAVAILABLE' | 'ANALYSIS_FAILED' = 'READY';
    if (!evaluation || Object.keys(evaluation).length === 0) {
      analysisStatus = 'ANALYSIS_FAILED';
    }`
);

// Missing critical calculation
content = content.replace(
  /const missingCritical = \(evaluation\.skills \|\| \[\]\)\.filter\(\(s: any\) => s\.importance === 'REQUIRED' && s\.critical === true && s\.matchLevel === 'MISSING'\)\.map\(\(s: any\) => s\.requirement\);/g,
  `const missingCritical = [];
    if (evaluation.skills) missingCritical.push(...evaluation.skills.filter((s: any) => s.critical === true && s.matchLevel === 'MISSING').map((s: any) => s.requirement));
    if (evaluation.experience?.critical === true && evaluation.experience?.matchLevel === 'MISSING') missingCritical.push(evaluation.experience.requirement);
    if (evaluation.seniority?.critical === true && evaluation.seniority?.matchLevel === 'MISSING') missingCritical.push(evaluation.seniority.requirement);
    if (evaluation.responsibilities) missingCritical.push(...evaluation.responsibilities.filter((s: any) => s.critical === true && s.matchLevel === 'MISSING').map((s: any) => s.requirement));
    if (evaluation.industry?.critical === true && evaluation.industry?.matchLevel === 'MISSING') missingCritical.push(evaluation.industry.requirement);
    if (evaluation.education?.critical === true && evaluation.education?.matchLevel === 'MISSING') missingCritical.push(evaluation.education.requirement);
    if (evaluation.location?.critical === true && evaluation.location?.matchLevel === 'MISSING') missingCritical.push(evaluation.location.requirement);
    if (evaluation.otherFit?.critical === true && evaluation.otherFit?.matchLevel === 'MISSING') missingCritical.push(evaluation.otherFit.requirement);`
);

content = content.replace(
  /return \{\n      matchScore: score,\n      confidenceScore,/g,
  `return {\n      analysisStatus,\n      matchScore: score,\n      confidenceScore,`
);

fs.writeFileSync('src/services/matchingService.ts', content);
