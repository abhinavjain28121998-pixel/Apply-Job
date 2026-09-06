import fs from 'fs';

let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

content = content.replace(
  /const fetchJob = async \(\) => \{[\s\S]*?if \(!id \|\| !user\) return;/,
  `const fetchJob = async () => {
      setLoading(true);
      try {
        if (!id || !user) return;
        const profileData = await resumeService.getProfile(user.uid);
        setProfile(profileData);`
);

content = content.replace(/saveJobState/g, 'saveAppState');

// I also need to replace all `job.` references to `savedJob.job.` where appropriate.
// Or `match.` or `app.` depending on what it was.
// The easiest way is to rewrite ApplicationWorkspace.tsx entirely. Let's write a script.
