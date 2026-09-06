import fs from 'fs';
let content = fs.readFileSync('src/services/matchingService.ts', 'utf8');

content = content.replace(
  /recommendation: 'LOW_PRIORITY',/g,
  `recommendation: 'UNAVAILABLE' as any,`
);

fs.writeFileSync('src/services/matchingService.ts', content);
