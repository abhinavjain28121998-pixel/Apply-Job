import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

// Remove obsolete state
content = content.replace(
  /const \[baseCv, setBaseCv\] = useState<string>\(''\);\n/g,
  ''
);

// Remove auto-save from analyzeJob
content = content.replace(
  /\/\/ Ensure job is saved if analyzed\n        if \(!savedJobIds\.has\(job\.id\)\) \{\n          await saveJob\(job\);\n        \}/g,
  ''
);

fs.writeFileSync('src/components/FindJobs.tsx', content);
