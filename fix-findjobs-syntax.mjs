import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

// Find analyzeJob and replace the remaining junk
const analyzeJobRegex = /const analyzeJob = async \(job: Partial<Job>\) => \{[\s\S]*?return next;\n      \}\);\n    \}\n  \};/;
const match = content.match(analyzeJobRegex);
if (match) {
  const index = match.index;
  const nextFunctionRegex = /const getSortedResults = \(\) => \{/;
  const nextMatch = content.match(nextFunctionRegex);
  if (nextMatch) {
    const nextIndex = nextMatch.index;
    
    // the code to replace
    const codeToReplace = content.substring(index, nextIndex);
    
    content = content.substring(0, index) + match[0] + "\n\n  " + content.substring(nextIndex);
  }
}

fs.writeFileSync('src/components/FindJobs.tsx', content);
