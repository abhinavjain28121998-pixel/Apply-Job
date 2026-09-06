import fs from 'fs';
let content = fs.readFileSync('src/components/JobDetailModal.tsx', 'utf8');

// Update imports
content = content.replace(
  /import \{ Job \} from '\.\.\/types';/,
  `import { Job, JobMatch } from '../types';`
);

// Update interface
content = content.replace(
  /job: Partial<Job>;/,
  `job: Partial<Job>;\n  match: JobMatch | null;`
);

// Update component signature
content = content.replace(
  /export default function JobDetailModal\(\{ job, isSaved, onClose, onSave, onApplied \}: JobDetailModalProps\) \{/,
  `export default function JobDetailModal({ job, match, isSaved, onClose, onSave, onApplied }: JobDetailModalProps) {`
);

// Replace job.* with match.* for match properties
content = content.replace(/job\.matchScore/g, 'match?.matchScore');
content = content.replace(/job\.matchExplanation/g, 'match?.matchExplanation');
content = content.replace(/job\.matchedSkills/g, 'match?.matchedSkills');
content = content.replace(/job\.missingRequiredSkills/g, 'match?.missingRequiredSkills');
content = content.replace(/job\.recommendation/g, 'match?.recommendation');

fs.writeFileSync('src/components/JobDetailModal.tsx', content);

// Now fix FindJobs to pass `match`
let findJobsContent = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');
findJobsContent = findJobsContent.replace(
  /<JobDetailModal\s+job=\{selectedJob\}\s+isSaved=\{savedJobIds\.has\(selectedJob\.id!\)\}/,
  `<JobDetailModal
          job={selectedJob}
          match={matches.get(selectedJob.id!) || null}
          isSaved={savedJobIds.has(selectedJob.id!)}`
);
fs.writeFileSync('src/components/FindJobs.tsx', findJobsContent);
