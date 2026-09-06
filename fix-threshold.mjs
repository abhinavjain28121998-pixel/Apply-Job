import fs from 'fs';
let content = fs.readFileSync('src/services/matchingService.ts', 'utf8');
content = content.replace(
  /if \(score < 40 \|\| missingRequired\.length >= 3\) \{/g,
  `if (score < 40 || missingRequired.length > 0) {`
);
content = content.replace(
  /\} else if \(score < 65 \|\| missingRequired\.length > 0\) \{/g,
  `} else if (score < 65) {`
);
fs.writeFileSync('src/services/matchingService.ts', content);

let testContent = fs.readFileSync('tests/matchingService.test.ts', 'utf8');
testContent = testContent.replace(/expect\(result\.recommendation\)\.toBe\('LOW_PRIORITY'\); \/\/ because missing req\.\.\./g, "expect(result.recommendation).toBe('SKIP');");
fs.writeFileSync('tests/matchingService.test.ts', testContent);
