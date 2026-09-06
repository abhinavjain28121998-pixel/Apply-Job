import fs from 'fs';
let content = fs.readFileSync('src/services/matchingService.ts', 'utf8');

content = content.replace(
  /reqEarned = weight \* \(candidateYears \/ req\.requiredYears\);/g,
  `if (candidateYears > 0) {
            reqEarned = weight * (candidateYears / req.requiredYears);
          } else {
            reqEarned = (weight * 0.4);
          }`
);

fs.writeFileSync('src/services/matchingService.ts', content);
