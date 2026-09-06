import fs from 'fs';
let content = fs.readFileSync('src/types.ts', 'utf8');

content = content.replace(
  /matchScore: number;/g,
  `matchScore?: number | null;`
);

fs.writeFileSync('src/types.ts', content);
