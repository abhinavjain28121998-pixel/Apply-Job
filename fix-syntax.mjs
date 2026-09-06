import fs from 'fs';
let content = fs.readFileSync('src/services/matchingService.ts', 'utf8');

// Replace all instances of `}|export` if they exist
content = content.replace(/\}\|export/g, '}\nexport');
// Deduplicate SkillMatch
content = content.replace(/export interface SkillMatch extends MatchEvidence \{\n  importance: 'REQUIRED' \| 'PREFERRED';\n\}\nexport interface SkillMatch extends MatchEvidence \{\n  importance: 'REQUIRED' \| 'PREFERRED';\n\}/g, `export interface SkillMatch extends MatchEvidence {\n  importance: 'REQUIRED' | 'PREFERRED';\n}`);

fs.writeFileSync('src/services/matchingService.ts', content);
