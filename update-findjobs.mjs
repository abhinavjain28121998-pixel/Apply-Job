import fs from 'fs';

let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

// Update getJobsForUser -> getSavedJobsForUser
content = content.replace(
  /const jobs = await jobService\.getJobsForUser\(user\.uid\);/g,
  `const savedJobsList = await jobService.getSavedJobsForUser(user.uid);
      const jobs = savedJobsList.map(sj => sj.job);`
);

// Update saveJob call
content = content.replace(
  /await jobService\.saveJob\(fullJob\);/g,
  `await jobService.saveJob(user.uid, fullJob);`
);

// Update updateJob -> updateSavedJob
content = content.replace(
  /await jobService\.updateJob\(job\.id!, analysis\);/g,
  `await jobService.updateSavedJob(user.uid, job.id!, { job: { ...(savedJobs.get(job.id!) || job), ...analysis } as any });`
);

fs.writeFileSync('src/components/FindJobs.tsx', content);
