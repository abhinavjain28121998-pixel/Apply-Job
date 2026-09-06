import fs from 'fs';
let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

content = content.replace(
  /const updatedApp = await applicationService\.createOrUpdateApplication\(user\.uid, id, updates\);/,
  `const finalUpdates = {
        ...updates,
        ...(match ? {
          matchScore: match.matchScore,
          resumeVersion: match.resumeVersion,
          datePrepared: match.analyzedAt || Date.now()
        } : {})
      };
      const updatedApp = await applicationService.createOrUpdateApplication(user.uid, id, finalUpdates);`
);

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
