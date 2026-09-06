import fs from 'fs';
let content = fs.readFileSync('src/components/AnalyzeJobModal.tsx', 'utf8');

content = content.replace(
  /await jobService\.saveJob\(\{[\s\S]*?status: 'SAVED',\n        dateAdded: Date\.now\(\)\n      \}\);/,
  `const newJobId = String(Math.random());
      const jobData = {
        id: newJobId,
        company,
        title,
        url,
        description,
        source: 'Manual'
      };
      
      await jobService.saveJob(user.uid, jobData as any);
      
      // Save the match
      const { jobMatchService } = await import('../services/jobMatchService');
      const newMatch = { ...analysis, jobId: newJobId, userId: user.uid };
      await jobMatchService.saveMatch(newMatch);`
);

fs.writeFileSync('src/components/AnalyzeJobModal.tsx', content);
