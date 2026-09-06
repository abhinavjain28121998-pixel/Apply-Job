import fs from 'fs';
let content = fs.readFileSync('src/services/matchingService.ts', 'utf8');

content = content.replace(
  /if \(!evaluation \|\| Object\.keys\(evaluation\)\.length === 0\) \{\n      analysisStatus = 'ANALYSIS_FAILED';\n    \}/g,
  `if (!evaluation || Object.keys(evaluation).length === 0) {
      analysisStatus = 'ANALYSIS_FAILED';
      evaluation = {};
    }`
);

fs.writeFileSync('src/services/matchingService.ts', content);
