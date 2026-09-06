import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

// The issue is around line 46 where fetchProviderStatus was referenced but not defined, or we have syntax errors due to our regex.
// Let's just rewrite the specific useEffects cleanly.
const useEffects = `  const [savedJobs, setSavedJobs] = useState<Map<string, Partial<Job>>>(new Map());

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
  }, [user]);

  useEffect(() => {
    fetch('/api/provider/status')
      .then(res => res.json())
      .then(data => setProviderStatus(data))
      .catch(console.error);
  }, []);`;

content = content.replace(/const \[savedJobs[\s\S]*?fetchProviderStatus\(\);\n  \}, \[user\]\);/g, useEffects);

// Fix the other ts error about missing importMeta env in firebase.ts
let fbContent = fs.readFileSync('src/firebase.ts', 'utf8');
fbContent = fbContent.replace(/import\.meta\.env/g, 'process.env');
fs.writeFileSync('src/firebase.ts', fbContent);

fs.writeFileSync('src/components/FindJobs.tsx', content);
