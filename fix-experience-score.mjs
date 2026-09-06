import fs from 'fs';
let content = fs.readFileSync('src/services/matchingService.ts', 'utf8');

content = content.replace(
  /\} else if \(effectiveMatchLevel === 'MISSING'\) \{[\s\S]*?if \(req\.importance === 'PREFERRED'\) missingNiceToHave\.push\(req\.text\);\n      \}/,
  `} else if (effectiveMatchLevel === 'MISSING') {
        if (req.category === 'EXPERIENCE' && typeof req.requiredYears === 'number') {
          const candidateYears = typeof req.candidateYears === 'number' ? req.candidateYears : (evidence?.experience?.totalYears || 0);
          if (candidateYears > 0) {
            reqEarned = weight * (candidateYears / req.requiredYears);
          }
        }
        if (req.critical) missingCritical.push(req.text);
        if (req.importance === 'REQUIRED') missingRequired.push(req.text);
        if (req.importance === 'PREFERRED') missingNiceToHave.push(req.text);
      }`
);

fs.writeFileSync('src/services/matchingService.ts', content);

// Also fix test 'no experience evidence' which expects 40, but gets 0.
// If req.candidateYears is null, and totalYears is null, it should be UNCLEAR since there is no evidence (or MISSING?).
// Wait, if there is no evidence, candidateYears is 0. 0 is far below 5, so it's MISSING. And reqEarned = 0.
// Why did the test expect 40? Because previously req.matchLevel was UNCLEAR, which gives weight * 0.4.
// Let me update the test or the code. If the original matchLevel is UNCLEAR and candidateYears is null, maybe we shouldn't override it to MISSING?
// Let's modify the override logic: if original matchLevel is UNCLEAR and candidateYears is null, keep it UNCLEAR.
let fix2 = fs.readFileSync('src/services/matchingService.ts', 'utf8');
fix2 = fix2.replace(
  /if \(candidateYears >= req\.requiredYears\) \{[\s\S]*?\} else \{/,
  `if (candidateYears >= req.requiredYears) {
          effectiveMatchLevel = 'MATCHED';
        } else if (candidateYears > 0 && candidateYears >= (req.requiredYears * 0.5)) {
          effectiveMatchLevel = 'UNCLEAR'; // Partial match
        } else if (candidateYears === 0 && req.matchLevel === 'UNCLEAR') {
          effectiveMatchLevel = 'UNCLEAR';
        } else {`
);
fs.writeFileSync('src/services/matchingService.ts', fix2);

