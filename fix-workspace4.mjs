import fs from 'fs';

let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

// The rewrite logic is easier if I just fetch the file, modify it directly in memory, and save it.
content = content.replace(
  /const \[job, setJob\] = useState<Partial<Job> \| null>\(null\);/g,
  `const [savedJob, setSavedJob] = useState<SavedJob | null>(null);
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [app, setApp] = useState<Application | null>(null);
  const [profile, setProfile] = useState<any>(null);`
);

content = content.replace(
  /const combined: Partial<Job> = \{[\s\S]*?setJob\(combined\);/g,
  `setSavedJob(savedJobData);
          setMatch(matchData);
          setApp(appData);`
);

content = content.replace(
  /const saveJobState = async \(updates: Partial<Job>\) => \{[\s\S]*?\};/g,
  `const saveAppState = async (updates: Partial<Application>) => {
    if (!id || !user) return;
    try {
      const updatedApp = await applicationService.createOrUpdateApplication(user.uid, id, updates);
      setApp(updatedApp);
    } catch (e) {
      console.error(e);
      alert('Failed to save changes.');
    }
  };`
);

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
