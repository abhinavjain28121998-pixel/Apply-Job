import fs from 'fs';
let content = fs.readFileSync('src/services/matchingService.ts', 'utf8');

// The new logic for calculateDeterministicScore
const newLogic = `
  public calculateDeterministicScore(evaluatedReqs: EvaluatedRequirement[] | null, evidence?: ResumeEvidence): JobMatchResult {
    let analysisStatus: 'READY' | 'ANALYSIS_UNAVAILABLE' | 'ANALYSIS_FAILED' = 'READY';
    
    if (!evaluatedReqs || evaluatedReqs.length === 0) {
      return this.analysisFailed("", "");
    }

    const categoryMaxWeights: Record<string, number> = {
      SKILL: 35,
      EXPERIENCE: 20,
      SENIORITY: 15,
      RESPONSIBILITY: 10,
      INDUSTRY: 5,
      EDUCATION: 5,
      CERTIFICATION: 5,
      LOCATION: 5,
      OTHER: 0
    };

    let missingCritical: string[] = [];
    let missingRequired: string[] = [];
    let missingNiceToHave: string[] = [];
    let matchedSkills: string[] = [];
    
    let unclearCount = 0;
    let evidenceAvailableCount = 0;

    // Group requirements by category
    const categoryReqs: Record<string, EvaluatedRequirement[]> = {};
    for (const req of evaluatedReqs) {
      if (!categoryReqs[req.category]) categoryReqs[req.category] = [];
      categoryReqs[req.category].push(req);
    }

    let totalEarned = 0;
    let totalPossible = 0;

    for (const [category, reqs] of Object.entries(categoryReqs)) {
      let maxWeight = categoryMaxWeights[category] || 0;
      // Cap OTHER to 5 if there are OTHER reqs but no maxWeight defined, though we defined it to 0 initially.
      // Wait, instruction says: OTHER = 5 total. Let's fix OTHER to 5.
      if (category === 'OTHER') maxWeight = 5;

      if (maxWeight === 0) continue; 
      
      totalPossible += maxWeight;
      
      const reqWeight = maxWeight / reqs.length;
      let categoryEarned = 0;

      for (const req of reqs) {
        let reqEarned = 0;

        let effectiveMatchLevel = req.matchLevel;
        if (req.category === 'EXPERIENCE' && typeof req.requiredYears === 'number') {
          const candidateYears = typeof req.candidateYears === 'number' ? req.candidateYears : (evidence?.experience?.totalYears || 0);
          if (candidateYears >= req.requiredYears) {
            effectiveMatchLevel = 'MATCHED';
          } else if (candidateYears > 0 && candidateYears >= (req.requiredYears * 0.5)) {
            effectiveMatchLevel = 'UNCLEAR';
          } else if (candidateYears === 0 && req.matchLevel === 'UNCLEAR') {
            effectiveMatchLevel = 'UNCLEAR';
          } else {
            effectiveMatchLevel = 'MISSING';
          }
        }

        if (effectiveMatchLevel === 'MATCHED') {
          reqEarned = reqWeight;
          evidenceAvailableCount++;
          if (req.category === 'SKILL') matchedSkills.push(req.text);
        } else if (effectiveMatchLevel === 'UNCLEAR') {
          if (req.category === 'EXPERIENCE' && typeof req.requiredYears === 'number') {
            const candidateYears = typeof req.candidateYears === 'number' ? req.candidateYears : (evidence?.experience?.totalYears || 0);
            if (candidateYears > 0) {
              reqEarned = reqWeight * (candidateYears / req.requiredYears);
            } else {
              reqEarned = reqWeight * 0.4;
            }
          } else {
            reqEarned = reqWeight * 0.4;
          }
          unclearCount++;
        } else if (effectiveMatchLevel === 'MISSING') {
          if (req.category === 'EXPERIENCE' && typeof req.requiredYears === 'number') {
            const candidateYears = typeof req.candidateYears === 'number' ? req.candidateYears : (evidence?.experience?.totalYears || 0);
            if (candidateYears > 0) {
              reqEarned = reqWeight * (candidateYears / req.requiredYears);
            }
          }
          if (req.critical) missingCritical.push(req.text);
          if (req.importance === 'REQUIRED') missingRequired.push(req.text);
          if (req.importance === 'PREFERRED') missingNiceToHave.push(req.text);
        }
        categoryEarned += reqEarned;
      }
      totalEarned += categoryEarned;
    }

    let score = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : null;
    
    // Confidence score calculation
    let confidenceScore = 100;
    if (evaluatedReqs.length === 0) {
      confidenceScore = 0;
    } else {
      let penalty = 0;
      if (evaluatedReqs.length < 3) penalty += 20;
      penalty += (unclearCount / evaluatedReqs.length) * 50;
      
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

    let explanation = \`Match Score: \${score !== null ? score : 'N/A'}/100. \`;
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
      skillsMatch: \`\${matchedSkills.length} matched, \${missingRequired.length} required missing.\`,
      experienceMatch: "Check details",
      seniorityMatch: "Check details",
      industryMatch: "Check details",
      locationMatch: "Check details",
      educationMatch: "Check details",
      matchedSkills,
      missingRequiredSkills: missingRequired,
      missingNiceToHaveSkills: missingNiceToHave,
      concerns: missingCritical,
      recommendation,
      details: evaluatedReqs
    };
  }

  private analysisUnavailable(jobDescription: string, baseCv: string): JobMatchResult {
`;

