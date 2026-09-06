import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

// Replace the line
content = content.replace(
  /const sortedResults = getSortedResults\(\)\.map\(job => savedJobs\.has\(job\.id!\) \? \{ \.\.\.job, \.\.\.savedJobs\.get\(job\.id!\) \} : job\);/,
  `const sortedResults = getSortedResults();`
);

fs.writeFileSync('src/components/FindJobs.tsx', content);
