import fs from 'fs';
let content = fs.readFileSync('src/services/matchingService.ts', 'utf8');

// Replace the loop
content = content.replace(
  /for \(const req of evaluatedReqs\) \{[\s\S]*?totalEarned \+= reqEarned;\n    \}/,
  `for (const req of evaluatedReqs) {
      const weight = weights[req.category] || 5;
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
        } else {
          effectiveMatchLevel = 'MISSING';
        }
      }

      if (effectiveMatchLevel === 'MATCHED') {
        if (req.category === 'EXPERIENCE' && typeof req.requiredYears === 'number') {
          reqEarned = weight;
        } else {
          reqEarned = weight;
        }
        evidenceAvailableCount++;
        if (req.category === 'SKILL') matchedSkills.push(req.text);
      } else if (effectiveMatchLevel === 'UNCLEAR') {
        if (req.category === 'EXPERIENCE' && typeof req.requiredYears === 'number') {
          const candidateYears = typeof req.candidateYears === 'number' ? req.candidateYears : (evidence?.experience?.totalYears || 0);
          reqEarned = weight * (candidateYears / req.requiredYears);
        } else {
          reqEarned = (weight * 0.4);
        }
        unclearCount++;
      } else if (effectiveMatchLevel === 'MISSING') {
        if (req.critical) missingCritical.push(req.text);
        if (req.importance === 'REQUIRED') missingRequired.push(req.text);
        if (req.importance === 'PREFERRED') missingNiceToHave.push(req.text);
      }
      
      totalEarned += reqEarned;
    }`
);

fs.writeFileSync('src/services/matchingService.ts', content);
