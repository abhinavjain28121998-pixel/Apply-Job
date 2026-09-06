import fs from 'fs';
let content = fs.readFileSync('src/services/matchingService.ts', 'utf8');

// Update prompt and categories
content = content.replace(
  /"SKILL" \| "EXPERIENCE" \| "RESPONSIBILITY" \| "EDUCATION" \| "CERTIFICATION" \| "LOCATION" \| "OTHER"/,
  `"SKILL" | "EXPERIENCE" | "SENIORITY" | "RESPONSIBILITY" | "INDUSTRY" | "EDUCATION" | "CERTIFICATION" | "LOCATION" | "OTHER"`
);

content = content.replace(
  /const validCategories = \['SKILL', 'EXPERIENCE', 'RESPONSIBILITY', 'EDUCATION', 'CERTIFICATION', 'LOCATION', 'OTHER'\];/,
  `const validCategories = ['SKILL', 'EXPERIENCE', 'SENIORITY', 'RESPONSIBILITY', 'INDUSTRY', 'EDUCATION', 'CERTIFICATION', 'LOCATION', 'OTHER'];`
);

fs.writeFileSync('src/services/matchingService.ts', content);
