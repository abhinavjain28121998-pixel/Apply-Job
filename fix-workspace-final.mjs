import fs from 'fs';

let content = fs.readFileSync('backup_workspace.txt', 'utf8');

// 1. Add profile state
content = content.replace(
  /const \[loading, setLoading\] = useState\(true\);/g,
  `const [loading, setLoading] = useState(true);\n  const [profile, setProfile] = useState<any>(null);`
);

// 2. Add profile fetch inside useEffect
content = content.replace(
  /if \(\!id \|\| !user\) return;/g,
  `if (!id || !user) return;\n        const profileData = await resumeService.getProfile(user.uid);\n        setProfile(profileData);`
);

// 3. Update readiness call
content = content.replace(
  /const \{ score: readiness, reasons \} = calculateApplicationReadiness\(job\);/g,
  `// Re-separate for calculateApplicationReadiness since it's merged into 'job' state currently for UI ease
  const { score: readiness, reasons } = calculateApplicationReadiness(
    job, 
    { analysisStatus: (job as any).analysisStatus, matchScore: (job as any).matchScore, recommendation: (job as any).recommendation } as any,
    { tailoredCv: (job as any).tailoredCv, coverLetter: (job as any).coverLetter, applicationAnswers: (job as any).applicationAnswers, bulletImprovements: (job as any).bulletImprovements } as any,
    profile
  );`
);

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
