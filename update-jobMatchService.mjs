import fs from 'fs';
let content = fs.readFileSync('src/services/jobMatchService.ts', 'utf8');

content = content.replace(
  /const docId = \`\$\{userId\}_\$\{jobId\}\`;/g,
  `const docId = \`\${userId}_\${jobId}\`; // Kept unique by composite because user can only have one match report per job`
);

content = content.replace(
  /const docId = \`\$\{match\.userId\}_\$\{match\.jobId\}\`;/g,
  `const docId = \`\${match.userId}_\${match.jobId}\`; // Kept unique by composite because user can only have one match report per job`
);

fs.writeFileSync('src/services/jobMatchService.ts', content);
