import fs from 'fs';

let content = fs.readFileSync('src/components/JobTracker.tsx', 'utf8');

// The imports
content = content.replace(
  /import \{ jobService \} from '\.\.\/services\/jobService';/g,
  `import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';
import { jobMatchService } from '../services/jobMatchService';
import { SavedJob, Application, JobMatch, Job } from '../types';`
);

// State type
content = content.replace(
  /const \[jobs, setJobs\] = useState<Job\[\]>\(\[\]\);/g,
  `const [trackedJobs, setTrackedJobs] = useState<{saved: SavedJob, match: JobMatch | null, app: Application | null}[]>([]);`
);

// fetchJobs
content = content.replace(
  /const fetchJobs = async \(\) => \{[\s\S]*?finally \{/g,
  `const fetchJobs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const savedJobsList = await jobService.getSavedJobsForUser(user.uid);
      
      const apps = await applicationService.getApplicationsForUser(user.uid);
      const appMap = new Map(apps.map(a => [a.jobId, a]));

      // We need matches too. For now we can fetch individually or add a bulk get. 
      // Let's add a bulk get in jobMatchService or just fetch in loop for simplicity in demo.
      const matchPromises = savedJobsList.map(sj => jobMatchService.getMatch(user.uid, sj.jobId));
      const matches = await Promise.all(matchPromises);
      const matchMap = new Map();
      matches.forEach(m => { if (m) matchMap.set(m.jobId, m); });

      const combined = savedJobsList.map(sj => ({
        saved: sj,
        match: matchMap.get(sj.jobId) || null,
        app: appMap.get(sj.jobId) || null
      }));

      setTrackedJobs(combined.sort((a, b) => b.saved.dateAdded - a.saved.dateAdded));
    } catch (err) {
      console.error(err);
    } finally {`
);

// filter
content = content.replace(
  /const filteredJobs = jobs\.filter\(job => \{[\s\S]*?return true;\n  \}\);/g,
  `const filteredJobs = trackedJobs.filter(t => {
    if (filter === 'ALL') return true;
    if (filter === 'STRONG_MATCH') return t.match?.recommendation === 'APPLY';
    if (filter === 'APPLY_WITH_CHANGES') return t.match?.recommendation === 'APPLY_WITH_CHANGES';
    if (filter === 'LOW_PRIORITY') return t.match?.recommendation === 'LOW_PRIORITY';
    if (filter === 'APPLIED') return t.app?.status && ['APPLIED', 'INTERVIEW', 'OFFER'].includes(t.app.status);
    return true;
  });`
);

// The mapping
content = content.replace(
  /filteredJobs\.map\(job => \(/g,
  `filteredJobs.map(({ saved, match, app }) => (`
);
content = content.replace(/key=\{job\.id\}/g, `key={saved.id}`);
content = content.replace(/job\.title/g, `saved.job.title`);
content = content.replace(/job\.company/g, `saved.job.company`);
content = content.replace(/job\.url/g, `saved.job.url`);
content = content.replace(/job\.matchScore/g, `match?.matchScore`);
content = content.replace(/job\.recommendation/g, `match?.recommendation`);

// Status
content = content.replace(
  /value=\{job\.status\}/g,
  `value={app?.status || 'SAVED'}`
);
content = content.replace(
  /await jobService\.updateJob\(job\.id!, \{ status: newStatus as Job\['status'\] \}\);/g,
  `await applicationService.updateApplicationStatus(user.uid, saved.jobId, newStatus as any);`
);

// Workspace
content = content.replace(
  /navigate\(\`\/workspace\/\$\{job\.id\}\`\)/g,
  `navigate(\`/workspace/\${saved.jobId}\`)`
);

fs.writeFileSync('src/components/JobTracker.tsx', content);
