import fs from 'fs';
let content = fs.readFileSync('src/types.ts', 'utf8');

if (!content.includes('ResumeEvidence')) {
  content += `\nexport interface ResumeEvidence {\n  skills: string[];\n  experience: string;\n  education: string;\n  certifications: string[];\n  industries: string[];\n  other: string;\n}\n`;
  fs.writeFileSync('src/types.ts', content);
}
