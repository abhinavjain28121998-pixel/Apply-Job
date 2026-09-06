import fs from 'fs';
let content = fs.readFileSync('tests/matchingService.test.ts', 'utf8');

content = content.replace(
  /it\('no extracted requirements', \(\) => \{/g,
  `it('unavailable AI analysis', () => {
    // When AI parsing fails or is empty, we set analysisStatus = ANALYSIS_FAILED
    const evalMock = null;
    const result = matchingService.calculateDeterministicScore(evalMock);
    expect(result.analysisStatus).toBe('ANALYSIS_FAILED');
  });

  it('no extracted requirements', () => {`
);

fs.writeFileSync('tests/matchingService.test.ts', content);
