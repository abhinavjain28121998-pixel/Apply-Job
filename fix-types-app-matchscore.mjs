import fs from 'fs';
let content = fs.readFileSync('src/types.ts', 'utf8');

// Change Application matchScore
content = content.replace(
  /matchScore\?: number;/g,
  `matchScore?: number | null;`
);

// Update ResumeEvidence experience
content = content.replace(
  /experience: string;/g,
  `experience: {\n    totalYears: number | null;\n    relevantYears: number | null;\n    roles: WorkExperience[];\n  };`
);

fs.writeFileSync('src/types.ts', content);