// Extract calculateDeterministicScore until analysisUnavailable
content = content.replace(/public calculateDeterministicScore[\s\S]*?private analysisUnavailable\(jobDescription: string, baseCv: string\): JobMatchResult \{/, newLogic);

content = content.replace(
  /private analysisUnavailable\(jobDescription: string, baseCv: string\): JobMatchResult \{\n\s*return \{\n\s*analysisStatus: 'ANALYSIS_UNAVAILABLE',\n\s*matchScore: null,\n\s*confidenceScore: 0,\n\s*matchExplanation: "AI analysis is currently unavailable\.",\n\s*skillsMatch: "",\n\s*experienceMatch: "",\n\s*seniorityMatch: "",\n\s*industryMatch: "",\n\s*locationMatch: "",\n\s*educationMatch: "",\n\s*matchedSkills: \[\],\n\s*missingRequiredSkills: \[\],\n\s*missingNiceToHaveSkills: \[\],\n\s*concerns: \[\],\n\s*recommendation: 'LOW_PRIORITY',/,
  `private analysisUnavailable(jobDescription: string, baseCv: string): JobMatchResult {\n    return {\n      analysisStatus: 'ANALYSIS_UNAVAILABLE',\n      matchScore: null,\n      confidenceScore: 0,\n      confidenceLevel: 'LOW',\n      matchExplanation: "AI analysis is currently unavailable.",\n      skillsMatch: "",\n      experienceMatch: "",\n      seniorityMatch: "",\n      industryMatch: "",\n      locationMatch: "",\n      educationMatch: "",\n      matchedSkills: [],\n      missingRequiredSkills: [],\n      missingNiceToHaveSkills: [],\n      concerns: [],\n      recommendation: 'UNAVAILABLE' as any,`
);

content = content.replace(
  /private analysisFailed\(jobDescription: string, baseCv: string\): JobMatchResult \{\n\s*return \{\n\s*analysisStatus: 'ANALYSIS_FAILED',\n\s*matchScore: null,\n\s*confidenceScore: 0,\n\s*matchExplanation: "AI analysis failed\.",\n\s*skillsMatch: "",\n\s*experienceMatch: "",\n\s*seniorityMatch: "",\n\s*industryMatch: "",\n\s*locationMatch: "",\n\s*educationMatch: "",\n\s*matchedSkills: \[\],\n\s*missingRequiredSkills: \[\],\n\s*missingNiceToHaveSkills: \[\],\n\s*concerns: \[\],\n\s*recommendation: 'LOW_PRIORITY',/,
  `private analysisFailed(jobDescription: string, baseCv: string): JobMatchResult {\n    return {\n      analysisStatus: 'ANALYSIS_FAILED',\n      matchScore: null,\n      confidenceScore: 0,\n      confidenceLevel: 'LOW',\n      matchExplanation: "AI analysis failed.",\n      skillsMatch: "",\n      experienceMatch: "",\n      seniorityMatch: "",\n      industryMatch: "",\n      locationMatch: "",\n      educationMatch: "",\n      matchedSkills: [],\n      missingRequiredSkills: [],\n      missingNiceToHaveSkills: [],\n      concerns: [],\n      recommendation: 'UNAVAILABLE' as any,`
);


fs.writeFileSync('src/services/matchingService.ts', content);
