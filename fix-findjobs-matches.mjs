import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

// Change results state
content = content.replace(
  /const \[results, setResults\] = useState<Partial<Job>\[\]>\(\[\]\);/,
  `const [results, setResults] = useState<Job[]>([]);\n  const [matchesMap, setMatchesMap] = useState<Map<string, any>>(new Map());`
);
content = content.replace(
  /const \[selectedJob, setSelectedJob\] = useState<Partial<Job> \| null>\(null\);/,
  `const [selectedJob, setSelectedJob] = useState<Job | null>(null);`
);

// Add jobMatchService to imports if missing
if (!content.includes('jobMatchService')) {
  content = content.replace(
    /import \{ jobService \} from '\.\.\/services\/jobService';/,
    `import { jobService } from '../services/jobService';\nimport { jobMatchService } from '../services/jobMatchService';`
  );
}

// Update fetchUserData
content = content.replace(
  /\/\/ We don't fetch all matches initially to save bandwidth, or we could if we had an endpoint.\n\s*\/\/ For now, let's assume we fetch them when requested, but let's just leave the map empty initially./,
  `const matches = await jobMatchService.getMatchesForUser(user.uid);
      const matchMap = new Map();
      matches.forEach(m => matchMap.set(m.jobId, m));
      setMatchesMap(matchMap);`
);

// When a job is analyzed, update matchesMap
content = content.replace(
  /const newMatch = \{ \.\.\.analysis, jobId: job\.id, userId: user\.uid \};[\s\S]*?await jobMatchService\.saveMatch\(newMatch\);/,
  `const newMatch = { ...analysis, jobId: job.id, userId: user.uid };
        await jobMatchService.saveMatch(newMatch);
        
        setMatchesMap(prev => {
          const next = new Map(prev);
          next.set(job.id!, newMatch);
          return next;
        });`
);

// We need to pass matches to rendering correctly
content = content.replace(
  /const combined = results\.map\(job => \(\{[\s\S]*?\}\)\);/,
  `const combined = results.map(job => ({
      job,
      match: matchesMap.get(job.id!),
      saved: savedJobIds.has(job.id!)
    }));`
);

content = content.replace(
  /setResults\(data\.jobs\);/,
  `setResults(data.jobs as Job[]);`
);

content = content.replace(
  /setResults\(\[...results, ...data\.jobs\]\);/,
  `setResults([...results, ...(data.jobs as Job[])]);`
);

fs.writeFileSync('src/components/FindJobs.tsx', content);
