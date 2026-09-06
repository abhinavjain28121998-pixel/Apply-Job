import fs from 'fs';
let content = fs.readFileSync('src/services/applicationService.ts', 'utf8');

content = content.replace(
  /app = \{ \.\.\.existing, \.\.\.data \};/,
  `app = { ...existing, ...data, updatedAt: Date.now() };`
);

content = content.replace(
  /status: data\.status \|\| 'PREPARING',/,
  `status: data.status || 'PREPARING',\n        createdAt: Date.now(),\n        updatedAt: Date.now(),`
);

fs.writeFileSync('src/services/applicationService.ts', content);
