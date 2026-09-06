import fs from 'fs';
let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

// Add states
content = content.replace(
  /const \[generating, setGenerating\] = useState<'coverLetter' \| 'answers' \| 'tailor' \| 'analysis' \| null>\(null\);/,
  `const [generating, setGenerating] = useState<'coverLetter' | 'answers' | 'tailor' | 'analysis' | null>(null);\n  const [readiness, setReadiness] = useState(0);\n  const [reasons, setReasons] = useState<string[]>([]);\n  const [profile, setProfile] = useState<any>(null);`
);

// Fetch profile on load
content = content.replace(
  /const appData = await applicationService\.getApplication\(user\.uid, id\);/,
  `const appData = await applicationService.getApplication(user.uid, id);\n          const userProfile = await resumeService.getProfile(user.uid);\n          setProfile(userProfile);`
);

// Add useEffect to calculate readiness
content = content.replace(
  /if \(appData\?.tailoredCv\) setTailoredCv\(appData\.tailoredCv\);\n        \}\n      \} catch \(e\)/,
  `if (appData?.tailoredCv) setTailoredCv(appData.tailoredCv);
        }
      } catch (e)`
);

// I will just add the effect after the first useEffect
content = content.replace(
  /setLoading\(false\);\n    \};\n    fetchJob\(\);\n  \}, \[id, user\]\);/,
  `setLoading(false);
    };
    fetchJob();
  }, [id, user]);

  useEffect(() => {
    if (savedJob?.job) {
      const res = calculateApplicationReadiness(savedJob.job, match, app, profile);
      setReadiness(res.score);
      setReasons(res.reasons);
    }
  }, [savedJob, match, app, profile]);`
);

// Also need to use readiness state. Let's check where it's used.
content = content.replace(
  /const readiness = calculateApplicationReadiness\(savedJob\?.job || null, match, app, \{\} as any\);/,
  `// Used state variables for readiness and reasons`
);
content = content.replace(
  /<span className="text-xl font-bold">\{readiness\.score\}%<\/span>/,
  `<span className="text-xl font-bold">{readiness}%</span>`
);
content = content.replace(
  /readiness\.reasons\.map/g,
  `reasons.map`
);
content = content.replace(
  /readiness\.score/g,
  `readiness`
);

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
