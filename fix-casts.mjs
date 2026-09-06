import fs from 'fs';

// Fix AnalyzeJobModal.tsx
let content1 = fs.readFileSync('src/components/AnalyzeJobModal.tsx', 'utf8');
content1 = content1.replace(/jobData as any/g, 'jobData as Job');
fs.writeFileSync('src/components/AnalyzeJobModal.tsx', content1);

// Fix FindJobs.tsx
let content2 = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');
content2 = content2.replace(/e.target.value as any/g, 'e.target.value as "MATCH" | "RECENT" | "SALARY"'); 
// Wait, one is workMode. 
content2 = content2.replace(/setFilters\(\{\.\.\.filters, workMode: e\.target\.value as "MATCH" \| "RECENT" \| "SALARY"\}\)/g, 'setFilters({...filters, workMode: e.target.value})');
fs.writeFileSync('src/components/FindJobs.tsx', content2);

// Fix JobTracker.tsx
let content3 = fs.readFileSync('src/components/JobTracker.tsx', 'utf8');
content3 = content3.replace(/newStatus as any/g, 'newStatus as import("../types").JobStatus');
fs.writeFileSync('src/components/JobTracker.tsx', content3);

