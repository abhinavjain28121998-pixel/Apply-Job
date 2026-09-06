import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

// Stop auto-analyzing search results in Demo Mode unless explicitly requested
// Replace the analyzeJobsSequentially call in handleSearch
content = content.replace(
  /if \(baseCv\) \{\s*analyzeJobsSequentially\(newJobs\);\s*\}/g,
  `// Auto-analysis is disabled to avoid hitting rate limits on search
        // Users can analyze individual jobs from the Workspace`
);

fs.writeFileSync('src/components/FindJobs.tsx', content);
