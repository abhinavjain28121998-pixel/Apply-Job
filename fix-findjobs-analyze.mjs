import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');

// Replace analyzeJobsSequentially
content = content.replace(
  /const analyzeJobsSequentially = async \([\s\S]*?\}\n  \};\n\n  const clearFilters/g,
  `const analyzeJobsSequentially = async (jobsToAnalyze: Partial<Job>[]) => {
    for (const job of jobsToAnalyze) {
      if (job.matchScore) continue;
      setAnalyzingIds(prev => new Set(prev).add(job.id!));
      try {
        const res = await fetch('/api/analyze-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobDescription: job.description,
            baseCv: baseCv
          })
        });
        
        if (res.ok) {
          const analysis = await res.json();
          
          // If the job is saved, persist the analysis to jobService immediately
          if (savedJobIds.has(job.id!)) {
             await jobService.updateJob(job.id!, analysis);
             // Also update local savedJobs map
             setSavedJobs(prev => {
                const next = new Map(prev);
                const existing = next.get(job.id!) || job;
                next.set(job.id!, { ...existing, ...analysis });
                return next;
             });
          } else {
             // If not saved, we just save it now automatically as they analyzed it
             await saveJob({ ...job, ...analysis });
          }

          setResults(prev => prev.map(j => {
            if (j.id === job.id) return { ...j, ...analysis };
            return j;
          }));
        }
      } catch (err) {
        console.error("Failed to analyze job", job.id);
      } finally {
        setAnalyzingIds(prev => {
          const next = new Set(prev);
          next.delete(job.id!);
          return next;
        });
      }
    }
  };

  const clearFilters`
);

fs.writeFileSync('src/components/FindJobs.tsx', content);
