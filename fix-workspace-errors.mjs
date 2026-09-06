import fs from 'fs';
let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

// replace job. with savedJob.job.
content = content.replace(/if \(!job \|\| !user\) return;/g, 'if (!savedJob?.job || !user) return;');
content = content.replace(/job\.description/g, 'savedJob?.job?.description');
content = content.replace(/!job/g, '!savedJob?.job');
content = content.replace(/job\./g, 'savedJob?.job?.');

content = content.replace(
  /const \{ score: readiness, reasons \} = calculateApplicationReadiness\([\s\S]*?\);/g,
  `const { score: readiness, reasons } = calculateApplicationReadiness(
    savedJob?.job || null, 
    match,
    app,
    profile
  );`
);

// fix saveAppState duplicate fetch
content = content.replace(/const profileData = await resumeService.getProfile\(user\.uid\);\n        setProfile\(profileData\);/g, '');

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
