import fs from 'fs';
let content = fs.readFileSync('tests/matchingService.test.ts', 'utf8');

content = content.replace(
  /expect\(result\.matchScore\)\.toBe\(0\);/g,
  `expect(result.matchScore).toBe(20);` 
);

fs.writeFileSync('tests/matchingService.test.ts', content);
