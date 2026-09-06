import fs from 'fs';
let content = fs.readFileSync('src/types.ts', 'utf8');

// Add confidenceLevel
content = content.replace(
  /confidenceScore\?: number;/g,
  `confidenceScore?: number;\n  confidenceLevel?: 'HIGH' | 'MEDIUM' | 'LOW';`
);

fs.writeFileSync('src/types.ts', content);

// Now in MatchingService:
let matchSvc = fs.readFileSync('src/services/matchingService.ts', 'utf8');

// Also update JobMatchResult interface there
matchSvc = matchSvc.replace(
  /confidenceScore: number;/g,
  `confidenceScore: number;\n  confidenceLevel?: 'HIGH' | 'MEDIUM' | 'LOW';`
);

matchSvc = matchSvc.replace(
  /let confidenceScore = 100;\n    if \(evaluatedReqs\.length === 0\) \{[\s\S]*?confidenceScore = Math\.max\(0, Math\.round\(100 - penalty\)\);\n    \}/,
  `let confidenceScore = 100;
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
    else if (confidenceScore < 80) confidenceLevel = 'MEDIUM';`
);

// Add confidenceLevel to returns
matchSvc = matchSvc.replace(
  /confidenceScore,\n      matchExplanation:/g,
  `confidenceScore,
      confidenceLevel,
      matchExplanation:`
);

matchSvc = matchSvc.replace(
  /confidenceScore: 0,\n      matchExplanation: "Analysis is unavailable/g,
  `confidenceScore: 0,
      confidenceLevel: 'LOW',
      matchExplanation: "Analysis is unavailable`
);

matchSvc = matchSvc.replace(
  /confidenceScore: 0,\n      matchExplanation: "Analysis failed/g,
  `confidenceScore: 0,
      confidenceLevel: 'LOW',
      matchExplanation: "Analysis failed`
);

fs.writeFileSync('src/services/matchingService.ts', matchSvc);
