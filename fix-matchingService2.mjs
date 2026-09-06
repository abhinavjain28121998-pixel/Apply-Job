import fs from 'fs';
let content = fs.readFileSync('src/services/matchingService.ts', 'utf8');

content = content.replace(
  /private fallbackAnalysis\(jobDescription: string, baseCv: string\): JobMatchResult \{\n    return \{\n      analysisStatus: 'ANALYSIS_UNAVAILABLE',\n      matchScore: 0,/g,
  `private fallbackAnalysis(jobDescription: string, baseCv: string): JobMatchResult {\n    return {\n      analysisStatus: 'ANALYSIS_UNAVAILABLE',\n      matchScore: null,`
);

content = content.replace(
  /let score = totalPossible > 0 \? Math\.round\(\(totalEarned \/ totalPossible\) \* 100\) : 0;/g,
  `let score = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : null;`
);

content = content.replace(
  /if \(score < 40 \|\| missingCritical\.length > 0\) \{/g,
  `if (score !== null && score < 40 || missingCritical.length > 0) {`
);
content = content.replace(
  /\} else if \(score < 65\) \{/g,
  `} else if (score !== null && score < 65) {`
);
content = content.replace(
  /\} else if \(score < 85 \|\| \(evaluation\.skills \|\| \[\]\)\.some\(\(s: any\) => s\.matchLevel === 'UNCLEAR'\) \|\| missingRequired\.length > 0\) \{/g,
  `} else if ((score !== null && score < 85) || (evaluation.skills || []).some((s: any) => s.matchLevel === 'UNCLEAR') || missingRequired.length > 0) {`
);

fs.writeFileSync('src/services/matchingService.ts', content);
