import fs from 'fs';

let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

// Imports
content = content.replace(
  /import \{ jobService \} from '\.\.\/services\/jobService';/g,
  `import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';
import { jobMatchService } from '../services/jobMatchService';
import { SavedJob, JobMatch, Application } from '../types';`
);

// Fetching
content = content.replace(
  /const fetchJob = async \(\) => \{[\s\S]*?fetchJob\(\);/g,
  `const fetchJob = async () => {
      setLoading(true);
      try {
        if (!id || !user) return;
        const savedJobData = await jobService.getSavedJob(user.uid, id);
        if (savedJobData) {
          const matchData = await jobMatchService.getMatch(user.uid, id);
          const appData = await applicationService.getApplication(user.uid, id);
          
          // Construct a UI friendly job object
          const combined: Partial<Job> = {
            ...savedJobData.job,
            ...matchData,
            ...appData,
            status: appData?.status || 'SAVED'
          };
          setJob(combined);
          
          if (appData?.coverLetter) setCoverLetter(appData.coverLetter);
          if (appData?.applicationAnswers) setAnswers(appData.applicationAnswers);
          if (appData?.bulletImprovements) setImprovements(appData.bulletImprovements);
          if (appData?.tailoredCv) setTailoredCv(appData.tailoredCv);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchJob();`
);

// Saving handlers
content = content.replace(
  /await jobService\.updateJob\(job\.id!, \{ status: 'APPLIED' \}\);/g,
  `await applicationService.updateApplicationStatus(user!.uid, job.id!, 'APPLIED');`
);

content = content.replace(
  /await jobService\.updateJob\(job\.id!, \{ coverLetter \}\);/g,
  `await applicationService.createOrUpdateApplication(user!.uid, job.id!, { coverLetter });`
);

content = content.replace(
  /await jobService\.updateJob\(job\.id!, \{ applicationAnswers: generatedAnswers \}\);/g,
  `await applicationService.createOrUpdateApplication(user!.uid, job.id!, { applicationAnswers: generatedAnswers });`
);

content = content.replace(
  /await jobService\.updateJob\(job\.id!, \{ bulletImprovements: newImprovements, tailoredCv \}\);/g,
  `await applicationService.createOrUpdateApplication(user!.uid, job.id!, { bulletImprovements: newImprovements, tailoredCv });`
);

content = content.replace(
  /await jobService\.updateJob\(job\.id!, \{ coverLetter: val \}\);/g,
  `await applicationService.createOrUpdateApplication(user!.uid, job.id!, { coverLetter: val });`
);

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
