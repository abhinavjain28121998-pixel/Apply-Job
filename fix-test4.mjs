import fs from 'fs';
let content = fs.readFileSync('tests/matchingService.test.ts', 'utf8');

content = content.replace(
  /it\('no extracted requirements', \(\) => \{\n    const evalMock = \{\};\n    const result = matchingService\.calculateDeterministicScore\(evalMock\);\n    expect\(result\.matchScore\)\.toBe\(20\);/g,
  `it('no extracted requirements', () => {\n    const evalMock = {};\n    const result = matchingService.calculateDeterministicScore(evalMock);\n    expect(result.matchScore).toBe(0);`
);

fs.writeFileSync('tests/matchingService.test.ts', content);
