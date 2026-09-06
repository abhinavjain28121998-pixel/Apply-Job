import fs from 'fs';
let content = fs.readFileSync('src/services/matchingService.ts', 'utf8');

const matchLogic = `let explanation = \`Match Score: \${score !== null ? score : 'N/A'}/100. \`;
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
      matchExplanation: explanation,`;

content = content.replace(
  /return \{\n\s*analysisStatus,\n\s*matchScore: score,\n\s*confidenceScore,\n\s*confidenceLevel,\n\s*matchExplanation: `Match Score: \$\{score !== null \? score : 'N\/A'\}\/100\. \$\{missingCritical\.length > 0 \? 'Missing critical requirements\.' : 'Good overall fit\.'\}`,\n/g,
  matchLogic + "\n"
);

fs.writeFileSync('src/services/matchingService.ts', content);
