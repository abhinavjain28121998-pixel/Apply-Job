import fs from 'fs';
let content = fs.readFileSync('src/types.ts', 'utf8');

content = content.replace(
  /export interface JobMatch \{/g,
  `export interface JobMatch {\n  analysisStatus?: 'READY' | 'ANALYSIS_UNAVAILABLE' | 'ANALYSIS_FAILED';`
);

fs.writeFileSync('src/types.ts', content);
