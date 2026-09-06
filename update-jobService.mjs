import fs from 'fs';
let content = fs.readFileSync('src/services/jobService.ts', 'utf8');

content = content.replace(
  /const docId = \`\$\{userId\}_\$\{jobId\}\`;/g,
  `const docId = \`\${userId}_\${jobId}\`; // Kept unique by composite because user can only save a specific job once`
);

fs.writeFileSync('src/services/jobService.ts', content);
