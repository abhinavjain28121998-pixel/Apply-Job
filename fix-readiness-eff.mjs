import fs from 'fs';
let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

content = content.replace(
  /fetchJob\(\);\n  \}, \[id, user\]\);/,
  `fetchJob();
  }, [id, user]);

  useEffect(() => {
    if (savedJob?.job) {
      const res = calculateApplicationReadiness(savedJob.job, match, app, userProfile);
      setReadiness(res.score);
      setReasons(res.reasons);
    }
  }, [savedJob, match, app, userProfile]);`
);

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
