import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

content = content.replace(
  /await jobService\.updateSavedJob\(user\.uid, job\.id!, \{ job: \{ \.\.\.\(savedJobs\.get\(job\.id!\) \|\| job\), \.\.\.analysis \} as any \}\);/g,
  `await jobMatchService.saveMatch({ ...analysis, jobId: job.id!, userId: user.uid, id: '' } as any);`
);

content = content.replace(
  /import \{ jobService \} from '\.\.\/services\/jobService';/g,
  `import { jobService } from '../services/jobService';\nimport { jobMatchService } from '../services/jobMatchService';`
);

content = content.replace(
  /await saveJob\(\{ \.\.\.job, \.\.\.analysis \}\);/g,
  `await saveJob(job);\n             await jobMatchService.saveMatch({ ...analysis, jobId: job.id!, userId: user.uid, id: '' } as any);`
);

fs.writeFileSync('src/components/FindJobs.tsx', content);
