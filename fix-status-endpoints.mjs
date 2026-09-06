import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(
  /fetch\('\/api\/jobs\/search'[\s\S]*?body: JSON.stringify\(\{ limit: 1 \}\)[\s\S]*?\)/g,
  `fetch('/api/provider/status')`
);
fs.writeFileSync('src/App.tsx', content);

let findJobsContent = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');
findJobsContent = findJobsContent.replace(
  /fetch\('\/api\/jobs\/search'[\s\S]*?body: JSON.stringify\(\{ limit: 1 \}\)[\s\S]*?\)/g,
  `fetch('/api/provider/status')`
);
fs.writeFileSync('src/components/FindJobs.tsx', findJobsContent);
