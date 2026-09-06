import fs from 'fs';
let content = fs.readFileSync('tests/matchingService.test.ts', 'utf8');

content = content.replace(
  /it\('missing critical skill', \(\) => \{/g,
  `it('missing critical certification (other category)', () => {
    const evalMock = {
      education: { requirement: 'AWS Certified', critical: true, matchLevel: 'MISSING' },
      experience: { requirement: 'Req', matchLevel: 'MATCHED' }
    };
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.recommendation).toBe('SKIP');
  });

  it('missing critical education', () => {
    const evalMock = {
      education: { requirement: 'Bachelors Degree', critical: true, matchLevel: 'MISSING' },
      experience: { requirement: 'Req', matchLevel: 'MATCHED' }
    };
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.recommendation).toBe('SKIP');
  });

  it('missing critical skill', () => {`
);

fs.writeFileSync('tests/matchingService.test.ts', content);
