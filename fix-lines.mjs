import fs from 'fs';
let content = fs.readFileSync('src/components/FindJobs.tsx', 'utf8');
const lines = content.split('\n');
lines.splice(26, 4, '  const [savedJobs, setSavedJobs] = useState<Map<string, Partial<Job>>>(new Map());');
fs.writeFileSync('src/components/FindJobs.tsx', lines.join('\n'));
