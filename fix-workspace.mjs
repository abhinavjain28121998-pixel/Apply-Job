import fs from 'fs';
let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

content = content.replace(/saveJobState/g, 'saveAppState');

// Fix handleAnalyzeJob
content = content.replace(
  /const analysis = await res\.json\(\);\n        await saveAppState\(analysis\);/g,
  `const analysis = await res.json();
        const newMatch = { ...analysis, jobId: id!, userId: user.uid };
        await jobMatchService.saveMatch(newMatch);
        setMatch(newMatch);`
);

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
