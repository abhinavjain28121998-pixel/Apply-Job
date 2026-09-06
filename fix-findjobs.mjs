import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

// Replace state
content = content.replace(
  /const \[savedJobs, setSavedJobs\] = useState<Map<string, Partial<Job>>>\(new Map\(\)\);/,
  `const [matches, setMatches] = useState<Map<string, any>>(new Map());`
);

// Update fetchUserData to fetch matches as well
content = content.replace(
  /const fetchUserData = async \(\) => \{[\s\S]*?setSavedJobs\(savedMap\);\n    \};/,
  `const fetchUserData = async () => {
      const savedJobsList = await jobService.getSavedJobsForUser(user.uid);
      const savedIds = new Set<string>();
      savedJobsList.forEach(sj => savedIds.add(sj.jobId));
      setSavedJobIds(savedIds);
      
      // We don't fetch all matches initially to save bandwidth, or we could if we had an endpoint.
      // For now, let's assume we fetch them when requested, but let's just leave the map empty initially.
    };`
);

// Update analyzeJobsSequentially
content = content.replace(
  /const analyzeJobsSequentially = async \(jobsToAnalyze: Partial<Job>\[\]\) => \{[\s\S]*?\};/g,
  `const analyzeJob = async (job: Partial<Job>) => {
    if (!user || !job.id) return;
    setAnalyzingIds(prev => new Set(prev).add(job.id!));
    try {
      const profile = await resumeService.getProfile(user.uid);
      const res = await fetch('/api/analyze-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: job.description,
          baseCv: profile?.baseCvText || ''
        })
      });
      
      if (res.ok) {
        const analysis = await res.json();
        
        // Save the match
        const matchToSave = { ...analysis, jobId: job.id, userId: user.uid };
        await jobMatchService.saveMatch(matchToSave);
        
        setMatches(prev => {
          const next = new Map(prev);
          next.set(job.id!, matchToSave);
          return next;
        });

        // Ensure job is saved if analyzed
        if (!savedJobIds.has(job.id)) {
          await saveJob(job);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(job.id!);
        return next;
      });
    }
  };`
);

// Update saveJob
content = content.replace(
  /const saveJob = async \(job: Partial<Job>\) => \{[\s\S]*?alert\('Job saved!'\);\n    \}\n  \};/,
  `const saveJob = async (job: Partial<Job>) => {
    if (!user || !job.id) return;
    try {
      await jobService.saveJob(user.uid, job as any);
      setSavedJobIds(prev => new Set(prev).add(job.id!));
    } catch (err) {
      console.error(err);
    }
  };`
);

// Update getSortedResults
content = content.replace(
  /const getSortedResults = \(\) => \{[\s\S]*?return sorted;\n  \};/,
  `const getSortedResults = () => {
    let combined = results.map(job => ({
      job,
      match: matches.get(job.id!) || null,
      saved: savedJobIds.has(job.id!)
    }));
    
    if (sortBy === 'MATCH') {
      combined.sort((a, b) => ((b.match?.matchScore || 0) - (a.match?.matchScore || 0)));
    } else if (sortBy === 'RECENT') {
      combined.sort((a, b) => ((b.job.postedDate || 0) - (a.job.postedDate || 0)));
    } else if (sortBy === 'SALARY') {
      const parseSalary = (s?: string) => {
        if (!s) return 0;
        const match = s.match(/\\d+/g);
        if (match && match.length > 0) return parseInt(match[0], 10);
        return 0;
      };
      combined.sort((a, b) => parseSalary(b.job.salaryRange) - parseSalary(a.job.salaryRange));
    }
    return combined;
  };`
);

// Replace render mapping
content = content.replace(
  /\{sortedResults\.map\(job => \{/g,
  `{sortedResults.map(({job, match, saved}) => {`
);

// Replace isSaved
content = content.replace(/const isSaved = savedJobIds\.has\(job\.id!\);/g, 'const isSaved = saved;');

// Replace job.recommendation -> match?.recommendation
content = content.replace(/job\.recommendation === 'APPLY'/g, 'match?.recommendation === "APPLY"');
content = content.replace(/job\.recommendation/g, 'match?.recommendation');
content = content.replace(/job\.matchScore/g, 'match?.matchScore');
content = content.replace(/job\.matchExplanation/g, 'match?.matchExplanation');
content = content.replace(/job\.missingRequiredSkills/g, 'match?.missingRequiredSkills');
content = content.replace(/job\.matchedSkills/g, 'match?.matchedSkills');

// Replace analyzeJobsSequentially
content = content.replace(/onClick=\{\(\) => analyzeJobsSequentially\(\[job\]\)\}/g, 'onClick={() => analyzeJob(job)}');

fs.writeFileSync('src/components/FindJobs.tsx', content);
