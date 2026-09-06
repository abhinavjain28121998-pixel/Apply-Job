import fs from 'fs';
let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

content = content.replace(
  /if \(\!job\) return <div className="p-8 text-center text-slate-500">Job not found<\/div>;\n\n  return \(/,
  `if (!job) return <div className="p-8 text-center text-slate-500">Job not found</div>;\n\n  // Unpack the combined job to its constituent parts for the readiness check if possible\n  // Actually, wait, job is currently a merged object: { ...savedJob.job, ...match, ...app }\n  // We can just cast it for now to the new signature by passing it as all 3, but the signature changed to accept them separately.\n  const { score: readiness, reasons } = calculateApplicationReadiness(job as any, job as any, job as any, profile);\n\n  return (`
);

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
