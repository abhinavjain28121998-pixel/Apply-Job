import fs from 'fs';
let content = fs.readFileSync('src/components/AnalyzeJobModal.tsx', 'utf8');

content = content.replace(
  /const jobData = \{/g,
  `const newJobId = String(Math.random());\n      const jobData = {`
);

fs.writeFileSync('src/components/AnalyzeJobModal.tsx', content);
