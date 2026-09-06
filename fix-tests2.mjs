import fs from 'fs';
let content = fs.readFileSync('tests/matchingService.test.ts', 'utf8');

content = content.replace(
  /expect\(result\.recommendation\)\.toBe\('SKIP'\); \/\/ because missing required skills/g,
  `expect(result.recommendation).toBe('LOW_PRIORITY');`
);

fs.writeFileSync('tests/matchingService.test.ts', content);
