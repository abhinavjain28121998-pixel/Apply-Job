import fs from 'fs';
let content = fs.readFileSync('src/services/applicationReadinessService.ts', 'utf8');

// Change CV test
content = content.replace(
  /const hasBasicCv = profile && profile\.baseCvText && profile\.baseCvText\.length > 50;/g,
  `const hasBasicCv = profile && typeof profile.baseCvText === 'string' && profile.baseCvText.trim().length > 0;`
);

fs.writeFileSync('src/services/applicationReadinessService.ts', content);

let appWsContent = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');
appWsContent = appWsContent.replace(/Application Readiness/g, 'Application Preparedness');
appWsContent = appWsContent.replace(/Ready to apply!/g, 'Prepared to apply!');
appWsContent = appWsContent.replace(/calculateApplicationReadiness/g, 'calculateApplicationReadiness');
fs.writeFileSync('src/components/ApplicationWorkspace.tsx', appWsContent);

