import fs from 'fs';

let content = fs.readFileSync('src/components/AnalyzeJobModal.tsx', 'utf8');
content = content.replace(
  /const newMatch = \{ \.\.\.analysis, jobId: newJobId, userId: user\.uid \};/,
  `const newMatch = { ...analysis, jobId: newJobId, userId: user.uid, resumeVersion: profile.version || 'v1' };`
);
fs.writeFileSync('src/components/AnalyzeJobModal.tsx', content);

let content2 = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');
content2 = content2.replace(
  /const newMatch = \{ \.\.\.analysis, jobId: job\.id, userId: user\.uid \};/,
  `const newMatch = { ...analysis, jobId: job.id, userId: user.uid, resumeVersion: profile.version || 'v1' };`
);
fs.writeFileSync('src/components/FindJobs.tsx', content2);
