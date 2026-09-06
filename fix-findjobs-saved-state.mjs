import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

// We need to merge saved jobs into the results
content = content.replace(
  /const fetchUserData = async \(\) => \{[\s\S]*?fetchUserData\(\);/g,
  `const [savedJobs, setSavedJobs] = useState<Map<string, Partial<Job>>>(new Map());

  useEffect(() => {
    if (!user) return;
    const fetchUserData = async () => {
      const jobs = await jobService.getJobsForUser(user.uid);
      const savedMap = new Map<string, Partial<Job>>();
      const savedIds = new Set<string>();
      jobs.forEach(j => {
        savedIds.add(j.id!);
        savedMap.set(j.id!, j);
      });
      setSavedJobIds(savedIds);
      setSavedJobs(savedMap);
    };
    fetchUserData();
  }, [user]); // We should also refresh this if they navigate back, but for now we'll do this`
);

// Map over results to merge in savedJobs data
content = content.replace(
  /const sortedResults = getSortedResults\(\);/g,
  `const sortedResults = getSortedResults().map(job => savedJobs.has(job.id!) ? { ...job, ...savedJobs.get(job.id!) } : job);`
);

fs.writeFileSync('src/components/FindJobs.tsx', content);
