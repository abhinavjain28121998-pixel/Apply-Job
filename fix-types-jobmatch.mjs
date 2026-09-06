import fs from 'fs';
let content = fs.readFileSync('src/types.ts', 'utf8');

// Add analyzedAt and resumeVersion to JobMatch
content = content.replace(
  /export interface JobMatch \{/,
  `export interface JobMatch {\n  analyzedAt?: number;\n  resumeVersion?: string;`
);

fs.writeFileSync('src/types.ts', content);
